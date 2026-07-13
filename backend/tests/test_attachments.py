"""Pieces jointes PDF des taches (requirements.md §5) — endpoints
GET/POST /api/v1/tasks/{task_id}/attachments.

Meme approche que les autres routes : le stockage / la persistance sont isoles
derriere des coutures (seams) importees dans le module de route
(`create_attachment_record`, `list_attachment_records`), remplacables par monkeypatch.
On teste ici la LOGIQUE de la route : garde JWT, VALIDATION STRICTE du PDF (type MIME
reel via magic bytes + content-type) et de la TAILLE, et serialisation.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.api.middleware import MaxUploadBodySizeMiddleware
from tests.conftest import TEST_USER_ID

TASK_ID = "44444444-4444-4444-4444-444444444444"
ATTACH_PATH = f"/api/v1/tasks/{TASK_ID}/attachments"

CREATE_SEAM = "app.api.v1.routes.attachments.create_attachment_record"
LIST_SEAM = "app.api.v1.routes.attachments.list_attachment_records"
DELETE_SEAM = "app.api.v1.routes.attachments.delete_attachment_record"
MAX_BYTES_CONST = "app.api.v1.routes.attachments.MAX_ATTACHMENT_BYTES"

# En-tete PDF valide minimal (commence par la signature magique « %PDF- »).
VALID_PDF = b"%PDF-1.4\n%stub content\n"


def _record(**overrides: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "id": "att-1",
        "task_id": TASK_ID,
        "file_name": "compte-rendu.pdf",
        "mime_type": "application/pdf",
        "size_bytes": len(VALID_PDF),
        "uploaded_by": TEST_USER_ID,
        "uploaded_by_name": "Membre Equipe",
        "created_at": "2026-07-07T09:00:00Z",
        "signed_url": "https://signed.example/compte-rendu.pdf",
    }
    record.update(overrides)
    return record


# ===========================================================================
# Garde d'authentification
# ===========================================================================
def test_should_require_auth_to_upload(client):
    """GIVEN aucun token WHEN POST attachments THEN 401."""
    response = client.post(
        ATTACH_PATH, files={"file": ("doc.pdf", VALID_PDF, "application/pdf")}
    )
    assert response.status_code == 401


def test_should_require_auth_to_list(client):
    """GIVEN aucun token WHEN GET attachments THEN 401."""
    response = client.get(ATTACH_PATH)
    assert response.status_code == 401


# ===========================================================================
# Validation stricte du PDF
# ===========================================================================
def test_should_accept_valid_pdf(client, auth_headers, monkeypatch):
    """GIVEN un vrai PDF (magic bytes + content-type) WHEN POST THEN 201, la couche
    donnees recoit le contenu + l'auteur (JWT), et le corps reflete la piece jointe.
    """
    captured: dict[str, Any] = {}

    def _create(**kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return _record()

    monkeypatch.setattr(CREATE_SEAM, _create, raising=False)

    response = client.post(
        ATTACH_PATH,
        files={"file": ("compte-rendu.pdf", VALID_PDF, "application/pdf")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["file_name"] == "compte-rendu.pdf"
    assert body["mime_type"] == "application/pdf"
    assert body["uploaded_by_name"] == "Membre Equipe"
    assert body["signed_url"].startswith("https://")
    assert captured["task_id"] == TASK_ID
    assert captured["uploaded_by"] == TEST_USER_ID
    assert captured["content"].startswith(b"%PDF-")


def test_should_reject_non_pdf_content_even_with_pdf_mime(client, auth_headers, monkeypatch):
    """GIVEN un fichier annonce `application/pdf` mais dont le CONTENU n'est PAS un PDF
    (extension / content-type usurpes) WHEN POST THEN 422 (validation par magic bytes).
    """
    called = {"create": False}
    monkeypatch.setattr(
        CREATE_SEAM,
        lambda **_: called.__setitem__("create", True) or _record(),
        raising=False,
    )

    response = client.post(
        ATTACH_PATH,
        files={"file": ("faux.pdf", b"GIF89a je ne suis pas un pdf", "application/pdf")},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert called["create"] is False  # rejet AVANT tout stockage


def test_should_reject_pdf_content_with_wrong_mime(client, auth_headers, monkeypatch):
    """GIVEN un contenu PDF valide mais un content-type non-PDF WHEN POST THEN 422
    (le content-type declare doit aussi etre `application/pdf`).
    """
    monkeypatch.setattr(CREATE_SEAM, lambda **_: _record(), raising=False)

    response = client.post(
        ATTACH_PATH,
        files={"file": ("doc.txt", VALID_PDF, "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_should_reject_oversized_file(client, auth_headers, monkeypatch):
    """GIVEN un fichier plus gros que la limite WHEN POST THEN 413 (message clair).

    La limite est abaissee via monkeypatch pour eviter d'allouer 10 Mo en test.
    """
    monkeypatch.setattr(MAX_BYTES_CONST, 8, raising=False)
    monkeypatch.setattr(CREATE_SEAM, lambda **_: _record(), raising=False)

    response = client.post(
        ATTACH_PATH,
        files={"file": ("gros.pdf", VALID_PDF, "application/pdf")},  # > 8 octets
        headers=auth_headers,
    )

    assert response.status_code == 413


def test_should_return_404_when_storage_unavailable(client, auth_headers, monkeypatch):
    """GIVEN un stockage indisponible (la couche renvoie None) WHEN POST un PDF valide
    THEN 404 (rien n'a pu etre persiste).
    """
    monkeypatch.setattr(CREATE_SEAM, lambda **_: None, raising=False)

    response = client.post(
        ATTACH_PATH,
        files={"file": ("doc.pdf", VALID_PDF, "application/pdf")},
        headers=auth_headers,
    )

    assert response.status_code == 404


# ===========================================================================
# Liste
# ===========================================================================
def test_should_list_attachments(client, auth_headers, monkeypatch):
    """GIVEN une tache avec des pieces jointes WHEN GET THEN 200 + liste serialisee
    (nom, date, auteur, URL signee), plus ancienne d'abord (§5).
    """
    captured: dict[str, Any] = {}

    def _list(*, task_id: str) -> list[dict[str, Any]]:
        captured["task_id"] = task_id
        return [_record(id="att-1"), _record(id="att-2", file_name="annexe.pdf")]

    monkeypatch.setattr(LIST_SEAM, _list, raising=False)

    response = client.get(ATTACH_PATH, headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert captured["task_id"] == TASK_ID
    assert [a["file_name"] for a in body] == ["compte-rendu.pdf", "annexe.pdf"]
    assert all(a["signed_url"].startswith("https://") for a in body)


# ===========================================================================
# Suppression (point 5) — objet Storage + ligne DB, delegue au repo
# ===========================================================================
def test_should_require_auth_to_delete(client):
    """GIVEN aucun token WHEN DELETE une piece jointe THEN 401."""
    response = client.delete(f"{ATTACH_PATH}/att-1")
    assert response.status_code == 401


def test_should_delete_attachment(client, auth_headers, monkeypatch):
    """GIVEN une piece jointe existante WHEN DELETE THEN 204, la couche donnees recoit la
    tache ET l'id de la piece jointe (suppression scopee par tache).
    """
    captured: dict[str, Any] = {}

    def _delete(*, task_id: str, attachment_id: str) -> bool:
        captured.update({"task_id": task_id, "attachment_id": attachment_id})
        return True

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{ATTACH_PATH}/att-1", headers=auth_headers)

    assert response.status_code == 204
    assert captured == {"task_id": TASK_ID, "attachment_id": "att-1"}


def test_should_return_404_when_deleting_missing_attachment(client, auth_headers, monkeypatch):
    """GIVEN une piece jointe introuvable (le repo renvoie False) WHEN DELETE THEN 404."""
    monkeypatch.setattr(DELETE_SEAM, lambda **_: False, raising=False)

    response = client.delete(f"{ATTACH_PATH}/inconnu", headers=auth_headers)

    assert response.status_code == 404


# ===========================================================================
# Anti-DoS a l'upload (correctif securite) — garde `Content-Length` AVANT parsing
# ===========================================================================
class _RecordingASGIApp:
    """App ASGI interne factice : note si elle a ete appelee et renvoie un 201 minimal.

    Sert a prouver qu'un rejet du garde de taille court-circuite AVANT toute lecture du
    corps (l'app interne — ou serait parse/spoole le multipart — n'est jamais atteinte).
    """

    def __init__(self) -> None:
        self.called = False

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        self.called = True
        await send({"type": "http.response.start", "status": 201, "headers": []})
        await send({"type": "http.response.body", "body": b""})


def _http_scope(method: str, path: str, headers: list[tuple[bytes, bytes]]) -> dict[str, Any]:
    return {"type": "http", "method": method, "path": path, "headers": headers}


def _drive(middleware: Any, scope: dict[str, Any]) -> list[dict[str, Any]]:
    """Pilote une requete ASGI a travers `middleware` et capture les messages envoyes."""
    sent: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    asyncio.run(middleware(scope, receive, send))
    return sent


def _status_of(sent: list[dict[str, Any]]) -> int:
    start = next(m for m in sent if m["type"] == "http.response.start")
    return int(start["status"])


def test_middleware_rejects_oversized_content_length_before_parsing():
    """GIVEN un POST d'upload dont `Content-Length` >> limite WHEN il traverse le garde
    THEN 413 et l'app interne (parsing/spool du corps) n'est JAMAIS appelee.
    """
    inner = _RecordingASGIApp()
    middleware = MaxUploadBodySizeMiddleware(inner, max_body_bytes=10)
    scope = _http_scope(
        "POST", ATTACH_PATH, [(b"content-length", b"999999999")]
    )

    sent = _drive(middleware, scope)

    assert _status_of(sent) == 413
    assert inner.called is False  # corps jamais lu/parse/spoole -> pas de DoS disque


def test_middleware_allows_body_within_limit():
    """GIVEN un `Content-Length` sous la limite WHEN POST d'upload THEN l'app interne est
    appelee normalement (pas de rejet).
    """
    inner = _RecordingASGIApp()
    middleware = MaxUploadBodySizeMiddleware(inner, max_body_bytes=10_000)
    scope = _http_scope("POST", ATTACH_PATH, [(b"content-length", b"500")])

    sent = _drive(middleware, scope)

    assert _status_of(sent) == 201
    assert inner.called is True


def test_middleware_ignores_non_upload_paths():
    """GIVEN un gros `Content-Length` mais sur un chemin NON garde WHEN requete THEN elle
    passe (le garde ne s'applique qu'aux POST .../attachments).
    """
    inner = _RecordingASGIApp()
    middleware = MaxUploadBodySizeMiddleware(inner, max_body_bytes=10)
    scope = _http_scope("POST", "/api/v1/tasks", [(b"content-length", b"999999999")])

    sent = _drive(middleware, scope)

    assert inner.called is True


def test_middleware_ignores_missing_content_length():
    """GIVEN aucun `Content-Length` (upload chunked possible) WHEN POST d'upload THEN le
    garde laisse passer — la lecture bornee de la route prend alors le relais (RAM).
    """
    inner = _RecordingASGIApp()
    middleware = MaxUploadBodySizeMiddleware(inner, max_body_bytes=10)
    scope = _http_scope("POST", ATTACH_PATH, [])

    sent = _drive(middleware, scope)

    assert inner.called is True


def test_should_reject_oversized_file_before_storage(client, auth_headers, monkeypatch):
    """GIVEN un fichier plus gros que la limite (passe le garde `Content-Length` mais
    depasse la limite metier) WHEN POST THEN 413 par la LECTURE BORNEE, et rien n'est
    ecrit dans le Storage (`create_attachment_record` jamais appele).
    """
    monkeypatch.setattr(MAX_BYTES_CONST, 8, raising=False)
    called = {"create": False}
    monkeypatch.setattr(
        CREATE_SEAM,
        lambda **_: called.__setitem__("create", True) or _record(),
        raising=False,
    )

    response = client.post(
        ATTACH_PATH,
        files={"file": ("gros.pdf", VALID_PDF, "application/pdf")},  # 23 octets > 8
        headers=auth_headers,
    )

    assert response.status_code == 413
    assert called["create"] is False  # rejet AVANT tout stockage
