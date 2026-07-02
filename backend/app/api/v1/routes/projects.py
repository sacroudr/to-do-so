"""Endpoints Projets (requirements.md §5). Protege par JWT.

La couche route reste fine : l'acces base est delegue a `app.db.projects_repo`
(seams `list_project_records` / `create_project_record` importees ici).
"""
from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser
from app.db.projects_repo import create_project_record, list_project_records
from app.schemas.project import Project, ProjectCreate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(user: CurrentUser) -> list[Project]:
    """Liste les projets de l'equipe (§5), pour l'affichage et le filtre projet (§4.6)."""
    _ = user
    return [Project(**record) for record in list_project_records()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: CurrentUser) -> Project:
    """Cree un projet / thematique (§5)."""
    _ = user
    record = create_project_record(data=payload.model_dump())
    return Project(**record)
