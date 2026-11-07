import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.enums import StockMovementType
from backend.app.schemas.product import ProductResponse  # re-export for compatibility


# --------------------------------------------------------------------------
# New schema: ProductInventoryUpdate
# --------------------------------------------------------------------------
class ProductInventoryUpdate(BaseModel):
    """Partial update schema for inventory‑related product fields.
    All fields are optional; ``exclude_unset=True`` will be used when applying updates.
    ``None`` is allowed for ``cost_price`` to intentionally clear the field.
    """

    cost_price: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Cost price of the product (must be non‑negative). Null clears the field."
    )
    reorder_level: Optional[int] = Field(
        None,
        ge=0,
        description="Reorder threshold (non‑negative integer)."
    )
    safety_stock: Optional[int] = Field(
        None,
        ge=0,
        description="Safety stock level (non‑negative integer)."
    )
    lead_time_days: Optional[int] = Field(
        None,
        ge=0,
        description="Lead time in days (non‑negative integer)."
    )
    model_config = ConfigDict(extra="forbid")

# --------------------------------------------------------------------------
# New schema: StockAdjustmentRequest
# --------------------------------------------------------------------------
class StockAdjustmentRequest(BaseModel):
    """Request payload for manual stock adjustments.
    ``adjustment_type`` is limited to the three allowed values.
    ``quantity`` validation depends on the type (handled in service).
    """

    product_id: uuid.UUID = Field(..., description="Target product UUID.")
    adjustment_type: Literal["PURCHASE_RESTOCK", "MANUAL_ADJUSTMENT", "SHRINKAGE"] = Field(
        ..., description="Type of stock adjustment."
    )
    quantity: int = Field(..., description="Adjustment quantity. Sign semantics depend on type.")
    warehouse_id: Optional[uuid.UUID] = Field(
        None, description="Optional warehouse where adjustment occurs."
    )
    reason: Optional[str] = Field(
        None, max_length=255, description="Optional human‑readable reason for the adjustment."
    )
    model_config = ConfigDict(extra="forbid")


# ============================================================================
# Inventory Summary Schemas
# ============================================================================

class InventorySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_products: int = Field(..., description="Total count of active catalog products")
    total_units_in_stock: int = Field(..., description="Sum of on-hand inventory units across all products")
    total_inventory_cost_value: Optional[Decimal] = Field(
        None,
        description="Total valuation based on product cost_price * stock_quantity. Null if no cost data available."
    )
    cost_coverage_percentage: float = Field(
        ...,
        description="Percentage of products having a populated cost_price (0.0 to 100.0)"
    )
    low_stock_products_count: int = Field(
        ...,
        description="Number of products whose stock_quantity is at or below their reorder_level"
    )
    out_of_stock_products_count: int = Field(
        ...,
        description="Number of products whose stock_quantity is exactly zero"
    )
    valuation_status: str = Field(
        ...,
        description="Valuation data completeness: 'COMPLETE', 'PARTIAL', 'ZERO_VALUATION', or 'UNAVAILABLE'"
    )


# ============================================================================
# Low-Stock Alert Schemas
# ============================================================================

class LowStockAlertItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    title: str
    sku: str
    category: Optional[str] = None
    current_stock: int
    reorder_level: int
    safety_stock: int
    lead_time_days: int
    vendor_id: uuid.UUID
    store_name: Optional[str] = None
    is_out_of_stock: bool


class LowStockAlertsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[LowStockAlertItem]
    total_alerts: int
    out_of_stock_count: int


# ============================================================================
# Replenishment Recommendation Schemas
# ============================================================================

class ReplenishmentRecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    title: str
    sku: str
    vendor_id: uuid.UUID
    current_stock: int
    reorder_level: int
    safety_stock: int
    lead_time_days: int
    estimated_daily_demand: float
    suggested_replenishment_qty: int
    demand_window_days: int
    sales_history_days: int
    total_units_sold_in_window: int
    status: str = Field(
        ...,
        description="'REPLENISHMENT_RECOMMENDED', 'SUFFICIENT_STOCK', 'INSUFFICIENT_DATA', or 'OUT_OF_STOCK'"
    )
    recommendation_notes: str


class ReplenishmentRecommendationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[ReplenishmentRecommendationItem]
    total_items: int
    demand_window_days: int


# ============================================================================
# Inventory Turnover Schemas
# ============================================================================

class InventoryTurnoverResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period_days: int
    cost_of_goods_sold: Optional[Decimal] = Field(
        None,
        description="Total COGS for recognized completed sales within the period. Null if cost data is unavailable."
    )
    average_inventory_units: Optional[Decimal] = Field(
        None,
        description="Estimated average unit inventory during the period."
    )
    average_inventory_value: Optional[Decimal] = Field(
        None,
        description="Estimated average inventory valuation using available cost prices."
    )
    turnover_ratio: Optional[Decimal] = Field(
        None,
        description="Inventory turnover ratio (COGS / Average Inventory Value). Null if insufficient data."
    )
    turnover_period_days: Optional[float] = Field(
        None,
        description="Days to turn inventory (period_days / turnover_ratio). Null if turnover is zero or unavailable."
    )
    status: str = Field(
        ...,
        description="'CALCULATED', 'INSUFFICIENT_COST_DATA', 'ZERO_AVERAGE_INVENTORY', or 'NO_SALES'"
    )
    notes: str


# ============================================================================
# Stock Movement Audit Ledger Schemas
# ============================================================================

class StockMovementItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_title: Optional[str] = None
    warehouse_id: Optional[uuid.UUID] = None
    warehouse_name: Optional[str] = None
    change_quantity: int
    previous_stock: int
    new_stock: int
    movement_type: StockMovementType
    reference_order_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    created_at: datetime


class StockMovementHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[StockMovementItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Demand Forecasting Schemas
# ============================================================================

class ForecastDataPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: str
    predicted_demand: float


class ProductDemandForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    product_title: str
    forecast_horizon_days: int
    historical_window_days: int
    daily_forecasts: List[ForecastDataPoint]
    total_predicted_demand: float
    average_daily_demand: float
    historical_daily_avg: float
    methodology: str = Field(
        ...,
        description="'MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING', 'ZERO_DEMAND_BASELINE', or 'INSUFFICIENT_HISTORY'"
    )
    evaluation_wmape: Optional[float] = Field(
        None,
        description="Weighted Mean Absolute Percentage Error on held-out test split (lower is better)."
    )
    evaluation_accuracy: Optional[float] = Field(
        None,
        description="Forecast accuracy: max(0, 1 - WMAPE) * 100. Null if actual test demand is 0."
    )
    status: str = Field(
        ...,
        description="'SUCCESS', 'INSUFFICIENT_HISTORY', 'SPARSE_DEMAND', or 'NO_SALES_RECORDED'"
    )
    notes: str
