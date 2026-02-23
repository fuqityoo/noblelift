from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, field_serializer

def to_ms(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    return int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp() * 1000)

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda s: "".join([s.split("_")[0]] + [p.capitalize() for p in s.split("_")[1:]]),
        populate_by_name=True,
        from_attributes=True,
    )

class TaskTopic(CamelModel):
    id: int
    name: str
    created_at: datetime
    @field_serializer("created_at")
    def _s1(self, v: datetime): return to_ms(v)

class TaskTopicCreate(CamelModel):
    name: str

class TaskTopicUpdate(CamelModel):
    name: Optional[str] = None

class TaskBase(CamelModel):
    title: str
    content: Optional[str] = None
    due_date: Optional[datetime] = None
    priority_code: Optional[str] = None
    status_code: Optional[str] = None
    is_private: Optional[bool] = None
    type: Optional[str] = None
    topic_id: Optional[int] = None
    assignee_id: Optional[int] = None

    @field_serializer("due_date")
    def _s2(self, v: Optional[datetime]): return to_ms(v)

class TaskCreate(TaskBase):
    title: str

class TaskUpdate(TaskBase):
    title: Optional[str] = None

class Task(CamelModel):
    id: int
    title: str
    content: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    priority_code: str
    status_code: str
    is_private: bool
    type: str
    topic_id: Optional[int] = None
    assignee_id: Optional[int] = None
    creator_id: int
    archived_at: Optional[datetime] = None
    topic: Optional[TaskTopic] = None

    @field_serializer("due_date", "created_at", "archived_at")
    def _s3(self, v: Optional[datetime]): return to_ms(v)
