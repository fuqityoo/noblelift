from __future__ import annotations
from typing import Optional, List
import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from sqlalchemy import select, and_, func, distinct, update, delete
from sqlalchemy.orm import Session, joinedload
from app.core.audit import write_audit
from app.db.session import get_db
from app.routes.deps import get_current_user
from app.models.task import Task as TaskModel
from app.models.task_topic import TaskTopic as TaskTopicModel
from app.models.task_event import TaskEvent as TaskEventModel
from app.models.user import User as UserModel
from app.models.role import Role as RoleModel
from app.schemas.task import Task as TaskSchema, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def is_super_admin_or_manager(u: UserModel) -> bool:
    return bool(u.role and u.role.code in ("super_admin", "manager"))


def is_super_admin(u: UserModel) -> bool:
    return bool(u.role and u.role.code == "super_admin")


@router.get("", response_model=dict)
def list_tasks(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None),
    status_code: Optional[str] = Query(None, alias="status"),
    assignee_id: Optional[int] = Query(None),
    topic_id: Optional[int] = Query(None),
    is_private: Optional[bool] = Query(None),
    archived: Optional[bool] = Query(None),
):
    stmt = select(TaskModel)
    filters = []

    if q:
        ilike = f"%{q.lower()}%"
        filters.append((TaskModel.title.ilike(ilike)) | (TaskModel.content.ilike(ilike)))
    if status_code:
        filters.append(TaskModel.status_code == status_code)
    if assignee_id is not None:
        filters.append(TaskModel.assignee_id == assignee_id)
    if topic_id is not None:
        filters.append(TaskModel.topic_id == topic_id)
    if is_private is not None:
        filters.append(TaskModel.is_private == is_private)
    if archived is not None:
        if archived:
            filters.append(TaskModel.archived_at.is_not(None))
        else:
            filters.append(TaskModel.archived_at.is_(None))

    if filters:
        stmt = stmt.where(and_(*filters))

    total = db.execute(
        select(func.count(distinct(TaskModel.id))).select_from(TaskModel).where(and_(*filters)) if filters
        else select(func.count(distinct(TaskModel.id)))
    ).scalar_one()

    data_stmt = (
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
    )
    if filters:
        data_stmt = data_stmt.where(and_(*filters))

    rows = db.execute(
        data_stmt.order_by(TaskModel.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items: List[TaskSchema] = [TaskSchema.model_validate(t) for t in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/{id}", response_model=TaskSchema)
def get_task(id: int, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskSchema.model_validate(t)

@router.post("", response_model=TaskSchema, status_code=201)
def create_task(body: TaskCreate, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    if body.topic_id is not None and not db.get(TaskTopicModel, body.topic_id):
        raise HTTPException(status_code=400, detail="Topic not found")
    if body.assignee_id is not None and not db.get(UserModel, body.assignee_id):
        raise HTTPException(status_code=400, detail="Assignee not found")

    t = TaskModel(
        title=body.title,
        content=body.content,
        due_date=body.due_date,
        priority_code=body.priority_code or "medium",
        status_code=body.status_code or "new",
        is_private=bool(body.is_private) if body.is_private is not None else False,
        type=body.type or "regular",
        topic_id=body.topic_id,
        assignee_id=body.assignee_id,
        creator_id=current.id,
    )
    db.add(t); db.commit(); db.refresh(t)
    db.add(TaskEventModel(task_id=t.id, actor_id=current.id, type="created", payload={"title": t.title}))
    db.commit()

    write_audit(db, actor_id=current.id, action="create",
                entity="task", entity_id=t.id, payload={"title": t.title},
                request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == t.id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.patch("/{id}", response_model=TaskSchema)
def update_task(id: int, body: TaskUpdate, request: Request, db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    t = db.get(TaskModel, id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    ALLOWED_STATUS_CODES = {"new", "in_progress", "pause", "done"}
    if body.status_code is not None:
        code = str(body.status_code).strip().lower()
        if code not in ALLOWED_STATUS_CODES:
            raise HTTPException(status_code=400, detail=f"Invalid status_code. Allowed: {sorted(ALLOWED_STATUS_CODES)}")
        t.status_code = code
    if body.title is not None: t.title = body.title
    if body.content is not None: t.content = body.content
    if body.due_date is not None: t.due_date = body.due_date
    if body.priority_code is not None: t.priority_code = body.priority_code
    if body.is_private is not None: t.is_private = body.is_private
    if body.type is not None: t.type = body.type
    if body.topic_id is not None:
        if body.topic_id and not db.get(TaskTopicModel, body.topic_id):
            raise HTTPException(status_code=400, detail="Topic not found")
        t.topic_id = body.topic_id
    if body.assignee_id is not None:
        if body.assignee_id and not db.get(UserModel, body.assignee_id):
            raise HTTPException(status_code=400, detail="Assignee not found")
        t.assignee_id = body.assignee_id

    db.add(t); db.commit(); db.refresh(t)
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="updated"))
    db.commit()

    write_audit(db, actor_id=current.id, action="update", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.get("/available", response_model=dict)
def list_available_tasks(
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    filters = [
        TaskModel.type == "common",
        TaskModel.is_private.is_(False),
        TaskModel.archived_at.is_(None),
        TaskModel.assignee_id.is_(None),
    ]

    total = db.execute(
        select(func.count(distinct(TaskModel.id))).where(and_(*filters))
    ).scalar_one()

    rows = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(and_(*filters))
        .order_by(TaskModel.created_at.desc())
        .limit(limit).offset(offset)
    ).scalars().all()

    items = [TaskSchema.model_validate(t) for t in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.post("/{id}/take", response_model=TaskSchema)
def take_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    stmt = (
        update(TaskModel)
        .where(
            TaskModel.id == id,
            TaskModel.assignee_id.is_(None),
            TaskModel.type == "common",
            TaskModel.is_private.is_(False),
            TaskModel.archived_at.is_(None),
        )
        .values(assignee_id=current.id, status_code="in_progress")
        .returning(TaskModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=409, detail="Task is not available to take")

    db.commit()
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="taken"))
    db.commit()

    write_audit(db, actor_id=current.id, action="take", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.post("/{id}/release", response_model=TaskSchema)
def release_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    stmt = (
        update(TaskModel)
        .where(TaskModel.id == id, TaskModel.assignee_id == current.id, TaskModel.archived_at.is_(None))
        .values(assignee_id=None, status_code="new")
        .returning(TaskModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=409, detail="Task is not assigned to you or archived")

    db.commit()
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="released"))
    db.commit()

    write_audit(db, actor_id=current.id, action="release", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.post("/{id}/assign", response_model=TaskSchema)
def assign_task(
    id: int,
    request: Request,
    assigneeId: int = Query(..., alias="assigneeId"),
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not is_super_admin_or_manager(current):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not db.get(UserModel, assigneeId):
      raise HTTPException(status_code=400, detail="Assignee not found")

    stmt = (
        update(TaskModel)
        .where(TaskModel.id == id, TaskModel.archived_at.is_(None))
        .values(assignee_id=assigneeId)
        .returning(TaskModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=404, detail="Task not found or archived")

    db.commit()
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="assigned", payload={"assigneeId": assigneeId}))
    db.commit()

    write_audit(db, actor_id=current.id, action="assign",
                entity="task", entity_id=id, payload={"assigneeId": assigneeId},
                request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.post("/{id}/unassign", response_model=TaskSchema)
def unassign_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not is_super_admin_or_manager(current):
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = (
        update(TaskModel)
        .where(TaskModel.id == id, TaskModel.archived_at.is_(None))
        .values(assignee_id=None)
        .returning(TaskModel.id)
    )
    res = db.execute(stmt).first()
    if not res:
        raise HTTPException(status_code=404, detail="Task not found or archived")

    db.commit()
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="unassigned"))
    db.commit()

    write_audit(db, actor_id=current.id, action="unassign", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.post("/{id}/archive", response_model=TaskSchema)
def archive_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    t = db.get(TaskModel, id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    if t.archived_at is not None:
        raise HTTPException(status_code=409, detail="Already archived")
    if t.status_code != "done":
        raise HTTPException(status_code=400, detail="Only done tasks can be archived")

    t.archived_at = datetime.now(tz=timezone.utc)
    db.add(t); db.commit(); db.refresh(t)
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="archived"))
    db.commit()

    write_audit(db, actor_id=current.id, action="archive", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)

@router.post("/{id}/unarchive", response_model=TaskSchema)
def unarchive_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    t = db.get(TaskModel, id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    if t.archived_at is None:
        raise HTTPException(status_code=409, detail="Not archived")

    t.archived_at = None
    db.add(t); db.commit(); db.refresh(t)
    db.add(TaskEventModel(task_id=id, actor_id=current.id, type="unarchived"))
    db.commit()

    write_audit(db, actor_id=current.id, action="unarchive", entity="task", entity_id=id, request=request)

    t = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.topic),
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
        )
        .where(TaskModel.id == id)
    ).scalar_one()
    return TaskSchema.model_validate(t)


@router.delete("/{id}", status_code=204)
def delete_task(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    """Удалить задачу из БД. Только super_admin."""
    if not is_super_admin(current):
        raise HTTPException(status_code=403, detail="Forbidden")
    t = db.get(TaskModel, id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t)
    db.commit()
    write_audit(db, actor_id=current.id, action="delete", entity="task", entity_id=id, request=request)
    return


# Перевод кодов и флагов в русский для CSV-архива
_PRIORITY_RU = {"low": "низкий", "medium": "средний", "high": "высокий", "urgent": "срочный"}
_STATUS_RU = {"new": "Новая", "in_progress": "В работе", "pause": "Пауза", "done": "Завершена"}
_TYPE_RU = {"regular": "Личная", "common": "Общая"}


def _fmt_dt(dt: Optional[datetime]) -> str:
    if not dt: return ""
    return dt.strftime("%d.%m.%Y %H:%M") if hasattr(dt, "strftime") else str(dt)


@router.post("/archive/download-and-clear")
def archive_download_and_clear(
    request: Request,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    """Скачать CSV всех завершённых задач и удалить их из БД. Только super_admin."""
    if not is_super_admin(current):
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.execute(
        select(TaskModel)
        .options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.creator),
            joinedload(TaskModel.topic),
        )
        .where(TaskModel.status_code == "done")
        .order_by(TaskModel.id)
    ).scalars().all()
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "ID", "Название", "Тема", "Описание", "Срок", "Приоритет", "Статус",
        "Личная", "Тип задачи", "ID создателя", "ID исполнителя", "Исполнитель", "Создатель", "Создано"
    ])
    for t in rows:
        pc = (t.priority_code or "").strip().lower()
        sc = (t.status_code or "").strip().lower()
        tc = (t.type or "").strip().lower()
        writer.writerow([
            t.id,
            (t.title or "").replace("\n", " ").replace("\r", ""),
            (t.topic.name if t.topic else "").replace("\n", " ").replace("\r", ""),
            ((t.content or "")[:500]).replace("\n", " ").replace("\r", ""),
            _fmt_dt(t.due_date),
            _PRIORITY_RU.get(pc, pc or "средний"),
            _STATUS_RU.get(sc, sc or "Новая"),
            "Да" if t.is_private else "Нет",
            _TYPE_RU.get(tc, tc or "Личная"),
            t.creator_id,
            t.assignee_id or "",
            (t.assignee.full_name if t.assignee else "").replace("\n", " ").replace("\r", ""),
            (t.creator.full_name if t.creator else "").replace("\n", " ").replace("\r", ""),
            _fmt_dt(t.created_at),
        ])
    db.execute(delete(TaskModel).where(TaskModel.status_code == "done"))
    db.commit()
    output.seek(0)
    csv_content = output.getvalue()
    # UTF-8 with BOM для корректного отображения кириллицы в Excel и браузере
    body = csv_content.encode("utf-8-sig")
    return StreamingResponse(
        iter([body]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=archive_tasks.csv"},
    )