from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, func, distinct
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.user import User as UserModel
from app.models.team import Team as TeamModel
from app.models.team_member import TeamMember as TeamMemberModel
from app.schemas.team import Team as TeamSchema, TeamCreate, TeamUpdate, TeamMember as TeamMemberSchema, TeamMemberAdd

router = APIRouter(prefix="/teams", tags=["Teams"])

def is_manager(u: UserModel) -> bool:
    return bool(u.role and u.role.code in ("super_admin", "manager"))

@router.get("", response_model=dict)
def list_teams(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    q: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(TeamModel)
    if q:
        ilike = f"%{q.lower()}%"
        from sqlalchemy import or_
        stmt = stmt.where(or_(TeamModel.name.ilike(ilike), TeamModel.description.ilike(ilike)))
    total = db.execute(
        (select(func.count(distinct(TeamModel.id))).where(stmt._where_criteria[0]) if stmt._where_criteria else select(func.count(distinct(TeamModel.id))))
    ).scalar_one()
    rows = db.execute(stmt.order_by(TeamModel.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    items: List[TeamSchema] = [TeamSchema.model_validate(t) for t in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/{id}", response_model=TeamSchema)
def get_team(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    t = db.get(TeamModel, id)
    if not t: raise HTTPException(status_code=404, detail="Not found")
    return TeamSchema.model_validate(t)

@router.post("", response_model=TeamSchema, status_code=201)
def create_team(body: TeamCreate, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current): raise HTTPException(status_code=403, detail="Forbidden")
    if db.execute(select(TeamModel.id).where(TeamModel.name == body.name)).first():
        raise HTTPException(status_code=400, detail="Name already exists")
    t = TeamModel(name=body.name, description=body.description, created_by=current.id)
    db.add(t); db.commit(); db.refresh(t)
    return TeamSchema.model_validate(t)

@router.patch("/{id}", response_model=TeamSchema)
def update_team(id: int, body: TeamUpdate, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current): raise HTTPException(status_code=403, detail="Forbidden")
    t = db.get(TeamModel, id)
    if not t: raise HTTPException(status_code=404, detail="Not found")
    if body.name is not None:
        if db.execute(select(TeamModel.id).where(TeamModel.name == body.name, TeamModel.id != id)).first():
            raise HTTPException(status_code=400, detail="Name already exists")
        t.name = body.name
    if body.description is not None:
        t.description = body.description
    db.add(t); db.commit(); db.refresh(t)
    return TeamSchema.model_validate(t)

@router.delete("/{id}", status_code=204)
def delete_team(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current): raise HTTPException(status_code=403, detail="Forbidden")
    t = db.get(TeamModel, id)
    if not t: raise HTTPException(status_code=404, detail="Not found")
    db.delete(t); db.commit()
    return

@router.get("/{id}/members", response_model=dict)
def list_members(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not db.get(TeamModel, id): raise HTTPException(status_code=404, detail="Not found")
    rows = db.execute(select(TeamMemberModel).where(TeamMemberModel.team_id == id)).scalars().all()
    items: List[TeamMemberSchema] = [TeamMemberSchema.model_validate(r) for r in rows]
    return {"items": items}

@router.post("/{id}/members", response_model=TeamMemberSchema, status_code=201)
def add_member(id: int, body: TeamMemberAdd, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current): raise HTTPException(status_code=403, detail="Forbidden")
    if not db.get(TeamModel, id): raise HTTPException(status_code=404, detail="Not found")
    exists = db.execute(
        select(TeamMemberModel.id).where(TeamMemberModel.team_id == id, TeamMemberModel.user_id == body.user_id)
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Already in team")
    m = TeamMemberModel(team_id=id, user_id=body.user_id, role=body.role or "member")
    db.add(m); db.commit(); db.refresh(m)
    return TeamMemberSchema.model_validate(m)

@router.delete("/{id}/members/{user_id}", status_code=204)
def remove_member(id: int, user_id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if not is_manager(current): raise HTTPException(status_code=403, detail="Forbidden")
    m = db.execute(
        select(TeamMemberModel).where(TeamMemberModel.team_id == id, TeamMemberModel.user_id == user_id)
    ).scalar_one_or_none()
    if not m: raise HTTPException(status_code=404, detail="Not found")
    db.delete(m); db.commit()
    return
