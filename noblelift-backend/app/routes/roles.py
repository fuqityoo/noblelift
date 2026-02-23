from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.role import Role as RoleModel
from app.models.user import User as UserModel
from pydantic import BaseModel

router = APIRouter(prefix="/roles", tags=["Roles"])


class RoleOut(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


@router.get("", response_model=dict)
def list_roles(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    rows = db.execute(select(RoleModel).order_by(RoleModel.id)).scalars().all()
    items: List[RoleOut] = [RoleOut.model_validate(r) for r in rows]
    return {"items": items}
