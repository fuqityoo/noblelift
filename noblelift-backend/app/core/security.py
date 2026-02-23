from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: Any) -> bool:
    return pwd_context.verify(plain, hashed)

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)

def create_access_token(sub: str, extra: Optional[dict[str, Any]] = None) -> str:
    expire = _now() + timedelta(minutes=settings.ACCESS_EXPIRES_MIN)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def create_refresh_token(sub: str, extra: Optional[dict[str, Any]] = None) -> str:
    expire = _now() + timedelta(days=settings.REFRESH_EXPIRES_DAYS)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": "refresh",
        "iat": int(_now().timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except JWTError as e:
        raise ValueError(str(e))
