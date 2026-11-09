"""Application FastAPI : middlewares, routeurs et surveillance."""

import logging
from collections.abc import Awaitable, Callable

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import register_error_handlers
from app.routers import admin, auth, availability, bookings, services, users

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="Rendez-vous API",
    description="API REST de réservation en ligne pour un petit commerce de services.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)
register_error_handlers(app)

API_PREFIX = "/api/v1"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


@app.middleware("http")
async def security_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    # CSRF : en plus de SameSite=Lax, une requête qui modifie des données et qui vient
    # d'un navigateur doit porter l'en-tête Origin du frontend.
    origin = request.headers.get("origin")
    if (
        request.method in UNSAFE_METHODS
        and origin is not None
        and origin.rstrip("/") not in settings.allowed_origins
    ):
        response: Response = JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "Origine non autorisée."}},
        )
    else:
        response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    return response


# Ajouté en dernier : il enveloppe tout, y compris les réponses d'erreur.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health", tags=["Surveillance"])
def health(db: Session = Depends(get_db)) -> JSONResponse:
    """Renvoie {"status": "ok"} si la base répond (pour UptimeRobot)."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error"})
    return JSONResponse(content={"status": "ok"})


for module in (auth, users, services, availability, bookings, admin):
    app.include_router(module.router, prefix=API_PREFIX)
