import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# 1. Customer Analytics Summary Schemas
# ============================================================================

class CustomerAnalyticsSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_customers: int = Field(..., description="Total registered customer profiles")
    active_purchasing_customers: int = Field(..., description="Customers with at least 1 completed order in window")
    inactive_customers: int = Field(..., description="Customers with 0 completed orders in window")
    total_recognized_spend: Decimal = Field(..., description="Total recognized revenue from completed orders in window")
    overall_average_order_value: Decimal = Field(..., description="Total recognized spend divided by completed order count")
    average_orders_per_active_customer: float = Field(..., description="Mean completed order count per active purchaser")
    observation_window_days: int = Field(..., description="Evaluation window duration in days")
    reference_date: datetime = Field(..., description="Timestamp used as cutoff baseline for recency calculation")


# ============================================================================
# 2. Customer RFM Detail Schemas
# ============================================================================

class CustomerRFMItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: uuid.UUID
    recency_days: Optional[int] = Field(
        None,
        description="Days since most recent completed purchase. Null if customer has no completed purchases in window."
    )
    frequency: int = Field(..., description="Number of eligible completed purchases within observation window")
    monetary_spend: Decimal = Field(..., description="Total recognized spend from eligible completed orders")
    average_order_value: Decimal = Field(..., description="Average spend per eligible completed order (0.00 if 0 orders)")
    first_order_date: Optional[datetime] = None
    last_order_date: Optional[datetime] = None
    segment_label: Optional[str] = Field(None, description="Assigned business segment label")


class CustomerRFMListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[CustomerRFMItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    observation_window_days: int


# ============================================================================
# 3. K-Means Customer Segmentation Schemas
# ============================================================================

class ClusterProfileItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cluster_id: int = Field(..., description="Numerical cluster index (or -1 for non-purchasing cohort)")
    segment_label: str = Field(..., description="Interpretable business segment label")
    description: str = Field(..., description="Characteristics and behavioral profile of this cluster")
    customer_count: int = Field(..., description="Number of customers assigned to this segment")
    percentage_of_total: float = Field(..., description="Percentage of total analyzed customer base")
    centroid_recency_days: float = Field(..., description="Mean recency in days for this cluster")
    centroid_frequency: float = Field(..., description="Mean completed orders count for this cluster")
    centroid_monetary: float = Field(..., description="Mean recognized spend ($) for this cluster")
    centroid_average_order_value: float = Field(..., description="Mean average order value ($) for this cluster")
    recommended_action: str = Field(..., description="Targeted marketing or retention strategy for this segment")


class CandidateKScore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    k: int
    inertia: float
    silhouette_score: Optional[float] = None
    davies_bouldin_index: Optional[float] = None


class CustomerSegmentationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = Field(
        ...,
        description="'SUCCESS', 'INSUFFICIENT_CUSTOMERS', 'DEGENERATE_DATA', or 'NO_PURCHASES'"
    )
    observation_window_days: int
    reference_date: datetime
    total_customers_analyzed: int
    eligible_purchasers_count: int
    selected_k: int
    selection_rationale: str
    silhouette_score: Optional[float] = Field(
        None,
        description="Silhouette coefficient on scaled feature space [-1.0, 1.0]. Higher indicates better cohesion."
    )
    davies_bouldin_index: Optional[float] = Field(
        None,
        description="Davies-Bouldin index (lower indicates better separation)."
    )
    calinski_harabasz_score: Optional[float] = Field(
        None,
        description="Calinski-Harabasz score (variance ratio criterion; higher is better)."
    )
    stability_score: Optional[float] = Field(
        None,
        description="Percentage stability across 5 random seeds using Adjusted Rand Index (0.0 to 100.0)."
    )
    target_accuracy_evaluation: str = Field(
        ...,
        description="Documentation explaining why unsupervised clustering uses Silhouette/Stability rather than a supervised 85% accuracy metric."
    )
    feature_set: List[str] = Field(
        ...,
        description="Feature transformations used: ['log1p(recency)', 'log1p(frequency)', 'log1p(monetary)', 'log1p(aov)']"
    )
    segments: List[ClusterProfileItem]
    diagnostics: Optional[List[CandidateKScore]] = None


# ============================================================================
# 4. Individual Customer Segment Lookup Schema
# ============================================================================

class CustomerMySegmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: uuid.UUID
    recency_days: Optional[int]
    frequency: int
    monetary_spend: Decimal
    average_order_value: Decimal
    segment_label: str
    segment_description: str
    recommended_action: str
