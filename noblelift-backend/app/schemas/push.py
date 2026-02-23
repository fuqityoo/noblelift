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

class PushSubscription(CamelModel):
    id: int
    user_id: int
    endpoint: str
    p256dh: str
    auth: str
    created_at: datetime
    @field_serializer("created_at")
    def _s(self, v: datetime): return to_ms(v)

class PushSubscribeRequest(CamelModel):
    endpoint: str
    p256dh: str
    auth: str
