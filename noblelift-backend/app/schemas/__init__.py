from typing import Any
from pydantic import BaseModel, ConfigDict, field_serializer
from datetime import datetime, timezone

def to_ms(dt: datetime | None) -> int | None:
    if dt is None:
        return None
    return int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp() * 1000)

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda s: "".join([s.split("_")[0]] + [p.capitalize() for p in s.split("_")[1:]]),
        populate_by_name=True,
        from_attributes=True,
    )
