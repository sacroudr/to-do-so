"""Tests UNITAIRES de la couche donnees des personnes assignables
(`app.db.team_members_repo`, point 1 : edition + suppression).

On teste la LOGIQUE APPLICATIVE reelle du repo (celle qui vit en Python) avec un FAUX
client (`tests.fakes.FakeClient`) qui enregistre la chaine d'appels :
  - update : scoping par id, no-op tolerant si `changes` vide, None si introuvable ;
  - delete : requete emise sur la SEULE table `team_members` (scopee par id), traduction
    booleenne des lignes affectees ;
  - mode degrade (base injoignable).

⚠️ DIRECTIVE D'HONNETETE — la CASCADE `task_assignees.user_id -> team_members on delete
cascade` (retrait de la personne des taches, sans supprimer aucune tache) est une
garantie POSTGRES : un mock ne peut PAS la prouver. Ce que ce fichier prouve, c'est que
le repo n'emet AUCUNE suppression applicative sur `tasks` / `task_assignees` (il compte
sur la cascade DB). La cascade EFFECTIVE est verifiee par le test `@requires_db` en bas.
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.db import team_members_repo
from tests.conftest import requires_db
from tests.fakes import FakeClient

MEMBER_ID = "55555555-5555-5555-5555-555555555555"


def _install(monkeypatch, handler) -> FakeClient:
    fake = FakeClient(handler)
    monkeypatch.setattr(team_members_repo, "get_supabase_client", lambda: fake)
    return fake


def _raise_offline(_chain: dict[str, Any]) -> Any:
    raise httpx.ConnectError("base injoignable")


# ===========================================================================
# update_team_member_record
# ===========================================================================
def test_update_scopes_write_by_id_and_returns_row(monkeypatch):
    """GIVEN un changement WHEN on met a jour THEN l'UPDATE cible la table team_members,
    scope par id, et la ligne mise a jour est renvoyee.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["op"] == "update":
            return [{"id": MEMBER_ID, "first_name": "Sophie", "last_name": "Durand"}]
        return []

    fake = _install(monkeypatch, handler)

    result = team_members_repo.update_team_member_record(
        MEMBER_ID, {"first_name": "Sophie"}
    )

    update = next(c for c in fake.calls if c["op"] == "update")
    assert update["table"] == "team_members"
    assert ("id", MEMBER_ID) in update["filters"]
    assert result is not None and result["first_name"] == "Sophie"


def test_update_with_empty_changes_reads_without_writing(monkeypatch):
    """GIVEN aucun champ a modifier (changes={}) WHEN on met a jour THEN aucun UPDATE
    n'est emis (no-op tolerant) : on RELIT simplement la ligne courante.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["op"] == "select":
            return [{"id": MEMBER_ID, "first_name": "Marie", "last_name": "Dupont"}]
        return []

    fake = _install(monkeypatch, handler)

    result = team_members_repo.update_team_member_record(MEMBER_ID, {})

    assert not any(c["op"] == "update" for c in fake.calls)
    assert any(c["op"] == "select" for c in fake.calls)
    assert result is not None


def test_update_returns_none_when_absent(monkeypatch):
    """GIVEN un id inexistant (aucune ligne) WHEN on met a jour THEN None (-> 404)."""
    _install(monkeypatch, lambda chain: [])
    assert (
        team_members_repo.update_team_member_record(MEMBER_ID, {"first_name": "X"})
        is None
    )


def test_update_degrades_to_none_when_offline(monkeypatch):
    """GIVEN la base injoignable WHEN on met a jour THEN None (mode degrade)."""
    _install(monkeypatch, _raise_offline)
    assert (
        team_members_repo.update_team_member_record(MEMBER_ID, {"first_name": "X"})
        is None
    )


# ===========================================================================
# delete_team_member_record
# ===========================================================================
def test_delete_targets_only_team_members_table_scoped_by_id(monkeypatch):
    """GIVEN une personne existante WHEN on supprime THEN True, et la SEULE suppression
    emise porte sur `team_members` scopee par id : le repo NE supprime PAS lui-meme dans
    `tasks` / `task_assignees` (il s'appuie sur la cascade FK cote base).
    """
    fake = _install(monkeypatch, lambda chain: [{"id": MEMBER_ID}])

    assert team_members_repo.delete_team_member_record(MEMBER_ID) is True

    deletes = [c for c in fake.calls if c["op"] == "delete"]
    assert len(deletes) == 1
    assert deletes[0]["table"] == "team_members"
    assert ("id", MEMBER_ID) in deletes[0]["filters"]
    # Aucune suppression applicative de taches / d'assignations (cascade = affaire DB).
    assert not any(
        c["op"] == "delete" and c["table"] in {"tasks", "task_assignees"}
        for c in fake.calls
    )


def test_delete_returns_false_when_no_row_matches(monkeypatch):
    """GIVEN un id inexistant WHEN on supprime THEN False (-> 404)."""
    _install(monkeypatch, lambda chain: [])
    assert team_members_repo.delete_team_member_record("inconnu") is False


def test_delete_degrades_to_false_when_offline(monkeypatch):
    """GIVEN la base injoignable WHEN on supprime THEN False (mode degrade)."""
    _install(monkeypatch, _raise_offline)
    assert team_members_repo.delete_team_member_record(MEMBER_ID) is False


# ===========================================================================
# INTEGRATION @requires_db — CASCADE strictement POSTGRES (skippe par defaut)
# ===========================================================================
@requires_db
def test_integration_delete_member_cascades_assignees_without_deleting_tasks():
    """GIVEN une tache dont une personne est responsable WHEN on supprime la personne
    THEN la ligne `task_assignees` correspondante disparait par CASCADE (aucun orphelin)
    ET la tache N'EST PAS supprimee (les autres responsables eventuels restent).

    Verifie en interrogeant DIRECTEMENT les tables par id — seule facon honnete de
    prouver l'integrite referentielle (cascade FK, pas code applicatif).
    """
    client = team_members_repo.get_supabase_client()
    member = (
        client.table("team_members")
        .insert({"first_name": "Cascade", "last_name": "Test"})
        .execute()
        .data[0]
    )
    member_id = member["id"]
    task = (
        client.table("tasks")
        .insert({"titre": "Tache avec responsable", "priorite": "low"})
        .execute()
        .data[0]
    )
    task_id = task["id"]
    try:
        client.table("task_assignees").insert(
            {"task_id": task_id, "user_id": member_id}
        ).execute()

        # Suppression de la personne -> cascade sur task_assignees.
        team_members_repo.delete_team_member_record(member_id)

        # Plus aucune assignation orpheline pour cette personne.
        orphans = (
            client.table("task_assignees")
            .select("task_id")
            .eq("user_id", member_id)
            .execute()
            .data
        )
        assert orphans == []
        # La tache existe toujours (aucune tache supprimee).
        still_there = (
            client.table("tasks").select("id").eq("id", task_id).execute().data
        )
        assert still_there and still_there[0]["id"] == task_id
    finally:
        client.table("tasks").delete().eq("id", task_id).execute()
        client.table("team_members").delete().eq("id", member_id).execute()
