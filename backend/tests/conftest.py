import os
import pytest
from decimal import Decimal
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.core.security import get_password_hash, create_access_token
from backend.app.main import app
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.product import Product
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus

# Test database engine using TEST_DATABASE_URL
test_db_url = os.environ.get("TEST_DATABASE_URL", settings.TEST_DATABASE_URL)
test_engine = create_engine(test_db_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables in the isolated test database."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a clean database session per test with teardown."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient configured with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Fixture providing an active administrator user."""
    admin = User(
        email="admin_fixture@shopsense.internal",
        full_name="Admin Fixture",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def admin_headers(admin_user: User) -> dict:
    token = create_access_token(subject=str(admin_user.id), role=admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pending_vendor(db_session: Session) -> tuple[User, VendorProfile]:
    """Fixture providing a vendor with PENDING onboarding status."""
    user = User(
        email="pending_vendor@example.com",
        full_name="Pending Vendor User",
        hashed_password=get_password_hash("VendorPass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(user)
    db_session.flush()

    vendor = VendorProfile(
        user_id=user.id,
        store_name="Pending Store",
        business_email="pending@store.com",
        business_phone="+1 555-0100",
        business_address="123 Pending St",
        business_description="Store waiting for admin approval",
        status=VendorStatus.PENDING
    )
    db_session.add(vendor)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(vendor)
    return user, vendor


@pytest.fixture
def pending_vendor_headers(pending_vendor: tuple[User, VendorProfile]) -> dict:
    user, _ = pending_vendor
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def approved_vendor(db_session: Session) -> tuple[User, VendorProfile]:
    """Fixture providing a vendor with APPROVED onboarding status."""
    user = User(
        email="approved_vendor@example.com",
        full_name="Approved Vendor User",
        hashed_password=get_password_hash("VendorPass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(user)
    db_session.flush()

    vendor = VendorProfile(
        user_id=user.id,
        store_name="Approved SuperStore",
        business_email="approved@store.com",
        business_phone="+1 555-0200",
        business_address="456 Approved Ave",
        business_description="Store approved by admin",
        status=VendorStatus.APPROVED
    )
    db_session.add(vendor)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(vendor)
    return user, vendor


@pytest.fixture
def approved_vendor_headers(approved_vendor: tuple[User, VendorProfile]) -> dict:
    user, _ = approved_vendor
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def rejected_vendor(db_session: Session) -> tuple[User, VendorProfile]:
    """Fixture providing a vendor with REJECTED onboarding status."""
    user = User(
        email="rejected_vendor@example.com",
        full_name="Rejected Vendor User",
        hashed_password=get_password_hash("VendorPass123!"),
        role=UserRole.VENDOR,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(user)
    db_session.flush()

    vendor = VendorProfile(
        user_id=user.id,
        store_name="Rejected Store",
        business_email="rejected@store.com",
        business_phone="+1 555-0300",
        business_address="789 Rejected Rd",
        business_description="Store rejected by admin",
        status=VendorStatus.REJECTED
    )
    db_session.add(vendor)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(vendor)
    return user, vendor


@pytest.fixture
def rejected_vendor_headers(rejected_vendor: tuple[User, VendorProfile]) -> dict:
    user, _ = rejected_vendor
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer_user(db_session: Session) -> tuple[User, CustomerProfile]:
    """Fixture providing a registered customer."""
    user = User(
        email="customer1@example.com",
        full_name="Alice Customer",
        hashed_password=get_password_hash("CustomerPass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.ACTIVE
    )
    db_session.add(user)
    db_session.flush()

    profile = CustomerProfile(
        user_id=user.id,
        phone_number="+1 555-0400",
        shipping_address="123 Customer Way"
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(profile)
    return user, profile


@pytest.fixture
def customer_headers(customer_user: tuple[User, CustomerProfile]) -> dict:
    user, _ = customer_user
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def disabled_user(db_session: Session) -> User:
    """Fixture providing a disabled user account."""
    user = User(
        email="disabled@example.com",
        full_name="Disabled User",
        hashed_password=get_password_hash("DisabledPass123!"),
        role=UserRole.CUSTOMER,
        account_status=AccountStatus.DISABLED
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def disabled_user_headers(disabled_user: User) -> dict:
    token = create_access_token(subject=str(disabled_user.id), role=disabled_user.role.value)
    return {"Authorization": f"Bearer {token}"}
