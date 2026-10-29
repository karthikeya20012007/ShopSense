import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import require_admin, require_approved_vendor
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.schemas.analytics import (
    AdminOverviewMetrics,
    RevenueTrendPoint,
    VendorPerformanceItem,
    ProductPerformanceItem,
    AdminProductsAnalyticsResponse,
    VendorOverviewMetrics,
    VendorRevenueTrendPoint,
)
from backend.app.services.analytics_service import (
    get_admin_overview_metrics,
    get_admin_revenue_trend,
    get_admin_vendor_performance,
    get_admin_product_analytics,
    get_vendor_overview_metrics,
    get_vendor_revenue_trend,
    get_vendor_product_performance,
)

router = APIRouter(prefix="/analytics", tags=["Sales Analytics & Reporting"])


# ============================================================================
# Administrator Analytics Endpoints (Platform-Wide)
# ============================================================================

@router.get(
    "/admin/overview",
    response_model=AdminOverviewMetrics,
    summary="Platform KPI Overview (Admin only)",
    description="Aggregated platform statistics including recognized revenue, completed orders, and vendor breakdown."
)
def api_get_admin_overview(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_admin_overview_metrics(db=db)


@router.get(
    "/admin/revenue",
    response_model=List[RevenueTrendPoint],
    summary="Marketplace Revenue Trend (Admin only)",
    description="Daily timeline of recognized revenue and order counts over an optional date window."
)
def api_get_admin_revenue_trend(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD), defaults to 30 days ago"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD), defaults to today"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_admin_revenue_trend(db=db, start_date=start_date, end_date=end_date)


@router.get(
    "/admin/vendors",
    response_model=List[VendorPerformanceItem],
    summary="Top Performing Vendors (Admin only)",
    description="Vendors ranked by total recognized revenue generated on the platform."
)
def api_get_admin_vendors(
    limit: int = Query(10, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_admin_vendor_performance(db=db, limit=limit)


@router.get(
    "/admin/products",
    response_model=AdminProductsAnalyticsResponse,
    summary="Product & Category Performance (Admin only)",
    description="Top selling products and category sales distribution for completed orders."
)
def api_get_admin_products(
    limit: int = Query(10, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_admin_product_analytics(db=db, limit=limit)


# ============================================================================
# Vendor Analytics Endpoints (Scoped to Authenticated Vendor)
# ============================================================================

@router.get(
    "/vendor/overview",
    response_model=VendorOverviewMetrics,
    summary="Vendor KPI Overview (Approved Vendor only)",
    description="Vendor-scoped performance summary including realized revenue, units sold, and inventory counts."
)
def api_get_vendor_overview(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_vendor_overview_metrics(db=db, vendor_id=vendor.id, store_name=vendor.store_name)


@router.get(
    "/vendor/revenue",
    response_model=List[VendorRevenueTrendPoint],
    summary="Vendor Revenue Trend (Approved Vendor only)",
    description="Vendor-scoped daily revenue trend and units sold over an optional date window."
)
def api_get_vendor_revenue_trend(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD), defaults to 30 days ago"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD), defaults to today"),
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_vendor_revenue_trend(
        db=db,
        vendor_id=vendor.id,
        start_date=start_date,
        end_date=end_date
    )


@router.get(
    "/vendor/products",
    response_model=List[ProductPerformanceItem],
    summary="Vendor Products Performance (Approved Vendor only)",
    description="Performance breakdown of all products owned by the vendor including stock status and revenue."
)
def api_get_vendor_product_performance(
    vendor: VendorProfile = Depends(require_approved_vendor),
    db: Session = Depends(get_db)
):
    return get_vendor_product_performance(db=db, vendor_id=vendor.id)
