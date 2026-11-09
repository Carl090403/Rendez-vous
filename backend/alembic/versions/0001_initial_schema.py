"""Schéma initial : six tables et contrainte anti-chevauchement (section 6 du cahier)

Revision ID: 0001
Revises:
Create Date: 2026-11-09
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.execute("CREATE TYPE user_role AS ENUM ('client', 'admin')")
    op.execute(
        "CREATE TYPE booking_status AS ENUM "
        "('confirmed', 'cancelled_by_client', 'cancelled_by_admin', 'completed')"
    )

    op.execute(
        """
        CREATE TABLE users (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          first_name    TEXT NOT NULL,
          last_name     TEXT NOT NULL,
          role          user_role NOT NULL DEFAULT 'client',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE services (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name         TEXT NOT NULL,
          description  TEXT NOT NULL DEFAULT '',
          duration_min INTEGER NOT NULL CONSTRAINT services_duration_min_check
                       CHECK (duration_min BETWEEN 5 AND 480),
          price_cents  INTEGER NOT NULL CONSTRAINT services_price_cents_check
                       CHECK (price_cents >= 0),
          is_active    BOOLEAN NOT NULL DEFAULT TRUE
        )
        """
    )
    op.execute(
        """
        CREATE TABLE business_hours (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          weekday    SMALLINT NOT NULL CONSTRAINT business_hours_weekday_check
                     CHECK (weekday BETWEEN 0 AND 6),
          start_time TIME NOT NULL,
          end_time   TIME NOT NULL,
          CONSTRAINT business_hours_check CHECK (end_time > start_time)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE time_off (
          id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          start_at TIMESTAMPTZ NOT NULL,
          end_at   TIMESTAMPTZ NOT NULL,
          reason   TEXT,
          CONSTRAINT time_off_check CHECK (end_at > start_at)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE bookings (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id       UUID NOT NULL REFERENCES users(id),
          service_id    UUID NOT NULL REFERENCES services(id),
          start_at      TIMESTAMPTZ NOT NULL,
          end_at        TIMESTAMPTZ NOT NULL,
          status        booking_status NOT NULL DEFAULT 'confirmed',
          cancelled_at  TIMESTAMPTZ,
          cancel_reason TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT bookings_check CHECK (end_at > start_at),
          -- Interdit deux réservations confirmées qui se chevauchent
          CONSTRAINT no_overlap EXCLUDE USING gist (
            tstzrange(start_at, end_at) WITH &&
          ) WHERE (status = 'confirmed')
        )
        """
    )
    op.execute("CREATE INDEX idx_bookings_user ON bookings (user_id, start_at DESC)")
    op.execute("CREATE INDEX idx_bookings_start ON bookings (start_at)")
    op.execute(
        """
        CREATE TABLE password_reset_tokens (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at    TIMESTAMPTZ
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")
    op.execute("DROP TABLE IF EXISTS bookings")
    op.execute("DROP TABLE IF EXISTS time_off")
    op.execute("DROP TABLE IF EXISTS business_hours")
    op.execute("DROP TABLE IF EXISTS services")
    op.execute("DROP TABLE IF EXISTS users")
    op.execute("DROP TYPE IF EXISTS booking_status")
    op.execute("DROP TYPE IF EXISTS user_role")
