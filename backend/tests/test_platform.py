"""Comportements transverses : santé, erreurs, en-têtes, CSRF, courriels, seed."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BusinessHour, Service, User
from app.services.email import format_local_datetime, format_price, mask_email


@pytest.mark.parametrize(
    "url",
    [
        "postgres://u:p@host:5432/db",
        "postgresql://u:p@host:5432/db",
        "postgresql+psycopg://u:p@host:5432/db",
    ],
)
def test_database_url_from_hosting_providers_uses_psycopg(url: str) -> None:
    from app.config import Settings

    settings = Settings(database_url=url, jwt_secret="x" * 32)
    assert settings.database_url == "postgresql+psycopg://u:p@host:5432/db"


def test_health_checks_database(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200 and res.json() == {"status": "ok"}


def test_security_headers_are_present(client: TestClient) -> None:
    res = client.get("/api/v1/services")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"]


def test_unknown_route_uses_error_format(client: TestClient) -> None:
    res = client.get("/api/v1/nope")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_foreign_origin_cannot_modify_data(client: TestClient) -> None:
    res = client.post("/api/v1/auth/logout", headers={"Origin": "https://site-malveillant.example"})
    assert res.status_code == 403
    ok = client.post("/api/v1/auth/logout", headers={"Origin": "http://localhost:3000"})
    assert ok.status_code == 204


def test_cors_allows_only_the_frontend(client: TestClient) -> None:
    allowed = client.options(
        "/api/v1/services",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    denied = client.options(
        "/api/v1/services",
        headers={"Origin": "https://autre.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in denied.headers


def test_openapi_documents_the_21_endpoints(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    operations = {
        (method.upper(), path)
        for path, item in paths.items()
        for method in item
        if path.startswith("/api/v1")
    }
    expected = {
        ("POST", "/api/v1/auth/register"),
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/auth/logout"),
        ("POST", "/api/v1/auth/forgot-password"),
        ("POST", "/api/v1/auth/reset-password"),
        ("GET", "/api/v1/users/me"),
        ("PATCH", "/api/v1/users/me"),
        ("GET", "/api/v1/services"),
        ("POST", "/api/v1/services"),
        ("PATCH", "/api/v1/services/{service_id}"),
        ("GET", "/api/v1/availability"),
        ("POST", "/api/v1/bookings"),
        ("GET", "/api/v1/bookings/me"),
        ("POST", "/api/v1/bookings/{booking_id}/cancel"),
        ("GET", "/api/v1/admin/bookings"),
        ("POST", "/api/v1/admin/bookings/{booking_id}/cancel"),
        ("GET", "/api/v1/admin/business-hours"),
        ("PUT", "/api/v1/admin/business-hours"),
        ("GET", "/api/v1/admin/time-off"),
        ("POST", "/api/v1/admin/time-off"),
        ("DELETE", "/api/v1/admin/time-off/{time_off_id}"),
    }
    assert expected <= operations
    # + DELETE /users/me (droit à l'effacement, Loi 25)
    assert operations - expected == {("DELETE", "/api/v1/users/me")}


def test_email_formatting_helpers() -> None:
    summer = datetime(2026, 7, 6, 13, 5, tzinfo=UTC)  # 9 h 05 à Toronto (UTC-4)
    assert format_local_datetime(summer) == "lundi 6 juillet 2026 à 9 h 05"
    assert format_price(6500) == "65,00 $"
    assert format_price(123456) == "1 234,56 $"
    assert mask_email("alex@exemple.com") == "a***@exemple.com"
    assert mask_email("invalide") == "***"


def test_real_email_sender_uses_resend_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import email as email_service
    from tests.conftest import REAL_SEND_EMAIL

    calls: list[dict] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

    def fake_post(url: str, **kwargs: object) -> FakeResponse:
        calls.append({"url": url, **kwargs})
        return FakeResponse()

    monkeypatch.setattr(email_service.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    REAL_SEND_EMAIL("alex@exemple.com", "Sujet", "<p>Bonjour</p>", "Bonjour")
    assert calls[0]["url"] == "https://api.resend.com/emails"
    assert calls[0]["json"]["to"] == ["alex@exemple.com"]  # type: ignore[index]


def test_real_email_sender_uses_smtp_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    import smtplib

    from tests.conftest import REAL_SEND_EMAIL

    sent: list[object] = []

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            pass

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def send_message(self, message: object) -> None:
            sent.append(message)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    REAL_SEND_EMAIL("alex@exemple.com", "Sujet", "<p>Bonjour</p>", "Bonjour")
    assert len(sent) == 1


def test_seed_is_idempotent(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings
    from scripts.seed import seed

    monkeypatch.setattr(settings, "admin_password", "Admin-Seed-2026")
    monkeypatch.setattr(settings, "demo_client_email", "")
    seed()
    seed()
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(func.count()).select_from(Service)) == 3
    assert db.scalar(select(func.count()).select_from(BusinessHour)) == 10
    admin = db.scalar(select(User))
    assert admin is not None and admin.is_admin
