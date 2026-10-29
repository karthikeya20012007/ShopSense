"""add_check_constraint_to_products_stock_quantity

Revision ID: c746127dd814
Revises: 2e5cf929b3a4
Create Date: 2026-10-14 22:40:48.908173

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c746127dd814'
down_revision: Union[str, None] = '2e5cf929b3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        constraint_name='ck_products_stock_quantity_non_negative',
        table_name='products',
        condition='stock_quantity >= 0'
    )


def downgrade() -> None:
    op.drop_constraint(
        constraint_name='ck_products_stock_quantity_non_negative',
        table_name='products',
        type_='check'
    )

