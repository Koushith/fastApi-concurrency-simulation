import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from sqlalchemy import JSON, Index, String, Integer
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base

# Type aliases (like TypeScript)
RequestMode = Literal["sync", "async"]
RequestStatus = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED"]
CallbackStatus = Literal["PENDING", "SUCCESS", "FAILED"]

# Constants
STATUS_PENDING = "PENDING"
STATUS_PROCESSING = "PROCESSING"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"

CALLBACK_PENDING = "PENDING"
CALLBACK_SUCCESS = "SUCCESS"
CALLBACK_FAILED = "FAILED"


# SQLAlchemy model (class required by ORM)
class Request(Base):
    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    mode: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default=STATUS_PENDING)
    input_payload: Mapped[dict] = mapped_column(JSON)
    result_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    callback_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    callback_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    callback_attempts: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_requests_status", "status"),
        Index("ix_requests_idempotency_key", "idempotency_key"),
    )
