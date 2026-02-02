from typing import Literal, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Request


async def get_requests(
    mode: Optional[Literal["sync", "async"]],
    db: AsyncSession,
    limit: int = 50,
) -> list[dict]:
    """Get recent requests, optionally filtered by mode."""
    query = select(Request).order_by(Request.created_at.desc()).limit(limit)

    if mode:
        query = query.where(Request.mode == mode)

    result = await db.execute(query)
    requests = result.scalars().all()

    return [
        {
            "id": r.id,
            "mode": r.mode,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in requests
    ]


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
        "created_at": request.created_at.isoformat(),
        "completed_at": request.completed_at.isoformat() if request.completed_at else None,
    }
