"""init core tables

Revision ID: ee5b0a959792
Revises: 
Create Date: 2025-09-07 04:32:30.122275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_init_core"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Роли
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(64), nullable=False),
    )

    # Справочник статусов профиля
    op.create_table(
        "profile_statuses",
        sa.Column("code", sa.String(32), primary_key=True),  # напр. 'in_office'
        sa.Column("label", sa.String(64), nullable=False),   # 'В офисе'
    )

    # Пользователи
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("avatar_url", sa.String(1024), nullable=True),
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Профили (1:1 к пользователю)
    op.create_table(
        "profiles",
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("status_code", sa.String(32), sa.ForeignKey("profile_statuses.code", ondelete="RESTRICT"), nullable=False),
        sa.Column("status_payload", sa.JSON, nullable=True),  # напр. {"from": 123, "to": 456}
        sa.Column("links", sa.JSON, nullable=True),           # контакты: email/phone/telegram/whatsapp
        sa.Column("arrived_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Индексы
    op.create_index("ix_users_role_id", "users", ["role_id"])
    op.create_index("ix_profiles_status_code", "profiles", ["status_code"])



def downgrade() -> None:
    op.drop_index("ix_profiles_status_code", table_name="profiles")
    op.drop_index("ix_users_role_id", table_name="users")
    op.drop_table("profiles")
    op.drop_table("users")
    op.drop_table("profile_statuses")
    op.drop_table("roles")

