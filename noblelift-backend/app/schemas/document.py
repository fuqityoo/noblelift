from __future__ import annotations
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional

def to_ms(dt: datetime | None):
    if dt is None: return None
    return int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp() * 1000)

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda s: "".join([s.split("_")[0]] + [p.capitalize() for p in s.split("_")[1:]]),
        populate_by_name=True,
        from_attributes=True,
    )

class Directory(CamelModel):
    id: int
    parent_id: int | None = None
    name: str
    created_at: datetime
    @field_serializer("created_at")
    def _s1(self, v: datetime): return to_ms(v)

class DirectoryCreate(CamelModel):
    parent_id: int | None = None
    name: str

class DirectoryUpdate(CamelModel):
    parent_id: int | None = None
    name: str | None = None

class Document(CamelModel):
    id: int
    directory_id: int | None = None
    title: str
    description: str | None = None
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime
    @field_serializer("created_at","updated_at")
    def _s2(self, v: datetime): return to_ms(v)

class DocumentCreate(CamelModel):
    directory_id: int | None = None
    title: str
    description: str | None = None

class DocumentUpdate(CamelModel):
    directory_id: int | None = None
    title: str | None = None
    description: str | None = None

class DocumentVersion(CamelModel):
    id: int
    document_id: int
    version: int
    original_name: str
    mime: str | None = None
    size: int
    storage_path: str
    created_by: int | None = None
    created_at: datetime
    @field_serializer("created_at")
    def _s3(self, v: datetime): return to_ms(v)
