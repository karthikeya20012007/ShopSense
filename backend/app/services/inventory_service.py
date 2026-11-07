import math
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from backend.app.models.enums import OrderStatus, REVENUE_RECOGNIZED_ORDER_STATUSES, StockMovementType
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.stock_movement import StockMovement
from backend.app.models.warehouse import Warehouse
from backend.app.schemas.inventory import (
    InventorySummaryResponse,
    LowStockAlertItem,
    LowStockAlertsResponse,
    ReplenishmentRecommendationItem,
    ReplenishmentRecommendationsResponse,
    InventoryTurnoverResponse,
    StockMovementItem,
    StockMovementHistoryResponse,
    ForecastDataPoint,
    ProductDemandForecastResponse,
)


# ============================================================================
# 1. Inventory Summary
# ============================================================================

def get_inventory_summary(
    db: Session,
    vendor_id: Optional[uuid.UUID] = None
) -> InventorySummaryResponse:
    """
    Computes inventory summary metrics including total active products,
    total stock units, valuation based on cost_price, and low/out-of-stock counts.
    Scoped to vendor_id if provided; platform-wide if None.
    """
    stmt = select(Product)
    if vendor_id:
        stmt = stmt.where(Product.vendor_id == vendor_id)

    products = db.execute(stmt).scalars().all()

    if not products:
        return InventorySummaryResponse(
            total_products=0,
            total_units_in_stock=0,
            total_inventory_cost_value=Decimal("0.00"),
            cost_coverage_percentage=100.0,
            low_stock_products_count=0,
            out_of_stock_products_count=0,
            valuation_status="ZERO_VALUATION"
        )

    total_products = len(products)
    total_units_in_stock = sum(p.stock_quantity for p in products)
    low_stock_count = sum(1 for p in products if p.stock_quantity <= p.reorder_level)
    out_of_stock_count = sum(1 for p in products if p.stock_quantity == 0)

    products_with_cost = [p for p in products if p.cost_price is not None]
    cost_coverage_pct = round((len(products_with_cost) / total_products) * 100.0, 2)

    if not products_with_cost:
        total_cost_val = None
        valuation_status = "UNAVAILABLE"
    elif len(products_with_cost) < total_products:
        total_val = sum((p.cost_price * p.stock_quantity) for p in products_with_cost)
        total_cost_val = Decimal(str(total_val)).quantize(Decimal("0.01"))
        valuation_status = "PARTIAL"
    else:
        total_val = sum((p.cost_price * p.stock_quantity) for p in products_with_cost)
        total_cost_val = Decimal(str(total_val)).quantize(Decimal("0.01"))
        if total_cost_val == Decimal("0.00"):
            valuation_status = "ZERO_VALUATION"
        else:
            valuation_status = "COMPLETE"

    return InventorySummaryResponse(
        total_products=total_products,
        total_units_in_stock=total_units_in_stock,
        total_inventory_cost_value=total_cost_val,
        cost_coverage_percentage=cost_coverage_pct,
        low_stock_products_count=low_stock_count,
        out_of_stock_products_count=out_of_stock_count,
        valuation_status=valuation_status
    )


# ============================================================================
# 2. Low-Stock Alerts
# ============================================================================

def get_low_stock_alerts(
    db: Session,
    vendor_id: Optional[uuid.UUID] = None
) -> LowStockAlertsResponse:
    """
    Returns products whose current stock_quantity <= reorder_level.
    Uses each product's configured reorder_level, never a hardcoded threshold.
    """
    stmt = (
        select(Product)
        .options(
            joinedload(Product.vendor),
            joinedload(Product.category_rel)
        )
        .where(Product.stock_quantity <= Product.reorder_level)
    )

    if vendor_id:
        stmt = stmt.where(Product.vendor_id == vendor_id)

    stmt = stmt.order_by(Product.stock_quantity.asc(), Product.reorder_level.desc())
    products = db.execute(stmt).scalars().all()

    items = []
    out_of_stock_count = 0

    for p in products:
        is_oos = (p.stock_quantity == 0)
        if is_oos:
            out_of_stock_count += 1

        store_name = p.vendor.store_name if p.vendor else None
        category_name = p.category_rel.name if p.category_rel else p.category

        items.append(
            LowStockAlertItem(
                product_id=p.id,
                title=p.title,
                sku=p.sku,
                category=category_name,
                current_stock=p.stock_quantity,
                reorder_level=p.reorder_level,
                safety_stock=p.safety_stock,
                lead_time_days=p.lead_time_days,
                vendor_id=p.vendor_id,
                store_name=store_name,
                is_out_of_stock=is_oos
            )
        )

    return LowStockAlertsResponse(
        items=items,
        total_alerts=len(items),
        out_of_stock_count=out_of_stock_count
    )


# ============================================================================
# 3. Replenishment Recommendations
# ============================================================================

def get_replenishment_recommendations(
    db: Session,
    vendor_id: Optional[uuid.UUID] = None,
    demand_window_days: int = 30
) -> ReplenishmentRecommendationsResponse:
    """
    Calculates replenishment recommendations using:
    suggested = max(0, estimated_daily_demand * lead_time_days + safety_stock - current_stock)
    
    When sales history is insufficient (e.g. 0 orders in window), flags recommendation
    as INSUFFICIENT_DATA and applies safety_stock restoration fallback for out-of-stock items.
    """
    if demand_window_days <= 0:
        demand_window_days = 30

    stmt = select(Product)
    if vendor_id:
        stmt = stmt.where(Product.vendor_id == vendor_id)
    stmt = stmt.order_by(Product.title.asc())

    products = db.execute(stmt).scalars().all()
    if not products:
        return ReplenishmentRecommendationsResponse(
            items=[],
            total_items=0,
            demand_window_days=demand_window_days
        )

    window_start = datetime.now(timezone.utc) - timedelta(days=demand_window_days)

    # Bulk fetch completed sales quantities within window
    sales_stmt = (
        select(OrderItem.product_id, func.sum(OrderItem.quantity).label("units_sold"))
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= window_start
        )
        .group_by(OrderItem.product_id)
    )
    sales_map = {row[0]: int(row[1]) for row in db.execute(sales_stmt).all()}

    items: List[ReplenishmentRecommendationItem] = []

    for p in products:
        units_sold = sales_map.get(p.id, 0)
        daily_demand = round(units_sold / float(demand_window_days), 4)

        if units_sold == 0:
            if p.stock_quantity == 0:
                suggested_qty = max(0, p.safety_stock)
                status_str = "OUT_OF_STOCK"
                notes = (
                    f"Product is out of stock with 0 recorded sales in the past {demand_window_days} days. "
                    f"Suggested replenishment of {suggested_qty} units restores safety stock."
                )
            elif p.stock_quantity <= p.reorder_level:
                suggested_qty = max(0, p.reorder_level - p.stock_quantity)
                status_str = "INSUFFICIENT_DATA"
                notes = (
                    f"Low stock ({p.stock_quantity} units) with no sales in past {demand_window_days} days. "
                    f"Baseline reorder of {suggested_qty} units recommended to replenish to reorder level."
                )
            else:
                suggested_qty = 0
                status_str = "INSUFFICIENT_DATA"
                notes = (
                    f"No completed sales recorded in the past {demand_window_days} days. "
                    f"Current stock ({p.stock_quantity}) exceeds reorder level ({p.reorder_level})."
                )
        else:
            raw_suggested = (daily_demand * p.lead_time_days) + p.safety_stock - p.stock_quantity
            suggested_qty = max(0, math.ceil(raw_suggested))

            if p.stock_quantity == 0:
                status_str = "OUT_OF_STOCK"
                notes = (
                    f"Product is currently out of stock. Immediate replenishment of {suggested_qty} unit(s) "
                    f"recommended based on daily demand {daily_demand:.2f}."
                )
            elif suggested_qty > 0:
                status_str = "REPLENISHMENT_RECOMMENDED"
                notes = (
                    f"Stock ({p.stock_quantity}) will breach safety stock ({p.safety_stock}) during {p.lead_time_days}-day "
                    f"lead time under current demand ({daily_demand:.2f} units/day)."
                )
            else:
                status_str = "SUFFICIENT_STOCK"
                lead_demand = round(daily_demand * p.lead_time_days, 1)
                notes = (
                    f"Stock ({p.stock_quantity}) comfortably covers lead time demand ({lead_demand}) "
                    f"plus safety stock ({p.safety_stock})."
                )

        items.append(
            ReplenishmentRecommendationItem(
                product_id=p.id,
                title=p.title,
                sku=p.sku,
                vendor_id=p.vendor_id,
                current_stock=p.stock_quantity,
                reorder_level=p.reorder_level,
                safety_stock=p.safety_stock,
                lead_time_days=p.lead_time_days,
                estimated_daily_demand=daily_demand,
                suggested_replenishment_qty=suggested_qty,
                demand_window_days=demand_window_days,
                sales_history_days=demand_window_days,
                total_units_sold_in_window=units_sold,
                status=status_str,
                recommendation_notes=notes
            )
        )

    return ReplenishmentRecommendationsResponse(
        items=items,
        total_items=len(items),
        demand_window_days=demand_window_days
    )


# ============================================================================
# 4. Inventory Turnover
# ============================================================================

def get_inventory_turnover(
    db: Session,
    vendor_id: Optional[uuid.UUID] = None,
    period_days: int = 90
) -> InventoryTurnoverResponse:
    """
    Calculates inventory turnover: COGS / Average Inventory Value over period_days.
    Requires cost_price on sold products; never substitutes revenue for COGS.
    Returns nullable metrics with explanatory status when data is missing or average inventory is zero.
    """
    if period_days <= 0:
        period_days = 90

    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)

    # 1. Query completed order items in the period
    order_items_stmt = (
        select(OrderItem, Product)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= cutoff
        )
    )

    if vendor_id:
        order_items_stmt = order_items_stmt.where(OrderItem.vendor_id == vendor_id)

    sales_rows = db.execute(order_items_stmt).all()

    # 2. Query current products in scope
    prod_stmt = select(Product)
    if vendor_id:
        prod_stmt = prod_stmt.where(Product.vendor_id == vendor_id)
    products = db.execute(prod_stmt).scalars().all()

    current_stock_units = sum(p.stock_quantity for p in products)
    total_units_sold = sum(item.quantity for item, _ in sales_rows)

    # Estimate average inventory units: ending stock + half of net units sold
    # (standard economic proxy: Average Inventory = Ending Inventory + 0.5 * Units Sold)
    avg_inventory_units = Decimal(str(current_stock_units + (total_units_sold / 2.0))).quantize(Decimal("0.01"))

    # Compute average cost price of products in scope
    products_with_cost = [p for p in products if p.cost_price is not None]

    if not sales_rows:
        return InventoryTurnoverResponse(
            period_days=period_days,
            cost_of_goods_sold=Decimal("0.00"),
            average_inventory_units=avg_inventory_units,
            average_inventory_value=Decimal("0.00") if not products_with_cost else None,
            turnover_ratio=Decimal("0.00"),
            turnover_period_days=None,
            status="NO_SALES",
            notes=f"No completed sales recorded during the {period_days}-day evaluation period."
        )

    # Check if sold items have cost prices
    items_missing_cost = [item for item, p in sales_rows if p.cost_price is None]
    if items_missing_cost:
        return InventoryTurnoverResponse(
            period_days=period_days,
            cost_of_goods_sold=None,
            average_inventory_units=avg_inventory_units,
            average_inventory_value=None,
            turnover_ratio=None,
            turnover_period_days=None,
            status="INSUFFICIENT_COST_DATA",
            notes=(
                f"Cost price is missing for {len(items_missing_cost)} sold order item(s). "
                f"COGS and turnover ratio cannot be calculated without cost data. Revenue was not substituted."
            )
        )

    # Calculate exact COGS
    cogs = sum((p.cost_price * item.quantity) for item, p in sales_rows)
    cogs_dec = Decimal(str(cogs)).quantize(Decimal("0.01"))

    # Calculate average inventory valuation
    if not products_with_cost:
        return InventoryTurnoverResponse(
            period_days=period_days,
            cost_of_goods_sold=cogs_dec,
            average_inventory_units=avg_inventory_units,
            average_inventory_value=None,
            turnover_ratio=None,
            turnover_period_days=None,
            status="INSUFFICIENT_COST_DATA",
            notes="Catalog products have no cost_price configured. Cannot compute average inventory valuation."
        )

    avg_unit_cost = sum(p.cost_price for p in products_with_cost) / len(products_with_cost)
    avg_inventory_value = (avg_inventory_units * avg_unit_cost).quantize(Decimal("0.01"))

    if avg_inventory_value <= Decimal("0.00"):
        return InventoryTurnoverResponse(
            period_days=period_days,
            cost_of_goods_sold=cogs_dec,
            average_inventory_units=avg_inventory_units,
            average_inventory_value=avg_inventory_value,
            turnover_ratio=None,
            turnover_period_days=None,
            status="ZERO_AVERAGE_INVENTORY",
            notes="Average inventory valuation is zero. Cannot divide by zero to compute turnover."
        )

    turnover = (cogs_dec / avg_inventory_value).quantize(Decimal("0.01"))
    turnover_days = round(float(period_days) / float(turnover), 1) if turnover > 0 else None

    return InventoryTurnoverResponse(
        period_days=period_days,
        cost_of_goods_sold=cogs_dec,
        average_inventory_units=avg_inventory_units,
        average_inventory_value=avg_inventory_value,
        turnover_ratio=turnover,
        turnover_period_days=turnover_days,
        status="CALCULATED",
        notes=f"Turnover calculated over {period_days} days using recognized COGS ({cogs_dec}) and estimated average inventory."
    )


# ============================================================================
# 5. Stock Movement Audit Ledger
# ============================================================================

def get_stock_movement_history(
    db: Session,
    vendor_id: Optional[uuid.UUID] = None,
    product_id: Optional[uuid.UUID] = None,
    movement_type: Optional[StockMovementType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20
) -> StockMovementHistoryResponse:
    """
    Retrieves paginated stock movement audit ledger records.
    Strictly enforces vendor ownership isolation:
    - If vendor_id is provided, only movements for products owned by that vendor are accessible.
    - If product_id does not belong to vendor_id, access is rejected.
    """
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    if page_size > 100:
        page_size = 100

    # Build base query joined with Product and Warehouse
    stmt = (
        select(StockMovement)
        .join(Product, StockMovement.product_id == Product.id)
        .options(
            joinedload(StockMovement.product),
            joinedload(StockMovement.warehouse)
        )
    )

    count_stmt = (
        select(func.count(StockMovement.id))
        .join(Product, StockMovement.product_id == Product.id)
    )

    # Vendor isolation filter
    if vendor_id:
        stmt = stmt.where(Product.vendor_id == vendor_id)
        count_stmt = count_stmt.where(Product.vendor_id == vendor_id)

    # Product filter
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
        count_stmt = count_stmt.where(StockMovement.product_id == product_id)

    # Movement type filter
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
        count_stmt = count_stmt.where(StockMovement.movement_type == movement_type)

    # Date range filters
    if start_date:
        stmt = stmt.where(StockMovement.created_at >= start_date)
        count_stmt = count_stmt.where(StockMovement.created_at >= start_date)
    if end_date:
        stmt = stmt.where(StockMovement.created_at <= end_date)
        count_stmt = count_stmt.where(StockMovement.created_at <= end_date)

    total = db.execute(count_stmt).scalar() or 0

    stmt = (
        stmt
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    movements = db.execute(stmt).scalars().all()

    items = []
    for m in movements:
        prod_title = m.product.title if m.product else None
        wh_name = m.warehouse.name if m.warehouse else None
        items.append(
            StockMovementItem(
                id=m.id,
                product_id=m.product_id,
                product_title=prod_title,
                warehouse_id=m.warehouse_id,
                warehouse_name=wh_name,
                change_quantity=m.change_quantity,
                previous_stock=m.previous_stock,
                new_stock=m.new_stock,
                movement_type=m.movement_type,
                reference_order_id=m.reference_order_id,
                notes=m.notes,
                created_at=m.created_at
            )
        )

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return StockMovementHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


# ============================================================================
# 6. Demand Forecasting
# ============================================================================

def get_product_demand_forecast(
    db: Session,
    product_id: uuid.UUID,
    vendor_id: Optional[uuid.UUID] = None,
    forecast_horizon_days: int = 14,
    historical_window_days: int = 90
) -> ProductDemandForecastResponse:
    """
    Computes a baseline daily demand forecast for a single product using historical
    completed order quantities aggregated by calendar day.
    
    Principles enforced:
    - Time-ordered 80/20 train/test split (never randomly shuffled).
    - Prevents data leakage: lags and rolling averages evaluate purely on prior temporal points.
    - Sparse/missing dates are explicitly imputed with 0.0 demand.
    - Evaluates held-out WMAPE and accuracy: max(0, 1 - WMAPE) * 100 when test sum > 0.
    - Deterministic and testable.
    - Enforces vendor ownership isolation if vendor_id is supplied.
    """
    if forecast_horizon_days < 1:
        forecast_horizon_days = 14
    if forecast_horizon_days > 60:
        forecast_horizon_days = 60
    if historical_window_days < 14:
        historical_window_days = 14
    if historical_window_days > 365:
        historical_window_days = 365

    # 1. Fetch and validate product
    product = db.execute(
        select(Product).where(Product.id == product_id)
    ).scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found."
        )

    if vendor_id and product.vendor_id != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this product."
        )

    # 2. Query completed order item history
    start_date = datetime.now(timezone.utc) - timedelta(days=historical_window_days)

    stmt = (
        select(Order.created_at, OrderItem.quantity)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.product_id == product_id,
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= start_date
        )
        .order_by(Order.created_at.asc())
    )
    order_rows = db.execute(stmt).all()

    today_date = datetime.now(timezone.utc).date()

    # If no sales at all in historical window
    if not order_rows:
        daily_forecasts = [
            ForecastDataPoint(
                date=(today_date + timedelta(days=i)).isoformat(),
                predicted_demand=0.0
            )
            for i in range(1, forecast_horizon_days + 1)
        ]
        return ProductDemandForecastResponse(
            product_id=product.id,
            product_title=product.title,
            forecast_horizon_days=forecast_horizon_days,
            historical_window_days=historical_window_days,
            daily_forecasts=daily_forecasts,
            total_predicted_demand=0.0,
            average_daily_demand=0.0,
            historical_daily_avg=0.0,
            methodology="ZERO_DEMAND_BASELINE",
            evaluation_wmape=None,
            evaluation_accuracy=None,
            status="NO_SALES_RECORDED",
            notes=(
                f"No completed orders found in the past {historical_window_days} days. "
                f"Baseline zero demand returned."
            )
        )

    # 3. Aggregate daily demand and impute sparse/missing dates
    first_order_date = order_rows[0][0].date()
    # Continuous date range from first_order_date to yesterday (or today)
    window_days_count = (today_date - first_order_date).days + 1
    if window_days_count < 1:
        window_days_count = 1

    daily_totals: Dict[date, float] = {}
    for i in range(window_days_count):
        d = first_order_date + timedelta(days=i)
        daily_totals[d] = 0.0

    for created_at, qty in order_rows:
        d = created_at.date()
        if d in daily_totals:
            daily_totals[d] += float(qty)

    sorted_dates = sorted(daily_totals.keys())
    y_series = [daily_totals[d] for d in sorted_dates]
    n_days = len(y_series)
    historical_daily_avg = round(sum(y_series) / float(n_days), 4)

    # 4. Check for insufficient history for holdout evaluation (< 14 days)
    if n_days < 14:
        daily_forecasts = [
            ForecastDataPoint(
                date=(today_date + timedelta(days=i)).isoformat(),
                predicted_demand=historical_daily_avg
            )
            for i in range(1, forecast_horizon_days + 1)
        ]
        total_pred = round(historical_daily_avg * forecast_horizon_days, 2)
        return ProductDemandForecastResponse(
            product_id=product.id,
            product_title=product.title,
            forecast_horizon_days=forecast_horizon_days,
            historical_window_days=historical_window_days,
            daily_forecasts=daily_forecasts,
            total_predicted_demand=total_pred,
            average_daily_demand=historical_daily_avg,
            historical_daily_avg=historical_daily_avg,
            methodology="MOVING_AVERAGE",
            evaluation_wmape=None,
            evaluation_accuracy=None,
            status="INSUFFICIENT_HISTORY",
            notes=(
                f"Only {n_days} continuous days of sales history available (< 14 days minimum for holdout evaluation). "
                f"Forecast populated using historical daily mean."
            )
        )

    # 5. Temporal Train/Test Split (80% Train, 20% Test)
    split_idx = int(0.8 * n_days)
    train_y = y_series[:split_idx]
    test_y = y_series[split_idx:]
    test_dates = sorted_dates[split_idx:]

    # Fit Exponential Smoothing (EWMA, alpha=0.3) on train set
    alpha = 0.3
    level = train_y[0]
    for y in train_y[1:]:
        level = alpha * y + (1.0 - alpha) * level

    # Evaluate sequentially on test set without looking ahead
    test_preds: List[float] = []
    eval_level = level
    for y in test_y:
        test_preds.append(max(0.0, eval_level))
        # Roll forward
        eval_level = alpha * y + (1.0 - alpha) * eval_level

    # Compute WMAPE = sum(|actual - predicted|) / sum(actual)
    sum_actual = sum(test_y)
    sum_abs_errors = sum(abs(act - pred) for act, pred in zip(test_y, test_preds))

    if sum_actual > 0:
        wmape = sum_abs_errors / sum_actual
        eval_wmape = round(float(wmape), 4)
        accuracy = max(0.0, min(100.0, (1.0 - wmape) * 100.0))
        eval_accuracy = round(float(accuracy), 2)
    else:
        # Sum of actual sales in test set was 0
        if sum_abs_errors == 0:
            eval_wmape = 0.0
            eval_accuracy = 100.0
        else:
            eval_wmape = None
            eval_accuracy = 0.0

    # 6. Future Forecast Generation (fit over full series)
    full_level = y_series[0]
    for y in y_series[1:]:
        full_level = alpha * y + (1.0 - alpha) * full_level

    daily_forecasts = []
    for i in range(1, forecast_horizon_days + 1):
        f_date = (today_date + timedelta(days=i)).isoformat()
        pred_val = round(max(0.0, full_level), 2)
        daily_forecasts.append(ForecastDataPoint(date=f_date, predicted_demand=pred_val))

    total_predicted = round(sum(dp.predicted_demand for dp in daily_forecasts), 2)
    avg_predicted = round(total_predicted / float(forecast_horizon_days), 2)

    return ProductDemandForecastResponse(
        product_id=product.id,
        product_title=product.title,
        forecast_horizon_days=forecast_horizon_days,
        historical_window_days=historical_window_days,
        daily_forecasts=daily_forecasts,
        total_predicted_demand=total_predicted,
        average_daily_demand=avg_predicted,
        historical_daily_avg=historical_daily_avg,
        methodology="EXPONENTIAL_SMOOTHING",
        evaluation_wmape=eval_wmape,
        evaluation_accuracy=eval_accuracy,
        status="SUCCESS",
        notes=(
            f"Forecast generated using Exponential Smoothing (alpha={alpha}) across {n_days} continuous days. "
            f"Held-out temporal evaluation on {len(test_y)} test days yielded WMAPE={eval_wmape}."
        )
    )

# ---------------------------------------------------------------------------
# 7. Product Inventory Configuration Update
# ---------------------------------------------------------------------------

from fastapi import HTTPException, status
from sqlalchemy import select, update
from backend.app.models.product import Product
from backend.app.schemas.inventory import ProductInventoryUpdate
from backend.app.models.enums import StockMovementType

def update_product_inventory(
    db: Session,
    product_id: uuid.UUID,
    update_data: ProductInventoryUpdate,
    vendor_id: Optional[uuid.UUID] = None,
) -> Product:
    """Update inventory‑related fields of a product.

    Args:
        db: Database session.
        product_id: Target product UUID.
        update_data: Pydantic schema containing optional fields.
        vendor_id: If provided, restrict update to products owned by this vendor.

    Returns:
        Updated ``Product`` ORM instance.

    Raises:
        HTTPException 404 if product not found.
        HTTPException 403 if vendor ownership check fails.
        HTTPException 422 for validation errors (negative values).
    """
    # 1. Retrieve product with row‑level lock
    stmt = select(Product).where(Product.id == product_id).with_for_update()
    product = db.execute(stmt).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Product with ID '{product_id}' not found.")

    # 2. Vendor ownership check
    if vendor_id and product.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Access forbidden: you do not own this product.")

    # 3. Apply partial updates – ``exclude_unset`` respects omitted fields
    update_dict = update_data.model_dump(exclude_unset=True)
    # ``cost_price`` may be explicitly ``None`` – allowed by schema and DB constraint
    for field, value in update_dict.items():
        setattr(product, field, value)

    # 4. Commit transaction – any DB‑level check (e.g., non‑negative) will raise
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=str(exc))

    db.refresh(product)
    return product

# ---------------------------------------------------------------------------
# 8. Manual Stock Adjustment (Vendor & Admin)
# ---------------------------------------------------------------------------
from backend.app.models.stock_movement import StockMovement
from backend.app.models.warehouse import Warehouse
from backend.app.schemas.inventory import StockAdjustmentRequest

def _validate_warehouse(db: Session, warehouse_id: Optional[uuid.UUID]):
    if warehouse_id is None:
        return None
    warehouse = db.execute(
        select(Warehouse).where(Warehouse.id == warehouse_id)
    ).scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Warehouse does not exist.")
    if not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Warehouse is inactive.")
    return warehouse

def adjust_stock_manual(
    db: Session,
    adjustment: StockAdjustmentRequest,
    vendor_id: Optional[uuid.UUID] = None,
) -> StockMovement:
    """Perform a manual stock adjustment with audit ledger entry.

    The operation is fully atomic – product update and ``StockMovement`` insert
    occur within a single transaction.
    """
    # 1. Load product with row‑level lock
    stmt = select(Product).where(Product.id == adjustment.product_id).with_for_update()
    product = db.execute(stmt).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Product with ID '{adjustment.product_id}' not found.")

    # 2. Vendor ownership enforcement
    if vendor_id and product.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Access forbidden: you do not own this product.")

    # 3. Warehouse validation (optional)
    warehouse = _validate_warehouse(db, adjustment.warehouse_id)

    # 4. Determine signed delta based on adjustment type
    qty = adjustment.quantity
    if adjustment.adjustment_type == "PURCHASE_RESTOCK":
        if qty <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="PURCHASE_RESTOCK quantity must be positive.")
        delta = qty
    elif adjustment.adjustment_type == "MANUAL_ADJUSTMENT":
        if qty == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="MANUAL_ADJUSTMENT quantity cannot be zero.")
        delta = qty
    elif adjustment.adjustment_type == "SHRINKAGE":
        if qty <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="SHRINKAGE quantity must be positive.")
        delta = -qty
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Invalid adjustment_type.")

    previous_stock = product.stock_quantity
    new_stock = previous_stock + delta
    if new_stock < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Adjustment would result in negative stock.")

    # 5. Apply stock change
    db.execute(update(Product).where(Product.id == product.id).values(stock_quantity=new_stock))
    product.stock_quantity = new_stock

    # 6. Create ledger entry
    movement = StockMovement(
        product_id=product.id,
        warehouse_id=adjustment.warehouse_id,
        change_quantity=delta,
        previous_stock=previous_stock,
        new_stock=new_stock,
        movement_type=StockMovementType(adjustment.adjustment_type),
        notes=adjustment.reason,
    )
    db.add(movement)
    # 7. Commit both changes atomically
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=str(exc))
    db.refresh(movement)
    return movement
