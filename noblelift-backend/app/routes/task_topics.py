from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.task_topic import TaskTopic as TaskTopicModel
from app.schemas.task import TaskTopic as TaskTopicSchema, TaskTopicCreate, TaskTopicUpdate

router = APIRouter(prefix="/task-topics", tags=["Tasks"])

@router.get("")
def list_topics(db: Session = Depends(get_db), current=Depends(get_current_user)):
    rows = db.execute(select(TaskTopicModel).order_by(TaskTopicModel.name)).scalars().all()
    return {"items": [TaskTopicSchema.model_validate(r) for r in rows]}

@router.post("", response_model=TaskTopicSchema, status_code=201)
def create_topic(body: TaskTopicCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if db.execute(select(TaskTopicModel.id).where(TaskTopicModel.name == body.name)).first():
        raise HTTPException(status_code=400, detail="Topic already exists")
    r = TaskTopicModel(name=body.name)
    db.add(r); db.commit(); db.refresh(r)
    return TaskTopicSchema.model_validate(r)

@router.patch("/{id}", response_model=TaskTopicSchema)
def update_topic(id: int, body: TaskTopicUpdate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    r = db.get(TaskTopicModel, id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if body.name is not None:
        r.name = body.name
    db.add(r); db.commit(); db.refresh(r)
    return TaskTopicSchema.model_validate(r)

@router.delete("/{id}", status_code=204)
def delete_topic(id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    r = db.get(TaskTopicModel, id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r); db.commit()
    return
