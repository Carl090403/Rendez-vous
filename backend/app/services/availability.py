"""Calcul des créneaux disponibles (section 7 du cahier)."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Booking, BookingStatus, BusinessHour, Service, TimeOff


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """[a, b[ et [c, d[ se chevauchent si et seulement si a < d et c < b."""
    return a_start < b_end and b_start < a_end


@dataclass(frozen=True)
class SlotRules:
    tz: ZoneInfo
    step: timedelta
    min_notice: timedelta
    horizon: timedelta

    @classmethod
    def from_settings(cls) -> "SlotRules":
        return cls(
            tz=settings.tz,
            step=timedelta(minutes=settings.slot_step_min),
            min_notice=timedelta(hours=settings.min_notice_hours),
            horizon=timedelta(days=settings.booking_horizon_days),
        )


Interval = tuple[datetime, datetime]


def local_day_bounds_utc(day: date, tz: ZoneInfo) -> Interval:
    """Début et fin (exclue) de la journée locale, en UTC. Une journée peut durer 23 h ou 25 h."""
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def compute_slots(
    day: date,
    duration: timedelta,
    hours: Iterable[tuple[time, time]],
    blocked: Sequence[Interval],
    now: datetime,
    rules: SlotRules,
) -> list[datetime]:
    """Retourne les débuts de créneaux libres (en UTC, triés) pour une date locale.

    `hours` : plages d'ouverture locales de ce jour de la semaine.
    `blocked` : congés et réservations confirmées, en UTC.
    """
    earliest = now + rules.min_notice
    latest = now + rules.horizon
    slots: set[datetime] = set()

    for open_t, close_t in hours:
        # Conversion locale -> UTC jour par jour : gère correctement le changement d'heure.
        open_utc = datetime.combine(day, open_t, tzinfo=rules.tz).astimezone(UTC)
        close_utc = datetime.combine(day, close_t, tzinfo=rules.tz).astimezone(UTC)
        start = open_utc
        while start + duration <= close_utc:
            end = start + duration
            if earliest <= start <= latest and not any(
                overlaps(start, end, b_start, b_end) for b_start, b_end in blocked
            ):
                slots.add(start)
            start += rules.step

    return sorted(slots)


def load_day_constraints(
    db: Session, day: date, tz: ZoneInfo
) -> tuple[list[tuple[time, time]], list[Interval], list[Interval]]:
    """Charge les plages d'ouverture, congés et réservations confirmées touchant la journée."""
    day_start, day_end = local_day_bounds_utc(day, tz)
    hours = [
        (bh.start_time, bh.end_time)
        for bh in db.scalars(select(BusinessHour).where(BusinessHour.weekday == day.weekday()))
    ]
    time_off = [
        (t.start_at, t.end_at)
        for t in db.scalars(
            select(TimeOff).where(TimeOff.start_at < day_end, TimeOff.end_at > day_start)
        )
    ]
    bookings = [
        (b.start_at, b.end_at)
        for b in db.execute(
            select(Booking.start_at, Booking.end_at).where(
                Booking.status == BookingStatus.CONFIRMED,
                Booking.start_at < day_end,
                Booking.end_at > day_start,
            )
        ).all()
    ]
    return hours, time_off, bookings


def available_slots(db: Session, service: Service, day: date, now: datetime) -> list[datetime]:
    rules = SlotRules.from_settings()
    hours, time_off, bookings = load_day_constraints(db, day, rules.tz)
    return compute_slots(
        day, timedelta(minutes=service.duration_min), hours, time_off + bookings, now, rules
    )
