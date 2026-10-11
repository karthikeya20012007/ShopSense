import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.enums import VendorStatus, UserRole
from backend.app.schemas.vendor import VendorOnboardingStatusResponse, VendorProfileResponse


def get_pending_vendors(db: Session) -> List[VendorProfileResponse]:
    """Retrieve all vendor applications currently awaiting admin review."""
    stmt = (
        select(VendorProfile)
        .options(joinedload(VendorProfile.user))
        .where(VendorProfile.status == VendorStatus.PENDING)
        .order_by(VendorProfile.created_at.desc())
    )
    records = db.execute(stmt).scalars().unique().all()
    
    results = []
    for vp in records:
        data = VendorProfileResponse.model_validate(vp)
        if vp.user:
            data.applicant_email = vp.user.email
            data.applicant_name = vp.user.full_name
        results.append(data)
    return results


def update_vendor_status(
    db: Session,
    vendor_id: uuid.UUID,
    new_status: VendorStatus
) -> VendorProfileResponse:
    """
    Transition a vendor application's status from PENDING to APPROVED or REJECTED.
    Enforces explicit permitted transitions.
    """
    vendor = db.execute(
        select(VendorProfile)
        .options(joinedload(VendorProfile.user))
        .where(VendorProfile.id == vendor_id)
    ).scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor application with ID {vendor_id} not found."
        )

    # Validate transition: only PENDING applications can be APPROVED or REJECTED
    if vendor.status != VendorStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition. Application is currently '{vendor.status.value}' and cannot be updated to '{new_status.value}'."
        )

    if new_status not in (VendorStatus.APPROVED, VendorStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target status '{new_status.value}'. Must be APPROVED or REJECTED."
        )

    vendor.status = new_status
    db.commit()
    db.refresh(vendor)

    resp = VendorProfileResponse.model_validate(vendor)
    if vendor.user:
        resp.applicant_email = vendor.user.email
        resp.applicant_name = vendor.user.full_name
    return resp


def get_vendor_onboarding_status(
    db: Session,
    user: User
) -> VendorOnboardingStatusResponse:
    """Get the current onboarding status for the authenticated vendor."""
    if user.role != UserRole.VENDOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not registered as a vendor."
        )

    vendor = db.execute(
        select(VendorProfile).where(VendorProfile.user_id == user.id)
    ).scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found for this account."
        )

    message_map = {
        VendorStatus.PENDING: "Your vendor application is currently under review by our administration team. You will be notified once reviewed.",
        VendorStatus.APPROVED: "Congratulations! Your store application has been approved. You have full access to vendor capabilities.",
        VendorStatus.REJECTED: "Your vendor application was reviewed and could not be approved at this time. Please contact support for more information."
    }

    return VendorOnboardingStatusResponse(
        vendor_id=vendor.id,
        store_name=vendor.store_name,
        status=vendor.status,
        message=message_map.get(vendor.status, ""),
        created_at=vendor.created_at
    )
