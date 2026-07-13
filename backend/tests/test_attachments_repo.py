"""Tests UNITAIRES de la couche donnees des pieces jointes
(`app.db.attachments_repo`, point 5 : suppression + helpers de cascade).

On teste la LOGIQUE APPLICATIVE reelle (celle qui vit en Python) avec un faux client
(`tests.fakes.FakeClient`) qui enregistre la sequence DB + Storage :

  - delete_attachment_record : lit le `storage_path` (scope tache + id) -> purge l'objet
    Storage -> supprime la ligne (scope tache + id), STRICTEMENT dans cet ORDRE (pas de
    fichier orphelin) ; False si introuvable, court-circuitant Storage et suppression ;
  - list_storage_paths_for_tasks : requete `in_(task_id, ...)`, filtre les chemins vides ;
  - remove_storage_objects : no-op si la liste est vide ;
  - mode degrade (base/Storage injoignable).

⚠️ DIRECTIVE D'HONNETETE — la suppression EFFECTIVE de l'objet dans le bucket et la
CASCADE FK ne sont pas prouvables par un mock ; ici on prouve la SEQUENCE emise.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.db import attachments_repo
from tests.fakes import FakeClient

TASK_ID = "44444444-4444-4444-4444-444444444444"
ATTACH_ID = "att-1"


def _install(monkeypatch, handler) -> FakeClient:
    fake = FakeClient(handler)
    monkeypatch.setattr(attachments_repo, "get_supabase_client", lambda: fake)
    return fake


# ===========================================================================
# delete_attachment_record
# ===========================================================================
def test_delete_reads_path_then_purges_storage_then_deletes_row(monkeypatch):
    """GIVEN une piece jointe existante WHEN on supprime THEN la sequence est :
    select storage_path -> Storage.remove([path]) -> delete ligne, dans cet ORDRE, chaque
    acces DB scope par id ET task_id, et True est renvoye.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["op"] == "select":
            return [{"storage_path": "44444444/x.pdf"}]
        if chain["op"] == "delete":
            return [{"id": ATTACH_ID}]
        return []

    fake = _install(monkeypatch, handler)

    assert (
        attachments_repo.delete_attachment_record(
            task_id=TASK_ID, attachment_id=ATTACH_ID
        )
        is True
    )

    ops = [(c["table"], c["op"]) for c in fake.calls]
    select_idx = ops.index(("task_attachments", "select"))
    remove_idx = ops.index((None, "storage.remove"))
    delete_idx = ops.index(("task_attachments", "delete"))
    assert select_idx < remove_idx < delete_idx

    remove = next(c for c in fake.calls if c["op"] == "storage.remove")
    assert remove["bucket"] == "task-attachments"
    assert remove["paths"] == ["44444444/x.pdf"]

    delete = next(c for c in fake.calls if c["op"] == "delete")
    assert ("id", ATTACH_ID) in delete["filters"]
    assert ("task_id", TASK_ID) in delete["filters"]


def test_delete_returns_false_and_skips_storage_when_absent(monkeypatch):
    """GIVEN un id inexistant / d'une autre tache (aucune ligne) WHEN on supprime THEN
    False, ET aucune purge Storage ni suppression DB n'est emise (court-circuit).
    """
    fake = _install(monkeypatch, lambda chain: [])

    assert (
        attachments_repo.delete_attachment_record(task_id=TASK_ID, attachment_id="nope")
        is False
    )
    assert not any(c["op"] == "storage.remove" for c in fake.calls)
    assert not any(c["op"] == "delete" for c in fake.calls)


def test_delete_degrades_to_false_when_offline(monkeypatch):
    """GIVEN la base/Storage injoignable WHEN on supprime THEN False (mode degrade)."""
    def handler(_chain: dict[str, Any]) -> Any:
        raise httpx.ConnectError("base injoignable")

    _install(monkeypatch, handler)
    assert (
        attachments_repo.delete_attachment_record(
            task_id=TASK_ID, attachment_id=ATTACH_ID
        )
        is False
    )


# ===========================================================================
# Helpers de cascade (reutilises par la suppression d'un projet, point 3)
# ===========================================================================
def test_list_storage_paths_uses_in_filter_and_drops_empty(monkeypatch):
    """GIVEN plusieurs taches WHEN on collecte les storage_path THEN la requete filtre par
    `in_(task_id, ...)` et les chemins vides / manquants sont ecartes.
    """
    def handler(chain: dict[str, Any]) -> Any:
        return [
            {"storage_path": "t1/a.pdf"},
            {"storage_path": None},
            {"storage_path": "t2/b.pdf"},
        ]

    fake = _install(monkeypatch, handler)
    client = attachments_repo.get_supabase_client()

    paths = attachments_repo.list_storage_paths_for_tasks(client, ["t1", "t2"])

    assert paths == ["t1/a.pdf", "t2/b.pdf"]
    select = next(c for c in fake.calls if c["op"] == "select")
    assert ("task_id", ["t1", "t2"]) in select["in"]


def test_list_storage_paths_returns_empty_without_tasks(monkeypatch):
    """GIVEN aucune tache WHEN on collecte les chemins THEN [] sans requete emise."""
    fake = _install(monkeypatch, lambda chain: [])
    client = attachments_repo.get_supabase_client()

    assert attachments_repo.list_storage_paths_for_tasks(client, []) == []
    assert fake.calls == []  # court-circuit : aucune requete inutile


def test_remove_storage_objects_noop_on_empty(monkeypatch):
    """GIVEN aucune chemin WHEN on purge le Storage THEN aucun appel `remove` n'est emis."""
    fake = _install(monkeypatch, lambda chain: [])
    client = attachments_repo.get_supabase_client()

    attachments_repo.remove_storage_objects(client, [])
    assert not any(c["op"] == "storage.remove" for c in fake.calls)
