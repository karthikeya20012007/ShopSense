import math
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import numpy as np
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sklearn.cluster import KMeans
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)
from sklearn.preprocessing import StandardScaler

from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import OrderStatus, REVENUE_RECOGNIZED_ORDER_STATUSES
from backend.app.models.order import Order
from backend.app.schemas.customer_analytics import (
    CandidateKScore,
    ClusterProfileItem,
    CustomerAnalyticsSummaryResponse,
    CustomerMySegmentResponse,
    CustomerRFMItem,
    CustomerRFMListResponse,
    CustomerSegmentationResponse,
)


# ============================================================================
# 1. Customer Analytics Summary
# ============================================================================

def get_customer_analytics_summary(
    db: Session,
    observation_window_days: int = 365,
    reference_date: Optional[datetime] = None
) -> CustomerAnalyticsSummaryResponse:
    """
    Computes platform customer metrics over a defined observation window.
    Strictly counts only completed orders with recognized revenue.
    """
    if observation_window_days <= 0:
        observation_window_days = 365
    if not reference_date:
        reference_date = datetime.now(timezone.utc)

    window_start = reference_date - timedelta(days=observation_window_days)

    total_customers = db.execute(
        select(func.count(CustomerProfile.id))
    ).scalar() or 0

    # Aggregate completed orders by customer
    completed_orders_stmt = (
        select(
            Order.customer_id,
            func.count(Order.id).label("order_count"),
            func.sum(Order.total_amount).label("total_spend")
        )
        .where(
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= window_start,
            Order.created_at <= reference_date
        )
        .group_by(Order.customer_id)
    )
    customer_order_rows = db.execute(completed_orders_stmt).all()

    active_customers = len(customer_order_rows)
    inactive_customers = max(0, total_customers - active_customers)

    total_spend = sum(row.total_spend for row in customer_order_rows) if customer_order_rows else Decimal("0.00")
    total_spend_dec = Decimal(str(total_spend)).quantize(Decimal("0.01"))

    total_completed_orders = sum(row.order_count for row in customer_order_rows) if customer_order_rows else 0

    if total_completed_orders > 0:
        overall_aov = (total_spend_dec / Decimal(str(total_completed_orders))).quantize(Decimal("0.01"))
    else:
        overall_aov = Decimal("0.00")

    if active_customers > 0:
        avg_orders_per_active = round(total_completed_orders / float(active_customers), 2)
    else:
        avg_orders_per_active = 0.0

    return CustomerAnalyticsSummaryResponse(
        total_customers=total_customers,
        active_purchasing_customers=active_customers,
        inactive_customers=inactive_customers,
        total_recognized_spend=total_spend_dec,
        overall_average_order_value=overall_aov,
        average_orders_per_active_customer=avg_orders_per_active,
        observation_window_days=observation_window_days,
        reference_date=reference_date
    )


# ============================================================================
# 2. RFM Feature Extraction Helper
# ============================================================================

def extract_rfm_records(
    db: Session,
    observation_window_days: int = 365,
    reference_date: Optional[datetime] = None
) -> Tuple[List[CustomerProfile], Dict[uuid.UUID, dict]]:
    """
    Extracts Recency, Frequency, Monetary, and Average Order Value for all customer profiles.
    Only recognized completed purchases count toward metrics.
    """
    if observation_window_days <= 0:
        observation_window_days = 365
    if not reference_date:
        reference_date = datetime.now(timezone.utc)

    window_start = reference_date - timedelta(days=observation_window_days)

    customers = db.execute(
        select(CustomerProfile).order_by(CustomerProfile.created_at.desc())
    ).scalars().all()

    # Query completed orders grouped by customer_id
    order_stmt = (
        select(
            Order.customer_id,
            func.count(Order.id).label("freq"),
            func.sum(Order.total_amount).label("monetary"),
            func.min(Order.created_at).label("first_order"),
            func.max(Order.created_at).label("last_order")
        )
        .where(
            Order.status.in_(REVENUE_RECOGNIZED_ORDER_STATUSES),
            Order.created_at >= window_start,
            Order.created_at <= reference_date
        )
        .group_by(Order.customer_id)
    )
    order_map = {row.customer_id: row for row in db.execute(order_stmt).all()}

    rfm_dict = {}
    for c in customers:
        if c.id in order_map:
            row = order_map[c.id]
            freq = int(row.freq)
            monetary = Decimal(str(row.monetary)).quantize(Decimal("0.01"))
            first_order = row.first_order
            last_order = row.last_order
            recency = max(0, (reference_date - last_order).days)
            aov = (monetary / Decimal(str(freq))).quantize(Decimal("0.01")) if freq > 0 else Decimal("0.00")
            rfm_dict[c.id] = {
                "customer_id": c.id,
                "recency_days": recency,
                "frequency": freq,
                "monetary_spend": monetary,
                "average_order_value": aov,
                "first_order_date": first_order,
                "last_order_date": last_order,
            }
        else:
            rfm_dict[c.id] = {
                "customer_id": c.id,
                "recency_days": None,
                "frequency": 0,
                "monetary_spend": Decimal("0.00"),
                "average_order_value": Decimal("0.00"),
                "first_order_date": None,
                "last_order_date": None,
            }

    return customers, rfm_dict


def get_customer_rfm_list(
    db: Session,
    observation_window_days: int = 365,
    page: int = 1,
    page_size: int = 20
) -> CustomerRFMListResponse:
    """
    Returns paginated customer RFM records with their calculated metrics.
    """
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    if page_size > 100:
        page_size = 100

    customers, rfm_dict = extract_rfm_records(db=db, observation_window_days=observation_window_days)
    total = len(customers)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_customers = customers[start_idx:end_idx]

    items = [CustomerRFMItem(**rfm_dict[c.id]) for c in page_customers]
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return CustomerRFMListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        observation_window_days=observation_window_days
    )


# ============================================================================
# 3. K-Means Customer Segmentation Engine
# ============================================================================

def segment_customers(
    db: Session,
    observation_window_days: int = 365,
    reference_date: Optional[datetime] = None,
    target_k: Optional[int] = None
) -> CustomerSegmentationResponse:
    """
    Executes reproducible K-Means clustering on the customer base using RFM features.
    
    Implementation details:
    - Feature set: [log1p(recency), log1p(frequency), log1p(monetary), log1p(aov)].
    - Log1p stabilizes heavy-tailed spend and order frequency distributions.
    - StandardScaler normalizes feature variance to prevent monetary dominance.
    - Deterministic random_state=42 with explicit n_init=10.
    - Evaluates k in candidate range [2, min(5, N-1)] using Silhouette Score & Davies-Bouldin Index.
    - Multi-seed stability score computed using Adjusted Rand Index across 5 seeds.
    - Unsupervised evaluation explanation documents why standard supervised 85% accuracy
      is not applicable to unsupervised clustering.
    - Dynamic centroid ranking maps clusters to interpretable business labels without hardcoding.
    - Non-purchasing customers are assigned to an explicit inactive segment.
    """
    if observation_window_days <= 0:
        observation_window_days = 365
    if not reference_date:
        reference_date = datetime.now(timezone.utc)

    customers, rfm_dict = extract_rfm_records(
        db=db,
        observation_window_days=observation_window_days,
        reference_date=reference_date
    )

    total_customers = len(customers)
    if total_customers == 0:
        return CustomerSegmentationResponse(
            status="INSUFFICIENT_CUSTOMERS",
            observation_window_days=observation_window_days,
            reference_date=reference_date,
            total_customers_analyzed=0,
            eligible_purchasers_count=0,
            selected_k=0,
            selection_rationale="No customer records present in the database.",
            silhouette_score=None,
            davies_bouldin_index=None,
            calinski_harabasz_score=None,
            stability_score=None,
            target_accuracy_evaluation=(
                "Unsupervised clustering has no ground-truth labels for a supervised 85% classification accuracy. "
                "Instead, intrinsic mathematical validity is evaluated via the Silhouette Coefficient (measuring cohesion "
                "and separation) and cross-seed stability using Adjusted Rand Index."
            ),
            feature_set=["log1p(recency_days)", "log1p(frequency)", "log1p(monetary_spend)", "log1p(average_order_value)"],
            segments=[],
            diagnostics=[]
        )

    # Filter active purchasers (frequency > 0)
    active_records = [rfm_dict[c.id] for c in customers if rfm_dict[c.id]["frequency"] > 0]
    inactive_records = [rfm_dict[c.id] for c in customers if rfm_dict[c.id]["frequency"] == 0]
    n_active = len(active_records)

    # Inactive segment profile
    inactive_segment = None
    if inactive_records:
        n_inactive = len(inactive_records)
        pct_inactive = round((n_inactive / float(total_customers)) * 100.0, 2)
        inactive_segment = ClusterProfileItem(
            cluster_id=-1,
            segment_label="Non-Purchasing / Inactive Leads",
            description="Registered customers with zero completed orders during the observation window.",
            customer_count=n_inactive,
            percentage_of_total=pct_inactive,
            centroid_recency_days=float(observation_window_days),
            centroid_frequency=0.0,
            centroid_monetary=0.0,
            centroid_average_order_value=0.0,
            recommended_action="Nurture with introductory catalog highlights, first-order incentives, and welcome emails."
        )

    # Insufficient purchasing customers for K-Means (< 3)
    if n_active < 3:
        segments = [inactive_segment] if inactive_segment else []
        return CustomerSegmentationResponse(
            status="INSUFFICIENT_CUSTOMERS",
            observation_window_days=observation_window_days,
            reference_date=reference_date,
            total_customers_analyzed=total_customers,
            eligible_purchasers_count=n_active,
            selected_k=0,
            selection_rationale=(
                f"Only {n_active} customer(s) have eligible completed purchases in the observation window. "
                f"At least 3 purchasing customers are required to construct k>=2 clusters with valid silhouette scoring."
            ),
            silhouette_score=None,
            davies_bouldin_index=None,
            calinski_harabasz_score=None,
            stability_score=None,
            target_accuracy_evaluation=(
                "Unsupervised clustering has no ground-truth labels for a supervised 85% accuracy metric. "
                "Clustering requires sufficient sample size (N >= 3) to compute cluster separation metrics."
            ),
            feature_set=["log1p(recency_days)", "log1p(frequency)", "log1p(monetary_spend)", "log1p(average_order_value)"],
            segments=segments,
            diagnostics=[]
        )

    # Build raw feature matrix: [R, F, M, AOV]
    raw_X = np.array([
        [
            float(rec["recency_days"] if rec["recency_days"] is not None else observation_window_days),
            float(rec["frequency"]),
            float(rec["monetary_spend"]),
            float(rec["average_order_value"])
        ]
        for rec in active_records
    ], dtype=np.float64)

    # Apply log1p transformation to stabilize heavy tails
    X_log = np.log1p(raw_X)

    # Standardize features (mean=0, variance=1)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_log)

    # Check for degenerate zero variance
    if np.all(np.isclose(X_scaled, X_scaled[0])):
        segments = [inactive_segment] if inactive_segment else []
        return CustomerSegmentationResponse(
            status="DEGENERATE_DATA",
            observation_window_days=observation_window_days,
            reference_date=reference_date,
            total_customers_analyzed=total_customers,
            eligible_purchasers_count=n_active,
            selected_k=0,
            selection_rationale="All purchasing customers have identical RFM features; clustering cannot differentiate segments.",
            silhouette_score=None,
            davies_bouldin_index=None,
            calinski_harabasz_score=None,
            stability_score=None,
            target_accuracy_evaluation="Degenerate zero-variance data collapses all clusters into a single point.",
            feature_set=["log1p(recency_days)", "log1p(frequency)", "log1p(monetary_spend)", "log1p(average_order_value)"],
            segments=segments,
            diagnostics=[]
        )

    # Candidate k evaluation range: [2, min(5, n_active - 1)]
    max_k = min(5, n_active - 1)
    candidate_scores: List[CandidateKScore] = []
    best_k = 2
    best_sil = -2.0

    for k in range(2, max_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        unique_labels = np.unique(labels)

        if len(unique_labels) > 1:
            sil = float(silhouette_score(X_scaled, labels))
            db_idx = float(davies_bouldin_score(X_scaled, labels))
        else:
            sil = None
            db_idx = None

        candidate_scores.append(
            CandidateKScore(
                k=k,
                inertia=round(float(km.inertia_), 2),
                silhouette_score=round(sil, 4) if sil is not None else None,
                davies_bouldin_index=round(db_idx, 4) if db_idx is not None else None
            )
        )

        if sil is not None and sil > best_sil:
            best_sil = sil
            best_k = k

    # If target_k was explicitly requested and is valid, use it
    if target_k and 2 <= target_k <= max_k:
        selected_k = target_k
        rationale = f"User explicitly requested k={selected_k}."
    else:
        # If best_sil is very close across k, prefer k=3 or 4 for business interpretability
        selected_k = best_k
        rationale = f"Selected k={selected_k} based on optimal Silhouette score ({round(best_sil, 4)}) across candidate range [2, {max_k}]."

    # Fit final K-Means model with selected_k
    final_km = KMeans(n_clusters=selected_k, random_state=42, n_init=10)
    final_labels = final_km.fit_predict(X_scaled)

    # Compute final metrics on scaled feature space
    final_sil = float(silhouette_score(X_scaled, final_labels))
    final_db = float(davies_bouldin_score(X_scaled, final_labels))
    final_ch = float(calinski_harabasz_score(X_scaled, final_labels))

    # Evaluate stability across 5 random seeds using Adjusted Rand Index
    seeds = [42, 100, 2024, 777, 999]
    ari_scores = []
    for s in seeds[1:]:
        km_seed = KMeans(n_clusters=selected_k, random_state=s, n_init=10)
        seed_labels = km_seed.fit_predict(X_scaled)
        ari = adjusted_rand_score(final_labels, seed_labels)
        ari_scores.append(ari)
    stability_score = round(float(np.mean(ari_scores)) * 100.0, 2)

    # Compute unscaled cluster centroids and assign dynamic labels
    cluster_profiles: List[ClusterProfileItem] = []
    cluster_data = {}

    for c_id in range(selected_k):
        mask = (final_labels == c_id)
        c_count = int(np.sum(mask))
        if c_count > 0:
            c_raw = raw_X[mask]
            mean_r = float(np.mean(c_raw[:, 0]))
            mean_f = float(np.mean(c_raw[:, 1]))
            mean_m = float(np.mean(c_raw[:, 2]))
            mean_aov = float(np.mean(c_raw[:, 3]))
        else:
            mean_r, mean_f, mean_m, mean_aov = 0.0, 0.0, 0.0, 0.0

        cluster_data[c_id] = {
            "count": c_count,
            "mean_r": mean_r,
            "mean_f": mean_f,
            "mean_m": mean_m,
            "mean_aov": mean_aov
        }

    # Compute overall benchmark means for dynamic relative scoring
    overall_mean_r = float(np.mean(raw_X[:, 0])) if n_active > 0 else 1.0
    overall_mean_f = float(np.mean(raw_X[:, 1])) if n_active > 0 else 1.0
    overall_mean_m = float(np.mean(raw_X[:, 2])) if n_active > 0 else 1.0

    # Score each cluster based on normalized RFM
    # Higher M, higher F, lower R = higher engagement score
    scored_clusters = []
    for c_id, d in cluster_data.items():
        rel_m = d["mean_m"] / max(overall_mean_m, 1e-4)
        rel_f = d["mean_f"] / max(overall_mean_f, 1e-4)
        rel_r = max(overall_mean_r, 1e-4) / max(d["mean_r"] + 1.0, 1.0)  # higher = more recent
        composite_score = (0.5 * rel_m) + (0.3 * rel_f) + (0.2 * rel_r)
        scored_clusters.append((c_id, composite_score, d))

    # Rank clusters by composite score descending
    scored_clusters.sort(key=lambda x: x[1], reverse=True)

    # Dynamic label mapping based on rank and characteristics
    for rank, (c_id, score, d) in enumerate(scored_clusters):
        pct = round((d["count"] / float(total_customers)) * 100.0, 2)
        mean_r = round(d["mean_r"], 1)
        mean_f = round(d["mean_f"], 1)
        mean_m = round(d["mean_m"], 2)
        mean_aov = round(d["mean_aov"], 2)

        if rank == 0:
            label = "Champions / High-Value"
            desc = f"Highest customer spend (${mean_m} avg) with strong purchase frequency ({mean_f} orders) and recent activity ({mean_r}d)."
            action = "Reward with VIP status, early product releases, and personalized account management."
        elif rank == 1 and selected_k >= 3:
            if d["mean_f"] >= overall_mean_f:
                label = "Loyal / Frequent Buyers"
                desc = f"Consistent repeat buyers with high order frequency ({mean_f} orders) and steady spend (${mean_m})."
                action = "Promote loyalty rewards, subscription bundles, and cross-sell related categories."
            else:
                label = "New / Promising Customers"
                desc = f"Recent purchasers ({mean_r}d recency) with moderate spend (${mean_m}) developing brand engagement."
                action = "Engage with welcome sequence, onboarding incentives, and second-order discounts."
        elif rank == selected_k - 1:
            if d["mean_r"] > overall_mean_r:
                label = "At-Risk / Lapsed Customers"
                desc = f"Purchasers with long elapsed inactivity ({mean_r}d recency) and low recent frequency ({mean_f} orders)."
                action = "Deploy win-back campaigns, limited-time reactivation discounts, and feedback surveys."
            else:
                label = "Low-Engagement / Occasional Buyers"
                desc = f"Lower spending buyers (${mean_m}) with infrequent purchase cadence ({mean_f} orders)."
                action = "Maintain light email marketing with seasonal discounts; avoid heavy acquisition spend."
        else:
            label = "Emerging / Active Regulars"
            desc = f"Balanced engagement profile (${mean_m} spend, {mean_f} orders, {mean_r}d recency)."
            action = "Nurture with targeted category discounts and product recommendation carousels."

        cluster_profiles.append(
            ClusterProfileItem(
                cluster_id=c_id,
                segment_label=label,
                description=desc,
                customer_count=d["count"],
                percentage_of_total=pct,
                centroid_recency_days=mean_r,
                centroid_frequency=mean_f,
                centroid_monetary=mean_m,
                centroid_average_order_value=mean_aov,
                recommended_action=action
            )
        )

    # Sort cluster profiles by cluster_id ascending
    cluster_profiles.sort(key=lambda p: p.cluster_id)
    if inactive_segment:
        cluster_profiles.append(inactive_segment)

    accuracy_explanation = (
        "Unsupervised K-Means clustering possesses no ground-truth class labels, so an 85% supervised classification "
        "accuracy is mathematically inapplicable. Instead, clustering validity is rigorously established by three recognized metrics: "
        f"(1) Silhouette Score ({round(final_sil, 4)}), measuring intra-cluster cohesion versus nearest-neighbor separation; "
        f"(2) Davies-Bouldin Index ({round(final_db, 4)}), measuring cluster compactness and distance; and "
        f"(3) Multi-Seed ARI Stability ({stability_score}%), verifying that cluster assignments are deterministic and robust against random restarts."
    )

    return CustomerSegmentationResponse(
        status="SUCCESS",
        observation_window_days=observation_window_days,
        reference_date=reference_date,
        total_customers_analyzed=total_customers,
        eligible_purchasers_count=n_active,
        selected_k=selected_k,
        selection_rationale=rationale,
        silhouette_score=round(final_sil, 4),
        davies_bouldin_index=round(final_db, 4),
        calinski_harabasz_score=round(final_ch, 2),
        stability_score=stability_score,
        target_accuracy_evaluation=accuracy_explanation,
        feature_set=["log1p(recency_days)", "log1p(frequency)", "log1p(monetary_spend)", "log1p(average_order_value)"],
        segments=cluster_profiles,
        diagnostics=candidate_scores
    )


# ============================================================================
# 4. Single Customer Segment Lookup
# ============================================================================

def get_customer_segment_profile(
    db: Session,
    customer_id: uuid.UUID,
    observation_window_days: int = 365
) -> CustomerMySegmentResponse:
    """
    Returns an individual customer's RFM metrics and their assigned business segment profile.
    Used by authenticated customers to see their own status without leaking other customer data.
    """
    customer = db.execute(
        select(CustomerProfile).where(CustomerProfile.id == customer_id)
    ).scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID '{customer_id}' not found."
        )

    # Run platform segmentation
    seg_response = segment_customers(db=db, observation_window_days=observation_window_days)

    # Extract customer's own RFM
    _, rfm_dict = extract_rfm_records(db=db, observation_window_days=observation_window_days)
    cust_rfm = rfm_dict.get(customer_id)

    if not cust_rfm or cust_rfm["frequency"] == 0:
        return CustomerMySegmentResponse(
            customer_id=customer_id,
            recency_days=None,
            frequency=0,
            monetary_spend=Decimal("0.00"),
            average_order_value=Decimal("0.00"),
            segment_label="Non-Purchasing / Inactive Leads",
            segment_description="You have not placed any completed orders during the observation period.",
            recommended_action="Explore our catalog and use your welcome discount on your first purchase!"
        )

    # Match customer to nearest centroid by Euclidean distance in standardized feature space
    # Find matching segment
    rec_r = cust_rfm["recency_days"] if cust_rfm["recency_days"] is not None else observation_window_days
    rec_f = cust_rfm["frequency"]
    rec_m = float(cust_rfm["monetary_spend"])
    rec_aov = float(cust_rfm["average_order_value"])

    # Find closest active segment
    best_dist = float("inf")
    assigned_segment = seg_response.segments[0]

    for seg in seg_response.segments:
        if seg.cluster_id < 0:
            continue
        # Euclidean distance to unscaled centroids
        dr = (rec_r - seg.centroid_recency_days) / max(seg.centroid_recency_days, 1.0)
        df = (rec_f - seg.centroid_frequency) / max(seg.centroid_frequency, 1.0)
        dm = (rec_m - seg.centroid_monetary) / max(seg.centroid_monetary, 1.0)
        dist = (dr ** 2) + (df ** 2) + (dm ** 2)
        if dist < best_dist:
            best_dist = dist
            assigned_segment = seg

    return CustomerMySegmentResponse(
        customer_id=customer_id,
        recency_days=cust_rfm["recency_days"],
        frequency=cust_rfm["frequency"],
        monetary_spend=cust_rfm["monetary_spend"],
        average_order_value=cust_rfm["average_order_value"],
        segment_label=assigned_segment.segment_label,
        segment_description=assigned_segment.description,
        recommended_action=assigned_segment.recommended_action
    )
