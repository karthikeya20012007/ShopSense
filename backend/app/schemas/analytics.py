import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AdminOverviewMetrics(BaseModel):
    total_revenue: Decimal
    completed_orders_count: int
    total_orders_count: int
    total_vendors_count: int
    approved_vendors_count: int
    pending_vendors_count: int
    rejected_vendors_count: int
    total_products_count: int
    published_products_count: int

    model_config = ConfigDict(from_attributes=True)


class RevenueTrendPoint(BaseModel):
    date: str
    revenue: Decimal
    order_count: int

    model_config = ConfigDict(from_attributes=True)


class VendorPerformanceItem(BaseModel):
    vendor_id: uuid.UUID
    store_name: str
    revenue: Decimal
    items_sold: int
    order_count: int

    model_config = ConfigDict(from_attributes=True)


class ProductPerformanceItem(BaseModel):
    product_id: uuid.UUID
    title: str
    category: str
    units_sold: int
    revenue: Decimal
    current_stock: Optional[int] = None
    price: Optional[Decimal] = None
    is_published: Optional[bool] = None
    is_low_stock: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class CategoryPerformanceItem(BaseModel):
    category: str
    units_sold: int
    revenue: Decimal

    model_config = ConfigDict(from_attributes=True)


class AdminProductsAnalyticsResponse(BaseModel):
    top_products: List[ProductPerformanceItem]
    category_breakdown: List[CategoryPerformanceItem]

    model_config = ConfigDict(from_attributes=True)


class VendorOverviewMetrics(BaseModel):
    vendor_id: uuid.UUID
    store_name: str
    recognized_revenue: Decimal
    completed_order_count: int
    total_order_count: int
    total_products: int
    low_stock_count: int
    total_units_sold: int

    model_config = ConfigDict(from_attributes=True)


class VendorRevenueTrendPoint(BaseModel):
    date: str
    revenue: Decimal
    units_sold: int

    model_config = ConfigDict(from_attributes=True)
