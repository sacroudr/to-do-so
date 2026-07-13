"""Schemas des sous-taches (checklist) d'une tache (table `task_subtasks`).

Chaque sous-tache est un item de checklist rattache a une tache principale (§4.2,
extension). L'ordre d'affichage est porte par `position` (0..n) ; le reordonnancement
se fait en envoyant la liste ORDONNEE des identifiants (`SubtaskReorder`).
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class Subtask(BaseModel):
    id: str
    task_id: str
    title: str
    is_done: bool = False
    position: int
    created_at: str | None = None


class SubtaskCreate(BaseModel):
    """Creation d'un item : seul le titre (non vide) est requis ; ajoute en fin de liste."""

    # max_length borne l'entree ; le validateur ci-dessous reste la contrainte non-vide
    # (plus stricte : rejette aussi les titres composes uniquement d'espaces).
    title: str = Field(min_length=1, max_length=500)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre de la sous-tache ne peut pas etre vide.")
        return cleaned


class SubtaskUpdate(BaseModel):
    """Mise a jour partielle : cocher/decocher (`is_done`) et/ou renommer (`title`).

    Les deux champs sont optionnels ; seuls ceux fournis (exclude_unset) sont appliques.
    """

    is_done: bool | None = None
    title: str | None = Field(default=None, min_length=1, max_length=500)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre de la sous-tache ne peut pas etre vide.")
        return cleaned


class SubtaskReorder(BaseModel):
    """Reordonnancement : liste ORDONNEE des identifiants de sous-taches.

    La position de chaque item est deduite de son index dans `ordered_ids`.
    """

    ordered_ids: list[str]
