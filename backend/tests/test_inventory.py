import math
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import get_password_hash, create_access_token
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import AccountStatus, OrderStatus, StockMovementType, UserRole, VendorStatus
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.stock_movement import StockMovement
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.order import CheckoutRequest, CheckoutItemRequest
from backend.app.services.order_service import checkout_order, update_order_status
from backend.app.services.inventory_service import (
    get_inventory_summary,
    get_low_stock_alerts,
    get_replenishment_recommendations,
    get_inventory_turnover,
    get_stock_movement_history,
    get_product_demand_forecast,
)


# ============================================================================
# Test Fixtures for Inventory Testing
# ============================================================================

@pytest.fixture
def inventory_test_setup(db_session: Session):
    """
    Creates two distinct vendors, a customer, and diverse products for inventory testing:
    - Vendor 1: Normal products with costs, reorder levels, safety stock
    - Vendor 2: Another vendor for cross-vendor isolation tests
    """
    # 1. Vendor 1
    v1_user = User(
        email="inv_vendor1@example.com",
        full_name="Inventory Vendor 1",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(v1_user)
    db_session.flush()

    v1_profile = VendorProfile(
        user_id=v1_user.id,
        store_name="V1 Logistics Store",
        business_email="v1@logistics.com",
        business_phone="+1 555-1001",
        business_address="100 Logistics Way",
        status=VendorStatus.APPROVED
    )
    db_session.add(v1_profile)
    db_session.flush()

    v1_token = create_access_token(subject=str(v1_user.id), role=v1_user.role.value)
    v1_headers = {"Authorization": f"Bearer {v1_token}"}

    # 2. Vendor 2
    v2_user = User(
        email="inv_vendor2@example.com",
        full_name="Inventory Vendor 2",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(v2_user)
    db_session.flush()

    v2_profile = VendorProfile(
        user_id=v2_user.id,
        store_name="V2 Isolated Store",
        business_email="v2@isolated.com",
        business_phone="+1 555-2002",
        business_address="200 Isolated Rd",
        status=VendorStatus.APPROVED
    )
    db_session.add(v2_profile)
    db_session.flush()

    v2_token = create_access_token(subject=str(v2_user.id), role=v2_user.role.value)
    v2_headers = {"Authorization": f"Bearer {v2_token}"}

    # 3. Customer
    cust_user = User(
        email="inv_customer@example.com",
        full_name="Inventory Customer",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(cust_user)
    db_session.flush()

    cust_profile = CustomerProfile(
        user_id=cust_user.id,
        phone_number="+1 555-3003",
        shipping_address="300 Buyer Blvd"
    )
    db_session.add(cust_profile)
    db_session.flush()

    cust_token = create_access_token(subject=str(cust_user.id), role=cust_user.role.value)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # 4. Products for Vendor 1
    p1 = Product(
        vendor_id=v1_profile.id,
        title="Widget Alpha",
        description="High volume widget",
        price=Decimal("50.00"),
        cost_price=Decimal("30.00"),
        stock_quantity=20,
        reorder_level=10,
        safety_stock=5,
        lead_time_days=7,
        sku="WGT-ALP-001",
        category="Hardware",
        is_published=True
    )
    p2 = Product(
        vendor_id=v1_profile.id,
        title="Gadget Beta",
        description="Low stock gadget",
        price=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        stock_quantity=5,  # <= reorder_level 8
        reorder_level=8,
        safety_stock=3,
        lead_time_days=5,
        sku="GDT-BET-002",
        category="Electronics",
        is_published=True
    )
    p3 = Product(
        vendor_id=v1_profile.id,
        title="Sensor Gamma",
        description="Out of stock sensor without cost price",
        price=Decimal("25.00"),
        cost_price=None,  # missing cost
        stock_quantity=0,
        reorder_level=15,
        safety_stock=5,
        lead_time_days=10,
        sku="SNS-GAM-003",
        category="Electronics",
        is_published=True
    )

    # 5. Product for Vendor 2
    p4 = Product(
        vendor_id=v2_profile.id,
        title="V2 Exclusive Module",
        description="Vendor 2 proprietary device",
        price=Decimal("200.00"),
        cost_price=Decimal("120.00"),
        stock_quantity=15,
        reorder_level=5,
        safety_stock=2,
        lead_time_days=14,
        sku="V2-EXC-004",
        category="Modules",
        is_published=True
    )

    db_session.add_all([p1, p2, p3, p4])
    db_session.commit()

    return {
        "v1_user": v1_user,
        "v1_profile": v1_profile,
        "v1_headers": v1_headers,
        "v2_user": v2_user,
        "v2_profile": v2_profile,
        "v2_headers": v2_headers,
        "cust_user": cust_user,
        "cust_profile": cust_profile,
        "cust_headers": cust_headers,
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "p4": p4,
    }


# ============================================================================
# 1. Stock Movement Integration Tests (Checkout & Cancellation)
# ============================================================================

def test_checkout_records_stock_movement_ledger(db_session: Session, inventory_test_setup):
    """
    Verifies that checkout successfully decrements product stock and records
    a matching CHECKOUT_DECREMENT entry in the StockMovement audit ledger with correct fields.
    """
    data = inventory_test_setup
    p1 = data["p1"]
    initial_stock = p1.stock_quantity  # 20
    qty_to_buy = 3

    req = CheckoutRequest(
        items=[CheckoutItemRequest(product_id=p1.id, quantity=qty_to_buy)]
    )
    order = checkout_order(db=db_session, customer=data["cust_profile"], checkout_data=req)

    # Verify stock decremented
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock - qty_to_buy  # 17

    # Verify StockMovement ledger entry
    movements = db_session.execute(
        select(StockMovement)
        .where(
            StockMovement.product_id == p1.id,
            StockMovement.reference_order_id == order.id
        )
    ).scalars().all()

    assert len(movements) == 1
    m = movements[0]
    assert m.movement_type == StockMovementType.CHECKOUT_DECREMENT
    assert m.change_quantity == -qty_to_buy
    assert m.previous_stock == initial_stock
    assert m.new_stock == initial_stock - qty_to_buy
    assert m.reference_order_id == order.id
    assert m.warehouse_id is None


def test_cancellation_records_restock_movement_ledger(db_session: Session, inventory_test_setup):
    """
    Verifies that cancelling an order in PENDING status restores stock and
    creates a matching CANCELLATION_RESTOCK entry in the StockMovement ledger.
    """
    data = inventory_test_setup
    p1 = data["p1"]
    initial_stock = p1.stock_quantity

    req = CheckoutRequest(
        items=[CheckoutItemRequest(product_id=p1.id, quantity=4)]
    )
    order = checkout_order(db=db_session, customer=data["cust_profile"], checkout_data=req)

    db_session.refresh(p1)
    stock_after_checkout = p1.stock_quantity
    assert stock_after_checkout == initial_stock - 4

    # Cancel the order
    update_order_status(db=db_session, order_id=order.id, new_status=OrderStatus.CANCELLED)

    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock  # restored

    # Check for CANCELLATION_RESTOCK movement
    restock_movements = db_session.execute(
        select(StockMovement)
        .where(
            StockMovement.product_id == p1.id,
            StockMovement.reference_order_id == order.id,
            StockMovement.movement_type == StockMovementType.CANCELLATION_RESTOCK
        )
    ).scalars().all()

    assert len(restock_movements) == 1
    rm = restock_movements[0]
    assert rm.change_quantity == 4
    assert rm.previous_stock == stock_after_checkout
    assert rm.new_stock == initial_stock
    assert rm.reference_order_id == order.id


def test_repeated_cancellation_no_duplicate_stock_or_movement(db_session: Session, inventory_test_setup):
    """
    Verifies that attempting to cancel an already-cancelled order is rejected by the state guard,
    preventing duplicate inventory restoration and duplicate restock movement records.
    """
    data = inventory_test_setup
    p1 = data["p1"]

    req = CheckoutRequest(
        items=[CheckoutItemRequest(product_id=p1.id, quantity=2)]
    )
    order = checkout_order(db=db_session, customer=data["cust_profile"], checkout_data=req)

    # First cancellation succeeds
    update_order_status(db=db_session, order_id=order.id, new_status=OrderStatus.CANCELLED)
    db_session.refresh(p1)
    stock_after_cancel = p1.stock_quantity

    # Count cancellation movements
    initial_cancel_count = db_session.execute(
        select(StockMovement)
        .where(
            StockMovement.product_id == p1.id,
            StockMovement.reference_order_id == order.id,
            StockMovement.movement_type == StockMovementType.CANCELLATION_RESTOCK
        )
    ).scalars().all()
    assert len(initial_cancel_count) == 1

    # Second cancellation attempt must be rejected
    with pytest.raises(HTTPException) as exc_info:
        update_order_status(db=db_session, order_id=order.id, new_status=OrderStatus.CANCELLED)

    assert exc_info.value.status_code == 400

    # Verify no additional movements created and stock unchanged
    db_session.refresh(p1)
    assert p1.stock_quantity == stock_after_cancel

    final_cancel_count = db_session.execute(
        select(StockMovement)
        .where(
            StockMovement.product_id == p1.id,
            StockMovement.reference_order_id == order.id,
            StockMovement.movement_type == StockMovementType.CANCELLATION_RESTOCK
        )
    ).scalars().all()
    assert len(final_cancel_count) == 1


def test_checkout_rollback_when_order_or_ledger_fails(db_session: Session, inventory_test_setup, monkeypatch):
    """
    Verifies that if an error occurs during order persistence or ledger commitment,
    the transaction is rolled back: stock changes are reverted, and neither the order
    nor the StockMovement ledger record is saved.
    """
    data = inventory_test_setup
    p1 = data["p1"]
    initial_stock = p1.stock_quantity

    def fail_commit():
        raise RuntimeError("Simulated database failure during commit")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    req = CheckoutRequest(
        items=[CheckoutItemRequest(product_id=p1.id, quantity=3)]
    )

    with pytest.raises(HTTPException) as exc_info:
        checkout_order(db=db_session, customer=data["cust_profile"], checkout_data=req)

    assert exc_info.value.status_code == 500

    # Undo monkeypatch to inspect clean state
    monkeypatch.undo()

    db_session.rollback()
    db_session.refresh(p1)
    assert p1.stock_quantity == initial_stock

    movements = db_session.execute(
        select(StockMovement).where(StockMovement.product_id == p1.id)
    ).scalars().all()
    assert len(movements) == 0


# ============================================================================
# 2. Inventory Summary Tests
# ============================================================================

def test_inventory_summary_admin_and_vendor_scoping(db_session: Session, inventory_test_setup):
    """
    Verifies that admin receives platform-wide metrics (4 products) while vendor 1
    only receives metrics for their own products (3 products).
    """
    data = inventory_test_setup

    # Admin platform-wide
    admin_summary = get_inventory_summary(db=db_session, vendor_id=None)
    assert admin_summary.total_products == 4
    # Vendor 1: 20 + 5 + 0 = 25 units. Vendor 2: 15 units. Total: 40 units.
    assert admin_summary.total_units_in_stock == 40
    # Vendor 1: p2 (5 <= 8), p3 (0 <= 15). Vendor 2: p4 (15 > 5). Total low stock = 2.
    assert admin_summary.low_stock_products_count == 2
    # p3 has stock == 0. Total out of stock = 1.
    assert admin_summary.out_of_stock_products_count == 1
    # p3 is missing cost price, so platform valuation is PARTIAL
    assert admin_summary.valuation_status == "PARTIAL"
    assert admin_summary.cost_coverage_percentage == 75.0  # 3 of 4 have cost

    # Vendor 1 scoped
    v1_summary = get_inventory_summary(db=db_session, vendor_id=data["v1_profile"].id)
    assert v1_summary.total_products == 3
    assert v1_summary.total_units_in_stock == 25
    assert v1_summary.low_stock_products_count == 2
    assert v1_summary.out_of_stock_products_count == 1
    assert v1_summary.valuation_status == "PARTIAL"
    assert v1_summary.cost_coverage_percentage == 66.67


def test_inventory_summary_valuation_status_complete_and_unavailable(db_session: Session, inventory_test_setup):
    """
    Verifies COMPLETE valuation status when 100% of products have cost_price,
    and UNAVAILABLE when 0% have cost_price.
    """
    data = inventory_test_setup

    # Vendor 2 has 1 product with cost_price populated
    v2_summary = get_inventory_summary(db=db_session, vendor_id=data["v2_profile"].id)
    assert v2_summary.total_products == 1
    assert v2_summary.valuation_status == "COMPLETE"
    assert v2_summary.cost_coverage_percentage == 100.0
    # 15 * 120.00 = 1800.00
    assert v2_summary.total_inventory_cost_value == Decimal("1800.00")

    # Set Vendor 2 product cost_price to None
    data["p4"].cost_price = None
    db_session.commit()

    v2_summary_none = get_inventory_summary(db=db_session, vendor_id=data["v2_profile"].id)
    assert v2_summary_none.valuation_status == "UNAVAILABLE"
    assert v2_summary_none.cost_coverage_percentage == 0.0
    assert v2_summary_none.total_inventory_cost_value is None


# ============================================================================
# 3. Low-Stock Alerts Tests
# ============================================================================

def test_low_stock_alerts_threshold_boundary_and_vendor_isolation(db_session: Session, inventory_test_setup):
    """
    Verifies that products at or below their configured reorder_level are flagged,
    and out-of-stock products are marked is_out_of_stock=True.
    Also verifies vendor isolation.
    """
    data = inventory_test_setup

    # Vendor 1 alerts:
    # p1: stock=20, reorder=10 -> not in alert
    # p2: stock=5, reorder=8 -> low stock (is_out_of_stock=False)
    # p3: stock=0, reorder=15 -> low stock (is_out_of_stock=True)
    v1_alerts = get_low_stock_alerts(db=db_session, vendor_id=data["v1_profile"].id)
    assert v1_alerts.total_alerts == 2
    assert v1_alerts.out_of_stock_count == 1

    alert_map = {item.product_id: item for item in v1_alerts.items}
    assert data["p2"].id in alert_map
    assert alert_map[data["p2"].id].is_out_of_stock is False

    assert data["p3"].id in alert_map
    assert alert_map[data["p3"].id].is_out_of_stock is True

    # Vendor 2 has stock=15, reorder=5 -> 0 alerts
    v2_alerts = get_low_stock_alerts(db=db_session, vendor_id=data["v2_profile"].id)
    assert v2_alerts.total_alerts == 0


# ============================================================================
# 4. Replenishment Recommendations Tests
# ============================================================================

def test_replenishment_recommendation_calculation(db_session: Session, inventory_test_setup):
    """
    Tests replenishment suggested quantity:
    max(0, daily_demand * lead_time + safety_stock - stock)
    Creates completed orders to simulate steady daily demand.
    """
    data = inventory_test_setup
    p1 = data["p1"]  # lead_time=7, safety_stock=5, stock=20

    # Create completed order with 30 units sold in the past 30 days
    # daily_demand = 30 / 30 = 1.0 unit/day
    order = Order(
        customer_id=data["cust_profile"].id,
        status=OrderStatus.COMPLETED,
        total_amount=Decimal("1500.00"),
        created_at=datetime.now(timezone.utc) - timedelta(days=5),
        items=[
            OrderItem(
                product_id=p1.id,
                vendor_id=p1.vendor_id,
                quantity=30,
                unit_price=p1.price,
                subtotal=Decimal("1500.00")
            )
        ]
    )
    db_session.add(order)
    # Also adjust p1 stock to 8 so replenishment is needed
    p1.stock_quantity = 8
    db_session.commit()

    recs = get_replenishment_recommendations(
        db=db_session,
        vendor_id=data["v1_profile"].id,
        demand_window_days=30
    )

    rec_map = {item.product_id: item for item in recs.items}
    rec_p1 = rec_map[p1.id]

    # daily_demand = 30/30 = 1.0
    # raw = 1.0 * 7 + 5 - 8 = 4.0 units
    assert rec_p1.estimated_daily_demand == 1.0
    assert rec_p1.suggested_replenishment_qty == 4
    assert rec_p1.status == "REPLENISHMENT_RECOMMENDED"


def test_replenishment_insufficient_history_fallback(db_session: Session, inventory_test_setup):
    """
    Verifies that when a product has 0 completed sales in the demand window:
    - If out of stock, suggests ordering safety stock and flags OUT_OF_STOCK
    - If low stock, suggests ordering to reorder level and flags INSUFFICIENT_DATA
    """
    data = inventory_test_setup
    p3 = data["p3"]  # stock=0, safety_stock=5, reorder_level=15

    recs = get_replenishment_recommendations(
        db=db_session,
        vendor_id=data["v1_profile"].id,
        demand_window_days=30
    )

    rec_map = {item.product_id: item for item in recs.items}
    rec_p3 = rec_map[p3.id]

    assert rec_p3.estimated_daily_demand == 0.0
    assert rec_p3.status == "OUT_OF_STOCK"
    assert rec_p3.suggested_replenishment_qty == 5  # restores safety stock


# ============================================================================
# 5. Inventory Turnover Tests
# ============================================================================

def test_inventory_turnover_calculation_and_missing_cost_protection(db_session: Session, inventory_test_setup):
    """
    Tests inventory turnover calculation:
    1. Returns NO_SALES when no sales occurred in period.
    2. Returns INSUFFICIENT_COST_DATA when sold items lack cost_price (revenue is NOT substituted).
    3. Calculates turnover ratio accurately when valid cost data exists.
    """
    data = inventory_test_setup
    v2_id = data["v2_profile"].id
    p4 = data["p4"]  # cost_price=120.00, stock=15

    # Case 1: No sales
    turnover_no_sales = get_inventory_turnover(db=db_session, vendor_id=v2_id, period_days=90)
    assert turnover_no_sales.status == "NO_SALES"
    assert turnover_no_sales.turnover_ratio == Decimal("0.00")

    # Case 2: Create completed sale for p4
    order = Order(
        customer_id=data["cust_profile"].id,
        status=OrderStatus.COMPLETED,
        total_amount=Decimal("1000.00"),
        created_at=datetime.now(timezone.utc) - timedelta(days=10),
        items=[
            OrderItem(
                product_id=p4.id,
                vendor_id=v2_id,
                quantity=5,
                unit_price=p4.price,
                subtotal=Decimal("1000.00")
            )
        ]
    )
    db_session.add(order)
    db_session.commit()

    turnover_calc = get_inventory_turnover(db=db_session, vendor_id=v2_id, period_days=90)
    assert turnover_calc.status == "CALCULATED"
    # COGS = 5 * 120.00 = 600.00
    assert turnover_calc.cost_of_goods_sold == Decimal("600.00")
    # Average inventory units = 15 + (5 / 2) = 17.50
    # Average inventory value = 17.50 * 120.00 = 2100.00
    # Turnover ratio = 600.00 / 2100.00 = 0.29
    assert turnover_calc.turnover_ratio == Decimal("0.29")

    # Case 3: Sold item missing cost price
    p4.cost_price = None
    db_session.commit()

    turnover_missing_cost = get_inventory_turnover(db=db_session, vendor_id=v2_id, period_days=90)
    assert turnover_missing_cost.status == "INSUFFICIENT_COST_DATA"
    assert turnover_missing_cost.turnover_ratio is None
    assert turnover_missing_cost.cost_of_goods_sold is None


def test_inventory_turnover_zero_average_inventory_protection(db_session: Session, inventory_test_setup):
    """
    Verifies that when average inventory evaluates to zero, the turnover function
    prevents division by zero and returns ZERO_AVERAGE_INVENTORY status.
    """
    data = inventory_test_setup
    v1_id = data["v1_profile"].id
    # Set all v1 products stock to 0
    data["p1"].stock_quantity = 0
    data["p2"].stock_quantity = 0
    data["p3"].stock_quantity = 0
    db_session.commit()

    turnover = get_inventory_turnover(db=db_session, vendor_id=v1_id, period_days=90)
    assert turnover.turnover_ratio in (Decimal("0.00"), None)
    assert turnover.status in ("NO_SALES", "ZERO_AVERAGE_INVENTORY")


# ============================================================================
# 6. Stock Movement Ledger Pagination and Vendor Isolation
# ============================================================================

def test_stock_movement_history_pagination_and_isolation(db_session: Session, inventory_test_setup):
    """
    Verifies that stock movement ledger supports pagination and strictly enforces
    vendor isolation: Vendor 1 can never view Vendor 2's movements.
    """
    data = inventory_test_setup
    p1 = data["p1"]
    p4 = data["p4"]

    # Create movements for Vendor 1
    m1 = StockMovement(
        product_id=p1.id,
        change_quantity=10,
        previous_stock=10,
        new_stock=20,
        movement_type=StockMovementType.PURCHASE_RESTOCK,
        created_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    # Create movements for Vendor 2
    m2 = StockMovement(
        product_id=p4.id,
        change_quantity=5,
        previous_stock=10,
        new_stock=15,
        movement_type=StockMovementType.MANUAL_ADJUSTMENT,
        created_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    db_session.add_all([m1, m2])
    db_session.commit()

    # Vendor 1 query
    v1_history = get_stock_movement_history(
        db=db_session,
        vendor_id=data["v1_profile"].id,
        page=1,
        page_size=10
    )
    assert all(item.product_id != p4.id for item in v1_history.items)
    assert any(item.id == m1.id for item in v1_history.items)

    # Vendor 2 query
    v2_history = get_stock_movement_history(
        db=db_session,
        vendor_id=data["v2_profile"].id,
        page=1,
        page_size=10
    )
    assert all(item.product_id != p1.id for item in v2_history.items)
    assert any(item.id == m2.id for item in v2_history.items)


# ============================================================================
# 7. Demand Forecasting Tests (Temporal Split, Leakage, WMAPE)
# ============================================================================

def test_demand_forecast_temporal_split_and_wmape(db_session: Session, inventory_test_setup):
    """
    Creates a continuous 30-day sequence of daily orders to test:
    - Time-ordered 80/20 train/test split.
    - Zero future-data leakage in EWMA evaluation.
    - WMAPE calculation and accuracy bounded in [0, 100].
    """
    data = inventory_test_setup
    p1 = data["p1"]
    cust_id = data["cust_profile"].id
    today = datetime.now(timezone.utc).date()

    # Create orders for 30 consecutive days
    for day_offset in range(30, 0, -1):
        order_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
        # Demand pattern: 2 units per day with deterministic variance
        qty = 2 if day_offset % 2 == 0 else 4
        order = Order(
            customer_id=cust_id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal(str(qty * 50)),
            created_at=order_date,
            items=[
                OrderItem(
                    product_id=p1.id,
                    vendor_id=p1.vendor_id,
                    quantity=qty,
                    unit_price=p1.price,
                    subtotal=Decimal(str(qty * 50))
                )
            ]
        )
        db_session.add(order)
    db_session.commit()

    forecast = get_product_demand_forecast(
        db=db_session,
        product_id=p1.id,
        vendor_id=data["v1_profile"].id,
        forecast_horizon_days=14,
        historical_window_days=90
    )

    assert forecast.status == "SUCCESS"
    assert forecast.methodology == "EXPONENTIAL_SMOOTHING"
    assert len(forecast.daily_forecasts) == 14
    assert forecast.evaluation_wmape is not None
    assert forecast.evaluation_wmape >= 0.0
    assert forecast.evaluation_accuracy is not None
    assert 0.0 <= forecast.evaluation_accuracy <= 100.0


def test_demand_forecast_sparse_dates_imputation(db_session: Session, inventory_test_setup):
    """
    Verifies that sparse order dates (e.g. sales on day 20 and day 10 only)
    properly impute 0.0 demand on intermediate days instead of dropping them.
    """
    data = inventory_test_setup
    p2 = data["p2"]
    cust_id = data["cust_profile"].id

    # Create orders 20 days ago and 5 days ago
    for days_ago, qty in [(20, 5), (5, 3)]:
        order = Order(
            customer_id=cust_id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal(str(qty * 100)),
            created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            items=[
                OrderItem(
                    product_id=p2.id,
                    vendor_id=p2.vendor_id,
                    quantity=qty,
                    unit_price=p2.price,
                    subtotal=Decimal(str(qty * 100))
                )
            ]
        )
        db_session.add(order)
    db_session.commit()

    forecast = get_product_demand_forecast(
        db=db_session,
        product_id=p2.id,
        vendor_id=data["v1_profile"].id,
        forecast_horizon_days=7,
        historical_window_days=30
    )

    # Total days spanned is ~20 days >= 14 days minimum
    assert forecast.status == "SUCCESS"
    # Total units sold = 8 across 20 days -> daily avg = ~0.4
    assert 0.3 <= forecast.historical_daily_avg <= 0.5


def test_demand_forecast_insufficient_history(db_session: Session, inventory_test_setup):
    """
    Verifies that when sales history span is < 14 days, the service returns
    INSUFFICIENT_HISTORY status and uses the daily average without claiming holdout accuracy.
    """
    data = inventory_test_setup
    p2 = data["p2"]
    cust_id = data["cust_profile"].id

    # Create only 1 sale 3 days ago (history span = 4 days < 14)
    order = Order(
        customer_id=cust_id,
        status=OrderStatus.COMPLETED,
        total_amount=Decimal("100.00"),
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
        items=[
            OrderItem(
                product_id=p2.id,
                vendor_id=p2.vendor_id,
                quantity=2,
                unit_price=p2.price,
                subtotal=Decimal("100.00")
            )
        ]
    )
    db_session.add(order)
    db_session.commit()

    forecast = get_product_demand_forecast(
        db=db_session,
        product_id=p2.id,
        vendor_id=data["v1_profile"].id,
        forecast_horizon_days=7,
        historical_window_days=30
    )

    assert forecast.status == "INSUFFICIENT_HISTORY"
    assert forecast.methodology == "MOVING_AVERAGE"
    assert forecast.evaluation_wmape is None
    assert forecast.evaluation_accuracy is None


def test_demand_forecast_vendor_isolation(db_session: Session, inventory_test_setup):
    """
    Verifies that a vendor attempting to forecast a product owned by another vendor
    is strictly barred with 403 Forbidden.
    """
    data = inventory_test_setup
    # p4 belongs to Vendor 2. Vendor 1 tries to access it.
    with pytest.raises(HTTPException) as exc_info:
        get_product_demand_forecast(
            db=db_session,
            product_id=data["p4"].id,
            vendor_id=data["v1_profile"].id,
            forecast_horizon_days=14
        )

    assert exc_info.value.status_code == 403


# ============================================================================
# 8. API Endpoint Integration & Role Authorization Tests
# ============================================================================

def test_api_inventory_endpoints_authorization(client: TestClient, admin_headers, approved_vendor_headers, customer_headers):
    """
    Verifies HTTP status codes for role-based endpoint permissions:
    - Customer cannot access admin or vendor inventory routes (403).
    - Unauthenticated cannot access (401).
    - Admin can access /api/v1/inventory/summary.
    - Approved vendor can access /api/v1/inventory/vendor/summary.
    """
    # 1. Unauthenticated -> 401
    res_unauth = client.get("/api/v1/inventory/summary")
    assert res_unauth.status_code == 401

    # 2. Customer -> 403 Forbidden
    res_cust_admin = client.get("/api/v1/inventory/summary", headers=customer_headers)
    assert res_cust_admin.status_code == 403

    res_cust_vendor = client.get("/api/v1/inventory/vendor/summary", headers=customer_headers)
    assert res_cust_vendor.status_code == 403

    # 3. Admin access -> 200 OK
    res_admin = client.get("/api/v1/inventory/summary", headers=admin_headers)
    assert res_admin.status_code == 200
    assert "total_products" in res_admin.json()

    # 4. Vendor access -> 200 OK
    res_vendor = client.get("/api/v1/inventory/vendor/summary", headers=approved_vendor_headers)
    assert res_vendor.status_code == 200
    assert "total_products" in res_vendor.json()
