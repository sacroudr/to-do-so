"""Configuration applicative centralisee.

Regle projet : AUCUNE valeur de configuration en dur. Tout est charge depuis
l'environnement (fichier .env en local, variables d'environnement en production)
via pydantic-settings. On echoue au demarrage si une variable requise manque.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Parametres charges depuis l'environnement / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "To-Do-So API"
    environment: str = "development"
    debug: bool = False

    # --- Supabase ---
    # URL du projet Supabase (ex. https://<ref>.supabase.co).
    supabase_url: str = Field(..., description="URL du projet Supabase")
    # Cle service_role : acces serveur a la base (bypass RLS). SECRET — jamais cote client.
    supabase_service_role_key: str = Field(..., description="Cle service_role Supabase")

    # --- Verification JWT ---
    # Secret partage HS256 (Supabase > Project Settings > API > JWT Secret).
    # Sert au chemin LEGACY : cles d'API Supabase (anon/service_role) et tokens de test.
    supabase_jwt_secret: str = Field(..., description="Secret de signature JWT Supabase")
    jwt_algorithm: str = "HS256"
    # Audience attendue dans les JWT emis par Supabase Auth.
    jwt_audience: str = "authenticated"

    @property
    def jwks_url(self) -> str:
        """Endpoint JWKS du projet (cles publiques ES256/RS256 des JWT Signing Keys).

        Les projets Supabase recents signent les access_tokens utilisateurs avec une cle
        ASYMETRIQUE exposee ici ; la verification passe par cette cle publique et non par
        le secret partage HS256 (qui ne couvre plus que les cles d'API legacy).
        """
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    # --- CORS ---
    # Origines autorisees a appeler l'API (ex. l'URL du frontend Next.js).
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Instance unique (mise en cache) des parametres."""
    return Settings()  # type: ignore[call-arg]
