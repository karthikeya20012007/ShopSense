# backend/tests/integration/conftest.py
"""Integration test fixtures for ShopSense.

- Verifies that the test database URL points to the exact database name ``shopsense_test``.
- Provides a helper ``assert_test_db`` that raises if the DB name is not correct.
- Re‑exports existing common fixtures (client, db_session, approved_vendor, admin_user, …) from the main test suite.
"""

import os
import re
from urllib.parse import urlparse
import pytest

from backend.app.core.config import settings

# ---------------------------------------------------------------------------
# Database safety verification
# ---------------------------------------------------------------------------

def _parse_db_name(database_url: str) -> str:
    """Extract the database name from a PostgreSQL DSN.

    Expected format: ``postgresql+psycopg2://user:pwd@host:port/<dbname>``
    Returns the ``<dbname>`` component or an empty string if it cannot be parsed.
    """
    try:
        parsed = urlparse(database_url)
        return parsed.path.lstrip('/')
    except Exception:
        return ""

@pytest.fixture(scope="session", autouse=True)
def assert_test_db():
    """Abort the entire test run if the configured test DB is not ``shopsense_test``.
    The fixture runs once per pytest session (autouse), so any violation stops further tests.
    """
    db_url = os.getenv("TEST_DATABASE_URL", getattr(settings, "TEST_DATABASE_URL", None))
    if not db_url:
        raise RuntimeError("TEST_DATABASE_URL is not defined – refusing to run integration tests.")
    db_name = _parse_db_name(db_url)
    if db_name != "shopsense_test":
        raise RuntimeError(
            f"Unsafe database configuration detected: expected database name 'shopsense_test', got '{db_name}'. "
            "Aborting integration tests to protect production data."
        )
    if not re.search(r"postgresql", db_url):
        raise RuntimeError("Integration tests require a PostgreSQL test database.")
    return True

# ---------------------------------------------------------------------------
# Re‑export existing fixtures for convenience
# ---------------------------------------------------------------------------

# Import fixtures from the core test suite so they are available in integration tests.
from backend.tests.conftest import (
    client,
    db_session,
    pending_vendor,
    pending_vendor_headers,
    approved_vendor,
    admin_user,
    approved_vendor_headers,
    admin_headers,
    customer_user,
    customer_headers,
    fresh_db_engine,
    fresh_db_session,
)

__all__ = [
    "client",
    "db_session",
    "pending_vendor",
    "pending_vendor_headers",
    "approved_vendor",
    "admin_user",
    "approved_vendor_headers",
    "admin_headers",
    "customer_user",
    "customer_headers",
    "assert_test_db",
    "fresh_db_engine",
    "fresh_db_session",
]
