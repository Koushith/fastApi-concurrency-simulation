"""
Benchmark Endpoints

Runs load tests to compare sync vs async API performance.
- /benchmark/sync - Test sync endpoint with concurrent requests
- /benchmark/async - Test async endpoint, optionally wait for callbacks
- /benchmark/both - Run both and return comparison with speedup metric
"""

import asyncio
import time

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from src.database import async_session
from src.controllers.sync_controller import handle_sync_request
from src.controllers.async_controller import handle_async_request
from src.models import Request
from src.config import SERVER_URL

router = APIRouter()


class BenchmarkConfig(BaseModel):
    """Configuration for benchmark tests."""
    concurrency: int = 20  # Number of concurrent requests
    num_transactions: int = 50  # Rows per report


class BenchmarkResult(BaseModel):
    mode: str
    total_requests: int
    successful: int
    failed: int
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float


class AsyncBenchmarkResult(BenchmarkResult):
    """Extended result for async with callback stats."""
    callbacks_received: int = 0
    avg_callback_ms: float = 0
    p50_callback_ms: float = 0
    p95_callback_ms: float = 0


def calculate_percentile(latencies: list[float], percentile: int) -> float:
    if not latencies:
        return 0
    sorted_latencies = sorted(latencies)
    index = int(len(sorted_latencies) * percentile / 100)
    return sorted_latencies[min(index, len(sorted_latencies) - 1)]


@router.post("/benchmark/sync")
async def benchmark_sync(config: BenchmarkConfig) -> BenchmarkResult:
    """Run sync benchmark - fires concurrent requests and measures latency."""
    latencies = []
    failed = 0

    async def run_single():
        nonlocal failed
        start = time.time()
        try:
            async with async_session() as db:
                await handle_sync_request(
                    {"num_transactions": config.num_transactions, "report_name": "benchmark"},
                    db,
                )
            latencies.append((time.time() - start) * 1000)
        except Exception:
            failed += 1
            latencies.append((time.time() - start) * 1000)

    await asyncio.gather(*[run_single() for _ in range(config.concurrency)])

    return BenchmarkResult(
        mode="sync",
        total_requests=config.concurrency,
        successful=config.concurrency - failed,
        failed=failed,
        avg_latency_ms=sum(latencies) / len(latencies) if latencies else 0,
        min_latency_ms=min(latencies) if latencies else 0,
        max_latency_ms=max(latencies) if latencies else 0,
        p50_ms=calculate_percentile(latencies, 50),
        p95_ms=calculate_percentile(latencies, 95),
        p99_ms=calculate_percentile(latencies, 99),
    )


@router.post("/benchmark/async")
async def benchmark_async(config: BenchmarkConfig, wait_for_callbacks: bool = False) -> AsyncBenchmarkResult:
    """Run async benchmark - measures time to acknowledgment and optionally callback times."""
    ack_latencies = []
    failed = 0
    request_ids = []
    request_start_times = {}

    async def run_single():
        nonlocal failed
        start = time.time()
        try:
            async with async_session() as db:
                result = await handle_async_request(
                    {"num_transactions": config.num_transactions, "report_name": "benchmark"},
                    f"{SERVER_URL}/api/callbacks/receive",
                    db,
                )
            ack_latencies.append((time.time() - start) * 1000)
            request_ids.append(result["request_id"])
            request_start_times[result["request_id"]] = start
        except Exception:
            failed += 1
            ack_latencies.append((time.time() - start) * 1000)

    await asyncio.gather(*[run_single() for _ in range(config.concurrency)])

    # Wait for callbacks if requested
    callback_latencies = []
    callbacks_received = 0

    if wait_for_callbacks and request_ids:
        max_wait = 30  # seconds
        poll_interval = 0.5
        waited = 0
        completed_ids = set()

        while waited < max_wait and len(completed_ids) < len(request_ids):
            await asyncio.sleep(poll_interval)
            waited += poll_interval

            async with async_session() as db:
                for req_id in request_ids:
                    if req_id in completed_ids:
                        continue
                    result = await db.execute(select(Request).where(Request.id == req_id))
                    req = result.scalar_one_or_none()
                    if req and req.callback_status == "SUCCESS":
                        callback_time = (time.time() - request_start_times[req_id]) * 1000
                        callback_latencies.append(callback_time)
                        completed_ids.add(req_id)
                        callbacks_received += 1

    return AsyncBenchmarkResult(
        mode="async",
        total_requests=config.concurrency,
        successful=config.concurrency - failed,
        failed=failed,
        avg_latency_ms=sum(ack_latencies) / len(ack_latencies) if ack_latencies else 0,
        min_latency_ms=min(ack_latencies) if ack_latencies else 0,
        max_latency_ms=max(ack_latencies) if ack_latencies else 0,
        p50_ms=calculate_percentile(ack_latencies, 50),
        p95_ms=calculate_percentile(ack_latencies, 95),
        p99_ms=calculate_percentile(ack_latencies, 99),
        callbacks_received=callbacks_received,
        avg_callback_ms=sum(callback_latencies) / len(callback_latencies) if callback_latencies else 0,
        p50_callback_ms=calculate_percentile(callback_latencies, 50),
        p95_callback_ms=calculate_percentile(callback_latencies, 95),
    )


@router.post("/benchmark/both")
async def benchmark_both(config: BenchmarkConfig) -> dict:
    """Run both benchmarks and return comparison."""
    test_start = time.time()

    # Run sync first (sequential internally but concurrent requests)
    sync_result = await benchmark_sync(config)

    # Run async with callback tracking
    async_result = await benchmark_async(config, wait_for_callbacks=True)

    test_duration_ms = (time.time() - test_start) * 1000
    speedup = sync_result.avg_latency_ms / async_result.avg_latency_ms if async_result.avg_latency_ms > 0 else 0

    return {
        "sync": sync_result,
        "async": async_result,
        "speedup": round(speedup, 1),
        "config": {
            "concurrency": config.concurrency,
            "num_transactions": config.num_transactions,
        },
        "test_duration_ms": round(test_duration_ms),
    }
