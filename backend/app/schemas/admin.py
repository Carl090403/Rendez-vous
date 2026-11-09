import uuid
from datetime import time
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.booking import AdminBookingOut
from app.schemas.common import Reason, UTCDatetime


class BusinessHourIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weekday: Annotated[int, Field(ge=0, le=6, description="0 = lundi, 6 = dimanche")]
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def _check_order(self) -> "BusinessHourIn":
        if self.end_time <= self.start_time:
            raise ValueError("L'heure de fin doit être après l'heure de début.")
        return self


class BusinessHourOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    weekday: int
    start_time: time
    end_time: time


class TimeOffIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_at: AwareDatetime
    end_at: AwareDatetime
    reason: Reason | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "TimeOffIn":
        if self.end_at <= self.start_at:
            raise ValueError("La fin du congé doit être après son début.")
        return self


class TimeOffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    start_at: UTCDatetime
    end_at: UTCDatetime
    reason: str | None


class TimeOffCreatedOut(BaseModel):
    time_off: TimeOffOut
    # Réservations confirmées touchées par le congé : l'administrateur choisit de les annuler.
    affected_bookings: list[AdminBookingOut]
