import uuid
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Authenticate request via JWT Bearer token.
    Enforces active account status.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication payload.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.execute(
        select(User)
        .options(
            joinedload(User.vendor_profile),
            joinedload(User.customer_profile)
        )
        .where(User.id == user_id)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled."
        )

    return user


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Optional authentication for public endpoints where user context is useful but not required."""
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


def require_role(*roles: UserRole):
    """Dependency factory that restricts endpoint access to specified roles."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of [{', '.join(r.value for r in roles)}] roles."
            )
        return current_user
    return role_checker


# Specialized role dependencies
require_admin = require_role(UserRole.ADMIN)
require_customer = require_role(UserRole.CUSTOMER)


def require_approved_vendor(
    current_user: User = Depends(require_role(UserRole.VENDOR)),
    db: Session = Depends(get_db)
) -> VendorProfile:
    """
    Requires the user to be a VENDOR with an APPROVED onboarding status and ACTIVE account.
    Pending or rejected vendors are strictly barred with 403 Forbidden.
    """
    vendor = current_user.vendor_profile
    if not vendor:
        # Load from DB if not prefetched
        vendor = db.execute(
            select(VendorProfile).where(VendorProfile.user_id == current_user.id)
        ).scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found."
        )

    if vendor.status == VendorStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your vendor application is still pending review. Access to vendor operations is restricted until approval."
        )

    if vendor.status == VendorStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your vendor application has been rejected. Protected vendor operations cannot be accessed."
        )

    if vendor.status != VendorStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor account is not approved."
        )

    return vendor


def get_current_customer(
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
) -> CustomerProfile:
    """Returns CustomerProfile for current customer."""
    customer = current_user.customer_profile
    if not customer:
        customer = db.execute(
            select(CustomerProfile).where(CustomerProfile.user_id == current_user.id)
        ).scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found."
        )
    return customer
