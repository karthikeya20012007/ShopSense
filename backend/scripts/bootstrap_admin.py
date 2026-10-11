import sys
from sqlalchemy import select
from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.models.enums import UserRole, AccountStatus
from backend.app.services.auth_service import normalize_email


def bootstrap_admin():
    """Controlled one-time bootstrap script for creating the platform administrator."""
    email = normalize_email(settings.INITIAL_ADMIN_EMAIL)
    password = settings.INITIAL_ADMIN_PASSWORD
    full_name = settings.INITIAL_ADMIN_NAME

    if not email or not password:
        print("ERROR: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be configured in environment.")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing_user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing_user:
            if existing_user.role == UserRole.ADMIN:
                print(f"INFO: Administrator account '{email}' already exists. No changes made.")
            else:
                print(f"WARNING: User '{email}' exists with role '{existing_user.role.value}'. Escalation rejected.")
            return

        hashed_pw = get_password_hash(password)
        admin = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_pw,
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"SUCCESS: Initial administrator '{email}' successfully bootstrapped with ID: {admin.id}")
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_admin()
