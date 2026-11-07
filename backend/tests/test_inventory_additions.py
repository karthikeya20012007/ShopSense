import uuid
import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from sqlalchemy.orm import Session

from backend.app.models.product import Product
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.inventory import (
    ProductInventoryUpdate,
    StockAdjustmentRequest,
    StockMovementItem,
    ProductResponse,
)

# Helper fixtures
@pytest.fixture
def product_for_vendor(db_session: Session, approved_vendor):
    # approved_vendor returns a tuple (User, VendorProfile)
    _, vendor = approved_vendor
    product = Product(
        vendor_id=vendor.id,
        title="Test Product",
        description="Test Desc",
        price=Decimal("10.00"),
        category="TestCat",
        sku="TP001",
        stock_quantity=50,
        reorder_level=20,
        safety_stock=5,
        lead_time_days=7,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product

@pytest.fixture
def other_product(db_session: Session, pending_vendor):
    # pending_vendor returns a tuple (User, VendorProfile)
    _, vendor = pending_vendor
    product = Product(
        vendor_id=vendor.id,
        title="Other Product",
        description="Other Desc",
        price=Decimal("15.00"),
        category="OtherCat",
        sku="OP001",
        stock_quantity=30,
        reorder_level=10,
        safety_stock=3,
        lead_time_days=5,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product

# A. Product configuration tests
def test_vendor_can_update_own_product(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    update_payload = {"reorder_level": 25}
    resp = client.patch(f"/inventory/vendor/products/{product_for_vendor.id}", json=update_payload, headers=approved_vendor_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["reorder_level"] == 25

def test_vendor_cannot_update_other_product(client: TestClient, approved_vendor_headers, other_product: Product):
    update_payload = {"reorder_level": 15}
    resp = client.patch(f"/inventory/vendor/products/{other_product.id}", json=update_payload, headers=approved_vendor_headers)
    assert resp.status_code == 403

def test_admin_can_update_any_product(client: TestClient, admin_headers, other_product: Product):
    update_payload = {"lead_time_days": 10}
    resp = client.patch(f"/inventory/admin/products/{other_product.id}", json=update_payload, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["lead_time_days"] == 10

def test_partial_update_preserves_fields(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    resp = client.patch(f"/inventory/vendor/products/{product_for_vendor.id}", json={}, headers=approved_vendor_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["reorder_level"] == product_for_vendor.reorder_level
    assert data["safety_stock"] == product_for_vendor.safety_stock
    assert data["lead_time_days"] == product_for_vendor.lead_time_days

def test_cost_price_null_clears_field(client: TestClient, approved_vendor_headers, product_for_vendor: Product, db_session: Session):
    product_for_vendor.cost_price = Decimal("5.00")
    db_session.commit()
    resp = client.patch(f"/inventory/vendor/products/{product_for_vendor.id}", json={"cost_price": None}, headers=approved_vendor_headers)
    assert resp.status_code == 200
    db_session.refresh(product_for_vendor)
    assert product_for_vendor.cost_price is None

def test_negative_cost_price_rejected(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    resp = client.patch(f"/inventory/vendor/products/{product_for_vendor.id}", json={"cost_price": -1}, headers=approved_vendor_headers)
    assert resp.status_code == 422

# B. Manual adjustment tests
def test_purchase_restock_increases_stock(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    # Snapshot stock BEFORE the HTTP call: the shared session expires ORM objects
    # on commit(), so reading stock_quantity after the call yields the updated value.
    initial_stock = product_for_vendor.stock_quantity
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "PURCHASE_RESTOCK", "quantity": 20}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["change_quantity"] == 20
    assert data["new_stock"] == initial_stock + 20

def test_manual_adjustment_positive(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "MANUAL_ADJUSTMENT", "quantity": 8}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 200
    assert resp.json()["change_quantity"] == 8

def test_manual_adjustment_negative(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "MANUAL_ADJUSTMENT", "quantity": -5}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 200
    assert resp.json()["change_quantity"] == -5

def test_shrinkage_decreases_stock(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "SHRINKAGE", "quantity": 3}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 200
    assert resp.json()["change_quantity"] == -3

def test_zero_quantity_rejected(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "MANUAL_ADJUSTMENT", "quantity": 0}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 422

def test_invalid_adjustment_type(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "INVALID", "quantity": 5}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 422

def test_negative_stock_rejection(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "SHRINKAGE", "quantity": product_for_vendor.stock_quantity + 10}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 422

def test_vendor_cannot_adjust_other_product(client: TestClient, approved_vendor_headers, other_product: Product):
    payload = {"product_id": str(other_product.id), "adjustment_type": "PURCHASE_RESTOCK", "quantity": 5}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 403

def test_admin_can_adjust_any_product(client: TestClient, admin_headers, other_product: Product):
    payload = {"product_id": str(other_product.id), "adjustment_type": "PURCHASE_RESTOCK", "quantity": 5}
    resp = client.post("/inventory/admin/stock-adjustment", json=payload, headers=admin_headers)
    assert resp.status_code == 200

def test_nonexistent_warehouse_rejected(client: TestClient, approved_vendor_headers, product_for_vendor: Product):
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "PURCHASE_RESTOCK", "quantity": 5, "warehouse_id": str(uuid.uuid4())}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 422

# C. Transaction rollback test
def test_transaction_rollback_on_failure(client: TestClient, approved_vendor_headers, product_for_vendor: Product, db_session: Session):
    original_stock = product_for_vendor.stock_quantity
    payload = {"product_id": str(product_for_vendor.id), "adjustment_type": "PURCHASE_RESTOCK", "quantity": -5}
    resp = client.post("/inventory/vendor/stock-adjustment", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 422
    db_session.refresh(product_for_vendor)
    assert product_for_vendor.stock_quantity == original_stock
