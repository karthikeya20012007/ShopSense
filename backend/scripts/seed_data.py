from decimal import Decimal
from sqlalchemy import select
from backend.app.core.database import SessionLocal
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.product import Product
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus


def seed():
    db = SessionLocal()
    try:
        # Check if demo vendor exists
        vendor_user = db.execute(
            select(User).where(User.email == "demo_vendor@shopsense.com")
        ).scalar_one_or_none()

        if not vendor_user:
            vendor_user = User(
                email="demo_vendor@shopsense.com",
                full_name="Alex Mercer",
                hashed_password=get_password_hash("VendorPass123!"),
                role=UserRole.VENDOR,
                account_status=AccountStatus.ACTIVE
            )
            db.add(vendor_user)
            db.flush()

            vendor_profile = VendorProfile(
                user_id=vendor_user.id,
                store_name="TechTrend Analytics & Gear",
                business_email="contact@techtrend.com",
                business_phone="+1 555-0199",
                business_address="100 Innovation Way, Suite 400, Tech City",
                business_description="Authorized seller of premium smart IoT retail counters and computer accessories.",
                status=VendorStatus.APPROVED
            )
            db.add(vendor_profile)
            db.flush()
        else:
            vendor_profile = db.execute(
                select(VendorProfile).where(VendorProfile.user_id == vendor_user.id)
            ).scalar_one()

        # Seed products if empty
        existing_products_count = db.query(Product).filter(Product.vendor_id == vendor_profile.id).count()
        if existing_products_count == 0:
            sample_products = [
                Product(
                    vendor_id=vendor_profile.id,
                    title="ShopSense Smart Footfall Counter Pro",
                    description="AI-powered optical visitor footfall tracker with real-time heat mapping and edge processing.",
                    price=Decimal("299.99"),
                    category="Hardware",
                    sku="SS-OPT-01",
                    stock_quantity=45,
                    is_published=True
                ),
                Product(
                    vendor_id=vendor_profile.id,
                    title="Wireless Beacon Shelf Sensor Kit",
                    description="Bluetooth LE micro-beacons for tracking customer shelf dwell times and product engagement.",
                    price=Decimal("129.50"),
                    category="Sensors",
                    sku="SS-BCN-04",
                    stock_quantity=120,
                    is_published=True
                ),
                Product(
                    vendor_id=vendor_profile.id,
                    title="Ergonomic Barcode Scanner & Dock",
                    description="Rugged high-speed 2D barcode and QR scanner for seamless checkout and inventory audits.",
                    price=Decimal("89.00"),
                    category="POS Accessories",
                    sku="POS-SCN-200",
                    stock_quantity=60,
                    is_published=True
                ),
                Product(
                    vendor_id=vendor_profile.id,
                    title="Smart Inventory Electronic Shelf Labels (Pack of 20)",
                    description="E-paper digital price tags with cloud sync and dynamic promotion display.",
                    price=Decimal("199.00"),
                    category="Hardware",
                    sku="ESL-EP20",
                    stock_quantity=30,
                    is_published=True
                ),
                # Unpublished product to verify catalog privacy
                Product(
                    vendor_id=vendor_profile.id,
                    title="Prototype Next-Gen RFID Portal Scanner",
                    description="Internal unreleased prototype scanner for high-volume automated distribution centers.",
                    price=Decimal("1499.00"),
                    category="Hardware",
                    sku="SS-RFID-PROTO",
                    stock_quantity=2,
                    is_published=False  # Unpublished! Must NOT appear in public catalog
                ),
            ]
            db.add_all(sample_products)
            db.commit()
            print("SUCCESS: Demo vendor and 5 products (4 published, 1 unpublished) successfully seeded.")
        else:
            print("INFO: Products already exist for demo vendor.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
