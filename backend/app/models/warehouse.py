import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base


class Warehouse(Base):
    """
    Physical or logical fulfillment facility storing marketplace product inventory.
    """
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )
    location: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    contact_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
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

    # Stock movements originating or received at this warehouse
    stock_movements = relationship(
        "StockMovement",
        back_populates="warehouse"
    )
