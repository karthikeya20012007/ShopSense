import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import (
    get_current_user,
    get_current_customer,
    require_approved_vendor,
    require_admin,
)
from backend.app.models.customer import CustomerProfile
from backend.app.models.vendor import VendorProfile
from backend.app.models.user import User
from backend.app.models.enums import UserRole, OrderStatus
from backend.app.schemas.order import (
    CheckoutRequest,
    OrderResponse,
    VendorOrderResponse,
    VendorOrderItemResponse,
    OrderStatusUpdateRequest,
)
from backend.app.services.order_service import (
    checkout_order,
    build_order_response,
    get_customer_orders,
    get_order_by_id,
    get_vendor_orders,
    get_all_orders_admin,
    update_order_status,
)
from decimal import Decimal

router = APIRouter(prefix="/orders", tags=["Orders & Checkout"])


@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Customer Checkout",
    description="Processes customer checkout, decrements inventory atomically with row-level locks, and creates an order in PENDING status."
)
def api_checkout_order(
    checkout_data: CheckoutRequest,
    customer: CustomerProfile = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    order = checkout_order(
        db=db,
        customer=customer,
        checkout_data=checkout_data
    )
    return build_order_response(order)


@router.get(
    "/me",
    response_model=List[OrderResponse],
    summary="Get customer order history",
    description="Returns all orders placed by the authenticated customer in descending chronological order."
)
def api_get_customer_orders(
    customer: CustomerProfile = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    return get_customer_orders(db=db, customer_id=customer.id)


@router.get(
    "/vendor/me",
    response_model=List[VendorOrderResponse],
    summary="Get vendor orders",
    description="Returns orders containing items sold by the authenticated vendor, strictly isolated to the vendor's line items."
)
def api_get_vendor_orders(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_vendor_orders(db=db, vendor_id=vendor.id)


@router.get(
    "/admin/all",
    response_model=List[OrderResponse],
    summary="Get all marketplace orders (Admin only)",
    description="Administrative listing of all orders across the platform with optional status filtering."
)
def api_get_admin_orders(
    order_status: Optional[OrderStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * page_size
    return get_all_orders_admin(
        db=db,
        status_filter=order_status,
        limit=page_size,
        offset=offset
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get order details",
    description="Returns full order details if accessed by the customer who placed it or an administrator."
)
def api_get_order_detail(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = get_order_by_id(db=db, order_id=order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )

    # Authorization enforcement:
    if current_user.role == UserRole.ADMIN:
        return build_order_response(order)

    if current_user.role == UserRole.CUSTOMER:
        if not current_user.customer_profile or order.customer_id != current_user.customer_profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to view another customer's order."
            )
        return build_order_response(order)

    # For vendor: return restricted response or 403
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Direct order access is restricted. Vendors must use /orders/vendor/me to inspect vendor-specific items."
    )


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Update order lifecycle status (Admin only)",
    description="Updates the lifecycle status of an order (e.g. transitioning PENDING to COMPLETED for revenue recognition)."
)
def api_update_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return update_order_status(db=db, order_id=order_id, new_status=payload.status)
