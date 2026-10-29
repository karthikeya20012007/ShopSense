import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import require_admin
from backend.app.models.user import User
from backend.app.models.enums import VendorStatus
from backend.app.schemas.vendor import VendorProfileResponse, VendorStatusUpdateRequest
from backend.app.services.vendor_service import (
    get_pending_vendors,
    get_all_vendors,
    update_vendor_status,
)

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


@router.get(
    "/vendors",
    response_model=List[VendorProfileResponse],
    summary="List all vendors with optional status filter (Admin only)"
)
def api_get_all_vendors(
    status_filter: Optional[VendorStatus] = Query(None, alias="status"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_all_vendors(db=db, status_filter=status_filter)


@router.get(
    "/vendors/pending",
    response_model=List[VendorProfileResponse],
    summary="List all vendor onboarding applications awaiting review (Admin only)"
)
def api_get_pending_vendors(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_pending_vendors(db)


@router.patch(
    "/vendors/{vendor_id}/status",
    response_model=VendorProfileResponse,
    summary="Approve or reject a vendor application (Admin only)"
)
def api_update_vendor_status(
    vendor_id: uuid.UUID,
    payload: VendorStatusUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return update_vendor_status(db, vendor_id, payload.status)
