"""Comptes : inscription, connexion, mot de passe, profil et suppression (sections 3 et 9)."""

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Booking, BookingStatus, PasswordResetToken, User, UserRole
from app.schemas.auth import RegisterIn, UserUpdateIn
from app.security import hash_password, verify_password, verify_password_or_dummy

RESET_TOKEN_TTL = timedelta(hours=1)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _email_exists() -> AppError:
    return AppError(409, "EMAIL_EXISTS", "Un compte existe déjà avec ce courriel.")


def register(db: Session, data: RegisterIn) -> User:
    email = normalize_email(data.email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise _email_exists()
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.CLIENT,  # le rôle admin n'est créé que par le script de seed
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:  # inscription simultanée avec le même courriel
        db.rollback()
        raise _email_exists() from exc
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if not verify_password_or_dummy(password, user.password_hash if user else None):
        # Même message pour un courriel inconnu et un mauvais mot de passe.
        raise AppError(401, "INVALID_CREDENTIALS", "Courriel ou mot de passe incorrect.")
    assert user is not None  # noqa: S101 - garanti par la vérification ci-dessus
    return user


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_password_reset(db: Session, email: str, now: datetime) -> tuple[User, str] | None:
    """Crée un jeton à usage unique valide 1 h. Retourne None si le compte n'existe pas."""
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None:
        return None
    # Un seul lien valide à la fois : les anciens jetons non utilisés sont invalidés.
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id, token_hash=_hash_token(token), expires_at=now + RESET_TOKEN_TTL
        )
    )
    db.commit()
    return user, token


def reset_password(db: Session, token: str, new_password: str, now: datetime) -> None:
    record = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == _hash_token(token))
        .with_for_update()
    )
    if record is None or record.used_at is not None or record.expires_at <= now:
        raise AppError(400, "TOKEN_INVALID", "Ce lien de réinitialisation est invalide ou expiré.")
    user = db.get(User, record.user_id)
    if user is None:
        raise AppError(400, "TOKEN_INVALID", "Ce lien de réinitialisation est invalide ou expiré.")
    user.password_hash = hash_password(new_password)
    record.used_at = now
    db.commit()


def update_profile(db: Session, user: User, data: UserUpdateIn) -> User:
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.new_password is not None:
        if not data.current_password or not verify_password(
            data.current_password, user.password_hash
        ):
            raise AppError(400, "INVALID_PASSWORD", "Le mot de passe actuel est incorrect.")
        user.password_hash = hash_password(data.new_password)
    db.commit()
    db.refresh(user)
    return user


def delete_account(db: Session, user: User, now: datetime) -> None:
    """Droit à l'effacement (Loi 25) : les données personnelles sont anonymisées.

    Les réservations restent (sans nom ni courriel) pour l'historique du commerce, et
    les rendez-vous à venir sont annulés pour libérer les créneaux.
    """
    if user.is_admin:
        raise AppError(403, "FORBIDDEN", "Le compte administrateur ne peut pas être supprimé ici.")
    db.execute(
        update(Booking)
        .where(
            Booking.user_id == user.id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.start_at > now,
        )
        .values(
            status=BookingStatus.CANCELLED_BY_CLIENT,
            cancelled_at=now,
            cancel_reason="Compte supprimé",
        )
    )
    db.execute(
        update(PasswordResetToken).where(PasswordResetToken.user_id == user.id).values(used_at=now)
    )
    user.email = f"supprime-{user.id}@supprime.invalid"
    user.first_name = "Compte"
    user.last_name = "supprimé"
    user.password_hash = hash_password(secrets.token_urlsafe(32))
    db.commit()
