from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.product import Product


def test_public_catalog_browsing_without_login(
    client: TestClient,
    approved_vendor: tuple[User, VendorProfile],
    db_session: Session
):
    _, vendor = approved_vendor

    # Create 2 published products and 1 unpublished product
    p1 = Product(
        vendor_id=vendor.id,
        title="Published Camera Sensor",
        description="High resolution optical visitor counter",
        price=Decimal("199.99"),
        category="Sensors",
        is_published=True
    )
    p2 = Product(
        vendor_id=vendor.id,
        title="Published Bluetooth Beacon",
        description="BLE proximity beacon for aisle tracking",
        price=Decimal("49.50"),
        category="Sensors",
        is_published=True
    )
    p_unpub = Product(
        vendor_id=vendor.id,
        title="Unpublished Prototype Device",
        description="Internal confidential project",
        price=Decimal("999.00"),
        category="Internal",
        is_published=False  # Must be excluded!
    )
    db_session.add_all([p1, p2, p_unpub])
    db_session.commit()

    # Query public catalog with no auth header
    res = client.get("/api/v1/products")
    assert res.status_code == 200
    data = res.json()
    items = data["items"]

    titles = [item["title"] for item in items]
    assert "Published Camera Sensor" in titles
    assert "Published Bluetooth Beacon" in titles
    assert "Unpublished Prototype Device" not in titles


def test_public_product_detail_without_login(
    client: TestClient,
    approved_vendor: tuple[User, VendorProfile],
    db_session: Session
):
    _, vendor = approved_vendor

    p = Product(
        vendor_id=vendor.id,
        title="Specific Optical Scanner",
        description="Detailed product specs",
        price=Decimal("249.00"),
        category="Hardware",
        is_published=True
    )
    db_session.add(p)
    db_session.commit()

    # Public get without auth
    res = client.get(f"/api/v1/products/{p.id}")
    assert res.status_code == 200
    assert res.json()["title"] == "Specific Optical Scanner"
    assert res.json()["store_name"] == vendor.store_name


def test_unpublished_product_returns_404(
    client: TestClient,
    approved_vendor: tuple[User, VendorProfile],
    db_session: Session
):
    _, vendor = approved_vendor

    p_hidden = Product(
        vendor_id=vendor.id,
        title="Secret Lab Prototype",
        price=Decimal("5000.00"),
        category="R&D",
        is_published=False
    )
    db_session.add(p_hidden)
    db_session.commit()

    res = client.get(f"/api/v1/products/{p_hidden.id}")
    assert res.status_code == 404


def test_public_catalog_filtering_and_search(
    client: TestClient,
    approved_vendor: tuple[User, VendorProfile],
    db_session: Session
):
    _, vendor = approved_vendor

    p_elec = Product(
        vendor_id=vendor.id,
        title="Retail Traffic Analyzer",
        price=Decimal("150.00"),
        category="Electronics",
        is_published=True
    )
    p_soft = Product(
        vendor_id=vendor.id,
        title="Cloud Dashboard Subscription Key",
        price=Decimal("50.00"),
        category="Software",
        is_published=True
    )
    db_session.add_all([p_elec, p_soft])
    db_session.commit()

    # Filter by category
    res_cat = client.get("/api/v1/products?category=Software")
    assert res_cat.status_code == 200
    cat_items = res_cat.json()["items"]
    assert len(cat_items) >= 1
    for item in cat_items:
        assert item["category"] == "Software"

    # Search by text
    res_search = client.get("/api/v1/products?query=Traffic")
    assert res_search.status_code == 200
    search_items = res_search.json()["items"]
    assert any("Traffic" in item["title"] for item in search_items)
