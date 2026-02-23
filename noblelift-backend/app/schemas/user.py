from datetime import datetime
from pydantic import EmailStr, field_serializer
from app.schemas import CamelModel, to_ms
from app.schemas.role import Role
from app.schemas.profile import Profile

class User(CamelModel):
    id: int
    email: EmailStr
    phone: str | None = None
    full_name: str
    title: str | None = None
    avatar_url: str | None = None
    role: Role
    is_active: bool
    created_at: datetime
    profile: Profile | None = None

    @field_serializer("created_at")
    def _ser_dt(self, v: datetime):
        return to_ms(v)
