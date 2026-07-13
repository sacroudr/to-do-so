"""Creation de projets (requirements.md §5) — endpoint POST /projects.

Meme approche TDD que les taches : la persistance est isolee derriere une couture
(seam) `create_project_record` importee dans le module de route, remplacable par
monkeypatch, de sorte a tester la LOGIQUE de la route (validation + serialisation)
sans dependre d'un vrai Supabase.
"""
from __future__ import annotations

from typing import Any

PROJECTS_PATH = "/api/v1/projects"
CREATE_SEAM = "app.api.v1.routes.projects.create_project_record"
UPDATE_SEAM = "app.api.v1.routes.projects.update_project_record"
DELETE_SEAM = "app.api.v1.routes.projects.delete_project_record"


def test_should_require_auth_to_create_project(client):
    """GIVEN aucun token WHEN POST /projects THEN 401."""
    response = client.post(PROJECTS_PATH, json={"nom": "Sage 100"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_reject_project_creation_when_nom_missing(client, auth_headers):
    """GIVEN un payload sans `nom` (champ obligatoire, §5) WHEN POST /projects THEN 422."""
    response = client.post(PROJECTS_PATH, json={"description": "sans nom"}, headers=auth_headers)
    assert response.status_code == 422


def test_should_reject_project_creation_when_nom_exceeds_max_length(client, auth_headers):
    """GIVEN un `nom` au-dela de la borne (max 200) WHEN POST /projects THEN 422 (correctif
    securite : bornage des champs texte)."""
    response = client.post(
        PROJECTS_PATH, json={"nom": "x" * 201}, headers=auth_headers
    )
    assert response.status_code == 422


def test_should_create_project(client, auth_headers, monkeypatch):
    """GIVEN un payload valide WHEN POST /projects THEN 201 + le corps reflete le projet
    cree, et la couche donnees recoit bien les champs saisis (§5).
    """
    captured: dict[str, Any] = {}

    def _create(data: dict[str, Any]) -> dict[str, Any]:
        captured["data"] = data
        return {"id": "p1", **data}

    monkeypatch.setattr(CREATE_SEAM, _create, raising=False)

    response = client.post(
        PROJECTS_PATH,
        json={"nom": "Sage 100", "description": "Migration ERP"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "p1"
    assert body["nom"] == "Sage 100"
    assert body["description"] == "Migration ERP"
    assert captured["data"] == {"nom": "Sage 100", "description": "Migration ERP"}


def test_should_require_auth_to_update_project(client):
    """GIVEN aucun token WHEN PATCH /projects/{id} THEN 401."""
    response = client.patch(f"{PROJECTS_PATH}/p1", json={"nom": "Nouveau nom"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_update_project(client, auth_headers, monkeypatch):
    """GIVEN un projet existant WHEN PATCH /projects/{id} avec un nouveau nom / une
    nouvelle description THEN 200, la couche donnees recoit uniquement les champs
    fournis (partiel) et le corps reflete le projet mis a jour (§5).
    """
    captured: dict[str, Any] = {}

    def _update(project_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured["project_id"] = project_id
        captured["changes"] = changes
        return {"id": project_id, "nom": "Sage 100 v2", "description": "MAJ"}

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{PROJECTS_PATH}/p1",
        json={"nom": "Sage 100 v2", "description": "MAJ"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {"id": "p1", "nom": "Sage 100 v2", "description": "MAJ"}
    assert captured["project_id"] == "p1"
    assert captured["changes"] == {"nom": "Sage 100 v2", "description": "MAJ"}


def test_should_update_only_provided_fields(client, auth_headers, monkeypatch):
    """GIVEN une mise a jour PARTIELLE (description seule) WHEN PATCH /projects/{id}
    THEN la couche donnees ne recoit QUE les champs fournis (exclude_unset, §5).
    """
    captured: dict[str, Any] = {}

    def _update(project_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured["changes"] = changes
        return {"id": project_id, "nom": "Inchange", "description": "Nouvelle"}

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{PROJECTS_PATH}/p1", json={"description": "Nouvelle"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert captured["changes"] == {"description": "Nouvelle"}


def test_should_return_404_when_updating_unknown_project(client, auth_headers, monkeypatch):
    """GIVEN un id de projet inexistant WHEN PATCH /projects/{id} THEN 404 (la couche
    donnees renvoie None).
    """
    monkeypatch.setattr(UPDATE_SEAM, lambda project_id, changes: None, raising=False)

    response = client.patch(
        f"{PROJECTS_PATH}/inconnu", json={"nom": "Peu importe"}, headers=auth_headers
    )

    assert response.status_code == 404


# ===========================================================================
# Suppression (point 3) — cascade applicative deleguee au repo
# ===========================================================================
def test_should_require_auth_to_delete_project(client):
    """GIVEN aucun token WHEN DELETE /projects/{id} THEN 401."""
    response = client.delete(f"{PROJECTS_PATH}/p1")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_delete_project(client, auth_headers, monkeypatch):
    """GIVEN un projet existant WHEN DELETE /projects/{id} THEN 204, la couche donnees
    recoit le bon id (l'orchestration de la cascade est deleguee au repo, §5).
    """
    captured: dict[str, Any] = {}

    def _delete(*, project_id: str) -> bool:
        captured["project_id"] = project_id
        return True

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{PROJECTS_PATH}/p1", headers=auth_headers)

    assert response.status_code == 204
    assert captured == {"project_id": "p1"}


def test_should_return_404_when_deleting_unknown_project(client, auth_headers, monkeypatch):
    """GIVEN un id de projet inexistant (le repo renvoie False) WHEN DELETE THEN 404."""
    monkeypatch.setattr(DELETE_SEAM, lambda **_: False, raising=False)

    response = client.delete(f"{PROJECTS_PATH}/inconnu", headers=auth_headers)

    assert response.status_code == 404
