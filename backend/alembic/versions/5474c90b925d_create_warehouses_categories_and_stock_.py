"""create_warehouses_categories_and_stock_movements

Revision ID: 5474c90b925d
Revises: c746127dd814
Create Date: 2026-10-29 20:03:56.815276

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5474c90b925d'
down_revision: Union[str, None] = 'c746127dd814'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create categories table (supporting self-referential hierarchy)
    op.create_table(
        'categories',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('parent_id', sa.Uuid(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)
    op.create_index(op.f('ix_categories_slug'), 'categories', ['slug'], unique=True)
    op.create_index(op.f('ix_categories_parent_id'), 'categories', ['parent_id'], unique=False)

    # 2. Create warehouses table
    op.create_table(
        'warehouses',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_warehouses_code'), 'warehouses', ['code'], unique=True)
    op.create_index(op.f('ix_warehouses_is_active'), 'warehouses', ['is_active'], unique=False)

    # 3. Add backward-compatible inventory & category columns to products table
    op.add_column('products', sa.Column('cost_price', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('products', sa.Column('reorder_level', sa.Integer(), server_default='15', nullable=False))
    op.add_column('products', sa.Column('safety_stock', sa.Integer(), server_default='5', nullable=False))
    op.add_column('products', sa.Column('lead_time_days', sa.Integer(), server_default='7', nullable=False))
    op.add_column('products', sa.Column('category_id', sa.Uuid(), nullable=True))

    op.create_index(op.f('ix_products_category_id'), 'products', ['category_id'], unique=False)
    op.create_foreign_key(
        'fk_products_category_id_categories',
        'products',
        'categories',
        ['category_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_check_constraint(
        'ck_products_reorder_level_non_negative',
        'products',
        'reorder_level >= 0'
    )
    op.create_check_constraint(
        'ck_products_safety_stock_non_negative',
        'products',
        'safety_stock >= 0'
    )
    op.create_check_constraint(
        'ck_products_lead_time_days_non_negative',
        'products',
        'lead_time_days >= 0'
    )
    op.create_check_constraint(
        'ck_products_cost_price_non_negative',
        'products',
        'cost_price IS NULL OR cost_price >= 0'
    )

    # 4. Create stock_movements ledger table
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('warehouse_id', sa.Uuid(), nullable=True),
        sa.Column('change_quantity', sa.Integer(), nullable=False),
        sa.Column('previous_stock', sa.Integer(), nullable=False),
        sa.Column('new_stock', sa.Integer(), nullable=False),
        sa.Column(
            'movement_type',
            sa.Enum(
                'CHECKOUT_DECREMENT',
                'CANCELLATION_RESTOCK',
                'PURCHASE_RESTOCK',
                'MANUAL_ADJUSTMENT',
                'WAREHOUSE_TRANSFER',
                name='stock_movement_type_enum',
                native_enum=False
            ),
            nullable=False
        ),
        sa.Column('reference_order_id', sa.Uuid(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('new_stock >= 0', name='ck_stock_movements_new_stock_non_negative'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reference_order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_movements_product_id'), 'stock_movements', ['product_id'], unique=False)
    op.create_index(op.f('ix_stock_movements_warehouse_id'), 'stock_movements', ['warehouse_id'], unique=False)
    op.create_index(op.f('ix_stock_movements_movement_type'), 'stock_movements', ['movement_type'], unique=False)
    op.create_index(op.f('ix_stock_movements_reference_order_id'), 'stock_movements', ['reference_order_id'], unique=False)
    op.create_index(op.f('ix_stock_movements_created_at'), 'stock_movements', ['created_at'], unique=False)
    op.create_index(
        'ix_stock_movements_product_id_created_at',
        'stock_movements',
        ['product_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    # 1. Drop stock_movements ledger table and indexes
    op.drop_index('ix_stock_movements_product_id_created_at', table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_created_at'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_reference_order_id'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_movement_type'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_warehouse_id'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_product_id'), table_name='stock_movements')
    op.drop_table('stock_movements')

    # 2. Drop constraints and new columns from products table
    op.drop_constraint('ck_products_cost_price_non_negative', 'products', type_='check')
    op.drop_constraint('ck_products_lead_time_days_non_negative', 'products', type_='check')
    op.drop_constraint('ck_products_safety_stock_non_negative', 'products', type_='check')
    op.drop_constraint('ck_products_reorder_level_non_negative', 'products', type_='check')
    op.drop_constraint('fk_products_category_id_categories', 'products', type_='foreignkey')
    op.drop_index(op.f('ix_products_category_id'), table_name='products')

    op.drop_column('products', 'category_id')
    op.drop_column('products', 'lead_time_days')
    op.drop_column('products', 'safety_stock')
    op.drop_column('products', 'reorder_level')
    op.drop_column('products', 'cost_price')

    # 3. Drop warehouses table and indexes
    op.drop_index(op.f('ix_warehouses_is_active'), table_name='warehouses')
    op.drop_index(op.f('ix_warehouses_code'), table_name='warehouses')
    op.drop_table('warehouses')

    # 4. Drop categories table and indexes
    op.drop_index(op.f('ix_categories_parent_id'), table_name='categories')
    op.drop_index(op.f('ix_categories_slug'), table_name='categories')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_table('categories')
