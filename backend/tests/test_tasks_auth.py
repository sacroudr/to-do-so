"""Controle d'acces des endpoints Taches / Projets (requirements.md §4.6).

Critere d'acceptation couvert (§4.6) :
  « Ces filtres s'appliquent [...] » suppose des endpoints proteges. La consigne
  ajoute explicitement : « Acces refuse sans authentification valide ». On verifie
  donc que TOUT acces aux donnees exige un JWT Supabase valide (signature, audience,
  expiration), conformement au flux d'auth (§6.2 / §8).

Format BDD de chaque cas : GIVEN (contexte / en-tetes) - WHEN (appel) - THEN (statut).

Ces tests sont RUNNABLE des maintenant : ils ne dependent pas de la base (les routes
protegees echouent AVANT tout acces donnees quand le token est absent/invalide).
"""
from __future__ import annotations

import pytest

# Endpoints proteges EXISTANTS a ce stade du scaffold.
PROTECTED_GET_ENDPOINTS = [
    "/api/v1/tasks",
    "/api/v1/projects",
    "/api/v1/profiles/me",
]


# ---------------------------------------------------------------------------
# Scenario : acces refuse sans authentification (§4.6)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("path", PROTECTED_GET_ENDPOINTS)
def test_should_return_401_when_no_authorization_header(client, path):
    """GIVEN aucun en-tete Authorization
    WHEN on appelle un endpoint protege
    THEN la reponse est 401 avec le code d'erreur uniforme.
    """
    # WHEN
    response = client.get(path)

    # THEN
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_return_401_when_creating_task_without_token(client):
    """GIVEN aucun token
    WHEN on tente de creer une tache (POST /tasks)
    THEN 401 (aucune ecriture possible sans authentification).
    """
    response = client.post("/api/v1/tasks", json={"titre": "Sans auth"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


# ---------------------------------------------------------------------------
# Scenario : acces refuse avec un token INVALIDE (§4.6 / §6.2)
# ---------------------------------------------------------------------------
def test_should_return_401_when_signature_is_invalid(client, bad_signature_headers):
    """GIVEN un JWT signe avec un mauvais secret
    WHEN on appelle /tasks
    THEN 401 (signature rejetee).
    """
    response = client.get("/api/v1/tasks", headers=bad_signature_headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_should_return_401_when_token_is_expired(client, expired_headers):
    """GIVEN un JWT expire
    WHEN on appelle /tasks
    THEN 401 (expiration controlee).
    """
    response = client.get("/api/v1/tasks", headers=expired_headers)
    assert response.status_code == 401


def test_should_return_401_when_audience_is_wrong(client, wrong_audience_headers):
    """GIVEN un JWT dont l'audience n'est pas `authenticated`
    WHEN on appelle /tasks
    THEN 401 (audience controlee).
    """
    response = client.get("/api/v1/tasks", headers=wrong_audience_headers)
    assert response.status_code == 401


def test_should_return_401_when_bearer_is_malformed(client):
    """GIVEN un en-tete Authorization sans schema Bearer exploitable
    WHEN on appelle /tasks
    THEN 401.
    """
    response = client.get("/api/v1/tasks", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Scenario : acces AUTORISE avec un JWT valide (chemin nominal)
# ---------------------------------------------------------------------------
def test_should_return_200_list_when_token_is_valid(client, auth_headers):
    """GIVEN un JWT valide (utilisateur connu de l'equipe)
    WHEN on appelle GET /tasks
    THEN 200 et le corps est une liste (JSON array).
    """
    response = client.get("/api/v1/tasks", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_should_expose_current_user_when_token_is_valid(client, auth_headers):
    """GIVEN un JWT valide
    WHEN on appelle GET /profiles/me
    THEN 200 et l'id correspond au `sub` du token (derivation des claims).
    """
    from tests.conftest import TEST_USER_ID

    response = client.get("/api/v1/profiles/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == TEST_USER_ID
