"""Acces base pour les personnes assignables (table `team_members`, point 2).

Meme principe que `tasks_repo` / `projects_repo` : isole l'acces PostgreSQL (client
service_role) et degrade gracieusement (liste vide / echo a la creation) si la base est
INJOIGNABLE, afin que l'API reste testable / demarrable avant provisionnement de la base.
SEULES les erreurs de connexion sont interceptees (une violation de contrainte quand la
base repond remonte normalement).
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)
_MEMBER_COLUMNS = "id, first_name, last_name"


def list_team_member_records() -> list[dict[str, Any]]:
    """Liste les personnes assignables (point 2), triees par nom. Vide si base injoignable."""
    try:
        client = get_supabase_client()
        rows = (
            client.table("team_members")
            .select(_MEMBER_COLUMNS)
            .order("first_name", desc=False)
            .order("last_name", desc=False)
            .execute()
            .data
        )
        return rows or []
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (team_members), mode degrade: %s", exc)
        return []


def create_team_member_record(data: dict[str, Any]) -> dict[str, Any]:
    """Cree une personne assignable (point 2) ; renvoie la ligne creee (echo si injoignable)."""
    try:
        client = get_supabase_client()
        return client.table("team_members").insert(data).execute().data[0]
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (create team_member), mode degrade: %s", exc)
        return {"id": str(uuid4()), **data}


def update_team_member_record(
    member_id: str, changes: dict[str, Any]
) -> dict[str, Any] | None:
    """Met a jour le prenom / nom d'une personne assignable ; None si introuvable (point 1).

    Meme pattern que `update_project_record` : mode degrade (base injoignable) -> None,
    ce qui se traduit par un 404 cote route (mise a jour non confirmee).
    """
    try:
        client = get_supabase_client()
        if changes:
            result = (
                client.table("team_members").update(changes).eq("id", member_id).execute()
            )
        else:
            # Aucun champ a modifier : on renvoie l'etat courant (ou None si absent).
            result = (
                client.table("team_members")
                .select(_MEMBER_COLUMNS)
                .eq("id", member_id)
                .execute()
            )
        rows = result.data or []
        return rows[0] if rows else None
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (update team_member), mode degrade: %s", exc)
        return None


def delete_team_member_record(member_id: str) -> bool:
    """Supprime une personne assignable ; True si une ligne a ete supprimee (point 1).

    La suppression de la ligne `team_members` retire AUTOMATIQUEMENT la personne des
    taches ou elle etait responsable, via la cascade FK
    `task_assignees.user_id -> team_members(id) on delete cascade` : les autres
    responsables restent, aucune tache n'est supprimee, et aucune ligne orpheline ne
    subsiste dans `task_assignees`. Cette garantie est POSTGRES, pas applicative
    (verifiee par les tests `@requires_db`).
    """
    try:
        client = get_supabase_client()
        result = client.table("team_members").delete().eq("id", member_id).execute()
        return bool(result.data)
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (delete team_member), mode degrade: %s", exc)
        return False
