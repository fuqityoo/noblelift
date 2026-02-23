from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Directory(Base):
    __tablename__ = "directories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("directories.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
