import pytest
from fastapi import status
from backend.app.models.enums import VendorStatus

# Test authentication and authorization matrix for key endpoints
# covering: unauthenticated users, customers, vendors, and admins

# ---------------------------------------------------------------------------
# 1. Vendor Profile (/api/v1/vendors/me/profile)
# ---------------------------------------------------------------------------

def test_get_vendor_profile_unauthenticated(client):
    response = client.get("/api/v1/vendors/me/profile")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_get_vendor_profile_as_customer(customer_headers, client):
    response = client.get("/api/v1/vendors/me/profile", headers=customer_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_get_vendor_profile_as_vendor(approved_vendor_headers, client):
    response = client.get("/api/v1/vendors/me/profile", headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_200_OK
    assert "store_name" in response.json()

# ---------------------------------------------------------------------------
# 2. Admin Vendor List (/api/v1/admin/vendors)
# ---------------------------------------------------------------------------

def test_admin_list_vendors_as_admin(admin_headers, client):
    response = client.get("/api/v1/admin/vendors", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)

def test_admin_list_vendors_as_vendor_forbidden(approved_vendor_headers, client):
    response = client.get("/api/v1/admin/vendors", headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_admin_list_vendors_as_customer_forbidden(customer_headers, client):
    response = client.get("/api/v1/admin/vendors", headers=customer_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_admin_list_vendors_unauthenticated(client):
    response = client.get("/api/v1/admin/vendors")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# ---------------------------------------------------------------------------
# 3. Admin Vendor Status Update (/api/v1/admin/vendors/{id}/status)
# ---------------------------------------------------------------------------

def test_admin_update_vendor_status_as_admin(admin_headers, pending_vendor, client):
    _, vendor = pending_vendor
    payload = {"status": "APPROVED"}
    response = client.patch(f"/api/v1/admin/vendors/{vendor.id}/status", json=payload, headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "APPROVED"

def test_admin_update_vendor_status_as_vendor_forbidden(approved_vendor_headers, approved_vendor, client):
    _, vendor = approved_vendor
    payload = {"status": "APPROVED"}
    response = client.patch(f"/api/v1/admin/vendors/{vendor.id}/status", json=payload, headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_admin_update_vendor_status_unauthenticated(approved_vendor, client):
    _, vendor = approved_vendor
    payload = {"status": "APPROVED"}
    response = client.patch(f"/api/v1/admin/vendors/{vendor.id}/status", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# ---------------------------------------------------------------------------
# 4. Customer Profile (/api/v1/customers/me/profile)
# ---------------------------------------------------------------------------

def test_customer_profile_as_customer(customer_headers, client):
    response = client.get("/api/v1/customers/me/profile", headers=customer_headers)
    assert response.status_code == status.HTTP_200_OK

def test_customer_profile_as_vendor_forbidden(approved_vendor_headers, client):
    response = client.get("/api/v1/customers/me/profile", headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_customer_profile_unauthenticated(client):
    response = client.get("/api/v1/customers/me/profile")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# ---------------------------------------------------------------------------
# 5. Admin Inventory Summary (/api/v1/inventory/admin/summary)
# ---------------------------------------------------------------------------

def test_admin_inventory_summary_as_admin(admin_headers, client):
    response = client.get("/api/v1/inventory/admin/summary", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK

def test_admin_inventory_summary_as_vendor_forbidden(approved_vendor_headers, client):
    response = client.get("/api/v1/inventory/admin/summary", headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_admin_inventory_summary_unauthenticated(client):
    response = client.get("/api/v1/inventory/admin/summary")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

