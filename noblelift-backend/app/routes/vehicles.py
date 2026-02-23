from __future__ import annotations
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import select, and_, func, distinct, update
from sqlalchemy.orm import Session, joinedload

from app.core.audit import write_audit
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.vehicle import Vehicle as VehicleModel
from app.models.vehicle_log import VehicleLog as VehicleLogModel
from app.models.user import User as UserModel

from app.schemas.vehicle import Vehicle as VehicleSchema, VehicleCreate, VehicleUpdate, VehicleLog as VehicleLogSchema

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

def is_manager(u: UserModel) -> bool:
    return bool(u.role and u.role.code in ("super_admin", "manager"))


def is_super_admin(u: UserModel) -> bool:
    return bool(u.role and u.role.code == "super_admin")

@router.get("", response_model=dict)
def list_vehicles(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None),
    status_code: Optional[str] = Query(None, alias="status"),
    holder_id: Optional[int] = Query(None),
):
    filters = []
    if q:
        ilike = f"%{q.lower()}%"
        filters.append(
            (VehicleModel.number.ilike(ilike))
            | (VehicleModel.brand.ilike(ilike))
            | (VehicleModel.model.ilike(ilike))
            | (VehicleModel.color.ilike(ilike))
        )
    if status_code:
        filters.append(VehicleModel.status == status_code)
    if holder_id is not None:
        filters.append(VehicleModel.holder_id == holder_id)

    base = select(VehicleModel)
    if filters: base = base.where(and_(*filters))

    total = db.execute(
        (select(func.count(distinct(VehicleModel.id))).where(and_(*filters))) if filters
        else select(func.count(distinct(VehicleModel.id)))
    ).scalar_one()

    rows = db.execute(
        base.order_by(VehicleModel.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items: List[VehicleSchema] = [VehicleSchema.model_validate(v) for v in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/{id}", response_model=VehicleSchema)
def get_vehicle(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    v = db.get(VehicleModel, id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleSchema.model_validate(v)

@router.post("", response_model=VehicleSchema, status_code=201)
def create_vehicle(body: VehicleCreate, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_super_admin(current):
        raise HTTPException(status_code=403, detail="Forbidden")
    if db.execute(select(VehicleModel.id).where(VehicleModel.number == body.number)).first():
        raise HTTPException(status_code=400, detail="Number already exists")
    v = VehicleModel(
        number=body.number,
        color=body.color,
        brand=body.brand,
        model=body.model,
        status=body.status or "available",
    )
    db.add(v); db.commit(); db.refresh(v)
    db.add(VehicleLogModel(vehicle_id=v.id, user_id=current.id, action="create"))
    db.commit()

    write_audit(db, actor_id=current.id, action="create", entity="vehicle", entity_id=v.id, request=request)

    return VehicleSchema.model_validate(v)

@router.patch("/{id}", response_model=VehicleSchema)
def update_vehicle(id: int, body: VehicleUpdate, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current):
        raise HTTPException(status_code=403, detail="Forbidden")
    v = db.get(VehicleModel, id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if body.number is not None:
        if db.execute(select(VehicleModel.id).where(VehicleModel.number == body.number, VehicleModel.id != id)).first():
            raise HTTPException(status_code=400, detail="Number already exists")
        v.number = body.number
    if body.color is not None: v.color = body.color
    if body.brand is not None: v.brand = body.brand
    if body.model is not None: v.model = body.model
    if body.status is not None: v.status = body.status
    v.updated_at = datetime.now(tz=timezone.utc)
    db.add(v); db.commit(); db.refresh(v)
    db.add(VehicleLogModel(vehicle_id=v.id, user_id=current.id, action="update"))
    db.commit()

    write_audit(db, actor_id=current.id, action="update", entity="vehicle", entity_id=id, request=request)

    return VehicleSchema.model_validate(v)

@router.post("/{id}/take", response_model=VehicleSchema)
def take_vehicle(id: int, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    stmt = (
        update(VehicleModel)
        .where(
            VehicleModel.id == id,
            VehicleModel.holder_id.is_(None),
            VehicleModel.status.in_(("available", "inactive")) == False,
        )
    )
    stmt = (
        update(VehicleModel)
        .where(VehicleModel.id == id, VehicleModel.holder_id.is_(None), VehicleModel.status == "available")
        .values(holder_id=current.id, status="in_use", updated_at=datetime.now(tz=timezone.utc))
        .returning(VehicleModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=409, detail="Vehicle is not available")
    db.commit()
    v = db.get(VehicleModel, id)
    db.add(VehicleLogModel(vehicle_id=id, user_id=current.id, action="take"))
    db.commit()

    write_audit(db, actor_id=current.id, action="take", entity="vehicle", entity_id=id, request=request)

    return VehicleSchema.model_validate(v)

@router.post("/{id}/release", response_model=VehicleSchema)
def release_vehicle(id: int, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    stmt = (
        update(VehicleModel)
        .where(VehicleModel.id == id, VehicleModel.holder_id == current.id)
        .values(holder_id=None, status="available", updated_at=datetime.now(tz=timezone.utc))
        .returning(VehicleModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=409, detail="Vehicle is not held by you")
    db.commit()
    v = db.get(VehicleModel, id)
    db.add(VehicleLogModel(vehicle_id=id, user_id=current.id, action="release"))
    db.commit()

    write_audit(db, actor_id=current.id, action="release", entity="vehicle", entity_id=id, request=request)

    return VehicleSchema.model_validate(v)

@router.delete("/{id}", status_code=204)
def delete_vehicle(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not is_super_admin(current):
        raise HTTPException(status_code=403, detail="Forbidden")
    v = db.get(VehicleModel, id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if v.holder_id is not None:
        raise HTTPException(status_code=409, detail="Cannot delete vehicle in use")
    db.delete(v)
    db.commit()
    write_audit(db, actor_id=current.id, action="delete", entity="vehicle", entity_id=id, request=request)
    return


@router.get("/{id}/logs", response_model=dict)
def vehicle_logs(
    id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not db.get(VehicleModel, id):
        raise HTTPException(status_code=404, detail="Vehicle not found")

    total = db.execute(select(func.count(distinct(VehicleLogModel.id))).where(VehicleLogModel.vehicle_id == id)).scalar_one()
    rows = db.execute(
        select(VehicleLogModel)
        .where(VehicleLogModel.vehicle_id == id)
        .order_by(VehicleLogModel.created_at.desc())
        .limit(limit).offset(offset)
    ).scalars().all()
    items: List[VehicleLogSchema] = [VehicleLogSchema.model_validate(r) for r in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}
