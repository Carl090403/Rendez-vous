import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import Service, User
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate
from app.security import get_optional_user, require_admin

router = APIRouter(prefix="/services", tags=["Services"])


@router.get("", response_model=list[ServiceOut])
def list_services(
    include_inactive: bool = Query(False, alias="all", description="Admin : inclure les inactifs"),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[Service]:
    """US-03 : services actifs. `?all=true` (administrateur) inclut les services désactivés."""
    query = select(Service).order_by(Service.duration_min, Service.name)
    if include_inactive:
        if user is None or not user.is_admin:
            raise AppError(403, "FORBIDDEN", "Accès réservé à l'administrateur.")
    else:
        query = query.where(Service.is_active.is_(True))
    return list(db.scalars(query))


@router.post(
    "",
    response_model=ServiceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_service(data: ServiceCreate, db: Session = Depends(get_db)) -> Service:
    service = Service(**data.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.patch("/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
def update_service(
    service_id: uuid.UUID, data: ServiceUpdate, db: Session = Depends(get_db)
) -> Service:
    """Modifie ou désactive un service (on ne supprime jamais : l'historique en dépend)."""
    service = db.get(Service, service_id)
    if service is None:
        raise AppError(404, "NOT_FOUND", "Service introuvable.")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service
