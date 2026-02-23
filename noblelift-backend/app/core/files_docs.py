from __future__ import annotations
from pathlib import Path
from typing import Tuple
from app.core.config import settings

def doc_dir(doc_id: int) -> Path:
    p = Path(settings.STORAGE_DIR) / "docs" / str(doc_id)
    p.mkdir(parents=True, exist_ok=True)
    return p

def save_document_version(doc_id: int, filename: str, data: bytes) -> tuple[str, int]:
    base = doc_dir(doc_id)
    safe = filename.replace("/", "_").replace("\\", "_")
    path = base / safe
    with open(path, "wb") as f:
        f.write(data)
    size = path.stat().st_size
    return str(path), size
