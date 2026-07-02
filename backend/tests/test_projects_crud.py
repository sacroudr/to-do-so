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


def test_should_require_auth_to_create_project(client):
    """GIVEN aucun token WHEN POST /projects THEN 401."""
    response = client.post(PROJECTS_PATH, json={"nom": "Sage 100"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_reject_project_creation_when_nom_missing(client, auth_headers):
    """GIVEN un payload sans `nom` (champ obligatoire, §5) WHEN POST /projects THEN 422."""
    response = client.post(PROJECTS_PATH, json={"description": "sans nom"}, headers=auth_headers)
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
