"""US-09 à US-13 : services, horaires, congés et réservations côté administrateur."""

import pytest
from fastapi.testclient import TestClient

from app.models import Service, User
from tests.conftest import Clock, Outbox, auth_headers

SLOT = "2026-11-10T09:15:00-05:00"
NEW_SERVICE = {
    "name": "Coupe",
    "description": "Coupe simple",
    "duration_min": 30,
    "price_cents": 2500,
}


def book(client: TestClient, service: Service, user: User, start: str = SLOT) -> dict:
    res = client.post(
        "/api/v1/bookings",
        headers=auth_headers(user),
        json={"service_id": str(service.id), "start_at": start},
    )
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/admin/bookings"),
        ("get", "/api/v1/admin/business-hours"),
        ("put", "/api/v1/admin/business-hours"),
        ("get", "/api/v1/admin/time-off"),
        ("post", "/api/v1/admin/time-off"),
        ("post", "/api/v1/services"),
        ("get", "/api/v1/services?all=true"),
    ],
)
def test_admin_routes_reject_clients_with_403(
    client: TestClient, client_headers: dict[str, str], method: str, path: str
) -> None:
    res = client.request(method, path, headers=client_headers, json={})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_admin_routes_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/admin/bookings").status_code == 401


def test_service_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    created = client.post("/api/v1/services", headers=admin_headers, json=NEW_SERVICE)
    assert created.status_code == 201
    service_id = created.json()["id"]
    assert [s["name"] for s in client.get("/api/v1/services").json()] == ["Coupe"]

    patched = client.patch(
        f"/api/v1/services/{service_id}", headers=admin_headers, json={"price_cents": 3000}
    )
    assert patched.json()["price_cents"] == 3000 and patched.json()["name"] == "Coupe"

    client.patch(f"/api/v1/services/{service_id}", headers=admin_headers, json={"is_active": False})
    assert client.get("/api/v1/services").json() == []  # US-03 : désactivé = invisible
    everything = client.get("/api/v1/services", params={"all": "true"}, headers=admin_headers)
    assert [s["is_active"] for s in everything.json()] == [False]


def test_service_validation(client: TestClient, admin_headers: dict[str, str]) -> None:
    for bad in ({"duration_min": 4}, {"duration_min": 481}, {"price_cents": -1}, {"name": ""}):
        res = client.post("/api/v1/services", headers=admin_headers, json={**NEW_SERVICE, **bad})
        assert res.status_code == 422, bad
    missing = client.patch(
        "/api/v1/services/00000000-0000-0000-0000-000000000000", headers=admin_headers, json={}
    )
    assert missing.status_code == 404


def test_business_hours_replace_and_read(client: TestClient, admin_headers: dict[str, str]) -> None:
    ranges = [
        {"weekday": 0, "start_time": "13:00", "end_time": "17:00"},
        {"weekday": 0, "start_time": "09:00", "end_time": "12:00"},
        {"weekday": 5, "start_time": "10:00", "end_time": "14:00"},
    ]
    res = client.put("/api/v1/admin/business-hours", headers=admin_headers, json=ranges)
    assert res.status_code == 200
    read = client.get("/api/v1/admin/business-hours", headers=admin_headers).json()
    assert [(r["weekday"], r["start_time"]) for r in read] == [
        (0, "09:00:00"),
        (0, "13:00:00"),
        (5, "10:00:00"),
    ]


def test_business_hours_validation(client: TestClient, admin_headers: dict[str, str]) -> None:
    inverted = [{"weekday": 1, "start_time": "12:00", "end_time": "09:00"}]
    assert (
        client.put("/api/v1/admin/business-hours", headers=admin_headers, json=inverted).status_code
        == 422
    )
    overlapping = [
        {"weekday": 1, "start_time": "09:00", "end_time": "12:00"},
        {"weekday": 1, "start_time": "11:00", "end_time": "14:00"},
    ]
    assert (
        client.put(
            "/api/v1/admin/business-hours", headers=admin_headers, json=overlapping
        ).status_code
        == 422
    )
    bad_day = [{"weekday": 7, "start_time": "09:00", "end_time": "12:00"}]
    assert (
        client.put("/api/v1/admin/business-hours", headers=admin_headers, json=bad_day).status_code
        == 422
    )


@pytest.mark.usefixtures("business_hours")
def test_time_off_reports_affected_bookings(
    client: TestClient, admin_headers: dict[str, str], service: Service, client_user: User
) -> None:
    booking = book(client, service, client_user)
    res = client.post(
        "/api/v1/admin/time-off",
        headers=admin_headers,
        json={
            "start_at": "2026-11-10T00:00:00-05:00",
            "end_at": "2026-11-11T00:00:00-05:00",
            "reason": "Formation",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["time_off"]["reason"] == "Formation"
    assert [b["id"] for b in body["affected_bookings"]] == [booking["id"]]
    assert body["affected_bookings"][0]["user"]["email"] == "alex@exemple.com"

    listed = client.get("/api/v1/admin/time-off", headers=admin_headers).json()
    assert len(listed) == 1
    deleted = client.delete(f"/api/v1/admin/time-off/{listed[0]['id']}", headers=admin_headers)
    assert deleted.status_code == 204
    assert client.get("/api/v1/admin/time-off", headers=admin_headers).json() == []
    again = client.delete(f"/api/v1/admin/time-off/{listed[0]['id']}", headers=admin_headers)
    assert again.status_code == 404


def test_time_off_end_must_follow_start(client: TestClient, admin_headers: dict[str, str]) -> None:
    res = client.post(
        "/api/v1/admin/time-off",
        headers=admin_headers,
        json={"start_at": "2026-11-11T00:00:00Z", "end_at": "2026-11-10T00:00:00Z"},
    )
    assert res.status_code == 422


@pytest.mark.usefixtures("business_hours")
def test_admin_lists_and_filters_bookings(
    client: TestClient,
    admin_headers: dict[str, str],
    service: Service,
    client_user: User,
    other_user: User,
) -> None:
    first = book(client, service, client_user)
    book(client, service, other_user, "2026-11-11T10:00:00-05:00")
    client.post(f"/api/v1/bookings/{first['id']}/cancel", headers=auth_headers(client_user))

    all_items = client.get("/api/v1/admin/bookings", headers=admin_headers).json()
    assert all_items["total"] == 2 and all_items["page"] == 1 and all_items["page_size"] == 20
    assert {b["user"]["email"] for b in all_items["items"]} == {
        "alex@exemple.com",
        "sam@exemple.com",
    }

    by_status = client.get(
        "/api/v1/admin/bookings", params={"status": "confirmed"}, headers=admin_headers
    )
    assert [b["user"]["email"] for b in by_status.json()["items"]] == ["sam@exemple.com"]

    by_date = client.get(
        "/api/v1/admin/bookings", params={"date": "2026-11-10"}, headers=admin_headers
    )
    assert [b["id"] for b in by_date.json()["items"]] == [first["id"]]

    by_range = client.get(
        "/api/v1/admin/bookings",
        params={"date_from": "2026-11-11", "date_to": "2026-11-30", "service_id": str(service.id)},
        headers=admin_headers,
    )
    assert by_range.json()["total"] == 1

    paged = client.get(
        "/api/v1/admin/bookings", params={"page_size": 1, "page": 2}, headers=admin_headers
    )
    assert paged.json()["total"] == 2 and len(paged.json()["items"]) == 1

    bad = client.get("/api/v1/admin/bookings", params={"status": "nope"}, headers=admin_headers)
    assert bad.status_code == 422


@pytest.mark.usefixtures("business_hours")
def test_admin_cancels_without_time_limit_and_client_is_notified(
    client: TestClient,
    admin_headers: dict[str, str],
    service: Service,
    client_user: User,
    clock: Clock,
    outbox: Outbox,
) -> None:
    from datetime import UTC, datetime

    booking = book(client, service, client_user)
    clock.now = datetime(2026, 11, 10, 14, 0, tzinfo=UTC)  # 15 minutes avant le rendez-vous
    res = client.post(
        f"/api/v1/admin/bookings/{booking['id']}/cancel",
        headers=admin_headers,
        json={"reason": "Fermeture imprévue"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled_by_admin"
    assert res.json()["cancel_reason"] == "Fermeture imprévue"
    last = outbox.to("alex@exemple.com")[-1]
    assert "Fermeture imprévue" in last.text

    again = client.post(f"/api/v1/admin/bookings/{booking['id']}/cancel", headers=admin_headers)
    assert again.status_code == 409


@pytest.mark.usefixtures("business_hours")
def test_admin_cancel_without_reason(
    client: TestClient, admin_headers: dict[str, str], service: Service, client_user: User
) -> None:
    booking = book(client, service, client_user)
    res = client.post(f"/api/v1/admin/bookings/{booking['id']}/cancel", headers=admin_headers)
    assert res.status_code == 200 and res.json()["cancel_reason"] is None
    missing = client.post(
        "/api/v1/admin/bookings/00000000-0000-0000-0000-000000000000/cancel", headers=admin_headers
    )
    assert missing.status_code == 404
