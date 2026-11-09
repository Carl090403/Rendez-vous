import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Booking, User
from app.schemas.booking import BookingCreate, BookingOut
from app.security import get_current_user, get_now
from app.services import booking as booking_service
from app.services import email as email_service

router = APIRouter(prefix="/bookings", tags=["Réservations"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    data: BookingCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> Booking:
    """US-05 : réserve un créneau; 409 SLOT_TAKEN si quelqu'un l'a pris juste avant."""
    booking = booking_service.create_booking(db, user, data.service_id, data.start_at, now)
    # Le commit est fait : les courriels partent en arrière-plan, jamais avant.
    payload = email_service.BookingEmailData.from_booking(booking)
    background.add_task(email_service.send_booking_confirmed, payload)
    background.add_task(email_service.send_admin_new_booking, payload)
    return booking


@router.get("/me", response_model=list[BookingOut])
def my_bookings(
    when: Literal["upcoming", "past"] | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> list[Booking]:
    """US-06 : rendez-vous à venir (`upcoming`) ou passés (`past`) du client connecté."""
    return booking_service.list_user_bookings(db, user, when, now)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> Booking:
    """US-07 : annulation permise jusqu'à 24 h avant le début (valeur configurable)."""
    booking = booking_service.cancel_by_client(db, booking_id, user, now)
    background.add_task(
        email_service.send_booking_cancelled_by_client,
        email_service.BookingEmailData.from_booking(booking),
    )
    return booking
