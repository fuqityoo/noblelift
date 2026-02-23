from __future__ import annotations
from typing import Any
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from starlette import status
from starlette.exceptions import HTTPException as StarletteHTTPException

def _resp(status_code: int, message: str, code: str | None = None, details: Any | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code or str(status_code), "message": message, "details": details}},
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return _resp(exc.status_code, exc.detail or "HTTP error", code="http_error")

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return _resp(status.HTTP_422_UNPROCESSABLE_ENTITY, "Validation error", code="validation_error", details=exc.errors())

async def pydantic_validation_handler(request: Request, exc: ValidationError):
    return _resp(status.HTTP_422_UNPROCESSABLE_ENTITY, "Validation error", code="validation_error", details=exc.errors())

async def integrity_error_handler(request: Request, exc: IntegrityError):
    return _resp(status.HTTP_400_BAD_REQUEST, "Integrity error", code="integrity_error")

async def unhandled_exception_handler(request: Request, exc: Exception):
    return _resp(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error", code="internal_error")
