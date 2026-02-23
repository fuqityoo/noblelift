from __future__ import annotations
from pydantic import BaseModel, ConfigDict

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda s: "".join([s.split("_")[0]] + [p.capitalize() for p in s.split("_")[1:]]),
        populate_by_name=True,
        from_attributes=True,
    )

class Permission(CamelModel):
    id: int
    subject_type: str
    subject_id: int
    object_type: str
    object_id: int
    action: str

class PermissionCreate(CamelModel):
    subject_type: str
    subject_id: int
    object_type: str
    object_id: int
    action: str
