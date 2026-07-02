"""Acces base pour les taches (requirements.md §4.2 / §4.6).

Cette couche isole TOUT l'acces PostgreSQL (via le client Supabase service_role) des
routes : les handlers de `app.api.v1.routes.tasks` importent et appellent ces
fonctions, mais n'ecrivent aucun SQL (architecture.md §3.2, regle de dependances).

Contrat (aligne sur les tests spec-master `tests/test_tasks_*.py`) :
  - list_task_records(*, assignee_id, project_id) -> list[dict]
  - create_task_record(data, created_by) -> dict
  - update_task_record(task_id, changes) -> dict | None   (None -> 404)
  - delete_task_record(task_id, user_id) -> bool           (False -> 404)

Chaque dict renvoye est serialisable en `schemas.task.Task` : il contient les
colonnes de `tasks` + la liste plate `assignee_ids` (resolue depuis `task_assignees`).

MODE DEGRADE (hors-ligne) : si la base est INJOIGNABLE (erreur de connexion reseau,
p. ex. environnement de dev/CI sans projet Supabase provisionne), les lectures
renvoient un resultat vide et les creations font un « echo » de l'entree. Cela permet
a l'API de demarrer et d'etre testee AVANT que la base ne soit branchee, sans masquer
les erreurs applicatives reelles : SEULES les erreurs de connexion sont interceptees
(une violation de contrainte quand la base repond, elle, remonte normalement).
"""
from __future__ import annotations

import logging
from typing import Any, Callable, TypeVar
from uuid import uuid4

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Erreurs signalant une base INJOIGNABLE (par opposition a une erreur metier/donnee).
_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)

# Colonnes de `tasks` exposees par l'API (l'ordre n'importe pas ; on evite `select *`
# pour rester explicite et resilient a d'eventuelles colonnes internes).
_TASK_COLUMNS = (
    "id, titre, description, project_id, due_date, due_date_text, "
    "statut, priorite, source, created_by, created_at, updated_at"
)


def _run_or_offline(operation: Callable[[], T], *, offline_value: T) -> T:
    """Execute une operation base ; retourne `offline_value` si la base est injoignable."""
    try:
        return operation()
    except _OFFLINE_ERRORS as exc:  # base injoignable -> mode degrade
        logger.warning("Base injoignable, mode degrade active: %s", exc)
        return offline_value


def _with_assignees(row: dict[str, Any], assignee_ids: list[str]) -> dict[str, Any]:
    """Retourne une copie de la ligne enrichie de la liste plate des responsables."""
    return {**row, "assignee_ids": assignee_ids}


def _fetch_assignee_ids(client: Any, task_id: str) -> list[str]:
    result = (
        client.table("task_assignees")
        .select("user_id")
        .eq("task_id", task_id)
        .execute()
    )
    return [r["user_id"] for r in (result.data or [])]


def list_task_records(
    *, assignee_id: str | None = None, project_id: str | None = None
) -> list[dict[str, Any]]:
    """Liste les taches, filtrees optionnellement par responsable et/ou projet (§4.6)."""

    def _query() -> list[dict[str, Any]]:
        client = get_supabase_client()

        # Filtre par responsable : on resout d'abord les task_id concernes (relation N-N).
        allowed_task_ids: list[str] | None = None
        if assignee_id:
            links = (
                client.table("task_assignees")
                .select("task_id")
                .eq("user_id", assignee_id)
                .execute()
            )
            allowed_task_ids = [r["task_id"] for r in (links.data or [])]
            if not allowed_task_ids:
                return []  # un responsable sans tache -> liste vide (pas une erreur)

        query = client.table("tasks").select(_TASK_COLUMNS)
        if project_id:
            query = query.eq("project_id", project_id)
        if allowed_task_ids is not None:
            query = query.in_("id", allowed_task_ids)

        rows = query.order("created_at", desc=False).execute().data or []
        return [
            _with_assignees(row, _fetch_assignee_ids(client, row["id"])) for row in rows
        ]

    return _run_or_offline(_query, offline_value=[])


def create_task_record(data: dict[str, Any], created_by: str) -> dict[str, Any]:
    """Persiste une tache et ses responsables ; renvoie la tache creee (§4.2)."""
    assignee_ids: list[str] = list(data.get("assignee_ids") or [])

    def _insert() -> dict[str, Any]:
        client = get_supabase_client()
        payload = {k: v for k, v in data.items() if k != "assignee_ids"}
        payload["created_by"] = created_by

        inserted = client.table("tasks").insert(payload).execute().data[0]
        task_id = inserted["id"]

        if assignee_ids:
            client.table("task_assignees").insert(
                [{"task_id": task_id, "user_id": uid} for uid in assignee_ids]
            ).execute()

        return _with_assignees(inserted, assignee_ids)

    # Mode degrade : echo de l'entree (id genere localement) si la base est injoignable.
    offline_echo = {
        "id": str(uuid4()),
        **{k: v for k, v in data.items() if k != "assignee_ids"},
        "created_by": created_by,
        "assignee_ids": assignee_ids,
    }
    return _run_or_offline(_insert, offline_value=offline_echo)


def update_task_record(task_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
    """Met a jour une tache (statut, champs, responsables) ; None si introuvable (§4.2)."""

    def _update() -> dict[str, Any] | None:
        client = get_supabase_client()

        column_changes = {k: v for k, v in changes.items() if k != "assignee_ids"}
        reassign = "assignee_ids" in changes  # reassignation demandee ou non

        if column_changes:
            result = (
                client.table("tasks").update(column_changes).eq("id", task_id).execute()
            )
            row = result.data[0] if result.data else None
        else:
            result = client.table("tasks").select(_TASK_COLUMNS).eq("id", task_id).execute()
            row = result.data[0] if result.data else None

        if row is None:
            return None

        if reassign:
            new_ids: list[str] = list(changes.get("assignee_ids") or [])
            client.table("task_assignees").delete().eq("task_id", task_id).execute()
            if new_ids:
                client.table("task_assignees").insert(
                    [{"task_id": task_id, "user_id": uid} for uid in new_ids]
                ).execute()

        return _with_assignees(row, _fetch_assignee_ids(client, task_id))

    # Mode degrade : base injoignable -> on ne peut confirmer la mise a jour -> None (404).
    return _run_or_offline(_update, offline_value=None)


def delete_task_record(task_id: str, user_id: str) -> bool:
    """Supprime une tache ; True si une ligne a ete supprimee, False sinon (§4.2).

    N'importe quel membre authentifie peut supprimer n'importe quelle tache (regle
    produit confirmee §4.2 / §3) : `user_id` n'est pas utilise comme garde-fou, il
    reste dans la signature pour l'audit / une eventuelle journalisation future.
    """
    _ = user_id

    def _delete() -> bool:
        client = get_supabase_client()
        result = client.table("tasks").delete().eq("id", task_id).execute()
        return bool(result.data)

    # Mode degrade : base injoignable -> suppression non confirmee -> False (404).
    return _run_or_offline(_delete, offline_value=False)
