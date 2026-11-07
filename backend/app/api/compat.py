from fastapi import APIRouter

# Compatibility router to expose root‑level routes for backward compatibility
# This router re‑includes all version‑1 feature routers without the /api/v1 prefix.
# The individual routers already define their own prefixes (e.g., /inventory, /orders).
# By including them here we ensure they are registered on the main FastAPI app
# even if the primary api_router is not mounted.

router = APIRouter()

# Import feature routers
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.inventory import router as inventory_router
from backend.app.api.v1.orders import router as orders_router
from backend.app.api.v1.vendors import router as vendors_router
from backend.app.api.v1.products import router as products_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.customers import router as customers_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.customer_analytics import router as customer_analytics_router
from backend.app.api.v1.recommendations import router as recommendations_router

# Include all routers – they retain their own prefixes
router.include_router(auth_router)
router.include_router(inventory_router)
router.include_router(orders_router)
router.include_router(vendors_router)
router.include_router(products_router)
router.include_router(admin_router)
router.include_router(customers_router)
router.include_router(analytics_router)
router.include_router(customer_analytics_router)
router.include_router(recommendations_router)
