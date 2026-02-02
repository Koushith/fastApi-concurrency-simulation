# Project Specification: Sync vs Async API (Request Storm Handler)

## 1. Project Overview

Build a high-concurrency Python backend (FastAPI) that demonstrates the difference between **Synchronous** (blocking) and **Asynchronous** (non-blocking/callback) architectures under heavy load.

**The "Work" Simulation:**
The system simulates a "Monthly Financial Report Generator." This task is CPU-intensive (hashing) and I/O-intensive (simulated DB delays).

**Key Goals:**

1. **Sync Endpoint:** Fails/timeouts under high load.
2. **Async Endpoint:** Accepts 1000+ RPS immediately; processes in background; triggers webhook callbacks.
3. **Reliability:** Persist state, retry failed callbacks, and prevent SSRF.

---

## 2. Architecture & Tech Stack

### Stack


* **Framework:** FastAPI (for the REST API)
* **Queue/Worker:** Redis (Redis Queue)
* **Database:** SQLite (with SQLAlchemy Async)
* **Containerization:** Docker & Docker Compose

### Architecture Flow

1. **Client** sends HTTP Request.
2. **Controller** validates input.
3. **Service Layer:**
* *If Sync:* Executes `ReportService.generate_report` immediately (blocking).
* *If Async:* Creates a DB record (`PENDING`), pushes job to Redis, returns `202 Accepted`.


4. **Worker (Background):**
* Pulls job from Redis.
* Executes `ReportService.generate_report`.
* Updates DB record to `COMPLETED`.
* Sends HTTP POST to `callback_url`.



---

## 3. Folder Structure (Node.js Style)

The project must follow this specific directory structure to mimic modular Node.js patterns:

```text
root/
├── docker-compose.yml       # Redis + API + Worker definition
├── requirements.txt         # Dependencies
├── src/
│   ├── __init__.py
│   ├── config.py            # Envs (REDIS_URL, DB_URL)
│   ├── app.py               # FastAPI App Entry point
│   ├── database.py          # SQLAlchemy setup & Session factory
│   │
│   ├── models/              # Database Schemas
│   │   ├── __init__.py
│   │   └── request_model.py # The 'Request' table definition
│   │
│   ├── controllers/         # HTTP Handlers (Route Logic)
│   │   ├── __init__.py
│   │   ├── sync_controller.py
│   │   └── async_controller.py
│   │
│   ├── services/            # Business Logic (The "Work")
│   │   ├── __init__.py
│   │   ├── report_service.py # The Simulation Logic (CPU/IO bound)
│   │   └── queue_service.py  # Wrapper for Redis/RQ interactions
│   │
│   ├── routes/              # API Route definitions
│   │   ├── __init__.py
│   │   └── api_routes.py
│   │
│   └── workers/             # Background Worker Logic
│       ├── __init__.py
│       └── callback_worker.py # The actual RQ Worker script
│
└── tests/
    └── load_generator.py    # The "Attacker" + "Listener" script

```

---

## 4. Database Schema (SQLite)

**Table:** `requests`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | String (UUID) | Primary Key | Unique Job ID. |
| `mode` | String | `sync` or `async` | Usage tracking. |
| `status` | String | Index | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`. |
| `input_payload` | JSON |  | Stores the original request params. |
| `result_payload` | JSON | Nullable | Stores the generated "Report" data. |
| `callback_url` | String | Nullable | The user's webhook URL. |
| `created_at` | DateTime |  | Timestamp of receipt. |
| `completed_at` | DateTime | Nullable | Timestamp of completion. |

---

## 5. Core Business Logic ("The Work")

**File:** `src/services/report_service.py`

Implement a function `generate_report(payload: dict)`.

* **Input:** `{"records": 500, "report_name": "Q1_Finance"}`
* **Logic:**
1. Create a deterministic random seed based on `report_name` (so the same name always produces the same "data").
2. Loop `records` times (e.g., 500 times).
3. Inside the loop:
* **Simulate I/O:** `time.sleep(0.01)` (10ms delay per record).
* **Simulate CPU:** Perform `hashlib.sha256` on the loop index.


4. Aggregate the hashes.


* **Output:** A JSON object with `report_id`, `status`, and `checksum`.
* **Performance Target:**
* 10 records = Instant.
* 1000 records = ~10 seconds (This forces Sync to timeout).



---

## 6. API Endpoints

**File:** `src/routes/api_routes.py`

### POST `/sync`

* **Behavior:** Calls `report_service.generate_report` directly.
* **Response:** Returns the full Report JSON.
* **Validation:** Ensure `records` < 50 (Sync shouldn't allow huge jobs).

### POST `/async`

* **Behavior:**
1. Validate input.
2. Create DB row (`status="PENDING"`).
3. Push job to Redis Queue (Queue name: `high_priority`).
4. Return immediately.


* **Response:** `202 Accepted`
```json
{
  "request_id": "uuid-1234",
  "status": "pending",
  "message": "Report generation started. We will call you back at [callback_url]"
}

```



### GET `/requests/{id}`

* **Behavior:** Fetch row from DB.
* **Response:** JSON showing current status and result (if completed).

### GET `/healthz`

* **Behavior:** Check connection to Redis and DB. Return `200 OK`.

---

## 7. The Worker & Callback System (Edge Cases)

**File:** `src/workers/callback_worker.py`

This script runs outside the API (via `python -m src.workers.callback_worker`).

**Workflow:**

1. **Dequeue:** Pick up job from Redis.
2. **Update DB:** Set status to `PROCESSING`.
3. **Execute:** Run `report_service.generate_report`.
4. **Callback Logic (Crucial):**
* Validate `callback_url` (Prevent `localhost` / private IP ranges to avoid SSRF).
* Send `POST` request with the Report JSON.
* **Retry Logic:** If the callback fails (500 error or timeout), retry 3 times with exponential backoff (2s, 4s, 8s).


5. **Finalize:** Update DB status to `COMPLETED` (or `FAILED` if retries exhaust).

---

## 8. The Load Generator (Testing)

**File:** `tests/load_generator.py`

This must be a standalone script that performs **The Demo**:

1. **Local Server:** Starts a temporary HTTP server (on port 8001) to listen for callbacks.
2. **Sync Test:**
* Fires 50 concurrent requests to `/sync`.
* Measures P95 Latency. (Expect: High latency / Timeouts).


3. **Async Test:**
* Fires 50 concurrent requests to `/async` with `callback_url="http://localhost:8001/webhook"`.
* Measures "Time to Ack" (Expect: < 100ms).
* Measures "Time to Callback" (Expect: ~Total processing time).


4. **Output:** Prints a neat summary table to the console.

---

## 9. Infrastructure (Docker)

**File:** `docker-compose.yml`

Define 3 services:

1. **`redis`**: Standard Redis Alpine image.
2. **`api`**: Runs `uvicorn src.app:app --reload`. Exposes port 8000.
3. **`worker`**: Runs `python -m src.workers.callback_worker`. Depends on `redis`.

Use a shared volume so code changes reflect instantly.