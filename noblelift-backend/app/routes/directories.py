from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.directory import Directory as DirectoryModel
from app.models.user import User as UserModel
from app.schemas.document import Directory as DirectorySchema, DirectoryCreate, DirectoryUpdate

router = APIRouter(prefix="/directories", tags=["Documents"])


def is_super_admin(current: UserModel) -> bool:
    return bool(current.role and current.role.code == "super_admin")


@router.get("", response_model=dict)
def list_directories(db: Session = Depends(get_db), current=Depends(get_current_user)):
    rows = db.execute(select(DirectoryModel).order_by(DirectoryModel.parent_id.nullsfirst(), DirectoryModel.name)).scalars().all()
    return {"items": [DirectorySchema.model_validate(r) for r in rows]}

@router.post("", response_model=DirectorySchema, status_code=201)
def create_directory(body: DirectoryCreate, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_super_admin(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    d = DirectoryModel(parent_id=body.parent_id, name=body.name)
    db.add(d); db.commit(); db.refresh(d)
    return DirectorySchema.model_validate(d)

@router.patch("/{id}", response_model=DirectorySchema)
def update_directory(id: int, body: DirectoryUpdate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = db.get(DirectoryModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")
    if body.parent_id is not None: d.parent_id = body.parent_id
    if body.name is not None: d.name = body.name
    db.add(d); db.commit(); db.refresh(d)
    return DirectorySchema.model_validate(d)

@router.delete("/{id}", status_code=204)
def delete_directory(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_super_admin(current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super_admin can delete directories")
    d = db.get(DirectoryModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")
    db.delete(d); db.commit()
    return
