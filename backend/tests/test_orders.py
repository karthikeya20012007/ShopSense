import uuid
from decimal import Decimal
import pytest
from sqlalchemy import select, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import get_password_hash
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import AccountStatus, OrderStatus, REVENUE_RECOGNIZED_ORDER_STATUSES, UserRole, VendorStatus
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile


@pytest.fixture
def test_setup_data(db_session: Session):
    """Fixture to provide a customer, two vendors, and two products for multi-vendor order testing."""
    # Create customer
    cust_user = User(
        email="order_customer@example.com",
        full_name="Order Test Customer",
        hashed_password=get_password_hash("CustPass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(cust_user)
    db_session.flush()

    cust_profile = CustomerProfile(
        user_id=cust_user.id,
        phone_number="+1 555-1111",
        shipping_address="100 Buyer Blvd",
    )
    db_session.add(cust_profile)

    # Create Vendor 1
    v1_user = User(
        email="vendor1@example.com",
        full_name="Vendor One User",
        hashed_password=get_password_hash("VendorPass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(v1_user)
    db_session.flush()

    v1_profile = VendorProfile(
        user_id=v1_user.id,
        store_name="Store Alpha",
        status=VendorStatus.APPROVED,
    )
    db_session.add(v1_profile)
    db_session.flush()

    prod1 = Product(
        vendor_id=v1_profile.id,
        title="Alpha Gadget",
        price=Decimal("25.50"),
        category="Electronics",
        stock_quantity=50,
        is_published=True,
    )
    db_session.add(prod1)

    # Create Vendor 2
    v2_user = User(
        email="vendor2@example.com",
        full_name="Vendor Two User",
        hashed_password=get_password_hash("VendorPass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(v2_user)
    db_session.flush()

    v2_profile = VendorProfile(
        user_id=v2_user.id,
        store_name="Store Beta",
        status=VendorStatus.APPROVED,
    )
    db_session.add(v2_profile)
    db_session.flush()

    prod2 = Product(
        vendor_id=v2_profile.id,
        title="Beta Widget",
        price=Decimal("49.99"),
        category="Hardware",
        stock_quantity=30,
        is_published=True,
    )
    db_session.add(prod2)
    db_session.flush()

    return {
        "customer": cust_profile,
        "vendor1": v1_profile,
        "vendor2": v2_profile,
        "product1": prod1,
        "product2": prod2,
    }


def test_order_and_order_item_creation_multi_vendor(db_session: Session, test_setup_data: dict):
    """Verify Order and OrderItem creation supporting multiple vendors in a single order."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    v2 = test_setup_data["vendor2"]
    p1 = test_setup_data["product1"]
    p2 = test_setup_data["product2"]

    # Create Order
    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("100.99"),
    )
    db_session.add(order)
    db_session.flush()

    # Create OrderItem 1 (Vendor 1)
    item1 = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=2,
        unit_price=Decimal("25.50"),
        subtotal=Decimal("51.00"),
    )
    # Create OrderItem 2 (Vendor 2)
    item2 = OrderItem(
        order_id=order.id,
        product_id=p2.id,
        vendor_id=v2.id,
        quantity=1,
        unit_price=Decimal("49.99"),
        subtotal=Decimal("49.99"),
    )
    db_session.add_all([item1, item2])
    db_session.flush()

    # Query back and verify
    queried_order = db_session.execute(
        select(Order).where(Order.id == order.id)
    ).scalar_one()

    assert queried_order.customer_id == cust.id
    assert queried_order.status == OrderStatus.PENDING
    assert queried_order.total_amount == Decimal("100.99")
    assert queried_order.created_at is not None
    assert queried_order.updated_at is not None
    assert len(queried_order.items) == 2

    # Verify back-populates from customer
    assert order in cust.orders

    # Verify items and relationship links
    items_by_vendor = {item.vendor_id: item for item in queried_order.items}
    assert v1.id in items_by_vendor
    assert v2.id in items_by_vendor

    v1_item = items_by_vendor[v1.id]
    assert v1_item.product_id == p1.id
    assert v1_item.quantity == 2
    assert v1_item.unit_price == Decimal("25.50")
    assert v1_item.subtotal == Decimal("51.00")
    assert v1_item.product.title == "Alpha Gadget"
    assert v1_item.vendor.store_name == "Store Alpha"

    v2_item = items_by_vendor[v2.id]
    assert v2_item.product_id == p2.id
    assert v2_item.quantity == 1
    assert v2_item.unit_price == Decimal("49.99")
    assert v2_item.subtotal == Decimal("49.99")
    assert v2_item.product.title == "Beta Widget"
    assert v2_item.vendor.store_name == "Store Beta"


def test_order_check_constraint_negative_total_amount(db_session: Session, test_setup_data: dict):
    """Verify total_amount >= 0 check constraint on orders table."""
    cust = test_setup_data["customer"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("-10.00"),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(order)
            db_session.flush()

    assert "ck_orders_total_amount_non_negative" in str(exc_info.value)


def test_order_item_check_constraint_quantity_zero_rejected(db_session: Session, test_setup_data: dict):
    """Verify quantity = 0 violates quantity > 0 check constraint."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("25.50"),
    )
    db_session.add(order)
    db_session.flush()

    item_zero = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=0,
        unit_price=Decimal("25.50"),
        subtotal=Decimal("0.00"),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(item_zero)
            db_session.flush()

    assert "ck_order_items_quantity_positive" in str(exc_info.value)


def test_order_item_check_constraint_quantity_negative_rejected(db_session: Session, test_setup_data: dict):
    """Verify negative quantity violates quantity > 0 check constraint."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("25.50"),
    )
    db_session.add(order)
    db_session.flush()

    item_neg = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=-3,
        unit_price=Decimal("25.50"),
        subtotal=Decimal("0.00"),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(item_neg)
            db_session.flush()

    assert "ck_order_items_quantity_positive" in str(exc_info.value)


def test_order_item_check_constraint_unit_price_non_negative(db_session: Session, test_setup_data: dict):
    """Verify unit_price >= 0 check constraint on order_items table."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("0.00"),
    )
    db_session.add(order)
    db_session.flush()

    item_neg_price = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=1,
        unit_price=Decimal("-5.00"),
        subtotal=Decimal("0.00"),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(item_neg_price)
            db_session.flush()

    assert "ck_order_items_unit_price_non_negative" in str(exc_info.value)


def test_order_item_check_constraint_subtotal_non_negative(db_session: Session, test_setup_data: dict):
    """Verify subtotal >= 0 check constraint on order_items table."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("0.00"),
    )
    db_session.add(order)
    db_session.flush()

    item_neg_subtotal = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=1,
        unit_price=Decimal("10.00"),
        subtotal=Decimal("-10.00"),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(item_neg_subtotal)
            db_session.flush()

    assert "ck_order_items_subtotal_non_negative" in str(exc_info.value)



def test_cascade_delete_order_removes_order_items(db_session: Session, test_setup_data: dict):
    """Verify that deleting an Order cascades and deletes all child OrderItems."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("51.00"),
    )
    db_session.add(order)
    db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=2,
        unit_price=Decimal("25.50"),
        subtotal=Decimal("51.00"),
    )
    db_session.add(item)
    db_session.flush()

    item_id = item.id
    order_id = order.id

    # Delete order
    db_session.delete(order)
    db_session.flush()

    # Verify order is gone
    queried_order = db_session.execute(
        select(Order).where(Order.id == order_id)
    ).scalar_one_or_none()
    assert queried_order is None

    # Verify item was cascaded
    queried_item = db_session.execute(
        select(OrderItem).where(OrderItem.id == item_id)
    ).scalar_one_or_none()
    assert queried_item is None


def test_foreign_key_restricts_product_and_vendor_deletion(db_session: Session, test_setup_data: dict):
    """Verify that ondelete=RESTRICT prevents deleting products or vendors referenced in order items."""
    cust = test_setup_data["customer"]
    v1 = test_setup_data["vendor1"]
    p1 = test_setup_data["product1"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.COMPLETED,
        total_amount=Decimal("25.50"),
    )
    db_session.add(order)
    db_session.flush()

    item = OrderItem(
        order_id=order.id,
        product_id=p1.id,
        vendor_id=v1.id,
        quantity=1,
        unit_price=Decimal("25.50"),
        subtotal=Decimal("25.50"),
    )
    db_session.add(item)
    db_session.flush()

    # Attempt to delete referenced Product
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.delete(p1)
            db_session.flush()

    # Attempt to delete referenced VendorProfile
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.delete(v1)
            db_session.flush()


def test_order_status_enum_values_and_revenue_recognition_constants():
    """Verify OrderStatus enum values and revenue recognition contract documentation."""
    assert OrderStatus.PENDING == "PENDING"
    assert OrderStatus.COMPLETED == "COMPLETED"
    assert OrderStatus.CANCELLED == "CANCELLED"
    assert OrderStatus.REFUNDED == "REFUNDED"

    # Verify the explicit set of revenue-recognized statuses
    assert REVENUE_RECOGNIZED_ORDER_STATUSES == {OrderStatus.COMPLETED}
    assert OrderStatus.PENDING not in REVENUE_RECOGNIZED_ORDER_STATUSES
    assert OrderStatus.CANCELLED not in REVENUE_RECOGNIZED_ORDER_STATUSES
    assert OrderStatus.REFUNDED not in REVENUE_RECOGNIZED_ORDER_STATUSES


def test_order_status_transitions_in_database(db_session: Session, test_setup_data: dict):
    """Verify Order status can transition between valid lifecycle states and persist."""
    cust = test_setup_data["customer"]

    order = Order(
        customer_id=cust.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("10.00"),
    )
    db_session.add(order)
    db_session.flush()
    assert order.status == OrderStatus.PENDING

    # Transition to COMPLETED
    order.status = OrderStatus.COMPLETED
    db_session.flush()
    db_session.refresh(order)
    assert order.status == OrderStatus.COMPLETED

    # Transition to REFUNDED
    order.status = OrderStatus.REFUNDED
    db_session.flush()
    db_session.refresh(order)
    assert order.status == OrderStatus.REFUNDED


def test_database_schema_and_indexes_match_expectations(db_session: Session):
    """Verify that PostgreSQL schema has the expected tables, columns, indexes, and constraints."""
    inspector = inspect(db_session.bind)

    # Tables exist
    tables = inspector.get_table_names()
    assert "orders" in tables
    assert "order_items" in tables

    # Orders columns
    order_cols = {c["name"]: c for c in inspector.get_columns("orders")}
    assert "id" in order_cols
    assert "customer_id" in order_cols
    assert "status" in order_cols
    assert "total_amount" in order_cols
    assert "created_at" in order_cols
    assert "updated_at" in order_cols

    # OrderItems columns
    item_cols = {c["name"]: c for c in inspector.get_columns("order_items")}
    assert "id" in item_cols
    assert "order_id" in item_cols
    assert "product_id" in item_cols
    assert "vendor_id" in item_cols
    assert "quantity" in item_cols
    assert "unit_price" in item_cols
    assert "subtotal" in item_cols
    assert "created_at" in item_cols

    # Order indexes
    order_indexes = {idx["name"] for idx in inspector.get_indexes("orders")}
    assert "ix_orders_customer_id" in order_indexes
    assert "ix_orders_status" in order_indexes
    assert "ix_orders_created_at" in order_indexes

    # OrderItems indexes
    item_indexes = {idx["name"] for idx in inspector.get_indexes("order_items")}
    assert "ix_order_items_order_id" in item_indexes
    assert "ix_order_items_product_id" in item_indexes
    assert "ix_order_items_vendor_id" in item_indexes
    assert "ix_order_items_vendor_id_created_at" in item_indexes


def test_alembic_migration_linear_history():
    """Verify that Alembic migration revision history is clean, single-headed, and properly chained."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config("backend/alembic.ini")
    script = ScriptDirectory.from_config(config)

    # Verify exactly one head
    heads = script.get_heads()
    assert len(heads) == 1, f"Expected exactly 1 migration head, found: {heads}"
    head_rev = heads[0]
    assert head_rev == "2e5cf929b3a4"

    # Verify Step 1 revision details
    step1_rev = script.get_revision("2e5cf929b3a4")
    assert step1_rev is not None
    assert step1_rev.down_revision == "4fc0c0a20379"

    # Verify initial schema root
    initial_rev = script.get_revision("4fc0c0a20379")
    assert initial_rev is not None
    assert initial_rev.down_revision is None