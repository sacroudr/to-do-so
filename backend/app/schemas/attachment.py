"""Schemas des pieces jointes PDF d'une tache (table `task_attachments`, §5).

Chaque piece jointe est un PDF cumulable (historique, pas de remplacement). Le
`signed_url` (URL signee, courte duree) est calcule a la lecture pour permettre le
telechargement depuis un bucket PRIVE — jamais d'URL publique.
"""
from __future__ import annotations

from pydantic import BaseModel


class Attachment(BaseModel):
    id: str
    task_id: str
    file_name: str
    mime_type: str
    size_bytes: int
    # Auteur de l'ajout (§5 : « qui l'a ajoutée ») + son nom resolu pour l'affichage.
    uploaded_by: str | None = None
    uploaded_by_name: str | None = None
    created_at: str | None = None
    # URL signee (bucket prive) pour le telechargement ; None si indisponible.
    signed_url: str | None = None
