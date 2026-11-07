from fastapi import APIRouter
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.vendors import router as vendors_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.products import router as products_router
from backend.app.api.v1.customers import router as customers_router
from backend.app.api.v1.orders import router as orders_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.inventory import router as inventory_router
from backend.app.api.v1.customer_analytics import router as customer_analytics_router
from backend.app.api.v1.recommendations import router as recommendations_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(vendors_router)
api_router.include_router(admin_router)
api_router.include_router(products_router)
api_router.include_router(customers_router)
api_router.include_router(orders_router)
api_router.include_router(analytics_router)
api_router.include_router(inventory_router)
api_router.include_router(customer_analytics_router)
api_router.include_router(recommendations_router)





