"""Health check — endpoint PUBLIC (pas d'authentification).

Sert aux sondes de disponibilite (Docker healthcheck, orchestrateur, monitoring).
"""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
