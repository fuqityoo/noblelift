from __future__ import annotations
from datetime import datetime
from sqlalchemy import BigInteger, String, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    color: Mapped[str | None] = mapped_column(String(64))
    brand: Mapped[str | None] = mapped_column(String(128))
    model: Mapped[str | None] = mapped_column(String(128))

    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'available'"))
    holder_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    holder = relationship("User", lazy="joined")
