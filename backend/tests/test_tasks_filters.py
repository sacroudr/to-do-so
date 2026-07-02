"""Filtrage des taches par responsable / projet (requirements.md §4.6).

Criteres d'acceptation couverts (§4.6) :
  - « Filtrage des taches par responsable. »
  - « Filtrage des taches par projet. »
  - Combinaison des deux filtres.
  - Cas limites : aucun resultat ; responsable / projet inexistant.
  (Le refus d'acces sans authentification est couvert dans test_tasks_auth.py.)

----------------------------------------------------------------------------------
APPROCHE (TDD) — ces tests sont ecrits AVANT l'implementation
----------------------------------------------------------------------------------
Le filtrage est intrinsequement une requete base (PostgreSQL/Supabase). Pour tester
la LOGIQUE de la route (lecture des filtres + passage a la couche donnees +
serialisation en `Task`) sans dependre d'un vrai Supabase, on isole l'acces base
derriere une COUTURE (seam) que l'implementation devra respecter :

  CONTRAT (confirme) :
    * La route GET /api/v1/tasks lit deux query params OPTIONNELS :
        - `assignee` : id (uuid) d'un responsable       -> filtre par responsable
        - `project`  : id (uuid) d'un projet            -> filtre par projet
      combinables (ET logique).
    * La route delegue la lecture a une fonction de depot importee dans le module
      de route sous le nom `list_task_records`, de signature :
        list_task_records(*, assignee_id: str | None, project_id: str | None)
            -> list[dict]   (dicts serialisables en schemas.task.Task)

On remplace cette fonction par un FAUX depot via monkeypatch(raising=False). Tant que
l'implementation n'existe pas (la route renvoie []), les assertions echouent : c'est
l'etat ROUGE attendu en TDD. Une fois la route cablee sur `list_task_records` avec les
query params, ces tests passent au VERT — sans base de donnees.

NB : une verification bout-en-bout au niveau SQL (que le filtre produit vraiment le bon
sous-ensemble en base) releve d'un test d'integration sur un Supabase de test ; elle est
recommandee en complement (non simulable ici de facon fiable).
"""
from __future__ import annotations

from typing import Any

import pytest

TASKS_PATH = "/api/v1/tasks"
SEAM = "app.api.v1.routes.tasks.list_task_records"

PROJECT_A = "11111111-1111-1111-1111-111111111111"
USER_A = "22222222-2222-2222-2222-222222222222"


def _fake_repo(records: list[dict[str, Any]]):
    """Faux depot : enregistre les kwargs recus et renvoie `records`."""
    calls: list[dict[str, Any]] = []

    def _list(**kwargs: Any) -> list[dict[str, Any]]:
        calls.append(kwargs)
        return records

    _list.calls = calls  # type: ignore[attr-defined]
    return _list


def _task_record(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "task-1",
        "titre": "Relancer le prestataire Sage 100",
        "description": None,
        "project_id": PROJECT_A,
        "due_date": None,
        "due_date_text": "mi-juillet",
        "statut": "todo",
        "priorite": "high",
        "source": "CR reunion 2026-07-01",
        "assignee_ids": [USER_A],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Filtre par responsable (§4.6)
# ---------------------------------------------------------------------------
def test_should_filter_by_assignee(client, auth_headers, monkeypatch):
    """GIVEN un responsable donne
    WHEN on appelle GET /tasks?assignee=<user>
    THEN la couche donnees est interrogee avec assignee_id=<user> (project_id=None)
      ET la reponse (200) contient les taches renvoyees.
    """
    fake = _fake_repo([_task_record(id="t1")])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(f"{TASKS_PATH}?assignee={USER_A}", headers=auth_headers)

    assert response.status_code == 200
    assert fake.calls == [{"assignee_id": USER_A, "project_id": None}]
    assert [t["id"] for t in response.json()] == ["t1"]


# ---------------------------------------------------------------------------
# Filtre par projet (§4.6)
# ---------------------------------------------------------------------------
def test_should_filter_by_project(client, auth_headers, monkeypatch):
    """GIVEN un projet donne
    WHEN on appelle GET /tasks?project=<projet>
    THEN la couche donnees est interrogee avec project_id=<projet> (assignee_id=None).
    """
    fake = _fake_repo([_task_record(id="t2", project_id=PROJECT_A)])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(f"{TASKS_PATH}?project={PROJECT_A}", headers=auth_headers)

    assert response.status_code == 200
    assert fake.calls == [{"assignee_id": None, "project_id": PROJECT_A}]
    assert [t["id"] for t in response.json()] == ["t2"]


# ---------------------------------------------------------------------------
# Combinaison des deux filtres (§4.6)
# ---------------------------------------------------------------------------
def test_should_combine_assignee_and_project_filters(client, auth_headers, monkeypatch):
    """GIVEN un responsable ET un projet
    WHEN on appelle GET /tasks?assignee=<user>&project=<projet>
    THEN la couche donnees recoit les DEUX filtres (ET logique).
    """
    fake = _fake_repo([_task_record(id="t3")])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(
        f"{TASKS_PATH}?assignee={USER_A}&project={PROJECT_A}", headers=auth_headers
    )

    assert response.status_code == 200
    assert fake.calls == [{"assignee_id": USER_A, "project_id": PROJECT_A}]


# ---------------------------------------------------------------------------
# Aucun filtre : toutes les taches (§4.6 — les filtres sont optionnels)
# ---------------------------------------------------------------------------
def test_should_return_all_tasks_when_no_filter(client, auth_headers, monkeypatch):
    """GIVEN aucun filtre
    WHEN on appelle GET /tasks
    THEN la couche donnees est interrogee sans filtre (les deux a None).
    """
    fake = _fake_repo([_task_record(id="a"), _task_record(id="b")])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(TASKS_PATH, headers=auth_headers)

    assert response.status_code == 200
    assert fake.calls == [{"assignee_id": None, "project_id": None}]
    assert len(response.json()) == 2


# ---------------------------------------------------------------------------
# Cas limite : aucun resultat (§4.6)
# ---------------------------------------------------------------------------
def test_should_return_empty_list_when_no_task_matches(client, auth_headers, monkeypatch):
    """GIVEN un filtre qui ne correspond a aucune tache
    WHEN on appelle GET /tasks?assignee=<user>
    THEN 200 et une liste VIDE (pas une erreur).
    """
    fake = _fake_repo([])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(f"{TASKS_PATH}?assignee={USER_A}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Cas limite : responsable / projet inexistant (§4.6)
# ---------------------------------------------------------------------------
def test_should_return_empty_list_for_nonexistent_assignee(client, auth_headers, monkeypatch):
    """GIVEN un id de responsable qui n'existe pas
    WHEN on filtre dessus
    THEN 200 + liste vide (un id inconnu n'est pas une erreur, il ne matche rien).

    NB : si le produit prefere renvoyer 404 pour un responsable/projet inexistant,
    ce comportement doit etre precise (voir « Points a clarifier »). Ce test fixe
    l'hypothese « filtre tolerant -> liste vide ».
    """
    fake = _fake_repo([])
    monkeypatch.setattr(SEAM, fake, raising=False)

    response = client.get(
        f"{TASKS_PATH}?assignee=99999999-0000-0000-0000-000000000000", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json() == []
