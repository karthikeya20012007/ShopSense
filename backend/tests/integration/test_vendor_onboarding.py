import pytest
from fastapi import status

# Pending vendor can access onboarding status endpoint
def test_pending_vendor_onboarding_status(pending_vendor_headers, client):
    response = client.get('/vendors/me/onboarding-status', headers=pending_vendor_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    # Expect status to be one of the enum values
    assert data['status'] in ['PENDING', 'REJECTED', 'APPROVED']

# Approved vendor can retrieve profile
def test_approved_vendor_profile(approved_vendor_headers, client):
    response = client.get('/vendors/me/profile', headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data['store_name'] is not None
    assert data['status'] == 'APPROVED'

# Approved vendor can update profile
def test_approved_vendor_profile_update(approved_vendor_headers, client, db_session):
    payload = {"store_name": "Updated Store", "business_email": "updated@example.com"}
    response = client.patch('/vendors/me/profile', json=payload, headers=approved_vendor_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data['store_name'] == payload['store_name']
    assert data['business_email'] == payload['business_email']

# Unauthenticated request should be rejected
def test_vendor_profile_unauthenticated(client):
    response = client.get('/vendors/me/profile')
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# Admin role must be forbidden from vendor profile endpoint
def test_vendor_profile_wrong_role(admin_headers, client):
    response = client.get('/vendors/me/profile', headers=admin_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
