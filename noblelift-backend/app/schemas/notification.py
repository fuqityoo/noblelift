from __future__ import annotations
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, field_serializer

def to_ms(dt: datetime | None):
    if dt is None: return None
    return int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp() * 1000)

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda s: "".join([s.split("_")[0]] + [p.capitalize() for p in s.split("_")[1:]]),
        populate_by_name=True,
        from_attributes=True,
    )

class Notification(CamelModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str | None = None
    data: dict | None = None
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None

    @field_serializer("created_at","read_at")
    def _s(self, v: datetime | None): return to_ms(v)

class NotificationCreate(CamelModel):
    user_id: int
    type: str
    title: str
    message: str | None = None
    data: dict | None = None
