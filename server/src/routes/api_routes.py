"""
Core API Routes

Endpoints:
- POST /sync  - Synchronous report generation (blocks until complete)
- POST /async - Asynchronous report generation (returns immediately, webhook callback)
- GET/DELETE /requests - Request management
- GET /reports/{file} - Download generated CSV files
- GET /requests/{id}/callback-logs - View webhook delivery attempts
"""

import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.controllers.sync_controller import handle_sync_request
from src.controllers.async_controller import handle_async_request
from src.controllers.requests_controller import get_requests, get_request_by_id, delete_request_by_id, delete_all_requests
from src.database import get_db
from src.models import CallbackLog, Request as RequestModel

router = APIRouter()

# Rate limiter - tracks requests per IP
limiter = Limiter(key_func=get_remote_address)

# Directory where generated CSV reports are stored
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "reports")


# --- Request Schemas ---

class ReportPayload(BaseModel):
    """Input for report generation."""
    num_transactions: int = 50
    report_name: str = "Monthly_Report"


class AsyncRequestBody(BaseModel):
    """Input for async endpoint (includes callback URL)."""
    payload: ReportPayload
    callback_url: str


@router.post("/sync")
@limiter.limit("30/minute")
async def sync_endpoint(
    request: Request,  # Required by rate limiter to get client IP
    payload: ReportPayload,
    db: AsyncSession = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    """
    Synchronous endpoint - blocks until report generation completes.

    Rate limit: 30 requests/minute per IP
    Idempotency: Pass X-Idempotency-Key header to prevent duplicate processing
    """
    # Check for existing request with same idempotency key
    if x_idempotency_key:
        result = await db.execute(
            select(RequestModel).where(RequestModel.idempotency_key == x_idempotency_key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return {
                "status": "duplicate",
                "message": "Request with this idempotency key already exists",
                "request_id": existing.id,
                "original_result": existing.result_payload,
            }

    return await handle_sync_request(payload.model_dump(), db, idempotency_key=x_idempotency_key)


@router.post("/async", status_code=202)
@limiter.limit("60/minute")
async def async_endpoint(
    request: Request,  # Required by rate limiter to get client IP
    body: AsyncRequestBody,
    db: AsyncSession = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    """
    Asynchronous endpoint - returns immediately with request ID.
    Report is generated in background, webhook called when complete.

    Rate limit: 60 requests/minute per IP
    Idempotency: Pass X-Idempotency-Key header to prevent duplicate processing
    """
    # Check for existing request with same idempotency key
    if x_idempotency_key:
        result = await db.execute(
            select(RequestModel).where(RequestModel.idempotency_key == x_idempotency_key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return {
                "status": "duplicate",
                "message": "Request with this idempotency key already exists",
                "request_id": existing.id,
            }

    return await handle_async_request(
        body.payload.model_dump(),
        body.callback_url,
        db,
        idempotency_key=x_idempotency_key,
    )


@router.get("/requests")
async def list_requests(
    mode: Optional[Literal["sync", "async"]] = None,
    db: AsyncSession = Depends(get_db),
):
    """List recent requests, optionally filtered by mode."""
    return await get_requests(mode, db)


@router.get("/requests/{request_id}")
async def get_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single request by ID."""
    return await get_request_by_id(request_id, db)


@router.delete("/requests/{request_id}")
async def delete_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single request by ID."""
    return await delete_request_by_id(request_id, db)


@router.delete("/requests")
async def delete_requests(
    db: AsyncSession = Depends(get_db),
):
    """Delete all requests."""
    return await delete_all_requests(db)


@router.get("/reports/{file_name}")
async def download_report(file_name: str):
    """Download a generated report file."""
    file_path = os.path.join(REPORTS_DIR, file_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="text/csv",
    )


@router.get("/requests/{request_id}/callback-logs")
async def get_callback_logs(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get callback attempt logs for a request."""
    result = await db.execute(
        select(CallbackLog)
        .where(CallbackLog.request_id == request_id)
        .order_by(CallbackLog.attempt_number)
    )
    logs = result.scalars().all()

    return {
        "request_id": request_id,
        "total_attempts": len(logs),
        "logs": [
            {
                "attempt_number": log.attempt_number,
                "status_code": log.status_code,
                "success": log.success,
                "error_message": log.error_message,
                "response_time_ms": log.response_time_ms,
                "attempted_at": log.attempted_at.isoformat() if log.attempted_at else None,
            }
            for log in logs
        ],
    }
