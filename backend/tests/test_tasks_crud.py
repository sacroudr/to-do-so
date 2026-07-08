"""Gestion des taches : creation, modification, reassignation, statut, suppression
(requirements.md §4.2).

Criteres d'acceptation couverts (§4.2) :
  - Creation d'une tache avec TOUS les champs (titre, description, projet,
    responsables multiples, echeance date OU texte libre, statut, priorite, source).
  - Modification, reassignation, changement de statut, suppression.
  - Validation : champs obligatoires manquants ; (echeance en format invalide -> voir
    « Points a clarifier », comportement non specifie -> test explicitement skippe).

Deux niveaux :
  1) Tests de VALIDATION / SERIALISATION runnable des maintenant (Pydantic 422,
     echo des champs a la creation).
  2) Tests de PERSISTANCE / MUTATION en TDD, isoles derriere des coutures (seams)
     que l'implementation devra respecter (RED tant que non implemente) :

  CONTRAT ASSUME (a confirmer — voir « Points a clarifier ») :
    * POST   /api/v1/tasks            -> create_task_record(data: dict, created_by: str) -> dict
    * PATCH  /api/v1/tasks/{task_id}  -> update_task_record(task_id: str, changes: dict) -> dict | None
    * DELETE /api/v1/tasks/{task_id}  -> delete_task_record(task_id: str, user_id: str) -> bool
      (les seams sont importees dans le module de route ; None/False -> 404).
"""
from __future__ import annotations

from typing import Any

import pytest

from tests.conftest import TEST_USER_ID, requires_db

TASKS_PATH = "/api/v1/tasks"

CREATE_SEAM = "app.api.v1.routes.tasks.create_task_record"
UPDATE_SEAM = "app.api.v1.routes.tasks.update_task_record"
DELETE_SEAM = "app.api.v1.routes.tasks.delete_task_record"

PROJECT_ID = "11111111-1111-1111-1111-111111111111"
USER_1 = "22222222-2222-2222-2222-222222222222"
USER_2 = "33333333-3333-3333-3333-333333333333"


def _full_payload(**overrides: Any) -> dict[str, Any]:
    """Payload de creation couvrant TOUS les champs (§4.2)."""
    payload: dict[str, Any] = {
        "titre": "Preparer la migration Sage 100",
        "description": "Lister les ecarts avec Dealer Business",
        "project_id": PROJECT_ID,
        "due_date": "2026-07-15",  # echeance = date precise (EXACTEMENT un des deux, §4.2)
        "due_date_text": None,
        "statut": "in_progress",
        "priorite": "high",
        "source": "CR reunion hebdo 2026-07-01",
        "assignee_ids": [USER_1, USER_2],  # responsables MULTIPLES
    }
    payload.update(overrides)
    return payload


# ===========================================================================
# 1) VALIDATION / SERIALISATION — runnable des maintenant
# ===========================================================================
def test_should_reject_creation_when_titre_missing(client, auth_headers):
    """GIVEN un payload SANS titre (champ obligatoire, §4.2)
    WHEN on POST /tasks
    THEN 422 (erreur de validation).
    """
    payload = _full_payload()
    payload.pop("titre")
    response = client.post(TASKS_PATH, json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_should_reject_creation_when_status_is_invalid(client, auth_headers):
    """GIVEN un statut hors enumeration (§4.3 : a qualifier / a planifier / a faire /
    en cours / en attente / a tester / a corriger / termine / archive)
    WHEN on POST /tasks
    THEN 422.
    """
    response = client.post(
        TASKS_PATH, json=_full_payload(statut="pas_un_statut"), headers=auth_headers
    )
    assert response.status_code == 422


def test_should_reject_creation_when_priority_is_invalid(client, auth_headers):
    """GIVEN une priorite hors enumeration (§4.2 : basse/moyenne/haute)
    WHEN on POST /tasks
    THEN 422.
    """
    response = client.post(
        TASKS_PATH, json=_full_payload(priorite="urgentissime"), headers=auth_headers
    )
    assert response.status_code == 422


def test_should_accept_creation_with_all_fields(client, auth_headers):
    """GIVEN un payload complet et valide (tous les champs, §4.2)
    WHEN on POST /tasks
    THEN 201 et le corps reflete les champs saisis (titre, statut, priorite,
      responsables multiples).
    """
    response = client.post(TASKS_PATH, json=_full_payload(), headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["titre"] == "Preparer la migration Sage 100"
    assert body["statut"] == "in_progress"
    assert body["priorite"] == "high"
    assert set(body["assignee_ids"]) == {USER_1, USER_2}


def test_should_apply_default_status_and_priority(client, auth_headers):
    """GIVEN un payload minimal valide (titre + une echeance)
    WHEN on POST /tasks
    THEN 201 avec statut par defaut `a_qualifier` (premier statut du flux, refonte
      5 -> 9) et priorite par defaut `medium` (§4.2 / §4.3).
    """
    response = client.post(
        TASKS_PATH,
        json={"titre": "Tache minimale", "due_date": "2026-07-15"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["statut"] == "a_qualifier"
    assert body["priorite"] == "medium"


def test_should_accept_free_text_due_date(client, auth_headers):
    """GIVEN une echeance en texte LIBRE (ex. « mi-juillet ») sans date precise
    WHEN on POST /tasks
    THEN 201 (l'echeance libre est un cas de premiere classe, §4.2).
    """
    response = client.post(
        TASKS_PATH,
        json=_full_payload(due_date=None, due_date_text="mi-juillet"),
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["due_date_text"] == "mi-juillet"


def test_should_reject_creation_when_due_date_format_is_invalid(client, auth_headers):
    """GIVEN une echeance de type DATE mais mal formatee (ex. « 2026-13-40 »)
    WHEN on POST /tasks
    THEN 422 : `due_date` est un vrai type date, une valeur invalide est rejetee
      nativement (regle confirmee, §4.2 — pas de parsing heuristique).
    """
    response = client.post(
        TASKS_PATH,
        json=_full_payload(due_date="2026-13-40", due_date_text=None),
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_should_reject_creation_when_both_due_fields_are_set(client, auth_headers):
    """GIVEN une echeance renseignee A LA FOIS en date precise ET en texte libre
    WHEN on POST /tasks
    THEN 422 : exactement UN des deux champs d'echeance doit etre fourni (§4.2).
    """
    response = client.post(
        TASKS_PATH,
        json=_full_payload(due_date="2026-07-15", due_date_text="mi-juillet"),
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_should_reject_creation_when_no_due_field_is_set(client, auth_headers):
    """GIVEN une creation SANS aucune echeance (ni date, ni texte libre)
    WHEN on POST /tasks
    THEN 422 : une echeance (exactement un des deux champs) est obligatoire (§4.2).
    """
    response = client.post(
        TASKS_PATH,
        json=_full_payload(due_date=None, due_date_text=None),
        headers=auth_headers,
    )
    assert response.status_code == 422


# ===========================================================================
# 2) PERSISTANCE / MUTATION — TDD (RED jusqu'a implementation)
# ===========================================================================
def test_should_persist_task_and_author_on_create(client, auth_headers, monkeypatch):
    """GIVEN un payload valide et un utilisateur authentifie
    WHEN on POST /tasks
    THEN la couche donnees persiste la tache avec l'auteur (created_by = sub du JWT).
    """
    captured: dict[str, Any] = {}

    def _create(data: dict[str, Any], created_by: str) -> dict[str, Any]:
        captured["data"] = data
        captured["created_by"] = created_by
        return {"id": "new-id", **_full_payload()}

    monkeypatch.setattr(CREATE_SEAM, _create, raising=False)

    response = client.post(TASKS_PATH, json=_full_payload(), headers=auth_headers)

    assert response.status_code == 201
    assert captured["created_by"] == TEST_USER_ID
    assert captured["data"]["titre"] == "Preparer la migration Sage 100"


def test_should_change_status(client, auth_headers, monkeypatch):
    """GIVEN une tache existante
    WHEN on PATCH /tasks/{id} avec un nouveau statut
    THEN la couche donnees est mise a jour et 200 reflete le nouveau statut (§4.2).
    """
    def _update(task_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        return {"id": task_id, **_full_payload(**changes)}

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(f"{TASKS_PATH}/task-1", json={"statut": "done"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["statut"] == "done"


def test_should_reassign_task(client, auth_headers, monkeypatch):
    """GIVEN une tache existante
    WHEN on PATCH /tasks/{id} avec une nouvelle liste de responsables
    THEN la couche donnees recoit les nouveaux assignee_ids et 200 les reflete (§4.2).
    """
    captured: dict[str, Any] = {}

    def _update(task_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        captured.update(changes)
        return {"id": task_id, **_full_payload(assignee_ids=changes.get("assignee_ids", []))}

    monkeypatch.setattr(UPDATE_SEAM, _update, raising=False)

    response = client.patch(
        f"{TASKS_PATH}/task-1", json={"assignee_ids": [USER_2]}, headers=auth_headers
    )

    assert response.status_code == 200
    assert captured["assignee_ids"] == [USER_2]
    assert response.json()["assignee_ids"] == [USER_2]


def test_should_return_404_when_updating_unknown_task(client, auth_headers, monkeypatch):
    """GIVEN un id de tache inexistant
    WHEN on PATCH /tasks/{id}
    THEN 404 (la couche donnees renvoie None).
    """
    monkeypatch.setattr(UPDATE_SEAM, lambda task_id, changes: None, raising=False)

    response = client.patch(f"{TASKS_PATH}/inconnu", json={"statut": "done"}, headers=auth_headers)

    assert response.status_code == 404


def test_should_delete_task(client, auth_headers, monkeypatch):
    """GIVEN une tache existante
    WHEN on DELETE /tasks/{id}
    THEN 204 (suppression effectuee) (§4.2).
    """
    captured: dict[str, Any] = {}

    def _delete(task_id: str, user_id: str) -> bool:
        captured["task_id"] = task_id
        captured["user_id"] = user_id
        return True

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{TASKS_PATH}/task-1", headers=auth_headers)

    assert response.status_code == 204
    assert captured == {"task_id": "task-1", "user_id": TEST_USER_ID}


def test_should_allow_any_member_to_delete_any_task(client, auth_headers, monkeypatch):
    """GIVEN un membre de l'equipe qui n'est NI l'auteur NI un responsable de la tache
    WHEN on DELETE /tasks/{id}
    THEN 204 : n'importe quel membre peut supprimer n'importe quelle tache (regle
      confirmee, requirements.md §4.2 / §3). Il n'existe donc AUCUN chemin 403.
    """

    def _delete(task_id: str, user_id: str) -> bool:
        return True  # aucune restriction auteur/responsable

    monkeypatch.setattr(DELETE_SEAM, _delete, raising=False)

    response = client.delete(f"{TASKS_PATH}/tache-d-un-autre", headers=auth_headers)

    assert response.status_code == 204
    assert response.status_code != 403


def test_should_return_404_when_deleting_unknown_task(client, auth_headers, monkeypatch):
    """GIVEN un id de tache inexistant
    WHEN on DELETE /tasks/{id}
    THEN 404 (la couche donnees renvoie False) — une tache introuvable n'est pas un
      refus d'autorisation (§4.2 : la suppression est ouverte a tous les membres).
    """
    monkeypatch.setattr(DELETE_SEAM, lambda task_id, user_id: False, raising=False)

    response = client.delete(f"{TASKS_PATH}/inconnu", headers=auth_headers)

    assert response.status_code == 404


# ===========================================================================
# 3) INTEGRATION bout-en-bout (vrai Supabase de test) — skippe par defaut
# ===========================================================================
@requires_db
def test_integration_create_update_delete_flow(client, auth_headers):
    """GIVEN un vrai backend + Supabase de test
    WHEN on cree une tache, change son statut, puis la supprime (via l'API publique)
    THEN chaque etape est persistee et coherente (cycle de vie complet §4.2).

    Auto-suffisant : n'utilise ni projet ni responsable (FK) pour rester isole.
    """
    created = client.post(
        TASKS_PATH,
        json={"titre": "Cycle de vie integration", "priorite": "low"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    task_id = created.json()["id"]

    patched = client.patch(
        f"{TASKS_PATH}/{task_id}", json={"statut": "done"}, headers=auth_headers
    )
    assert patched.status_code == 200
    assert patched.json()["statut"] == "done"

    deleted = client.delete(f"{TASKS_PATH}/{task_id}", headers=auth_headers)
    assert deleted.status_code == 204

    gone = client.get(f"{TASKS_PATH}?project=", headers=auth_headers)
    assert all(t["id"] != task_id for t in gone.json())
