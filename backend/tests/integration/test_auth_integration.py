# backend/tests/integration/test_auth_integration.py
"""Integration tests for authentication flows.
Covers:
- Customer and vendor registration
- Login / token issuance
- Refresh token rotation (new refresh token issued on each call)
- Logout (token revocation)
- Access to a protected endpoint with the obtained access token.
All requests record the exercised route via ``utils.record_route``.
"""

import pytest
from backend.tests.integration.utils import record_route

@pytest.mark.order(1)
def test_register_customer(client):
    payload = {
        "email": "new_cust@example.com",
        "password": "StrongPass123!",
        "full_name": "New Customer"
    }
    resp = client.post("/api/v1/auth/register/customer", json=payload)
    record_route("POST", "/api/v1/auth/register/customer")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == payload["email"]

    login_payload = {"username": payload["email"], "password": payload["password"]}
    login_resp = client.post("/api/v1/auth/login", data=login_payload)
    record_route("POST", "/api/v1/auth/login")
    assert login_resp.status_code == 200, login_resp.text
    tokens = login_resp.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    assert access_token and refresh_token

    profile_resp = client.get("/api/v1/customers/me/profile", headers={"Authorization": f"Bearer {access_token}"})
    record_route("GET", "/api/v1/customers/me/profile")
    assert profile_resp.status_code == 200, profile_resp.text

    refresh_resp = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
    record_route("POST", "/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200, refresh_resp.text
    new_tokens = refresh_resp.json()
    assert new_tokens["refresh_token"] != refresh_token
    new_access = new_tokens["access_token"]

    logout_resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {new_access}"})
    record_route("POST", "/api/v1/auth/logout")
    assert logout_resp.status_code == 200

    after_logout = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
    record_route("POST", "/api/v1/auth/refresh")
    assert after_logout.status_code == 401

@pytest.mark.order(2)
def test_register_vendor(client, admin_headers):
    payload = {
        "email": "new_vendor@example.com",
        "password": "StrongPass123!",
        "company_name": "NewCo",
        "contact_name": "Owner"
    }
    resp = client.post("/api/v1/auth/register/vendor", json=payload)
    record_route("POST", "/api/v1/auth/register/vendor")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    vendor_id = data["vendor_profile"]["id"]

    approve_resp = client.patch(
        f"/api/v1/admin/vendors/{vendor_id}/status",
        json={"status": "APPROVED"},
        headers=admin_headers,
    )
    record_route("PATCH", f"/api/v1/admin/vendors/{vendor_id}/status")
    assert approve_resp.status_code == 200

    login_payload = {"username": payload["email"], "password": payload["password"]}
    login_resp = client.post("/api/v1/auth/login", data=login_payload)
    record_route("POST", "/api/v1/auth/login")
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    profile = client.get("/api/v1/vendors/me/profile", headers={"Authorization": f"Bearer {token}"})
    record_route("GET", "/api/v1/vendors/me/profile")
    assert profile.status_code == 200
