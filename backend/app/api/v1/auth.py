from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.auth import LoginRequest, RefreshRequest, MessageResponse
from backend.app.schemas.user import UserResponse, TokenResponse
from backend.app.schemas.vendor import VendorRegisterRequest
from backend.app.schemas.customer import CustomerRegisterRequest
from backend.app.services.auth_service import (
    register_customer,
    register_vendor,
    authenticate_user,
    create_user_tokens,
    rotate_refresh_token,
    revoke_refresh_token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Set HttpOnly refresh cookie with appropriate security flags."""
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/"
    )


def clear_refresh_cookie(response: Response) -> None:
    """Clear HttpOnly refresh cookie upon logout."""
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )


@router.post(
    "/register/customer",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account"
)
def api_register_customer(
    request: CustomerRegisterRequest,
    db: Session = Depends(get_db)
):
    user = register_customer(db, request)
    return user


@router.post(
    "/register/vendor",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new vendor account with pending onboarding status"
)
def api_register_vendor(
    request: VendorRegisterRequest,
    db: Session = Depends(get_db)
):
    user = register_vendor(db, request)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in using email and password"
)
def api_login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, email=login_data.email, password=login_data.password)
    access_token, raw_refresh = create_user_tokens(db, user)

    # Set secure HttpOnly cookie for browser clients
    set_refresh_cookie(response, raw_refresh)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue new access token"
)
def api_refresh_token(
    request: Request,
    response: Response,
    body: Optional[RefreshRequest] = None,
    db: Session = Depends(get_db)
):
    # Check HttpOnly cookie first, then fall back to JSON body
    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not raw_token and body and body.refresh_token:
        raw_token = body.refresh_token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing from request cookie or body."
        )

    user, new_access_token, new_raw_refresh = rotate_refresh_token(db, raw_token)
    set_refresh_cookie(response, new_raw_refresh)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        user=user
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate active refresh session and clear cookie"
)
def api_logout(
    request: Request,
    response: Response,
    body: Optional[RefreshRequest] = None,
    db: Session = Depends(get_db)
):
    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not raw_token and body and body.refresh_token:
        raw_token = body.refresh_token

    if raw_token:
        revoke_refresh_token(db, raw_token)

    clear_refresh_cookie(response)
    return MessageResponse(message="Successfully logged out.")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get profile of currently authenticated user"
)
def api_get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user
