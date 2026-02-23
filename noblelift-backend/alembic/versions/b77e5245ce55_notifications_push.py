"""notifications & push

Revision ID: b77e5245ce55
Revises: 0005_documents_acl
Create Date: 2025-09-09 11:25:54.849181

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_notifications_push"
down_revision = "0005_documents_acl"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(32), nullable=False),   # task_assigned|task_due|doc_updated|vehicle_notice|custom
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("data", sa.JSON, nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("endpoint", sa.String(1024), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(256), nullable=False),
        sa.Column("auth", sa.String(256), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_table("notifications")
