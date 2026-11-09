import uuid
from datetime import date

from pydantic import BaseModel


class AvailabilityOut(BaseModel):
    date: date
    service_id: uuid.UUID
    duration_min: int
    # Débuts de créneaux en ISO 8601 avec le décalage local (ex. 2026-11-03T09:00:00-05:00)
    slots: list[str]
