from __future__ import annotations
import os
from pathlib import Path
from typing import Tuple
from app.core.config import settings

def task_dir(task_id: int) -> Path:
    p = Path(settings.STORAGE_DIR) / "tasks" / str(task_id)
    p.mkdir(parents=True, exist_ok=True)
    return p

def save_task_file(task_id: int, filename: str, data: bytes) -> Tuple[str, int]:
    base = task_dir(task_id)
    safe = filename.replace("/", "_").replace("\\", "_")
    path = base / safe
    with open(path, "wb") as f:
        f.write(data)
    size = path.stat().st_size
    rel = str(path)
    return rel, size
