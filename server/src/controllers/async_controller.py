"""
Async Controller

Handles asynchronous report generation - returns immediately with a
request ID, then processes in background and calls webhook when done.

FIFO ORDERING:
Requests are added to a queue and processed in strict FIFO order.
The queue_position field tracks the processing order.
"""

import threading
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func, select
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
    2. Returns 202 IMMEDIATELY with request ID
    3. Enqueues job in background (non-blocking)
    4. Worker processes in order, calls webhook when complete
    """
    if not callback_url:
        raise HTTPException(
            status_code=400,
            detail="callback_url is required for async requests",
        )

    # Get next queue position (simple global increment)
    result = await db.execute(select(func.max(Request.queue_position)))
    queue_position = (result.scalar() or 0) + 1

    # Create DB record with queue_position already set
    request = Request(
        mode="async",
        status=STATUS_PENDING,
        input_payload=payload,
        callback_url=callback_url,
        callback_status=CALLBACK_PENDING,
        idempotency_key=idempotency_key,
        queue_position=queue_position,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # Enqueue job in background thread - DON'T BLOCK THE RESPONSE
    request_id = request.id
    threading.Thread(target=enqueue_job, args=(request_id,), daemon=True).start()

    # Return 202 IMMEDIATELY with queue_position
    return {
        "request_id": request.id,
        "queue_position": queue_position,
        "status": "pending",
        "message": f"Report generation queued (#{queue_position}). We will call you back at {callback_url}",
    }
