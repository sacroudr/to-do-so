"""Faux client Supabase mutualise pour les tests UNITAIRES de la couche donnees (repos).

Reproduit l'API fluide reellement utilisee par les repos —
`client.table(name).select().insert().update().delete().eq().in_().order().limit().execute()`
et `client.storage.from_(bucket).remove([...])` — en ENREGISTRANT la chaine d'appels dans
une seule liste `calls`. On peut ainsi asserter les PARAMETRES emis (op, table, filtres,
`in`, ordre, payload) ET l'ORDRE des operations (ex. purge Storage AVANT suppression DB).

⚠️ DIRECTIVE D'HONNETETE — ce qu'un mock NE prouve PAS : un faux client renvoie ce qu'on
lui dit. Les garanties strictement POSTGRES (CASCADE ON DELETE, contraintes FK, RLS, tri
physique) ne peuvent PAS etre prouvees ici — elles le sont par les tests `@requires_db`
sur une VRAIE base. Ces fakes servent uniquement a verifier que le repo EMET la bonne
sequence de requetes.
"""
from __future__ import annotations

from typing import Any, Callable

Handler = Callable[[dict[str, Any]], Any]


class FakeResponse:
    def __init__(self, data: Any) -> None:
        self.data = data


class FakeQuery:
    """Un maillon de la chaine fluide : accumule op / colonnes / payload / filtres."""

    def __init__(self, table: str, calls: list[dict[str, Any]], handler: Handler) -> None:
        self._calls = calls
        self._handler = handler
        self._chain: dict[str, Any] = {
            "table": table,
            "op": None,
            "payload": None,
            "cols": None,
            "filters": [],
            "in": [],
            "order": None,
            "limit": None,
        }

    def select(self, cols: str) -> "FakeQuery":
        self._chain["op"] = "select"
        self._chain["cols"] = cols
        return self

    def insert(self, data: Any) -> "FakeQuery":
        self._chain["op"] = "insert"
        self._chain["payload"] = data
        return self

    def update(self, data: Any) -> "FakeQuery":
        self._chain["op"] = "update"
        self._chain["payload"] = data
        return self

    def delete(self) -> "FakeQuery":
        self._chain["op"] = "delete"
        return self

    def eq(self, col: str, val: Any) -> "FakeQuery":
        self._chain["filters"].append((col, val))
        return self

    def in_(self, col: str, vals: list[Any]) -> "FakeQuery":
        self._chain["in"].append((col, list(vals)))
        return self

    def order(self, col: str, desc: bool = False) -> "FakeQuery":
        self._chain["order"] = (col, desc)
        return self

    def limit(self, n: int) -> "FakeQuery":
        self._chain["limit"] = n
        return self

    def execute(self) -> FakeResponse:
        self._calls.append(self._chain)
        return FakeResponse(self._handler(self._chain))


class FakeBucket:
    """Faux bucket Storage : enregistre `remove([...])` dans la meme liste d'appels."""

    def __init__(self, name: str, calls: list[dict[str, Any]]) -> None:
        self._name = name
        self._calls = calls

    def remove(self, paths: list[str]) -> dict[str, Any]:
        self._calls.append(
            {"table": None, "op": "storage.remove", "bucket": self._name, "paths": list(paths)}
        )
        return {"data": [], "error": None}


class FakeStorage:
    def __init__(self, calls: list[dict[str, Any]]) -> None:
        self._calls = calls

    def from_(self, bucket: str) -> FakeBucket:
        return FakeBucket(bucket, self._calls)


class FakeClient:
    """Faux client Supabase : `table()` (DB) + `storage` (objets) partagent `calls`."""

    def __init__(self, handler: Handler) -> None:
        self.calls: list[dict[str, Any]] = []
        self._handler = handler
        self.storage = FakeStorage(self.calls)

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.calls, self._handler)
