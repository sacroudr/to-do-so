"""Erreurs applicatives et gestionnaires d'exceptions.

Fournit des classes d'erreurs explicites et un handler global qui les traduit en
reponses JSON coherentes. Evite de disperser des `raise HTTPException` a travers
la logique metier.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Erreur applicative de base."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.__class__.__doc__ or "Erreur interne"
        super().__init__(self.message)


class AuthenticationError(AppError):
    """Authentification requise ou token invalide."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "authentication_error"


class AuthorizationError(AppError):
    """Acces refuse pour l'utilisateur courant."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "authorization_error"


class NotFoundError(AppError):
    """Ressource introuvable."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class UnprocessableEntityError(AppError):
    """Entree invalide (ex. fichier non conforme). 422."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "unprocessable_entity"


class PayloadTooLargeError(AppError):
    """Corps de requete trop volumineux (ex. piece jointe > limite). 413."""

    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    code = "payload_too_large"


def register_exception_handlers(app: FastAPI) -> None:
    """Enregistre le handler global des AppError sur l'application."""

    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
