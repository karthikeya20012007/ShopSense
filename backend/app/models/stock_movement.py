import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base
from backend.app.models.enums import StockMovementType


class StockMovement(Base):
    """
    Append-only inventory audit ledger recording all stock level adjustments:
    checkout decrements, cancellation restocks, supplier receipts, and manual adjustments.
    """
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("warehouses.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    change_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    previous_stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    new_stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    movement_type: Mapped[StockMovementType] = mapped_column(
        Enum(StockMovementType, name="stock_movement_type_enum", native_enum=False),
        nullable=False,
        index=True
    )
    reference_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "new_stock >= 0",
            name="ck_stock_movements_new_stock_non_negative"
        ),
        Index(
            "ix_stock_movements_product_id_created_at",
            "product_id",
            "created_at"
        ),
    )

    # Relationships
    product = relationship("Product", back_populates="stock_movements")
    warehouse = relationship("Warehouse", back_populates="stock_movements")
    order = relationship("Order")
