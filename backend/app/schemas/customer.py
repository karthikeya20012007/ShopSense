import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class CustomerRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=2, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    shipping_address: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class CustomerProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    phone_number: Optional[str] = None
    shipping_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerProfileUpdate(BaseModel):
    phone_number: Optional[str] = None
    shipping_address: Optional[str] = None
