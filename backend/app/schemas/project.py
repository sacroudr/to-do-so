"""Schemas du domaine Projet (table `projects`, requirements.md §5)."""
from __future__ import annotations

from pydantic import BaseModel


class ProjectBase(BaseModel):
    nom: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    # Edition partielle : seuls les champs fournis sont modifies (§5). Le nom reste
    # obligatoire cote produit, mais on l'accepte optionnel ici pour permettre une
    # mise a jour ciblee (ex. description seule) ; la validation "non vide" est faite
    # cote formulaire / route.
    nom: str | None = None
    description: str | None = None


class Project(ProjectBase):
    id: str
