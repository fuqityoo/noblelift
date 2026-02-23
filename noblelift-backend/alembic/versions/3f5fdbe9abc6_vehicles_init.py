"""vehicles init

Revision ID: 3f5fdbe9abc6
Revises: 0003_task_files_events
Create Date: 2025-09-09 10:56:05.854192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0004_vehicles_init"
down_revision = "0003_task_files_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("number", sa.String(64), nullable=False, unique=True),
        sa.Column("color", sa.String(64), nullable=True),
        sa.Column("brand", sa.String(128), nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="available"),  # available|in_use|service|inactive
        sa.Column("holder_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_vehicles_status", "vehicles", ["status"])
    op.create_index("ix_vehicles_number", "vehicles", ["number"])

    op.create_table(
        "vehicle_logs",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("vehicle_id", sa.BigInteger, sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("action", sa.String(32), nullable=False),  # take|release|create|update|deactivate|activate|service_on|service_off
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("vehicle_logs")
    op.drop_index("ix_vehicles_number", table_name="vehicles")
    op.drop_index("ix_vehicles_status", table_name="vehicles")
    op.drop_table("vehicles")
