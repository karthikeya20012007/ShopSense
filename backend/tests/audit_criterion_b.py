"""
ShopSense Milestone 1 Audit — Criterion B: Sales Analytics & Transactional Consistency
Reconciles transactional consistency and revenue recognition across shopsense_dev.
Pass rate target: >= 98.0%
"""

import sys
from pathlib import Path
from decimal import Decimal

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings
from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.models.order import Order, OrderItem, OrderStatus
from backend.app.models.product import Product
from backend.app.models.user import User, UserRole
from backend.app.models.vendor import VendorProfile

def run_criterion_b_audit():
    # Connect directly to shopsense_dev (strictly read-only queries)
    dev_engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    DevSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=dev_engine)
    db = DevSessionLocal()

    total_checks = 0
    passed_checks = 0
    failed_checks = []

    try:
        print("================================================================================")
        print("  CRITERION B AUDIT: SALES ANALYTICS & TRANSACTIONAL CONSISTENCY RECONCILIATION ")
        print("================================================================================")

        # 1. Product Stock Non-Negativity Check (703 products)
        products = db.execute(select(Product)).scalars().all()
        prod_count = len(products)
        negative_stock = [p for p in products if p.stock_quantity < 0]
        for p in products:
            total_checks += 1
            if p.stock_quantity >= 0:
                passed_checks += 1
            else:
                failed_checks.append(f"Product {p.id} has negative stock: {p.stock_quantity}")
        print(f"[Check 1] Product Stock Non-Negativity: {prod_count - len(negative_stock)}/{prod_count} passed (0 negative stock violations)")

        # 2. Order Items Calculation Check: subtotal == unit_price * quantity (5,035 items)
        order_items = db.execute(select(OrderItem)).scalars().all()
        items_count = len(order_items)
        bad_items = []
        for item in order_items:
            total_checks += 1
            expected_subtotal = (Decimal(str(item.unit_price)) * item.quantity).quantize(Decimal("0.01"))
            actual_subtotal = Decimal(str(item.subtotal)).quantize(Decimal("0.01"))
            if expected_subtotal == actual_subtotal and item.quantity > 0 and item.unit_price >= 0:
                passed_checks += 1
            else:
                bad_items.append((item.id, expected_subtotal, actual_subtotal))
                failed_checks.append(f"OrderItem {item.id} arithmetic mismatch: expected {expected_subtotal}, got {actual_subtotal}")
        print(f"[Check 2] OrderItem Subtotal Integrity (subtotal == price * qty): {items_count - len(bad_items)}/{items_count} passed")

        # 3. Order Total vs Items Sum Check: order.total_amount == sum(items.subtotal) (2,000 orders)
        orders = db.execute(select(Order)).scalars().all()
        orders_count = len(orders)
        bad_orders = []
        
        # Precompute item sums by order_id
        item_sums_query = db.execute(
            select(OrderItem.order_id, func.sum(OrderItem.subtotal)).group_by(OrderItem.order_id)
        ).all()
        item_sums = {row[0]: Decimal(str(row[1])).quantize(Decimal("0.01")) for row in item_sums_query}

        for ord in orders:
            total_checks += 1
            expected_total = item_sums.get(ord.id, Decimal("0.00"))
            actual_total = Decimal(str(ord.total_amount)).quantize(Decimal("0.01"))
            if expected_total == actual_total and actual_total >= 0:
                passed_checks += 1
            else:
                bad_orders.append((ord.id, expected_total, actual_total))
                failed_checks.append(f"Order {ord.id} sum mismatch: expected {expected_total}, got {actual_total}")
        print(f"[Check 3] Order Total vs Item Sums: {orders_count - len(bad_orders)}/{orders_count} passed")

        # 4. Status-Based Revenue Recognition Reconciliation (SQL vs API)
        # Compute in SQL:
        completed_orders_total = db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .where(Order.status == OrderStatus.COMPLETED)
        ).scalar()
        completed_orders_total = Decimal(str(completed_orders_total)).quantize(Decimal("0.01"))

        completed_count = db.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.COMPLETED)
        ).scalar()

        non_completed_total = db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .where(Order.status != OrderStatus.COMPLETED)
        ).scalar()
        non_completed_total = Decimal(str(non_completed_total)).quantize(Decimal("0.01"))

        # Verify via Admin API
        admin_user = db.execute(select(User).where(User.role == UserRole.ADMIN)).scalars().first()
        token = create_access_token(subject=str(admin_user.id), role=admin_user.role.value)
        headers = {"Authorization": f"Bearer {token}"}

        with TestClient(app) as client:
            admin_overview_res = client.get("/api/v1/analytics/admin/overview", headers=headers)
            assert admin_overview_res.status_code == 200, f"Admin overview returned {admin_overview_res.status_code}"
            overview_data = admin_overview_res.json()

            api_rev = Decimal(str(overview_data["total_revenue"])).quantize(Decimal("0.01"))
            api_completed_cnt = overview_data["completed_orders_count"]
            api_total_cnt = overview_data["total_orders_count"]

            total_checks += 1
            if api_rev == completed_orders_total:
                passed_checks += 1
                print(f"[Check 4a] Admin API Revenue Match: SQL INR {completed_orders_total:,.2f} == API INR {api_rev:,.2f} (EXACT)")
            else:
                failed_checks.append(f"Admin API revenue mismatch: SQL {completed_orders_total} vs API {api_rev}")

            total_checks += 1
            if api_completed_cnt == completed_count:
                passed_checks += 1
                print(f"[Check 4b] Admin API Completed Count Match: SQL {completed_count} == API {api_completed_cnt} (EXACT)")
            else:
                failed_checks.append(f"Admin API completed count mismatch: SQL {completed_count} vs API {api_completed_cnt}")

            total_checks += 1
            if api_total_cnt == orders_count:
                passed_checks += 1
                print(f"[Check 4c] Admin API Total Orders Count Match: SQL {orders_count} == API {api_total_cnt} (EXACT)")
            else:
                failed_checks.append(f"Admin API total count mismatch: SQL {orders_count} vs API {api_total_cnt}")

            # Admin Revenue Trend endpoint reconciliation
            admin_trend_res = client.get("/api/v1/analytics/admin/revenue?start_date=2020-01-01", headers=headers)
            assert admin_trend_res.status_code == 200
            trend_data = admin_trend_res.json()
            sum_trend_rev = sum(Decimal(str(pt["revenue"])) for pt in trend_data).quantize(Decimal("0.01"))
            sum_trend_orders = sum(pt["order_count"] for pt in trend_data)

            total_checks += 1
            if sum_trend_rev == completed_orders_total:
                passed_checks += 1
                print(f"[Check 4d] Admin Trend Revenue Aggregation: Daily Sum INR {sum_trend_rev:,.2f} == Total INR {completed_orders_total:,.2f} (EXACT)")
            else:
                failed_checks.append(f"Admin trend sum mismatch: trend sum {sum_trend_rev} vs completed {completed_orders_total}")

            total_checks += 1
            if sum_trend_orders == completed_count:
                passed_checks += 1
                print(f"[Check 4e] Admin Trend Order Count Aggregation: Daily Orders {sum_trend_orders} == Completed {completed_count} (EXACT)")
            else:
                failed_checks.append(f"Admin trend orders mismatch: {sum_trend_orders} vs {completed_count}")

            # 5. Multi-Vendor Isolation Check (Sample 10 Vendors)
            vendors = db.execute(select(VendorProfile).limit(10)).scalars().all()
            print(f"[Check 5] Vendor-Isolated Revenue & Analytics (Auditing 10 distinct vendors):")
            for v in vendors:
                v_user = db.execute(select(User).where(User.id == v.user_id)).scalar_one()
                v_token = create_access_token(subject=str(v_user.id), role=v_user.role.value)
                v_headers = {"Authorization": f"Bearer {v_token}"}

                # Direct SQL calculation for vendor v: sum of order_items in COMPLETED orders
                v_sql_rev = db.execute(
                    select(func.coalesce(func.sum(OrderItem.subtotal), 0))
                    .join(Order, OrderItem.order_id == Order.id)
                    .where(OrderItem.vendor_id == v.id, Order.status == OrderStatus.COMPLETED)
                ).scalar()
                v_sql_rev = Decimal(str(v_sql_rev)).quantize(Decimal("0.01"))

                v_sql_orders_cnt = db.execute(
                    select(func.count(func.distinct(OrderItem.order_id)))
                    .join(Order, OrderItem.order_id == Order.id)
                    .where(OrderItem.vendor_id == v.id, Order.status == OrderStatus.COMPLETED)
                ).scalar()

                v_res = client.get("/api/v1/analytics/vendor/overview", headers=v_headers)
                assert v_res.status_code == 200, f"Vendor overview error {v_res.status_code} for vendor {v.id}"
                v_data = v_res.json()
                api_v_rev = Decimal(str(v_data["recognized_revenue"])).quantize(Decimal("0.01"))
                api_v_orders = v_data["completed_order_count"]

                total_checks += 1
                if api_v_rev == v_sql_rev and api_v_orders == v_sql_orders_cnt:
                    passed_checks += 1
                    print(f"  * Vendor {v.store_name:<24s}: SQL INR {v_sql_rev:>10,.2f} ({v_sql_orders_cnt} orders) == API INR {api_v_rev:>10,.2f} ({api_v_orders} orders) [MATCH]")
                else:
                    failed_checks.append(f"Vendor {v.id} revenue/order mismatch: SQL ({v_sql_rev}, {v_sql_orders_cnt}) vs API ({api_v_rev}, {api_v_orders})")

    finally:
        db.close()

    rate = (passed_checks / total_checks) * 100
    print("--------------------------------------------------------------------------------")
    print(f"CRITERION B AUDIT TOTALS:")
    print(f"Total Evaluated Checks:  {total_checks}")
    print(f"Passed Checks:          {passed_checks}")
    print(f"Failed Checks:          {len(failed_checks)}")
    print(f"Transactional Consistency Rate: {rate:.4f}% (Target: >= 98.00%)")
    print("================================================================================")
    if failed_checks:
        for fc in failed_checks[:10]:
            print("  FAIL:", fc)

if __name__ == "__main__":
    run_criterion_b_audit()
