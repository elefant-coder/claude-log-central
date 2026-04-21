from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

security = HTTPBearer(auto_error=False)


async def verify_admin_key(request: Request) -> None:
    """Verify admin API key for dashboard/management endpoints."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth.removeprefix("Bearer ")
    if token != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin API key")
