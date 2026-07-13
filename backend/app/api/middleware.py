"""Middlewares ASGI transverses de l'API.

`MaxUploadBodySizeMiddleware` est le VRAI filet anti-DoS a l'upload de pieces jointes
(§5). Il rejette en 413 tout POST d'upload dont l'en-tete `Content-Length` depasse la
limite AVANT que Starlette ne parse et ne SPOOLE le corps multipart (bascule disque via
`SpooledTemporaryFile`). C'est une couche ASGI pure : elle court-circuite la requete sans
jamais lire le corps, donc aucun octet n'atteint le disque applicatif ni la RAM.

Limite du procede (documentee, pas masquee) : `Content-Length` peut etre absent (upload
en `Transfer-Encoding: chunked`) ou mensonger. Ce garde n'est donc PAS suffisant seul ;
la route applique en complement une lecture BORNEE par chunks (protection RAM) qui plafonne
le contenu materialise a la limite metier quoi qu'il arrive.
"""
from __future__ import annotations

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import PayloadTooLargeError

# On ne garde QUE l'endpoint d'upload (POST .../attachments). La liste (GET) et la
# suppression (DELETE .../attachments/{id}) ne finissent pas par ce suffixe.
_UPLOAD_PATH_SUFFIX = "/attachments"


class MaxUploadBodySizeMiddleware:
    """Rejette (413) un POST d'upload dont `Content-Length` depasse `max_body_bytes`.

    `max_body_bytes` doit inclure une marge pour le sur-cout multipart (frontieres,
    en-tetes de partie) au-dessus de la limite metier du fichier : un fichier a la
    taille maximale produit un corps legerement plus gros que le fichier lui-meme.
    """

    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if self._is_guarded_upload(scope):
            content_length = self._content_length(scope)
            if content_length is not None and content_length > self.max_body_bytes:
                await self._reject_too_large(scope, receive, send)
                return
        await self.app(scope, receive, send)

    @staticmethod
    def _is_guarded_upload(scope: Scope) -> bool:
        return (
            scope.get("type") == "http"
            and scope.get("method") == "POST"
            and scope.get("path", "").endswith(_UPLOAD_PATH_SUFFIX)
        )

    @staticmethod
    def _content_length(scope: Scope) -> int | None:
        """Content-Length declare (octets) ou None s'il est absent/illisible."""
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    return int(value)
                except ValueError:
                    return None
        return None

    async def _reject_too_large(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        # Source unique de verite : on reutilise l'erreur applicative (statut 413, code
        # `payload_too_large`) et on reproduit le format du handler global (app.core.errors).
        error = PayloadTooLargeError(
            "Le fichier depasse la taille maximale autorisee (10 Mo)."
        )
        response = JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code, "message": error.message}},
        )
        await response(scope, receive, send)
