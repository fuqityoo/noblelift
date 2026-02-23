from __future__ import annotations
from datetime import datetime
from sqlalchemy import BigInteger, String, ForeignKey, TIMESTAMP, JSON, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class VehicleLog(Base):
    __tablename__ = "vehicle_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("vehicles.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

    vehicle = relationship("Vehicle", lazy="joined")
