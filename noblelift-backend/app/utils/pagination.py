from __future__ import annotations
from typing import Any, Iterable

def page(items: Iterable[Any], total: int, limit: int, offset: int) -> dict:
    return {"items": list(items), "total": int(total), "limit": int(limit), "offset": int(offset)}
