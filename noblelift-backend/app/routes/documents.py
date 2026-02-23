from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Query, Request
from sqlalchemy import select, and_, func, distinct
from sqlalchemy.orm import Session
from app.core.audit import write_audit
from app.db.session import get_db
from app.routes.deps import get_current_user, has_access
from app.models.user import User as UserModel

def is_super_admin(current: UserModel) -> bool:
    return bool(current.role and current.role.code == "super_admin")
from app.models.document import Document as DocumentModel
from app.models.document_version import DocumentVersion as DocVerModel
from app.models.permission import Permission as PermissionModel
from app.schemas.document import Document as DocumentSchema, DocumentCreate, DocumentUpdate, DocumentVersion as DocVerSchema
from app.schemas.permission import Permission as PermissionSchema, PermissionCreate
from app.core.files_docs import save_document_version

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("", response_model=dict)
def list_documents(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
    directory_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(DocumentModel)
    filters = []
    if directory_id is not None:
        filters.append(DocumentModel.directory_id == directory_id)
    if q:
        ilike = f"%{q.lower()}%"
        filters.append((DocumentModel.title.ilike(ilike)) | (DocumentModel.description.ilike(ilike)))
    if filters:
        stmt = stmt.where(and_(*filters))

    total = db.execute(
        (select(func.count(distinct(DocumentModel.id))).where(and_(*filters))) if filters
        else select(func.count(distinct(DocumentModel.id)))
    ).scalar_one()

    rows = db.execute(
        stmt.order_by(DocumentModel.updated_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items: List[DocumentSchema] = [DocumentSchema.model_validate(r) for r in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.get("/{id}", response_model=DocumentSchema)
def get_document(id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = db.get(DocumentModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")
    if not has_access(db, current, "document", d.id, "read"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return DocumentSchema.model_validate(d)

@router.post("", response_model=DocumentSchema, status_code=201)
def create_document(body: DocumentCreate, request: Request, db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = DocumentModel(
        directory_id=body.directory_id,
        title=body.title,
        description=body.description,
        created_by=current.id,
        created_at=datetime.now(tz=timezone.utc),
        updated_at=datetime.now(tz=timezone.utc),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    perm = PermissionModel(
        subject_type="user",
        subject_id=current.id,
        object_type="document",
        object_id=d.id,
        action="admin",
    )
    db.add(perm)
    db.commit()

    write_audit(db, actor_id=current.id, action="create", entity="document", entity_id=d.id, request=request)

    return DocumentSchema.model_validate(d)

@router.patch("/{id}", response_model=DocumentSchema)
def update_document(id: int, body: DocumentUpdate, request: Request, db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = db.get(DocumentModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")
    if not has_access(db, current, "document", d.id, "write"):
        raise HTTPException(status_code=403, detail="Forbidden")

    if body.directory_id is not None: d.directory_id = body.directory_id
    if body.title is not None: d.title = body.title
    if body.description is not None: d.description = body.description
    d.updated_at = datetime.now(tz=timezone.utc)

    db.add(d); db.commit(); db.refresh(d)

    write_audit(db, actor_id=current.id, action="update", entity="document", entity_id=id, request=request)

    return DocumentSchema.model_validate(d)

@router.delete("/{id}", status_code=204)
def delete_document(id: int, request: Request, db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = db.get(DocumentModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")
    if not is_super_admin(current):
        raise HTTPException(status_code=403, detail="Only super_admin can delete documents")
    db.delete(d); db.commit()

    write_audit(db, actor_id=current.id, action="delete", entity="document", entity_id=id, request=request)

    return


@router.get("/{id}/versions", response_model=dict)
def list_versions(id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if not db.get(DocumentModel, id): raise HTTPException(status_code=404, detail="Not found")
    rows = db.execute(select(DocVerModel).where(DocVerModel.document_id == id).order_by(DocVerModel.version.desc())).scalars().all()
    return {"items": [DocVerSchema.model_validate(r) for r in rows]}

@router.post("/{id}/versions", response_model=DocVerSchema, status_code=201)
async def upload_version(id: int, request: Request, f: UploadFile = File(...), db: Session = Depends(get_db), current=Depends(get_current_user)):
    d = db.get(DocumentModel, id)
    if not d: raise HTTPException(status_code=404, detail="Not found")

    data = await f.read()
    path, size = save_document_version(id, f.filename, data)

    last = db.execute(select(DocVerModel.version).where(DocVerModel.document_id == id).order_by(DocVerModel.version.desc())).scalar_one_or_none()
    ver = (last or 0) + 1

    dv = DocVerModel(
        document_id=id,
        version=ver,
        original_name=f.filename,
        mime=f.content_type,
        size=size,
        storage_path=path,
        created_by=current.id,
    )
    db.add(dv)
    d.updated_at = datetime.now(tz=timezone.utc)
    db.add(d)
    db.commit()
    db.refresh(dv)

    write_audit(db, actor_id=current.id, action="version_add", entity="document", entity_id=id,
                payload={"name": f.filename}, request=request)

    return DocVerSchema.model_validate(dv)

@router.get("/{id}/versions/{ver}")
def download_version(id: int, ver: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    dv = db.execute(
        select(DocVerModel).where(DocVerModel.document_id == id, DocVerModel.version == ver)
    ).scalar_one_or_none()
    if not dv: raise HTTPException(status_code=404, detail="Not found")
    try:
        data = open(dv.storage_path, "rb").read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File missing")
    return Response(content=data, media_type=dv.mime or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{dv.original_name}"'})
