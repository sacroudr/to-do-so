"""Acces Storage + base pour les pieces jointes PDF des taches (requirements.md §5).

Meme principe que les autres repos : cette couche isole TOUT l'acces a Supabase
(Storage + table `task_attachments`) des routes. Les uploads / downloads passent par
le client `service_role` (bypass RLS), et les telechargements se font via des URL
SIGNEES a duree limitee (bucket PRIVE) — jamais d'URL publique.

MODE DEGRADE (base/Storage injoignable) : lecture -> liste vide ; ecriture -> None
(la route repond alors 404 « indisponible »). SEULES les erreurs de connexion sont
interceptees (une erreur applicative reelle remonte normalement).
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

_OFFLINE_ERRORS = (httpx.TransportError, ConnectionError, OSError)

# Bucket PRIVE dedie (cree par la migration <timestamp>_task_attachments.sql).
_BUCKET = "task-attachments"
_ATTACHMENT_COLUMNS = (
    "id, task_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at"
)
# Duree de validite d'une URL signee de telechargement (1 heure).
_SIGNED_URL_TTL_SECONDS = 3600


def _signed_url(client: Any, storage_path: str) -> str | None:
    """URL signee (courte duree) pour telecharger un objet du bucket prive."""
    try:
        response = client.storage.from_(_BUCKET).create_signed_url(
            storage_path, _SIGNED_URL_TTL_SECONDS
        )
        # storage3 expose la cle sous « signedURL » (et parfois « signedUrl »).
        return response.get("signedURL") or response.get("signedUrl")
    except Exception as exc:  # noqa: BLE001 - une URL absente ne doit pas casser la liste
        logger.warning("URL signee indisponible pour %s: %s", storage_path, exc)
        return None


def _resolve_names(client: Any, user_ids: set[str]) -> dict[str, str]:
    """Resout {id -> nom} pour les auteurs des pieces jointes (affichage §5)."""
    if not user_ids:
        return {}
    rows = (
        client.table("profiles")
        .select("id, nom")
        .in_("id", list(user_ids))
        .execute()
        .data
        or []
    )
    return {row["id"]: row["nom"] for row in rows}


def create_attachment_record(
    *,
    task_id: str,
    content: bytes,
    file_name: str,
    content_type: str,
    uploaded_by: str,
) -> dict[str, Any] | None:
    """Televerse le PDF dans le Storage puis persiste la ligne ; None si injoignable.

    La validation (type PDF reel + taille) est faite en AMONT dans la route ; ici on
    se contente du stockage et de la persistance.
    """
    try:
        client = get_supabase_client()
        # Chemin unique par tache : evite les collisions et regroupe par tache.
        storage_path = f"{task_id}/{uuid4()}.pdf"
        client.storage.from_(_BUCKET).upload(
            storage_path,
            content,
            {"content-type": content_type, "upsert": "false"},
        )

        row = (
            client.table("task_attachments")
            .insert(
                {
                    "task_id": task_id,
                    "storage_path": storage_path,
                    "file_name": file_name,
                    "mime_type": content_type,
                    "size_bytes": len(content),
                    "uploaded_by": uploaded_by,
                }
            )
            .execute()
            .data[0]
        )
        names = _resolve_names(client, {uploaded_by} if uploaded_by else set())
        row["uploaded_by_name"] = names.get(uploaded_by)
        row["signed_url"] = _signed_url(client, storage_path)
        return row
    except _OFFLINE_ERRORS as exc:
        logger.warning("Storage/base injoignable (upload piece jointe), mode degrade: %s", exc)
        return None


def list_attachment_records(*, task_id: str) -> list[dict[str, Any]]:
    """Liste les pieces jointes d'une tache (plus anciennes d'abord), avec URL signee."""

    def _query() -> list[dict[str, Any]]:
        client = get_supabase_client()
        rows = (
            client.table("task_attachments")
            .select(_ATTACHMENT_COLUMNS)
            .eq("task_id", task_id)
            .order("created_at", desc=False)
            .execute()
            .data
            or []
        )
        author_ids = {row["uploaded_by"] for row in rows if row.get("uploaded_by")}
        names = _resolve_names(client, author_ids)
        for row in rows:
            row["uploaded_by_name"] = names.get(row.get("uploaded_by"))
            row["signed_url"] = _signed_url(client, row["storage_path"])
        return rows

    try:
        return _query()
    except _OFFLINE_ERRORS as exc:
        logger.warning("Base injoignable (liste pieces jointes), mode degrade: %s", exc)
        return []
