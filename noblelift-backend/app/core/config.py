from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "Noblelift Backend"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # В dev разрешим CORS с локальных фронтов (vite/CRA)
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # URL БД (PostgreSQL)
    DATABASE_URL: str = "postgresql+psycopg2://user:pass@localhost:5432/noblelift"

    # Позже добавим сюда DATABASE_URL, JWT_* и т.п.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALG: str = "HS256"
    ACCESS_EXPIRES_MIN: int = 30  # 30 минут
    REFRESH_EXPIRES_DAYS: int = 7  # 7 дней

    # STORAGE
    STORAGE_DIR: str = "var/storage"

settings = Settings()