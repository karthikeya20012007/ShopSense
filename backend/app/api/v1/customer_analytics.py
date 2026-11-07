import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import require_admin, get_current_customer
from backend.app.models.customer import CustomerProfile
from backend.app.models.user import User
from backend.app.schemas.customer_analytics import (
    CustomerAnalyticsSummaryResponse,
    CustomerMySegmentResponse,
    CustomerRFMListResponse,
    CustomerSegmentationResponse,
)
from backend.app.services.customer_analytics_service import (
    get_customer_analytics_summary,
    get_customer_rfm_list,
    get_customer_segment_profile,
    segment_customers,
)

router = APIRouter(prefix="/customer-analytics", tags=["Customer Analytics & Segmentation"])


# ============================================================================
# Administrator Customer Analytics Endpoints (Marketplace-Wide)
# ============================================================================

@router.get(
    "/summary",
    response_model=CustomerAnalyticsSummaryResponse,
    summary="Platform Customer Analytics KPI Summary (Admin only)",
    description="Aggregate customer spend, purchasing customer counts, and average order metrics."
)
def api_get_customer_analytics_summary(
    observation_window_days: int = Query(365, ge=1, le=730, description="Evaluation observation window in days"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_customer_analytics_summary(
        db=db,
        observation_window_days=observation_window_days
    )


@router.get(
    "/rfm",
    response_model=CustomerRFMListResponse,
    summary="Customer RFM Table (Admin only)",
    description="Paginated list of customer Recency, Frequency, Monetary, and AOV scores."
)
def api_get_customer_rfm_list(
    observation_window_days: int = Query(365, ge=1, le=730, description="Evaluation observation window in days"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return get_customer_rfm_list(
        db=db,
        observation_window_days=observation_window_days,
        page=page,
        page_size=page_size
    )


@router.get(
    "/segments",
    response_model=CustomerSegmentationResponse,
    summary="K-Means Customer Segmentation (Admin only)",
    description="Executes reproducible K-Means RFM customer segmentation with Silhouette and Stability metrics."
)
def api_get_customer_segments(
    observation_window_days: int = Query(365, ge=1, le=730, description="Evaluation window in days"),
    target_k: Optional[int] = Query(None, ge=2, le=6, description="Optional target cluster count"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return segment_customers(
        db=db,
        observation_window_days=observation_window_days,
        target_k=target_k
    )


# ============================================================================
# Customer-Facing Segment Endpoint (Scoped to Authenticated Customer)
# ============================================================================

@router.get(
    "/my-segment",
    response_model=CustomerMySegmentResponse,
    summary="My Customer Segment Profile (Customer only)",
    description="Returns the authenticated customer's own RFM metrics, segment label, and recommended action."
)
def api_get_my_segment(
    customer: CustomerProfile = Depends(get_current_customer),
    observation_window_days: int = Query(365, ge=1, le=730, description="Evaluation window in days"),
    db: Session = Depends(get_db)
):
    return get_customer_segment_profile(
        db=db,
        customer_id=customer.id,
        observation_window_days=observation_window_days
    )
