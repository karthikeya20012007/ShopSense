import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import require_admin, require_approved_vendor
from backend.app.models.enums import StockMovementType
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.inventory import (
    InventorySummaryResponse,
    LowStockAlertsResponse,
    ReplenishmentRecommendationsResponse,
    InventoryTurnoverResponse,
    StockMovementHistoryResponse,
    ProductDemandForecastResponse,
    ProductInventoryUpdate,
    StockAdjustmentRequest,
    StockMovementItem,
)
from backend.app.schemas.product import ProductResponse
from backend.app.services.inventory_service import update_product_inventory, adjust_stock_manual
from backend.app.services.inventory_service import (
    get_inventory_summary,
    get_low_stock_alerts,
    get_replenishment_recommendations,
    get_inventory_turnover,
    get_stock_movement_history,
    get_product_demand_forecast,
)

router = APIRouter(prefix="/inventory", tags=["Inventory Analytics & Intelligence"])


# ============================================================================
# Administrator Endpoints (Platform-Wide or Vendor Filtered)
# ============================================================================

@router.get(
    "/summary",
    response_model=InventorySummaryResponse,
    summary="Platform Inventory Summary (Admin)",
    description="Returns aggregate catalog counts, stock units, cost valuation, and alert counts."
)
@router.get(
    "/admin/summary",
    response_model=InventorySummaryResponse,
    include_in_schema=False
)
def api_get_admin_inventory_summary(
    vendor_id: Optional[uuid.UUID] = Query(None, description="Optional vendor filter for marketplace admin"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_inventory_summary(db=db, vendor_id=vendor_id)


@router.get(
    "/low-stock",
    response_model=LowStockAlertsResponse,
    summary="Platform Low-Stock Alerts (Admin)",
    description="Returns products at or below their configured reorder level across the catalog."
)
@router.get(
    "/admin/low-stock",
    response_model=LowStockAlertsResponse,
    include_in_schema=False
)
def api_get_admin_low_stock(
    vendor_id: Optional[uuid.UUID] = Query(None, description="Optional vendor filter"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_low_stock_alerts(db=db, vendor_id=vendor_id)


@router.get(
    "/replenishment",
    response_model=ReplenishmentRecommendationsResponse,
    summary="Replenishment Recommendations (Admin)",
    description="Computes suggested reorder quantities: max(0, daily_demand * lead_time + safety_stock - stock)."
)
@router.get(
    "/admin/replenishment",
    response_model=ReplenishmentRecommendationsResponse,
    include_in_schema=False
)
def api_get_admin_replenishment(
    vendor_id: Optional[uuid.UUID] = Query(None, description="Optional vendor filter"),
    demand_window_days: int = Query(30, ge=1, le=180, description="Historical demand evaluation window in days"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_replenishment_recommendations(
        db=db,
        vendor_id=vendor_id,
        demand_window_days=demand_window_days
    )


@router.get(
    "/turnover",
    response_model=InventoryTurnoverResponse,
    summary="Inventory Turnover Ratio (Admin)",
    description="Computes COGS / Average Inventory. Returns null if cost data or stock is missing."
)
@router.get(
    "/admin/turnover",
    response_model=InventoryTurnoverResponse,
    include_in_schema=False
)
def api_get_admin_turnover(
    vendor_id: Optional[uuid.UUID] = Query(None, description="Optional vendor filter"),
    period_days: int = Query(90, ge=1, le=365, description="Turnover evaluation window in days"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_inventory_turnover(
        db=db,
        vendor_id=vendor_id,
        period_days=period_days
    )


@router.get(
    "/movements",
    response_model=StockMovementHistoryResponse,
    summary="Stock Movement Ledger (Admin)",
    description="Paginated audit ledger of all inventory adjustments across all vendors."
)
@router.get(
    "/admin/movements",
    response_model=StockMovementHistoryResponse,
    include_in_schema=False
)
def api_get_admin_movements(
    vendor_id: Optional[uuid.UUID] = Query(None, description="Filter by vendor"),
    product_id: Optional[uuid.UUID] = Query(None, description="Filter by product"),
    movement_type: Optional[StockMovementType] = Query(None, description="Filter by movement type"),
    start_date: Optional[datetime] = Query(None, description="Start date timestamp"),
    end_date: Optional[datetime] = Query(None, description="End date timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_stock_movement_history(
        db=db,
        vendor_id=vendor_id,
        product_id=product_id,
        movement_type=movement_type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )


@router.get(
    "/forecast",
    response_model=ProductDemandForecastResponse,
    summary="Product Demand Forecast (Admin)",
    description="Baseline product demand forecasting using historical daily sales and temporal evaluation."
)
@router.get(
    "/admin/forecast",
    response_model=ProductDemandForecastResponse,
    include_in_schema=False
)
def api_get_admin_forecast(
    product_id: uuid.UUID = Query(..., description="Target product ID to forecast"),
    forecast_horizon_days: int = Query(14, ge=1, le=60, description="Forecast horizon in days"),
    historical_window_days: int = Query(90, ge=14, le=365, description="Historical lookback window in days"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_product_demand_forecast(
        db=db,
        product_id=product_id,
        vendor_id=None,
        forecast_horizon_days=forecast_horizon_days,
        historical_window_days=historical_window_days
    )


# ============================================================================
# Authenticated Vendor Endpoints (Strictly Scoped to Vendor's Own Catalog)
# ============================================================================

@router.get(
    "/vendor/summary",
    response_model=InventorySummaryResponse,
    summary="Vendor Inventory Summary (Approved Vendor)",
    description="Returns aggregate inventory counts, stock valuation, and alerts for the authenticated vendor."
)
def api_get_vendor_inventory_summary(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_inventory_summary(db=db, vendor_id=vendor.id)


@router.get(
    "/vendor/low-stock",
    response_model=LowStockAlertsResponse,
    summary="Vendor Low-Stock Alerts (Approved Vendor)",
    description="Returns products at or below their configured reorder level for the authenticated vendor."
)
def api_get_vendor_low_stock(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_low_stock_alerts(db=db, vendor_id=vendor.id)


@router.get(
    "/vendor/replenishment",
    response_model=ReplenishmentRecommendationsResponse,
    summary="Vendor Replenishment Recommendations (Approved Vendor)",
    description="Suggested reorder quantities for the authenticated vendor's products based on lead time and demand."
)
def api_get_vendor_replenishment(
    demand_window_days: int = Query(30, ge=1, le=180, description="Historical demand window in days"),
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_replenishment_recommendations(
        db=db,
        vendor_id=vendor.id,
        demand_window_days=demand_window_days
    )


@router.get(
    "/vendor/turnover",
    response_model=InventoryTurnoverResponse,
    summary="Vendor Inventory Turnover (Approved Vendor)",
    description="Inventory turnover ratio for the authenticated vendor's sold products."
)
def api_get_vendor_turnover(
    period_days: int = Query(90, ge=1, le=365, description="Evaluation period in days"),
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_inventory_turnover(
        db=db,
        vendor_id=vendor.id,
        period_days=period_days
    )


@router.get(
    "/vendor/movements",
    response_model=StockMovementHistoryResponse,
    summary="Vendor Stock Movement Ledger (Approved Vendor)",
    description="Paginated stock movement audit history strictly isolated to the authenticated vendor's products."
)
def api_get_vendor_movements(
    product_id: Optional[uuid.UUID] = Query(None, description="Optional product filter (must belong to vendor)"),
    movement_type: Optional[StockMovementType] = Query(None, description="Filter by movement type"),
    start_date: Optional[datetime] = Query(None, description="Start date timestamp"),
    end_date: Optional[datetime] = Query(None, description="End date timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_stock_movement_history(
        db=db,
        vendor_id=vendor.id,
        product_id=product_id,
        movement_type=movement_type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )


@router.get(
    "/vendor/forecast",
    response_model=ProductDemandForecastResponse,
    summary="Vendor Product Demand Forecast (Approved Vendor)",
    description="Baseline product demand forecasting for a vendor-owned product."
)
def api_get_vendor_forecast(
    product_id: uuid.UUID = Query(..., description="Target product ID (must be owned by authenticated vendor)"),
    forecast_horizon_days: int = Query(14, ge=1, le=60, description="Forecast horizon in days"),
    historical_window_days: int = Query(90, ge=14, le=365, description="Historical lookback window in days"),
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_product_demand_forecast(
        db=db,
        product_id=product_id,
        vendor_id=vendor.id,
        forecast_horizon_days=forecast_horizon_days,
        historical_window_days=historical_window_days
    )

# ---------------------------------------------------------------------------
# Product Inventory Configuration Endpoints
# ---------------------------------------------------------------------------

@router.patch(
    "/vendor/products/{product_id}",
    response_model=ProductResponse,  # reuse existing product response schema
    summary="Vendor Product Inventory Update",
    description="Partial update of inventory configuration fields for a vendor's own product."
)
def api_vendor_update_inventory(
    product_id: uuid.UUID,
    update: ProductInventoryUpdate,
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db),
):
    return update_product_inventory(db=db, product_id=product_id, update_data=update, vendor_id=vendor.id)

@router.patch(
    "/admin/products/{product_id}",
    response_model=ProductResponse,
    summary="Admin Product Inventory Update",
    description="Update inventory configuration for any product as admin."
)
def api_admin_update_inventory(
    product_id: uuid.UUID,
    update: ProductInventoryUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return update_product_inventory(db=db, product_id=product_id, update_data=update, vendor_id=None)

# ---------------------------------------------------------------------------
# Manual Stock Adjustment Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/vendor/stock-adjustment",
    response_model=StockMovementItem,
    summary="Vendor Manual Stock Adjustment",
    description="Perform a manual stock adjustment on a vendor-owned product."
)
def api_vendor_stock_adjustment(
    adjustment: StockAdjustmentRequest,
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db),
):
    return adjust_stock_manual(db=db, adjustment=adjustment, vendor_id=vendor.id)

@router.post(
    "/admin/stock-adjustment",
    response_model=StockMovementItem,
    summary="Admin Manual Stock Adjustment",
    description="Perform a manual stock adjustment on any product as admin."
)
def api_admin_stock_adjustment(
    adjustment: StockAdjustmentRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return adjust_stock_manual(db=db, adjustment=adjustment, vendor_id=None)
