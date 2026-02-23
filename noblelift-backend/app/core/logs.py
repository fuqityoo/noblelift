import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any, Dict

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

def set_request_id(value: str) -> None:
    _request_id_ctx.set(value)

def get_request_id() -> str:
    return _request_id_ctx.get()

class JSONFormatter(logging.Formatter):
    # UTC-время
    converter = time.gmtime

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", self.converter(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", get_request_id()),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)

class RequestIdFilter(logging.Filter):
    def __init__(self, name: str = "") -> None:
        super().__init__(name)

    def filter(self, record: logging.LogRecord) -> int:
        record.request_id = get_request_id()
        return 1

def setup_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.setFormatter(JSONFormatter())

    req_id_filter = RequestIdFilter()

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]
    root.filters = [req_id_filter]

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.setLevel(level)
        lg.handlers = [handler]
        lg.filters = [req_id_filter]

def gen_request_id() -> str:
    return uuid.uuid4().hex
