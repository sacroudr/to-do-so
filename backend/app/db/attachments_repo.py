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

# Bucket PRIVE dedie (cree par la migration <timestamp>_task_attachments.sql). PUBLIC
# (sans underscore) car reutilise par la suppression en cascade d'un projet (point 3),
# qui doit purger les objets Storage des pieces jointes des taches supprimees.
ATTACHMENTS_BUCKET = "task-attachments"
_ATTACHMENT_COLUMNS = (
    "id, task_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at"
)
# Duree de validite d'une URL signee de telechargement (1 heure).
_SIGNED_URL_TTL_SECONDS = 3600


def _signed_url(client: Any, storage_path: str) -> str | None:
    """URL signee (courte duree) pour telecharger un objet du bucket prive."""
    try:
        response = client.storage.from_(ATTACHMENTS_BUCKET).create_signed_url(
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
        client.storage.from_(ATTACHMENTS_BUCKET).upload(
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


def remove_storage_objects(client: Any, storage_paths: list[str]) -> None:
    """Supprime des objets du bucket PRIVE (best-effort mutualise, points 3 et 5).

    Ne fait rien si la liste est vide. Les erreurs de CONNEXION (_OFFLINE_ERRORS) ne
    sont PAS interceptees ici : elles remontent a l'appelant, qui decide du mode degrade
    (ne pas supprimer la ligne DB tant que l'objet n'a pu etre purge -> pas d'orphelin).
    """
    if storage_paths:
        client.storage.from_(ATTACHMENTS_BUCKET).remove(storage_paths)


def list_storage_paths_for_tasks(client: Any, task_ids: list[str]) -> list[str]:
    """Chemins Storage de toutes les pieces jointes d'un lot de taches (cascade projet).

    Sert au point 3 : avant de supprimer les taches d'un projet, on collecte les objets
    Storage a purger (sinon on perd les `storage_path` avec les lignes -> fichiers
    orphelins). Renvoie une liste vide si aucune tache / aucune piece jointe.
    """
    if not task_ids:
        return []
    rows = (
        client.table("task_attachments")
        .select("storage_path")
        .in_("task_id", task_ids)
        .execute()
        .data
        or []
    )
    return [row["storage_path"] for row in rows if row.get("storage_path")]


def delete_attachment_record(*, task_id: str, attachment_id: str) -> bool:
    """Supprime une piece jointe (point 5) : purge l'objet Storage PUIS la ligne DB.

    Ordre important : on lit d'abord le `storage_path` (scope par tache + id), on retire
    l'objet du bucket, et SEULEMENT ensuite on supprime la ligne — aucun fichier
    orphelin. Renvoie True si une ligne a ete supprimee, False si introuvable ou base /
    Storage injoignable (mode degrade -> 404 cote route, rien n'a ete purge).
    """
    try:
        client = get_supabase_client()
        rows = (
            client.table("task_attachments")
            .select("storage_path")
            .eq("id", attachment_id)
            .eq("task_id", task_id)
            .execute()
            .data
            or []
        )
        if not rows:
            return False

        remove_storage_objects(client, [rows[0]["storage_path"]])

        deleted = (
            client.table("task_attachments")
            .delete()
            .eq("id", attachment_id)
            .eq("task_id", task_id)
            .execute()
            .data
        )
        return bool(deleted)
    except _OFFLINE_ERRORS as exc:
        logger.warning("Storage/base injoignable (suppression piece jointe), mode degrade: %s", exc)
        return False
