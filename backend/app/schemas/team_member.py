"""Schemas du domaine Personne assignable (table `team_members`, point 2).

Une `team_member` est une personne pouvant etre RESPONSABLE d'une tache, DECOUPLEE des
comptes Supabase Auth (`profiles`). Qui peut se connecter (profiles) != qui peut etre
responsable (team_members). Pas d'email, pas de statut de compte : uniquement un nom.
"""
from __future__ import annotations

from pydantic import BaseModel


class TeamMemberBase(BaseModel):
    first_name: str
    last_name: str = ""


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    # Edition partielle (point 1) : seuls les champs fournis sont modifies. Meme
    # pattern que `ProjectUpdate` — le prenom reste obligatoire cote produit, mais on
    # l'accepte optionnel ici pour autoriser une mise a jour ciblee ; la validation
    # « non vide » est faite cote formulaire / route.
    first_name: str | None = None
    last_name: str | None = None


class TeamMember(TeamMemberBase):
    id: str
