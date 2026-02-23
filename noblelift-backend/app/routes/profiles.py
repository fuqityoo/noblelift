from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.user import User as UserModel
from app.models.profile import Profile as ProfileModel
from app.models.status import ProfileStatus as ProfileStatusModel

from pydantic import BaseModel
from typing import Any, Optional

router = APIRouter(prefix="/profiles", tags=["Profiles"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "avatars"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


class ProfileLinks(BaseModel):
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class ProfileUpdate(BaseModel):
    links: Optional[ProfileLinks] = None
    avatarUrl: Optional[str] = None
    title: Optional[str] = None

class ProfileStatus(BaseModel):
    code: str
    label: str

class ProfileStatusChange(BaseModel):
    status: ProfileStatus
    statusPayload: Optional[dict[str, Any]] = None


@router.get("/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    prof = db.execute(
        select(ProfileModel)
        .options(joinedload(ProfileModel.status))
        .where(ProfileModel.user_id == current.id)
    ).scalar_one_or_none()
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "userId": current.id,
        "status": {"code": prof.status.code, "label": prof.status.label},
        "statusPayload": prof.status_payload,
        "links": prof.links or {},
        "arrivedAt": int(prof.arrived_at.timestamp() * 1000) if prof.arrived_at else None,
        "lastSeenAt": int(prof.last_seen_at.timestamp() * 1000) if prof.last_seen_at else None,
    }


@router.patch("/me")
def update_my_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    prof = db.get(ProfileModel, current.id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.links is not None:
        prof.links = body.links.dict(exclude_none=True)
    if body.avatarUrl is not None:
        current.avatar_url = body.avatarUrl
        db.add(current)
    if body.title is not None:
        current.title = body.title
        db.add(current)

    db.add(prof)
    db.commit()

    prof = db.execute(
        select(ProfileModel).options(joinedload(ProfileModel.status)).where(ProfileModel.user_id == current.id)
    ).scalar_one()
    return {
        "userId": current.id,
        "status": {"code": prof.status.code, "label": prof.status.label},
        "statusPayload": prof.status_payload,
        "links": prof.links or {},
        "arrivedAt": int(prof.arrived_at.timestamp() * 1000) if prof.arrived_at else None,
        "lastSeenAt": int(prof.last_seen_at.timestamp() * 1000) if prof.last_seen_at else None,
    }


@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    """Upload avatar image; saves to uploads/avatars and sets user.avatar_url."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    name = f"{current.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOAD_DIR / name
    try:
        content = await file.read()
        path.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save file: {e}")
    url = f"/api/v1/static/avatars/{name}"
    current.avatar_url = url
    db.add(current)
    db.commit()
    return {"avatarUrl": url}


@router.post("/me/status")
def change_my_status(
    body: ProfileStatusChange,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    st = db.get(ProfileStatusModel, body.status.code)
    if not st:
        raise HTTPException(status_code=400, detail="Status code not found")

    prof = db.get(ProfileModel, current.id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")

    prof.status_code = body.status.code
    prof.status_payload = body.statusPayload
    db.add(prof)
    db.commit()

    return {
        "userId": current.id,
        "status": {"code": st.code, "label": st.label},
        "statusPayload": prof.status_payload,
        "links": prof.links or {},
        "arrivedAt": int(prof.arrived_at.timestamp() * 1000) if prof.arrived_at else None,
        "lastSeenAt": int(prof.last_seen_at.timestamp() * 1000) if prof.last_seen_at else None,
    }
