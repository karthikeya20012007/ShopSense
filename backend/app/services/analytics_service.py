import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, desc, cast, Date

from backend.app.models.enums import OrderStatus, VendorStatus, REVENUE_RECOGNIZED_ORDER_STATUSES
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.analytics import (
    AdminOverviewMetrics,
    RevenueTrendPoint,
    VendorPerformanceItem,
    ProductPerformanceItem,
    CategoryPerformanceItem,
    AdminProductsAnalyticsResponse,
    VendorOverviewMetrics,
    VendorRevenueTrendPoint,
)


def get_admin_overview_metrics(db: Session) -> AdminOverviewMetrics:
    """Calculates high-level marketplace KPI metrics."""
    rev_stmt = (
        select(
            func.coalesce(func.sum(OrderItem.subtotal), 0),
            func.count(func.distinct(Order.id))
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES))
    )
    rev_row = db.execute(rev_stmt).one()
    total_revenue = Decimal(str(rev_row[0])).quantize(Decimal("0.01"))
    completed_orders = int(rev_row[1])

    total_orders = db.execute(select(func.count(Order.id))).scalar() or 0

    vendor_counts = db.execute(
        select(VendorProfile.status, func.count(VendorProfile.id))
        .group_by(VendorProfile.status)
    ).all()
    v_map = {row[0]: row[1] for row in vendor_counts}
    pending_v = v_map.get(VendorStatus.PENDING, 0)
    approved_v = v_map.get(VendorStatus.APPROVED, 0)
    rejected_v = v_map.get(VendorStatus.REJECTED, 0)
    total_v = pending_v + approved_v + rejected_v

    total_p = db.execute(select(func.count(Product.id))).scalar() or 0
    published_p = db.execute(
        select(func.count(Product.id)).where(Product.is_published.is_(True))
    ).scalar() or 0

    return AdminOverviewMetrics(
        total_revenue=total_revenue,
        completed_orders_count=completed_orders,
        total_orders_count=total_orders,
        total_vendors_count=total_v,
        approved_vendors_count=approved_v,
        pending_vendors_count=pending_v,
        rejected_vendors_count=rejected_v,
        total_products_count=total_p,
        published_products_count=published_p
    )


def get_admin_revenue_trend(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[RevenueTrendPoint]:
    """Retrieves daily recognized revenue and order counts within date boundaries."""
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    day_col = cast(Order.created_at, Date).label("order_date")

    stmt = (
        select(
            day_col,
            func.coalesce(func.sum(OrderItem.subtotal), 0),
            func.count(func.distinct(Order.id))
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= start_dt,
            Order.created_at <= end_dt
        )
        .group_by(day_col)
        .order_by(day_col.asc())
    )
    rows = db.execute(stmt).all()

    return [
        RevenueTrendPoint(
            date=str(row[0]),
            revenue=Decimal(str(row[1])).quantize(Decimal("0.01")),
            order_count=int(row[2])
        )
        for row in rows
    ]


def get_admin_vendor_performance(
    db: Session,
    limit: int = 10
) -> List[VendorPerformanceItem]:
    """Ranks vendors by total recognized revenue generated across completed orders."""
    stmt = (
        select(
            VendorProfile.id,
            VendorProfile.store_name,
            func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("items_sold"),
            func.count(func.distinct(OrderItem.order_id)).label("order_count")
        )
        .select_from(VendorProfile)
        .join(OrderItem, OrderItem.vendor_id == VendorProfile.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES))
        .group_by(VendorProfile.id, VendorProfile.store_name)
        .order_by(desc("revenue"))
        .limit(limit)
    )
    rows = db.execute(stmt).all()

    return [
        VendorPerformanceItem(
            vendor_id=row[0],
            store_name=row[1],
            revenue=Decimal(str(row[2])).quantize(Decimal("0.01")),
            items_sold=int(row[3]),
            order_count=int(row[4])
        )
        for row in rows
    ]


def get_admin_product_analytics(
    db: Session,
    limit: int = 10
) -> AdminProductsAnalyticsResponse:
    """Calculates top product performance and category breakdowns for completed orders."""
    p_stmt = (
        select(
            Product.id,
            Product.title,
            Product.category,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
            func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue")
        )
        .select_from(Product)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES))
        .group_by(Product.id, Product.title, Product.category)
        .order_by(desc("revenue"))
        .limit(limit)
    )
    p_rows = db.execute(p_stmt).all()

    top_products = [
        ProductPerformanceItem(
            product_id=row[0],
            title=row[1],
            category=row[2],
            units_sold=int(row[3]),
            revenue=Decimal(str(row[4])).quantize(Decimal("0.01"))
        )
        for row in p_rows
    ]

    c_stmt = (
        select(
            Product.category,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
            func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue")
        )
        .select_from(Product)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES))
        .group_by(Product.category)
        .order_by(desc("revenue"))
    )
    c_rows = db.execute(c_stmt).all()

    category_breakdown = [
        CategoryPerformanceItem(
            category=row[0],
            units_sold=int(row[1]),
            revenue=Decimal(str(row[2])).quantize(Decimal("0.01"))
        )
        for row in c_rows
    ]

    return AdminProductsAnalyticsResponse(
        top_products=top_products,
        category_breakdown=category_breakdown
    )


def get_vendor_overview_metrics(
    db: Session,
    vendor_id: uuid.UUID,
    store_name: str
) -> VendorOverviewMetrics:
    """Calculates vendor-scoped performance KPIs from completed orders."""
    rev_stmt = (
        select(
            func.coalesce(func.sum(OrderItem.subtotal), 0),
            func.count(func.distinct(OrderItem.order_id)),
            func.coalesce(func.sum(OrderItem.quantity), 0)
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.vendor_id == vendor_id,
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES)
        )
    )
    rev_row = db.execute(rev_stmt).one()
    recognized_revenue = Decimal(str(rev_row[0])).quantize(Decimal("0.01"))
    completed_orders = int(rev_row[1])
    total_units_sold = int(rev_row[2])

    total_orders = db.execute(
        select(func.count(func.distinct(OrderItem.order_id)))
        .where(OrderItem.vendor_id == vendor_id)
    ).scalar() or 0

    total_p = db.execute(
        select(func.count(Product.id)).where(Product.vendor_id == vendor_id)
    ).scalar() or 0

    low_stock = db.execute(
        select(func.count(Product.id)).where(
            Product.vendor_id == vendor_id,
            Product.stock_quantity <= 5
        )
    ).scalar() or 0

    return VendorOverviewMetrics(
        vendor_id=vendor_id,
        store_name=store_name,
        recognized_revenue=recognized_revenue,
        completed_order_count=completed_orders,
        total_order_count=total_orders,
        total_products=total_p,
        low_stock_count=low_stock,
        total_units_sold=total_units_sold
    )


def get_vendor_revenue_trend(
    db: Session,
    vendor_id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[VendorRevenueTrendPoint]:
    """Retrieves vendor-scoped daily revenue trend and units sold."""
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    day_col = cast(Order.created_at, Date).label("order_date")

    stmt = (
        select(
            day_col,
            func.coalesce(func.sum(OrderItem.subtotal), 0),
            func.coalesce(func.sum(OrderItem.quantity), 0)
        )
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.vendor_id == vendor_id,
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= start_dt,
            Order.created_at <= end_dt
        )
        .group_by(day_col)
        .order_by(day_col.asc())
    )
    rows = db.execute(stmt).all()

    return [
        VendorRevenueTrendPoint(
            date=str(row[0]),
            revenue=Decimal(str(row[1])).quantize(Decimal("0.01")),
            units_sold=int(row[2])
        )
        for row in rows
    ]


def get_vendor_product_performance(
    db: Session,
    vendor_id: uuid.UUID
) -> List[ProductPerformanceItem]:
    """Detailed performance list of all products belonging to the authenticated vendor."""
    sales_sub = (
        select(
            OrderItem.product_id,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
            func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue")
        )
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.vendor_id == vendor_id,
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES)
        )
        .group_by(OrderItem.product_id)
        .subquery()
    )

    stmt = (
        select(
            Product.id,
            Product.title,
            Product.category,
            Product.price,
            Product.stock_quantity,
            Product.is_published,
            func.coalesce(sales_sub.c.units_sold, 0).label("units_sold"),
            func.coalesce(sales_sub.c.revenue, 0).label("revenue")
        )
        .outerjoin(sales_sub, sales_sub.c.product_id == Product.id)
        .where(Product.vendor_id == vendor_id)
        .order_by(desc("revenue"), desc(Product.created_at))
    )
    rows = db.execute(stmt).all()

    return [
        ProductPerformanceItem(
            product_id=row[0],
            title=row[1],
            category=row[2],
            price=Decimal(str(row[3])).quantize(Decimal("0.01")),
            current_stock=int(row[4]),
            is_published=bool(row[5]),
            units_sold=int(row[6]),
            revenue=Decimal(str(row[7])).quantize(Decimal("0.01")),
            is_low_stock=bool(row[4] <= 5)
        )
        for row in rows
    ]
