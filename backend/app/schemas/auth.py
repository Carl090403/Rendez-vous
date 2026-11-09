import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.models import UserRole
from app.schemas.common import Name, UTCDatetime
from app.security import is_trivial_password

Password = Annotated[str, Field(min_length=8, max_length=128)]


def _check_password(value: str) -> str:
    if is_trivial_password(value):
        raise ValueError("Ce mot de passe est trop courant. Choisissez-en un autre.")
    return value


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # « role » ne peut jamais être demandé

    email: Annotated[EmailStr, StringConstraints(max_length=254)]
    password: Password
    first_name: Name
    last_name: Name

    _password_strength = field_validator("password")(_check_password)


class LoginIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254)]
    password: Annotated[str, StringConstraints(max_length=128)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: UserRole
    created_at: UTCDatetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - type de jeton, pas un secret
    expires_in: int
    user: UserOut


class ForgotPasswordIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254)]


class ResetPasswordIn(BaseModel):
    token: Annotated[str, StringConstraints(min_length=10, max_length=200)]
    new_password: Password

    _password_strength = field_validator("new_password")(_check_password)


class UserUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Name | None = None
    last_name: Name | None = None
    current_password: Annotated[str, StringConstraints(max_length=128)] | None = None
    new_password: Password | None = None

    @field_validator("new_password")
    @classmethod
    def _new_password_strength(cls, value: str | None) -> str | None:
        return None if value is None else _check_password(value)
