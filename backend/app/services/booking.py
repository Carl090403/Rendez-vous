"""Création, annulation et lecture des réservations (section 7)."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError
from app.models import Booking, BookingStatus, Service, User
from app.models.booking import NO_OVERLAP_CONSTRAINT
from app.services.availability import (
    SlotRules,
    compute_slots,
    load_day_constraints,
    local_day_bounds_utc,
    overlaps,
)


def slot_taken() -> AppError:
    return AppError(409, "SLOT_TAKEN", "Ce créneau vient d'être réservé.")


def _not_found() -> AppError:
    # 404 plutôt que 403 : on ne révèle pas l'existence d'une réservation d'un autre client.
    return AppError(404, "NOT_FOUND", "Réservation introuvable.")


def _is_no_overlap_violation(exc: IntegrityError) -> bool:
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None) == NO_OVERLAP_CONSTRAINT


def create_booking(
    db: Session, user: User, service_id: uuid.UUID, start_at: datetime, now: datetime
) -> Booking:
    # 1. Valider l'entrée : service actif, créneau dans l'horaire, l'horizon et aligné sur le pas.
    service = db.get(Service, service_id)
    if service is None or not service.is_active:
        raise AppError(422, "SLOT_INVALID", "Ce service n'est pas disponible.")

    rules = SlotRules.from_settings()
    start = start_at.astimezone(UTC)
    duration = timedelta(minutes=service.duration_min)
    end = start + duration
    local_day = start.astimezone(rules.tz).date()
    hours, time_off, bookings = load_day_constraints(db, local_day, rules.tz)

    # 2. Recalculer côté serveur. Les réservations sont vérifiées à part pour distinguer
    #    « créneau invalide » (422) de « créneau déjà pris » (409).
    if start not in compute_slots(local_day, duration, hours, time_off, now, rules):
        raise AppError(
            422,
            "SLOT_INVALID",
            "Ce créneau n'est pas disponible (hors horaire, congé, passé ou trop proche).",
        )
    if any(overlaps(start, end, b_start, b_end) for b_start, b_end in bookings):
        raise slot_taken()

    # 3. Insérer. 4. La contrainte no_overlap de PostgreSQL est le vrai verrou.
    booking = Booking(
        user_id=user.id,
        service_id=service.id,
        start_at=start,
        end_at=end,
        status=BookingStatus.CONFIRMED,
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_no_overlap_violation(exc):
            raise slot_taken() from exc
        raise
    db.refresh(booking)
    return booking


def cancel_by_client(db: Session, booking_id: uuid.UUID, user: User, now: datetime) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or (booking.user_id != user.id and not user.is_admin):
        raise _not_found()
    if booking.status != BookingStatus.CONFIRMED or booking.start_at <= now:
        raise AppError(409, "ALREADY_CANCELLED", "Ce rendez-vous est déjà annulé ou passé.")
    if booking.start_at - now < timedelta(hours=settings.cancel_limit_hours):
        raise AppError(
            403,
            "CANCEL_TOO_LATE",
            f"Annulation impossible moins de {settings.cancel_limit_hours} h avant le "
            "rendez-vous. Contactez le commerce.",
        )
    return _cancel(db, booking, BookingStatus.CANCELLED_BY_CLIENT, None, now)


def cancel_by_admin(
    db: Session, booking_id: uuid.UUID, reason: str | None, now: datetime
) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise _not_found()
    if booking.status != BookingStatus.CONFIRMED or booking.end_at <= now:
        raise AppError(409, "ALREADY_CANCELLED", "Ce rendez-vous est déjà annulé ou passé.")
    return _cancel(db, booking, BookingStatus.CANCELLED_BY_ADMIN, reason or None, now)


def _cancel(
    db: Session, booking: Booking, status: BookingStatus, reason: str | None, now: datetime
) -> Booking:
    # On ne supprime jamais la ligne : le créneau se libère car il n'est plus « confirmed ».
    booking.status = status
    booking.cancelled_at = now
    booking.cancel_reason = reason
    db.commit()
    db.refresh(booking)
    return booking


def mark_completed(db: Session, now: datetime) -> None:
    """Passe en « completed » les réservations confirmées terminées (mise à jour à la lecture)."""
    db.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.CONFIRMED, Booking.end_at <= now)
        .values(status=BookingStatus.COMPLETED)
    )
    db.commit()


def list_user_bookings(
    db: Session, user: User, when: Literal["upcoming", "past"] | None, now: datetime
) -> list[Booking]:
    mark_completed(db, now)
    query = select(Booking).where(Booking.user_id == user.id)
    if when == "upcoming":
        query = query.where(Booking.start_at > now).order_by(Booking.start_at.asc())
    elif when == "past":
        query = query.where(Booking.start_at <= now).order_by(Booking.start_at.desc())
    else:
        query = query.order_by(Booking.start_at.desc())
    return list(db.scalars(query))


def list_all_bookings(
    db: Session,
    now: datetime,
    *,
    page: int,
    page_size: int,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[Booking], int]:
    """Liste filtrable pour l'administrateur. Les dates sont des jours locaux, bornes incluses."""
    mark_completed(db, now)
    query = select(Booking)
    if status is not None:
        query = query.where(Booking.status == status)
    if service_id is not None:
        query = query.where(Booking.service_id == service_id)
    if date_from is not None:
        query = query.where(Booking.start_at >= local_day_bounds_utc(date_from, settings.tz)[0])
    if date_to is not None:
        query = query.where(Booking.start_at < local_day_bounds_utc(date_to, settings.tz)[1])

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Booking.start_at.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(items), total


def confirmed_bookings_between(db: Session, start: datetime, end: datetime) -> list[Booking]:
    return list(
        db.scalars(
            select(Booking)
            .where(
                Booking.status == BookingStatus.CONFIRMED,
                Booking.start_at < end,
                Booking.end_at > start,
            )
            .order_by(Booking.start_at)
        )
    )
