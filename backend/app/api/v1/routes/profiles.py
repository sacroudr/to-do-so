"""Endpoints Profils (requirements.md §5). Protege par JWT.

Deux ressources :
  - GET /profiles/me : utilisateur courant, derive du JWT verifie (pas d'acces base).
  - GET /profiles    : liste des membres de l'equipe (via app.db.profiles_repo),
    utilisee cote frontend pour le filtre par responsable (§4.6) et la resolution des
    responsables sur les cartes / lignes.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.db.profiles_repo import list_profile_records
from app.schemas.auth import AuthenticatedUser
from app.schemas.profile import Profile

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me")
def get_me(user: CurrentUser) -> AuthenticatedUser:
    """Retourne l'utilisateur courant deduit du JWT verifie."""
    return user


@router.get("")
def list_profiles(user: CurrentUser) -> list[Profile]:
    """Liste les membres de l'equipe (§5) pour le filtre responsable (§4.6)."""
    _ = user
    return [Profile(**record) for record in list_profile_records()]
