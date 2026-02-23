"""teams init

Revision ID: 9c3c45a4ea62
Revises: 0006_notifications_push
Create Date: 2025-09-09 11:36:23.350586

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0007_teams_init"
down_revision = "0006_notifications_push"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "team_members",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("team_id", sa.BigInteger, sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="member"),  # member|lead
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_user"),
    )


def downgrade() -> None:
    op.drop_table("team_members")
    op.drop_table("teams")
