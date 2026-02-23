from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.core.config import settings
from app.core.logs import setup_logging, gen_request_id, set_request_id
from app.core.errors import (
    http_exception_handler,
    validation_exception_handler,
    pydantic_validation_handler,
    integrity_error_handler,
    unhandled_exception_handler,
)
from app.routes import health, auth, users, roles
from app.routes import profiles, statuses
from app.routes import task_topics, tasks, task_files, task_events
from app.routes import vehicles
from app.routes import directories, documents, permissions
from app.routes import notifications, push, teams
from app.routes import audit

setup_logging(debug=settings.DEBUG)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API для корпоративного приложения Noblelift",
)

# if settings.CORS_ORIGINS:
#     app.add_middleware(
#         CORSMiddleware,
#         allow_origins=["*"],  # or settings.CORS_ORIGINS
#         allow_credentials=False,
#         allow_methods=["*"],
#         allow_headers=["*"],
#     )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешает все origins
    allow_credentials=True,  # Разрешает cookies, authorization headers
    allow_methods=["*"],  # Разрешает все HTTP-методы (GET, POST, etc.)
    allow_headers=["*"],  # Разрешает все заголовки
    expose_headers=["*"]   # Позволяет браузеру видеть все заголовки ответа
)

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or gen_request_id()
        set_request_id(rid)
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

app.add_middleware(RequestIdMiddleware)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ValidationError, pydantic_validation_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(statuses.router, prefix="/api/v1")
app.include_router(task_topics.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(task_files.router, prefix="/api/v1")
app.include_router(task_events.router, prefix="/api/v1")
app.include_router(vehicles.router, prefix="/api/v1")
app.include_router(directories.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(permissions.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(push.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")

# Static files (avatars etc.)
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/api/v1/static", StaticFiles(directory=str(uploads_dir)), name="static")
