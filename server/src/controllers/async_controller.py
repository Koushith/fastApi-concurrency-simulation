"""
Async Controller

Handles asynchronous report generation - returns immediately with a
request ID, then processes in background and calls webhook when done.
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request, STATUS_PENDING, CALLBACK_PENDING
from src.services.background_worker import process_job_in_background


async def handle_async_request(payload: dict, callback_url: str, db: AsyncSession, idempotency_key: Optional[str] = None) -> dict:
    """
    Process report asynchronously (non-blocking).

    - Creates DB record with PENDING status
    - Spawns background thread to generate report
    - Returns immediately with request ID
    - Webhook called when complete (with retry logic)
    """
    if not callback_url:
        raise HTTPException(
            status_code=400,
            detail="callback_url is required for async requests",
        )

    # Create DB record
    request = Request(
        mode="async",
        status=STATUS_PENDING,
        input_payload=payload,
        callback_url=callback_url,
        callback_status=CALLBACK_PENDING,
        idempotency_key=idempotency_key,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # Start background processing (no separate worker needed)
    process_job_in_background(request.id)

    return {
        "request_id": request.id,
        "status": "pending",
        "message": f"Report generation started. We will call you back at {callback_url}",
    }
