"""Fixtures communes. Les tests utilisent une vraie base PostgreSQL séparée (suffixe _test)."""

import os
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, time
from pathlib import Path

# La base de test est choisie AVANT d'importer l'application (le moteur est créé à l'import).
_base_url = os.environ.get("DATABASE_URL", "postgresql+psycopg://rdv:rdv@localhost:5432/rdv")
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or (
    _base_url if _base_url.rsplit("/", 1)[1].endswith("_test") else _base_url + "_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-12")
os.environ["ENVIRONMENT"] = "test"
os.environ["FRONTEND_ORIGIN"] = "http://localhost:3000"
os.environ["ADMIN_EMAIL"] = "admin@exemple.com"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import BusinessHour, Service, User, UserRole  # noqa: E402
from app.routers.auth import forgot_limiter  # noqa: E402
from app.security import (  # noqa: E402
    create_access_token,
    get_now,
    hash_password,
    login_limiter,
)
from app.services import email as email_service  # noqa: E402

REAL_SEND_EMAIL = email_service.send_email

BACKEND_DIR = Path(__file__).resolve().parent.parent
TABLES = "password_reset_tokens, bookings, time_off, business_hours, services, users"

# « Maintenant » par défaut : lundi 2 novembre 2026, 8 h à Toronto (13 h UTC).
DEFAULT_NOW = datetime(2026, 11, 2, 13, 0, tzinfo=UTC)
PASSWORD = "Sup3r-Secret!"


def _ensure_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin_engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    """Recrée le schéma par les migrations au début de la session de tests."""
    _ensure_database()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("%", "%%"))
    command.upgrade(config, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_state() -> Iterator[None]:
    # Les tests de concurrence ouvrent plusieurs connexions : on vide les tables
    # plutôt que d'annuler une transaction unique.
    yield
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {TABLES} CASCADE"))
    login_limiter.reset()
    forgot_limiter.reset()
    app.dependency_overrides.clear()


@dataclass
class Clock:
    now: datetime = DEFAULT_NOW


@pytest.fixture
def clock() -> Clock:
    """Horloge injectée dans l'API : modifier clock.now pour simuler le temps qui passe."""
    c = Clock()
    app.dependency_overrides[get_now] = lambda: c.now
    return c


@dataclass
class SentEmail:
    to: str
    subject: str
    html: str
    text: str


@dataclass
class Outbox:
    messages: list[SentEmail] = field(default_factory=list)

    def to(self, address: str) -> list[SentEmail]:
        return [m for m in self.messages if m.to == address]

    def reset_token(self) -> str:
        match = re.search(r"token=([\w-]+)", self.messages[-1].text)
        assert match, "aucun lien de réinitialisation dans le dernier courriel"
        return match.group(1)


@pytest.fixture(autouse=True)
def outbox(monkeypatch: pytest.MonkeyPatch) -> Outbox:
    """Aucun courriel réel n'est envoyé pendant les tests : ils sont capturés ici."""
    box = Outbox()
    monkeypatch.setattr(
        email_service,
        "send_email",
        lambda to, subject, html, text: box.messages.append(SentEmail(to, subject, html, text)),
    )
    return box


@pytest.fixture
def db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client(clock: Clock) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def make_user(db: Session, email: str, role: UserRole = UserRole.CLIENT) -> User:
    user = User(
        email=email,
        password_hash=hash_password(PASSWORD),
        first_name="Alex",
        last_name="Tremblay",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user: User, issued_at: datetime | None = None) -> dict[str, str]:
    """Jeton Bearer émis à l'heure réelle (le JWT n'utilise pas l'horloge simulée)."""
    return {"Authorization": f"Bearer {create_access_token(user, issued_at)}"}


@pytest.fixture
def client_user(db: Session) -> User:
    return make_user(db, "alex@exemple.com")


@pytest.fixture
def other_user(db: Session) -> User:
    return make_user(db, "sam@exemple.com")


@pytest.fixture
def admin_user(db: Session) -> User:
    return make_user(db, "admin@exemple.com", UserRole.ADMIN)


@pytest.fixture
def client_headers(client_user: User) -> dict[str, str]:
    return auth_headers(client_user)


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    return auth_headers(admin_user)


@pytest.fixture
def service(db: Session) -> Service:
    svc = Service(name="Consultation 45 min", description="", duration_min=45, price_cents=6500)
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@pytest.fixture
def business_hours(db: Session) -> None:
    """Lundi au vendredi, 9 h à 12 h et 13 h à 17 h."""
    db.add_all(
        BusinessHour(weekday=d, start_time=s, end_time=e)
        for d in range(5)
        for s, e in ((time(9), time(12)), (time(13), time(17)))
    )
    db.commit()
