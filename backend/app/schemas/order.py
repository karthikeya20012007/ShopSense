import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.enums import OrderStatus


class CheckoutItemRequest(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0, description="Quantity must be a positive integer greater than zero")

    model_config = ConfigDict(extra="forbid")


class CheckoutRequest(BaseModel):
    items: List[CheckoutItemRequest] = Field(..., min_length=1, description="List of items to purchase")

    model_config = ConfigDict(extra="forbid")


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_title: Optional[str] = None
    vendor_id: uuid.UUID
    store_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)


class VendorOrderItemResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID
    product_title: Optional[str] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VendorOrderResponse(BaseModel):
    order_id: uuid.UUID
    customer_id: uuid.UUID
    status: OrderStatus
    created_at: datetime
    vendor_items_total: Decimal
    items: List[VendorOrderItemResponse]

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus

    model_config = ConfigDict(extra="forbid")

