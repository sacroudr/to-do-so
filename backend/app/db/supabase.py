"""Fabrique du client Supabase cote serveur.

Utilise la cle `service_role` pour acceder a PostgreSQL depuis l'API (§6.2 :
« l'API Python ... lit ou ecrit dans la base PostgreSQL de Supabase »).

IMPORTANT : ce client contourne les Row Level Security policies. Il ne doit JAMAIS
etre expose au client, et l'autorisation doit etre appliquee dans la couche API
(apres verification du JWT). Le client est cree une seule fois (cache).
"""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
