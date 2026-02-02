import hashlib
import random
import time


def generate_report(payload: dict) -> dict:
    """
    Simulates CPU + I/O intensive work.

    Input: {"records": 500, "report_name": "Q1_Finance"}
    Output: {"report_id": "...", "status": "success", "checksum": "..."}

    Performance:
    - 10 records = instant
    - 1000 records = ~10 seconds
    """
    records = payload.get("records", 10)
    report_name = payload.get("report_name", "default")

    # Deterministic seed based on report_name
    seed = int(hashlib.md5(report_name.encode()).hexdigest()[:8], 16)
    random.seed(seed)

    hashes = []

    for i in range(records):
        # Simulate I/O delay (10ms per record)
        time.sleep(0.01)

        # Simulate CPU work (hash computation)
        data = f"{report_name}-{i}-{random.random()}"
        hash_result = hashlib.sha256(data.encode()).hexdigest()
        hashes.append(hash_result)

    # Aggregate final checksum
    combined = "".join(hashes)
    final_checksum = hashlib.sha256(combined.encode()).hexdigest()

    # Calculate processing time
    processing_time_ms = records * 10  # ~10ms per record

    return {
        "report_name": report_name,
        "records_processed": records,
        "processing_time_ms": processing_time_ms,
        "checksum": final_checksum[:16],  # shortened for readability
        "status": "success",
    }
