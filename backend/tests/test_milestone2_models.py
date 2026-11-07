import uuid
from decimal import Decimal
import pytest
from sqlalchemy import select, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models.category import Category
from backend.app.models.warehouse import Warehouse
from backend.app.models.stock_movement import StockMovement
from backend.app.models.product import Product
from backend.app.models.order import Order
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import StockMovementType, OrderStatus
from backend.app.core.config import settings


def test_safety_check_test_database_target(db_session: Session):
    """Verify that tests strictly target shopsense_test and never touch shopsense_dev."""
    conn_url = str(db_session.bind.engine.url)
    assert "shopsense_test" in conn_url, (
        f"CRITICAL SAFETY VIOLATION: Test running against non-test database: {conn_url}"
    )


def test_category_model_creation_and_self_referential_hierarchy(db_session: Session):
    """Verify Category creation and parent-child tree hierarchy."""
    # 1. Create root parent category
    root = Category(
        name="Electronics Hardware",
        slug="electronics-hardware",
        description="Core retail electronics and POS hardware",
        is_active=True
    )
    db_session.add(root)
    db_session.flush()

    assert root.id is not None
    assert root.parent_id is None

    # 2. Create subcategory with parent_id
    sub = Category(
        name="Barcode Scanners",
        slug="barcode-scanners",
        parent_id=root.id,
        description="Handheld and presentation scanners",
        is_active=True
    )
    db_session.add(sub)
    db_session.flush()

    # 3. Query back and verify hierarchy relationships
    queried_sub = db_session.execute(
        select(Category).where(Category.id == sub.id)
    ).scalar_one()

    assert queried_sub.parent is not None
    assert queried_sub.parent.id == root.id
    assert queried_sub.parent.name == "Electronics Hardware"

    queried_root = db_session.execute(
        select(Category).where(Category.id == root.id)
    ).scalar_one()
    assert len(queried_root.subcategories) == 1
    assert queried_root.subcategories[0].id == sub.id
    assert queried_root.subcategories[0].name == "Barcode Scanners"


def test_category_unique_name_and_slug(db_session: Session):
    """Verify uniqueness constraints on category name and slug."""
    cat1 = Category(name="POS Systems", slug="pos-systems")
    db_session.add(cat1)
    db_session.flush()

    # Duplicate name
    dup_name = Category(name="POS Systems", slug="pos-systems-2")
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(dup_name)
            db_session.flush()

    # Duplicate slug
    dup_slug = Category(name="Point of Sale", slug="pos-systems")
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(dup_slug)
            db_session.flush()


def test_warehouse_model_creation_and_uniqueness(db_session: Session):
    """Verify Warehouse creation and code uniqueness constraint."""
    w1 = Warehouse(
        name="Bengaluru Central Hub",
        code="WH-BLR-01",
        location="Peenya Industrial Area, Bengaluru, Karnataka",
        contact_email="blr01@shopsense.internal",
        contact_phone="+91 80 2839 0001",
        is_active=True
    )
    db_session.add(w1)
    db_session.flush()

    assert w1.id is not None
    assert w1.code == "WH-BLR-01"

    # Duplicate warehouse code rejected
    dup_w = Warehouse(
        name="Bengaluru Backup Hub",
        code="WH-BLR-01",
        location="Whitefield, Bengaluru"
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(dup_w)
            db_session.flush()


def test_product_backward_compatible_fields_and_defaults(
    db_session: Session, approved_vendor: tuple[User, VendorProfile]
):
    """Verify that new Product fields have safe defaults and preserve backward compatibility."""
    _, vendor = approved_vendor

    # Create category for linking
    cat = Category(name="Receipt Printers", slug="receipt-printers")
    db_session.add(cat)
    db_session.flush()

    # 1. Product created with default inventory parameters and optional category_id
    p = Product(
        vendor_id=vendor.id,
        title="Thermal Receipt Printer TP-80",
        price=Decimal("4500.00"),
        category="Hardware",  # existing flat string preserved
        cost_price=Decimal("3200.00"),
        category_id=cat.id,
        stock_quantity=50
    )
    db_session.add(p)
    db_session.flush()
    db_session.refresh(p)

    assert p.id is not None
    assert p.reorder_level == 15  # default value
    assert p.safety_stock == 5    # default value
    assert p.lead_time_days == 7  # default value
    assert p.cost_price == Decimal("3200.00")
    assert p.category == "Hardware"
    assert p.category_id == cat.id
    assert p.category_rel.name == "Receipt Printers"


def test_product_new_check_constraints(
    db_session: Session, approved_vendor: tuple[User, VendorProfile]
):
    """Verify check constraints on reorder_level, safety_stock, lead_time_days, cost_price."""
    _, vendor = approved_vendor

    # Negative reorder_level rejected
    p_bad_reorder = Product(
        vendor_id=vendor.id,
        title="Bad Reorder Product",
        price=Decimal("100.00"),
        category="Hardware",
        reorder_level=-1
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(p_bad_reorder)
            db_session.flush()

    # Negative safety_stock rejected
    p_bad_safety = Product(
        vendor_id=vendor.id,
        title="Bad Safety Product",
        price=Decimal("100.00"),
        category="Hardware",
        safety_stock=-1
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(p_bad_safety)
            db_session.flush()

    # Negative lead_time_days rejected
    p_bad_lead = Product(
        vendor_id=vendor.id,
        title="Bad Lead Time Product",
        price=Decimal("100.00"),
        category="Hardware",
        lead_time_days=-1
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(p_bad_lead)
            db_session.flush()

    # Negative cost_price rejected
    p_bad_cost = Product(
        vendor_id=vendor.id,
        title="Bad Cost Product",
        price=Decimal("100.00"),
        category="Hardware",
        cost_price=Decimal("-10.00")
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(p_bad_cost)
            db_session.flush()


def test_stock_movement_ledger_creation_and_relationships(
    db_session: Session,
    approved_vendor: tuple[User, VendorProfile],
    customer_user: tuple[User, CustomerProfile]
):
    """Verify StockMovement ledger creation, foreign keys, and relationships."""
    _, vendor = approved_vendor
    _, customer = customer_user

    # Create product
    p1 = Product(
        vendor_id=vendor.id,
        title="Test Scanner Pro",
        price=Decimal("2500.00"),
        category="Hardware",
        stock_quantity=50
    )
    db_session.add(p1)
    db_session.flush()

    # Create warehouse
    wh = Warehouse(
        name="Mumbai Logistics Center",
        code="WH-MUM-01",
        location="Bhiwandi, Maharashtra"
    )
    db_session.add(wh)
    db_session.flush()

    # Create order for reference
    order = Order(
        customer_id=customer.id,
        status=OrderStatus.PENDING,
        total_amount=Decimal("51.00")
    )
    db_session.add(order)
    db_session.flush()

    # Create stock movement record
    sm = StockMovement(
        product_id=p1.id,
        warehouse_id=wh.id,
        change_quantity=-2,
        previous_stock=50,
        new_stock=48,
        movement_type=StockMovementType.CHECKOUT_DECREMENT,
        reference_order_id=order.id,
        notes="Order checkout stock decrement"
    )
    db_session.add(sm)
    db_session.flush()
    db_session.refresh(sm)

    assert sm.id is not None
    assert sm.product.id == p1.id
    assert sm.warehouse.id == wh.id
    assert sm.order.id == order.id
    assert sm.movement_type == StockMovementType.CHECKOUT_DECREMENT
    assert sm.change_quantity == -2
    assert sm.previous_stock == 50
    assert sm.new_stock == 48

    # Verify back-populates on product and warehouse
    assert sm in p1.stock_movements
    assert sm in wh.stock_movements


def test_stock_movement_negative_new_stock_rejected(
    db_session: Session, approved_vendor: tuple[User, VendorProfile]
):
    """Verify check constraint ck_stock_movements_new_stock_non_negative prevents negative stock balance."""
    _, vendor = approved_vendor

    p1 = Product(
        vendor_id=vendor.id,
        title="Test Scale 10kg",
        price=Decimal("1500.00"),
        category="Hardware",
        stock_quantity=10
    )
    db_session.add(p1)
    db_session.flush()

    sm_invalid = StockMovement(
        product_id=p1.id,
        change_quantity=-60,
        previous_stock=10,
        new_stock=-50,
        movement_type=StockMovementType.CHECKOUT_DECREMENT
    )
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(sm_invalid)
            db_session.flush()


def test_alembic_migration_revision_5474c90b925d_integrity():
    """Verify the Milestone 2 Phase 1 migration script structure and upgrade/downgrade callable signatures."""
    import importlib.util
    from pathlib import Path

    migration_path = Path("backend/alembic/versions/5474c90b925d_create_warehouses_categories_and_stock_.py")
    assert migration_path.exists(), f"Migration file missing at: {migration_path}"

    spec = importlib.util.spec_from_file_location("m2_phase1_migration", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.revision == "5474c90b925d"
    assert module.down_revision == "c746127dd814"
    assert callable(module.upgrade)
    assert callable(module.downgrade)
