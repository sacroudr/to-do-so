"""Sous-taches (checklist) d'une tache principale (§4.2, extension) — endpoints
imbriques sous /api/v1/tasks/{task_id}/subtasks. Proteges par JWT.

Ressources :
  - GET    /tasks/{task_id}/subtasks            -> liste (triee par position)
  - POST   /tasks/{task_id}/subtasks            -> creer (title) en fin de liste
  - PATCH  /tasks/{task_id}/subtasks/{sub_id}   -> changer le statut et/ou renommer
  - DELETE /tasks/{task_id}/subtasks/{sub_id}   -> supprimer
  - PUT    /tasks/{task_id}/subtasks/order      -> reordonner (liste ordonnee d'ids)

La couche route reste fine : la persistance est deleguee a `app.db.subtasks_repo`
(seams importees ici, remplacables par monkeypatch dans les tests). Chaque action de
mutation verifie l'existence de la tache parente (via le contrat des seams : un
resultat None / False vaut 404).
"""
from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser
from app.core.errors import NotFoundError
from app.db.subtasks_repo import (
    create_subtask_record,
    delete_subtask_record,
    list_subtask_records,
    reorder_subtask_records,
    update_subtask_record,
)
from app.schemas.subtask import Subtask, SubtaskCreate, SubtaskReorder, SubtaskUpdate

router = APIRouter(prefix="/tasks", tags=["subtasks"])


@router.get("/{task_id}/subtasks")
def list_subtasks(task_id: str, user: CurrentUser) -> list[Subtask]:
    """Liste les sous-taches d'une tache, triees par position."""
    _ = user
    return [Subtask(**record) for record in list_subtask_records(task_id=task_id)]


@router.post("/{task_id}/subtasks", status_code=status.HTTP_201_CREATED)
def create_subtask(task_id: str, payload: SubtaskCreate, user: CurrentUser) -> Subtask:
    """Cree une sous-tache (title) en fin de liste ; 404 si la tache est introuvable."""
    _ = user
    record = create_subtask_record(task_id=task_id, title=payload.title)
    if record is None:
        raise NotFoundError("Tache introuvable.")
    return Subtask(**record)


@router.patch("/{task_id}/subtasks/{sub_id}")
def update_subtask(
    task_id: str, sub_id: str, payload: SubtaskUpdate, user: CurrentUser
) -> Subtask:
    """Change le statut et/ou renomme une sous-tache ; 404 si introuvable."""
    _ = user
    record = update_subtask_record(
        task_id=task_id,
        subtask_id=sub_id,
        changes=payload.model_dump(exclude_unset=True),
    )
    if record is None:
        raise NotFoundError("Sous-tache introuvable.")
    return Subtask(**record)


@router.delete("/{task_id}/subtasks/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(task_id: str, sub_id: str, user: CurrentUser) -> Response:
    """Supprime une sous-tache ; 404 si introuvable pour cette tache."""
    _ = user
    deleted = delete_subtask_record(task_id=task_id, subtask_id=sub_id)
    if not deleted:
        raise NotFoundError("Sous-tache introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{task_id}/subtasks/order")
def reorder_subtasks(
    task_id: str, payload: SubtaskReorder, user: CurrentUser
) -> list[Subtask]:
    """Reordonne les sous-taches selon la liste d'ids ; 404 si la tache est introuvable."""
    _ = user
    records = reorder_subtask_records(task_id=task_id, ordered_ids=payload.ordered_ids)
    if records is None:
        raise NotFoundError("Tache introuvable.")
    return [Subtask(**record) for record in records]
