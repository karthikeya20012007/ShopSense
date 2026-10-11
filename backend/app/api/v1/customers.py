import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.dependencies import get_current_customer, require_customer
from backend.app.models.user import User
from backend.app.models.customer import CustomerProfile
from backend.app.schemas.customer import CustomerProfileResponse, CustomerProfileUpdate

router = APIRouter(prefix="/customers", tags=["Customer Operations"])


@router.get(
    "/me/profile",
    response_model=CustomerProfileResponse,
    summary="Get customer profile of the authenticated customer"
)
def api_get_customer_profile(
    customer: CustomerProfile = Depends(get_current_customer)
):
    return customer


@router.patch(
    "/me/profile",
    response_model=CustomerProfileResponse,
    summary="Update customer profile of the authenticated customer"
)
def api_update_customer_profile(
    update_data: CustomerProfileUpdate,
    customer: CustomerProfile = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.get(
    "/{customer_id}",
    response_model=CustomerProfileResponse,
    summary="Get specific customer profile (enforces customer resource isolation)"
)
def api_get_customer_by_id(
    customer_id: uuid.UUID,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db)
):
    target = db.execute(
        select(CustomerProfile).where(CustomerProfile.id == customer_id)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found."
        )

    # Enforce ownership: customers can only view their own profile
    if target.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access another customer's profile."
        )

    return target
