import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import AppError
from app.models import Service
from app.schemas.availability import AvailabilityOut
from app.security import get_now
from app.services.availability import available_slots

router = APIRouter(prefix="/availability", tags=["Disponibilités"])


@router.get("", response_model=AvailabilityOut)
def get_availability(
    service_id: uuid.UUID = Query(...),
    day: date = Query(..., alias="date", description="Date locale (America/Toronto), AAAA-MM-JJ"),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> AvailabilityOut:
    """US-04 : créneaux libres d'un service pour une journée."""
    service = db.get(Service, service_id)
    if service is None or not service.is_active:
        raise AppError(404, "NOT_FOUND", "Service introuvable.")
    slots = available_slots(db, service, day, now)
    return AvailabilityOut(
        date=day,
        service_id=service.id,
        duration_min=service.duration_min,
        slots=[s.astimezone(settings.tz).isoformat() for s in slots],
    )
