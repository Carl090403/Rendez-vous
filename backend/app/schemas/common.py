from datetime import UTC, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, PlainSerializer, StringConstraints

T = TypeVar("T")


def _to_utc_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


# Les dates sortent toujours en UTC, au format ISO 8601 avec « Z ».
UTCDatetime = Annotated[datetime, PlainSerializer(_to_utc_iso, return_type=str)]

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class MessageOut(BaseModel):
    message: str


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
