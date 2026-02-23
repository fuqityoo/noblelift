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

class Vehicle(CamelModel):
    id: int
    number: str
    color: str | None = None
    brand: str | None = None
    model: str | None = None
    status: str
    holder_id: int | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at","updated_at")
    def _s(self, v: datetime): return to_ms(v)

class VehicleCreate(CamelModel):
    number: str
    color: str | None = None
    brand: str | None = None
    model: str | None = None
    status: str | None = None

class VehicleUpdate(CamelModel):
    number: str | None = None
    color: str | None = None
    brand: str | None = None
    model: str | None = None
    status: str | None = None

class VehicleLog(CamelModel):
    id: int
    vehicle_id: int
    user_id: int | None = None
    action: str
    payload: dict | None = None
    created_at: datetime
    @field_serializer("created_at")
    def _s2(self, v: datetime): return to_ms(v)
