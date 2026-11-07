import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.dependencies import get_current_customer, require_admin
from backend.app.models.customer import CustomerProfile
from backend.app.models.user import User
from backend.app.schemas.recommendation import (
    ProductRecommendationsResponse,
    RecommendationEvaluationResponse,
)
from backend.app.services.recommendation_service import (
    evaluate_recommendation_quality,
    get_personalized_recommendations,
    get_popular_products,
    get_similar_products,
)

router = APIRouter(prefix="/recommendations", tags=["Product Recommendations"])


# ============================================================================
# 1. Customer-Specific Personalized Recommendations
# ============================================================================

@router.get(
    "/for-me",
    response_model=ProductRecommendationsResponse,
    summary="Personalized Product Recommendations (Customer only)",
    description="Generates tailored recommendations based on customer's completed order history and category affinity."
)
def api_get_personalized_recommendations(
    limit: int = Query(10, ge=1, le=50, description="Maximum items to return"),
    exclude_purchased: bool = Query(True, description="Whether to exclude already purchased products"),
    customer: CustomerProfile = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    return get_personalized_recommendations(
        db=db,
        customer_id=customer.id,
        limit=limit,
        exclude_previously_purchased=exclude_purchased
    )


# ============================================================================
# 2. Public Catalog Similar Products Endpoint
# ============================================================================

@router.get(
    "/products/{product_id}/similar",
    response_model=ProductRecommendationsResponse,
    summary="Similar Products (Public)",
    description="Hybrid item-item similarity combining collaborative co-purchases, category match, and popularity."
)
def api_get_similar_products(
    product_id: uuid.UUID,
    limit: int = Query(10, ge=1, le=50, description="Maximum items to return"),
    db: Session = Depends(get_db)
):
    return get_similar_products(
        db=db,
        product_id=product_id,
        limit=limit
    )


# ============================================================================
# 3. Public Catalog Popular Products Endpoint
# ============================================================================

@router.get(
    "/popular",
    response_model=ProductRecommendationsResponse,
    summary="Popular Products / Best Sellers (Public)",
    description="Marketplace-wide or scoped bestseller ranking based on completed order sales volume."
)
def api_get_popular_products(
    limit: int = Query(10, ge=1, le=50, description="Maximum items to return"),
    vendor_id: Optional[uuid.UUID] = Query(None, description="Optional vendor filter"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db)
):
    return get_popular_products(
        db=db,
        limit=limit,
        vendor_id=vendor_id,
        category=category,
        published_only=True
    )


# ============================================================================
# 4. Administrator Offline Evaluation Endpoint
# ============================================================================

@router.get(
    "/evaluation",
    response_model=RecommendationEvaluationResponse,
    summary="Offline Recommendation Quality Evaluation (Admin only)",
    description="Executes a leak-free chronological 80/20 train/test evaluation of Hit Rate@K, Precision@K, and lift."
)
def api_get_recommendation_evaluation(
    k: int = Query(5, ge=1, le=20, description="Top-K cutoff for evaluation"),
    train_ratio: float = Query(0.8, ge=0.5, le=0.9, description="Chronological train partition ratio"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return evaluate_recommendation_quality(
        db=db,
        k=k,
        train_ratio=train_ratio
    )
