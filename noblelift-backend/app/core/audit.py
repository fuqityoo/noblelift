from __future__ import annotations
from typing import Any, Mapping, Optional
from fastapi import Request
from sqlalchemy.orm import Session, Mapped
from app.models.audit_log import AuditLog

def write_audit(db: Session, *, actor_id: Optional[Mapped[int]] | int,
                action: str, entity: str, entity_id: Optional[Mapped[int]] | int = None,
                payload: Mapping[str, Any] | None = None, request: Request | None = None) -> None:
    ip = None
    ua = None
    if request is not None:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
    db.add(AuditLog(actor_id=actor_id, action=action, entity=entity, entity_id=entity_id, payload=dict(payload) if payload else None, ip=ip, ua=ua))
    db.commit()
