import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_

from backend.app.core.database import get_db
from backend.app.models.product import Product
from backend.app.schemas.product import ProductResponse, ProductListResponse

router = APIRouter(prefix="/products", tags=["Public Product Catalog"])


@router.get(
    "",
    response_model=ProductListResponse,
    summary="Browse public product catalog (Publicly accessible without login)"
)
def api_list_products(
    query: Optional[str] = Query(None, description="Search term in product title or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(12, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    # Only return published products in the public catalog
    stmt = (
        select(Product)
        .options(joinedload(Product.vendor))
        .where(Product.is_published.is_(True))
    )

    if category:
        stmt = stmt.where(Product.category == category.strip())

    if query:
        search_filter = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Product.title.ilike(search_filter),
                Product.description.ilike(search_filter)
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar() or 0

    # Paginate and order by newest
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Product.created_at.desc()).offset(offset).limit(page_size)
    products = db.execute(stmt).scalars().unique().all()

    items = []
    for p in products:
        item = ProductResponse.model_validate(p)
        if p.vendor:
            item.store_name = p.vendor.store_name
        items.append(item)

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="View single product details (Publicly accessible without login)"
)
def api_get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    product = db.execute(
        select(Product)
        .options(joinedload(Product.vendor))
        .where(
            Product.id == product_id,
            Product.is_published.is_(True)
        )
    ).scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    res = ProductResponse.model_validate(product)
    if product.vendor:
        res.store_name = product.vendor.store_name
    return res
