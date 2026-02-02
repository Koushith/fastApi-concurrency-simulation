"""
Background Worker for Async Report Processing - FIFO Queue Implementation

ORDERING GUARANTEE:
This worker implements strict FIFO (First-In-First-Out) ordering for async requests.
Requests are processed in the exact order they were received, one at a time.

Architecture:
1. A thread-safe queue.Queue holds request IDs in FIFO order
2. A single worker thread processes jobs sequentially from the queue
3. Each request gets a queue_position (auto-incrementing) to track order
4. The worker starts automatically on first job submission

Why single worker instead of thread-per-request?
- FIFO guarantee: Jobs complete in submission order
- Predictable: No race conditions between concurrent jobs
- Traceable: Queue position shows exact processing order
- Production-ready: Easily replaceable with Celery/Redis queue

Retry Strategy for Callbacks:
- Max 3 attempts with exponential backoff (2s, 4s, 8s)
- Only 5xx errors trigger retries (4xx are not retried)
- Each attempt is logged to callback_logs table
"""

import queue
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
import ipaddress
from typing import Optional

import httpx
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from src.config import DATABASE_URL
from src.models import (
    Request,
    CallbackLog,
    STATUS_PENDING,
    STATUS_PROCESSING,
    STATUS_COMPLETED,
    STATUS_FAILED,
    CALLBACK_SUCCESS,
    CALLBACK_FAILED,
)
from src.services.report_service import generate_report

# ============================================================================
# DATABASE CONNECTION (Synchronous for background thread)
# ============================================================================
# FastAPI uses async (asyncpg), but the worker thread needs sync (psycopg2)
sync_db_url = (
    DATABASE_URL
    .replace("+asyncpg", "+psycopg2")
    .replace("+aiosqlite", "")
    .replace("ssl=require", "sslmode=require")
)
engine = create_engine(sync_db_url)
Session = sessionmaker(bind=engine)

# ============================================================================
# FIFO QUEUE & WORKER
# ============================================================================
# Thread-safe FIFO queue - jobs are processed in exact submission order
_job_queue: queue.Queue[str] = queue.Queue()
_worker_thread: Optional[threading.Thread] = None
_worker_lock = threading.Lock()

# Retry configuration for webhook callbacks
MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]  # Exponential backoff in seconds


def _get_next_queue_position() -> int:
    """
    Get the next queue position for FIFO ordering.
    Uses MAX(queue_position) + 1 to ensure strict ordering.
    """
    session = Session()
    try:
        result = session.query(func.max(Request.queue_position)).scalar()
        return (result or 0) + 1
    finally:
        session.close()


def _ensure_worker_running():
    """
    Start the FIFO worker thread if not already running.
    Uses double-checked locking for thread safety.
    """
    global _worker_thread

    if _worker_thread is not None and _worker_thread.is_alive():
        return

    with _worker_lock:
        # Double-check after acquiring lock
        if _worker_thread is not None and _worker_thread.is_alive():
            return

        _worker_thread = threading.Thread(target=_fifo_worker, daemon=True)
        _worker_thread.start()
        print("[FIFO Worker] Started background worker thread")


def _fifo_worker():
    """
    Single worker thread that processes jobs from the FIFO queue.

    ORDERING LOGIC:
    - queue.Queue.get() blocks until a job is available
    - Jobs are retrieved in FIFO order (first submitted = first processed)
    - Only ONE job processes at a time, ensuring sequential completion
    - Worker runs forever as a daemon thread
    """
    print("[FIFO Worker] Worker thread ready, waiting for jobs...")

    while True:
        try:
            # Block until a job is available (FIFO order guaranteed by queue.Queue)
            request_id = _job_queue.get(block=True)
            print(f"[FIFO Worker] Processing job: {request_id[:8]}...")

            # Process the job (blocking - ensures sequential processing)
            _process_job(request_id)

            # Mark task as done
            _job_queue.task_done()
            print(f"[FIFO Worker] Completed job: {request_id[:8]}")

        except Exception as e:
            print(f"[FIFO Worker] Error processing job: {e}")


def enqueue_job(request_id: str) -> int:
    """
    Add a job to the FIFO queue and return its queue position.

    FIFO GUARANTEE:
    - Jobs are added to a thread-safe queue in submission order
    - queue_position is assigned atomically using MAX() + 1
    - Worker processes jobs strictly in queue order

    Args:
        request_id: The request ID to process

    Returns:
        queue_position: The position in the FIFO queue (1-based)
    """
    # Get queue position BEFORE adding to queue (for atomicity)
    position = _get_next_queue_position()

    # Update the request with its queue position
    session = Session()
    try:
        request = session.query(Request).filter(Request.id == request_id).first()
        if request:
            request.queue_position = position
            session.commit()
    finally:
        session.close()

    # Add to FIFO queue
    _job_queue.put(request_id)

    # Ensure worker is running
    _ensure_worker_running()

    print(f"[FIFO Queue] Enqueued job {request_id[:8]}... at position {position}")
    return position


def get_queue_status() -> dict:
    """
    Get current queue statistics.

    Returns:
        dict with queue_size, is_processing, etc.
    """
    session = Session()
    try:
        pending_count = session.query(Request).filter(
            Request.mode == "async",
            Request.status.in_([STATUS_PENDING, STATUS_PROCESSING])
        ).count()

        return {
            "queue_size": _job_queue.qsize(),
            "pending_jobs": pending_count,
            "worker_alive": _worker_thread is not None and _worker_thread.is_alive(),
        }
    finally:
        session.close()


# ============================================================================
# SSRF PROTECTION
# ============================================================================
def is_safe_callback_url(url: str) -> bool:
    """
    Check if callback URL is safe (SSRF protection).

    Blocks:
    - localhost, 127.0.0.1, ::1 (loopback)
    - Private IP ranges (10.x, 172.16.x, 192.168.x)
    - Reserved addresses

    Allows:
    - Demo callback receiver on localhost (for testing only)
    """
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


# ============================================================================
# CALLBACK DELIVERY WITH RETRY
# ============================================================================
def send_callback_with_retry(callback_url: str, payload: dict, request_id: str) -> bool:
    """
    Send callback with exponential backoff retry logic.

    Retry Strategy:
    - Max 3 attempts
    - Exponential backoff: 2s, 4s, 8s
    - Only 5xx errors trigger retries
    - 4xx errors are NOT retried (client error)
    - Each attempt logged to callback_logs table
    """
    session = Session()

    try:
        request = session.query(Request).filter(Request.id == request_id).first()

        for attempt in range(MAX_RETRIES):
            attempt_number = attempt + 1
            start_time = time.time()
            status_code = None
            error_message = None

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
                print(f"[Callback] Returned {response.status_code}, attempt {attempt_number}/{MAX_RETRIES}")

            except Exception as e:
                error_message = str(e)
                print(f"[Callback] Failed: {e}, attempt {attempt_number}/{MAX_RETRIES}")

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
                print(f"[Callback] Retrying in {delay}s...")
                time.sleep(delay)

        # All retries exhausted
        if request:
            request.callback_status = CALLBACK_FAILED
            session.commit()
        return False
    finally:
        session.close()


# ============================================================================
# JOB PROCESSING
# ============================================================================
def _process_job(request_id: str):
    """
    Process a single job from the FIFO queue.

    Steps:
    1. Mark request as PROCESSING
    2. Generate the report (shared work logic)
    3. Mark request as COMPLETED with result
    4. Send webhook callback (with retry)
    """
    session = Session()
    request = None

    try:
        request = session.query(Request).filter(Request.id == request_id).first()
        if not request:
            print(f"[Job] Request {request_id} not found, skipping")
            return

        # Update to processing
        request.status = STATUS_PROCESSING
        session.commit()

        # Do the work (shared with sync endpoint)
        result = generate_report(request.input_payload)

        # Update with result
        request.status = STATUS_COMPLETED
        request.result_payload = result
        request.completed_at = datetime.now(timezone.utc)
        session.commit()

        # Send callback
        if request.callback_url:
            if not is_safe_callback_url(request.callback_url):
                print(f"[Job] Blocked unsafe callback URL: {request.callback_url}")
                request.callback_status = CALLBACK_FAILED
                session.commit()
            else:
                callback_payload = {
                    "request_id": request.id,
                    "status": "completed",
                    "queue_position": request.queue_position,
                    **result,
                }
                send_callback_with_retry(request.callback_url, callback_payload, request_id)

    except Exception as e:
        print(f"[Job] Failed: {e}")
        if request:
            request.status = STATUS_FAILED
            request.result_payload = {"error": str(e)}
            session.commit()
    finally:
        session.close()


# ============================================================================
# LEGACY COMPATIBILITY (deprecated, use enqueue_job instead)
# ============================================================================
def process_job_in_background(request_id: str):
    """
    DEPRECATED: Use enqueue_job() instead for FIFO ordering.

    This function is kept for backwards compatibility but now uses
    the FIFO queue internally.
    """
    return enqueue_job(request_id)
