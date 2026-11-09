import uuid
from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Booking, BookingStatus, BusinessHour, TimeOff
from app.schemas.admin import (
    BusinessHourIn,
    BusinessHourOut,
    TimeOffCreatedOut,
    TimeOffIn,
    TimeOffOut,
)
from app.schemas.booking import AdminBookingOut, AdminCancelIn
from app.schemas.common import Page
from app.security import get_now, require_admin
from app.services import booking as booking_service
from app.services import email as email_service
from app.services import schedule as schedule_service

router = APIRouter(prefix="/admin", tags=["Administration"], dependencies=[Depends(require_admin)])


@router.get("/bookings", response_model=Page[AdminBookingOut])
def list_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: BookingStatus | None = Query(None, alias="status"),
    service_id: uuid.UUID | None = None,
    day: date | None = Query(None, alias="date", description="Un jour précis (heure locale)"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> Page[AdminBookingOut]:
    """US-12 : toutes les réservations, filtrables par date, statut et service."""
    items, total = booking_service.list_all_bookings(
        db,
        now,
        page=page,
        page_size=page_size,
        status=status_filter,
        service_id=service_id,
        date_from=day or date_from,
        date_to=day or date_to,
    )
    return Page[AdminBookingOut](
        items=[AdminBookingOut.model_validate(b) for b in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/bookings/{booking_id}/cancel", response_model=AdminBookingOut)
def cancel_booking(
    booking_id: uuid.UUID,
    background: BackgroundTasks,
    data: AdminCancelIn | None = None,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> Booking:
    """US-13 : annulation sans restriction de délai, motif facultatif, client notifié."""
    booking = booking_service.cancel_by_admin(db, booking_id, data.reason if data else None, now)
    background.add_task(
        email_service.send_booking_cancelled_by_admin,
        email_service.BookingEmailData.from_booking(booking),
    )
    return booking


@router.get("/business-hours", response_model=list[BusinessHourOut])
def get_business_hours(db: Session = Depends(get_db)) -> list[BusinessHour]:
    return schedule_service.list_business_hours(db)


@router.put("/business-hours", response_model=list[BusinessHourOut])
def put_business_hours(
    ranges: list[BusinessHourIn], db: Session = Depends(get_db)
) -> list[BusinessHour]:
    """US-10 : remplace toutes les plages (plusieurs plages possibles par jour)."""
    return schedule_service.replace_business_hours(db, ranges)


@router.get("/time-off", response_model=list[TimeOffOut])
def get_time_off(db: Session = Depends(get_db)) -> list[TimeOff]:
    return schedule_service.list_time_off(db)


@router.post("/time-off", response_model=TimeOffCreatedOut, status_code=status.HTTP_201_CREATED)
def post_time_off(data: TimeOffIn, db: Session = Depends(get_db)) -> TimeOffCreatedOut:
    """US-11 : crée un congé et renvoie les réservations confirmées qu'il touche."""
    time_off, affected = schedule_service.create_time_off(db, data)
    return TimeOffCreatedOut(
        time_off=TimeOffOut.model_validate(time_off),
        affected_bookings=[AdminBookingOut.model_validate(b) for b in affected],
    )


@router.delete("/time-off/{time_off_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_off(time_off_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    schedule_service.delete_time_off(db, time_off_id)
