"""task files & events

Revision ID: 60d5f09fc7ae
Revises: 0002_tasks_init
Create Date: 2025-09-09 10:45:45.423373

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_task_files_events"
down_revision = "0002_tasks_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_files",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("task_id", sa.BigInteger, sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploader_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime", sa.String(127), nullable=True),
        sa.Column("size", sa.BigInteger, nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "task_events",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("task_id", sa.BigInteger, sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("actor_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("type", sa.String(32), nullable=False),  # created|updated|assigned|unassigned|taken|released|archived|unarchived|status_changed|file_added|file_removed
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("task_events")
    op.drop_table("task_files")
