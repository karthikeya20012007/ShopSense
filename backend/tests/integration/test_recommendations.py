import pytest
from fastapi import status
from uuid import UUID

# Helper to create a product for the vendor
def create_product(client, headers, payload):
    return client.post('/vendors/me/products', json=payload, headers=headers)

# Helper to add an order for purchase history (needed for personalized recommendations)
def create_order(client, customer_headers, items):
    return client.post('/orders/checkout', json={'items': items}, headers=customer_headers)

def test_popular_products(admin_headers, client):
    resp = client.get('/recommendations/popular?limit=5', headers=admin_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert isinstance(data, dict)
    assert 'items' in data and isinstance(data['items'], list)
    assert len(data['items']) <= 5

def test_similar_products(approved_vendor_headers, client, fresh_db_session):
    # Create a product
    payload = {
        "title": "Similar Base",
        "description": "Base product",
        "price": "20.00",
        "category": "SimCat",
        "sku": "SIM001",
        "stock_quantity": 30,
        "is_published": True
    }
    resp = create_product(client, approved_vendor_headers, payload)
    assert resp.status_code == status.HTTP_201_CREATED
    product_id = resp.json()["id"]

    # Create another product with same category to be returned as similar
    payload2 = {
        "title": "Similar Buddy",
        "description": "Another product",
        "price": "25.00",
        "category": "SimCat",
        "sku": "SIM002",
        "stock_quantity": 15,
        "is_published": True
    }
    resp2 = create_product(client, approved_vendor_headers, payload2)
    assert resp2.status_code == status.HTTP_201_CREATED
    similar_id = resp2.json()["id"]

    # Query similar products for the first product
    sim_resp = client.get(f'/recommendations/products/{product_id}/similar?limit=5')
    assert sim_resp.status_code == status.HTTP_200_OK
    data = sim_resp.json()
    assert isinstance(data, dict)
    assert 'items' in data
    # The similar product should appear in the list
    ids = [item['product_id'] for item in data['items'] if 'product_id' in item]
    assert UUID(similar_id) in [UUID(i) for i in ids]

def test_personalized_recommendations(customer_headers, client, approved_vendor_headers, fresh_db_session):
    # Create two products
    payload_a = {
        "title": "Pref A",
        "description": "A",
        "price": "10.00",
        "category": "PrefCat",
        "sku": "PREFA",
        "stock_quantity": 20,
        "is_published": True
    }
    payload_b = {
        "title": "Pref B",
        "description": "B",
        "price": "15.00",
        "category": "PrefCat",
        "sku": "PREFB",
        "stock_quantity": 20,
        "is_published": True
    }
    prod_a = create_product(client, approved_vendor_headers, payload_a).json()["id"]
    prod_b = create_product(client, approved_vendor_headers, payload_b).json()["id"]

    # Customer purchases product A
    order_resp = create_order(client, customer_headers, [{'product_id': prod_a, 'quantity': 1}])
    assert order_resp.status_code == status.HTTP_201_CREATED

    # Get personalized recommendations
    rec_resp = client.get('/recommendations/for-me?limit=5', headers=customer_headers)
    assert rec_resp.status_code == status.HTTP_200_OK
    data = rec_resp.json()
    assert isinstance(data, dict)
    assert 'items' in data
    # Should include product B as a recommendation
    ids = [item['product_id'] for item in data['items'] if 'product_id' in item]
    assert UUID(prod_b) in [UUID(i) for i in ids]
