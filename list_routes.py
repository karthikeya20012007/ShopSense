import sys, json
sys.path.append('C:/Users/HP/Desktop/ShopSense')
from backend.app.main import app
from fastapi.routing import APIRoute
routes = [r for r in app.routes if isinstance(r, APIRoute)]
print(json.dumps([{'path': r.path, 'methods': list(r.methods)} for r in routes], indent=2))
