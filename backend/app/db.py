"""Moteur et session SQLAlchemy."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# La session PostgreSQL travaille en UTC : les dates sortent toujours en UTC.
engine = create_engine(
    settings.database_url, pool_pre_ping=True, connect_args={"options": "-c timezone=UTC"}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI : une session par requête, toujours fermée."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
