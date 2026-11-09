import uuid

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.models import BookingStatus
from app.schemas.common import Reason, UTCDatetime


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service_id: uuid.UUID
    start_at: AwareDatetime  # le fuseau est obligatoire pour éviter toute ambiguïté


class BookingServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    duration_min: int
    price_cents: int


class BookingClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service: BookingServiceOut
    start_at: UTCDatetime
    end_at: UTCDatetime
    status: BookingStatus
    cancelled_at: UTCDatetime | None
    cancel_reason: str | None
    created_at: UTCDatetime


class AdminBookingOut(BookingOut):
    user: BookingClientOut


class AdminCancelIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Reason | None = None
