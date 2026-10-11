import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.enums import VendorStatus


def test_vendor_onboarding_lifecycle_end_to_end(
    client: TestClient,
    admin_headers: dict,
    db_session: Session
):
    # Step 1: Vendor registers
    reg_payload = {
        "email": "lifecycle_vendor@store.com",
        "password": "VendorPassword123!",
        "full_name": "Marcus Onboard",
        "store_name": "Marcus Market",
        "business_email": "marcus@market.com",
        "business_phone": "+1 555-4321",
        "business_address": "500 Vendor Way",
        "business_description": "Electronics retail vendor"
    }
    reg_res = client.post("/api/v1/auth/register/vendor", json=reg_payload)
    assert reg_res.status_code == 201

    # Step 2: Vendor logs in
    login_res = client.post("/api/v1/auth/login", json={
        "email": "lifecycle_vendor@store.com",
        "password": "VendorPassword123!"
    })
    assert login_res.status_code == 200
    vendor_token = login_res.json()["access_token"]
    vendor_headers = {"Authorization": f"Bearer {vendor_token}"}

    # Step 3: Check onboarding status -> should be PENDING
    status_res = client.get("/api/v1/vendors/me/onboarding-status", headers=vendor_headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "PENDING"
    assert "under review" in status_res.json()["message"].lower()

    # Step 4: Verify pending vendor cannot access protected operations
    prof_denied = client.get("/api/v1/vendors/me/profile", headers=vendor_headers)
    assert prof_denied.status_code == 403

    # Step 5: Admin retrieves pending applications
    pending_res = client.get("/api/v1/admin/vendors/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    vendor_id = None
    for app in pending_list:
        if app["store_name"] == "Marcus Market":
            vendor_id = app["id"]
            break
    assert vendor_id is not None

    # Step 6: Admin approves application
    patch_res = client.patch(
        f"/api/v1/admin/vendors/{vendor_id}/status",
        headers=admin_headers,
        json={"status": "APPROVED"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "APPROVED"

    # Step 7: Vendor now accesses protected operations successfully
    prof_allowed = client.get("/api/v1/vendors/me/profile", headers=vendor_headers)
    assert prof_allowed.status_code == 200
    assert prof_allowed.json()["status"] == "APPROVED"


def test_invalid_vendor_status_transitions_rejected(
    client: TestClient,
    admin_headers: dict,
    approved_vendor: tuple[User, VendorProfile]
):
    _, vendor = approved_vendor

    # Attempt transition from APPROVED to REJECTED -> must be rejected
    res = client.patch(
        f"/api/v1/admin/vendors/{vendor.id}/status",
        headers=admin_headers,
        json={"status": "REJECTED"}
    )
    assert res.status_code == 400
    assert "invalid status transition" in res.json()["detail"].lower()

    # Attempt invalid target status (e.g. trying to set back to PENDING)
    res_pending = client.patch(
        f"/api/v1/admin/vendors/{vendor.id}/status",
        headers=admin_headers,
        json={"status": "PENDING"}
    )
    assert res_pending.status_code == 422


def test_update_status_nonexistent_vendor(client: TestClient, admin_headers: dict):
    fake_id = str(uuid.uuid4())
    res = client.patch(
        f"/api/v1/admin/vendors/{fake_id}/status",
        headers=admin_headers,
        json={"status": "APPROVED"}
    )
    assert res.status_code == 404
