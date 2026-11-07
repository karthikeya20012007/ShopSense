import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# 1. Recommended Product Item & Catalog Response
# ============================================================================

class RecommendedProductItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    title: str
    sku: str
    price: Decimal
    category: str
    vendor_id: uuid.UUID
    score: float = Field(..., description="Hybrid recommendation score normalized in [0.0, 1.0]")
    recommendation_reason: str = Field(..., description="Interpretable explanation for why this item was suggested")
    stock_quantity: int = Field(..., description="Available inventory units")


class ProductRecommendationsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scenario: str = Field(
        ...,
        description="'PERSONALIZED', 'SIMILAR_PRODUCTS', 'POPULAR_BESTSELLERS', or 'COLD_START_FALLBACK'"
    )
    total_returned: int
    items: List[RecommendedProductItem]
    reference_product_id: Optional[uuid.UUID] = None
    notes: str


# ============================================================================
# 2. Recommendation Offline Evaluation Diagnostics
# ============================================================================

class RecommendationEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    k: int = Field(..., description="Top-K cutoff for evaluation (e.g. 5)")
    train_orders_count: int
    test_orders_count: int
    evaluated_customers_count: int = Field(
        ...,
        description="Customers with qualifying purchases in both train and test partitions"
    )
    hybrid_exact_hit_rate: float = Field(
        ...,
        description="Percentage of evaluated customers whose held-out test purchase was in Top-K (0.0 to 100.0%)"
    )
    hybrid_exact_precision: float = Field(
        ...,
        description="Average Precision@K of exact product matches across evaluated customers (0.0 to 100.0%)"
    )
    hybrid_category_hit_rate: float = Field(
        ...,
        description="Percentage of evaluated customers with at least one Top-K recommendation matching their test category"
    )
    popularity_exact_hit_rate: float = Field(
        ...,
        description="Exact Hit Rate@K for the non-personalized Popularity baseline"
    )
    popularity_category_hit_rate: float = Field(
        ...,
        description="Category-aligned Hit Rate@K for the Popularity baseline"
    )
    lift_over_popularity: float = Field(
        ...,
        description="Relative percentage lift of Hybrid Hit Rate over Popularity baseline"
    )
    methodology: str
    target_relevance_analysis: str = Field(
        ...,
        description="Scientific analysis explaining measured metrics and distinguishing exact SKU retrieval from category relevance"
    )
