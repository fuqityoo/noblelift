from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, and_, func, distinct, delete, or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.routes.deps import get_current_user
from app.core.security import hash_password
from app.models.user import User as UserModel
from app.models.role import Role as RoleModel
from app.models.profile import Profile as ProfileModel
from app.models.status import ProfileStatus as ProfileStatusModel
from app.models.task import Task as TaskModel

from app.schemas.user import User as UserSchema

router = APIRouter(prefix="/users", tags=["Users"])


# ---------- Вспомогательные проверки ролей ----------
def ensure_super_admin(current: UserModel):
    if not current.role or current.role.code != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super_admin allowed")


# ---------- Pydantic-схемы запросов ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    fullName: str
    roleId: int
    phone: Optional[str] = None
    title: Optional[str] = None
    avatarUrl: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    fullName: Optional[str] = None
    roleId: Optional[int] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    avatarUrl: Optional[str] = None
    isActive: Optional[bool] = None


# ---------- Список пользователей ----------
@router.get("", response_model=dict)
def list_users(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None, description="Поиск по email/ФИО"),
    role: Optional[str] = Query(None, description="Код роли: super_admin|manager|employee"),
    status_code: Optional[str] = Query(None, alias="status", description="Код статуса профиля"),
):
    base_stmt = select(UserModel)

    filters = []
    join_role = False
    join_profile = False

    if q:
        ilike = f"%{q.lower()}%"
        filters.append((UserModel.email.ilike(ilike)) | (UserModel.full_name.ilike(ilike)))
    if role:
        join_role = True
        filters.append(RoleModel.code == role)
    if status_code:
        join_profile = True
        filters.append(ProfileModel.status_code == status_code)

    stmt = base_stmt
    if join_role:
        stmt = stmt.join(RoleModel, UserModel.role_id == RoleModel.id)
    if join_profile:
        stmt = stmt.join(ProfileModel, ProfileModel.user_id == UserModel.id)
    if filters:
        stmt = stmt.where(and_(*filters))

    total_stmt = select(func.count(distinct(UserModel.id)))
    if join_role or join_profile or filters:
        total_stmt = total_stmt.select_from(UserModel)
        if join_role:
            total_stmt = total_stmt.join(RoleModel, UserModel.role_id == RoleModel.id)
        if join_profile:
            total_stmt = total_stmt.join(ProfileModel, ProfileModel.user_id == UserModel.id)
        if filters:
            total_stmt = total_stmt.where(and_(*filters))

    total = db.execute(total_stmt).scalar_one()

    data_stmt = (
        select(UserModel)
        .options(
            joinedload(UserModel.role),
            joinedload(UserModel.profile).joinedload(ProfileModel.status),
        )
    )
    if join_role:
        data_stmt = data_stmt.join(RoleModel, UserModel.role_id == RoleModel.id)
    if join_profile:
        data_stmt = data_stmt.join(ProfileModel, ProfileModel.user_id == UserModel.id)
    if filters:
        data_stmt = data_stmt.where(and_(*filters))

    rows = db.execute(
        data_stmt.order_by(UserModel.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items: List[UserSchema] = [UserSchema.model_validate(u) for u in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ---------- Карточка пользователя ----------
@router.get("/{id}", response_model=UserSchema)
def get_user(
    id: int,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    user = db.execute(
        select(UserModel)
        .options(
            joinedload(UserModel.role),
            joinedload(UserModel.profile).joinedload(ProfileModel.status),
        )
        .where(UserModel.id == id)
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserSchema.model_validate(user)


# ---------- Создать пользователя ----------
@router.post("", response_model=UserSchema, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    ensure_super_admin(current)

    if db.execute(select(UserModel.id).where(UserModel.email == body.email)).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    role = db.get(RoleModel, body.roleId)
    if not role:
        raise HTTPException(status_code=400, detail="Role not found")

    user = UserModel(
        email=str(body.email),
        password_hash=hash_password(body.password),
        full_name=body.fullName,
        title=body.title,
        phone=body.phone,
        avatar_url=body.avatarUrl,
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if not db.get(ProfileModel, user.id):
        db.add(ProfileModel(user_id=user.id, status_code="in_office"))
        db.commit()

    user = db.execute(
        select(UserModel)
        .options(
            joinedload(UserModel.role),
            joinedload(UserModel.profile).joinedload(ProfileModel.status),
        )
        .where(UserModel.id == user.id)
    ).scalar_one()

    return UserSchema.model_validate(user)


# ---------- Обновить пользователя ----------
@router.patch("/{id}", response_model=UserSchema)
def update_user(
    id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    user = db.get(UserModel, id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.roleId is not None or body.isActive is not None or body.email is not None:
        ensure_super_admin(current)

    if body.email is not None:
        exists = db.execute(
            select(UserModel.id).where(
                (UserModel.email == str(body.email)) & (UserModel.id != id)
            )
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = str(body.email)

    if body.fullName is not None:
        user.full_name = body.fullName
    if body.phone is not None:
        user.phone = body.phone
    if body.title is not None:
        user.title = body.title
    if body.avatarUrl is not None:
        user.avatar_url = body.avatarUrl
    if body.roleId is not None:
        role = db.get(RoleModel, body.roleId)
        if not role:
            raise HTTPException(status_code=400, detail="Role not found")
        user.role_id = role.id
    if body.isActive is not None:
        user.is_active = body.isActive

    db.add(user)
    db.commit()

    user = db.execute(
        select(UserModel)
        .options(
            joinedload(UserModel.role),
            joinedload(UserModel.profile).joinedload(ProfileModel.status),
        )
        .where(UserModel.id == id)
    ).scalar_one()

    return UserSchema.model_validate(user)


# ---------- Удалить пользователя (с его задачами) ----------
@router.delete("/{id}", status_code=204)
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    ensure_super_admin(current)

    user = db.get(UserModel, id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Нельзя удалить себя, чтобы случайно не потерять супер-админский доступ
    if current.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Удаляем все задачи, созданные этим пользователем или назначенные на него.
    # Связанные файлы и события удалятся каскадно по ondelete=CASCADE.
    db.execute(
        delete(TaskModel).where(
            or_(TaskModel.creator_id == id, TaskModel.assignee_id == id)
        )
    )
    db.commit()

    # Профиль и прочие связанные сущности с ondelete=CASCADE удалятся вместе с пользователем.
    db.delete(user)
    db.commit()
    return
