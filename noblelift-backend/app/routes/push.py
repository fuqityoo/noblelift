from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.push_subscription import PushSubscription as PushModel
from app.schemas.push import PushSubscription as PushSchema, PushSubscribeRequest
from app.models.user import User as UserModel

router = APIRouter(prefix="/push", tags=["Notifications"])

@router.get("/subscriptions", response_model=dict)
def list_subscriptions(db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    rows = db.execute(select(PushModel).where(PushModel.user_id == current.id)).scalars().all()
    return {"items": [PushSchema.model_validate(r) for r in rows]}

@router.post("/subscribe", response_model=PushSchema, status_code=201)
def subscribe(body: PushSubscribeRequest, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    exists = db.execute(select(PushModel).where(PushModel.endpoint == body.endpoint)).scalar_one_or_none()
    if exists:
        if exists.user_id != current.id:
            exists.user_id = current.id
            db.add(exists); db.commit(); db.refresh(exists)
        return PushSchema.model_validate(exists)
    p = PushModel(user_id=current.id, endpoint=body.endpoint, p256dh=body.p256dh, auth=body.auth)
    db.add(p); db.commit(); db.refresh(p)
    return PushSchema.model_validate(p)

@router.post("/unsubscribe", status_code=204)
def unsubscribe(body: PushSubscribeRequest, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    row = db.execute(select(PushModel).where(PushModel.endpoint == body.endpoint)).scalar_one_or_none()
    if row and row.user_id == current.id:
        db.delete(row); db.commit()
    return
