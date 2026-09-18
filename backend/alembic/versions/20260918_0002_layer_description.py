"""Add layer descriptions."""

from alembic import op
import sqlalchemy as sa


revision = "20260918_0002"
down_revision = "20260917_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("layers", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("layers", "description")