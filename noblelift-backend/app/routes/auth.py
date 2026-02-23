from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.db.session import get_db
from app.models.user import User
from app.routes.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

# ---- Pydantic-схемы ----

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: bool | None = None

class RefreshRequest(BaseModel):
    refresh: str

class AuthTokens(BaseModel):
    access: str
    refresh: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

# ---- Handlers ----

@router.post("/login", response_model=AuthTokens)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    return AuthTokens(access=access, refresh=refresh)

@router.post("/refresh", response_model=AuthTokens)
def refresh_tokens(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")

    sub = payload.get("sub")
    access = create_access_token(sub)
    refresh = create_refresh_token(sub)
    return AuthTokens(access=access, refresh=refresh)

@router.post("/logout", status_code=204)
def logout():
    return

@router.post("/password/change", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.currentPassword, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wrong current password")

    user.password_hash = hash_password(body.newPassword)
    db.add(user)
    db.commit()
    return
