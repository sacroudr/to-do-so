"""Test unitaire du health check + verification de la garde JWT.

Exemple minimal montrant :
  - un endpoint public accessible sans token,
  - une route protegee qui renvoie 401 sans Authorization Bearer.
"""


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_requires_token(client):
    # /api/v1/profiles/me exige un JWT : sans header -> 401.
    response = client.get("/api/v1/profiles/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"
