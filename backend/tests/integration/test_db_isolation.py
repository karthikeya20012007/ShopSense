import uuid
from uuid import UUID
import pytest
from sqlalchemy import text
from backend.app.models.user import User
from backend.app.models.product import Product
from backend.app.models.stock_movement import StockMovement

# ---------------------------------------------------------------------------
# Database Safety & Isolation Verification
# ---------------------------------------------------------------------------

def test_database_connection_safety(db_session, fresh_db_session):
    """Verify that both test sessions connect exclusively to 'shopsense_test'."""
    db_name_1 = db_session.execute(text("SELECT current_database()")).scalar()
    assert db_name_1 == "shopsense_test", f"Unsafe database in db_session: {db_name_1}"

    db_name_2 = fresh_db_session.execute(text("SELECT current_database()")).scalar()
    assert db_name_2 == "shopsense_test", f"Unsafe database in fresh_db_session: {db_name_2}"


def test_api_product_commit_rollback_isolation(approved_vendor_headers, client, db_session, fresh_db_session):
    """Prove experimentally that API commits do not persist beyond test transaction boundaries."""
    unique_tag = str(uuid.uuid4())[:8]
    payload = {
        "title": f"Iso Product {unique_tag}",
        "description": "Isolation test product",
        "price": "49.99",
        "category": "Isolation",
        "sku": f"ISO-{unique_tag}",
        "stock_quantity": 25,
        "is_published": True
    }

    # Create product through HTTP API
    resp = client.post("/vendors/me/products", json=payload, headers=approved_vendor_headers)
    assert resp.status_code == 201
    product_id = UUID(resp.json()["id"])

    # Inside the active test transaction, the product is visible via db_session
    db_session.expire_all()
    in_tx_prod = db_session.query(Product).filter(Product.id == product_id).first()
    assert in_tx_prod is not None
    assert in_tx_prod.sku == f"ISO-{unique_tag}"

    # Independent connection CANNOT see uncommitted transaction data
    fresh_db_session.expire_all()
    uncommitted_prod = fresh_db_session.query(Product).filter(Product.id == product_id).first()
    assert uncommitted_prod is None, "Isolation failure: uncommitted API write visible to independent connection"

    # Explicitly rollback the active savepoint/transaction
    db_session.rollback()

    # Verify through independent fresh connection that the record has not persisted
    fresh_db_session.expire_all()
    persisted_prod = fresh_db_session.query(Product).filter(Product.id == product_id).first()
    assert persisted_prod is None, "Isolation failure: API commit persisted after transaction rollback"


def test_customer_registration_rollback_isolation(client, db_session, fresh_db_session):
    """Verify that customer registration commits do not persist into the physical database."""
    unique_tag = str(uuid.uuid4())[:8]
    unique_email = f"iso_cust_{unique_tag}@example.com"
    payload = {
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": f"Iso Customer {unique_tag}"
    }

    resp = client.post("/api/v1/auth/register/customer", json=payload)
    assert resp.status_code == 201
    user_id = UUID(resp.json()["id"])

    # In active session, user exists
    db_session.expire_all()
    user = db_session.query(User).filter(User.id == user_id).first()
    assert user is not None

    # Rollback transaction
    db_session.rollback()

    # Fresh independent session confirms non-persistence
    fresh_db_session.expire_all()
    persisted_user = fresh_db_session.query(User).filter(User.id == user_id).first()
    assert persisted_user is None, "Isolation failure: Customer registration persisted after rollback"


def test_stock_adjustment_ledger_isolation(admin_headers, approved_vendor_headers, client, db_session, fresh_db_session):
    """Verify that stock ledger writes do not leak across sessions."""
    unique_tag = str(uuid.uuid4())[:8]
    prod_payload = {
        "title": f"Ledger Iso {unique_tag}",
        "description": "Stock ledger test",
        "price": "19.99",
        "category": "Isolation",
        "sku": f"LEDG-{unique_tag}",
        "stock_quantity": 50,
        "is_published": True
    }
    prod_resp = client.post("/vendors/me/products", json=prod_payload, headers=approved_vendor_headers)
    assert prod_resp.status_code == 201
    product_id = UUID(prod_resp.json()["id"])

    adj_payload = {
        "product_id": str(product_id),
        "quantity": 10,
        "adjustment_type": "SHRINKAGE",
        "reason": f"Audit test {unique_tag}"
    }
    adj_resp = client.post("/inventory/admin/stock-adjustment", json=adj_payload, headers=admin_headers)
    assert adj_resp.status_code == 200

    # Rollback transaction
    db_session.rollback()

    # Fresh independent connection verifies no movements persisted
    fresh_db_session.expire_all()
    movement = fresh_db_session.query(StockMovement).filter(StockMovement.product_id == product_id).first()
    assert movement is None, "Isolation failure: StockMovement ledger entry persisted after rollback"
