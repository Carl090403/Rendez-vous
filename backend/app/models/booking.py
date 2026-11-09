import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import BookingStatus
from app.models.service import Service
from app.models.user import User

NO_OVERLAP_CONSTRAINT = "no_overlap"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="bookings_check"),
        # Interdit deux réservations confirmées qui se chevauchent : c'est le vrai verrou
        # contre les doubles réservations, même avec des requêtes simultanées.
        ExcludeConstraint(
            (func.tstzrange(text("start_at"), text("end_at")), "&&"),
            name=NO_OVERLAP_CONSTRAINT,
            using="gist",
            where=text("status = 'confirmed'"),
        ),
        Index("idx_bookings_user", "user_id", text("start_at DESC")),
        Index("idx_bookings_start", "start_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("services.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", values_callable=lambda e: [m.value for m in e]),
        server_default=BookingStatus.CONFIRMED.value,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(lazy="joined")
    service: Mapped[Service] = relationship(lazy="joined")
