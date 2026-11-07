import pytest
from fastapi import status
from uuid import UUID
from backend.app.models.product import Product

# Helper functions
def update_product(client, headers, product_id, payload):
    return client.patch(f'/vendors/me/products/{product_id}', json=payload, headers=headers)

def admin_update_product(client, admin_headers, product_id, payload):
    return client.patch(f'/inventory/admin/products/{product_id}', json=payload, headers=admin_headers)

def vendor_stock_adjust(client, headers, payload):
    return client.post('/inventory/vendor/stock-adjustment', json=payload, headers=headers)

def admin_stock_adjust(client, admin_headers, payload):
    return client.post('/inventory/admin/stock-adjustment', json=payload, headers=admin_headers)

def test_vendor_inventory_update(approved_vendor_headers, client, db_session):
    # Create a product first
    product_payload = {
        "title": "Inv Update Test",
        "description": "Test",
        "price": "20.00",
        "category": "TestCat",
        "sku": "INVUPD1",
        "stock_quantity": 15,
        "is_published": True
    }
    create_resp = client.post('/vendors/me/products', json=product_payload, headers=approved_vendor_headers)
    assert create_resp.status_code == status.HTTP_201_CREATED
    product_id = create_resp.json()["id"]

    # Update inventory fields via vendor endpoint
    update_payload = {"stock_quantity": 30, "price": "22.00"}
    upd_resp = update_product(client, approved_vendor_headers, product_id, update_payload)
    assert upd_resp.status_code == status.HTTP_200_OK
    updated = upd_resp.json()
    assert updated["stock_quantity"] == 30
    assert updated["price"] == "22.00"

    # Verify DB reflects change
    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == 30

def test_admin_inventory_update(admin_headers, client, approved_vendor_headers, db_session):
    # Create a product with vendor (admin can update any)
    product_payload = {
        "title": "Admin Inv Update",
        "description": "Test",
        "price": "50.00",
        "category": "AdminCat",
        "sku": "ADMINUPD",
        "stock_quantity": 5,
        "is_published": True
    }
    create_resp = client.post('/vendors/me/products', json=product_payload, headers=approved_vendor_headers)
    assert create_resp.status_code == status.HTTP_201_CREATED
    product_id = create_resp.json()["id"]

    admin_update_payload = {"reorder_level": 10, "lead_time_days": 5}
    upd_resp = admin_update_product(client, admin_headers, product_id, admin_update_payload)
    assert upd_resp.status_code == status.HTTP_200_OK
    updated = upd_resp.json()
    assert updated["reorder_level"] == 10
    assert updated["lead_time_days"] == 5

    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.reorder_level == 10
    assert prod.lead_time_days == 5

def test_vendor_stock_adjustment(approved_vendor_headers, client, db_session):
    # Create product
    product_payload = {
        "title": "Stock Adj",
        "description": "Adj",
        "price": "10.00",
        "category": "AdjCat",
        "sku": "ADJ001",
        "stock_quantity": 20,
        "is_published": True
    }
    resp = client.post('/vendors/me/products', json=product_payload, headers=approved_vendor_headers)
    assert resp.status_code == status.HTTP_201_CREATED
    product_id = resp.json()["id"]

    adjustment_payload = {
        "product_id": product_id,
        "quantity": -5,
        "adjustment_type": "MANUAL_ADJUSTMENT",
        "reason": "Manual decrease"
    }
    adj_resp = vendor_stock_adjust(client, approved_vendor_headers, adjustment_payload)
    assert adj_resp.status_code == status.HTTP_200_OK
    movement = adj_resp.json()
    assert movement["new_stock"] == 15

    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == 15

def test_admin_stock_adjustment(admin_headers, client, approved_vendor_headers, db_session):
    product_payload = {
        "title": "Admin Adj",
        "description": "Adj",
        "price": "30.00",
        "category": "AdjCat",
        "sku": "ADJADM",
        "stock_quantity": 40,
        "is_published": True
    }
    resp = client.post('/vendors/me/products', json=product_payload, headers=approved_vendor_headers)
    assert resp.status_code == status.HTTP_201_CREATED
    product_id = resp.json()["id"]

    admin_adj_payload = {
        "product_id": product_id,
        "quantity": 10,
        "adjustment_type": "PURCHASE_RESTOCK",
        "reason": "Admin increase"
    }
    adj_resp = admin_stock_adjust(client, admin_headers, admin_adj_payload)
    assert adj_resp.status_code == status.HTTP_200_OK
    movement = adj_resp.json()
    assert movement["new_stock"] == 50

    db_session.expire_all()
    prod = db_session.query(Product).filter(Product.id == UUID(product_id)).one()
    assert prod.stock_quantity == 50

def test_unauthorized_inventory_update(client, approved_vendor_headers):
    product_payload = {
        "title": "Auth Test",
        "description": "Auth",
        "price": "5.00",
        "category": "AuthCat",
        "sku": "AUTH001",
        "stock_quantity": 10,
        "is_published": True
    }
    create_resp = client.post('/vendors/me/products', json=product_payload, headers=approved_vendor_headers)
    assert create_resp.status_code == status.HTTP_201_CREATED
    product_id = create_resp.json()["id"]
    # Missing headers
    resp = client.patch(f'/vendors/me/products/{product_id}', json={"stock_quantity": 20})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

