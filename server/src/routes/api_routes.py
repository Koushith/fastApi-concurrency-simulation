from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from src.controllers.sync_controller import handle_sync_request
from src.controllers.async_controller import handle_async_request
from src.controllers.requests_controller import get_requests, get_request_by_id
from src.database import get_db

router = APIRouter()


# Request/Response schemas
class ReportPayload(BaseModel):
    records: int = 10
    report_name: str = "default"


class AsyncRequestBody(BaseModel):
    payload: ReportPayload
    callback_url: str


@router.post("/sync")
async def sync_endpoint(
    payload: ReportPayload,
    db: AsyncSession = Depends(get_db),
):
    """Synchronous endpoint - blocks until work completes."""
    return await handle_sync_request(payload.model_dump(), db)


@router.post("/async", status_code=202)
async def async_endpoint(
    body: AsyncRequestBody,
    db: AsyncSession = Depends(get_db),
):
    """Asynchronous endpoint - returns immediately, calls back later."""
    return await handle_async_request(
        body.payload.model_dump(),
        body.callback_url,
        db,
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
