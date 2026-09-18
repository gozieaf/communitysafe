"""Add usernames and email verification fields."""

from alembic import op
import sqlalchemy as sa

revision = "20260918_0003"
down_revision = "20260918_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("email_visible", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("verification_code_digest", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("verification_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE users SET username = 'user_' || replace(left(id::text, 8), '-', '') WHERE username IS NULL")
    op.alter_column("users", "username", nullable=False)
    op.create_unique_constraint("uq_users_username", "users", ["username"])
    op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    for column in ("verification_requested_at", "verification_expires_at", "verification_code_digest", "email_visible", "is_verified", "username"):
        op.drop_column("users", column)