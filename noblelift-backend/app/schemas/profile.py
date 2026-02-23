from typing import Any
from datetime import datetime
from pydantic import field_serializer
from app.schemas import CamelModel, to_ms

class ProfileStatus(CamelModel):
    code: str
    label: str

class ProfileLinks(CamelModel):
    telegram: str | None = None
    whatsapp: str | None = None
    email: str | None = None
    phone: str | None = None

class Profile(CamelModel):
    user_id: int
    status: ProfileStatus
    status_payload: dict[str, Any] | None = None
    links: ProfileLinks | None = None
    arrived_at: datetime | None = None
    last_seen_at: datetime | None = None

    @field_serializer("arrived_at", "last_seen_at")
    def _ser_dt(self, v: datetime | None):
        return to_ms(v)
