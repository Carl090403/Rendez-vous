"""Tests unitaires de l'algorithme des créneaux (fonction pure, sans base de données)."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.services.availability import SlotRules, compute_slots, local_day_bounds_utc, overlaps

TZ = ZoneInfo("America/Toronto")
RULES = SlotRules(
    tz=TZ, step=timedelta(minutes=15), min_notice=timedelta(hours=2), horizon=timedelta(days=60)
)
TUESDAY = date(2026, 11, 10)
NOW = datetime(2026, 11, 2, 13, 0, tzinfo=UTC)
WEEKDAY_HOURS = [(time(9), time(12)), (time(13), time(17))]


def local(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=TZ).astimezone(UTC)


def slots(day=TUESDAY, minutes=45, hours=WEEKDAY_HOURS, blocked=(), now=NOW, rules=RULES):
    return compute_slots(day, timedelta(minutes=minutes), hours, list(blocked), now, rules)


def as_local_times(values: list[datetime]) -> list[str]:
    return [v.astimezone(TZ).strftime("%H:%M") for v in values]


def test_overlaps_is_half_open() -> None:
    a, b, c = local(TUESDAY, 9), local(TUESDAY, 10), local(TUESDAY, 11)
    assert not overlaps(a, b, b, c)  # finir à 10 h n'entre pas en conflit avec 10 h
    assert overlaps(a, b + timedelta(minutes=15), b, c)
    assert overlaps(a, c, b, b + timedelta(minutes=15))  # inclusion


def test_day_without_business_hours_has_no_slots() -> None:
    assert slots(hours=[]) == []


def test_slots_follow_the_step_and_never_pass_closing_time() -> None:
    result = as_local_times(slots())
    assert result[:3] == ["09:00", "09:15", "09:30"]
    # 45 min : dernier départ à 11 h 15 le matin et 16 h 15 l'après-midi.
    assert "11:15" in result and "11:30" not in result
    assert result[-1] == "16:15"
    assert len(result) == 10 + 14


def test_lunch_break_offers_no_slot_between_noon_and_one() -> None:
    result = as_local_times(slots(minutes=30))
    assert not [t for t in result if "12:00" <= t < "13:00"]
    assert "11:30" in result and "13:00" in result


def test_time_off_removes_every_slot_in_its_range() -> None:
    blocked = [(local(TUESDAY, 13), local(TUESDAY, 17))]
    result = as_local_times(slots(blocked=blocked))
    assert result and all(t < "12:00" for t in result)

    whole_day = [local_day_bounds_utc(TUESDAY, TZ)]
    assert slots(blocked=whole_day) == []


def test_confirmed_booking_removes_overlapping_slots_but_not_the_one_at_its_end() -> None:
    booking = [(local(TUESDAY, 10), local(TUESDAY, 10, 45))]
    result = as_local_times(slots(blocked=booking))
    for taken in ("09:30", "09:45", "10:00", "10:15", "10:30"):
        assert taken not in result
    assert "09:15" in result  # 9 h 15 - 10 h : finit pile au début de la réservation
    assert "10:45" in result  # commence pile à la fin de la réservation


def test_minimum_notice_of_two_hours() -> None:
    # À 9 h 50, rien avant 11 h 50 : le matin est complet (dernier départ 11 h 15).
    assert as_local_times(slots(now=local(TUESDAY, 9, 50)))[0] == "13:00"
    # À 7 h, 9 h est exactement à 2 h : permis. Une minute plus tard, 9 h ne l'est plus.
    assert as_local_times(slots(now=local(TUESDAY, 7)))[0] == "09:00"
    assert as_local_times(slots(now=local(TUESDAY, 7, 1)))[0] == "09:15"


def test_no_slot_in_the_past() -> None:
    assert slots(now=local(TUESDAY, 18)) == []


def test_booking_horizon_of_sixty_days() -> None:
    assert slots(day=NOW.date() + timedelta(days=58)) != []
    assert slots(day=NOW.date() + timedelta(days=62)) == []


def test_dst_spring_forward_sunday_march_8_2026() -> None:
    sunday = date(2026, 3, 8)
    now = datetime(2026, 3, 1, tzinfo=UTC)
    # 9 h à Toronto le 8 mars = 13 h UTC (HAE, UTC-4); la veille, 9 h = 14 h UTC (HNE, UTC-5).
    result = slots(day=sunday, minutes=60, hours=[(time(9), time(12))], now=now)
    assert result[0] == datetime(2026, 3, 8, 13, 0, tzinfo=UTC)
    saturday = slots(day=date(2026, 3, 7), minutes=60, hours=[(time(9), time(12))], now=now)
    assert saturday[0] == datetime(2026, 3, 7, 14, 0, tzinfo=UTC)

    # Plage qui traverse le changement : 1 h à 4 h ne dure que 2 h réelles ce jour-là.
    night = slots(day=sunday, minutes=60, hours=[(time(1), time(4))], now=now)
    assert night[0] == datetime(2026, 3, 8, 6, 0, tzinfo=UTC)
    assert night[-1] == datetime(2026, 3, 8, 7, 0, tzinfo=UTC)
    assert len(night) == 5


def test_dst_fall_back_sunday_november_1_2026() -> None:
    sunday = date(2026, 11, 1)
    now = datetime(2026, 10, 25, tzinfo=UTC)
    # 9 h à Toronto le 1er novembre = 14 h UTC (retour à l'heure normale, UTC-5).
    result = slots(day=sunday, minutes=60, hours=[(time(9), time(12))], now=now)
    assert result[0] == datetime(2026, 11, 1, 14, 0, tzinfo=UTC)
    assert len(result) == 9

    # 1 h à 4 h dure 4 h réelles ce jour-là : aucun créneau en double.
    night = slots(day=sunday, minutes=60, hours=[(time(1), time(4))], now=now)
    assert len(night) == len(set(night)) == 13
    assert night[0] == datetime(2026, 11, 1, 5, 0, tzinfo=UTC)


def test_local_day_bounds_handle_23_and_25_hour_days() -> None:
    start, end = local_day_bounds_utc(date(2026, 3, 8), TZ)
    assert end - start == timedelta(hours=23)
    start, end = local_day_bounds_utc(date(2026, 11, 1), TZ)
    assert end - start == timedelta(hours=25)
