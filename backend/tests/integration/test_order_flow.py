import pytest
from fastapi import status
from uuid import UUID
from backend.app.models.product import Product
from backend.app.models.stock_movement import StockMovement
from backend.app.models.enums import StockMovementType

# Helper to create a product for checkout tests
def create_product(client, headers, payload):
    return client.post('/vendors/me/products', json=payload, headers=headers)

# Helper to perform checkout
def checkout(client, headers, payload):
    return client.post('/orders/checkout', json=payload, headers=headers)

def test_successful_checkout_and_stock_decrement(approved_vendor_headers, customer_headers, client, db_session):
    # Create a product with known stock
    product_payload = {
        "title": "Checkout Test Product",
        "description": "Test",
        "price": "15.00",
        "category": "TestCat",
        "sku": "CHK001",
        "stock_quantity": 20,
        "is_published": True
    }
    prod_resp = create_product(client, approved_vendor_headers, product_payload)
    assert prod_resp.status_code == status.HTTP_201_CREATED
    product = prod_resp.json()
    product_id = product["id"]

    # Perform checkout unauthenticated -> 401
    checkout_payload = {
        "items": [{"product_id": product_id, "quantity": 5}]
    }
    unauth_resp = checkout(client, {}, checkout_payload)
    assert unauth_resp.status_code == status.HTTP_401_UNAUTHORIZED

    # Perform checkout as an authenticated customer for quantity 5
    checkout_resp = checkout(client, customer_headers, checkout_payload)
    assert checkout_resp.status_code == status.HTTP_201_CREATED
    order = checkout_resp.json()
    assert order["status"] == "PENDING"

    # Verify stock decreased via DB session
    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == product["stock_quantity"] - 5

    # Verify stock movement ledger entry
    movement = db_session.query(StockMovement).filter(
        StockMovement.product_id == UUID(product_id),
        StockMovement.movement_type == StockMovementType.CHECKOUT_DECREMENT
    ).first()
    assert movement is not None
    assert movement.change_quantity == -5

def test_insufficient_stock_checkout(approved_vendor_headers, customer_headers, client, db_session):
    # Create product with low stock
    product_payload = {
        "title": "Low Stock Product",
        "description": "Low",
        "price": "9.99",
        "category": "LowCat",
        "sku": "LOW001",
        "stock_quantity": 2,
        "is_published": True
    }
    prod_resp = create_product(client, approved_vendor_headers, product_payload)
    assert prod_resp.status_code == status.HTTP_201_CREATED
    product_id = prod_resp.json()["id"]

    # Attempt to purchase 5 units
    checkout_payload = {"items": [{"product_id": product_id, "quantity": 5}]}
    resp = checkout(client, customer_headers, checkout_payload)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # Ensure stock unchanged
    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == 2

def test_order_access_control(admin_headers, approved_vendor_headers, client, pending_vendor_headers):
    # Admin can list all orders
    resp = client.get('/orders/admin/all', headers=admin_headers)
    assert resp.status_code == status.HTTP_200_OK
    # Vendor cannot access admin list
    resp = client.get('/orders/admin/all', headers=approved_vendor_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    # Pending vendor cannot view vendor orders
    resp = client.get('/orders/vendor/me', headers=pending_vendor_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

def test_order_status_update(admin_headers, customer_headers, client, approved_vendor_headers, db_session):
    # Create a product and order
    product_payload = {
        "title": "Status Update Product",
        "description": "Status",
        "price": "12.00",
        "category": "StatusCat",
        "sku": "STAT001",
        "stock_quantity": 10,
        "is_published": True
    }
    prod_resp = create_product(client, approved_vendor_headers, product_payload)
    assert prod_resp.status_code == status.HTTP_201_CREATED
    product_id = prod_resp.json()["id"]

    checkout_payload = {"items": [{"product_id": product_id, "quantity": 1}]}
    order_resp = client.post('/orders/checkout', json=checkout_payload, headers=customer_headers)
    assert order_resp.status_code == status.HTTP_201_CREATED
    order_id = order_resp.json()["id"]

    # Admin updates status to COMPLETED
    update_payload = {"status": "COMPLETED"}
    upd_resp = client.patch(f'/orders/{order_id}/status', json=update_payload, headers=admin_headers)
    assert upd_resp.status_code == status.HTTP_200_OK
    assert upd_resp.json()["status"] == "COMPLETED"

def test_duplicate_cancellation_and_ledger_consistency(admin_headers, customer_headers, approved_vendor_headers, client, db_session):
    # Create product
    product_payload = {
        "title": "Cancel Test",
        "description": "Cancel",
        "price": "8.00",
        "category": "CancelCat",
        "sku": "CANC001",
        "stock_quantity": 30,
        "is_published": True
    }
    prod_resp = create_product(client, approved_vendor_headers, product_payload)
    assert prod_resp.status_code == status.HTTP_201_CREATED
    product_id = prod_resp.json()["id"]

    # Checkout order
    checkout_payload = {"items": [{"product_id": product_id, "quantity": 3}]}
    order_resp = client.post('/orders/checkout', json=checkout_payload, headers=customer_headers)
    assert order_resp.status_code == status.HTTP_201_CREATED
    order_id = order_resp.json()["id"]

    # Cancel order by setting status to CANCELLED (admin only)
    update_payload = {"status": "CANCELLED"}
    cancel_resp = client.patch(f'/orders/{order_id}/status', json=update_payload, headers=admin_headers)
    assert cancel_resp.status_code == status.HTTP_200_OK

    # Attempt duplicate cancellation -> should be rejected (400 or 422)
    dup_resp = client.patch(f'/orders/{order_id}/status', json=update_payload, headers=admin_headers)
    assert dup_resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_CONTENT)

    # Verify stock restored in DB
    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == product_payload["stock_quantity"]

    # Verify cancellation ledger entry exists
    cancel_movement = db_session.query(StockMovement).filter(
        StockMovement.product_id == UUID(product_id),
        StockMovement.movement_type == StockMovementType.CANCELLATION_RESTOCK
    ).first()
    assert cancel_movement is not None
    assert cancel_movement.change_quantity == 3

