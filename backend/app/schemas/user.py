import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from backend.app.models.enums import UserRole, AccountStatus
from backend.app.schemas.vendor import VendorProfileResponse
from backend.app.schemas.customer import CustomerProfileResponse


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    account_status: AccountStatus
    created_at: datetime
    vendor_profile: Optional[VendorProfileResponse] = None
    customer_profile: Optional[CustomerProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
