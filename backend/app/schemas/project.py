"""Schemas du domaine Projet (table `projects`, requirements.md §5)."""
from __future__ import annotations

from pydantic import BaseModel


class ProjectBase(BaseModel):
    nom: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: str
