"""Erreurs applicatives au format {"error": {"code": ..., "message": ...}} (section 8)."""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(
        self, status_code: int, code: str, message: str, details: Any | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def _body(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


_DEFAULT_CODES = {
    400: ("BAD_REQUEST", "Requête invalide."),
    401: ("UNAUTHORIZED", "Authentification requise."),
    403: ("FORBIDDEN", "Accès interdit."),
    404: ("NOT_FOUND", "Ressource introuvable."),
    405: ("METHOD_NOT_ALLOWED", "Méthode non permise."),
    409: ("CONFLICT", "Conflit."),
    429: ("RATE_LIMITED", "Trop de tentatives. Réessayez plus tard."),
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=_body(exc.code, exc.message, exc.details)
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, message = _DEFAULT_CODES.get(exc.status_code, ("ERROR", "Erreur."))
        if isinstance(exc.detail, str) and exc.status_code not in (404, 405):
            message = exc.detail
        return JSONResponse(
            status_code=exc.status_code, content=_body(code, message), headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Les valeurs saisies ne sont pas renvoyées : elles peuvent contenir un mot de passe.
        details = [
            {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "message": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_body("VALIDATION_ERROR", "Données invalides.", details),
        )
