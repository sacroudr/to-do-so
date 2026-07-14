"""Acces base pour les sous-taches (checklist) des taches (§4.2, extension).

Meme principe que les autres repos : cette couche isole TOUT l'acces PostgreSQL (via
le client Supabase service_role) des routes. Les handlers de
`app.api.v1.routes.subtasks` importent et appellent ces fonctions, mais n'ecrivent
aucun SQL.

Contrat (aligne sur les seams attendus par la route / les tests) :
  - list_subtask_records(*, task_id) -> list[dict]                       (triees par position)
  - create_subtask_record(*, task_id, title) -> dict | None             (None -> 404 tache absente)
  - update_subtask_record(*, task_id, subtask_id, changes) -> dict|None  (None -> 404)
  - delete_subtask_record(*, task_id, subtask_id) -> bool               (False -> 404)
  - reorder_subtask_records(*, task_id, ordered_ids) -> list[dict]|None  (None -> 404)

Chaque ecriture est SCOPEE par `task_id` : une sous-tache appartenant a une autre
tache n'est jamais touchee (verification implicite du parent). Les creations /
reordonnancements verifient explicitement l'existence de la tache parente.

MODE DEGRADE (base injoignable) : lectures -> resultat vide ; ecritures -> None/False.
SEULES les erreurs de connexion sont interceptees (une erreur applicative reelle
remonte normalement).
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)

_SUBTASK_COLUMNS = "id, task_id, title, statut, position, created_at"


def _task_exists(client: Any, task_id: str) -> bool:
    """Verifie l'existence de la tache parente (garde des ecritures)."""
    rows = client.table("tasks").select("id").eq("id", task_id).limit(1).execute().data
    return bool(rows)


def _list(client: Any, task_id: str) -> list[dict[str, Any]]:
    """Sous-taches d'une tache, triees par position croissante."""
    return (
        client.table("task_subtasks")
        .select(_SUBTASK_COLUMNS)
        .eq("task_id", task_id)
        .order("position", desc=False)
        .execute()
        .data
        or []
    )


def list_subtask_records(*, task_id: str) -> list[dict[str, Any]]:
    """Liste les sous-taches d'une tache (ordre d'affichage). [] si base injoignable."""
    try:
        return _list(get_supabase_client(), task_id)
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (liste sous-taches), mode degrade: %s", exc)
        return []


def create_subtask_record(*, task_id: str, title: str) -> dict[str, Any] | None:
    """Cree une sous-tache en FIN de liste (position = max + 1) ; None si tache absente."""
    try:
        client = get_supabase_client()
        if not _task_exists(client, task_id):
            return None

        # Position en fin de liste : max(position) + 1, ou 0 si la checklist est vide.
        last = (
            client.table("task_subtasks")
            .select("position")
            .eq("task_id", task_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
            .data
        )
        next_position = (last[0]["position"] + 1) if last else 0

        return (
            client.table("task_subtasks")
            .insert(
                {"task_id": task_id, "title": title, "position": next_position}
            )
            .execute()
            .data[0]
        )
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (creation sous-tache), mode degrade: %s", exc)
        return None


def update_subtask_record(
    *, task_id: str, subtask_id: str, changes: dict[str, Any]
) -> dict[str, Any] | None:
    """Change le statut et/ou renomme une sous-tache ; None si introuvable pour cette tache.

    L'ecriture est scopee par `task_id` ET `id` : une sous-tache d'une autre tache
    (ou un id inexistant) ne renvoie aucune ligne -> None (404).
    """
    try:
        client = get_supabase_client()

        if changes:
            rows = (
                client.table("task_subtasks")
                .update(changes)
                .eq("id", subtask_id)
                .eq("task_id", task_id)
                .execute()
                .data
            )
        else:
            # Aucun champ a modifier : on relit simplement la ligne (no-op tolerant).
            rows = (
                client.table("task_subtasks")
                .select(_SUBTASK_COLUMNS)
                .eq("id", subtask_id)
                .eq("task_id", task_id)
                .execute()
                .data
            )
        return rows[0] if rows else None
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (maj sous-tache), mode degrade: %s", exc)
        return None


def delete_subtask_record(*, task_id: str, subtask_id: str) -> bool:
    """Supprime une sous-tache (scopee par tache) ; True si une ligne a ete supprimee."""
    try:
        client = get_supabase_client()
        rows = (
            client.table("task_subtasks")
            .delete()
            .eq("id", subtask_id)
            .eq("task_id", task_id)
            .execute()
            .data
        )
        return bool(rows)
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (suppression sous-tache), mode degrade: %s", exc)
        return False


def reorder_subtask_records(
    *, task_id: str, ordered_ids: list[str]
) -> list[dict[str, Any]] | None:
    """Applique les positions depuis la liste ORDONNEE d'ids ; None si tache absente.

    Chaque mise a jour est scopee par `task_id` : un id n'appartenant pas a la tache
    est ignore silencieusement (aucune ligne affectee), sans compromettre les autres.
    """
    try:
        client = get_supabase_client()
        if not _task_exists(client, task_id):
            return None

        for index, subtask_id in enumerate(ordered_ids):
            client.table("task_subtasks").update({"position": index}).eq(
                "id", subtask_id
            ).eq("task_id", task_id).execute()

        return _list(client, task_id)
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (reordre sous-taches), mode degrade: %s", exc)
        return None
