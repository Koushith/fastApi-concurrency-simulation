import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from sqlalchemy import JSON, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base

# Type aliases (like TypeScript)
RequestMode = Literal["sync", "async"]
RequestStatus = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED"]

# Constants
STATUS_PENDING = "PENDING"
STATUS_PROCESSING = "PROCESSING"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"


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
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (Index("ix_requests_status", "status"),)
