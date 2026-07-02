"""Verification du JWT Supabase.

Principe (requirements.md §6.2) :
  Le frontend delegue l'auth a Supabase Auth, puis joint le JWT a chaque requete.
  L'API Python VERIFIE ce token AVANT tout acces aux donnees.

Deux familles de tokens coexistent cote Supabase, d'ou une verification DUAL-MODE
choisie selon l'entete `alg` du token :

  * HS256 (symetrique) : cles d'API legacy (anon / service_role) et tokens forges
    dans les tests. Verifies avec le secret partage `SUPABASE_JWT_SECRET`.
  * ES256 / RS256 (asymetrique) : « JWT Signing Keys » Supabase, utilises pour signer
    les access_tokens des utilisateurs connectes sur les projets recents. Verifies avec
    la cle PUBLIQUE recuperee via l'endpoint JWKS du projet.

Dispatcher sur l'`alg` de l'entete est sur ici : chaque famille est liee a une cle
distincte et non controlable par un attaquant. Le chemin HS256 exige le secret PRIVE
partage (jamais la cle publique), ce qui neutralise l'attaque classique de confusion
d'algorithme (asymetrique -> HS256 avec la cle publique comme secret HMAC).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import jwt
from jwt import InvalidTokenError, PyJWKClient
from jwt.exceptions import PyJWKClientError

from app.core.config import Settings
from app.core.errors import AuthenticationError

# Algorithmes symetriques (secret partage) vs asymetriques (cle publique via JWKS).
_SYMMETRIC_ALGS = {"HS256", "HS384", "HS512"}
_ASYMMETRIC_ALGS = {"ES256", "ES384", "ES512", "RS256", "RS384", "RS512"}


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    """Client JWKS mis en cache (par URL).

    `PyJWKClient` met lui-meme en cache le jeu de cles recupere (cf. `lifespan`), ce qui
    evite un appel reseau a chaque requete authentifiee.
    """
    return PyJWKClient(jwks_url)


def _decode(token: str, key: Any, algorithm: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(
        token,
        key,
        algorithms=[algorithm],
        audience=settings.jwt_audience,
        options={"require": ["exp", "sub"]},
    )


def verify_supabase_jwt(token: str, settings: Settings) -> dict[str, Any]:
    """Verifie et decode un JWT Supabase, ou leve AuthenticationError.

    Retourne les claims decodes (sub, email, role, exp...).
    """
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except InvalidTokenError as exc:
        raise AuthenticationError("Token invalide ou expire.") from exc

    try:
        if alg in _SYMMETRIC_ALGS:
            # Chemin legacy : secret partage (cles d'API Supabase + tokens de test).
            claims = _decode(token, settings.supabase_jwt_secret, alg, settings)
        elif alg in _ASYMMETRIC_ALGS:
            # Chemin JWT Signing Keys : cle publique du projet recuperee via JWKS.
            signing_key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
            claims = _decode(token, signing_key.key, alg, settings)
        else:
            raise AuthenticationError("Token invalide ou expire.")
    except (InvalidTokenError, PyJWKClientError) as exc:
        raise AuthenticationError("Token invalide ou expire.") from exc

    return claims
