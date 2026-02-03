import os
import platform
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()

START_TIME = datetime.now(timezone.utc)


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    Returns minimal response in production, detailed info in development.
    """
    is_prod = os.getenv("ENV") == "production"

    if is_prod:
        return {"status": "healthy"}

    uptime = datetime.now(timezone.utc) - START_TIME

    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "version": "0.1.0",
        "environment": "development",
        "services": {
            "database": "connected",
        },
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
        },
        "system": {
            "os": platform.system(),
            "architecture": platform.machine(),
        },
    }
