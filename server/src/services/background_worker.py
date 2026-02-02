"""
Background Worker for Async Report Processing

Uses threads instead of multiprocessing to avoid fork issues on macOS.
Each async request spawns a thread that:
1. Generates the report (CPU-bound work)
2. Sends webhook callback with retry logic

Retry Strategy:
- Max 3 attempts with exponential backoff (2s, 4s, 8s)
- Only 5xx errors trigger retries (4xx are not retried)
- Each attempt is logged to callback_logs table
"""

import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
import ipaddress

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.config import DATABASE_URL
from src.models import (
    Request,
    CallbackLog,
    STATUS_PROCESSING,
    STATUS_COMPLETED,
    STATUS_FAILED,
    CALLBACK_SUCCESS,
    CALLBACK_FAILED,
)
from src.services.report_service import generate_report

# Synchronous DB connection for background threads
# FastAPI uses async (asyncpg), but threads need sync (psycopg2)
sync_db_url = (
    DATABASE_URL
    .replace("+asyncpg", "+psycopg2")
    .replace("+aiosqlite", "")
    .replace("ssl=require", "sslmode=require")
)
engine = create_engine(sync_db_url)
Session = sessionmaker(bind=engine)

# Retry configuration for webhook callbacks
MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]  # Exponential backoff in seconds


def is_safe_callback_url(url: str) -> bool:
    """Check if callback URL is safe (SSRF protection)."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        path = parsed.path

        if not hostname:
            return False

        # Allow demo callback receiver on localhost (for demo purposes)
        if hostname in ("localhost", "127.0.0.1") and "/api/callbacks/receive" in path:
            return True

        # Block localhost variations
        if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False

        # Try to resolve and check if it's a private IP
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                return False
        except ValueError:
            # Not an IP address, it's a hostname - allow it
            pass

        return True
    except Exception:
        return False


def send_callback_with_retry(callback_url: str, payload: dict, request_id: str) -> bool:
    """Send callback with exponential backoff retry logic. Logs each attempt."""
    session = Session()

    try:
        request = session.query(Request).filter(Request.id == request_id).first()

        for attempt in range(MAX_RETRIES):
            attempt_number = attempt + 1
            start_time = time.time()
            status_code = None
            error_message = None
            success = False

            try:
                # Update attempt count on request
                if request:
                    request.callback_attempts = attempt_number
                    session.commit()

                response = httpx.post(
                    callback_url,
                    json=payload,
                    timeout=10,
                )
                status_code = response.status_code
                response_time_ms = int((time.time() - start_time) * 1000)

                if response.status_code < 500:
                    # Success or client error (don't retry 4xx)
                    success = True
                    if request:
                        request.callback_status = CALLBACK_SUCCESS
                        session.commit()

                    # Log successful attempt
                    log = CallbackLog(
                        request_id=request_id,
                        attempt_number=attempt_number,
                        status_code=status_code,
                        success=True,
                        response_time_ms=response_time_ms,
                    )
                    session.add(log)
                    session.commit()
                    return True

                error_message = f"Server returned {response.status_code}"
                print(f"Callback returned {response.status_code}, attempt {attempt_number}/{MAX_RETRIES}")

            except Exception as e:
                error_message = str(e)
                print(f"Callback failed: {e}, attempt {attempt_number}/{MAX_RETRIES}")

            # Log failed attempt
            response_time_ms = int((time.time() - start_time) * 1000)
            log = CallbackLog(
                request_id=request_id,
                attempt_number=attempt_number,
                status_code=status_code,
                success=False,
                error_message=error_message,
                response_time_ms=response_time_ms,
            )
            session.add(log)
            session.commit()

            # Wait before retry (except on last attempt)
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                print(f"Retrying in {delay}s...")
                time.sleep(delay)

        # All retries exhausted
        if request:
            request.callback_status = CALLBACK_FAILED
            session.commit()
        return False
    finally:
        session.close()


def process_job_in_background(request_id: str):
    """Process async job in a background thread."""
    thread = threading.Thread(target=_process_job, args=(request_id,))
    thread.start()


def _process_job(request_id: str):
    """Actual job processing."""
    session = Session()
    request = None

    try:
        request = session.query(Request).filter(Request.id == request_id).first()
        if not request:
            return

        # Update to processing
        request.status = STATUS_PROCESSING
        session.commit()

        # Do the work
        result = generate_report(request.input_payload)

        # Update with result
        request.status = STATUS_COMPLETED
        request.result_payload = result
        request.completed_at = datetime.now(timezone.utc)
        session.commit()

        # Send callback
        if request.callback_url:
            if not is_safe_callback_url(request.callback_url):
                print(f"Blocked unsafe callback URL: {request.callback_url}")
                request.callback_status = CALLBACK_FAILED
                session.commit()
            else:
                callback_payload = {
                    "request_id": request.id,
                    "status": "completed",
                    **result,
                }
                send_callback_with_retry(request.callback_url, callback_payload, request_id)

    except Exception as e:
        print(f"Job failed: {e}")
        if request:
            request.status = STATUS_FAILED
            request.result_payload = {"error": str(e)}
            session.commit()
    finally:
        session.close()
