"""Allow legacy users to set username later."""

from alembic import op

revision = "20260918_0004"
down_revision = "20260918_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "username", nullable=True)


def downgrade() -> None:
    op.execute("UPDATE users SET username = 'user_' || replace(left(id::text, 8), '-', '') WHERE username IS NULL")
    op.alter_column("users", "username", nullable=False)
