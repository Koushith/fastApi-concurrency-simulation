"""
Async Controller

Handles asynchronous report generation - returns immediately with a
request ID, then processes in background and calls webhook when done.

FIFO ORDERING:
Requests are added to a queue and processed in strict FIFO order.
The queue_position field tracks the processing order.
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request, STATUS_PENDING, CALLBACK_PENDING
from src.services.background_worker import enqueue_job


async def handle_async_request(payload: dict, callback_url: str, db: AsyncSession, idempotency_key: Optional[str] = None) -> dict:
    """
    Process report asynchronously (non-blocking).

    FIFO Guarantee:
    - Requests are added to a FIFO queue
    - Single worker processes jobs in submission order
    - queue_position shows exact processing order

    Steps:
    1. Creates DB record with PENDING status
    2. Adds to FIFO queue (returns queue_position)
    3. Returns immediately with request ID and queue position
    4. Worker processes in order, calls webhook when complete
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

    # Add to FIFO queue - returns the queue position
    queue_position = enqueue_job(request.id)

    return {
        "request_id": request.id,
        "status": "pending",
        "queue_position": queue_position,
        "message": f"Report generation queued at position #{queue_position}. We will call you back at {callback_url}",
    }
