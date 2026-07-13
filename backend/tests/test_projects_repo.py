"""Tests UNITAIRES de la suppression d'un projet (`app.db.projects_repo`, point 3).

`tasks.project_id -> projects` est `on delete set null` : supprimer le projet ne
supprime PAS ses taches. La suppression est donc orchestree cote APPLICATION, et c'est
CETTE orchestration (celle qui vit en Python) que l'on teste ici avec un faux client
(`tests.fakes.FakeClient`) qui enregistre la sequence d'appels DB + Storage :

  1. lister les taches du projet ;
  2. purger les objets Storage de leurs pieces jointes AVANT de supprimer les lignes ;
  3. supprimer les taches (`where project_id = id`) ;
  4. supprimer le projet.

⚠️ DIRECTIVE D'HONNETETE — la CASCADE Postgres qui emporte sous-taches et lignes
`task_attachments` a la suppression des taches est une garantie de la BASE : un mock ne
la prouve pas. Ici on prouve l'ORCHESTRATION (bonnes requetes, bon ORDRE : Storage avant
DB) ; la cascade EFFECTIVE est verifiee par le test `@requires_db` en bas.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.db import projects_repo
from tests.conftest import requires_db
from tests.fakes import FakeClient

PROJECT_ID = "77777777-7777-7777-7777-777777777777"


def _install(monkeypatch, handler) -> FakeClient:
    fake = FakeClient(handler)
    # projects_repo ET attachments_repo resolvent le client via leur propre import : on
    # patche les deux pour qu'ils partagent LE MEME faux client (donc la meme liste
    # d'appels, ce qui permet d'asserter l'ordre Storage/DB de bout en bout).
    monkeypatch.setattr(projects_repo, "get_supabase_client", lambda: fake)
    monkeypatch.setattr(
        projects_repo.attachments_repo, "get_supabase_client", lambda: fake
    )
    return fake


def test_delete_project_purges_storage_before_deleting_tasks_then_project(monkeypatch):
    """GIVEN un projet avec 2 taches et des pieces jointes WHEN on supprime le projet
    THEN la sequence emise est : lister les taches -> lister les storage_path ->
    Storage.remove(paths) -> delete tasks(project_id) -> delete projects(id), avec la
    PURGE STORAGE STRICTEMENT AVANT la suppression des taches (sinon fichiers orphelins).
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["table"] == "tasks" and chain["op"] == "select":
            return [{"id": "t1"}, {"id": "t2"}]
        if chain["table"] == "task_attachments" and chain["op"] == "select":
            return [{"storage_path": "t1/a.pdf"}, {"storage_path": "t2/b.pdf"}]
        if chain["table"] == "projects" and chain["op"] == "delete":
            return [{"id": PROJECT_ID}]
        return []

    fake = _install(monkeypatch, handler)

    result = projects_repo.delete_project_record(PROJECT_ID)
    assert result is True

    ops = [(c["table"], c["op"]) for c in fake.calls]

    # La purge Storage a bien eu lieu avec les chemins collectes.
    storage_removes = [c for c in fake.calls if c["op"] == "storage.remove"]
    assert len(storage_removes) == 1
    assert storage_removes[0]["bucket"] == "task-attachments"
    assert storage_removes[0]["paths"] == ["t1/a.pdf", "t2/b.pdf"]

    # ORDRE : Storage.remove AVANT la suppression des taches AVANT la suppression du projet.
    remove_idx = ops.index((None, "storage.remove"))
    delete_tasks_idx = ops.index(("tasks", "delete"))
    delete_project_idx = ops.index(("projects", "delete"))
    assert remove_idx < delete_tasks_idx < delete_project_idx

    # La suppression des taches est scopee par project_id ; celle du projet par id.
    delete_tasks = next(
        c for c in fake.calls if c["table"] == "tasks" and c["op"] == "delete"
    )
    assert ("project_id", PROJECT_ID) in delete_tasks["filters"]
    delete_project = next(
        c for c in fake.calls if c["table"] == "projects" and c["op"] == "delete"
    )
    assert ("id", PROJECT_ID) in delete_project["filters"]


def test_delete_project_without_tasks_skips_storage_and_task_delete(monkeypatch):
    """GIVEN un projet SANS tache WHEN on supprime THEN aucune purge Storage ni
    suppression de taches : on supprime directement le projet.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["table"] == "tasks" and chain["op"] == "select":
            return []  # aucune tache
        if chain["table"] == "projects" and chain["op"] == "delete":
            return [{"id": PROJECT_ID}]
        return []

    fake = _install(monkeypatch, handler)

    assert projects_repo.delete_project_record(PROJECT_ID) is True
    assert not any(c["op"] == "storage.remove" for c in fake.calls)
    assert not any(c["table"] == "tasks" and c["op"] == "delete" for c in fake.calls)
    assert any(c["table"] == "projects" and c["op"] == "delete" for c in fake.calls)


def test_delete_project_returns_false_when_project_absent(monkeypatch):
    """GIVEN un projet inexistant (la suppression finale n'affecte aucune ligne)
    WHEN on supprime THEN False (traduit en 404 par la route).
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["table"] == "tasks" and chain["op"] == "select":
            return []
        return []  # delete projects -> aucune ligne

    _install(monkeypatch, handler)
    assert projects_repo.delete_project_record("inconnu") is False


def test_delete_project_degrades_to_false_when_offline(monkeypatch):
    """GIVEN la base injoignable WHEN on supprime THEN False (mode degrade)."""
    def handler(_chain: dict[str, Any]) -> Any:
        raise httpx.ConnectError("base injoignable")

    _install(monkeypatch, handler)
    assert projects_repo.delete_project_record(PROJECT_ID) is False


# ===========================================================================
# INTEGRATION @requires_db — cascade EFFECTIVE sur une vraie base (skippe par defaut)
# ===========================================================================
@requires_db
def test_integration_delete_project_removes_tasks_and_subtasks():
    """GIVEN un projet avec une tache et une sous-tache WHEN on supprime le projet (via
    le repo) THEN la tache est supprimee (cascade applicative) ET la sous-tache disparait
    par CASCADE FK (`task_subtasks -> tasks`), et le projet n'existe plus.

    NB : le volet Storage des pieces jointes n'est pas exerce ici (il exigerait un vrai
    upload dans le bucket) ; la sequence de purge Storage est couverte par les tests
    unitaires ci-dessus (assertions sur `storage.remove`).
    """
    client = projects_repo.get_supabase_client()
    project = (
        client.table("projects")
        .insert({"nom": "Projet cascade"})
        .execute()
        .data[0]
    )
    project_id = project["id"]
    task = (
        client.table("tasks")
        .insert({"titre": "Tache du projet", "priorite": "low", "project_id": project_id})
        .execute()
        .data[0]
    )
    task_id = task["id"]
    sub = (
        client.table("task_subtasks")
        .insert({"task_id": task_id, "title": "s1", "position": 0})
        .execute()
        .data[0]
    )
    sub_id = sub["id"]
    try:
        assert projects_repo.delete_project_record(project_id) is True

        assert client.table("projects").select("id").eq("id", project_id).execute().data == []
        assert client.table("tasks").select("id").eq("id", task_id).execute().data == []
        assert (
            client.table("task_subtasks").select("id").eq("id", sub_id).execute().data == []
        )
    finally:
        # Filet de securite (au cas ou l'assertion echoue avant la suppression).
        client.table("tasks").delete().eq("id", task_id).execute()
        client.table("projects").delete().eq("id", project_id).execute()
