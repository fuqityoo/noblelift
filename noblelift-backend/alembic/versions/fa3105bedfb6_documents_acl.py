"""documents & acl

Revision ID: fa3105bedfb6
Revises: 0004_vehicles_init
Create Date: 2025-09-09 11:07:05.062232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_documents_acl"
down_revision = "0004_vehicles_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "directories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("directories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_directories_parent", "directories", ["parent_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("directory_id", sa.Integer, sa.ForeignKey("directories.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "document_versions",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("document_id", sa.BigInteger, sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime", sa.String(127), nullable=True),
        sa.Column("size", sa.BigInteger, nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("created_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("document_id", "version", name="uq_document_version"),
    )

    op.create_table(
        "permissions",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("subject_type", sa.String(16), nullable=False),   # user|role
        sa.Column("subject_id", sa.BigInteger, nullable=False),
        sa.Column("object_type", sa.String(16), nullable=False),    # directory|document
        sa.Column("object_id", sa.BigInteger, nullable=False),
        sa.Column("action", sa.String(16), nullable=False),         # read|write|admin
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Index("ix_perm_subject", "subject_type", "subject_id"),
        sa.Index("ix_perm_object", "object_type", "object_id"),
    )


def downgrade() -> None:
    op.drop_table("permissions")
    op.drop_table("document_versions")
    op.drop_table("documents")
    op.drop_index("ix_directories_parent", table_name="directories")
    op.drop_table("directories")
