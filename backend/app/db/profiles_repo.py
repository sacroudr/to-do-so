"""Acces base pour les profils (requirements.md §5 / §4.6).

Meme principe que `tasks_repo` : isole l'acces PostgreSQL et degrade gracieusement
(liste vide) si la base est injoignable.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)
_PROFILE_COLUMNS = "id, nom, email, avatar"


def list_profile_records() -> list[dict[str, Any]]:
    """Liste les membres de l'equipe (§5), tries par nom. Vide si base injoignable."""
    try:
        client = get_supabase_client()
        rows = (
            client.table("profiles")
            .select(_PROFILE_COLUMNS)
            .order("nom", desc=False)
            .execute()
            .data
        )
        return rows or []
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (profiles), mode degrade: %s", exc)
        return []
