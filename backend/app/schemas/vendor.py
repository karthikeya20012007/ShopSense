import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from backend.app.models.enums import VendorStatus


class VendorRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=2, max_length=255)
    store_name: str = Field(..., min_length=2, max_length=255)
    business_email: Optional[EmailStr] = None
    business_phone: Optional[str] = Field(None, max_length=50)
    business_address: Optional[str] = None
    business_description: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class VendorStatusUpdateRequest(BaseModel):
    status: VendorStatus

    @field_validator("status")
    @classmethod
    def validate_target_status(cls, v: VendorStatus) -> VendorStatus:
        if v not in (VendorStatus.APPROVED, VendorStatus.REJECTED):
            raise ValueError("Target status must be either APPROVED or REJECTED")
        return v


class VendorProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    store_name: str
    business_email: Optional[str] = None
    business_phone: Optional[str] = None
    business_address: Optional[str] = None
    business_description: Optional[str] = None
    status: VendorStatus
    created_at: datetime
    updated_at: datetime

    # Associated user info if joined
    applicant_email: Optional[str] = None
    applicant_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VendorOnboardingStatusResponse(BaseModel):
    vendor_id: uuid.UUID
    store_name: str
    status: VendorStatus
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VendorProfileUpdate(BaseModel):
    store_name: Optional[str] = Field(None, min_length=2)
    business_email: Optional[EmailStr] = None
    business_phone: Optional[str] = None
    business_address: Optional[str] = None
    business_description: Optional[str] = None
