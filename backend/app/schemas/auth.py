"""Schemas lies a l'utilisateur authentifie."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class AuthenticatedUser(BaseModel):
    """Utilisateur courant, derive des claims du JWT Supabase verifie.

    `id` correspond a `profiles.id` cote base (requirements.md §5).
    """

    id: str
    email: str | None = None
    role: str | None = None

    @classmethod
    def from_claims(cls, claims: dict[str, Any]) -> "AuthenticatedUser":
        return cls(
            id=str(claims["sub"]),
            email=claims.get("email"),
            role=claims.get("role"),
        )
