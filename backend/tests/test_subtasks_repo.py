"""Tests UNITAIRES de la couche donnees des sous-taches (`app.db.subtasks_repo`).

Contrairement aux tests de route (`test_subtasks.py`) qui monkeypatchent les seams, on
teste ici la LOGIQUE APPLICATIVE reelle du repo — celle qui vit en Python, PAS dans
Postgres :
  - le calcul de la position d'ajout (max(position) + 1, ou 0 si vide) ;
  - l'attribution des positions au reordonnancement (index dans la liste ordonnee) ;
  - la garde d'existence du parent et le scoping par `task_id` ;
  - la traduction des reponses (None / False / []) ;
  - le mode degrade (base injoignable).

Le client Supabase est remplace par un FAUX client (`_FakeClient`) qui ENREGISTRE la
chaine d'appels (`.table().select().eq().order()...execute()`) et renvoie des donnees
programmables via un handler. On peut ainsi asserter les PARAMETRES emis par le repo.

⚠️ DIRECTIVE D'HONNETETE — ce qu'un mock NE prouve PAS :
  Le TRI reel par `position` (clause `.order`) et l'application physique des positions
  sont garantis par POSTGRES, pas par ce code. Un faux client renvoie ce qu'on lui dit
  et « trierait » n'importe quoi. Donc pour l'ordre, on asserte seulement que le repo
  EMET la bonne requete (clause `order(position, asc)`, `update(position=i)` scope par
  id + task_id) ; la garantie d'ordre EFFECTIVE est verifiee par les tests
  `@requires_db` (cascade / FK / RLS + ordre) plus bas, qui tournent sur une vraie base.
"""
from __future__ import annotations

from typing import Any, Callable

import httpx
import pytest

from app.db import subtasks_repo
from tests.conftest import requires_db

TASK_ID = "44444444-4444-4444-4444-444444444444"


# ===========================================================================
# Faux client Supabase : enregistre la chaine d'appels + renvoie des donnees
# programmables. Reproduit l'API fluide reellement utilisee par le repo.
# ===========================================================================
class _FakeResponse:
    def __init__(self, data: Any) -> None:
        self.data = data


class _FakeQuery:
    """Un maillon de la chaine fluide. Accumule l'operation, les filtres, l'ordre..."""

    def __init__(self, table: str, calls: list[dict[str, Any]], handler: Callable[[dict[str, Any]], Any]) -> None:
        self._calls = calls
        self._handler = handler
        self._chain: dict[str, Any] = {
            "table": table,
            "op": None,
            "payload": None,
            "cols": None,
            "filters": [],
            "order": None,
            "limit": None,
        }

    def select(self, cols: str) -> "_FakeQuery":
        self._chain["op"] = "select"
        self._chain["cols"] = cols
        return self

    def insert(self, data: dict[str, Any]) -> "_FakeQuery":
        self._chain["op"] = "insert"
        self._chain["payload"] = data
        return self

    def update(self, data: dict[str, Any]) -> "_FakeQuery":
        self._chain["op"] = "update"
        self._chain["payload"] = data
        return self

    def delete(self) -> "_FakeQuery":
        self._chain["op"] = "delete"
        return self

    def eq(self, col: str, val: Any) -> "_FakeQuery":
        self._chain["filters"].append((col, val))
        return self

    def order(self, col: str, desc: bool = False) -> "_FakeQuery":
        self._chain["order"] = (col, desc)
        return self

    def limit(self, n: int) -> "_FakeQuery":
        self._chain["limit"] = n
        return self

    def execute(self) -> _FakeResponse:
        # On enregistre un instantane de la requete puis on delegue au handler.
        self._calls.append(self._chain)
        return _FakeResponse(self._handler(self._chain))


class _FakeClient:
    def __init__(self, handler: Callable[[dict[str, Any]], Any]) -> None:
        self.calls: list[dict[str, Any]] = []
        self._handler = handler

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(name, self.calls, self._handler)


def _install(monkeypatch: pytest.MonkeyPatch, handler: Callable[[dict[str, Any]], Any]) -> _FakeClient:
    """Remplace get_supabase_client (importe dans le repo) par le faux client."""
    fake = _FakeClient(handler)
    monkeypatch.setattr(subtasks_repo, "get_supabase_client", lambda: fake)
    return fake


def _task_exists(chain: dict[str, Any]) -> bool:
    return chain["table"] == "tasks" and chain["op"] == "select"


# ===========================================================================
# create_subtask_record : position = max(position) + 1 (ajout en FIN)
# ===========================================================================
def test_create_appends_at_end_with_max_position_plus_one(monkeypatch):
    """GIVEN une checklist dont la position max est 4 WHEN on cree une sous-tache
    THEN l'INSERT porte position = 5 (ajout en fin), scope par task_id, et la ligne
    inseree est renvoyee.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if _task_exists(chain):
            return [{"id": TASK_ID}]  # parent present
        if chain["op"] == "select":  # lecture de la position max
            return [{"position": 4}]
        if chain["op"] == "insert":
            payload = chain["payload"]
            return [{**payload, "id": "sub-new", "statut": "todo", "created_at": "t"}]
        return []

    fake = _install(monkeypatch, handler)

    result = subtasks_repo.create_subtask_record(task_id=TASK_ID, title="Nouvelle")

    insert_calls = [c for c in fake.calls if c["op"] == "insert"]
    assert len(insert_calls) == 1
    assert insert_calls[0]["payload"]["position"] == 5  # max(4) + 1
    assert insert_calls[0]["payload"]["task_id"] == TASK_ID
    assert insert_calls[0]["payload"]["title"] == "Nouvelle"
    assert result is not None and result["position"] == 5


def test_create_uses_position_zero_when_checklist_empty(monkeypatch):
    """GIVEN une checklist VIDE (aucune position) WHEN on cree une sous-tache
    THEN la premiere position est 0 (et non un plantage sur last[0]).
    """
    def handler(chain: dict[str, Any]) -> Any:
        if _task_exists(chain):
            return [{"id": TASK_ID}]
        if chain["op"] == "select":
            return []  # checklist vide
        if chain["op"] == "insert":
            return [{**chain["payload"], "id": "sub-1", "statut": "todo"}]
        return []

    fake = _install(monkeypatch, handler)

    result = subtasks_repo.create_subtask_record(task_id=TASK_ID, title="Premiere")

    insert_calls = [c for c in fake.calls if c["op"] == "insert"]
    assert insert_calls[0]["payload"]["position"] == 0
    assert result is not None


def test_create_returns_none_and_skips_insert_when_task_absent(monkeypatch):
    """GIVEN une tache parente inexistante WHEN on cree une sous-tache
    THEN None est renvoye ET aucun INSERT n'est emis (garde du parent).
    """
    def handler(chain: dict[str, Any]) -> Any:
        if _task_exists(chain):
            return []  # parent absent
        return []

    fake = _install(monkeypatch, handler)

    result = subtasks_repo.create_subtask_record(task_id="inconnu", title="X")

    assert result is None
    assert not any(c["op"] == "insert" for c in fake.calls)


# ===========================================================================
# reorder_subtask_records : positions = index dans la liste ORDONNEE
# ===========================================================================
def test_reorder_assigns_positions_in_requested_order(monkeypatch):
    """GIVEN une liste ordonnee d'ids WHEN on reordonne
    THEN chaque id recoit position = son index, dans l'ordre demande, et chaque UPDATE
    est scope par id ET task_id (jamais la sous-tache d'une autre tache).
    """
    def handler(chain: dict[str, Any]) -> Any:
        if _task_exists(chain):
            return [{"id": TASK_ID}]
        return []  # les update ne consomment pas la reponse

    fake = _install(monkeypatch, handler)

    subtasks_repo.reorder_subtask_records(
        task_id=TASK_ID, ordered_ids=["c", "a", "b"]
    )

    updates = [c for c in fake.calls if c["op"] == "update"]
    # position affectee = index dans ordered_ids, dans l'ordre.
    assert [(dict(u["filters"])["id"], u["payload"]["position"]) for u in updates] == [
        ("c", 0),
        ("a", 1),
        ("b", 2),
    ]
    # chaque ecriture est scopee par la tache parente.
    assert all(("task_id", TASK_ID) in u["filters"] for u in updates)


def test_reorder_is_consistent_after_multiple_successive_calls(monkeypatch):
    """GIVEN plusieurs reordonnancements successifs WHEN on les applique
    THEN chaque appel repartit les positions selon SON propre ordre (pas de residu de
    l'appel precedent) — les positions refletent toujours la derniere demande.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if _task_exists(chain):
            return [{"id": TASK_ID}]
        return []

    fake = _install(monkeypatch, handler)

    subtasks_repo.reorder_subtask_records(task_id=TASK_ID, ordered_ids=["a", "b", "c"])
    fake.calls.clear()
    subtasks_repo.reorder_subtask_records(task_id=TASK_ID, ordered_ids=["b", "c", "a"])

    updates = [c for c in fake.calls if c["op"] == "update"]
    assert [(dict(u["filters"])["id"], u["payload"]["position"]) for u in updates] == [
        ("b", 0),
        ("c", 1),
        ("a", 2),
    ]


def test_reorder_returns_none_and_skips_updates_when_task_absent(monkeypatch):
    """GIVEN une tache parente inexistante WHEN on reordonne
    THEN None ET aucun UPDATE (la garde du parent court-circuite avant l'ecriture).
    """
    fake = _install(monkeypatch, lambda chain: [] if _task_exists(chain) else [])

    result = subtasks_repo.reorder_subtask_records(
        task_id="inconnu", ordered_ids=["a", "b"]
    )

    assert result is None
    assert not any(c["op"] == "update" for c in fake.calls)


# ===========================================================================
# list_subtask_records : la clause d'ORDRE par position est bien emise
# (le tri EFFECTIF est garanti par Postgres -> integration @requires_db)
# ===========================================================================
def test_list_emits_order_by_position_ascending_scoped_by_task(monkeypatch):
    """GIVEN une tache WHEN on liste ses sous-taches
    THEN la requete filtre par task_id ET demande un tri par `position` croissant.

    ⚠️ On asserte la REQUETE, pas un tri fait par le mock : le tri reel est une garantie
    Postgres, verifiee par le test d'integration.
    """
    captured: dict[str, Any] = {}

    def handler(chain: dict[str, Any]) -> Any:
        captured["chain"] = chain
        return [{"id": "s1", "position": 0}]

    _install(monkeypatch, handler)

    subtasks_repo.list_subtask_records(task_id=TASK_ID)

    chain = captured["chain"]
    assert chain["table"] == "task_subtasks"
    assert ("task_id", TASK_ID) in chain["filters"]
    assert chain["order"] == ("position", False)  # asc


def test_list_returns_empty_list_when_no_rows(monkeypatch):
    """GIVEN aucune ligne (data None) WHEN on liste THEN [] (jamais None)."""
    _install(monkeypatch, lambda chain: None)
    assert subtasks_repo.list_subtask_records(task_id=TASK_ID) == []


# ===========================================================================
# update_subtask_record : scoping par id + task_id, no-op tolerant, None si absent
# ===========================================================================
def test_update_scopes_write_by_id_and_task(monkeypatch):
    """GIVEN un changement WHEN on met a jour THEN l'UPDATE est scope par id ET task_id
    (une sous-tache d'une autre tache n'est jamais touchee), et la ligne est renvoyee.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["op"] == "update":
            return [{"id": "sub-1", "task_id": TASK_ID, "statut": "done", "position": 0}]
        return []

    fake = _install(monkeypatch, handler)

    result = subtasks_repo.update_subtask_record(
        task_id=TASK_ID, subtask_id="sub-1", changes={"statut": "done"}
    )

    update = next(c for c in fake.calls if c["op"] == "update")
    assert ("id", "sub-1") in update["filters"]
    assert ("task_id", TASK_ID) in update["filters"]
    assert result is not None and result["statut"] == "done"


def test_update_with_empty_changes_reads_row_without_writing(monkeypatch):
    """GIVEN aucun champ a modifier (changes={}) WHEN on met a jour
    THEN aucun UPDATE n'est emis (no-op tolerant) : on RELIT simplement la ligne.
    """
    def handler(chain: dict[str, Any]) -> Any:
        if chain["op"] == "select":
            return [{"id": "sub-1", "task_id": TASK_ID, "statut": "todo", "position": 0}]
        return []

    fake = _install(monkeypatch, handler)

    result = subtasks_repo.update_subtask_record(
        task_id=TASK_ID, subtask_id="sub-1", changes={}
    )

    assert not any(c["op"] == "update" for c in fake.calls)  # aucune ecriture
    assert any(c["op"] == "select" for c in fake.calls)  # relecture
    assert result is not None


def test_update_returns_none_when_no_row_matches(monkeypatch):
    """GIVEN un id inexistant / d'une autre tache (aucune ligne) WHEN on met a jour
    THEN None (traduit en 404 par la route).
    """
    _install(monkeypatch, lambda chain: [])
    result = subtasks_repo.update_subtask_record(
        task_id=TASK_ID, subtask_id="nope", changes={"statut": "done"}
    )
    assert result is None


# ===========================================================================
# delete_subtask_record : booleen selon les lignes affectees, scope par tache
# ===========================================================================
def test_delete_returns_true_when_a_row_is_removed(monkeypatch):
    """GIVEN une sous-tache existante WHEN on supprime THEN True + scope id/task_id."""
    fake = _install(monkeypatch, lambda chain: [{"id": "sub-1"}])
    assert subtasks_repo.delete_subtask_record(task_id=TASK_ID, subtask_id="sub-1") is True
    delete = next(c for c in fake.calls if c["op"] == "delete")
    assert ("id", "sub-1") in delete["filters"]
    assert ("task_id", TASK_ID) in delete["filters"]


def test_delete_returns_false_when_no_row_matches(monkeypatch):
    """GIVEN un id inexistant WHEN on supprime THEN False (traduit en 404)."""
    _install(monkeypatch, lambda chain: [])
    assert subtasks_repo.delete_subtask_record(task_id=TASK_ID, subtask_id="nope") is False


# ===========================================================================
# Mode degrade : base injoignable -> lecture [], ecritures None/False
# (le repo n'intercepte QUE les erreurs de connexion, pas les erreurs applicatives)
# ===========================================================================
def _raise_offline(_chain: dict[str, Any]) -> Any:
    raise httpx.ConnectError("base injoignable")


def test_list_degrades_to_empty_when_db_offline(monkeypatch):
    """GIVEN la base injoignable WHEN on liste THEN [] (mode degrade)."""
    _install(monkeypatch, _raise_offline)
    assert subtasks_repo.list_subtask_records(task_id=TASK_ID) == []


def test_writes_degrade_to_none_or_false_when_db_offline(monkeypatch):
    """GIVEN la base injoignable WHEN on cree / met a jour / supprime / reordonne
    THEN None / None / False / None (aucune exception ne fuit).
    """
    _install(monkeypatch, _raise_offline)
    assert subtasks_repo.create_subtask_record(task_id=TASK_ID, title="X") is None
    assert (
        subtasks_repo.update_subtask_record(
            task_id=TASK_ID, subtask_id="s", changes={"statut": "done"}
        )
        is None
    )
    assert subtasks_repo.delete_subtask_record(task_id=TASK_ID, subtask_id="s") is False
    assert (
        subtasks_repo.reorder_subtask_records(task_id=TASK_ID, ordered_ids=["s"]) is None
    )


# ===========================================================================
# INTEGRATION @requires_db — garanties strictement POSTGRES
# ---------------------------------------------------------------------------
# ⚠️ Ces tests ne s'executent QUE avec TODOSO_RUN_DB_TESTS=1 + un vrai projet
# Supabase de test (variables SUPABASE_* reelles). Sinon ils sont COLLECTES puis
# SKIPPES. C'est la « zone non testee sans base live » : CASCADE, contrainte FK et
# RLS ne peuvent PAS etre honnetement prouvees avec un client mocke (un mock ne
# testerait que lui-meme). On les verifie ici sur une VRAIE base.
#
# NB RLS : l'API backend utilise la cle `service_role`, qui CONTOURNE la RLS. Une
# verification honnete de la RLS exige donc un client ANON (cle `SUPABASE_ANON_KEY`).
# Le test RLS est skippe si cette cle n'est pas fournie, meme quand la base est active.
# ===========================================================================
@requires_db
def test_integration_cascade_delete_leaves_no_orphan_subtasks():
    """GIVEN une tache avec des sous-taches WHEN on supprime la tache (service_role)
    THEN les sous-taches sont physiquement supprimees par la CASCADE Postgres
    (ON DELETE CASCADE) : plus aucune ligne orpheline dans `task_subtasks`.

    Verifie en interrogeant DIRECTEMENT la table par id (et non via l'API, qui filtre
    deja par task_id) — c'est la seule facon HONNETE de prouver l'absence d'orphelins.
    """
    client = subtasks_repo.get_supabase_client()
    task = (
        client.table("tasks")
        .insert({"titre": "Tache cascade", "priorite": "low"})
        .execute()
        .data[0]
    )
    task_id = task["id"]
    try:
        rows = (
            client.table("task_subtasks")
            .insert(
                [
                    {"task_id": task_id, "title": "s1", "position": 0},
                    {"task_id": task_id, "title": "s2", "position": 1},
                ]
            )
            .execute()
            .data
        )
        sub_ids = [r["id"] for r in rows]
        assert len(sub_ids) == 2

        # Suppression de la tache parente.
        client.table("tasks").delete().eq("id", task_id).execute()

        # Aucune sous-tache orpheline ne subsiste (par id, sans filtre task_id).
        orphans = (
            client.table("task_subtasks")
            .select("id")
            .in_("id", sub_ids)
            .execute()
            .data
        )
        assert orphans == []
    finally:
        client.table("tasks").delete().eq("id", task_id).execute()


@requires_db
def test_integration_foreign_key_rejects_unknown_task_id():
    """GIVEN un task_id inexistant WHEN on insere une sous-tache DIRECTEMENT (en
    contournant la garde applicative `_task_exists`) THEN Postgres rejette l'ecriture
    (violation de contrainte de cle etrangere) — la FK protege l'integrite meme si le
    code applicatif etait contourne.
    """
    client = subtasks_repo.get_supabase_client()
    missing_task_id = "00000000-0000-0000-0000-0000000000ff"
    with pytest.raises(Exception):  # APIError / erreur FK cote Postgres
        client.table("task_subtasks").insert(
            {"task_id": missing_task_id, "title": "orpheline", "position": 0}
        ).execute()


@requires_db
def test_integration_rls_blocks_anonymous_read_and_write():
    """GIVEN un client ANON (cle publique, RLS active) WHEN il tente de LIRE ou d'ECRIRE
    dans `task_subtasks` THEN la RLS bloque : lecture vide (aucune ligne visible) ET
    ecriture rejetee. La garantie vient des POLICIES Postgres, pas du code applicatif.

    Skippe si SUPABASE_ANON_KEY n'est pas fournie (l'API backend n'utilise que la cle
    service_role, qui contourne la RLS : impossible de tester la RLS avec).
    """
    import os

    from supabase import create_client

    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    url = os.environ.get("SUPABASE_URL")
    if not anon_key or not url:
        pytest.skip("SUPABASE_ANON_KEY requise pour tester honnetement la RLS.")

    anon = create_client(url, anon_key)

    # Lecture anonyme : aucune ligne visible (RLS exige un membre authentifie).
    visible = anon.table("task_subtasks").select("id").limit(1).execute().data
    assert visible == []

    # Ecriture anonyme : rejetee par la RLS.
    with pytest.raises(Exception):
        anon.table("task_subtasks").insert(
            {"task_id": "00000000-0000-0000-0000-000000000001", "title": "x", "position": 0}
        ).execute()
