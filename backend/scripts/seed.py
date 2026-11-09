"""Données de départ (section 6) : administrateur, 3 services et heures d'ouverture.

Idempotent : on peut le relancer sans créer de doublons.
Usage : python scripts/seed.py
"""

import sys
from datetime import time

from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import BusinessHour, Service, User, UserRole
from app.security import hash_password, is_trivial_password
from app.services.auth import normalize_email

SERVICES = [
    ("Consultation express", "Un premier échange pour cerner vos besoins.", 30, 4500),
    ("Séance de suivi", "Un point d'étape et l'ajustement de votre plan.", 45, 6500),
    ("Séance complète", "Une analyse approfondie et un plan d'action sur mesure.", 60, 9000),
]
# Lundi (0) au vendredi (4), 9 h à 12 h et 13 h à 17 h, heure de Toronto.
OPENING_RANGES = [(time(9), time(12)), (time(13), time(17))]


def _ensure_user(db, email: str, password: str, first: str, last: str, role: UserRole) -> None:
    email = normalize_email(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        print(f"[seed] Compte déjà présent : {email}")
        return
    if len(password) < 8 or is_trivial_password(password):
        sys.exit(
            f"[seed] Mot de passe trop faible pour {email} (8 caractères minimum, non trivial)."
        )
    db.add(
        User(
            email=email,
            password_hash=hash_password(password),
            first_name=first,
            last_name=last,
            role=role,
        )
    )
    print(f"[seed] Compte {role.value} créé : {email}")


def seed() -> None:
    if not settings.admin_password:
        sys.exit("[seed] Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans le fichier .env.")

    with SessionLocal() as db:
        _ensure_user(
            db, settings.admin_email, settings.admin_password, "Admin", "Commerce", UserRole.ADMIN
        )
        if settings.demo_client_email and settings.demo_client_password:
            _ensure_user(
                db,
                settings.demo_client_email,
                settings.demo_client_password,
                "Alex",
                "Tremblay",
                UserRole.CLIENT,
            )

        if not db.scalar(select(func.count()).select_from(Service)):
            db.add_all(
                Service(name=n, description=d, duration_min=m, price_cents=p)
                for n, d, m, p in SERVICES
            )
            print("[seed] 3 services créés (30, 45 et 60 minutes).")

        if not db.scalar(select(func.count()).select_from(BusinessHour)):
            db.add_all(
                BusinessHour(weekday=day, start_time=start, end_time=end)
                for day in range(5)
                for start, end in OPENING_RANGES
            )
            print("[seed] Heures d'ouverture créées (lundi au vendredi, 9 h-12 h et 13 h-17 h).")

        db.commit()
    print("[seed] Terminé.")


if __name__ == "__main__":
    seed()
