import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.product import Product
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus
from backend.app.core.security import get_password_hash, create_access_token


def test_admin_only_endpoints_protected_against_non_admins(
    client: TestClient,
    customer_headers: dict,
    approved_vendor_headers: dict
):
    # Customer tries to access admin pending list
    res_customer = client.get("/api/v1/admin/vendors/pending", headers=customer_headers)
    assert res_customer.status_code == 403

    # Vendor tries to access admin pending list
    res_vendor = client.get("/api/v1/admin/vendors/pending", headers=approved_vendor_headers)
    assert res_vendor.status_code == 403

    # Unauthenticated request
    res_anon = client.get("/api/v1/admin/vendors/pending")
    assert res_anon.status_code == 401


def test_pending_and_rejected_vendors_cannot_access_vendor_operations(
    client: TestClient,
    pending_vendor_headers: dict,
    rejected_vendor_headers: dict
):
    # Pending vendor cannot access vendor profile
    res_pend_prof = client.get("/api/v1/vendors/me/profile", headers=pending_vendor_headers)
    assert res_pend_prof.status_code == 403
    assert "pending" in res_pend_prof.json()["detail"].lower()

    # Pending vendor cannot create products
    res_pend_prod = client.post(
        "/api/v1/vendors/me/products",
        headers=pending_vendor_headers,
        json={
            "title": "Unauthorized Product",
            "price": "100.00",
            "category": "Hardware"
        }
    )
    assert res_pend_prod.status_code == 403

    # Rejected vendor cannot access vendor profile
    res_rej_prof = client.get("/api/v1/vendors/me/profile", headers=rejected_vendor_headers)
    assert res_rej_prof.status_code == 403
    assert "rejected" in res_rej_prof.json()["detail"].lower()


def test_approved_vendor_can_access_operations(
    client: TestClient,
    approved_vendor_headers: dict
):
    # Access profile
    res_prof = client.get("/api/v1/vendors/me/profile", headers=approved_vendor_headers)
    assert res_prof.status_code == 200
    assert res_prof.json()["status"] == "APPROVED"

    # Create product
    res_prod = client.post(
        "/api/v1/vendors/me/products",
        headers=approved_vendor_headers,
        json={
            "title": "Vendor Gizmo",
            "description": "High tech sensor",
            "price": "49.99",
            "category": "Gadgets",
            "stock_quantity": 10,
            "is_published": True
        }
    )
    assert res_prod.status_code == 201
    assert res_prod.json()["title"] == "Vendor Gizmo"


def test_disabled_user_cannot_access_protected_operations(
    client: TestClient,
    disabled_user_headers: dict
):
    res = client.get("/api/v1/auth/me", headers=disabled_user_headers)
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"].lower()


def test_vendor_resource_isolation(
    client: TestClient,
    approved_vendor: tuple[User, VendorProfile],
    approved_vendor_headers: dict,
    db_session: Session
):
    # Create second approved vendor
    vendor2_user = User(
        email="vendor2@example.com",
        full_name="Vendor Two",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(vendor2_user)
    db_session.flush()

    vendor2_profile = VendorProfile(
        user_id=vendor2_user.id,
        store_name="Vendor Two Store",
        status=VendorStatus.APPROVED
    )
    db_session.add(vendor2_profile)
    db_session.flush()

    # Vendor 2 adds product
    p2 = Product(
        vendor_id=vendor2_profile.id,
        title="Vendor Two Exclusive Widget",
        price=Decimal("19.99"),
        category="Tools",
        is_published=True
    )
    db_session.add(p2)
    db_session.commit()

    # Vendor 1 queries their products
    res = client.get("/api/v1/vendors/me/products", headers=approved_vendor_headers)
    assert res.status_code == 200
    vendor1_products = res.json()
    titles = [p["title"] for p in vendor1_products]
    assert "Vendor Two Exclusive Widget" not in titles


def test_customer_resource_isolation(
    client: TestClient,
    customer_user: tuple[User, CustomerProfile],
    customer_headers: dict,
    db_session: Session
):
    user1, profile1 = customer_user

    # Create customer 2
    user2 = User(
        email="customer2@example.com",
        full_name="Bob Customer",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(user2)
    db_session.flush()

    profile2 = CustomerProfile(
        user_id=user2.id,
        phone_number="+1 555-8888",
        shipping_address="789 Secret Lane"
    )
    db_session.add(profile2)
    db_session.commit()

    # Customer 1 attempts to access customer 2's profile
    res = client.get(f"/api/v1/customers/{profile2.id}", headers=customer_headers)
    assert res.status_code == 403
    assert "forbidden" in res.json()["detail"].lower()

    # Customer 1 accesses own profile by ID
    res_own = client.get(f"/api/v1/customers/{profile1.id}", headers=customer_headers)
    assert res_own.status_code == 200
    assert res_own.json()["id"] == str(profile1.id)
