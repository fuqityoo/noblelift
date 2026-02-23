from datetime import datetime
from sqlalchemy import BigInteger, Integer, String, Boolean, ForeignKey, TIMESTAMP, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    due_date: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    priority_code: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    status_code: Mapped[str] = mapped_column(String(32), nullable=False, default="new")
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="regular")

    topic_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("task_topics.id", ondelete="SET NULL"))
    assignee_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))
    creator_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"))

    archived_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    topic: Mapped["TaskTopic | None"] = relationship("TaskTopic", lazy="joined")  # noqa
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assignee_id], lazy="joined")  # noqa
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id], lazy="joined")  # noqa
