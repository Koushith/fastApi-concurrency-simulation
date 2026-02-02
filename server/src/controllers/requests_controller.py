"""
Requests Controller

CRUD operations for viewing and managing report requests.
"""

from typing import Literal, Optional

from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request


async def get_requests(
    mode: Optional[Literal["sync", "async"]],
    db: AsyncSession,
) -> dict:
    """Get all requests, optionally filtered by mode."""
    query = select(Request).order_by(Request.created_at.desc())

    if mode:
        query = query.where(Request.mode == mode)

    result = await db.execute(query)
    requests = result.scalars().all()

    return {
        "requests": [
            {
                "id": r.id,
                "mode": r.mode,
                "status": r.status,
                "callback_status": r.callback_status,
                "callback_attempts": r.callback_attempts,
                "idempotency_key": r.idempotency_key,
                "input_payload": r.input_payload,
                "result_payload": r.result_payload,
                "created_at": r.created_at.isoformat(),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in requests
        ]
    }


async def get_request_by_id(request_id: str, db: AsyncSession) -> dict:
    """Get single request by ID with full details."""
    result = await db.execute(select(Request).where(Request.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    return {
        "id": request.id,
        "mode": request.mode,
        "status": request.status,
        "input_payload": request.input_payload,
        "result_payload": request.result_payload,
        "callback_url": request.callback_url,
        "callback_status": request.callback_status,
        "callback_attempts": request.callback_attempts,
        "idempotency_key": request.idempotency_key,
        "created_at": request.created_at.isoformat(),
        "completed_at": request.completed_at.isoformat() if request.completed_at else None,
    }


async def delete_request_by_id(request_id: str, db: AsyncSession) -> dict:
    """Delete a single request by ID."""
    result = await db.execute(select(Request).where(Request.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    await db.delete(request)
    await db.commit()

    return {"deleted": True, "id": request_id}


async def delete_all_requests(db: AsyncSession) -> dict:
    """Delete all requests."""
    result = await db.execute(delete(Request))
    await db.commit()

    return {"deleted": True, "count": result.rowcount}
