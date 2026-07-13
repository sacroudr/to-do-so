"""Schemas du domaine Personne assignable (table `team_members`, point 2).

Une `team_member` est une personne pouvant etre RESPONSABLE d'une tache, DECOUPLEE des
comptes Supabase Auth (`profiles`). Qui peut se connecter (profiles) != qui peut etre
responsable (team_members). Pas d'email, pas de statut de compte : uniquement un nom.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TeamMemberBase(BaseModel):
    first_name: str
    last_name: str = ""


class TeamMemberCreate(TeamMemberBase):
    # Bornes de longueur cote ENTREE uniquement (le modele de sortie `TeamMember` reste
    # non contraint pour ne jamais rejeter une ligne existante en lecture).
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)


class TeamMemberUpdate(BaseModel):
    # Edition partielle (point 1) : seuls les champs fournis sont modifies. Meme
    # pattern que `ProjectUpdate` — le prenom reste obligatoire cote produit, mais on
    # l'accepte optionnel ici pour autoriser une mise a jour ciblee ; les bornes ne
    # s'appliquent qu'aux valeurs fournies (min_length=1 rejette un prenom vide fourni).
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)


class TeamMember(TeamMemberBase):
    id: str
