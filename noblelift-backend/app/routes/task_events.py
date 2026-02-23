from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.task import Task as TaskModel
from app.models.task_event import TaskEvent as TaskEventModel
from app.schemas.task_event import TaskEvent as TaskEventSchema

router = APIRouter(prefix="/tasks", tags=["Task Events"])

@router.get("/{task_id}/events", response_model=dict)
def list_task_events(
    task_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current = Depends(get_current_user),
):
    if not db.get(TaskModel, task_id):
        raise HTTPException(status_code=404, detail="Task not found")

    total = db.execute(
        select(TaskEventModel).where(TaskEventModel.task_id == task_id)
    ).scalars().all()
    total_len = len(total)

    rows = db.execute(
        select(TaskEventModel)
        .where(TaskEventModel.task_id == task_id)
        .order_by(TaskEventModel.created_at.desc())
        .limit(limit).offset(offset)
    ).scalars().all()

    items: List[TaskEventSchema] = [TaskEventSchema.model_validate(r) for r in rows]
    return {"items": items, "total": total_len, "limit": limit, "offset": offset}
