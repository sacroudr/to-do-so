"""Endpoints Pieces jointes PDF d'une tache (requirements.md §5). Protege par JWT.

Ressources (montees sous /tasks/{task_id}/attachments) :
  - GET  : liste les PDF d'une tache (nom, date, auteur, URL signee de download).
  - POST : televerse un PDF (multipart). VALIDATION STRICTE cote serveur : type MIME
           reel via magic bytes (« %PDF- ») EN PLUS du content-type declare, et taille
           <= 10 Mo. Tout non-PDF ou fichier trop volumineux est refuse (422 / 413).

La couche route reste fine : le stockage / la persistance sont delegues a
`app.db.attachments_repo` (seams `create_attachment_record` / `list_attachment_records`
importees ici, remplacables par les tests).
"""
from __future__ import annotations

from fastapi import APIRouter, File, Response, UploadFile, status

from app.api.deps import CurrentUser
from app.core.errors import (
    NotFoundError,
    PayloadTooLargeError,
    UnprocessableEntityError,
)
from app.db.attachments_repo import (
    create_attachment_record,
    delete_attachment_record,
    list_attachment_records,
)
from app.schemas.attachment import Attachment

router = APIRouter(prefix="/tasks", tags=["attachments"])

# Limite de taille par fichier (10 Mo) — coherente avec le bucket Storage (migration).
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
# Taille de chunk pour la lecture BORNEE (64 Ko) : on ne materialise jamais en RAM plus
# que la limite metier + un chunk, meme si le corps recu est bien plus gros.
_READ_CHUNK_BYTES = 64 * 1024
# Signature magique d'un PDF (defense contre une simple extension .pdf renommee).
_PDF_MAGIC = b"%PDF-"
_PDF_MIME = "application/pdf"


async def _read_within_limit(file: UploadFile, limit: int) -> bytes:
    """Lit `file` par chunks et s'arrete des que le cumul depasse `limit` (413).

    Protection RAM : contrairement a `await file.read()` (qui materialise TOUT le corps
    spoole, potentiellement plusieurs Go, dans un seul `bytes`), on borne l'accumulation
    a `limit`. Des le premier octet en trop on leve `PayloadTooLargeError` sans continuer
    a lire ni bufferiser le reste.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise PayloadTooLargeError(
                "Le fichier depasse la taille maximale autorisee (10 Mo)."
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.get("/{task_id}/attachments")
def list_attachments(task_id: str, user: CurrentUser) -> list[Attachment]:
    """Liste les pieces jointes d'une tache (§5)."""
    _ = user
    return [Attachment(**record) for record in list_attachment_records(task_id=task_id)]


@router.post("/{task_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    task_id: str,
    user: CurrentUser,
    file: UploadFile = File(...),
) -> Attachment:
    """Televerse un PDF pour la tache ; valide type MIME reel + taille (§5).

    Ordre de validation STRICT (rien n'atteint le Storage avant validation complete) :
    1. taille — lecture bornee par chunks -> 413 si depassement ;
    2. type — magic bytes `%PDF-` + content-type declare -> 422 sinon ;
    3. persistance — `create_attachment_record` (upload Storage) seulement ensuite.
    """
    # 1. Taille : lecture BORNEE (protection RAM). En amont, MaxUploadBodySizeMiddleware
    #    a deja rejete via `Content-Length` avant tout parsing multipart (protection disque).
    content = await _read_within_limit(file, MAX_ATTACHMENT_BYTES)

    # 2. Type : on NE se fie PAS a l'extension ; on exige content-type ET magic bytes.
    if file.content_type != _PDF_MIME or not content.startswith(_PDF_MAGIC):
        raise UnprocessableEntityError("Seuls les fichiers PDF sont acceptes.")

    # 3. Persistance : seule etape qui ecrit dans le Storage — jamais atteinte pour un
    #    fichier surdimensionne (413) ou non-PDF (422).
    record = create_attachment_record(
        task_id=task_id,
        content=content,
        file_name=file.filename or "document.pdf",
        content_type=_PDF_MIME,
        uploaded_by=user.id,
    )
    if record is None:
        raise NotFoundError("Tache introuvable ou stockage indisponible.")
    return Attachment(**record)


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(task_id: str, attachment_id: str, user: CurrentUser) -> Response:
    """Supprime une piece jointe (objet Storage + ligne DB) ; 404 si introuvable (§5).

    La suppression est scopee par tache : une piece jointe d'une autre tache n'est
    jamais touchee. Aucun fichier orphelin (purge Storage AVANT la ligne).
    """
    _ = user
    deleted = delete_attachment_record(task_id=task_id, attachment_id=attachment_id)
    if not deleted:
        raise NotFoundError("Piece jointe introuvable.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
