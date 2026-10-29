import uuid
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.app.models.customer import CustomerProfile
from backend.app.models.enums import OrderStatus
from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.schemas.order import (
    CheckoutRequest,
    OrderItemResponse,
    OrderResponse,
    VendorOrderResponse,
    VendorOrderItemResponse,
)


def checkout_order(
    db: Session,
    customer: CustomerProfile,
    checkout_data: CheckoutRequest
) -> Order:
    """
    Executes an atomic checkout transaction for an authenticated customer:
    1. Validates all requested products and quantities.
    2. Acquires row-level exclusive locks (FOR UPDATE) in consistent Product.id order
       to eliminate concurrency deadlocks.
    3. Verifies stock availability and publication status.
    4. Computes server-authoritative pricing (snapshots unit price and line subtotal).
    5. Atomically decrements inventory.
    6. Persists Order and OrderItems in a single transaction boundary with rollback on failure.
    """
    # 1. Aggregate requested quantities by product_id
    requested_quantities: Dict[uuid.UUID, int] = {}
    for item in checkout_data.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Item quantity must be a positive integer."
            )
        requested_quantities[item.product_id] = (
            requested_quantities.get(item.product_id, 0) + item.quantity
        )

    if not requested_quantities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout requires at least one valid item."
        )

    # 2. Sort product IDs to guarantee deterministic lock acquisition order (deadlock prevention)
    sorted_product_ids = sorted(requested_quantities.keys())

    # 3. Query products with row-level locking (FOR UPDATE)
    try:
        stmt = (
            select(Product)
            .where(Product.id.in_(sorted_product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
        )
        products = db.execute(stmt).scalars().all()
    except Exception as e:

        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while locking product inventory."
        )

    products_by_id = {p.id: p for p in products}

    # 4. Validate that all requested products exist
    missing_ids = [pid for pid in sorted_product_ids if pid not in products_by_id]
    if missing_ids:
        db.rollback()
        missing_str = ", ".join(str(m) for m in missing_ids)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product(s) not found: {missing_str}"
        )

    # 5. Validate publication status and inventory
    for pid in sorted_product_ids:
        product = products_by_id[pid]
        if not product.is_published:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{product.title}' is unpublished and unavailable for purchase."
            )

        requested_qty = requested_quantities[pid]
        if product.stock_quantity < requested_qty:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient inventory for product '{product.title}'. "
                    f"Requested: {requested_qty}, Available: {product.stock_quantity}."
                )
            )


    # 6. Calculate subtotals, order total, and decrement stock
    order_items: List[OrderItem] = []
    order_total = Decimal("0.00")

    for pid in sorted_product_ids:
        product = products_by_id[pid]
        qty = requested_quantities[pid]
        unit_price = product.price
        subtotal = (unit_price * qty).quantize(Decimal("0.01"))
        order_total += subtotal

        # Decrement stock inside the locked transaction
        product.stock_quantity -= qty

        order_item = OrderItem(
            product_id=product.id,
            vendor_id=product.vendor_id,
            quantity=qty,
            unit_price=unit_price,
            subtotal=subtotal
        )
        order_items.append(order_item)

    order_total = order_total.quantize(Decimal("0.01"))

    # 7. Create Order with OrderStatus.PENDING (payment separation)
    order = Order(
        customer_id=customer.id,
        status=OrderStatus.PENDING,
        total_amount=order_total,
        items=order_items
    )

    try:
        db.add(order)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while finalizing the order."
        )

    # 8. Reload order with relationships for response construction
    refreshed_order = db.execute(
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.vendor)
        )
        .where(Order.id == order.id)
    ).unique().scalar_one()

    return refreshed_order


def build_order_response(order: Order) -> OrderResponse:
    """Format an Order ORM instance into an OrderResponse schema."""
    item_responses = []
    for item in order.items:
        item_responses.append(
            OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_title=item.product.title if item.product else None,
                vendor_id=item.vendor_id,
                store_name=item.vendor.store_name if item.vendor else None,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
                created_at=item.created_at
            )
        )

    return OrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        status=order.status,
        total_amount=order.total_amount,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=item_responses
    )


def get_customer_orders(db: Session, customer_id: uuid.UUID) -> List[OrderResponse]:
    """Retrieve all orders placed by the customer, ordered by newest first."""
    stmt = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.vendor)
        )
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
    )
    orders = db.execute(stmt).scalars().unique().all()
    return [build_order_response(o) for o in orders]


def get_order_by_id(db: Session, order_id: uuid.UUID) -> Optional[Order]:
    """Retrieve an order by ID with all item relationships."""
    stmt = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.vendor)
        )
        .where(Order.id == order_id)
    )
    return db.execute(stmt).scalars().unique().one_or_none()


def get_vendor_orders(db: Session, vendor_id: uuid.UUID) -> List[VendorOrderResponse]:
    """
    Retrieve orders containing items sold by the specified vendor.
    Guarantees vendor isolation: ONLY items belonging to this vendor are included.
    Other vendors' items and customer details are restricted.
    """
    stmt = (
        select(OrderItem)
        .options(
            joinedload(OrderItem.order),
            joinedload(OrderItem.product)
        )
        .where(OrderItem.vendor_id == vendor_id)
        .order_by(OrderItem.created_at.desc())
    )
    items = db.execute(stmt).scalars().all()

    # Group items by order
    orders_map: Dict[uuid.UUID, Dict] = {}
    for item in items:
        oid = item.order_id
        if oid not in orders_map:
            orders_map[oid] = {
                "order_id": oid,
                "customer_id": item.order.customer_id,
                "status": item.order.status,
                "created_at": item.order.created_at,
                "vendor_items_total": Decimal("0.00"),
                "items": []
            }
        item_resp = VendorOrderItemResponse(
            id=item.id,
            order_id=item.order_id,
            product_id=item.product_id,
            product_title=item.product.title if item.product else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            created_at=item.created_at
        )
        orders_map[oid]["items"].append(item_resp)
        orders_map[oid]["vendor_items_total"] += item.subtotal

    result = [
        VendorOrderResponse(
            order_id=data["order_id"],
            customer_id=data["customer_id"],
            status=data["status"],
            created_at=data["created_at"],
            vendor_items_total=data["vendor_items_total"].quantize(Decimal("0.01")),
            items=data["items"]
        )
        for data in sorted(orders_map.values(), key=lambda x: x["created_at"], reverse=True)
    ]
    return result


def get_all_orders_admin(
    db: Session,
    status_filter: Optional[OrderStatus] = None,
    limit: int = 50,
    offset: int = 0
) -> List[OrderResponse]:
    """Admin-only view of all marketplace orders."""
    stmt = (
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.vendor)
        )
    )
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    stmt = stmt.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    orders = db.execute(stmt).scalars().unique().all()
    return [build_order_response(o) for o in orders]


VALID_ORDER_STATUS_TRANSITIONS: Dict[OrderStatus, set] = {
    OrderStatus.PENDING: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: {OrderStatus.REFUNDED},
    OrderStatus.CANCELLED: set(),
    OrderStatus.REFUNDED: set(),
}


def update_order_status(
    db: Session,
    order_id: uuid.UUID,
    new_status: OrderStatus
) -> OrderResponse:
    """
    Updates order status within an explicit transaction with state transition guards
    and atomic stock restoration for cancellations.
    """
    # 1. Lock the order row to serialize concurrent status updates
    order = db.execute(
        select(Order)
        .where(Order.id == order_id)
        .with_for_update()
    ).scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )

    # 2. Check terminal state and valid transitions
    if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition order in terminal state '{order.status.value}'."
        )

    allowed = VALID_ORDER_STATUS_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{order.status.value}' to '{new_status.value}'."
        )

    # 3. If transitioning from PENDING to CANCELLED, atomically restore inventory
    try:
        if order.status == OrderStatus.PENDING and new_status == OrderStatus.CANCELLED:
            # Aggregate quantities to restore per product
            restore_map: Dict[uuid.UUID, int] = {}
            for item in order.items:
                restore_map[item.product_id] = restore_map.get(item.product_id, 0) + item.quantity

            if restore_map:
                # Deterministic sorting to prevent deadlocks
                sorted_pids = sorted(restore_map.keys())
                stmt = (
                    select(Product)
                    .where(Product.id.in_(sorted_pids))
                    .order_by(Product.id.asc())
                    .with_for_update()
                )
                products = db.execute(stmt).scalars().all()
                products_by_id = {p.id: p for p in products}

                for pid in sorted_pids:
                    if pid in products_by_id:
                        products_by_id[pid].stock_quantity += restore_map[pid]

        order.status = new_status
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating order status."
        )

    # 4. Reload order with relationships for response construction
    refreshed_order = db.execute(
        select(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.vendor)
        )
        .where(Order.id == order.id)
    ).unique().scalar_one()

    return build_order_response(refreshed_order)


