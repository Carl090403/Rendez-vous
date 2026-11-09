import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ServiceName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Duration = Annotated[int, Field(ge=5, le=480)]
Price = Annotated[int, Field(ge=0, le=10_000_000)]


class ServiceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ServiceName
    description: Description = ""
    duration_min: Duration
    price_cents: Price
    is_active: bool = True


class ServiceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ServiceName | None = None
    description: Description | None = None
    duration_min: Duration | None = None
    price_cents: Price | None = None
    is_active: bool | None = None


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    duration_min: int
    price_cents: int
    is_active: bool
