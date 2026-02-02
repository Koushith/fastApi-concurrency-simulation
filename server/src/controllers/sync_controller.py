from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request, STATUS_COMPLETED, STATUS_FAILED
from src.services.report_service import generate_report


async def handle_sync_request(payload: dict, db: AsyncSession) -> dict:
    """
    Handle synchronous request - executes work inline.
    Limit: records < 50 (sync shouldn't allow huge jobs)
    """
    records = payload.get("records", 10)

    if records >= 50:
        raise HTTPException(
            status_code=400,
            detail="Sync endpoint limited to < 50 records. Use /async for larger jobs.",
        )

    # Create DB record
    request = Request(
        mode="sync",
        input_payload=payload,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    try:
        # Execute work inline (blocking)
        result = generate_report(payload)

        # Update record
        request.status = STATUS_COMPLETED
        request.result_payload = result
        request.completed_at = datetime.now(timezone.utc)
        await db.commit()

        return {
            "request_id": request.id,
            "mode": "sync",
            "status": "completed",
            **result,  # flatten result into response
        }

    except Exception as e:
        request.status = STATUS_FAILED
        request.result_payload = {"error": str(e)}
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))
