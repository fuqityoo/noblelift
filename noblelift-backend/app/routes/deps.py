from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, Mapped

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission

bearer = HTTPBearer(auto_error=True)

def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    token = cred.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required")

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")

    user_id = int(payload.get("sub", 0))
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User disabled or not found")
    return user

def has_access(db: Session, user: User, object_type: str, object_id: Mapped[int], action: str) -> bool:
    if user.role and user.role.code == "super_admin":
        return True
    q1 = db.execute(
        select(Permission.id).where(
            Permission.subject_type == "user",
            Permission.subject_id == user.id,
            Permission.object_type == object_type,
            Permission.object_id == object_id,
            Permission.action.in_([action, "admin"])
        )
    ).first()
    if q1: return True
    if user.role_id:
        q2 = db.execute(
            select(Permission.id).where(
                Permission.subject_type == "role",
                Permission.subject_id == user.role_id,
                Permission.object_type == object_type,
                Permission.object_id == object_id,
                Permission.action.in_([action, "admin"])
            )
        ).first()
        if q2: return True
    return False
