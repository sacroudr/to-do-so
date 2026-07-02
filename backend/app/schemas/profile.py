"""Schemas du domaine Profil (table `profiles`, requirements.md §5).

Distinct de `schemas.auth.AuthenticatedUser` (derive des claims du JWT) : ce schema
represente une LIGNE de la table `profiles` telle qu'exposee par l'API (liste des
membres de l'equipe, utilisee cote frontend pour le filtre par responsable §4.6 et la
resolution des responsables sur les cartes).
"""
from __future__ import annotations

from pydantic import BaseModel


class Profile(BaseModel):
    id: str
    nom: str
    email: str
    avatar: str | None = None
