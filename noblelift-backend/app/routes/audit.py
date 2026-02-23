from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func, distinct
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.user import User as UserModel
from app.models.audit_log import AuditLog as AuditModel
from app.schemas.audit import AuditLog as AuditSchema
from app.utils.pagination import page

router = APIRouter(prefix="/audit", tags=["Audit"])

def ensure_super_admin(u: UserModel):
    if not u.role or u.role.code != "super_admin":
        raise HTTPException(status_code=403, detail="Forbidden")

@router.get("", response_model=dict)
def list_audit(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    actor_id: Optional[int] = Query(None),
    entity: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    since: Optional[int] = Query(None, description="ms"),
    until: Optional[int] = Query(None, description="ms"),
):
    ensure_super_admin(current)

    filters = []
    if actor_id is not None: filters.append(AuditModel.actor_id == actor_id)
    if entity is not None: filters.append(AuditModel.entity == entity)
    if entity_id is not None: filters.append(AuditModel.entity_id == entity_id)
    if action is not None: filters.append(AuditModel.action == action)
    if since is not None: filters.append(AuditModel.created_at >= datetime.fromtimestamp(since/1000))
    if until is not None: filters.append(AuditModel.created_at <= datetime.fromtimestamp(until/1000))

    base = select(AuditModel)
    if filters: base = base.where(and_(*filters))

    total = db.execute(
        (select(func.count(distinct(AuditModel.id))).where(and_(*filters))) if filters
        else select(func.count(distinct(AuditModel.id)))
    ).scalar_one()

    rows = db.execute(
        base.order_by(AuditModel.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items: List[AuditSchema] = [AuditSchema.model_validate(r) for r in rows]
    return page(items, total, limit, offset)
