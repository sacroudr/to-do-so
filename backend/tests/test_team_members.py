"""Personnes assignables (`team_members`, point 1) — endpoints /api/v1/team-members.

Comme les autres routes, la persistance est isolee derriere des coutures (seams)
importees dans le module de route, remplacables par monkeypatch. On teste ici la LOGIQUE
de la route : garde JWT, validation / serialisation, et la traduction des contrats du
repo en codes HTTP (404 quand la personne est introuvable). Les nouveaux endpoints du
point 1 sont l'edition (PATCH) et la suppression (DELETE).
"""
from __future__ import annotations

from typing import Any

MEMBERS_PATH = "/api/v1/team-members"
MEMBER_ID = "55555555-5555-5555-5555-555555555555"

UPDATE_SEAM = "app.api.v1.routes.team_members.update_team_member_record"
DELETE_SEAM = "app.api.v1.routes.team_members.delete_team_member_record"


def _record(**overrides: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "id": MEMBER_ID,
        "first_name": "Marie",
        "last_name": "Dupont",
    }
    record.update(overrides)
    return record


# ===========================================================================
# Garde d'authentification
# ===========================================================================
def test_should_require_auth_to_update_member(client):
    """GIVEN aucun token WHEN PATCH /team-members/{id} THEN 401."""
    response = client.patch(f"{MEMBERS_PATH}/{MEMBER_ID}", json={"first_name": "X"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_require_auth_to_delete_member(client):
    """GIVEN aucun token WHEN DELETE /team-members/{id} THEN 401."""
    response = client.delete(f"{MEMBERS_PATH}/{MEMBER_ID}")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


# ===========================================================================
# Edition (PATCH)
# ===========================================================================
def test_should_update_member(client, auth_headers, monkeypatch):
    """GIVEN une personne existante WHEN PATCH avec prenom + nom THEN 200, la couche
    donnees recoit les champs fournis et le corps reflete la personne mise a jour.
    """
    captured: dict[str, Any] = {}

    def _update(*, member_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured.update({"member_id": member_id, "changes": changes})
        return _record(first_name="Marie-Claire", last_name="Durand")

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{MEMBERS_PATH}/{MEMBER_ID}",
        json={"first_name": "Marie-Claire", "last_name": "Durand"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert captured["member_id"] == MEMBER_ID
    assert captured["changes"] == {"first_name": "Marie-Claire", "last_name": "Durand"}
    assert body == {"id": MEMBER_ID, "first_name": "Marie-Claire", "last_name": "Durand"}


def test_should_update_only_provided_fields(client, auth_headers, monkeypatch):
    """GIVEN une mise a jour PARTIELLE (prenom seul) WHEN PATCH THEN la couche donnees ne
    recoit QUE les champs fournis (exclude_unset) — pas de last_name parasite a None.
    """
    captured: dict[str, Any] = {}

    def _update(*, member_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured["changes"] = changes
        return _record(first_name="Sophie")

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{MEMBERS_PATH}/{MEMBER_ID}", json={"first_name": "Sophie"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert captured["changes"] == {"first_name": "Sophie"}


def test_should_return_404_when_updating_unknown_member(client, auth_headers, monkeypatch):
    """GIVEN un id inexistant (le repo renvoie None) WHEN PATCH THEN 404."""
    monkeypatch.setattr(UPDATE_SEAM, lambda **_: None, raising=False)

    response = client.patch(
        f"{MEMBERS_PATH}/inconnu", json={"first_name": "X"}, headers=auth_headers
    )

    assert response.status_code == 404


# ===========================================================================
# Suppression (DELETE)
# ===========================================================================
def test_should_delete_member(client, auth_headers, monkeypatch):
    """GIVEN une personne existante WHEN DELETE THEN 204, la couche donnees recoit le
    bon id (la cascade FK cote base fait le reste — non prouvable ici).
    """
    captured: dict[str, Any] = {}

    def _delete(*, member_id: str) -> bool:
        captured["member_id"] = member_id
        return True

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{MEMBERS_PATH}/{MEMBER_ID}", headers=auth_headers)

    assert response.status_code == 204
    assert captured == {"member_id": MEMBER_ID}


def test_should_return_404_when_deleting_unknown_member(client, auth_headers, monkeypatch):
    """GIVEN un id inexistant (le repo renvoie False) WHEN DELETE THEN 404."""
    monkeypatch.setattr(DELETE_SEAM, lambda **_: False, raising=False)

    response = client.delete(f"{MEMBERS_PATH}/inconnu", headers=auth_headers)

    assert response.status_code == 404
