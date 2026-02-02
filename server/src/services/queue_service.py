from redis import Redis
from rq import Queue

from src.config import REDIS_URL

# Redis connection
redis_conn = Redis.from_url(REDIS_URL)

# Queue for async jobs
job_queue = Queue("high_priority", connection=redis_conn)


def enqueue_job(func, *args, **kwargs):
    """Add a job to the queue."""
    return job_queue.enqueue(func, *args, **kwargs)


def get_queue_length() -> int:
    """Get number of pending jobs."""
    return len(job_queue)


def is_redis_healthy() -> bool:
    """Check if Redis connection is alive."""
    try:
        redis_conn.ping()
        return True
    except Exception:
        return False
