# backend/tests/integration/test_routes.py
"""Integration tests for verifying router registration and duplicate routes.
These tests ensure that both root-level compatibility routes (e.g., `/inventory/...`) and
`/api/v1` prefixed routes exist as intended, and that there are no duplicate method/path
combinations.
"""

import json
import pytest
from fastapi.routing import APIRoute

# The `client` fixture and `assert_test_db` safety check are provided by integration conftest.

def test_route_registration(client, assert_test_db):
    # Import the FastAPI app
    from backend.app.main import app

    # Collect all APIRoute entries including nested / included routers
    routes = []
    def extract_routes(route_list, prefix=""):
        for r in route_list:
            if hasattr(r, "routes"):
                extract_routes(r.routes, prefix)
            elif hasattr(r, "original_router"):
                pfx = getattr(getattr(r, "include_context", None), "prefix", "")
                extract_routes(r.original_router.routes, prefix + pfx)
            elif isinstance(r, APIRoute):
                routes.append(type("ExtractedRoute", (), {"path": prefix + r.path, "methods": r.methods})())

    extract_routes(app.routes)

    # Build a set of (path, method) tuples
    path_method_set = set()
    duplicates = []
    for r in routes:
        for method in r.methods:
            key = (r.path, method)
            if key in path_method_set:
                duplicates.append(key)
            else:
                path_method_set.add(key)

    # Assert no duplicate method/path combos
    assert not duplicates, f"Duplicate routes detected: {duplicates}"

    # Helper to check existence of a path with any method
    def has_path(prefix: str) -> bool:
        return any(r.path.startswith(prefix) for r in routes)

    # Verify that root-level inventory routes exist (compatibility)
    assert has_path("/inventory"), "Root-level /inventory routes missing"
    # Verify that API‑v1 prefixed inventory routes exist
    assert has_path("/api/v1/inventory"), "/api/v1/inventory routes missing"

    # Verify that root-level orders routes exist
    assert has_path("/orders"), "Root-level /orders routes missing"
    # Verify that API‑v1 prefixed orders routes exist
    assert has_path("/api/v1/orders"), "/api/v1/orders routes missing"

    # Optional: Output the full route table for debugging (not asserted)
    # print(json.dumps([{"path": r.path, "methods": list(r.methods)} for r in routes], indent=2))
