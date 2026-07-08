"""Acces base pour les projets (requirements.md §5 / §4.6).

Meme principe que `tasks_repo` : isole l'acces PostgreSQL et degrade gracieusement
(liste vide / echo a la creation) si la base est injoignable, afin que l'API reste
testable / demarrable avant provisionnement de la base.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)
_PROJECT_COLUMNS = "id, nom, description"


def list_project_records() -> list[dict[str, Any]]:
    """Liste tous les projets (§5), tries par nom. Liste vide si base injoignable."""
    try:
        client = get_supabase_client()
        rows = (
            client.table("projects")
            .select(_PROJECT_COLUMNS)
            .order("nom", desc=False)
            .execute()
            .data
        )
        return rows or []
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (projects), mode degrade: %s", exc)
        return []


def create_project_record(data: dict[str, Any]) -> dict[str, Any]:
    """Cree un projet (§5) ; renvoie le projet cree (echo si base injoignable)."""
    try:
        client = get_supabase_client()
        return client.table("projects").insert(data).execute().data[0]
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (create project), mode degrade: %s", exc)
        return {"id": str(uuid4()), **data}


def update_project_record(
    project_id: str, changes: dict[str, Any]
) -> dict[str, Any] | None:
    """Met a jour le nom / la description d'un projet ; None si introuvable (§5).

    Meme pattern que `update_task_record` : mode degrade (base injoignable) -> None,
    ce qui se traduit par un 404 cote route (mise a jour non confirmee).
    """
    try:
        client = get_supabase_client()
        if changes:
            result = (
                client.table("projects").update(changes).eq("id", project_id).execute()
            )
        else:
            # Aucun champ a modifier : on renvoie l'etat courant (ou None si absent).
            result = (
                client.table("projects")
                .select(_PROJECT_COLUMNS)
                .eq("id", project_id)
                .execute()
            )
        rows = result.data or []
        return rows[0] if rows else None
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (update project), mode degrade: %s", exc)
        return None
