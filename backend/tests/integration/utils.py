# backend/tests/integration/utils.py
"""Utility helpers for integration tests.

- ``executed_routes``: a thread‑safe set that records each path/method pair exercised
  during the integration suite. Tests should call ``record_route(path, method)``
  after a successful request.
- ``record_route``: adds a tuple ``(method, path)`` to the set.
- ``get_executed``: returns a copy of the set for reporting.
"""
import threading
from typing import Set, Tuple

_executed_lock = threading.Lock()
_executed_routes: Set[Tuple[str, str]] = set()

def record_route(method: str, path: str) -> None:
    """Record that the given ``method``/``path`` was exercised.

    The function is safe to call from any test thread.
    """
    with _executed_lock:
        _executed_routes.add((method.upper(), path))

def get_executed() -> Set[Tuple[str, str]]:
    """Return a snapshot of the exercised routes set."""
    with _executed_lock:
        return set(_executed_routes)
