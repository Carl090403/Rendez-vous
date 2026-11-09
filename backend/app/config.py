"""Configuration lue dans les variables d'environnement (section 14 du cahier)."""

from functools import cached_property
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Hors Docker, le .env de la racine du dépôt est lu (puis un éventuel backend/.env).
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    environment: Literal["development", "test", "production"] = "development"

    database_url: str = "postgresql+psycopg://rdv:rdv@localhost:5432/rdv"

    # Aucun défaut : l'application refuse de démarrer sans secret d'au moins 32 caractères.
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 60

    # Cookie de session. En production, si le frontend et l'API sont sur des domaines
    # différents, utiliser COOKIE_SAMESITE=none (et COOKIE_SECURE=true).
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # Origines autorisées (CORS + vérification de l'en-tête Origin), séparées par des virgules.
    frontend_origin: str = "http://localhost:3000"

    admin_email: str = "admin@exemple.com"
    admin_password: str = ""
    demo_client_email: str = ""
    demo_client_password: str = ""

    timezone: str = "America/Toronto"
    slot_step_min: int = Field(default=15, ge=5, le=60)
    min_notice_hours: int = Field(default=2, ge=0)
    cancel_limit_hours: int = Field(default=24, ge=0)
    booking_horizon_days: int = Field(default=60, ge=1)

    login_max_attempts: int = 5
    login_window_minutes: int = 15

    business_name: str = "Rendez-vous"
    business_address: str = ""

    mail_from: str = "Rendez-vous <no-reply@exemple.com>"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    resend_api_key: str = ""

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, url: str) -> str:
        """Render, Neon ou Heroku fournissent postgres:// ou postgresql:// : on force psycopg 3."""
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    @cached_property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def public_frontend_url(self) -> str:
        """URL utilisée dans les liens des courriels (première origine déclarée)."""
        return self.allowed_origins[0]


settings = Settings()
