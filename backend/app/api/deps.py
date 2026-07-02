"""Dependances FastAPI partagees (injection de dependances explicite).

`get_current_user` est LA porte d'entree de securite : elle extrait le Bearer token,
le fait verifier par le module dedie (app.core.security.jwt) et expose un
`AuthenticatedUser`. Toute route qui la declare en dependance est protegee.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.errors import AuthenticationError
from app.core.security.jwt import verify_supabase_jwt
from app.schemas.auth import AuthenticatedUser

# auto_error=False : on gere nous-memes l'absence de header pour renvoyer notre
# format d'erreur uniforme (AuthenticationError -> 401 JSON).
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("En-tete Authorization Bearer manquant.")

    claims = verify_supabase_jwt(credentials.credentials, settings)
    return AuthenticatedUser.from_claims(claims)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
