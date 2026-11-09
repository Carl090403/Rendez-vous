"""Heures d'ouverture et congés (US-10, US-11)."""

import uuid
from collections import defaultdict
from datetime import time

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Booking, BusinessHour, TimeOff
from app.schemas.admin import BusinessHourIn, TimeOffIn
from app.services.booking import confirmed_bookings_between


def list_business_hours(db: Session) -> list[BusinessHour]:
    return list(
        db.scalars(select(BusinessHour).order_by(BusinessHour.weekday, BusinessHour.start_time))
    )


def replace_business_hours(db: Session, ranges: list[BusinessHourIn]) -> list[BusinessHour]:
    by_day: dict[int, list[tuple[time, time]]] = defaultdict(list)
    for r in ranges:
        by_day[r.weekday].append((r.start_time, r.end_time))
    for day, day_ranges in by_day.items():
        day_ranges.sort()
        for (_, prev_end), (next_start, _) in zip(day_ranges, day_ranges[1:], strict=False):
            if next_start < prev_end:
                raise AppError(
                    422, "VALIDATION_ERROR", f"Deux plages se chevauchent le jour {day}."
                )

    db.execute(delete(BusinessHour))
    db.add_all(
        BusinessHour(weekday=r.weekday, start_time=r.start_time, end_time=r.end_time)
        for r in ranges
    )
    db.commit()
    return list_business_hours(db)


def list_time_off(db: Session) -> list[TimeOff]:
    return list(db.scalars(select(TimeOff).order_by(TimeOff.start_at)))


def create_time_off(db: Session, data: TimeOffIn) -> tuple[TimeOff, list[Booking]]:
    """Le congé n'est jamais bloqué par des réservations : on les renvoie à l'administrateur."""
    time_off = TimeOff(start_at=data.start_at, end_at=data.end_at, reason=data.reason or None)
    db.add(time_off)
    db.commit()
    db.refresh(time_off)
    return time_off, confirmed_bookings_between(db, time_off.start_at, time_off.end_at)


def delete_time_off(db: Session, time_off_id: uuid.UUID) -> None:
    time_off = db.get(TimeOff, time_off_id)
    if time_off is None:
        raise AppError(404, "NOT_FOUND", "Congé introuvable.")
    db.delete(time_off)
    db.commit()
