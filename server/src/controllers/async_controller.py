from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request, STATUS_PENDING
from src.services.queue_service import enqueue_job


async def handle_async_request(payload: dict, callback_url: str, db: AsyncSession) -> dict:
    """
    Handle asynchronous request - queues work, returns immediately.
    Worker will process and call back.
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
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # Queue job for background processing
    enqueue_job(
        "src.workers.callback_worker.process_async_job",
        request.id,
    )

    return {
        "request_id": request.id,
        "status": "pending",
        "message": f"Report generation started. We will call you back at {callback_url}",
    }
