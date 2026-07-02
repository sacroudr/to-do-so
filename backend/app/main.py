"""Point d'entree de l'API FastAPI.

Cablage (dependency injection explicite) :
  - chargement/validation de la config (get_settings)
  - CORS restreint aux origines configurees (le frontend Next.js)
  - handlers d'erreurs uniformes
  - montage de l'API versionnee sous /api/v1

Lancement local : `uvicorn app.main:app --reload`
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    # Health check racine (non versionne) pour les sondes simples.
    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
