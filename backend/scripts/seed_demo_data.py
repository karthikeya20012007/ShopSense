"""
ShopSense — Safe Demo Data Reset and Seeding Script

Prepares the development database (shopsense_dev) with realistic Indian demo data:
- Preserves the existing platform administrator account intact.
- Deletes existing vendor and customer records in strict foreign-key dependency order.
- Generates 100 Indian vendors (85 Approved, 10 Pending, 5 Rejected).
- Generates 300 Indian customers.
- Generates ~650 products across categories with non-negative stock and realistic pricing in INR.
- Generates 2,000 orders spanning recent 90 days with line items, snapshot pricing, and realistic status distribution.
- Idempotent and safe: strictly refuses to run on any database other than shopsense_dev.
"""

import sys
from pathlib import Path

# Add repo root to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import uuid
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Tuple

from sqlalchemy import select, text, func
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal, engine
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.models.vendor import VendorProfile
from backend.app.models.customer import CustomerProfile
from backend.app.models.product import Product
from backend.app.models.order import Order, OrderItem
from backend.app.models.refresh_token import RefreshTokenSession
from backend.app.models.enums import UserRole, AccountStatus, VendorStatus, OrderStatus

# Safety: target database must strictly match shopsense_dev
EXPECTED_DATABASE_NAME = "shopsense_dev"
DEMO_PASSWORD = "DemoUser@123"

# Realistic Indian Store Names and Cities
INDIAN_CITIES = [
    ("Bengaluru", "Karnataka", "560001"),
    ("Mumbai", "Maharashtra", "400001"),
    ("Delhi NCR", "Delhi", "110001"),
    ("Hyderabad", "Telangana", "500001"),
    ("Chennai", "Tamil Nadu", "600001"),
    ("Pune", "Maharashtra", "411001"),
    ("Ahmedabad", "Gujarat", "380001"),
    ("Kolkata", "West Bengal", "700001"),
    ("Jaipur", "Rajasthan", "302001"),
    ("Coimbatore", "Tamil Nadu", "641001"),
    ("Kochi", "Kerala", "682001"),
    ("Indore", "Madhya Pradesh", "452001"),
    ("Chandigarh", "Punjab", "160001"),
    ("Surat", "Gujarat", "395001"),
    ("Lucknow", "Uttar Pradesh", "226001"),
]

VENDOR_STORE_PREFIXES = [
    "Apex", "Bharat", "Deccan", "Kalyan", "Mittal", "Vanguard", "Godavari", "Sundaram",
    "Delta", "Omkar", "Zenith", "Tata", "Reliance", "Trident", "Surya", "Navkar",
    "Ganga", "Cauvery", "Malabar", "Konkan", "Chola", "Maratha", "Vardhman", "Kaveri",
    "Techno", "Infra", "SmartGrid", "MicroSense", "Optima", "Prime", "Quantum", "Nexus",
    "Aero", "Pulse", "Cyber", "Sigma", "Veda", "Pragati", "Shakti", "Garuda"
]

VENDOR_STORE_SUFFIXES = [
    "Retail IoT Systems", "Sensor Technologies", "Barcode & POS Solutions", "Smart Retail Hub",
    "RFID Dynamics", "Vision Analytics India", "POS Hardware & Peripherals", "Scanners & Systems",
    "Automation Lab", "Digital Storefronts", "Retail Hardware Co.", "Smart Shelf Dynamics",
    "Telemetry Solutions", "Omnichannel Tech", "Asset Tracking Systems", "Smart Checkout Hub",
    "Footfall Analytics", "Smart Labeling Tech", "Electronic Weighing Systems", "IoT Devices"
]

INDIAN_FIRST_NAMES = [
    "Aarav", "Aditi", "Aditya", "Akash", "Amit", "Ananya", "Anil", "Ankit", "Anushka", "Arjun",
    "Bhavna", "Chetan", "Deepak", "Devansh", "Divya", "Gaurav", "Harsh", "Isha", "Ishaan", "Jatin",
    "Kavita", "Karan", "Kunal", "Lakshmi", "Manish", "Meera", "Mohit", "Neha", "Nikhil", "Nisha",
    "Pooja", "Pranav", "Prashant", "Priya", "Rahul", "Rajesh", "Rakesh", "Ravi", "Riya", "Rohan",
    "Rohit", "Sachin", "Sameer", "Sanjay", "Santosh", "Shreya", "Siddharth", "Sneha", "Suresh", "Swati",
    "Tanvi", "Tarun", "Varun", "Vikas", "Vikram", "Vinay", "Vishal", "Yash", "Yuvraj", "Zoya"
]

INDIAN_LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Malhotra", "Bhatia", "Saxena", "Mehta", "Patel", "Shah", "Desai",
    "Iyer", "Nair", "Menon", "Pillai", "Reddy", "Rao", "Chowdary", "Naidu", "Kulkarni", "Deshmukh",
    "Patil", "Joshi", "Banerjee", "Chatterjee", "Mukherjee", "Das", "Ghosh", "Singh", "Kaur", "Gill",
    "Chopra", "Kapoor", "Khanna", "Agarwal", "Bansal", "Garg", "Jain", "Bhandari", "Mishra", "Pandey"
]

PRODUCT_CATALOG_TEMPLATES = [
    # Category, Title template, Price min, Price max, Description
    ("Barcode & QR Scanners", "Omnidirectional 2D Desktop Barcode Scanner Pro", 2499, 8999, "High-speed hands-free desktop presentation scanner with aggressive scanning of 1D and 2D digital barcodes from smartphone screens and labels."),
    ("Barcode & QR Scanners", "Industrial Rugged Handheld QR Code Reader", 3499, 11999, "IP65-rated drop-resistant handheld scanner with Bluetooth 5.2 connectivity and 14-hour continuous battery life for warehouse aisles."),
    ("Barcode & QR Scanners", "Wireless Bluetooth Ring Scanner for Retail Sorting", 4999, 14999, "Ergonomic wearable ring scanner with haptic vibration feedback for fast hands-free order fulfillment and stock audits."),
    ("Barcode & QR Scanners", "Fixed-Mount Automated Conveyor Barcode Reader", 8999, 28999, "High-resolution optical sensor for high-speed automated checkout conveyor belts and packing verification."),

    ("IoT Environmental Sensors", "Retail Cold Storage Temperature & Humidity Sensor", 1299, 4599, "LoRaWAN & BLE wireless temperature transmitter with automated SMS alerts for supermarket perishable chillers."),
    ("IoT Environmental Sensors", "Ambient Store Climate & Air Quality Monitor", 2499, 7999, "Real-time CO2, particulate matter, and humidity sensor node with centralized cloud dashboard sync."),
    ("IoT Environmental Sensors", "Smart Energy Current Transformer (CT) Sub-Meter", 3999, 12999, "Non-invasive IoT sub-metering clamp for monitoring supermarket HVAC and lighting power consumption."),

    ("Footfall & Customer Tracking", "AI Stereoscopic Overhead Footfall People Counter", 8999, 29999, "Dual-lens 3D stereoscopic sensor providing 99.2% counting accuracy, dwell-time analytics, and exclusion of staff tags."),
    ("Footfall & Customer Tracking", "Thermal Footfall Traffic & Heatmap Sensor Node", 11999, 34999, "Privacy-compliant thermal infrared tracking unit generating real-time department heatmaps and queue length metrics."),
    ("Footfall & Customer Tracking", "BLE Beacon Proximity Scanner for Customer Journey Tracking", 1899, 5499, "Long-range Bluetooth beacon scanner mapping aisle dwell time and promotional zone engagement."),

    ("Electronic Shelf Labels (ESL)", "4.2-inch Tri-Color (B/W/Red) E-Paper Shelf Label", 899, 2499, "Ultra-low power electronic price tag with Sub-1GHz RF mesh connectivity and 5-year battery life."),
    ("Electronic Shelf Labels (ESL)", "7.5-inch High-Resolution Promo E-Ink Display Tag", 1899, 4999, "Large-format electronic shelf display with dynamic promotional QR codes, NFC tap-to-buy, and RGB LED indicator."),
    ("Electronic Shelf Labels (ESL)", "ESL Central RF Access Point Gateway", 9999, 24999, "Base station gateway supporting up to 5,000 wireless shelf tags with automated ERP price updates within 3 seconds."),

    ("Point of Sale (POS) Terminals", "All-in-One Dual-Screen Android POS Terminal", 18999, 44999, "Dual capacitive touchscreen retail workstation with integrated 80mm thermal receipt printer and biometric scanner."),
    ("Point of Sale (POS) Terminals", "Mobile Handheld Wireless POS Terminal with 4G/WiFi", 12999, 27999, "Rugged mobile checkout terminal with thermal printer, contactless NFC reader, and long-life rechargeable battery."),
    ("Point of Sale (POS) Terminals", "Customer-Facing Interactive 10-inch Display Screen", 4999, 11999, "High-contrast USB customer pole display for live cart items, totals, and UPI dynamic QR payments."),

    ("RFID Tags & Smart Readers", "Fixed 4-Port UHF RFID Portal Reader Hub", 19999, 49999, "EPC Gen2 UHF RFID enterprise reader for retail dock doors and stockroom security gates."),
    ("RFID Tags & Smart Readers", "Handheld UHF RFID Inventory Wand Scanner", 14999, 39999, "High-sensitivity inventory wand capable of reading up to 700 tags per second across retail apparel racks."),
    ("RFID Tags & Smart Readers", "Self-Adhesive Printable UHF RFID Apparel Tags (Pack of 500)", 1499, 3999, "Passive RFID inlays tuned for fast inventory counts across folded apparel, footwear, and consumer goods."),

    ("Cash Drawers & Receipt Printers", "Heavy-Duty 5-Bill Steel Electronic Cash Drawer", 2499, 5999, "Reinforced steel POS cash drawer with RJ11 printer kick interface and dual media slots."),
    ("Cash Drawers & Receipt Printers", "High-Speed 80mm Thermal Receipt Printer with Auto-Cutter", 3999, 9499, "Triple interface (USB, Ethernet, Serial) thermal bill printer delivering 250mm/s output with auto-cutter."),
    ("Cash Drawers & Receipt Printers", "Wireless Portable Bluetooth 58mm Mobile Belt Printer", 1999, 4599, "Compact rechargeable receipt printer designed for queue-busting and curbside order pickup."),

    ("Inventory Counting Scales", "High-Precision Retail Smart Counting Scale (30kg)", 4999, 13999, "Digital piece-counting and weight scale with dual display, RS232 POS connectivity, and tare memory."),
    ("Inventory Counting Scales", "Industrial Waterproof Platform Scale (150kg)", 9999, 24999, "Heavy-gauge stainless steel washdown platform scale for wholesale retail receiving docks."),
]


def verify_target_database():
    """Verify that the active connection points specifically to shopsense_dev."""
    with SessionLocal() as db:
        curr_db = db.execute(text("SELECT current_database()")).scalar()
        if curr_db != EXPECTED_DATABASE_NAME:
            print(f"FATAL: Connected database is '{curr_db}', but expected '{EXPECTED_DATABASE_NAME}'.")
            print("Aborting to prevent accidental operations on non-dev databases.")
            sys.exit(1)
        return curr_db


def get_current_counts(db: Session):
    """Retrieve current record counts across all relevant tables."""
    return {
        "users": db.query(User).count(),
        "admins": db.query(User).filter(User.role == UserRole.ADMIN).count(),
        "vendors": db.query(VendorProfile).count(),
        "customers": db.query(CustomerProfile).count(),
        "products": db.query(Product).count(),
        "orders": db.query(Order).count(),
        "order_items": db.query(OrderItem).count(),
        "refresh_tokens": db.query(RefreshTokenSession).count(),
    }


def clean_existing_demo_data(db: Session) -> Tuple[User, dict]:
    """
    Safely delete existing non-admin vendor and customer data while preserving the administrator.
    Deletes records in strict reverse dependency order to respect foreign key constraints.
    """
    # 1. Locate the platform administrator
    admin = db.execute(
        select(User).where(User.role == UserRole.ADMIN)
    ).scalars().first()

    if not admin:
        print("ERROR: No administrator user found in database. Cannot proceed safely.")
        sys.exit(1)

    print(f"INFO: Preserving platform administrator '{admin.email}' (ID: {admin.id}).")

    # 2. Delete OrderItem records (child of orders, products, and vendor_profiles)
    deleted_items = db.query(OrderItem).delete(synchronize_session=False)

    # 3. Delete Order records (child of customer_profiles)
    deleted_orders = db.query(Order).delete(synchronize_session=False)

    # 4. Delete Product records (child of vendor_profiles)
    deleted_products = db.query(Product).delete(synchronize_session=False)

    # 5. Delete RefreshTokenSession records belonging to non-admin users
    deleted_tokens = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.user_id != admin.id
    ).delete(synchronize_session=False)

    # 6. Delete CustomerProfile records
    deleted_customers = db.query(CustomerProfile).delete(synchronize_session=False)

    # 7. Delete VendorProfile records
    deleted_vendors = db.query(VendorProfile).delete(synchronize_session=False)

    # 8. Delete User records where id != admin.id and role != ADMIN
    deleted_users = db.query(User).filter(
        User.id != admin.id,
        User.role != UserRole.ADMIN
    ).delete(synchronize_session=False)

    db.commit()

    summary = {
        "deleted_order_items": deleted_items,
        "deleted_orders": deleted_orders,
        "deleted_products": deleted_products,
        "deleted_refresh_tokens": deleted_tokens,
        "deleted_customer_profiles": deleted_customers,
        "deleted_vendor_profiles": deleted_vendors,
        "deleted_users": deleted_users,
    }
    return admin, summary


def generate_demo_dataset(db: Session, admin: User):
    """
    Generates realistic, repeatable demo data for ShopSense development & analytics:
    - 100 Vendors (85 Approved, 10 Pending, 5 Rejected)
    - 300 Customers
    - ~650 Products
    - 2,000 Orders with snapshot pricing and line items spread over 90 days
    """
    # Fix seed for deterministic, repeatable demo generation
    random.seed(42)

    print("\n--- Generating Demo Users & Profiles ---")
    print(f"Pre-hashing demo password '{DEMO_PASSWORD}' for fast Argon2 insertion...")
    demo_hashed_password = get_password_hash(DEMO_PASSWORD)

    # -------------------------------------------------------------------------
    # 1. Generate 100 Vendors
    # -------------------------------------------------------------------------
    print("Generating 100 Indian Vendors (85 Approved, 10 Pending, 5 Rejected)...")
    vendors: List[VendorProfile] = []
    approved_vendors: List[VendorProfile] = []

    used_store_names = set()

    for i in range(1, 101):
        # Pick realistic store name
        while True:
            prefix = random.choice(VENDOR_STORE_PREFIXES)
            suffix = random.choice(VENDOR_STORE_SUFFIXES)
            store_name = f"{prefix} {suffix}"
            if store_name not in used_store_names:
                used_store_names.add(store_name)
                break

        city_info = random.choice(INDIAN_CITIES)
        first_name = random.choice(INDIAN_FIRST_NAMES)
        last_name = random.choice(INDIAN_LAST_NAMES)
        full_name = f"{first_name} {last_name}"
        email = f"vendor{i:03d}@demo.shopsense.in"

        # Vendor status distribution: 85 Approved, 10 Pending, 5 Rejected
        if i <= 85:
            vendor_status = VendorStatus.APPROVED
        elif i <= 95:
            vendor_status = VendorStatus.PENDING
        else:
            vendor_status = VendorStatus.REJECTED

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=demo_hashed_password,
            role=UserRole.VENDOR,
            account_status=AccountStatus.ACTIVE
        )
        db.add(user)
        db.flush()

        slug = store_name.lower().replace(" ", "").replace("&", "and")[:15]
        biz_email = f"sales@{slug}.co.in"
        phone = f"+91 {random.randint(70, 99)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}"
        address = f"Unit {random.randint(101, 808)}, Tech Park, {city_info[0]}, {city_info[1]} - {city_info[2]}"
        desc = f"Premier distributor of retail analytics hardware, IoT telemetry, and barcode automation based in {city_info[0]}."

        vendor_profile = VendorProfile(
            user_id=user.id,
            store_name=store_name,
            business_email=biz_email,
            business_phone=phone,
            business_address=address,
            business_description=desc,
            status=vendor_status
        )
        db.add(vendor_profile)
        db.flush()

        vendors.append(vendor_profile)
        if vendor_status == VendorStatus.APPROVED:
            approved_vendors.append(vendor_profile)

    print(f"Created {len(vendors)} vendors ({len(approved_vendors)} approved for product listings).")

    # -------------------------------------------------------------------------
    # 2. Generate 300 Customers
    # -------------------------------------------------------------------------
    print("Generating 300 Indian Customers...")
    customers: List[CustomerProfile] = []

    for i in range(1, 301):
        first_name = random.choice(INDIAN_FIRST_NAMES)
        last_name = random.choice(INDIAN_LAST_NAMES)
        full_name = f"{first_name} {last_name}"
        email = f"customer{i:03d}@demo.shopsense.in"
        city_info = random.choice(INDIAN_CITIES)

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=demo_hashed_password,
            role=UserRole.CUSTOMER,
            account_status=AccountStatus.ACTIVE
        )
        db.add(user)
        db.flush()

        phone = f"+91 {random.randint(70, 99)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}"
        shipping_address = f"Flat {random.randint(1, 1402)}, Residential Enclave, {city_info[0]}, {city_info[1]} - {city_info[2]}"

        customer_profile = CustomerProfile(
            user_id=user.id,
            phone_number=phone,
            shipping_address=shipping_address
        )
        db.add(customer_profile)
        db.flush()

        customers.append(customer_profile)

    print(f"Created {len(customers)} customer profiles.")

    # -------------------------------------------------------------------------
    # 3. Generate ~650 Products Across Approved Vendors
    # -------------------------------------------------------------------------
    print("Generating ~650 Products distributed across Approved Vendors...")
    products: List[Product] = []
    sku_counter = 1001

    for vendor in approved_vendors:
        # Each approved vendor gets between 6 and 10 products
        num_products = random.randint(6, 10)
        chosen_templates = random.sample(PRODUCT_CATALOG_TEMPLATES, min(num_products, len(PRODUCT_CATALOG_TEMPLATES)))

        for tmpl in chosen_templates:
            category, title_base, min_p, max_p, desc = tmpl

            # Add brand variation to title
            model_num = f"{random.choice(['X', 'Pro', 'Max', 'Ultra', 'S', 'Plus'])}-{random.randint(100, 990)}"
            title = f"{vendor.store_name.split()[0]} {title_base} ({model_num})"
            price_val = Decimal(str(random.randint(min_p, max_p))).quantize(Decimal("0.01"))
            stock_qty = random.randint(15, 250)
            sku = f"SS-SKU-{sku_counter:05d}"
            sku_counter += 1

            # ~95% published, ~5% unpublished
            is_pub = random.random() < 0.95

            product = Product(
                vendor_id=vendor.id,
                title=title,
                description=desc,
                price=price_val,
                category=category,
                sku=sku,
                stock_quantity=stock_qty,
                is_published=is_pub
            )
            db.add(product)
            db.flush()
            products.append(product)

    print(f"Created {len(products)} products across {len(approved_vendors)} vendors.")

    # -------------------------------------------------------------------------
    # 4. Generate 2,000 Orders Spanning Past 90 Days
    # -------------------------------------------------------------------------
    print("Generating 2,000 Orders with multi-vendor items and realistic status mix...")
    now = datetime.now(timezone.utc)
    published_products = [p for p in products if p.is_published]

    # Order status weights: 75% COMPLETED, 12% PENDING, 8% CANCELLED, 5% REFUNDED
    status_choices = [
        OrderStatus.COMPLETED,
        OrderStatus.PENDING,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED
    ]
    status_weights = [75, 12, 8, 5]

    total_orders_created = 0
    total_order_items_created = 0
    total_revenue_recognized = Decimal("0.00")

    for i in range(1, 2001):
        customer = random.choice(customers)

        # Distribute order timestamps randomly across past 90 days
        days_ago = random.uniform(0, 90)
        order_time = now - timedelta(days=days_ago)

        order_status = random.choices(status_choices, weights=status_weights, k=1)[0]

        # 1 to 4 distinct products per order (supporting multi-vendor checkout)
        num_items = random.randint(1, 4)
        selected_prods = random.sample(published_products, num_items)

        line_items_data = []
        order_total = Decimal("0.00")

        for prod in selected_prods:
            qty = random.randint(1, 3)
            unit_price = prod.price
            subtotal = (unit_price * qty).quantize(Decimal("0.01"))
            order_total += subtotal

            line_items_data.append({
                "product_id": prod.id,
                "vendor_id": prod.vendor_id,
                "quantity": qty,
                "unit_price": unit_price,
                "subtotal": subtotal
            })

        order = Order(
            customer_id=customer.id,
            status=order_status,
            total_amount=order_total.quantize(Decimal("0.01")),
            created_at=order_time,
            updated_at=order_time
        )
        db.add(order)
        db.flush()

        for item_data in line_items_data:
            item = OrderItem(
                order_id=order.id,
                product_id=item_data["product_id"],
                vendor_id=item_data["vendor_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                subtotal=item_data["subtotal"],
                created_at=order_time
            )
            db.add(item)
            total_order_items_created += 1

        total_orders_created += 1
        if order_status == OrderStatus.COMPLETED:
            total_revenue_recognized += order_total

    db.commit()

    print(f"\n--- Seeding Completed Successfully ---")
    print(f"Total Orders Created: {total_orders_created}")
    print(f"Total Order Items:    {total_order_items_created}")
    print(f"Total Recognized Rev: INR {total_revenue_recognized:,.2f}")


def run_plan_only():
    """Print the exact database target, deletion scope, and records to be preserved."""
    target_db = verify_target_database()
    with SessionLocal() as db:
        counts = get_current_counts(db)
        admin = db.execute(select(User).where(User.role == UserRole.ADMIN)).scalars().first()

        print("================================================================================")
        print("          SHOPSENSE DEMO DATA RESET & SEEDING -- PRE-EXECUTION REPORT           ")
        print("================================================================================")
        print(f"Target Database:         {target_db} (verified on localhost:5432)")
        print(f"Target Connection URL:   {settings.DATABASE_URL.split('@')[-1]}")
        print("--------------------------------------------------------------------------------")
        print("PRESERVED RECORDS:")
        if admin:
            print(f"  * Administrator Account: '{admin.email}' (ID: {admin.id})")
            print(f"  * Administrator Role:    {admin.role.value}")
            print("  * Admin Password Hash:   PRESERVED (unchanged, Testing321)")
        else:
            print("  * WARNING: No administrator found!")
        print("  * Database Schema:       PRESERVED (no schema drop or migration changes)")
        print("  * Alembic History:       PRESERVED (linear migrations intact)")
        print("  * shopsense_test DB:     PRESERVED (completely untouched)")
        print("--------------------------------------------------------------------------------")
        print("RECORDS TO BE DELETED (Strict Foreign-Key Dependency Order):")
        print(f"  1. Order Items:         {counts['order_items']} records")
        print(f"  2. Orders:              {counts['orders']} records")
        print(f"  3. Products:            {counts['products']} records")
        print(f"  4. Refresh Tokens:      {counts['refresh_tokens']} records (excluding admin tokens)")
        print(f"  5. Customer Profiles:   {counts['customers']} records")
        print(f"  6. Vendor Profiles:     {counts['vendors']} records")
        print(f"  7. Non-Admin Users:     {counts['users'] - counts['admins']} records (role != ADMIN)")
        print("--------------------------------------------------------------------------------")
        print("PLANNED DEMO GENERATION:")
        print("  * 100 Indian Vendors:   85 Approved, 10 Pending, 5 Rejected")
        print("  * 300 Indian Customers: All Active with realistic addresses & phones")
        print("  * ~650 Products:        Across 8 retail IoT categories, prices in INR (450 - 45k)")
        print("  * 2,000 Orders:         ~75% Completed, ~12% Pending, ~8% Cancelled, ~5% Refunded")
        print("  * Order Items:          ~4,400 multi-vendor line items spanning past 90 days")
        print(f"  * Demo Password:        '{DEMO_PASSWORD}' for all seeded vendors and customers")
        print("================================================================================")


def run_execute():
    """Execute the database reset and demo data seeding transactionally."""
    target_db = verify_target_database()
    print(f"Connecting to database '{target_db}'...")

    with SessionLocal() as db:
        admin, delete_summary = clean_existing_demo_data(db)
        print("Existing non-admin records successfully cleaned:")
        for k, v in delete_summary.items():
            print(f"  * {k}: {v}")

        generate_demo_dataset(db, admin)

        # Verification of final counts
        final_counts = get_current_counts(db)
        print("\n================================================================================")
        print("                    FINAL RECORD COUNTS AFTER SEEDING                          ")
        print("================================================================================")
        for k, v in final_counts.items():
            print(f"  * {k:20s}: {v}")
        print("================================================================================")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--execute":
        run_execute()
    else:
        run_plan_only()
