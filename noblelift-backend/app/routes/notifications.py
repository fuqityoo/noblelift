from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, func, distinct, update
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.notification import Notification as NotificationModel
from app.schemas.notification import Notification as NotificationSchema

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=dict)
def list_notifications(
    db: Session = Depends(get_db),
    current = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread: Optional[bool] = Query(None),
):
    filters = [NotificationModel.user_id == current.id]
    if unread is True:
        filters.append(NotificationModel.is_read.is_(False))
    elif unread is False:
        filters.append(NotificationModel.is_read.is_(True))

    total = db.execute(select(func.count(distinct(NotificationModel.id))).where(and_(*filters))).scalar_one()
    rows = db.execute(
        select(NotificationModel)
        .where(and_(*filters))
        .order_by(NotificationModel.created_at.desc())
        .limit(limit).offset(offset)
    ).scalars().all()
    items: List[NotificationSchema] = [NotificationSchema.model_validate(n) for n in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.post("/{id}/read", status_code=204)
def mark_read(id: int, db: Session = Depends(get_db), current = Depends(get_current_user)):
    n = db.get(NotificationModel, id)
    if not n or n.user_id != current.id:
        raise HTTPException(status_code=404, detail="Not found")
    if not n.is_read:
        from datetime import datetime, timezone
        n.is_read = True
        n.read_at = datetime.now(tz=timezone.utc)
        db.add(n); db.commit()
    return

@router.post("/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db), current = Depends(get_current_user)):
    from datetime import datetime, timezone
    db.execute(
        update(NotificationModel)
        .where(NotificationModel.user_id == current.id, NotificationModel.is_read.is_(False))
        .values(is_read=True, read_at=datetime.now(tz=timezone.utc))
    )
    db.commit()
    return

@router.delete("/{id}", status_code=204)
def delete_notification(id: int, db: Session = Depends(get_db), current = Depends(get_current_user)):
    n = db.get(NotificationModel, id)
    if not n or n.user_id != current.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(n); db.commit()
    return
