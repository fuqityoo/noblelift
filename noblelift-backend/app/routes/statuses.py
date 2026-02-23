from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.status import ProfileStatus as ProfileStatusModel

router = APIRouter(prefix="/statuses", tags=["Statuses"])

@router.get("")
def list_statuses(db: Session = Depends(get_db)):
    rows = db.execute(select(ProfileStatusModel).order_by(ProfileStatusModel.code)).scalars().all()
    return {"items": [{"code": r.code, "label": r.label} for r in rows]}
