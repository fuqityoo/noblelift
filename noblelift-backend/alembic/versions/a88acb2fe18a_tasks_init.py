"""tasks init

Revision ID: a88acb2fe18a
Revises: 0001_init_core
Create Date: 2025-09-07 15:04:26.345786

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_tasks_init"
down_revision = "0001_init_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_topics",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("due_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("priority_code", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("status_code", sa.String(32), nullable=False, server_default="new"),
        sa.Column("is_private", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("type", sa.String(16), nullable=False, server_default="regular"),
        sa.Column("topic_id", sa.Integer, sa.ForeignKey("task_topics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assignee_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("creator_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("priority_code in ('low','medium','high','urgent')", name="ck_tasks_priority"),
        sa.CheckConstraint("status_code in ('new','in_progress','pause','done','cancelled')", name="ck_tasks_status"),
        sa.CheckConstraint("type in ('regular','common')", name="ck_tasks_type"),
    )

    op.create_index("ix_tasks_topic", "tasks", ["topic_id"])
    op.create_index("ix_tasks_assignee", "tasks", ["assignee_id"])
    op.create_index("ix_tasks_status", "tasks", ["status_code"])
    op.create_index("ix_tasks_created_at", "tasks", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_tasks_created_at", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_index("ix_tasks_assignee", table_name="tasks")
    op.drop_index("ix_tasks_topic", table_name="tasks")
    op.drop_table("tasks")
    op.drop_table("task_topics")
