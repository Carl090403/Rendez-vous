"""Hachage des mots de passe, jetons JWT et dépendances d'accès (section 9)."""

import threading
import uuid
from collections import deque
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import AppError
from app.models import User

ACCESS_COOKIE = "access_token"
JWT_ALGORITHM = "HS256"

_hasher = PasswordHasher()  # Argon2id avec les paramètres recommandés par argon2-cffi
_bearer = HTTPBearer(auto_error=False)

# Liste courte de mots de passe triviaux refusés (comparaison insensible à la casse).
TRIVIAL_PASSWORDS = frozenset(
    {
        "password",
        "password1",
        "password123",
        "motdepasse",
        "motdepasse1",
        "12345678",
        "123456789",
        "1234567890",
        "87654321",
        "11111111",
        "00000000",
        "azertyui",
        "azerty123",
        "qwertyui",
        "qwerty123",
        "abcdefgh",
        "abcd1234",
        "iloveyou",
        "sunshine",
        "princess",
        "football",
        "baseball",
        "welcome1",
        "admin123",
        "letmein1",
        "bonjour1",
        "soleil123",
        "montreal",
        "canada123",
    }
)


def utcnow() -> datetime:
    return datetime.now(UTC)


def get_now() -> datetime:
    """Horloge injectée : les tests la remplacent pour vérifier les règles de délai."""
    return utcnow()


def is_trivial_password(password: str) -> bool:
    return password.lower() in TRIVIAL_PASSWORDS or len(set(password)) <= 2


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


# Hachage factice : vérifier un courriel inconnu prend le même temps qu'un vrai compte,
# ce qui évite de révéler par le temps de réponse quels comptes existent.
_DUMMY_HASH = _hasher.hash("rendez-vous-dummy-password")


def verify_password_or_dummy(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        verify_password(password, _DUMMY_HASH)
        return False
    return verify_password(password, password_hash)


def create_access_token(user: User, now: datetime | None = None) -> str:
    """Le jeton suit toujours l'heure réelle (`now` ne sert qu'aux tests d'expiration)."""
    issued = now or utcnow()
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure or settings.cookie_samesite == "none",
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        ACCESS_COOKIE,
        path="/",
        httponly=True,
        secure=settings.cookie_secure or settings.cookie_samesite == "none",
        samesite=settings.cookie_samesite,
    )


def _unauthorized(
    code: str = "UNAUTHORIZED", message: str = "Authentification requise."
) -> AppError:
    return AppError(401, code, message)


def _token_from_request(
    request: Request, credentials: HTTPAuthorizationCredentials | None
) -> str | None:
    # L'en-tête Authorization: Bearer reste accepté pour les tests et le futur bot.
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return request.cookies.get(ACCESS_COOKIE)


def _user_from_token(token: str, db: Session) -> User:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        user_id = uuid.UUID(str(payload["sub"]))
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("TOKEN_EXPIRED", "Session expirée. Reconnectez-vous.") from exc
    except (jwt.PyJWTError, ValueError) as exc:
        raise _unauthorized("TOKEN_INVALID", "Session invalide. Reconnectez-vous.") from exc

    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("TOKEN_INVALID", "Session invalide. Reconnectez-vous.")
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = _token_from_request(request, credentials)
    if not token:
        raise _unauthorized()
    return _user_from_token(token, db)


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    token = _token_from_request(request, credentials)
    if not token:
        return None
    try:
        return _user_from_token(token, db)
    except AppError:
        return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise AppError(403, "FORBIDDEN", "Accès réservé à l'administrateur.")
    return user


class SlidingWindowLimiter:
    """Limiteur en mémoire (un seul processus suffit pour le MVP; Redis en v1.1)."""

    def __init__(self, max_events: int, window: timedelta, clock: Callable[[], datetime] = utcnow):
        self.max_events = max_events
        self.window = window
        self.clock = clock
        self._events: dict[str, deque[datetime]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: datetime) -> deque[datetime]:
        events = self._events.setdefault(key, deque())
        while events and now - events[0] >= self.window:
            events.popleft()
        return events

    def is_blocked(self, *keys: str) -> bool:
        now = self.clock()
        with self._lock:
            return any(len(self._prune(k, now)) >= self.max_events for k in keys)

    def hit(self, *keys: str) -> None:
        now = self.clock()
        with self._lock:
            for k in keys:
                self._prune(k, now).append(now)

    def reset(self, *keys: str) -> None:
        with self._lock:
            if not keys:
                self._events.clear()
            for k in keys:
                self._events.pop(k, None)


login_limiter = SlidingWindowLimiter(
    settings.login_max_attempts, timedelta(minutes=settings.login_window_minutes)
)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
