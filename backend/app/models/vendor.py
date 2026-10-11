import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base
from backend.app.models.enums import VendorStatus


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False
    )
    store_name: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False
    )
    business_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    business_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    business_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[VendorStatus] = mapped_column(
        Enum(VendorStatus, name="vendor_status_enum", native_enum=False),
        default=VendorStatus.PENDING,
        nullable=False,
        index=True
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
    user = relationship("User", back_populates="vendor_profile")
    products = relationship(
        "Product",
        back_populates="vendor",
        cascade="all, delete-orphan"
    )
