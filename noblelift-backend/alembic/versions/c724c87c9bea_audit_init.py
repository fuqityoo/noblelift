"""audit init

Revision ID: c724c87c9bea
Revises: 0007_teams_init
Create Date: 2025-09-09 14:31:11.805212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0008_audit_init"
down_revision = "0007_teams_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("actor_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.BigInteger, nullable=True, index=True),
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("ua", sa.String(512), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_entity", "audit_logs", ["entity", "entity_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_entity", table_name="audit_logs")
    op.drop_table("audit_logs")
