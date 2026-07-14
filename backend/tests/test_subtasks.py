"""Sous-taches (checklist) des taches (§4.2, extension) — endpoints
/api/v1/tasks/{task_id}/subtasks (GET/POST) et .../{sub_id} (PATCH/DELETE) et
.../order (PUT).

Comme pour les pieces jointes, la persistance est isolee derriere des coutures
(seams) importees dans le module de route, remplacables par monkeypatch. On teste ici
la LOGIQUE de la route : garde JWT, validation du titre, serialisation, et la
traduction des contrats du repo en codes HTTP (404 quand la tache / sous-tache est
introuvable).
"""
from __future__ import annotations

from typing import Any

from tests.conftest import requires_db

TASK_ID = "44444444-4444-4444-4444-444444444444"
SUBS_PATH = f"/api/v1/tasks/{TASK_ID}/subtasks"

LIST_SEAM = "app.api.v1.routes.subtasks.list_subtask_records"
CREATE_SEAM = "app.api.v1.routes.subtasks.create_subtask_record"
UPDATE_SEAM = "app.api.v1.routes.subtasks.update_subtask_record"
DELETE_SEAM = "app.api.v1.routes.subtasks.delete_subtask_record"
REORDER_SEAM = "app.api.v1.routes.subtasks.reorder_subtask_records"


def _record(**overrides: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "id": "sub-1",
        "task_id": TASK_ID,
        "title": "Appeler le prestataire",
        # Statut a 6 valeurs (remplace l'ancien booleen is_done) ; defaut « a faire ».
        "statut": "todo",
        "position": 0,
        "created_at": "2026-07-08T09:00:00Z",
    }
    record.update(overrides)
    return record


# ===========================================================================
# Garde d'authentification
# ===========================================================================
def test_should_require_auth_to_list(client):
    """GIVEN aucun token WHEN GET subtasks THEN 401."""
    assert client.get(SUBS_PATH).status_code == 401


def test_should_require_auth_to_create(client):
    """GIVEN aucun token WHEN POST subtask THEN 401."""
    assert client.post(SUBS_PATH, json={"title": "X"}).status_code == 401


def test_should_require_auth_to_reorder(client):
    """GIVEN aucun token WHEN PUT order THEN 401."""
    assert client.put(f"{SUBS_PATH}/order", json={"ordered_ids": []}).status_code == 401


def test_should_require_auth_to_update(client):
    """GIVEN aucun token WHEN PATCH .../{id} THEN 401 (garde d'auth sur la mutation)."""
    assert client.patch(f"{SUBS_PATH}/sub-1", json={"statut": "done"}).status_code == 401


def test_should_require_auth_to_delete(client):
    """GIVEN aucun token WHEN DELETE .../{id} THEN 401 (garde d'auth sur la suppression)."""
    assert client.delete(f"{SUBS_PATH}/sub-1").status_code == 401


# ===========================================================================
# Liste
# ===========================================================================
def test_should_list_subtasks_sorted(client, auth_headers, monkeypatch):
    """GIVEN une tache avec des sous-taches WHEN GET THEN 200 + liste serialisee."""
    captured: dict[str, Any] = {}

    def _list(*, task_id: str) -> list[dict[str, Any]]:
        captured["task_id"] = task_id
        return [_record(id="sub-1", position=0), _record(id="sub-2", position=1)]

    monkeypatch.setattr(LIST_SEAM, _list, raising=False)

    response = client.get(SUBS_PATH, headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert captured["task_id"] == TASK_ID
    assert [s["id"] for s in body] == ["sub-1", "sub-2"]


# ===========================================================================
# Creation
# ===========================================================================
def test_should_create_subtask(client, auth_headers, monkeypatch):
    """GIVEN un titre valide WHEN POST THEN 201, la couche donnees recoit le titre
    (nettoye) et la tache, et le corps reflete la sous-tache creee.
    """
    captured: dict[str, Any] = {}

    def _create(*, task_id: str, title: str) -> dict[str, Any]:
        captured.update({"task_id": task_id, "title": title})
        return _record(title=title)

    monkeypatch.setattr(CREATE_SEAM, _create, raising=False)

    response = client.post(
        SUBS_PATH, json={"title": "  Relancer le fournisseur  "}, headers=auth_headers
    )

    assert response.status_code == 201
    body = response.json()
    assert captured["task_id"] == TASK_ID
    # Le titre est nettoye (strip) par le schema avant d'atteindre la couche donnees.
    assert captured["title"] == "Relancer le fournisseur"
    assert body["title"] == "Relancer le fournisseur"
    # Nouvelle sous-tache : statut par defaut « a faire » (equivalent de l'ancien is_done=false).
    assert body["statut"] == "todo"


def test_should_reject_blank_title(client, auth_headers, monkeypatch):
    """GIVEN un titre vide (espaces) WHEN POST THEN 422 (validation), sans persistance."""
    called = {"create": False}
    monkeypatch.setattr(
        CREATE_SEAM,
        lambda **_: called.__setitem__("create", True) or _record(),
        raising=False,
    )

    response = client.post(SUBS_PATH, json={"title": "   "}, headers=auth_headers)

    assert response.status_code == 422
    assert called["create"] is False


def test_should_reject_title_exceeding_max_length(client, auth_headers, monkeypatch):
    """GIVEN un titre au-dela de la borne (max 500) WHEN POST THEN 422, sans persistance
    (correctif securite : bornage des champs texte)."""
    called = {"create": False}
    monkeypatch.setattr(
        CREATE_SEAM,
        lambda **_: called.__setitem__("create", True) or _record(),
        raising=False,
    )

    response = client.post(SUBS_PATH, json={"title": "x" * 501}, headers=auth_headers)

    assert response.status_code == 422
    assert called["create"] is False


def test_should_reject_missing_title(client, auth_headers, monkeypatch):
    """GIVEN aucun champ `title` (absent, pas seulement vide) WHEN POST THEN 422, sans
    persistance : le contrat de creation exige explicitement un titre.
    """
    called = {"create": False}
    monkeypatch.setattr(
        CREATE_SEAM,
        lambda **_: called.__setitem__("create", True) or _record(),
        raising=False,
    )

    response = client.post(SUBS_PATH, json={}, headers=auth_headers)

    assert response.status_code == 422
    assert called["create"] is False


def test_should_return_404_when_creating_on_missing_task(client, auth_headers, monkeypatch):
    """GIVEN une tache inexistante (le repo renvoie None) WHEN POST THEN 404."""
    monkeypatch.setattr(CREATE_SEAM, lambda **_: None, raising=False)

    response = client.post(SUBS_PATH, json={"title": "X"}, headers=auth_headers)

    assert response.status_code == 404


# ===========================================================================
# Mise a jour (cocher / renommer)
# ===========================================================================
def test_should_change_status(client, auth_headers, monkeypatch):
    """GIVEN une sous-tache WHEN PATCH statut='done' THEN 200, le changement est relaye
    a la couche donnees (exclude_unset) et reflete dans le corps.
    """
    captured: dict[str, Any] = {}

    def _update(*, task_id: str, subtask_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured.update({"task_id": task_id, "subtask_id": subtask_id, "changes": changes})
        return _record(id=subtask_id, statut=changes.get("statut", "todo"))

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{SUBS_PATH}/sub-1", json={"statut": "done"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert captured["subtask_id"] == "sub-1"
    # Seul le champ fourni est transmis (pas de title parasite). La valeur d'enum est
    # serialisee en sa chaine (« done ») pour la couche donnees.
    assert captured["changes"] == {"statut": "done"}
    assert response.json()["statut"] == "done"


def test_should_change_status_to_any_of_the_six(client, auth_headers, monkeypatch):
    """GIVEN une sous-tache WHEN PATCH statut='in_progress' THEN 200, un statut
    intermediaire (pas seulement done/todo) est accepte et relaye tel quel — le contrat
    couvre bien les 6 memes valeurs que les taches.
    """
    captured: dict[str, Any] = {}

    def _update(*, task_id: str, subtask_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured.update({"changes": changes})
        return _record(id=subtask_id, statut=changes.get("statut", "todo"))

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{SUBS_PATH}/sub-1", json={"statut": "in_progress"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert captured["changes"] == {"statut": "in_progress"}
    assert response.json()["statut"] == "in_progress"


def test_should_reject_invalid_status(client, auth_headers, monkeypatch):
    """GIVEN une valeur de statut hors des 6 WHEN PATCH THEN 422 (validation enum), sans
    persistance : meme contrainte que `tasks.statut` (reutilisation de TaskStatus).
    """
    called = {"update": False}
    monkeypatch.setattr(
        UPDATE_SEAM,
        lambda **_: called.__setitem__("update", True) or _record(),
        raising=False,
    )

    response = client.patch(
        f"{SUBS_PATH}/sub-1", json={"statut": "pas_un_statut"}, headers=auth_headers
    )

    assert response.status_code == 422
    assert called["update"] is False


def test_should_return_404_when_updating_missing_subtask(client, auth_headers, monkeypatch):
    """GIVEN une sous-tache introuvable (repo -> None) WHEN PATCH THEN 404."""
    monkeypatch.setattr(UPDATE_SEAM, lambda **_: None, raising=False)

    response = client.patch(
        f"{SUBS_PATH}/nope", json={"statut": "done"}, headers=auth_headers
    )

    assert response.status_code == 404


# ===========================================================================
# Suppression
# ===========================================================================
def test_should_delete_subtask(client, auth_headers, monkeypatch):
    """GIVEN une sous-tache existante WHEN DELETE THEN 204."""
    captured: dict[str, Any] = {}

    def _delete(*, task_id: str, subtask_id: str) -> bool:
        captured.update({"task_id": task_id, "subtask_id": subtask_id})
        return True

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{SUBS_PATH}/sub-1", headers=auth_headers)

    assert response.status_code == 204
    assert captured == {"task_id": TASK_ID, "subtask_id": "sub-1"}


def test_should_return_404_when_deleting_missing_subtask(client, auth_headers, monkeypatch):
    """GIVEN une sous-tache introuvable (repo -> False) WHEN DELETE THEN 404."""
    monkeypatch.setattr(DELETE_SEAM, lambda **_: False, raising=False)

    response = client.delete(f"{SUBS_PATH}/nope", headers=auth_headers)

    assert response.status_code == 404


# ===========================================================================
# Reordonnancement
# ===========================================================================
def test_should_reorder_subtasks(client, auth_headers, monkeypatch):
    """GIVEN une liste ordonnee d'ids WHEN PUT order THEN 200 + liste reordonnee, la
    couche donnees recoit exactement l'ordre demande.
    """
    captured: dict[str, Any] = {}

    def _reorder(*, task_id: str, ordered_ids: list[str]) -> list[dict[str, Any]]:
        captured.update({"task_id": task_id, "ordered_ids": ordered_ids})
        return [
            _record(id=sub_id, position=index)
            for index, sub_id in enumerate(ordered_ids)
        ]

    monkeypatch.setattr(REORDER_SEAM, _reorder, raising=False)

    response = client.put(
        f"{SUBS_PATH}/order",
        json={"ordered_ids": ["sub-2", "sub-1"]},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert captured["ordered_ids"] == ["sub-2", "sub-1"]
    assert [s["id"] for s in response.json()] == ["sub-2", "sub-1"]


def test_should_return_404_when_reordering_missing_task(client, auth_headers, monkeypatch):
    """GIVEN une tache introuvable (repo -> None) WHEN PUT order THEN 404."""
    monkeypatch.setattr(REORDER_SEAM, lambda **_: None, raising=False)

    response = client.put(
        f"{SUBS_PATH}/order", json={"ordered_ids": ["x"]}, headers=auth_headers
    )

    assert response.status_code == 404


# ===========================================================================
# INTEGRATION bout-en-bout (vrai Supabase de test) — skippe par defaut
# (mimique test_tasks_crud.test_integration_create_update_delete_flow).
#
# ⚠️ Ces tests ne s'executent QUE si TODOSO_RUN_DB_TESTS=1 + variables SUPABASE_*
# reelles ; sinon ils sont COLLECTES puis SKIPPES. Ils exercent la vraie pile
# (API -> repo -> Postgres) via l'API publique. Les garanties strictement
# Postgres (CASCADE sans orphelins, contrainte FK, RLS) sont couvertes plus
# finement dans test_subtasks_repo.py (memes contraintes d'execution).
# ===========================================================================
@requires_db
def test_integration_subtask_lifecycle_via_api(client, auth_headers):
    """GIVEN un vrai backend + Supabase de test
    WHEN on cree une tache, y ajoute des sous-taches, coche/decoche, reordonne, puis
      supprime une sous-tache (via l'API publique)
    THEN chaque etape est persistee, l'ordre suit `position` et le decochage revient.

    Auto-suffisant : n'utilise ni projet ni responsable (FK) pour rester isole.
    """
    created = client.post(
        "/api/v1/tasks",
        json={"titre": "Checklist integration", "priorite": "low"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    task_id = created.json()["id"]
    subs_path = f"/api/v1/tasks/{task_id}/subtasks"

    try:
        # Deux sous-taches -> positions croissantes (ajout en fin de liste).
        first = client.post(subs_path, json={"title": "Etape 1"}, headers=auth_headers)
        second = client.post(subs_path, json={"title": "Etape 2"}, headers=auth_headers)
        assert first.status_code == 201 and second.status_code == 201
        first_id, second_id = first.json()["id"], second.json()["id"]
        assert first.json()["position"] < second.json()["position"]

        listing = client.get(subs_path, headers=auth_headers)
        assert listing.status_code == 200
        assert [s["id"] for s in listing.json()] == [first_id, second_id]

        # Changer le statut puis revenir (les deux sens sont bien persistes).
        checked = client.patch(
            f"{subs_path}/{first_id}", json={"statut": "done"}, headers=auth_headers
        )
        assert checked.status_code == 200 and checked.json()["statut"] == "done"
        unchecked = client.patch(
            f"{subs_path}/{first_id}", json={"statut": "todo"}, headers=auth_headers
        )
        assert unchecked.json()["statut"] == "todo"

        # Reordonner : l'ordre demande devient l'ordre stocke (par position).
        reordered = client.put(
            f"{subs_path}/order",
            json={"ordered_ids": [second_id, first_id]},
            headers=auth_headers,
        )
        assert reordered.status_code == 200
        assert [s["id"] for s in reordered.json()] == [second_id, first_id]

        # Supprimer une sous-tache -> 204, et elle disparait de la liste.
        deleted = client.delete(f"{subs_path}/{first_id}", headers=auth_headers)
        assert deleted.status_code == 204
        remaining = client.get(subs_path, headers=auth_headers)
        assert [s["id"] for s in remaining.json()] == [second_id]
    finally:
        # Nettoyage : supprimer la tache (la CASCADE emporte les sous-taches restantes).
        client.delete(f"/api/v1/tasks/{task_id}", headers=auth_headers)
