"""US-04 à US-07 : créneaux, réservation sans doublon, annulation (sections 7 et 13)."""

import asyncio
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import app
from app.models import Booking, Service, TimeOff, User
from tests.conftest import REAL_SEND_EMAIL, Clock, Outbox, auth_headers

pytestmark = pytest.mark.usefixtures("business_hours")

# Mardi 10 novembre 2026 (heure normale de l'Est, UTC-5).
DAY = "2026-11-10"
SLOT_9H15 = "2026-11-10T09:15:00-05:00"
SLOT_9H15_UTC = "2026-11-10T14:15:00Z"


def availability(client: TestClient, service: Service, day: str = DAY) -> list[str]:
    res = client.get("/api/v1/availability", params={"service_id": str(service.id), "date": day})
    assert res.status_code == 200, res.text
    return res.json()["slots"]


def book(client: TestClient, service: Service, headers: dict[str, str], start: str = SLOT_9H15):
    return client.post(
        "/api/v1/bookings", headers=headers, json={"service_id": str(service.id), "start_at": start}
    )


def test_availability_returns_local_iso_slots(client: TestClient, service: Service) -> None:
    res = client.get("/api/v1/availability", params={"service_id": str(service.id), "date": DAY})
    body = res.json()
    assert body["date"] == DAY and body["duration_min"] == 45
    assert body["slots"][:3] == [
        "2026-11-10T09:00:00-05:00",
        "2026-11-10T09:15:00-05:00",
        "2026-11-10T09:30:00-05:00",
    ]


def test_weekend_has_no_slots(client: TestClient, service: Service) -> None:
    assert availability(client, service, "2026-11-14") == []


def test_inactive_service_is_not_bookable_or_listed(
    client: TestClient, db: Session, service: Service, client_headers: dict[str, str]
) -> None:
    service.is_active = False
    db.commit()
    res = client.get("/api/v1/availability", params={"service_id": str(service.id), "date": DAY})
    assert res.status_code == 404
    booked = book(client, service, client_headers)
    assert booked.status_code == 422
    assert booked.json()["error"]["code"] == "SLOT_INVALID"


def test_book_free_slot_returns_201_and_sends_emails(
    client: TestClient, service: Service, client_headers: dict[str, str], outbox: Outbox
) -> None:
    res = book(client, service, client_headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "confirmed"
    assert body["start_at"] == SLOT_9H15_UTC
    assert body["end_at"] == "2026-11-10T15:00:00Z"
    assert body["service"]["name"] == "Consultation 45 min"

    assert [m.to for m in outbox.messages] == ["alex@exemple.com", "admin@exemple.com"]
    assert "mardi 10 novembre 2026 à 9 h 15" in outbox.messages[0].text

    # Le créneau et ceux qui le chevauchent ne sont plus proposés.
    slots = availability(client, service)
    assert SLOT_9H15 not in slots and "2026-11-10T09:30:00-05:00" not in slots
    assert "2026-11-10T09:00:00-05:00" not in slots  # 9 h - 9 h 45 chevauche
    assert "2026-11-10T10:00:00-05:00" in slots  # commence pile à la fin


def test_booking_same_slot_twice_returns_409(
    client: TestClient,
    service: Service,
    client_headers: dict[str, str],
    other_user: User,
) -> None:
    assert book(client, service, client_headers).status_code == 201
    res = book(client, service, auth_headers(other_user))
    assert res.status_code == 409
    assert res.json() == {
        "error": {"code": "SLOT_TAKEN", "message": "Ce créneau vient d'être réservé."}
    }

    overlapping = book(client, service, auth_headers(other_user), "2026-11-10T09:30:00-05:00")
    assert overlapping.status_code == 409


async def test_two_simultaneous_requests_only_one_succeeds(
    clock: Clock, service: Service, client_user: User, other_user: User
) -> None:
    payload = {"service_id": str(service.id), "start_at": SLOT_9H15}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        results = await asyncio.gather(
            *(
                ac.post("/api/v1/bookings", json=payload, headers=auth_headers(user))
                for user in (client_user, other_user)
            )
        )
    assert sorted(r.status_code for r in results) == [201, 409]


def test_database_constraint_rejects_overlap_even_without_api(
    db: Session, service: Service, client_user: User
) -> None:
    start = datetime(2026, 11, 10, 15, 0, tzinfo=UTC)
    for offset in (0, 30):
        db.add(
            Booking(
                user_id=client_user.id,
                service_id=service.id,
                start_at=start + timedelta(minutes=offset),
                end_at=start + timedelta(minutes=offset + 45),
            )
        )
        if offset == 0:
            db.commit()
    with pytest.raises(IntegrityError, match="no_overlap"):
        db.commit()


def test_booking_requires_authentication(client: TestClient, service: Service) -> None:
    res = book(client, service, {})
    assert res.status_code == 401


@pytest.mark.parametrize(
    "start",
    [
        "2026-11-10T09:10:00-05:00",  # pas aligné sur le pas de 15 minutes
        "2026-11-10T11:30:00-05:00",  # dépasse midi (45 min)
        "2026-11-10T12:15:00-05:00",  # pause de midi
        "2026-11-14T10:00:00-05:00",  # samedi
        "2026-11-02T09:00:00-05:00",  # dans moins de 2 h
        "2026-10-30T10:00:00-04:00",  # dans le passé
        "2027-02-01T10:00:00-05:00",  # au-delà de 60 jours
    ],
)
def test_invalid_slots_return_422(
    client: TestClient, service: Service, client_headers: dict[str, str], start: str
) -> None:
    res = book(client, service, client_headers, start)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "SLOT_INVALID"


def test_start_without_timezone_is_rejected(
    client: TestClient, service: Service, client_headers: dict[str, str]
) -> None:
    res = book(client, service, client_headers, "2026-11-10T09:15:00")
    assert res.status_code == 422


def test_time_off_blocks_booking(
    client: TestClient, db: Session, service: Service, client_headers: dict[str, str]
) -> None:
    db.add(
        TimeOff(
            start_at=datetime(2026, 11, 10, 5, tzinfo=UTC),
            end_at=datetime(2026, 11, 11, 5, tzinfo=UTC),
            reason="Congé",
        )
    )
    db.commit()
    assert availability(client, service) == []
    assert book(client, service, client_headers).status_code == 422


def test_my_bookings_upcoming_and_past(
    client: TestClient, service: Service, client_headers: dict[str, str], clock: Clock
) -> None:
    created = book(client, service, client_headers).json()
    upcoming = client.get(
        "/api/v1/bookings/me", params={"when": "upcoming"}, headers=client_headers
    )
    assert [b["id"] for b in upcoming.json()] == [created["id"]]
    assert (
        client.get("/api/v1/bookings/me", params={"when": "past"}, headers=client_headers).json()
        == []
    )

    clock.now = datetime(2026, 11, 11, tzinfo=UTC)  # le lendemain
    past = client.get("/api/v1/bookings/me", params={"when": "past"}, headers=client_headers).json()
    assert [b["id"] for b in past] == [created["id"]]
    assert past[0]["status"] == "completed"  # mise à jour à la lecture


def test_other_clients_bookings_are_invisible(
    client: TestClient, service: Service, client_headers: dict[str, str], other_user: User
) -> None:
    book(client, service, client_headers)
    assert client.get("/api/v1/bookings/me", headers=auth_headers(other_user)).json() == []


def test_cancel_48h_before_succeeds_and_frees_slot(
    client: TestClient, service: Service, client_headers: dict[str, str], outbox: Outbox
) -> None:
    booking = book(client, service, client_headers).json()
    res = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "cancelled_by_client" and body["cancelled_at"]
    assert SLOT_9H15 in availability(client, service)
    assert outbox.messages[-1].subject.startswith("Annulation confirmée")


def test_cancel_2h_before_returns_403(
    client: TestClient, service: Service, client_headers: dict[str, str], clock: Clock
) -> None:
    booking = book(client, service, client_headers).json()
    clock.now = datetime(2026, 11, 10, 12, 15, tzinfo=UTC)  # 2 h avant 9 h 15 (heure locale)
    res = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    assert res.status_code == 403
    assert res.json()["error"] == {
        "code": "CANCEL_TOO_LATE",
        "message": (
            "Annulation impossible moins de 24 h avant le rendez-vous. Contactez le commerce."
        ),
    }


def test_cancel_exactly_24h_before_is_allowed(
    client: TestClient, service: Service, client_headers: dict[str, str], clock: Clock
) -> None:
    booking = book(client, service, client_headers).json()
    clock.now = datetime(2026, 11, 9, 14, 15, tzinfo=UTC)
    res = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    assert res.status_code == 200


def test_cancel_someone_elses_booking_returns_404(
    client: TestClient, service: Service, client_headers: dict[str, str], other_user: User
) -> None:
    booking = book(client, service, client_headers).json()
    res = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=auth_headers(other_user))
    assert res.status_code == 404
    missing = client.post(
        "/api/v1/bookings/00000000-0000-0000-0000-000000000000/cancel", headers=client_headers
    )
    assert missing.status_code == 404


def test_cancel_twice_returns_409(
    client: TestClient, service: Service, client_headers: dict[str, str]
) -> None:
    booking = book(client, service, client_headers).json()
    client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    res = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ALREADY_CANCELLED"


def test_cancelled_booking_frees_slot_for_someone_else(
    client: TestClient, service: Service, client_headers: dict[str, str], other_user: User
) -> None:
    booking = book(client, service, client_headers).json()
    client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=client_headers)
    assert book(client, service, auth_headers(other_user)).status_code == 201


def test_email_failure_never_fails_the_booking(
    client: TestClient,
    service: Service,
    client_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import smtplib

    from app.services import email as email_service

    def broken_smtp(*args: object, **kwargs: object) -> None:
        raise OSError("serveur SMTP injoignable")

    # On restaure le vrai envoi, mais avec un serveur SMTP en panne.
    monkeypatch.setattr(email_service, "send_email", REAL_SEND_EMAIL)
    monkeypatch.setattr(smtplib, "SMTP", broken_smtp)
    assert book(client, service, client_headers).status_code == 201


def test_constraint_violation_is_translated_to_409(
    client: TestClient,
    service: Service,
    client_headers: dict[str, str],
    other_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Simule la course : la vérification préalable ne voit pas la réservation concurrente."""
    from app.services import booking as booking_service

    assert book(client, service, client_headers).status_code == 201
    real_load = booking_service.load_day_constraints

    def load_without_bookings(*args: object, **kwargs: object):  # type: ignore[no-untyped-def]
        hours, time_off, _ = real_load(*args, **kwargs)  # type: ignore[arg-type]
        return hours, time_off, []

    monkeypatch.setattr(booking_service, "load_day_constraints", load_without_bookings)
    res = book(client, service, auth_headers(other_user))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SLOT_TAKEN"
