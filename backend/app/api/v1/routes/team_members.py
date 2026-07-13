"""Endpoints Personnes assignables (table `team_members`, point 2). Protege par JWT.

La couche route reste fine : l'acces base est delegue a `app.db.team_members_repo`
(seams `list_team_member_records` / `create_team_member_record` importees ici). Les
`team_members` sont les responsables proposes par le formulaire de tache et le filtre
par responsable (points 2 et 3), en remplacement des `profiles`.
"""
from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser
from app.core.errors import NotFoundError
from app.db.team_members_repo import (
    create_team_member_record,
    delete_team_member_record,
    list_team_member_records,
    update_team_member_record,
)
from app.schemas.team_member import TeamMember, TeamMemberCreate, TeamMemberUpdate

router = APIRouter(prefix="/team-members", tags=["team_members"])


@router.get("")
def list_team_members(user: CurrentUser) -> list[TeamMember]:
    """Liste les personnes assignables (point 2), pour le selecteur de responsable."""
    _ = user
    return [TeamMember(**record) for record in list_team_member_records()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_team_member(payload: TeamMemberCreate, user: CurrentUser) -> TeamMember:
    """Cree une personne assignable a partir d'un prenom + nom (point 2)."""
    _ = user
    record = create_team_member_record(data=payload.model_dump())
    return TeamMember(**record)


@router.patch("/{member_id}")
def update_team_member(
    member_id: str, payload: TeamMemberUpdate, user: CurrentUser
) -> TeamMember:
    """Renomme une personne assignable (prenom / nom) ; 404 si introuvable (point 1)."""
    _ = user
    record = update_team_member_record(
        member_id=member_id,
        changes=payload.model_dump(exclude_unset=True),
    )
    if record is None:
        raise NotFoundError("Utilisateur introuvable.")
    return TeamMember(**record)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team_member(member_id: str, user: CurrentUser) -> Response:
    """Supprime une personne assignable ; 404 si introuvable (point 1).

    La cascade FK `task_assignees -> team_members on delete cascade` retire la personne
    des taches ou elle etait responsable sans supprimer aucune tache.
    """
    _ = user
    deleted = delete_team_member_record(member_id=member_id)
    if not deleted:
        raise NotFoundError("Utilisateur introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
