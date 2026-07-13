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

from app.api.middleware import MaxUploadBodySizeMiddleware
from app.api.v1.router import api_router
from app.api.v1.routes.attachments import MAX_ATTACHMENT_BYTES
from app.core.config import get_settings
from app.core.errors import register_exception_handlers

# Plafond du CORPS d'un upload accepte avant parsing : limite metier du fichier (10 Mo)
# + marge pour le sur-cout multipart (frontieres/en-tetes de partie). Aligne sur la
# limite de corps du frontend (`serverActions.bodySizeLimit: "12mb"`). La limite EXACTE
# de 10 Mo sur le contenu reste appliquee par la lecture bornee de la route.
_MULTIPART_OVERHEAD_BYTES = 2 * 1024 * 1024
MAX_UPLOAD_BODY_BYTES = MAX_ATTACHMENT_BYTES + _MULTIPART_OVERHEAD_BYTES


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
    )

    # Ajout EN PREMIER -> couche la plus INTERNE : la garde de taille s'execute APRES
    # CORS (couche externe, ajoutee ensuite) mais AVANT le routage/parsing multipart.
    # Ainsi une reponse 413 porte quand meme les en-tetes CORS (l'upload est cross-origin,
    # navigateur -> API directe), tout en rejetant avant tout buffering disque du corps.
    app.add_middleware(
        MaxUploadBodySizeMiddleware, max_body_bytes=MAX_UPLOAD_BODY_BYTES
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
