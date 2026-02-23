from fastapi import APIRouter
import time
from app.core.config import settings

router = APIRouter()
_start = time.time()


@router.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "uptimeSec": int(time.time() - _start)}

@router.get("/version", tags=["Health"])
def version():
    return {"app": "noblelift-backend", "version": settings.APP_VERSION, "commit": "dev"}
