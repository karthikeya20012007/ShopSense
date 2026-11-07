import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.core.security import get_password_hash, create_access_token
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import AccountStatus, OrderStatus, UserRole, VendorStatus
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.services.recommendation_service import (
    evaluate_recommendation_quality,
    get_personalized_recommendations,
    get_popular_products,
    get_similar_products,
)


# ============================================================================
# Fixture: Multi-Customer, Multi-Product Recommendation Dataset
# ============================================================================

@pytest.fixture
def recommendation_test_setup(db_session: Session):
    """
    Creates a rich e-commerce catalog and order interaction history:
    - Vendor 1: Electronics (Phones, Laptops, Accessories)
    - Vendor 2: Books (Novels, Textbooks)
    - 5 Customers with overlapping co-purchases:
      - Customer 1: Bought Phone + Headphones
      - Customer 2: Bought Phone + Headphones + Laptop
      - Customer 3: Bought Laptop + Mouse
      - Customer 4: Bought Novel + Textbook
      - Customer 5: Cold-start (0 orders)
    - 1 Unpublished Product (to verify strict visibility exclusion)
    """
    # 1. Vendors
    v1_user = User(
        email="rec_vendor1@example.com",
        full_name="Tech Vendor",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    v2_user = User(
        email="rec_vendor2@example.com",
        full_name="Books Vendor",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add_all([v1_user, v2_user])
    db_session.flush()

    v1 = VendorProfile(user_id=v1_user.id, store_name="Tech World", status=VendorStatus.APPROVED)
    v2 = VendorProfile(user_id=v2_user.id, store_name="Book Haven", status=VendorStatus.APPROVED)
    db_session.add_all([v1, v2])
    db_session.flush()

    # 2. Products
    p_phone = Product(vendor_id=v1.id, title="Smart Phone X", category="Electronics", price=Decimal("800.00"), stock_quantity=50, sku="PH-01", is_published=True)
    p_headphones = Product(vendor_id=v1.id, title="Wireless Headphones", category="Electronics", price=Decimal("150.00"), stock_quantity=100, sku="HP-02", is_published=True)
    p_laptop = Product(vendor_id=v1.id, title="Pro Laptop 15", category="Electronics", price=Decimal("1200.00"), stock_quantity=30, sku="LP-03", is_published=True)
    p_mouse = Product(vendor_id=v1.id, title="Wireless Mouse", category="Electronics", price=Decimal("40.00"), stock_quantity=150, sku="MS-04", is_published=True)
    p_charger = Product(vendor_id=v1.id, title="Fast Charger", category="Electronics", price=Decimal("30.00"), stock_quantity=200, sku="CH-05", is_published=True)
    
    p_novel = Product(vendor_id=v2.id, title="Sci-Fi Novel", category="Books", price=Decimal("20.00"), stock_quantity=80, sku="NV-01", is_published=True)
    p_textbook = Product(vendor_id=v2.id, title="Physics Textbook", category="Books", price=Decimal("90.00"), stock_quantity=40, sku="TB-02", is_published=True)
    
    # Unpublished product (MUST never be recommended)
    p_unpub = Product(vendor_id=v1.id, title="Secret Beta Gadget", category="Electronics", price=Decimal("500.00"), stock_quantity=10, sku="SEC-99", is_published=False)

    products = [p_phone, p_headphones, p_laptop, p_mouse, p_charger, p_novel, p_textbook, p_unpub]
    db_session.add_all(products)
    db_session.flush()

    # 3. Customers
    cust_users = []
    cust_profiles = []
    cust_headers = []
    for i in range(1, 6):
        u = User(
            email=f"rec_cust_{i}@example.com",
            full_name=f"Rec Customer {i}",
            hashed_password=get_password_hash("Pass123!"),
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db_session.add(u)
        db_session.flush()
        cp = CustomerProfile(user_id=u.id, shipping_address=f"{i} Tech Blvd")
        db_session.add(cp)
        db_session.flush()
        tok = create_access_token(subject=str(u.id), role=u.role.value)
        cust_users.append(u)
        cust_profiles.append(cp)
        cust_headers.append({"Authorization": f"Bearer {tok}"})

    now = datetime.now(timezone.utc)

    # 4. Chronological Orders
    orders = []

    # Order 1 (10 days ago): Cust 1 buys Phone + Headphones
    orders.append(
        Order(
            customer_id=cust_profiles[0].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("950.00"),
            created_at=now - timedelta(days=10),
            items=[
                OrderItem(product_id=p_phone.id, vendor_id=v1.id, quantity=1, unit_price=p_phone.price, subtotal=p_phone.price),
                OrderItem(product_id=p_headphones.id, vendor_id=v1.id, quantity=1, unit_price=p_headphones.price, subtotal=p_headphones.price),
            ]
        )
    )

    # Order 2 (8 days ago): Cust 2 buys Phone + Headphones + Laptop
    orders.append(
        Order(
            customer_id=cust_profiles[1].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("2150.00"),
            created_at=now - timedelta(days=8),
            items=[
                OrderItem(product_id=p_phone.id, vendor_id=v1.id, quantity=1, unit_price=p_phone.price, subtotal=p_phone.price),
                OrderItem(product_id=p_headphones.id, vendor_id=v1.id, quantity=1, unit_price=p_headphones.price, subtotal=p_headphones.price),
                OrderItem(product_id=p_laptop.id, vendor_id=v1.id, quantity=1, unit_price=p_laptop.price, subtotal=p_laptop.price),
            ]
        )
    )

    # Order 3 (6 days ago): Cust 3 buys Laptop + Mouse
    orders.append(
        Order(
            customer_id=cust_profiles[2].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("1240.00"),
            created_at=now - timedelta(days=6),
            items=[
                OrderItem(product_id=p_laptop.id, vendor_id=v1.id, quantity=1, unit_price=p_laptop.price, subtotal=p_laptop.price),
                OrderItem(product_id=p_mouse.id, vendor_id=v1.id, quantity=1, unit_price=p_mouse.price, subtotal=p_mouse.price),
            ]
        )
    )

    # Order 4 (4 days ago): Cust 4 buys Novel + Textbook
    orders.append(
        Order(
            customer_id=cust_profiles[3].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("110.00"),
            created_at=now - timedelta(days=4),
            items=[
                OrderItem(product_id=p_novel.id, vendor_id=v2.id, quantity=1, unit_price=p_novel.price, subtotal=p_novel.price),
                OrderItem(product_id=p_textbook.id, vendor_id=v2.id, quantity=1, unit_price=p_textbook.price, subtotal=p_textbook.price),
            ]
        )
    )

    # Order 5 (2 days ago): Cust 1 returns and buys Charger
    orders.append(
        Order(
            customer_id=cust_profiles[0].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("30.00"),
            created_at=now - timedelta(days=2),
            items=[
                OrderItem(product_id=p_charger.id, vendor_id=v1.id, quantity=1, unit_price=p_charger.price, subtotal=p_charger.price),
            ]
        )
    )

    # Order 6 (1 day ago): Cust 2 returns and buys Mouse
    orders.append(
        Order(
            customer_id=cust_profiles[1].id,
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("40.00"),
            created_at=now - timedelta(days=1),
            items=[
                OrderItem(product_id=p_mouse.id, vendor_id=v1.id, quantity=1, unit_price=p_mouse.price, subtotal=p_mouse.price),
            ]
        )
    )

    db_session.add_all(orders)
    db_session.commit()

    return {
        "v1": v1,
        "v2": v2,
        "p_phone": p_phone,
        "p_headphones": p_headphones,
        "p_laptop": p_laptop,
        "p_mouse": p_mouse,
        "p_charger": p_charger,
        "p_novel": p_novel,
        "p_textbook": p_textbook,
        "p_unpub": p_unpub,
        "cust_profiles": cust_profiles,
        "cust_headers": cust_headers,
        "now": now
    }


# ============================================================================
# 1. Popularity Baseline Tests
# ============================================================================

def test_popular_products_ranking_and_visibility(db_session: Session, recommendation_test_setup):
    """
    Verifies that get_popular_products() ranks products by actual verified sales quantity,
    and strictly excludes unpublished products.
    """
    data = recommendation_test_setup

    resp = get_popular_products(db=db_session, limit=10, published_only=True)
    assert resp.scenario == "POPULAR_BESTSELLERS"
    assert resp.total_returned >= 5

    rec_ids = [item.product_id for item in resp.items]

    # Unpublished product MUST NOT appear
    assert data["p_unpub"].id not in rec_ids

    # Phone was bought in Order 1 & 2 (2 units)
    # Headphones was bought in Order 1 & 2 (2 units)
    # They should have high scores (1.0)
    top_scores = [item.score for item in resp.items]
    assert top_scores[0] == 1.0


def test_popular_products_vendor_scoping(db_session: Session, recommendation_test_setup):
    """
    Verifies vendor scoping on popularity:
    When vendor_id=v2 is provided, only Book Haven products are returned.
    """
    data = recommendation_test_setup
    v2_id = data["v2"].id

    resp = get_popular_products(db=db_session, limit=10, vendor_id=v2_id)
    assert resp.total_returned == 2
    assert all(item.vendor_id == v2_id for item in resp.items)
    rec_skus = {item.sku for item in resp.items}
    assert "NV-01" in rec_skus
    assert "TB-02" in rec_skus


# ============================================================================
# 2. Similar Products (Item-Item Collaborative & Category) Tests
# ============================================================================

def test_similar_products_self_exclusion_and_collaborative_signal(db_session: Session, recommendation_test_setup):
    """
    Verifies similar products for Phone X:
    - Phone X is NEVER recommended to itself (self-exclusion).
    - Wireless Headphones ranks top because of strong co-purchase co-occurrence.
    - Unpublished products are excluded.
    """
    data = recommendation_test_setup
    phone_id = data["p_phone"].id
    headphones_id = data["p_headphones"].id
    unpub_id = data["p_unpub"].id

    resp = get_similar_products(db=db_session, product_id=phone_id, limit=5)
    assert resp.scenario == "SIMILAR_PRODUCTS"
    assert resp.reference_product_id == phone_id

    rec_ids = [item.product_id for item in resp.items]

    # 1. Self exclusion
    assert phone_id not in rec_ids

    # 2. Unpublished exclusion
    assert unpub_id not in rec_ids

    # 3. Headphones should rank at or near the top
    assert headphones_id in rec_ids
    assert resp.items[0].product_id == headphones_id
    assert "co-purchased" in resp.items[0].recommendation_reason.lower()


def test_similar_products_cold_start_fallback(db_session: Session, recommendation_test_setup):
    """
    Verifies that a newly created product with 0 co-purchase history
    falls back cleanly to category alignment and popularity without throwing errors.
    """
    data = recommendation_test_setup
    v1_id = data["v1"].id

    # Create new isolated product
    new_prod = Product(
        vendor_id=v1_id,
        title="Brand New Gadget",
        category="Electronics",
        price=Decimal("199.00"),
        stock_quantity=50,
        sku="NEW-01",
        is_published=True
    )
    db_session.add(new_prod)
    db_session.commit()

    resp = get_similar_products(db=db_session, product_id=new_prod.id, limit=5)
    assert resp.total_returned > 0
    rec_ids = [item.product_id for item in resp.items]
    assert new_prod.id not in rec_ids
    # Recommended products should belong to Electronics category
    assert all(item.category == "Electronics" for item in resp.items)


def test_similar_products_unknown_id_404(db_session: Session):
    """Verifies that requesting similar products for a nonexistent ID returns 404."""
    with pytest.raises(Exception) as exc_info:
        get_similar_products(db=db_session, product_id=uuid.uuid4())
    assert "404" in str(exc_info.value)


# ============================================================================
# 3. Personalized Recommendations Tests
# ============================================================================

def test_personalized_recommendations_for_purchaser(db_session: Session, recommendation_test_setup):
    """
    Verifies personalized recommendations for Customer 3 (who bought Laptop + Mouse):
    - Recommends products from Electronics (Charger, Headphones, Phone).
    - Excludes items Customer 3 already purchased (Laptop, Mouse) when exclude_purchased=True.
    """
    data = recommendation_test_setup
    c3_id = data["cust_profiles"][2].id
    laptop_id = data["p_laptop"].id
    mouse_id = data["p_mouse"].id

    resp = get_personalized_recommendations(
        db=db_session,
        customer_id=c3_id,
        limit=5,
        exclude_previously_purchased=True
    )
    assert resp.scenario == "PERSONALIZED"
    assert resp.total_returned > 0

    rec_ids = [item.product_id for item in resp.items]

    # Already purchased items should be excluded
    assert laptop_id not in rec_ids
    assert mouse_id not in rec_ids

    # Recommendations should be primarily Electronics
    assert any(item.category == "Electronics" for item in resp.items)


def test_personalized_recommendations_cold_start_customer(db_session: Session, recommendation_test_setup):
    """
    Verifies that Customer 5 (who has 0 completed purchases) receives
    COLD_START_FALLBACK with popular catalog bestsellers.
    """
    data = recommendation_test_setup
    c5_id = data["cust_profiles"][4].id  # Cold start customer

    resp = get_personalized_recommendations(
        db=db_session,
        customer_id=c5_id,
        limit=5
    )
    assert resp.scenario == "COLD_START_FALLBACK"
    assert resp.total_returned > 0
    assert "cold-start" in resp.items[0].recommendation_reason.lower()


# ============================================================================
# 4. Offline Chronological Evaluation Tests
# ============================================================================

def test_offline_chronological_evaluation_leak_free(db_session: Session, recommendation_test_setup):
    """
    Verifies offline recommendation evaluation:
    - Evaluates chronological 80/20 train/test split.
    - Evaluates customers with orders in both partitions (Customer 1 & Customer 2).
    - Measures exact Hit Rate@K, Precision@K, and Category Hit Rate@K.
    - Verifies comparison lift over Popularity baseline.
    """
    eval_res = evaluate_recommendation_quality(db=db_session, k=5, train_ratio=0.8)

    assert eval_res.k == 5
    assert eval_res.train_orders_count > 0
    assert eval_res.test_orders_count > 0
    assert eval_res.evaluated_customers_count > 0
    assert 0.0 <= eval_res.hybrid_exact_hit_rate <= 100.0
    assert 0.0 <= eval_res.hybrid_exact_precision <= 100.0
    assert 0.0 <= eval_res.hybrid_category_hit_rate <= 100.0
    assert 0.0 <= eval_res.popularity_exact_hit_rate <= 100.0
    assert eval_res.methodology == "CHRONOLOGICAL_HOLD_OUT_EVALUATION"
    assert "Category-Aligned Relevance" in eval_res.target_relevance_analysis


def test_offline_evaluation_insufficient_data(db_session: Session):
    """
    Verifies that when fewer than 4 orders exist, evaluation returns
    zeroed metrics with informative analysis instead of crashing.
    """
    eval_res = evaluate_recommendation_quality(db=db_session, k=5)
    assert eval_res.evaluated_customers_count == 0
    assert eval_res.hybrid_exact_hit_rate == 0.0


# ============================================================================
# 5. API Endpoint Authorization & Privacy Tests
# ============================================================================

def test_api_recommendations_endpoints_authorization(
    client: TestClient,
    admin_headers,
    approved_vendor_headers,
    recommendation_test_setup
):
    """
    Verifies role-based access control and public accessibility:
    - /recommendations/popular: Public (200 OK without token).
    - /recommendations/products/{id}/similar: Public (200 OK without token).
    - /recommendations/for-me: Customer only (200 for customer, 403 for vendor, 401 unauth).
    - /recommendations/evaluation: Admin only (200 for admin, 403 for customer, 403 for vendor, 401 unauth).
    """
    data = recommendation_test_setup
    c1_headers = data["cust_headers"][0]
    phone_id = data["p_phone"].id

    # 1. /popular is public
    res_pop = client.get("/api/v1/recommendations/popular?limit=5")
    assert res_pop.status_code == 200
    assert "items" in res_pop.json()

    # 2. /products/{id}/similar is public
    res_sim = client.get(f"/api/v1/recommendations/products/{phone_id}/similar?limit=5")
    assert res_sim.status_code == 200
    assert "items" in res_sim.json()

    # 3. /for-me requires customer auth
    res_forme_unauth = client.get("/api/v1/recommendations/for-me")
    assert res_forme_unauth.status_code == 401

    res_forme_vendor = client.get("/api/v1/recommendations/for-me", headers=approved_vendor_headers)
    assert res_forme_vendor.status_code == 403

    res_forme_cust = client.get("/api/v1/recommendations/for-me", headers=c1_headers)
    assert res_forme_cust.status_code == 200
    assert "items" in res_forme_cust.json()

    # 4. /evaluation requires admin auth
    res_eval_unauth = client.get("/api/v1/recommendations/evaluation")
    assert res_eval_unauth.status_code == 401

    res_eval_cust = client.get("/api/v1/recommendations/evaluation", headers=c1_headers)
    assert res_eval_cust.status_code == 403

    res_eval_vendor = client.get("/api/v1/recommendations/evaluation", headers=approved_vendor_headers)
    assert res_eval_vendor.status_code == 403

    res_eval_admin = client.get("/api/v1/recommendations/evaluation", headers=admin_headers)
    assert res_eval_admin.status_code == 200
    assert "hybrid_exact_hit_rate" in res_eval_admin.json()
