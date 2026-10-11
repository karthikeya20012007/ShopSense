import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.dependencies import get_current_user, require_approved_vendor
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.product import Product
from backend.app.schemas.vendor import (
    VendorOnboardingStatusResponse,
    VendorProfileResponse,
    VendorProfileUpdate
)
from backend.app.schemas.product import ProductCreate, ProductResponse
from backend.app.services.vendor_service import get_vendor_onboarding_status

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get(
    "/me/onboarding-status",
    response_model=VendorOnboardingStatusResponse,
    summary="Check current vendor onboarding status (accessible to pending/rejected/approved vendors)"
)
def api_get_vendor_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_vendor_onboarding_status(db, current_user)


@router.get(
    "/me/profile",
    response_model=VendorProfileResponse,
    summary="Get vendor store profile (restricted to approved vendors)"
)
def api_get_vendor_profile(
    vendor: VendorProfile = Depends(require_approved_vendor)
):
    resp = VendorProfileResponse.model_validate(vendor)
    if vendor.user:
        resp.applicant_email = vendor.user.email
        resp.applicant_name = vendor.user.full_name
    return resp


@router.patch(
    "/me/profile",
    response_model=VendorProfileResponse,
    summary="Update vendor store profile (restricted to approved vendors)"
)
def api_update_vendor_profile(
    update_data: VendorProfileUpdate,
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(vendor, key, value)
    db.commit()
    db.refresh(vendor)

    resp = VendorProfileResponse.model_validate(vendor)
    if vendor.user:
        resp.applicant_email = vendor.user.email
        resp.applicant_name = vendor.user.full_name
    return resp


@router.get(
    "/me/products",
    response_model=List[ProductResponse],
    summary="List all products belonging to the authenticated vendor"
)
def api_get_vendor_products(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    products = db.execute(
        select(Product).where(Product.vendor_id == vendor.id).order_by(Product.created_at.desc())
    ).scalars().all()

    items = []
    for p in products:
        item = ProductResponse.model_validate(p)
        item.store_name = vendor.store_name
        items.append(item)
    return items


@router.post(
    "/me/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product owned by the authenticated vendor"
)
def api_create_vendor_product(
    product_in: ProductCreate,
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    product = Product(
        vendor_id=vendor.id,
        title=product_in.title.strip(),
        description=product_in.description.strip() if product_in.description else None,
        price=product_in.price,
        category=product_in.category.strip(),
        sku=product_in.sku.strip() if product_in.sku else None,
        stock_quantity=product_in.stock_quantity,
        is_published=product_in.is_published
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    res = ProductResponse.model_validate(product)
    res.store_name = vendor.store_name
    return res
