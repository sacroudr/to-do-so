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
    list_archived_task_records,
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
    archived: bool = Query(
        False, description="true = uniquement les taches archivees (done > 10 min)"
    ),
) -> list[Task]:
    """Liste les taches DU COMPTE CONNECTE, filtrees par responsable / projet (§4.6).

    Isolation par utilisateur : chaque compte ne voit que SES propres taches (owner_id =
    sub du JWT). Par defaut : vue ACTIVE (exclut les taches archivees, point 4).
    `archived=true` renvoie EXACTEMENT les taches archivees du compte (page Archive).
    """
    if archived:
        records = list_archived_task_records(
            owner_id=user.id, assignee_id=assignee, project_id=project
        )
    else:
        records = list_task_records(
            owner_id=user.id, assignee_id=assignee, project_id=project
        )
    return [Task(**record) for record in records]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser) -> Task:
    """Cree une tache (avec responsables multiples) ; l'auteur est deduit du JWT (§4.2)."""
    record = create_task_record(data=payload.model_dump(mode="json"), created_by=user.id)
    return Task(**record)


@router.patch("/{task_id}")
def update_task(task_id: str, payload: TaskUpdate, user: CurrentUser) -> Task:
    """Modifie / reassigne / change le statut d'une tache DU COMPTE CONNECTE ; 404 sinon.

    Isolation par utilisateur : on ne peut modifier qu'une tache que l'on a creee (§4.2) ;
    une tache d'un autre compte est traitee comme introuvable (404, sans fuite d'existence).
    """
    record = update_task_record(
        task_id=task_id,
        changes=payload.model_dump(mode="json", exclude_unset=True),
        owner_id=user.id,
    )
    if record is None:
        raise NotFoundError("Tache introuvable.")
    return Task(**record)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, user: CurrentUser) -> Response:
    """Supprime une tache DU COMPTE CONNECTE ; 404 si introuvable ou non possedee (§4.2).

    Isolation par utilisateur : on ne peut supprimer que ses propres taches (owner_id =
    sub du JWT). Ceci remplace l'ancienne regle « tout membre supprime toute tache »."""
    deleted = delete_task_record(task_id=task_id, user_id=user.id)
    if not deleted:
        raise NotFoundError("Tache introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
