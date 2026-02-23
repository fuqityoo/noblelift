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

class Team(CamelModel):
    id: int
    name: str
    description: str | None = None
    created_by: int | None = None
    created_at: datetime
    @field_serializer("created_at")
    def _s(self, v: datetime): return to_ms(v)

class TeamCreate(CamelModel):
    name: str
    description: str | None = None

class TeamUpdate(CamelModel):
    name: str | None = None
    description: str | None = None

class TeamMember(CamelModel):
    id: int
    team_id: int
    user_id: int
    role: str
    created_at: datetime
    @field_serializer("created_at")
    def _s2(self, v: datetime): return to_ms(v)

class TeamMemberAdd(CamelModel):
    user_id: int
    role: str | None = None
