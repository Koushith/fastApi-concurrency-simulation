import ipaddress
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.config import DATABASE_URL
from src.models import Request, STATUS_PROCESSING, STATUS_COMPLETED, STATUS_FAILED
from src.services.report_service import generate_report

# Sync engine for worker (RQ workers don't support async)
sync_db_url = DATABASE_URL.replace("+aiosqlite", "")
engine = create_engine(sync_db_url)
Session = sessionmaker(bind=engine)


# SSRF Protection - block private/local IPs
BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}
PRIVATE_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]


def is_url_safe(url: str) -> bool:
    """Check if URL is safe (not pointing to internal resources)."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname

        if not host:
            return False

        # Block known local hostnames
        if host.lower() in BLOCKED_HOSTS:
            return False

        # Try to resolve and check if IP is private
        try:
            ip = ipaddress.ip_address(host)
            for private_range in PRIVATE_IP_RANGES:
                if ip in private_range:
                    return False
        except ValueError:
            # Not an IP, it's a hostname - could still resolve to private IP
            # In production, you'd want to resolve DNS and check
            pass

        return True
    except Exception:
        return False


def send_callback(url: str, payload: dict, max_retries: int = 3) -> bool:
    """
    Send callback with exponential backoff retry.
    Retries: 2s, 4s, 8s
    """
    if not is_url_safe(url):
        print(f"SSRF blocked: {url}")
        return False

    delays = [2, 4, 8]  # exponential backoff

    for attempt in range(max_retries):
        try:
            response = httpx.post(url, json=payload, timeout=10)
            if response.status_code < 400:
                print(f"Callback success: {url}")
                return True
            print(f"Callback failed (HTTP {response.status_code}), attempt {attempt + 1}")
        except Exception as e:
            print(f"Callback error: {e}, attempt {attempt + 1}")

        if attempt < max_retries - 1:
            time.sleep(delays[attempt])

    return False


def process_async_job(request_id: str):
    """
    Main worker function - processes async job and sends callback.
    Called by RQ worker.
    """
    session = Session()

    try:
        # Fetch request
        request = session.query(Request).filter(Request.id == request_id).first()
        if not request:
            print(f"Request not found: {request_id}")
            return

        # Update status to processing
        request.status = STATUS_PROCESSING
        session.commit()

        # Do the work
        result = generate_report(request.input_payload)

        # Update with result
        request.result_payload = result
        request.completed_at = datetime.now(timezone.utc)

        # Send callback
        if request.callback_url:
            callback_payload = {
                "request_id": request.id,
                "status": "completed",
                **result,
            }
            callback_success = send_callback(request.callback_url, callback_payload)

            if callback_success:
                request.status = STATUS_COMPLETED
            else:
                request.status = STATUS_FAILED
                request.result_payload["callback_error"] = "Failed after 3 retries"
        else:
            request.status = STATUS_COMPLETED

        session.commit()
        print(f"Job completed: {request_id}")

    except Exception as e:
        print(f"Job failed: {request_id}, error: {e}")
        request.status = STATUS_FAILED
        request.result_payload = {"error": str(e)}
        session.commit()

    finally:
        session.close()


if __name__ == "__main__":
    # Run as RQ worker
    from redis import Redis
    from rq import Worker, Queue

    from src.config import REDIS_URL

    redis_conn = Redis.from_url(REDIS_URL)
    queue = Queue("high_priority", connection=redis_conn)

    worker = Worker([queue], connection=redis_conn)
    print("Worker started, waiting for jobs...")
    worker.work()
