from datetime import datetime

from sqlalchemy import BigInteger, String, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status_code: Mapped[str] = mapped_column(String(32), ForeignKey("profile_statuses.code", ondelete="RESTRICT"), nullable=False)
    status_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    links: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="profile", lazy="joined")  # noqa
    status: Mapped["ProfileStatus"] = relationship("ProfileStatus", lazy="joined")  # noqa
