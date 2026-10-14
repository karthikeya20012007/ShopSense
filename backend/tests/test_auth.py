import concurrent.futures
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.security import create_access_token
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.refresh_token import RefreshTokenSession
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus
from backend.app.schemas.customer import CustomerRegisterRequest
from backend.app.schemas.vendor import VendorRegisterRequest
from backend.app.services.auth_service import register_customer, register_vendor
from backend.tests.conftest import TestingSessionLocal


def test_customer_registration_success(client: TestClient, db_session: Session):
    payload = {
        "email": "Jane.Doe@Example.com",
        "password": "Password123!",
        "full_name": "Jane Doe",
        "phone_number": "+1 555-9876",
        "shipping_address": "456 Market St, City, ST"
    }
    response = client.post("/api/v1/auth/register/customer", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["email"] == "jane.doe@example.com"  # Normalized to lowercase
    assert data["full_name"] == "Jane Doe"
    assert data["role"] == "CUSTOMER"
    assert data["account_status"] == "ACTIVE"

    # Verify atomic DB persistence
    user = db_session.execute(
        select(User).where(User.email == "jane.doe@example.com")
    ).scalar_one_or_none()
    assert user is not None
    assert user.role == UserRole.CUSTOMER
    assert user.customer_profile is not None
    assert user.customer_profile.phone_number == "+1 555-9876"


def test_vendor_registration_success(client: TestClient, db_session: Session):
    payload = {
        "email": "ShopOwner@Store.com",
        "password": "SecurePassword123!",
        "full_name": "Bob Storey",
        "store_name": "Bob's Electronics Hub",
        "business_email": "biz@store.com",
        "business_phone": "+1 555-1234",
        "business_address": "789 Commerce Way",
        "business_description": "Premier distributor of electronics"
    }
    response = client.post("/api/v1/auth/register/vendor", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["email"] == "shopowner@store.com"
    assert data["role"] == "VENDOR"
    assert data["account_status"] == "ACTIVE"

    # Verify atomic DB persistence and PENDING status
    user = db_session.execute(
        select(User).where(User.email == "shopowner@store.com")
    ).scalar_one_or_none()
    assert user is not None
    assert user.vendor_profile is not None
    assert user.vendor_profile.store_name == "Bob's Electronics Hub"
    assert user.vendor_profile.status == VendorStatus.PENDING


def test_duplicate_email_registration_fails(client: TestClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "full_name": "First User"
    }
    # First registration
    res1 = client.post("/api/v1/auth/register/customer", json=payload)
    assert res1.status_code == 201

    # Second registration with same email
    res2 = client.post("/api/v1/auth/register/customer", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_vendor_duplicate_email_registration_fails(client: TestClient):
    payload = {
        "email": "vendor_dup@example.com",
        "password": "Password123!",
        "full_name": "Vendor One",
        "store_name": "Store Alpha"
    }
    res1 = client.post("/api/v1/auth/register/vendor", json=payload)
    assert res1.status_code == 201

    # Second vendor registration with same email
    res2 = client.post("/api/v1/auth/register/vendor", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_customer_registration_race_integrity_error_handled(db_session: Session):
    """Simulate a race condition where the select-check misses an inflight insert, causing IntegrityError."""
    req = CustomerRegisterRequest(
        email="race_cust@example.com",
        password="Password123!",
        full_name="Original Cust"
    )
    register_customer(db_session, req)

    req2 = CustomerRegisterRequest(
        email="race_cust@example.com",
        password="Password456!",
        full_name="Racer Cust"
    )

    original_execute = db_session.execute

    def mock_execute(statement, *args, **kwargs):
        # If this is the SELECT check for existing user, pretend no user was found
        if "FROM users" in str(statement) and "WHERE users.email =" in str(statement):
            class EmptyResult:
                def scalar_one_or_none(self):
                    return None
            return EmptyResult()
        return original_execute(statement, *args, **kwargs)

    with patch.object(db_session, "execute", side_effect=mock_execute):
        with pytest.raises(HTTPException) as exc_info:
            register_customer(db_session, req2)
        assert exc_info.value.status_code == 409
        assert "already exists" in exc_info.value.detail


def test_vendor_registration_race_integrity_error_handled(db_session: Session):
    """Simulate vendor registration race condition where IntegrityError is caught and converted to 409."""
    req = VendorRegisterRequest(
        email="race_vendor@example.com",
        password="Password123!",
        full_name="Original Vendor",
        store_name="Store Race One"
    )
    register_vendor(db_session, req)

    req2 = VendorRegisterRequest(
        email="race_vendor@example.com",
        password="Password456!",
        full_name="Racer Vendor",
        store_name="Store Race Two"
    )

    original_execute = db_session.execute

    def mock_execute(statement, *args, **kwargs):
        if "FROM users" in str(statement) and "WHERE users.email =" in str(statement):
            class EmptyResult:
                def scalar_one_or_none(self):
                    return None
            return EmptyResult()
        return original_execute(statement, *args, **kwargs)

    with patch.object(db_session, "execute", side_effect=mock_execute):
        with pytest.raises(HTTPException) as exc_info:
            register_vendor(db_session, req2)
        assert exc_info.value.status_code == 409
        assert "already exists" in exc_info.value.detail


def test_live_concurrent_duplicate_customer_registration():
    """Live multi-threaded concurrency test against isolated test database."""
    target_email = "live_concurrent_cust@example.com"
    req = CustomerRegisterRequest(
        email=target_email,
        password="Password123!",
        full_name="Concurrent Cust"
    )

    def attempt_registration(worker_id: int):
        db = TestingSessionLocal()
        try:
            user = register_customer(db, req)
            return ("SUCCESS", 201, str(user.id))
        except HTTPException as e:
            return ("HTTP_ERROR", e.status_code, e.detail)
        except Exception as e:
            return ("UNEXPECTED_ERROR", 500, str(e))
        finally:
            db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(attempt_registration, i) for i in range(6)]
        results = [f.result() for f in futures]

    successes = [r for r in results if r[0] == "SUCCESS"]
    conflicts = [r for r in results if r[0] == "HTTP_ERROR" and r[1] == 409]
    unexpected = [r for r in results if r[0] == "UNEXPECTED_ERROR" or (r[0] == "HTTP_ERROR" and r[1] != 409)]

    assert len(successes) == 1
    assert len(conflicts) == 5
    assert len(unexpected) == 0
    for c in conflicts:
        assert "already exists" in c[2]

    # Cleanup user created in isolated test database
    cleanup_db = TestingSessionLocal()
    try:
        user = cleanup_db.execute(select(User).where(User.email == target_email)).scalar_one_or_none()
        if user:
            cleanup_db.delete(user)
            cleanup_db.commit()
    finally:
        cleanup_db.close()


def test_live_concurrent_duplicate_vendor_registration():
    """Live multi-threaded vendor concurrency test against isolated test database."""
    target_email = "live_concurrent_vendor@example.com"
    req = VendorRegisterRequest(
        email=target_email,
        password="Password123!",
        full_name="Concurrent Vendor",
        store_name="Concurrent Store"
    )

    def attempt_registration(worker_id: int):
        db = TestingSessionLocal()
        try:
            user = register_vendor(db, req)
            return ("SUCCESS", 201, str(user.id))
        except HTTPException as e:
            return ("HTTP_ERROR", e.status_code, e.detail)
        except Exception as e:
            return ("UNEXPECTED_ERROR", 500, str(e))
        finally:
            db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(attempt_registration, i) for i in range(6)]
        results = [f.result() for f in futures]

    successes = [r for r in results if r[0] == "SUCCESS"]
    conflicts = [r for r in results if r[0] == "HTTP_ERROR" and r[1] == 409]
    unexpected = [r for r in results if r[0] == "UNEXPECTED_ERROR" or (r[0] == "HTTP_ERROR" and r[1] != 409)]

    assert len(successes) == 1
    assert len(conflicts) == 5
    assert len(unexpected) == 0
    for c in conflicts:
        assert "already exists" in c[2]

    cleanup_db = TestingSessionLocal()
    try:
        user = cleanup_db.execute(select(User).where(User.email == target_email)).scalar_one_or_none()
        if user:
            cleanup_db.delete(user)
            cleanup_db.commit()
    finally:
        cleanup_db.close()


def test_invalid_input_validation(client: TestClient):
    # Invalid email format
    res = client.post("/api/v1/auth/register/customer", json={
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "full_name": "Tester"
    })
    assert res.status_code == 422

    # Short password (< 8 chars)
    res2 = client.post("/api/v1/auth/register/customer", json={
        "email": "valid@example.com",
        "password": "short",
        "full_name": "Tester"
    })
    assert res2.status_code == 422


def test_passwords_are_not_stored_in_plaintext(client: TestClient, db_session: Session):
    plain_password = "SecretPassword123!"
    payload = {
        "email": "argon_check@example.com",
        "password": plain_password,
        "full_name": "Argon Tester"
    }
    client.post("/api/v1/auth/register/customer", json=payload)

    user = db_session.execute(
        select(User).where(User.email == "argon_check@example.com")
    ).scalar_one()

    assert user.hashed_password != plain_password
    assert plain_password not in user.hashed_password
    assert user.hashed_password.startswith("$argon2id$")


def test_public_cannot_escalate_role_during_registration(client: TestClient, db_session: Session):
    # Attempt to pass role=ADMIN in customer registration
    payload = {
        "email": "escalation_attempt@example.com",
        "password": "Password123!",
        "full_name": "Hacker",
        "role": "ADMIN"
    }
    res = client.post("/api/v1/auth/register/customer", json=payload)
    assert res.status_code == 201

    user = db_session.execute(
        select(User).where(User.email == "escalation_attempt@example.com")
    ).scalar_one()
    # Must remain CUSTOMER
    assert user.role == UserRole.CUSTOMER
    assert user.role != UserRole.ADMIN


def test_login_success_and_refresh_cookie(client: TestClient):
    register_payload = {
        "email": "login_user@example.com",
        "password": "Password123!",
        "full_name": "Login User"
    }
    client.post("/api/v1/auth/register/customer", json=register_payload)

    login_res = client.post("/api/v1/auth/login", json={
        "email": "login_user@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login_user@example.com"
    assert data["user"]["role"] == "CUSTOMER"

    # Check HttpOnly cookie
    assert settings.REFRESH_COOKIE_NAME in login_res.cookies


def test_login_failure_invalid_credentials(client: TestClient):
    res = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_disabled_account_cannot_login(client: TestClient, disabled_user: User):
    res = client.post("/api/v1/auth/login", json={
        "email": disabled_user.email,
        "password": "DisabledPass123!"
    })
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"].lower()


def test_invalid_and_expired_access_token(client: TestClient):
    # Completely invalid token
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert res.status_code == 401

    # Expired token
    expired_token = create_access_token(
        subject="e3c8544c-ed08-4729-a6bb-f170b72e177e",
        role="CUSTOMER",
        expires_delta=timedelta(seconds=-10)
    )
    res_expired = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_expired.status_code == 401


def test_refresh_token_rotation_and_reuse_rejection(client: TestClient, db_session: Session):
    # Register & login
    reg_res = client.post("/api/v1/auth/register/customer", json={
        "email": "refresh_flow@example.com",
        "password": "Password123!",
        "full_name": "Refresh Tester"
    })
    assert reg_res.status_code == 201

    login_res = client.post("/api/v1/auth/login", json={
        "email": "refresh_flow@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token1 = login_res.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert token1 is not None

    # Rotate refresh token
    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert "access_token" in data
    token2 = refresh_res.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert token2 is not None
    assert token1 != token2

    # Attempt reuse of token1 (already rotated) -> MUST BE REJECTED
    client.cookies.clear()
    reuse_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token1}
    )
    assert reuse_res.status_code == 401
    assert "revoked" in reuse_res.json()["detail"].lower()


def test_logout_revokes_refresh_token(client: TestClient):
    # Register & login
    client.post("/api/v1/auth/register/customer", json={
        "email": "logout_tester@example.com",
        "password": "Password123!",
        "full_name": "Logout Tester"
    })
    login_res = client.post("/api/v1/auth/login", json={
        "email": "logout_tester@example.com",
        "password": "Password123!"
    })
    refresh_token = login_res.cookies.get(settings.REFRESH_COOKIE_NAME)

    # Logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # Cookie cleared
    assert not client.cookies.get(settings.REFRESH_COOKIE_NAME)

    # Attempt to refresh with the logged out token via body
    revoked_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert revoked_res.status_code == 401


def test_auth_me_endpoint(client: TestClient, admin_headers: dict, admin_user: User):
    res = client.get("/api/v1/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == admin_user.email
    assert data["role"] == "ADMIN"
