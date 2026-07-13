"""Agregation des routes de l'API v1.

Le versionnement par prefixe (/api/v1) permet de faire evoluer l'API sans casser
les clients existants (exigence d'evolutivite §8).
"""
from fastapi import APIRouter

from app.api.v1.routes import (
    attachments,
    health,
    profiles,
    projects,
    subtasks,
    tasks,
    team_members,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(tasks.router)
api_router.include_router(attachments.router)
api_router.include_router(subtasks.router)
api_router.include_router(projects.router)
api_router.include_router(profiles.router)
api_router.include_router(team_members.router)
