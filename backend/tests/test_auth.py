"""US-01, US-02, US-08 et profil (sections 3 et 9)."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.models import User
from app.security import utcnow
from tests.conftest import PASSWORD, Clock, Outbox, auth_headers

NEW_USER = {
    "email": "Nouveau@Exemple.com",
    "password": "Un-Bon-Mot-2026",
    "first_name": "Alex",
    "last_name": "Tremblay",
}


def test_register_creates_client_and_opens_session(client: TestClient) -> None:
    res = client.post("/api/v1/auth/register", json=NEW_USER)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "nouveau@exemple.com"
    assert body["role"] == "client"
    assert "password" not in body and "password_hash" not in body
    assert "access_token" in res.cookies
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie

    me = client.get("/api/v1/users/me")  # le cookie suffit
    assert me.status_code == 200 and me.json()["email"] == "nouveau@exemple.com"


def test_register_duplicate_email_returns_409(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=NEW_USER)
    res = client.post("/api/v1/auth/register", json={**NEW_USER, "email": "nouveau@exemple.com"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_EXISTS"


def test_register_validation(client: TestClient) -> None:
    short = client.post("/api/v1/auth/register", json={**NEW_USER, "password": "court"})
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "court" not in short.text  # la valeur saisie n'est jamais renvoyée

    trivial = client.post("/api/v1/auth/register", json={**NEW_USER, "password": "password123"})
    assert trivial.status_code == 422

    bad_email = client.post("/api/v1/auth/register", json={**NEW_USER, "email": "pas-un-courriel"})
    assert bad_email.status_code == 422


def test_register_cannot_request_admin_role(client: TestClient) -> None:
    res = client.post("/api/v1/auth/register", json={**NEW_USER, "role": "admin"})
    assert res.status_code == 422


def test_login_success_returns_token_and_cookie(client: TestClient, client_user: User) -> None:
    res = client.post(
        "/api/v1/auth/login", json={"email": "ALEX@exemple.com", "password": PASSWORD}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer" and body["expires_in"] == 3600
    assert body["access_token"] and body["user"]["email"] == "alex@exemple.com"
    assert res.cookies.get("access_token") == body["access_token"]


def test_wrong_password_and_unknown_email_give_identical_401(
    client: TestClient, client_user: User
) -> None:
    wrong = client.post(
        "/api/v1/auth/login", json={"email": "alex@exemple.com", "password": "x" * 9}
    )
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "nobody@exemple.com", "password": "x" * 9}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_sixth_login_attempt_in_15_minutes_returns_429(
    client: TestClient, client_user: User
) -> None:
    bad = {"email": "alex@exemple.com", "password": "mauvais-mdp"}
    for _ in range(5):
        assert client.post("/api/v1/auth/login", json=bad).status_code == 401
    res = client.post(
        "/api/v1/auth/login", json={"email": "alex@exemple.com", "password": PASSWORD}
    )
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "RATE_LIMITED"


def test_logout_clears_cookie(client: TestClient, client_user: User) -> None:
    client.post("/api/v1/auth/login", json={"email": "alex@exemple.com", "password": PASSWORD})
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 204
    assert client.get("/api/v1/users/me").status_code == 401


def test_me_requires_authentication(client: TestClient) -> None:
    res = client.get("/api/v1/users/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_expired_token_returns_401(client: TestClient, client_user: User) -> None:
    headers = auth_headers(client_user, utcnow() - timedelta(hours=2))
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_tampered_token_returns_401(client: TestClient) -> None:
    res = client.get("/api/v1/users/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert res.status_code == 401


def test_update_profile_and_password(client: TestClient, client_user: User) -> None:
    headers = auth_headers(client_user)
    res = client.patch("/api/v1/users/me", headers=headers, json={"first_name": " Sam "})
    assert res.status_code == 200 and res.json()["first_name"] == "Sam"

    no_current = client.patch(
        "/api/v1/users/me", headers=headers, json={"new_password": "Nouveau-2026!"}
    )
    assert no_current.status_code == 400

    ok = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": "Nouveau-2026!"},
    )
    assert ok.status_code == 200
    login = client.post(
        "/api/v1/auth/login", json={"email": "alex@exemple.com", "password": "Nouveau-2026!"}
    )
    assert login.status_code == 200


def test_forgot_password_is_uniform_and_sends_one_time_link(
    client: TestClient, client_user: User, outbox: Outbox, clock: Clock
) -> None:
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@exemple.com"})
    known = client.post("/api/v1/auth/forgot-password", json={"email": "alex@exemple.com"})
    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert len(outbox.messages) == 1 and outbox.messages[0].to == "alex@exemple.com"
    assert "/reinitialiser?token=" in outbox.messages[0].text

    token = outbox.reset_token()
    payload = {"token": token, "new_password": "Reinit-2026!"}
    assert client.post("/api/v1/auth/reset-password", json=payload).status_code == 200
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "alex@exemple.com", "password": "Reinit-2026!"}
        ).status_code
        == 200
    )

    reused = client.post(
        "/api/v1/auth/reset-password", json={**payload, "new_password": "Autre-2026!"}
    )
    assert reused.status_code == 400
    assert reused.json()["error"]["code"] == "TOKEN_INVALID"


def test_reset_token_expires_after_one_hour(
    client: TestClient, client_user: User, outbox: Outbox, clock: Clock
) -> None:
    client.post("/api/v1/auth/forgot-password", json={"email": "alex@exemple.com"})
    clock.now += timedelta(minutes=61)
    res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": outbox.reset_token(), "new_password": "Reinit-2026!"},
    )
    assert res.status_code == 400


def test_new_reset_link_invalidates_the_previous_one(
    client: TestClient, client_user: User, outbox: Outbox
) -> None:
    client.post("/api/v1/auth/forgot-password", json={"email": "alex@exemple.com"})
    first = outbox.reset_token()
    client.post("/api/v1/auth/forgot-password", json={"email": "alex@exemple.com"})
    res = client.post(
        "/api/v1/auth/reset-password", json={"token": first, "new_password": "Reinit-2026!"}
    )
    assert res.status_code == 400


def test_delete_account_anonymizes_user(client: TestClient, client_user: User) -> None:
    headers = auth_headers(client_user)
    assert client.delete("/api/v1/users/me", headers=headers).status_code == 204
    login = client.post(
        "/api/v1/auth/login", json={"email": "alex@exemple.com", "password": PASSWORD}
    )
    assert login.status_code == 401


def test_admin_account_cannot_be_deleted(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.delete("/api/v1/users/me", headers=admin_headers).status_code == 403
