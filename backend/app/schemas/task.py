"""Schemas du domaine Tache (tables `tasks` / `task_assignees`, §4.2 et §5)."""
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, model_validator


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    BLOCKED = "blocked"
    DONE = "done"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskBase(BaseModel):
    titre: str
    description: str | None = None
    project_id: str | None = None
    # Echeance (§4.2) : DEUX champs distincts, EXACTEMENT UN doit etre renseigne
    # (regle produit confirmee) : soit une date precise `due_date` (vrai type date ->
    # une valeur mal formee comme « 2026-13-40 » est rejetee nativement en 422), soit
    # un texte libre `due_date_text` (ex. « mi-juillet »). La contrainte « exactement
    # un » est appliquee a la CREATION (voir TaskCreate) ; la table applique aussi une
    # contrainte CHECK equivalente (migration).
    due_date: date | None = None
    due_date_text: str | None = None
    statut: TaskStatus = TaskStatus.TODO
    priorite: TaskPriority = TaskPriority.MEDIUM
    source: str | None = None


class TaskCreate(TaskBase):
    # Identifiants des responsables (relation multiple via `task_assignees`).
    assignee_ids: list[str] = []

    @model_validator(mode="after")
    def _exactly_one_due(self) -> "TaskCreate":
        """Exactement un des deux champs d'echeance doit etre fourni (§4.2)."""
        has_date = self.due_date is not None
        has_text = self.due_date_text is not None and self.due_date_text.strip() != ""
        if has_date == has_text:
            raise ValueError(
                "Renseignez exactement une echeance : soit une date precise "
                "(due_date), soit une indication libre (due_date_text)."
            )
        return self


class TaskUpdate(BaseModel):
    titre: str | None = None
    description: str | None = None
    project_id: str | None = None
    due_date: date | None = None
    due_date_text: str | None = None
    statut: TaskStatus | None = None
    priorite: TaskPriority | None = None
    source: str | None = None
    assignee_ids: list[str] | None = None


class Task(TaskBase):
    id: str
    assignee_ids: list[str] = []
    # Metadonnees d'audit renseignees par la base (facultatives cote schema pour
    # rester tolerant aux fabriques de test) : auteur + horodatages.
    created_by: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
