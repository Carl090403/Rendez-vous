import uuid
from datetime import time

from sqlalchemy import CheckConstraint, SmallInteger, Time, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BusinessHour(Base):
    """Plage d'ouverture hebdomadaire; heures locales (America/Toronto), weekday 0 = lundi."""

    __tablename__ = "business_hours"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="business_hours_weekday_check"),
        CheckConstraint("end_time > start_time", name="business_hours_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    weekday: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
