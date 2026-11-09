from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import UserOut, UserUpdateIn
from app.security import clear_session_cookie, get_current_user, get_now
from app.services import auth as auth_service

router = APIRouter(prefix="/users", tags=["Utilisateurs"])


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> User:
    """Modifie prénom, nom ou mot de passe (le mot de passe actuel est exigé)."""
    return auth_service.update_profile(db, user, data)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> None:
    """Droit à l'effacement (Loi 25) : anonymise le compte et ferme la session."""
    auth_service.delete_account(db, user, now)
    clear_session_cookie(response)
