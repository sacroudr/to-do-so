"""Fixtures de test partagees.

On injecte des variables d'environnement factices AVANT d'importer l'application,
afin que la config (get_settings) se charge sans secret reel. Les tests
d'integration reels devront pointer vers un projet Supabase de test.

Ce module ajoute egalement :
  - une fabrique de JWT (`make_token`) qui SIGNE des tokens avec le meme secret de
    test que la config (`SUPABASE_JWT_SECRET`), afin de tester les chemins
    AUTHENTIFIES sans dependre d'un vrai Supabase Auth ;
  - des fixtures d'en-tetes prets a l'emploi (valide / expire / signature invalide /
    mauvaise audience) ;
  - un marqueur `integration` (skippe par defaut) pour les tests qui exigent un vrai
    projet Supabase de test.
"""
from __future__ import annotations

import os
import time
from typing import Any, Callable

import jwt
import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")

# Un profil "connu" reutilise par les tests authentifies. En integration reelle,
# il doit correspondre a une ligne `profiles` existante (cf. trigger d'inscription).
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"

# Les tests d'integration (vrai Supabase) sont skippes sauf activation explicite.
_RUN_DB_TESTS = os.environ.get("TODOSO_RUN_DB_TESTS") == "1"
requires_db = pytest.mark.skipif(
    not _RUN_DB_TESTS,
    reason="Test d'integration : necessite un projet Supabase de test "
    "(exporter TODOSO_RUN_DB_TESTS=1 + variables SUPABASE_* reelles).",
)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def make_token() -> Callable[..., str]:
    """Retourne une fabrique de JWT signes avec le secret de test.

    Par defaut : token valide (sub connu, audience `authenticated`, exp +1h).
    Parametres pour couvrir les cas d'echec (exp negatif, mauvaise audience,
    secret errone -> signature invalide).
    """
    from app.core.config import get_settings

    settings = get_settings()

    def _make(
        *,
        sub: str = TEST_USER_ID,
        email: str = "membre@equipe.test",
        audience: str = "authenticated",
        expires_in: int = 3600,
        secret: str | None = None,
        include_exp: bool = True,
        include_sub: bool = True,
    ) -> str:
        now = int(time.time())
        payload: dict[str, Any] = {
            "iat": now,
            "email": email,
            "role": "authenticated",
            "aud": audience,
        }
        if include_sub:
            payload["sub"] = sub
        if include_exp:
            payload["exp"] = now + expires_in
        return jwt.encode(
            payload,
            secret if secret is not None else settings.supabase_jwt_secret,
            algorithm=settings.jwt_algorithm,
        )

    return _make


@pytest.fixture
def auth_headers(make_token: Callable[..., str]) -> dict[str, str]:
    """En-tete Authorization avec un JWT VALIDE (utilisateur connu)."""
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def expired_headers(make_token: Callable[..., str]) -> dict[str, str]:
    """JWT EXPIRE (exp dans le passe)."""
    return {"Authorization": f"Bearer {make_token(expires_in=-60)}"}


@pytest.fixture
def bad_signature_headers(make_token: Callable[..., str]) -> dict[str, str]:
    """JWT signe avec un MAUVAIS secret -> signature invalide."""
    return {"Authorization": f"Bearer {make_token(secret='wrong-secret')}"}


@pytest.fixture
def wrong_audience_headers(make_token: Callable[..., str]) -> dict[str, str]:
    """JWT dont l'audience n'est pas `authenticated`."""
    return {"Authorization": f"Bearer {make_token(audience='anon')}"}
