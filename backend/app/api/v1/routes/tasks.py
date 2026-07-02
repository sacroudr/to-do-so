"""Endpoints Taches (requirements.md §4.2 et §4.6).

La couche route reste fine : validation (schemas Pydantic) + orchestration. TOUT
l'acces PostgreSQL est delegue a `app.db.tasks_repo` (importe ici) — jamais de SQL
dans ce module. Les noms importes (`list_task_records`, `create_task_record`,
`update_task_record`, `delete_task_record`) constituent les coutures (seams)
attendues par les tests spec-master.
"""
from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser
from app.core.errors import NotFoundError
from app.db.tasks_repo import (
    create_task_record,
    delete_task_record,
    list_task_records,
    update_task_record,
)
from app.schemas.task import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
def list_tasks(
    user: CurrentUser,
    assignee: str | None = Query(None, description="Filtre par responsable (uuid)"),
    project: str | None = Query(None, description="Filtre par projet (uuid)"),
) -> list[Task]:
    """Liste les taches de l'equipe, filtrees par responsable / projet (§4.6)."""
    _ = user
    records = list_task_records(assignee_id=assignee, project_id=project)
    return [Task(**record) for record in records]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser) -> Task:
    """Cree une tache (avec responsables multiples) ; l'auteur est deduit du JWT (§4.2)."""
    record = create_task_record(data=payload.model_dump(mode="json"), created_by=user.id)
    return Task(**record)


@router.patch("/{task_id}")
def update_task(task_id: str, payload: TaskUpdate, user: CurrentUser) -> Task:
    """Modifie / reassigne / change le statut d'une tache ; 404 si introuvable (§4.2)."""
    _ = user
    record = update_task_record(
        task_id=task_id,
        changes=payload.model_dump(mode="json", exclude_unset=True),
    )
    if record is None:
        raise NotFoundError("Tache introuvable.")
    return Task(**record)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, user: CurrentUser) -> Response:
    """Supprime une tache ; 404 si introuvable. Ouvert a tout membre (§4.2)."""
    deleted = delete_task_record(task_id=task_id, user_id=user.id)
    if not deleted:
        raise NotFoundError("Tache introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
