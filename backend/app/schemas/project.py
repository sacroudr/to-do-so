"""Schemas du domaine Projet (table `projects`, requirements.md §5)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    nom: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    # Bornes de longueur cote ENTREE uniquement (le modele de sortie `Project` reste
    # non contraint pour ne jamais rejeter une ligne existante en lecture).
    nom: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20000)


class ProjectUpdate(BaseModel):
    # Edition partielle : seuls les champs fournis sont modifies (§5). Le nom reste
    # obligatoire cote produit, mais on l'accepte optionnel ici pour permettre une
    # mise a jour ciblee (ex. description seule) ; les bornes ne s'appliquent qu'aux
    # valeurs fournies (min_length=1 rejette un nom explicitement vide).
    nom: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20000)


class Project(ProjectBase):
    id: str
