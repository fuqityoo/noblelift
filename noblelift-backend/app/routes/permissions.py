from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional, List
from app.core.audit import write_audit
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.permission import Permission as PermissionModel
from app.schemas.permission import Permission as PermissionSchema, PermissionCreate

router = APIRouter(prefix="/permissions", tags=["ACL"])

@router.get("", response_model=dict)
def list_permissions(
    object_type: str = Query(...),
    object_id: int = Query(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    rows = db.execute(
        select(PermissionModel).where(
            PermissionModel.object_type == object_type,
            PermissionModel.object_id == object_id
        )
    ).scalars().all()
    return {"items": [PermissionSchema.model_validate(r) for r in rows]}

@router.post("", response_model=PermissionSchema, status_code=201)
def add_permission(body: PermissionCreate, request: Request, db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = PermissionModel(
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        object_type=body.object_type,
        object_id=body.object_id,
        action=body.action,
    )
    db.add(p); db.commit(); db.refresh(p)

    write_audit(db, actor_id=current.id, action="perm_add", entity=body.object_type, entity_id=body.object_id,
                payload=body.model_dump(), request=request)

    return PermissionSchema.model_validate(p)

@router.delete("/{id}", status_code=204)
def delete_permission(id: int, request: Request, db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = db.get(PermissionModel, id)
    if not p: raise HTTPException(status_code=404, detail="Not found")
    db.delete(p); db.commit()

    write_audit(db, actor_id=current.id, action="perm_del", entity=str(p.object_type), entity_id=p.object_id,
                payload={"permId": id}, request=request)

    return
