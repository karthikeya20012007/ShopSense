import math
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.core.security import get_password_hash, create_access_token
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import AccountStatus, OrderStatus, UserRole
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.services.customer_analytics_service import (
    extract_rfm_records,
    get_customer_analytics_summary,
    get_customer_rfm_list,
    get_customer_segment_profile,
    segment_customers,
)


# ============================================================================
# Fixture: Customer Analytics Test Dataset
# ============================================================================

@pytest.fixture
def customer_analytics_setup(db_session: Session):
    """
    Creates multiple customers with diverse, realistic order profiles:
    - Customer 1: Champion (high spend, high frequency, recent)
    - Customer 2: Loyal (moderate spend, high frequency, recent)
    - Customer 3: New / Promising (moderate spend, 1 order, very recent)
    - Customer 4: At-Risk / Lapsed (high past spend, 1 order a long time ago)
    - Customer 5: Occasional / Dormant (low spend, 1 order a long time ago)
    - Customer 6: Inactive Lead (0 orders)
    """
    # Vendor
    v_user = User(
        email="analytics_vendor@example.com",
        full_name="Analytics Vendor",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(v_user)
    db_session.flush()

    vendor = VendorProfile(
        user_id=v_user.id,
        store_name="Analytics Test Store",
        business_email="analytics@store.com"
    )
    db_session.add(vendor)
    db_session.flush()

    prod = Product(
        vendor_id=vendor.id,
        title="Standard Test Item",
        category="General",
        price=Decimal("100.00"),
        stock_quantity=500,
        sku="ANL-PROD-001"
    )
    db_session.add(prod)
    db_session.flush()

    # Create 6 Customers
    customers = []
    headers_list = []
    for i in range(1, 7):
        u = User(
            email=f"rfm_customer_{i}@example.com",
            full_name=f"Customer {i}",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db_session.add(u)
        db_session.flush()

        cp = CustomerProfile(user_id=u.id, shipping_address=f"{i} Market St")
        db_session.add(cp)
        db_session.flush()

        tok = create_access_token(subject=str(u.id), role=u.role.value)
        customers.append((u, cp))
        headers_list.append({"Authorization": f"Bearer {tok}"})

    now = datetime.now(timezone.utc)

    # Customer 1: Champion (3 orders in past 30 days, total spend $1500)
    for days_ago, amt in [(5, "500.00"), (15, "600.00"), (25, "400.00")]:
        db_session.add(
            Order(
                customer_id=customers[0][1].id,
                status=OrderStatus.COMPLETED,
                total_amount=Decimal(amt),
                created_at=now - timedelta(days=days_ago),
                items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal(amt), subtotal=Decimal(amt))]
            )
        )

    # Customer 2: Loyal (4 orders in past 60 days, total spend $800)
    for days_ago, amt in [(10, "200.00"), (20, "200.00"), (40, "200.00"), (55, "200.00")]:
        db_session.add(
            Order(
                customer_id=customers[1][1].id,
                status=OrderStatus.COMPLETED,
                total_amount=Decimal(amt),
                created_at=now - timedelta(days=days_ago),
                items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal(amt), subtotal=Decimal(amt))]
            )
        )

    # Customer 3: New / Promising (1 order 3 days ago, spend $300)
    db_session.add(
        Order(
            customer_id=customers[2][1].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("300.00"),
            created_at=now - timedelta(days=3),
            items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("300.00"), subtotal=Decimal("300.00"))]
        )
    )

    # Customer 4: At-Risk Lapsed (2 orders 180 and 200 days ago, total spend $1000)
    for days_ago, amt in [(180, "500.00"), (200, "500.00")]:
        db_session.add(
            Order(
                customer_id=customers[3][1].id,
                status=OrderStatus.COMPLETED,
                total_amount=Decimal(amt),
                created_at=now - timedelta(days=days_ago),
                items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal(amt), subtotal=Decimal(amt))]
            )
        )

    # Customer 5: Occasional / Dormant (1 order 250 days ago, spend $50)
    db_session.add(
        Order(
            customer_id=customers[4][1].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("50.00"),
            created_at=now - timedelta(days=250),
            items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("50.00"), subtotal=Decimal("50.00"))]
        )
    )

    # Customer 6: Inactive Lead (0 orders)

    db_session.commit()

    return {
        "customers": customers,
        "headers_list": headers_list,
        "prod": prod,
        "vendor": vendor,
        "now": now
    }


# ============================================================================
# 1. RFM Feature Extraction & Boundary Tests
# ============================================================================

def test_rfm_calculation_and_observation_window_boundary(db_session: Session, customer_analytics_setup):
    """
    Verifies that RFM values are extracted accurately:
    - Customer 1: 3 orders, spend = 1500, recency = 5 days, AOV = 500.
    - Excludes orders outside the specified observation window.
    """
    data = customer_analytics_setup
    now = data["now"]
    c1_id = data["customers"][0][1].id

    # Test full 365-day window
    _, rfm_365 = extract_rfm_records(db=db_session, observation_window_days=365, reference_date=now)
    c1_rfm = rfm_365[c1_id]

    assert c1_rfm["frequency"] == 3
    assert c1_rfm["monetary_spend"] == Decimal("1500.00")
    assert c1_rfm["average_order_value"] == Decimal("500.00")
    assert c1_rfm["recency_days"] == 5

    # Test truncated window (only orders in past 10 days) -> only the 5-day old order should count
    _, rfm_10 = extract_rfm_records(db=db_session, observation_window_days=10, reference_date=now)
    c1_rfm_10 = rfm_10[c1_id]

    assert c1_rfm_10["frequency"] == 1
    assert c1_rfm_10["monetary_spend"] == Decimal("500.00")
    assert c1_rfm_10["average_order_value"] == Decimal("500.00")
    assert c1_rfm_10["recency_days"] == 5


def test_ineligible_orders_excluded_from_rfm(db_session: Session, customer_analytics_setup):
    """
    Verifies that CANCELLED, PENDING, and REFUNDED orders are strictly ignored
    and do not contribute to frequency, monetary spend, or recency.
    """
    data = customer_analytics_setup
    now = data["now"]
    c6_id = data["customers"][5][1].id  # Initially has 0 orders
    prod = data["prod"]
    vendor = data["vendor"]

    # Add 1 CANCELLED order, 1 PENDING order, and 1 REFUNDED order to Customer 6
    db_session.add_all([
        Order(
            customer_id=c6_id,
            status=OrderStatus.CANCELLED,
            total_amount=Decimal("500.00"),
            created_at=now - timedelta(days=2),
            items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("500.00"), subtotal=Decimal("500.00"))]
        ),
        Order(
            customer_id=c6_id,
            status=OrderStatus.PENDING,
            total_amount=Decimal("300.00"),
            created_at=now - timedelta(days=1),
            items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("300.00"), subtotal=Decimal("300.00"))]
        ),
        Order(
            customer_id=c6_id,
            status=OrderStatus.REFUNDED,
            total_amount=Decimal("200.00"),
            created_at=now - timedelta(days=4),
            items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("200.00"), subtotal=Decimal("200.00"))]
        ),
    ])
    db_session.commit()

    _, rfm = extract_rfm_records(db=db_session, observation_window_days=365, reference_date=now)
    c6_rfm = rfm[c6_id]

    assert c6_rfm["frequency"] == 0
    assert c6_rfm["monetary_spend"] == Decimal("0.00")
    assert c6_rfm["average_order_value"] == Decimal("0.00")
    assert c6_rfm["recency_days"] is None


def test_zero_order_customer_handling(db_session: Session, customer_analytics_setup):
    """
    Verifies that customers with 0 completed orders return recency=None, frequency=0,
    monetary=0.00, and AOV=0.00 without throwing division by zero errors.
    """
    data = customer_analytics_setup
    now = data["now"]
    c6_id = data["customers"][5][1].id

    _, rfm = extract_rfm_records(db=db_session, observation_window_days=365, reference_date=now)
    c6_rfm = rfm[c6_id]

    assert c6_rfm["frequency"] == 0
    assert c6_rfm["monetary_spend"] == Decimal("0.00")
    assert c6_rfm["average_order_value"] == Decimal("0.00")
    assert c6_rfm["recency_days"] is None


# ============================================================================
# 2. Summary KPI Analytics Tests
# ============================================================================

def test_customer_analytics_summary_kpis(db_session: Session, customer_analytics_setup):
    """
    Verifies that the platform KPI summary returns accurate counts and financial totals:
    - 6 total customers (5 active purchasers, 1 inactive lead)
    - Total spend = 1500 + 800 + 300 + 1000 + 50 = $3650.00
    - Total completed orders = 3 + 4 + 1 + 2 + 1 = 11 orders
    - Overall AOV = 3650.00 / 11 = $331.82
    """
    data = customer_analytics_setup
    summary = get_customer_analytics_summary(db=db_session, observation_window_days=365, reference_date=data["now"])

    assert summary.total_customers == 6
    assert summary.active_purchasing_customers == 5
    assert summary.inactive_customers == 1
    assert summary.total_recognized_spend == Decimal("3650.00")
    assert summary.overall_average_order_value == Decimal("331.82")
    assert summary.average_orders_per_active_customer == round(11 / 5.0, 2)


# ============================================================================
# 3. K-Means Segmentation Engine Tests
# ============================================================================

def test_kmeans_segmentation_success_and_metrics(db_session: Session, customer_analytics_setup):
    """
    Verifies that K-Means segmentation executes successfully on the 5 active purchasers:
    - Status is SUCCESS
    - Silhouette score is a valid float
    - Stability score across 5 seeds is calculated
    - Informative business labels are assigned
    - Non-purchasing customer is placed into inactive segment
    """
    data = customer_analytics_setup
    seg = segment_customers(db=db_session, observation_window_days=365, reference_date=data["now"])

    assert seg.status == "SUCCESS"
    assert seg.total_customers_analyzed == 6
    assert seg.eligible_purchasers_count == 5
    assert 2 <= seg.selected_k <= 4
    assert seg.silhouette_score is not None
    assert -1.0 <= seg.silhouette_score <= 1.0
    assert seg.stability_score is not None
    assert 0.0 <= seg.stability_score <= 100.0

    # Verify inactive segment exists
    inactive_segs = [s for s in seg.segments if s.cluster_id == -1]
    assert len(inactive_segs) == 1
    assert inactive_segs[0].customer_count == 1
    assert inactive_segs[0].segment_label == "Non-Purchasing / Inactive Leads"

    # Verify active clusters have positive customer counts
    active_segs = [s for s in seg.segments if s.cluster_id >= 0]
    assert len(active_segs) == seg.selected_k
    assert sum(s.customer_count for s in active_segs) == 5

    # Verify labels contain expected business concepts
    labels = [s.segment_label for s in active_segs]
    assert any("Champions" in l or "High-Value" in l or "Loyal" in l or "Promising" in l for l in labels)


def test_kmeans_deterministic_reproducibility(db_session: Session, customer_analytics_setup):
    """
    Verifies that running segment_customers() repeatedly on the same database state
    produces identical cluster counts, identical silhouette scores, and identical centroids.
    """
    data = customer_analytics_setup
    now = data["now"]

    seg1 = segment_customers(db=db_session, observation_window_days=365, reference_date=now)
    seg2 = segment_customers(db=db_session, observation_window_days=365, reference_date=now)

    assert seg1.selected_k == seg2.selected_k
    assert seg1.silhouette_score == seg2.silhouette_score
    assert seg1.davies_bouldin_index == seg2.davies_bouldin_index
    assert len(seg1.segments) == len(seg2.segments)

    for s1, s2 in zip(seg1.segments, seg2.segments):
        assert s1.cluster_id == s2.cluster_id
        assert s1.customer_count == s2.customer_count
        assert s1.segment_label == s2.segment_label


def test_kmeans_insufficient_purchasing_customers(db_session: Session):
    """
    Verifies that if fewer than 3 purchasing customers exist, K-Means returns
    INSUFFICIENT_CUSTOMERS status without crashing or throwing unhandled errors.
    """
    # Create only 2 customers
    for i in range(2):
        u = User(
            email=f"insuf_{i}@example.com",
            full_name=f"Insuf {i}",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db_session.add(u)
        db_session.flush()
        cp = CustomerProfile(user_id=u.id)
        db_session.add(cp)
    db_session.commit()

    seg = segment_customers(db=db_session, observation_window_days=365)
    assert seg.status == "INSUFFICIENT_CUSTOMERS"
    assert seg.selected_k == 0
    assert seg.silhouette_score is None


def test_kmeans_degenerate_data_handling(db_session: Session):
    """
    Verifies that if all purchasing customers have identical RFM features (zero variance),
    the service returns DEGENERATE_DATA status without throwing division by zero.
    """
    v_user = User(
        email="degen_vendor@example.com",
        full_name="Degen Vendor",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(v_user)
    db_session.flush()

    vendor = VendorProfile(user_id=v_user.id, store_name="Degen Store")
    db_session.add(vendor)
    db_session.flush()

    prod = Product(vendor_id=vendor.id, title="Item", category="General", price=Decimal("100.00"), stock_quantity=100, sku="DEG-001")
    db_session.add(prod)
    db_session.flush()

    now = datetime.now(timezone.utc)
    # Create 4 customers with EXACTLY identical purchases (1 order of $100 10 days ago)
    for i in range(4):
        u = User(
            email=f"degen_cust_{i}@example.com",
            full_name=f"Degen {i}",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db_session.add(u)
        db_session.flush()
        cp = CustomerProfile(user_id=u.id)
        db_session.add(cp)
        db_session.flush()

        db_session.add(
            Order(
                customer_id=cp.id,
                status=OrderStatus.COMPLETED,
                total_amount=Decimal("100.00"),
                created_at=now - timedelta(days=10),
                items=[OrderItem(product_id=prod.id, vendor_id=vendor.id, quantity=1, unit_price=Decimal("100.00"), subtotal=Decimal("100.00"))]
            )
        )
    db_session.commit()

    seg = segment_customers(db=db_session, observation_window_days=365, reference_date=now)
    assert seg.status == "DEGENERATE_DATA"
    assert seg.selected_k == 0


# ============================================================================
# 4. Single Customer Segment Lookup
# ============================================================================

def test_individual_customer_segment_lookup(db_session: Session, customer_analytics_setup):
    """
    Verifies that get_customer_segment_profile() returns the customer's own RFM metrics
    and mapped segment profile.
    """
    data = customer_analytics_setup
    c1_id = data["customers"][0][1].id  # Champion
    c6_id = data["customers"][5][1].id  # Inactive lead

    c1_profile = get_customer_segment_profile(db=db_session, customer_id=c1_id, observation_window_days=365)
    assert c1_profile.customer_id == c1_id
    assert c1_profile.frequency == 3
    assert c1_profile.monetary_spend == Decimal("1500.00")
    assert c1_profile.average_order_value == Decimal("500.00")
    assert c1_profile.segment_label is not None
    assert c1_profile.recommended_action is not None

    c6_profile = get_customer_segment_profile(db=db_session, customer_id=c6_id, observation_window_days=365)
    assert c6_profile.customer_id == c6_id
    assert c6_profile.frequency == 0
    assert c6_profile.segment_label == "Non-Purchasing / Inactive Leads"


# ============================================================================
# 5. API Endpoint Authorization and Privacy Isolation
# ============================================================================

def test_api_customer_analytics_authorization_and_isolation(
    client: TestClient,
    admin_headers,
    approved_vendor_headers,
    customer_analytics_setup
):
    """
    Verifies role-based access control and data privacy:
    - /customer-analytics/summary is Admin only (403 for Customer, 403 for Vendor, 401 unauth).
    - /customer-analytics/rfm is Admin only.
    - /customer-analytics/segments is Admin only.
    - /customer-analytics/my-segment is Customer only (200 for customer, 403 for vendor).
    """
    cust_headers = customer_analytics_setup["headers_list"][0]

    # 1. Unauthenticated -> 401
    res = client.get("/api/v1/customer-analytics/summary")
    assert res.status_code == 401

    # 2. Customer accessing admin summary -> 403
    res = client.get("/api/v1/customer-analytics/summary", headers=cust_headers)
    assert res.status_code == 403

    # 3. Vendor accessing admin summary -> 403
    res = client.get("/api/v1/customer-analytics/summary", headers=approved_vendor_headers)
    assert res.status_code == 403

    # 4. Admin accessing summary -> 200
    res = client.get("/api/v1/customer-analytics/summary", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_customers" in data
    assert "active_purchasing_customers" in data

    # 5. Admin accessing RFM list -> 200
    res = client.get("/api/v1/customer-analytics/rfm?page=1&page_size=5", headers=admin_headers)
    assert res.status_code == 200
    rfm_data = res.json()
    assert "items" in rfm_data
    assert len(rfm_data["items"]) <= 5

    # 6. Admin accessing segments -> 200
    res = client.get("/api/v1/customer-analytics/segments", headers=admin_headers)
    assert res.status_code == 200
    seg_data = res.json()
    assert "segments" in seg_data
    assert "target_accuracy_evaluation" in seg_data

    # 7. Customer accessing their own segment -> 200
    res = client.get("/api/v1/customer-analytics/my-segment", headers=cust_headers)
    assert res.status_code == 200
    my_seg = res.json()
    assert "segment_label" in my_seg
    assert "frequency" in my_seg

    # 8. Vendor accessing customer segment -> 403
    res = client.get("/api/v1/customer-analytics/my-segment", headers=approved_vendor_headers)
    assert res.status_code == 403
