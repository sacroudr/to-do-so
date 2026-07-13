"""Schemas du domaine Tache (tables `tasks` / `task_assignees`, §4.2 et §5)."""
from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class TaskStatus(str, Enum):
    # Reduction 9 -> 6 statuts (point 1). Ordre = flux Kanban. Retires : a_qualifier
    # (-> a_planifier), waiting (-> todo), archive (-> done). Valeurs alignees sur
    # frontend/lib/types/domain.ts et l'enum Postgres (migration task_status_6_states).
    A_PLANIFIER = "a_planifier"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    A_TESTER = "a_tester"
    A_CORRIGER = "a_corriger"
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
    # Defaut d'une nouvelle tache = premier statut du flux (« a planifier »), point 1.
    # Aligne sur le default de la colonne DB (migration task_status_6_states).
    statut: TaskStatus = TaskStatus.A_PLANIFIER
    priorite: TaskPriority = TaskPriority.MEDIUM
    source: str | None = None


class TaskCreate(TaskBase):
    # Bornes de longueur (defense contre des payloads abusifs) appliquees a l'ENTREE
    # uniquement : le modele de SORTIE `Task` reste non contraint pour ne jamais rejeter
    # en LECTURE une ligne existante qui depasserait ces limites (validation niveau API,
    # pas contrainte DB retroactive).
    titre: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    due_date_text: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=500)
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
    # Memes bornes qu'a la creation ; les contraintes de longueur ne s'appliquent qu'aux
    # valeurs FOURNIES (None -> champ non modifie, ignore par min/max_length).
    titre: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    project_id: str | None = None
    due_date: date | None = None
    due_date_text: str | None = Field(default=None, max_length=200)
    statut: TaskStatus | None = None
    priorite: TaskPriority | None = None
    source: str | None = Field(default=None, max_length=500)
    assignee_ids: list[str] | None = None


class Task(TaskBase):
    id: str
    assignee_ids: list[str] = []
    # Progression de la checklist (§4.2, extension) : compteurs resolus dans la LISTE
    # des taches (une seule requete groupee, cf. tasks_repo) pour alimenter le badge
    # « done/total » sans requete par tache. 0/0 par defaut (tache sans sous-tache ou
    # base injoignable) -> le badge n'est alors pas affiche cote frontend.
    subtask_total: int = 0
    subtask_done: int = 0
    # Metadonnees d'audit renseignees par la base (facultatives cote schema pour
    # rester tolerant aux fabriques de test) : auteur + horodatages.
    created_by: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    # Instant de passage a « done » (point 4) : alimente le filtre d'archive (done
    # depuis > 10 min). Maintenu par le trigger DB set_completed_at ; null tant que la
    # tache n'est pas terminee.
    completed_at: str | None = None
