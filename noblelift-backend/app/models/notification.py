from __future__ import annotations
from datetime import datetime
from sqlalchemy import BigInteger, String, Boolean, TIMESTAMP, Text, JSON, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    read_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    user = relationship("User")
