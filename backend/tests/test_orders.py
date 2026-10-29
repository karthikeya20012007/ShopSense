import uuid
import concurrent.futures
from decimal import Decimal
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select, inspect, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.security import get_password_hash, create_access_token
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import AccountStatus, OrderStatus, REVENUE_RECOGNIZED_ORDER_STATUSES, UserRole, VendorStatus
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.order import CheckoutRequest, CheckoutItemRequest
from backend.app.services.order_service import checkout_order
from backend.tests.conftest import TestingSessionLocal


@pytest.fixture
def test_setup_data(db_session: Session):
    """Fixture to provide a customer, two vendors, and products for checkout testing."""
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

    token = create_access_token(subject=str(cust_user.id), role=cust_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

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

    prod1_b = Product(
        vendor_id=v1_profile.id,
        title="Alpha Accessory",
        price=Decimal("12.00"),
        category="Electronics",
        stock_quantity=20,
        is_published=True,
    )
    db_session.add(prod1_b)

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
    db_session.commit()
    db_session.refresh(cust_user)
    db_session.refresh(cust_profile)
    db_session.refresh(v1_profile)
    db_session.refresh(v2_profile)
    db_session.refresh(prod1)
    db_session.refresh(prod1_b)
    db_session.refresh(prod2)

    return {
        "user": cust_user,
        "customer": cust_profile,
        "headers": headers,
        "vendor1": v1_profile,
        "vendor2": v2_profile,
        "product1": prod1,
        "product1_b": prod1_b,
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

    # Product check constraints
    prod_checks = {chk["name"] for chk in inspector.get_check_constraints("products")}
    assert "ck_products_stock_quantity_non_negative" in prod_checks



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
    assert head_rev == "c746127dd814"

    # Verify Step 2 constraint revision details
    check_rev = script.get_revision("c746127dd814")
    assert check_rev is not None
    assert check_rev.down_revision == "2e5cf929b3a4"

    # Verify Step 1 revision details
    step1_rev = script.get_revision("2e5cf929b3a4")
    assert step1_rev is not None
    assert step1_rev.down_revision == "4fc0c0a20379"

    # Verify initial schema root
    initial_rev = script.get_revision("4fc0c0a20379")
    assert initial_rev is not None
    assert initial_rev.down_revision is None



# ==============================================================================
# Step 2: Checkout API, Pricing, Inventory & Concurrency Tests
# ==============================================================================


def test_checkout_single_product_success(client: TestClient, db_session: Session, test_setup_data: dict):
    """1. Successful checkout for one product."""
    headers = test_setup_data["headers"]
    cust = test_setup_data["customer"]
    p1 = test_setup_data["product1"]
    initial_stock = p1.stock_quantity

    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 2}
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    assert data["customer_id"] == str(cust.id)
    assert data["status"] == "PENDING"
    assert data["total_amount"] == "51.00"
    assert len(data["items"]) == 1

    item = data["items"][0]
    assert item["product_id"] == str(p1.id)
    assert item["product_title"] == "Alpha Gadget"
    assert item["vendor_id"] == str(p1.vendor_id)
    assert item["store_name"] == "Store Alpha"
    assert item["quantity"] == 2
    assert item["unit_price"] == "25.50"
    assert item["subtotal"] == "51.00"

    # Verify inventory was decremented
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock - 2


def test_checkout_multiple_products_single_vendor(client: TestClient, db_session: Session, test_setup_data: dict):
    """2. Successful checkout with multiple products from one vendor."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    p1_b = test_setup_data["product1_b"]
    init_stock_1 = p1.stock_quantity
    init_stock_1_b = p1_b.stock_quantity

    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 3},
            {"product_id": str(p1_b.id), "quantity": 2}
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    # 3 * 25.50 = 76.50; 2 * 12.00 = 24.00; total = 100.50
    assert data["total_amount"] == "100.50"
    assert len(data["items"]) == 2

    db_session.refresh(p1)
    db_session.refresh(p1_b)
    assert p1.stock_quantity == init_stock_1 - 3
    assert p1_b.stock_quantity == init_stock_1_b - 2


def test_checkout_multi_vendor_success(client: TestClient, db_session: Session, test_setup_data: dict):
    """3. Successful checkout containing products from multiple vendors."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    p2 = test_setup_data["product2"]
    v1 = test_setup_data["vendor1"]
    v2 = test_setup_data["vendor2"]

    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 1},
            {"product_id": str(p2.id), "quantity": 1}
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    # 25.50 + 49.99 = 75.49
    assert data["total_amount"] == "75.49"
    assert len(data["items"]) == 2

    # Verify both vendor IDs and store names are properly attributed
    vendors_in_items = {item["vendor_id"]: item["store_name"] for item in data["items"]}
    assert str(v1.id) in vendors_in_items
    assert str(v2.id) in vendors_in_items
    assert vendors_in_items[str(v1.id)] == "Store Alpha"
    assert vendors_in_items[str(v2.id)] == "Store Beta"


def test_checkout_pricing_calculations(client: TestClient, test_setup_data: dict):
    """4. Correct server-calculated unit-price snapshots, subtotals, and order total."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    p2 = test_setup_data["product2"]

    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 4},
            {"product_id": str(p2.id), "quantity": 2}
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    # Expected: 4 * 25.50 = 102.00; 2 * 49.99 = 99.98; total = 201.98
    items_by_prod = {item["product_id"]: item for item in data["items"]}
    assert items_by_prod[str(p1.id)]["subtotal"] == "102.00"
    assert items_by_prod[str(p2.id)]["subtotal"] == "99.98"
    assert data["total_amount"] == "201.98"


def test_checkout_inventory_decrement(client: TestClient, db_session: Session, test_setup_data: dict):
    """5. Correct inventory decrement after success."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    start_stock = p1.stock_quantity

    payload = {"items": [{"product_id": str(p1.id), "quantity": 7}]}
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201

    db_session.refresh(p1)
    assert p1.stock_quantity == start_stock - 7


def test_checkout_invalid_quantities_rejected(client: TestClient, test_setup_data: dict):
    """6. Rejection of zero and negative quantities."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    # Zero quantity
    res_zero = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 0}]},
        headers=headers
    )
    assert res_zero.status_code == 422

    # Negative quantity
    res_neg = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": -3}]},
        headers=headers
    )
    assert res_neg.status_code == 422

    # Empty list
    res_empty = client.post(
        "/api/v1/orders/checkout",
        json={"items": []},
        headers=headers
    )
    assert res_empty.status_code == 422


def test_checkout_nonexistent_product_rejected(client: TestClient, test_setup_data: dict):
    """7. Rejection of nonexistent products."""
    headers = test_setup_data["headers"]
    fake_id = str(uuid.uuid4())

    response = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": fake_id, "quantity": 1}]},
        headers=headers
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_checkout_unpublished_product_rejected(client: TestClient, db_session: Session, test_setup_data: dict):
    """8. Rejection of unpublished products."""
    headers = test_setup_data["headers"]
    v1 = test_setup_data["vendor1"]

    # Create unpublished product
    unpub = Product(
        vendor_id=v1.id,
        title="Unpublished Item",
        price=Decimal("15.00"),
        category="Misc",
        stock_quantity=10,
        is_published=False
    )
    db_session.add(unpub)
    db_session.commit()
    db_session.refresh(unpub)


    response = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(unpub.id), "quantity": 1}]},
        headers=headers
    )
    assert response.status_code == 400
    assert "unpublished" in response.json()["detail"].lower() or "not available" in response.json()["detail"].lower()

    # Verify stock remained untouched
    db_session.refresh(unpub)
    assert unpub.stock_quantity == 10


def test_checkout_insufficient_stock_rejected(client: TestClient, db_session: Session, test_setup_data: dict):
    """9. Rejection when stock is insufficient."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    current_stock = p1.stock_quantity

    response = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": current_stock + 1}]},
        headers=headers
    )
    assert response.status_code == 400
    assert "insufficient inventory" in response.json()["detail"].lower()

    # Verify stock was not changed
    db_session.refresh(p1)
    assert p1.stock_quantity == current_stock


def test_checkout_atomic_rollback_on_partial_failure(client: TestClient, db_session: Session, test_setup_data: dict):
    """10. Atomic rollback when one item in a multi-item checkout fails."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    p2 = test_setup_data["product2"]
    p1_stock = p1.stock_quantity
    p2_stock = p2.stock_quantity

    # p1 has sufficient stock, but p2 has insufficient stock (request 999)
    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 2},
            {"product_id": str(p2.id), "quantity": 999}
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 400
    assert "insufficient inventory" in response.json()["detail"].lower()

    # Verify NEITHER product had its stock decremented (atomic transaction)
    db_session.refresh(p1)
    db_session.refresh(p2)
    assert p1.stock_quantity == p1_stock
    assert p2.stock_quantity == p2_stock


def test_checkout_authentication_required(client: TestClient, test_setup_data: dict):
    """11. Customer authentication required (reject unauthenticated requests with 401)."""
    p1 = test_setup_data["product1"]
    payload = {"items": [{"product_id": str(p1.id), "quantity": 1}]}

    response = client.post("/api/v1/orders/checkout", json=payload)
    assert response.status_code == 401
    assert "missing" in response.json()["detail"].lower() or "token" in response.json()["detail"].lower()


def test_checkout_vendor_and_admin_forbidden(
    client: TestClient,
    test_setup_data: dict,
    admin_headers: dict,
    approved_vendor_headers: dict
):
    """12. Vendor and admin accounts forbidden from customer checkout (403 Forbidden)."""
    p1 = test_setup_data["product1"]
    payload = {"items": [{"product_id": str(p1.id), "quantity": 1}]}

    # Admin request
    res_admin = client.post("/api/v1/orders/checkout", json=payload, headers=admin_headers)
    assert res_admin.status_code == 403

    # Vendor request
    res_vendor = client.post("/api/v1/orders/checkout", json=payload, headers=approved_vendor_headers)
    assert res_vendor.status_code == 403


def test_checkout_uses_authenticated_customer_identity(client: TestClient, db_session: Session, test_setup_data: dict):
    """13. Customer cannot place an order using another customer's identity."""
    headers = test_setup_data["headers"]
    cust = test_setup_data["customer"]
    p1 = test_setup_data["product1"]
    fake_customer_id = str(uuid.uuid4())

    # Attempting to supply customer_id in request body is rejected by schema (extra=forbid)
    payload = {
        "items": [{"product_id": str(p1.id), "quantity": 1}],
        "customer_id": fake_customer_id
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 422

    # Normal checkout automatically binds strictly to authenticated customer
    valid_payload = {"items": [{"product_id": str(p1.id), "quantity": 1}]}
    res_valid = client.post("/api/v1/orders/checkout", json=valid_payload, headers=headers)
    assert res_valid.status_code == 201
    assert res_valid.json()["customer_id"] == str(cust.id)


def test_checkout_ignores_or_forbids_client_overrides(client: TestClient, test_setup_data: dict):
    """14. Product price and vendor attribution cannot be overridden by request fields."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    # Client attempts to inject price override
    res_price = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1, "price": "0.01"}]},
        headers=headers
    )
    assert res_price.status_code == 422

    # Client attempts to inject vendor_id override
    res_vendor = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1, "vendor_id": str(uuid.uuid4())}]},
        headers=headers
    )
    assert res_vendor.status_code == 422

    # Client attempts to inject order status override
    res_status = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}], "status": "COMPLETED"},
        headers=headers
    )
    assert res_status.status_code == 422


def test_concurrent_checkout_prevents_overselling():
    """
    15. Concurrent checkout cannot oversell stock (Deterministic PostgreSQL integration test).
    For a product with initial stock of 10 and 100 concurrent one-unit checkout attempts:
    - Exactly 10 checkouts must succeed.
    - Exactly 90 attempts must be rejected due to insufficient stock.
    - Final stock in PostgreSQL must be exactly 0.
    """
    db = TestingSessionLocal()
    try:
        # Create dedicated vendor and product with stock of exactly 10
        vendor_user = User(
            email=f"conc_vendor_{uuid.uuid4().hex[:8]}@example.com",
            full_name="Concurrency Vendor",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.VENDOR,
            account_status=AccountStatus.ACTIVE
        )
        db.add(vendor_user)
        db.flush()

        v_profile = VendorProfile(
            user_id=vendor_user.id,
            store_name="Concurrency Store",
            status=VendorStatus.APPROVED
        )
        db.add(v_profile)
        db.flush()

        product = Product(
            vendor_id=v_profile.id,
            title="Limited Stock Widget",
            price=Decimal("19.99"),
            category="Concurrency",
            stock_quantity=10,
            is_published=True
        )
        db.add(product)

        # Create customer
        cust_user = User(
            email=f"conc_cust_{uuid.uuid4().hex[:8]}@example.com",
            full_name="Concurrency Customer",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db.add(cust_user)
        db.flush()

        c_profile = CustomerProfile(user_id=cust_user.id)
        db.add(c_profile)
        db.commit()

        prod_id = product.id
        cust_id = c_profile.id
        v_profile_id = v_profile.id
        cust_user_id = cust_user.id
        vendor_user_id = vendor_user.id
    finally:
        db.close()

    def attempt_checkout(worker_id: int):
        thread_db = TestingSessionLocal()
        try:
            cust = thread_db.execute(
                select(CustomerProfile).where(CustomerProfile.id == cust_id)
            ).scalar_one()
            req = CheckoutRequest(
                items=[CheckoutItemRequest(product_id=prod_id, quantity=1)]
            )
            order = checkout_order(db=thread_db, customer=cust, checkout_data=req)
            return ("SUCCESS", 201, str(order.id))
        except HTTPException as e:
            return ("HTTP_ERROR", e.status_code, e.detail)
        except Exception as e:
            return ("UNEXPECTED_ERROR", 500, str(e))
        finally:
            thread_db.close()

    # Launch 100 concurrent checkout attempts across 10 worker threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(attempt_checkout, i) for i in range(100)]
        results = [f.result(timeout=20.0) for f in futures]

    successes = [r for r in results if r[0] == "SUCCESS"]
    conflicts = [r for r in results if r[0] == "HTTP_ERROR" and r[1] == 400]
    unexpected = [r for r in results if r[0] == "UNEXPECTED_ERROR" or (r[0] == "HTTP_ERROR" and r[1] != 400)]

    assert len(successes) == 10, f"Expected 10 successes, got {len(successes)}"
    assert len(conflicts) == 90, f"Expected 90 rejected attempts, got {len(conflicts)}"
    assert len(unexpected) == 0, f"Unexpected errors: {unexpected}"

    # Verify final stock and persistence in PostgreSQL
    verify_db = TestingSessionLocal()
    try:
        final_product = verify_db.execute(
            select(Product).where(Product.id == prod_id)
        ).scalar_one()
        assert final_product.stock_quantity == 0, f"Expected 0 stock, got {final_product.stock_quantity}"

        order_items_count = verify_db.execute(
            select(func.count(OrderItem.id)).where(OrderItem.product_id == prod_id)
        ).scalar()
        assert order_items_count == 10, f"Expected 10 order items, got {order_items_count}"
    finally:
        # Cleanup
        created_orders = verify_db.execute(
            select(Order.id).join(OrderItem).where(OrderItem.product_id == prod_id)
        ).scalars().all()
        verify_db.query(OrderItem).filter(OrderItem.product_id == prod_id).delete()
        if created_orders:
            verify_db.query(Order).filter(Order.id.in_(created_orders)).delete()
        verify_db.query(Product).filter(Product.id == prod_id).delete()
        verify_db.query(CustomerProfile).filter(CustomerProfile.id == cust_id).delete()
        verify_db.query(VendorProfile).filter(VendorProfile.id == v_profile_id).delete()
        verify_db.query(User).filter(User.id.in_([cust_user_id, vendor_user_id])).delete()
        verify_db.commit()
        verify_db.close()


def test_checkout_persistence_integrity(client: TestClient, db_session: Session, test_setup_data: dict):
    """16. Order and OrderItem persistence is correct."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    payload = {"items": [{"product_id": str(p1.id), "quantity": 1}]}
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    order_id = uuid.UUID(response.json()["id"])

    # Directly inspect database
    order_in_db = db_session.execute(
        select(Order).where(Order.id == order_id)
    ).scalar_one()

    assert order_in_db.status == OrderStatus.PENDING
    assert order_in_db.total_amount == p1.price
    assert order_in_db.created_at is not None
    assert order_in_db.updated_at is not None
    assert len(order_in_db.items) == 1

    item_in_db = order_in_db.items[0]
    assert item_in_db.product_id == p1.id
    assert item_in_db.vendor_id == p1.vendor_id
    assert item_in_db.quantity == 1
    assert item_in_db.unit_price == p1.price
    assert item_in_db.subtotal == p1.price


def test_checkout_duplicate_product_ids_aggregated(client: TestClient, db_session: Session, test_setup_data: dict):
    """17. Duplicate product IDs in checkout request aggregate quantities, decrement inventory once, and persist exactly one OrderItem."""
    headers = test_setup_data["headers"]
    cust = test_setup_data["customer"]
    p1 = test_setup_data["product1"]
    initial_stock = p1.stock_quantity

    # p1 price is 25.50. We request 2 units in item 1, and 3 units in item 2 (total 5 units, total $127.50)
    payload = {
        "items": [
            {"product_id": str(p1.id), "quantity": 2},
            {"product_id": str(p1.id), "quantity": 3},
        ]
    }
    response = client.post("/api/v1/orders/checkout", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    assert data["customer_id"] == str(cust.id)
    assert data["status"] == "PENDING"
    assert data["total_amount"] == "127.50"
    assert len(data["items"]) == 1

    item = data["items"][0]
    assert item["product_id"] == str(p1.id)
    assert item["quantity"] == 5
    assert item["unit_price"] == "25.50"
    assert item["subtotal"] == "127.50"

    # Verify inventory was decremented by the aggregated quantity (5)
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock - 5

    # Verify database persistence: exactly one OrderItem row exists for this order
    order_id = uuid.UUID(data["id"])
    persisted_items = db_session.execute(
        select(OrderItem).where(OrderItem.order_id == order_id)
    ).scalars().all()
    assert len(persisted_items) == 1
    assert persisted_items[0].product_id == p1.id
    assert persisted_items[0].quantity == 5
    assert persisted_items[0].unit_price == Decimal("25.50")
    assert persisted_items[0].subtotal == Decimal("127.50")


def test_product_check_constraint_negative_stock_rejected(db_session: Session, test_setup_data: dict):
    """18. Verify that ck_products_stock_quantity_non_negative prevents negative stock in PostgreSQL."""
    v1 = test_setup_data["vendor1"]

    invalid_product = Product(
        vendor_id=v1.id,
        title="Negative Stock Product",
        price=Decimal("19.99"),
        category="Test Category",
        stock_quantity=-1,
        is_published=True,
    )

    with pytest.raises(IntegrityError) as exc_info:
        with db_session.begin_nested():
            db_session.add(invalid_product)
            db_session.flush()

    assert "ck_products_stock_quantity_non_negative" in str(exc_info.value)


# ==============================================================================
# Regression Tests: Fix 1 (Order Detail API) & Fix 3 (Cancellation & Restock)
# ==============================================================================


def test_order_detail_owner_success(client: TestClient, test_setup_data: dict):
    """Verify that an authenticated customer can retrieve details of their own order."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    # Place order
    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 2}]},
        headers=headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["id"]

    # Retrieve order detail
    detail_res = client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert detail_res.status_code == 200
    data = detail_res.json()
    assert data["id"] == order_id
    assert data["customer_id"] == str(test_setup_data["customer"].id)
    assert data["status"] == "PENDING"
    assert len(data["items"]) == 1
    assert data["items"][0]["product_id"] == str(p1.id)
    assert data["items"][0]["quantity"] == 2


def test_order_detail_admin_success(client: TestClient, test_setup_data: dict, admin_headers: dict):
    """Verify that an administrator can retrieve details of any customer order."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["id"]

    admin_res = client.get(f"/api/v1/orders/{order_id}", headers=admin_headers)
    assert admin_res.status_code == 200
    data = admin_res.json()
    assert data["id"] == order_id
    assert data["customer_id"] == str(test_setup_data["customer"].id)


def test_order_detail_unauthorized_customer_forbidden(
    client: TestClient, test_setup_data: dict, db_session: Session
):
    """Verify that a customer cannot view an order belonging to another customer."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=headers,
    )
    order_id = checkout_res.json()["id"]

    # Create a second customer
    cust2_user = User(
        email="second_customer@example.com",
        full_name="Second Customer",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(cust2_user)
    db_session.flush()

    cust2_profile = CustomerProfile(
        user_id=cust2_user.id,
        phone_number="+1 555-2222",
        shipping_address="200 Other St",
    )
    db_session.add(cust2_profile)
    db_session.commit()

    cust2_token = create_access_token(subject=str(cust2_user.id), role=cust2_user.role.value)
    cust2_headers = {"Authorization": f"Bearer {cust2_token}"}

    forbidden_res = client.get(f"/api/v1/orders/{order_id}", headers=cust2_headers)
    assert forbidden_res.status_code == 403
    assert "Forbidden" in forbidden_res.json()["detail"]


def test_order_detail_vendor_forbidden(client: TestClient, test_setup_data: dict):
    """Verify that vendors cannot directly query /orders/{id} and receive 403."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=headers,
    )
    order_id = checkout_res.json()["id"]

    # Use vendor 1's user
    v1_user = test_setup_data["vendor1"].user
    v1_token = create_access_token(subject=str(v1_user.id), role=v1_user.role.value)
    v1_headers = {"Authorization": f"Bearer {v1_token}"}

    vendor_res = client.get(f"/api/v1/orders/{order_id}", headers=v1_headers)
    assert vendor_res.status_code == 403
    assert "Direct order access is restricted" in vendor_res.json()["detail"]


def test_order_detail_not_found(client: TestClient, test_setup_data: dict):
    """Verify 404 response for nonexistent order UUID."""
    headers = test_setup_data["headers"]
    fake_id = uuid.uuid4()
    res = client.get(f"/api/v1/orders/{fake_id}", headers=headers)
    assert res.status_code == 404
    assert f"Order with ID {fake_id} not found." in res.json()["detail"]


def test_customer_order_history_endpoint(client: TestClient, test_setup_data: dict):
    """Verify GET /api/v1/orders/me returns customer's order history."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    res_checkout = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=headers,
    )
    assert res_checkout.status_code == 201

    history_res = client.get("/api/v1/orders/me", headers=headers)
    assert history_res.status_code == 200
    orders = history_res.json()
    assert len(orders) >= 1
    assert any(o["id"] == res_checkout.json()["id"] for o in orders)


def test_order_cancellation_restores_inventory(
    client: TestClient, test_setup_data: dict, admin_headers: dict, db_session: Session
):
    """Verify that cancelling a PENDING order restores the product's inventory atomically."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    db_session.refresh(p1)
    initial_stock = p1.stock_quantity

    # 1. Place order for 4 items
    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 4}]},
        headers=headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["id"]

    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock - 4

    # 2. Admin cancels order
    cancel_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "CANCELLED"},
        headers=admin_headers,
    )
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert cancel_data["status"] == "CANCELLED"

    # 3. Product stock is restored
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock


def test_order_cancellation_multi_item_multi_vendor_restores_all_inventory(
    client: TestClient, test_setup_data: dict, admin_headers: dict, db_session: Session
):
    """Verify that cancelling a multi-item multi-vendor order restores all items' inventory."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]
    p2 = test_setup_data["product2"]

    db_session.refresh(p1)
    db_session.refresh(p2)
    p1_initial = p1.stock_quantity
    p2_initial = p2.stock_quantity

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={
            "items": [
                {"product_id": str(p1.id), "quantity": 3},
                {"product_id": str(p2.id), "quantity": 2},
            ]
        },
        headers=headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["id"]

    db_session.refresh(p1)
    db_session.refresh(p2)
    assert p1.stock_quantity == p1_initial - 3
    assert p2.stock_quantity == p2_initial - 2

    # Admin cancels order
    cancel_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "CANCELLED"},
        headers=admin_headers,
    )
    assert cancel_res.status_code == 200

    db_session.refresh(p1)
    db_session.refresh(p2)
    assert p1.stock_quantity == p1_initial
    assert p2.stock_quantity == p2_initial


def test_order_cancellation_repeated_attempt_rejected(
    client: TestClient, test_setup_data: dict, admin_headers: dict, db_session: Session
):
    """Verify that repeated cancellation returns 400 and preserves exactly-once restoration."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    db_session.refresh(p1)
    initial_stock = p1.stock_quantity

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 2}]},
        headers=headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["id"]

    # First cancel -> 200 OK
    res1 = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "CANCELLED"},
        headers=admin_headers,
    )
    assert res1.status_code == 200

    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock

    # Second cancel -> 400 Bad Request
    res2 = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "CANCELLED"},
        headers=admin_headers,
    )
    assert res2.status_code == 400
    assert "terminal state" in res2.json()["detail"].lower()

    # Verify inventory was NOT double-restored
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock


def test_completed_order_cancellation_rejected(
    client: TestClient, test_setup_data: dict, admin_headers: dict, db_session: Session
):
    """Verify that a COMPLETED order cannot transition to CANCELLED (400 Bad Request)."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    db_session.refresh(p1)
    initial_stock = p1.stock_quantity

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 2}]},
        headers=headers,
    )
    order_id = checkout_res.json()["id"]

    # Mark COMPLETED
    complete_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=admin_headers,
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"

    # Attempt to CANCEL completed order -> 400
    cancel_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "CANCELLED"},
        headers=admin_headers,
    )
    assert cancel_res.status_code == 400
    assert "Invalid status transition" in cancel_res.json()["detail"]

    # Verify stock was not touched
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock - 2


def test_order_status_transitions_full_lifecycle(
    client: TestClient, test_setup_data: dict, admin_headers: dict
):
    """Verify full valid lifecycle: PENDING -> COMPLETED -> REFUNDED, and terminal state enforcement."""
    headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=headers,
    )
    order_id = checkout_res.json()["id"]

    # PENDING -> COMPLETED
    res_comp = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=admin_headers,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "COMPLETED"

    # COMPLETED -> REFUNDED
    res_ref = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "REFUNDED"},
        headers=admin_headers,
    )
    assert res_ref.status_code == 200
    assert res_ref.json()["status"] == "REFUNDED"

    # REFUNDED is terminal: cannot transition to anything
    res_term = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=admin_headers,
    )
    assert res_term.status_code == 400
    assert "terminal state" in res_term.json()["detail"].lower()


def test_order_status_update_authorization(
    client: TestClient, test_setup_data: dict, db_session: Session
):
    """Verify non-admin roles (customer, vendor) cannot update order status."""
    cust_headers = test_setup_data["headers"]
    p1 = test_setup_data["product1"]

    checkout_res = client.post(
        "/api/v1/orders/checkout",
        json={"items": [{"product_id": str(p1.id), "quantity": 1}]},
        headers=cust_headers,
    )
    order_id = checkout_res.json()["id"]

    # Customer tries to update status
    cust_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=cust_headers,
    )
    assert cust_res.status_code == 403

    # Vendor tries to update status
    v1_user = test_setup_data["vendor1"].user
    v1_token = create_access_token(subject=str(v1_user.id), role=v1_user.role.value)
    v1_headers = {"Authorization": f"Bearer {v1_token}"}
    vendor_res = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=v1_headers,
    )
    assert vendor_res.status_code == 403


def test_update_order_status_not_found(client: TestClient, admin_headers: dict):
    """Verify 404 when admin attempts to update a nonexistent order ID."""
    fake_id = uuid.uuid4()
    res = client.patch(
        f"/api/v1/orders/{fake_id}/status",
        json={"status": "COMPLETED"},
        headers=admin_headers,
    )
    assert res.status_code == 404