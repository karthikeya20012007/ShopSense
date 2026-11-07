import pytest
from fastapi import status

# Helper to create a product for the approved vendor
def create_product(client, headers, payload):
    return client.post('/vendors/me/products', json=payload, headers=headers)

def test_create_and_get_product(approved_vendor_headers, client):
    payload = {
        "title": "Test Product",
        "description": "A product for integration testing",
        "price": "10.00",
        "category": "Testing",
        "sku": "TEST123",
        "stock_quantity": 100,
        "is_published": True
    }
    # Create product
    create_resp = create_product(client, approved_vendor_headers, payload)
    assert create_resp.status_code == status.HTTP_201_CREATED
    prod = create_resp.json()
    product_id = prod["id"]
    # Retrieve product via vendor endpoint
    get_resp = client.get(f'/vendors/me/products/{product_id}', headers=approved_vendor_headers)
    assert get_resp.status_code == status.HTTP_200_OK
    fetched = get_resp.json()
    assert fetched["title"] == payload["title"]
    assert fetched["stock_quantity"] == payload["stock_quantity"]

def test_update_product(approved_vendor_headers, client):
    # Create product first
    payload = {
        "title": "Update Test",
        "description": "Initial",
        "price": "20.00",
        "category": "Update",
        "sku": "UPDT1",
        "stock_quantity": 50,
        "is_published": True
    }
    resp = create_product(client, approved_vendor_headers, payload)
    assert resp.status_code == status.HTTP_201_CREATED
    product_id = resp.json()["id"]
    # Update fields
    update_payload = {"title": "Updated Title", "stock_quantity": 75}
    upd_resp = client.patch(f'/vendors/me/products/{product_id}', json=update_payload, headers=approved_vendor_headers)
    assert upd_resp.status_code == status.HTTP_200_OK
    updated = upd_resp.json()
    assert updated["title"] == update_payload["title"]
    assert updated["stock_quantity"] == update_payload["stock_quantity"]

def test_delete_product(approved_vendor_headers, client, db_session):
    payload = {
        "title": "Delete Me",
        "description": "To be deleted",
        "price": "5.00",
        "category": "Delete",
        "sku": "DEL123",
        "stock_quantity": 10,
        "is_published": True
    }
    resp = create_product(client, approved_vendor_headers, payload)
    assert resp.status_code == status.HTTP_201_CREATED
    product_id = resp.json()["id"]
    # Delete product
    del_resp = client.delete(f'/vendors/me/products/{product_id}', headers=approved_vendor_headers)
    assert del_resp.status_code == status.HTTP_200_OK
    # Verify it is gone (vendor get should 404)
    get_resp = client.get(f'/vendors/me/products/{product_id}', headers=approved_vendor_headers)
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND

def test_public_product_list_and_category(client):
    # List categories (public endpoint)
    cat_resp = client.get('/products/categories')
    assert cat_resp.status_code == status.HTTP_200_OK
    categories = cat_resp.json()
    assert isinstance(categories, list)
    # List products with pagination
    list_resp = client.get('/products?page=1&page_size=5')
    assert list_resp.status_code == status.HTTP_200_OK
    data = list_resp.json()
    assert 'items' in data and 'total' in data
    assert data['page'] == 1
    assert data['page_size'] == 5
    # Ensure pagination works (total_pages >= 1)
    assert data['total_pages'] >= 1
