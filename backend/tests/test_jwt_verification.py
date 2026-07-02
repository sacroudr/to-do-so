"""Verification DUAL-MODE du JWT (requirements.md §6.2).

Regression : les projets Supabase recents signent les access_tokens utilisateurs avec
une cle ASYMETRIQUE (ES256, « JWT Signing Keys ») exposee via JWKS. Le backend doit
verifier ces tokens avec la cle PUBLIQUE du JWKS, et non avec le secret partage HS256
(qui ne couvre plus que les cles d'API legacy et les tokens de test).

On isole le module de verification en stubbant le client JWKS (pas d'appel reseau) et
on forge de vrais tokens ES256 avec une paire de cles EC ephemere.
"""
from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.config import get_settings
from app.core.errors import AuthenticationError
from app.core.security import jwt as jwt_module


def _es256_token(private_key, *, aud: str = "authenticated", sub: str = "user-1",
                 expires_in: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + expires_in,
        "sub": sub,
        "aud": aud,
        "role": "authenticated",
    }
    return jwt.encode(payload, private_key, algorithm="ES256")


class _StubSigningKey:
    def __init__(self, key) -> None:
        self.key = key


class _StubJWKSClient:
    """Renvoie toujours la cle publique fournie (simule le JWKS du projet)."""

    def __init__(self, public_key) -> None:
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> _StubSigningKey:  # noqa: ARG002
        return _StubSigningKey(self._public_key)


def test_should_accept_es256_token_signed_by_jwks_key(monkeypatch):
    """GIVEN un access_token ES256 signe par la cle du projet
    WHEN il est verifie THEN les claims sont retournes (§6.2)."""
    priv = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(jwt_module, "_jwks_client", lambda _url: _StubJWKSClient(priv.public_key()))

    claims = jwt_module.verify_supabase_jwt(_es256_token(priv), get_settings())

    assert claims["sub"] == "user-1"
    assert claims["aud"] == "authenticated"


def test_should_reject_es256_token_signed_by_unknown_key(monkeypatch):
    """Un token ES256 signe par une cle etrangere au JWKS est rejete."""
    attacker = ec.generate_private_key(ec.SECP256R1())
    project_pub = ec.generate_private_key(ec.SECP256R1()).public_key()
    monkeypatch.setattr(jwt_module, "_jwks_client", lambda _url: _StubJWKSClient(project_pub))

    with pytest.raises(AuthenticationError):
        jwt_module.verify_supabase_jwt(_es256_token(attacker), get_settings())


def test_should_reject_es256_token_with_wrong_audience(monkeypatch):
    """Meme signature valide, une mauvaise audience reste refusee."""
    priv = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(jwt_module, "_jwks_client", lambda _url: _StubJWKSClient(priv.public_key()))

    with pytest.raises(AuthenticationError):
        jwt_module.verify_supabase_jwt(_es256_token(priv, aud="anon"), get_settings())


def test_should_still_accept_legacy_hs256_token():
    """Le chemin HS256 legacy (cles d'API + tokens de test) reste fonctionnel."""
    settings = get_settings()
    now = int(time.time())
    token = jwt.encode(
        {"iat": now, "exp": now + 3600, "sub": "user-1", "aud": "authenticated"},
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )

    claims = jwt_module.verify_supabase_jwt(token, settings)

    assert claims["sub"] == "user-1"
