import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, Numeric, Integer, Boolean, DateTime, ForeignKey, Uuid, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint(
            "stock_quantity >= 0",
            name="ck_products_stock_quantity_non_negative"
        ),
        CheckConstraint(
            "reorder_level >= 0",
            name="ck_products_reorder_level_non_negative"
        ),
        CheckConstraint(
            "safety_stock >= 0",
            name="ck_products_safety_stock_non_negative"
        ),
        CheckConstraint(
            "lead_time_days >= 0",
            name="ck_products_lead_time_days_non_negative"
        ),
        CheckConstraint(
            "cost_price IS NULL OR cost_price >= 0",
            name="ck_products_cost_price_non_negative"
        ),
    )


    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("vendor_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    title: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )
    cost_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        default=None
    )
    category: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False
    )
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    reorder_level: Mapped[int] = mapped_column(
        Integer,
        default=15,
        server_default="15",
        nullable=False
    )
    safety_stock: Mapped[int] = mapped_column(
        Integer,
        default=5,
        server_default="5",
        nullable=False
    )
    lead_time_days: Mapped[int] = mapped_column(
        Integer,
        default=7,
        server_default="7",
        nullable=False
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    vendor = relationship("VendorProfile", back_populates="products")
    category_rel = relationship("Category", back_populates="products")
    stock_movements = relationship(
        "StockMovement",
        back_populates="product",
        cascade="all, delete-orphan"
    )
