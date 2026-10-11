from datetime import datetime, timezone
from typing import Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_token
)
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.refresh_token import RefreshTokenSession
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus
from backend.app.schemas.vendor import VendorRegisterRequest
from backend.app.schemas.customer import CustomerRegisterRequest


def normalize_email(email: str) -> str:
    """Normalize email address to lowercase and strip whitespace."""
    return email.strip().lower()


def register_customer(db: Session, request: CustomerRegisterRequest) -> User:
    """
    Atomically register a new customer with CUSTOMER role and CustomerProfile.
    Rejects duplicate email registrations.
    """
    email = normalize_email(request.email)

    # Check if user already exists
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists."
        )

    hashed_pw = get_password_hash(request.password)

    user = User(
        email=email,
        full_name=request.full_name.strip(),
        hashed_password=hashed_pw,
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE
    )
    db.add(user)
    db.flush()  # Populates user.id within the current transaction

    customer_profile = CustomerProfile(
        user_id=user.id,
        phone_number=request.phone_number.strip() if request.phone_number else None,
        shipping_address=request.shipping_address.strip() if request.shipping_address else None
    )
    db.add(customer_profile)
    db.commit()
    db.refresh(user)
    return user


def register_vendor(db: Session, request: VendorRegisterRequest) -> User:
    """
    Atomically register a new vendor with VENDOR role and PENDING VendorProfile.
    Rejects duplicate email registrations.
    """
    email = normalize_email(request.email)

    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists."
        )

    hashed_pw = get_password_hash(request.password)

    user = User(
        email=email,
        full_name=request.full_name.strip(),
        hashed_password=hashed_pw,
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db.add(user)
    db.flush()

    business_email = (
        normalize_email(request.business_email)
        if request.business_email
        else email
    )

    vendor_profile = VendorProfile(
        user_id=user.id,
        store_name=request.store_name.strip(),
        business_email=business_email,
        business_phone=request.business_phone.strip() if request.business_phone else None,
        business_address=request.business_address.strip() if request.business_address else None,
        business_description=request.business_description.strip() if request.business_description else None,
        status=VendorStatus.PENDING
    )
    db.add(vendor_profile)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Authenticate user credentials and ensure account is active."""
    norm_email = normalize_email(email)
    user = db.execute(select(User).where(User.email == norm_email)).scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled. Please contact platform administration."
        )

    return user


def create_user_tokens(db: Session, user: User) -> Tuple[str, str]:
    """
    Generate access token and refresh token session.
    Returns: (access_token, raw_refresh_token)
    """
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        additional_claims={"name": user.full_name, "email": user.email}
    )

    raw_refresh, token_hash, expires_at = create_refresh_token()
    session = RefreshTokenSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked=False
    )
    db.add(session)
    db.commit()

    return access_token, raw_refresh


def rotate_refresh_token(db: Session, raw_refresh_token: str) -> Tuple[User, str, str]:
    """
    Validate existing refresh token, revoke it, and issue a new token pair (rotation).
    Detects token reuse and revokes compromised chains.
    Returns: (user, new_access_token, new_raw_refresh_token)
    """
    current_hash = hash_token(raw_refresh_token)
    session = db.execute(
        select(RefreshTokenSession).where(RefreshTokenSession.token_hash == current_hash)
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unrecognized refresh token."
        )

    # Token reuse detection
    if session.revoked:
        # Compromise detected: invalidate all sessions for this user
        db.query(RefreshTokenSession).filter(RefreshTokenSession.user_id == session.user_id).update(
            {"revoked": True}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked. Re-authentication required."
        )

    # Expiration check
    now = datetime.now(timezone.utc)
    # Ensure session.expires_at is timezone-aware
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        session.revoked = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired."
        )

    # Check user account status
    user = db.execute(select(User).where(User.id == session.user_id)).scalar_one_or_none()
    if not user or user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or disabled."
        )

    # Rotate token
    new_raw_refresh, new_hash, new_expires_at = create_refresh_token()
    session.revoked = True
    session.replaced_by = new_hash

    new_session = RefreshTokenSession(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=new_expires_at,
        revoked=False
    )
    db.add(new_session)
    db.commit()

    new_access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        additional_claims={"name": user.full_name, "email": user.email}
    )

    return user, new_access_token, new_raw_refresh


def revoke_refresh_token(db: Session, raw_refresh_token: str) -> None:
    """Invalidate a refresh token session during logout."""
    current_hash = hash_token(raw_refresh_token)
    session = db.execute(
        select(RefreshTokenSession).where(RefreshTokenSession.token_hash == current_hash)
    ).scalar_one_or_none()

    if session:
        session.revoked = True
        db.commit()
