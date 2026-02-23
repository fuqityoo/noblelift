from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.audit import write_audit
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.task import Task as TaskModel
from app.models.task_file import TaskFile as TaskFileModel
from app.models.task_event import TaskEvent as TaskEventModel
from app.models.user import User as UserModel
from app.core.files import save_task_file
from app.schemas.task_file import TaskFile as TaskFileSchema
from typing import List

router = APIRouter(prefix="/tasks", tags=["Task Files"])

@router.post("/{task_id}/files", response_model=TaskFileSchema, status_code=201)
async def upload_task_file(
    task_id: int,
    request: Request,
    f: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    t = db.get(TaskModel, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    data = await f.read()
    storage_path, size = save_task_file(task_id, f.filename, data)

    tf = TaskFileModel(
        task_id=task_id,
        uploader_id=current.id,
        original_name=f.filename,
        mime=f.content_type,
        size=size,
        storage_path=storage_path,
    )
    db.add(tf)
    db.commit()
    db.refresh(tf)

    db.add(TaskEventModel(task_id=task_id, actor_id=current.id, type="file_added", payload={"name": f.filename, "size": size}))
    db.commit()

    write_audit(db, actor_id=current.id, action="file_add", entity="task", entity_id=task_id,
                payload={"name": f.filename, "size": size}, request=request)

    return TaskFileSchema.model_validate(tf)

@router.get("/{task_id}/files", response_model=dict)
def list_task_files(
    task_id: int,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not db.get(TaskModel, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    rows = db.execute(
        select(TaskFileModel).where(TaskFileModel.task_id == task_id).order_by(TaskFileModel.created_at.desc())
    ).scalars().all()
    items: List[TaskFileSchema] = [TaskFileSchema.model_validate(r) for r in rows]
    return {"items": items}

@router.get("/{task_id}/files/{file_id}")
def download_task_file(
    task_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    tf = db.get(TaskFileModel, file_id)
    if not tf or tf.task_id != task_id:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data = open(tf.storage_path, "rb").read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File missing in storage")
    return Response(content=data, media_type=tf.mime or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{tf.original_name}"'})

@router.delete("/{task_id}/files/{file_id}", status_code=204)
def delete_task_file(
    task_id: int,
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    tf = db.get(TaskFileModel, file_id)
    if not tf or tf.task_id != task_id:
        raise HTTPException(status_code=404, detail="File not found")

    db.delete(tf)
    db.add(TaskEventModel(task_id=task_id, actor_id=current.id, type="file_removed", payload={"id": file_id}))
    db.commit()

    write_audit(db, actor_id=current.id, action="file_delete", entity="task", entity_id=task_id,
                payload={"fileId": file_id}, request=request)

    return
