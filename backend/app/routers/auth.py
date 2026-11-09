from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import AppError
from app.schemas.auth import (
    ForgotPasswordIn,
    LoginIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
)
from app.schemas.common import MessageOut
from app.security import (
    SlidingWindowLimiter,
    clear_session_cookie,
    client_ip,
    create_access_token,
    get_now,
    login_limiter,
    set_session_cookie,
)
from app.services import auth as auth_service
from app.services import email as email_service

router = APIRouter(prefix="/auth", tags=["Authentification"])

# Limite l'envoi de liens de réinitialisation (anti-pourriel), sans jamais le signaler.
forgot_limiter = SlidingWindowLimiter(3, timedelta(minutes=15))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    """US-01 : crée un compte client et ouvre directement la session."""
    user = auth_service.register(db, data)
    set_session_cookie(response, create_access_token(user))
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenOut)
def login(
    data: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenOut:
    """US-02 : 5 échecs en 15 minutes (par IP ou par courriel) bloquent les tentatives (429)."""
    keys = (f"ip:{client_ip(request)}", f"email:{auth_service.normalize_email(data.email)}")
    if login_limiter.is_blocked(*keys):
        raise AppError(429, "RATE_LIMITED", "Trop de tentatives. Réessayez dans 15 minutes.")
    try:
        user = auth_service.authenticate(db, data.email, data.password)
    except AppError:
        login_limiter.hit(*keys)
        raise
    login_limiter.reset(keys[1])

    token = create_access_token(user)
    set_session_cookie(response, token)
    return TokenOut(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    """Efface le cookie de session (fonctionne même si la session a déjà expiré)."""
    clear_session_cookie(response)


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(
    data: ForgotPasswordIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> MessageOut:
    """US-08 : répond toujours 200, que le compte existe ou non."""
    key = f"email:{auth_service.normalize_email(data.email)}"
    if not forgot_limiter.is_blocked(key):
        forgot_limiter.hit(key)
        created = auth_service.create_password_reset(db, data.email, now)
        if created is not None:
            user, token = created
            background.add_task(
                email_service.send_password_reset, user.email, user.first_name, token
            )
    return MessageOut(
        message="Si un compte existe pour ce courriel, "
        "un lien de réinitialisation vient d'être envoyé."
    )


@router.post("/reset-password", response_model=MessageOut)
def reset_password(
    data: ResetPasswordIn, db: Session = Depends(get_db), now: datetime = Depends(get_now)
) -> MessageOut:
    auth_service.reset_password(db, data.token, data.new_password, now)
    return MessageOut(message="Votre mot de passe a été modifié. Vous pouvez vous connecter.")
