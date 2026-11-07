import uuid
from datetime import timedelta
import pytest
from fastapi import status
from backend.app.core.security import create_access_token

# ---------------------------------------------------------------------------
# 1. Validation Errors (422 Unprocessable Content)
# ---------------------------------------------------------------------------

def test_registration_validation_error_invalid_email(client):
    payload = {
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Test User"
    }
    resp = client.post("/api/v1/auth/register/customer", json=payload)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

def test_product_creation_validation_error_negative_price(approved_vendor_headers, client):
    payload = {
        "title": "Bad Price Product",
        "price": "-10.00",
        "category": "Test",
        "sku": "BADPRICE01",
        "stock_quantity": 5
    }
    resp = client.post("/vendors/me/products", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

def test_checkout_validation_error_empty_items(customer_headers, client):
    payload = {"items": []}
    resp = client.post("/orders/checkout", json=payload, headers=customer_headers)
    assert resp.status_code in (status.HTTP_422_UNPROCESSABLE_CONTENT, status.HTTP_400_BAD_REQUEST)

# ---------------------------------------------------------------------------
# 2. Missing Resources (404 Not Found)
# ---------------------------------------------------------------------------

def test_nonexistent_product_returns_404(client):
    missing_id = uuid.uuid4()
    resp = client.get(f"/api/v1/products/{missing_id}")
    assert resp.status_code == status.HTTP_404_NOT_FOUND

def test_nonexistent_order_detail_returns_404(customer_headers, client):
    missing_id = uuid.uuid4()
    resp = client.get(f"/orders/{missing_id}", headers=customer_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND

def test_nonexistent_vendor_status_update_returns_404(admin_headers, client):
    missing_id = uuid.uuid4()
    payload = {"status": "APPROVED"}
    resp = client.patch(f"/api/v1/admin/vendors/{missing_id}/status", json=payload, headers=admin_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND

# ---------------------------------------------------------------------------
# 3. Invalid & Expired Tokens (401 Unauthorized)
# ---------------------------------------------------------------------------

def test_malformed_token_returns_401(client):
    headers = {"Authorization": "Bearer not-a-valid-jwt-token"}
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

def test_expired_token_returns_401(client):
    expired = create_access_token(
        subject=str(uuid.uuid4()),
        role="CUSTOMER",
        expires_delta=timedelta(seconds=-60)
    )
    headers = {"Authorization": f"Bearer {expired}"}
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

def test_unauthenticated_protected_route_returns_401(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

# ---------------------------------------------------------------------------
# 4. Unauthorized Access / Forbidden Role (403 Forbidden)
# ---------------------------------------------------------------------------

def test_customer_accessing_admin_endpoint_forbidden(customer_headers, client):
    resp = client.get("/api/v1/admin/vendors", headers=customer_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

def test_vendor_accessing_admin_summary_forbidden(approved_vendor_headers, client):
    resp = client.get("/api/v1/inventory/admin/summary", headers=approved_vendor_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

def test_customer_accessing_vendor_profile_forbidden(customer_headers, client):
    resp = client.get("/api/v1/vendors/me/profile", headers=customer_headers)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
