from __future__ import annotations
from datetime import datetime
from sqlalchemy import BigInteger, String, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    subject_type: Mapped[str] = mapped_column(String(16), nullable=False)  # user|role
    subject_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    object_type: Mapped[str] = mapped_column(String(16), nullable=False)   # directory|document
    object_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)        # read|write|admin
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
