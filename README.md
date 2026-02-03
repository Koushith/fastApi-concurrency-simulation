# Financial Report Generator

Simulates a **financial report generation system** - the kind you'd see in fintech platforms where users request reports that take time to generate.

Demonstrates two API patterns: **Sync** (blocking) vs **Async** (webhook callback) with production-ready features like FIFO ordering, retry logic, and rate limiting.

![Python](https://img.shields.io/badge/python-3.11+-green)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-orange)
![React](https://img.shields.io/badge/react-18+-blue)

---

## Requirements Checklist

### Core Requirements

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| `POST /sync` - returns result inline | ✅ | Blocks until report generated |
| `POST /async` - returns ack, calls callback later | ✅ | Returns `request_id` + `queue_position` |
| Shared work logic between sync/async | ✅ | `report_generator.py` used by both |
| Query recent requests | ✅ | `GET /requests?mode=sync\|async` |
| Trace async through callback delivery | ✅ | `callback_logs` table |

### Load Generator

| Requirement | Status |
|-------------|--------|
| Total requests sent, success/failure | ✅ |
| Latency p50/p95/p99 for sync | ✅ |
| Time-to-callback stats for async | ✅ |

### Edge Cases & Gotchas

| Gotcha | Status | Implementation |
|--------|--------|----------------|
| Callback failures | ✅ | Exponential backoff retry (2s, 4s, 8s), only 5xx retries |
| Ordering/timing guarantees | ✅ | FIFO queue + single worker thread |
| Scales under high volume | ✅ | Rate limiting (30/min sync, 60/min async) |
| Prevents callback abuse | ✅ | SSRF protection (blocks localhost, private IPs) |

### Bonus Features (not required)

| Feature | Description |
|---------|-------------|
| Idempotency | `X-Idempotency-Key` header prevents duplicate processing |
| Frontend UI | Interactive demo for all features |
| Request management | Delete single/all requests |
| Callback logs viewer | Trace webhook delivery attempts |

---

## Live Demo

Try the production deployment:

| Resource | URL |
|----------|-----|
| **Demo Video** | [Watch on Google Drive](https://drive.google.com/file/d/13-mAbgrVpTC7QFEOnAy9zIQ8qMygY9Rm/view) |
| **API** | https://reports-generator-fastapi.up.railway.app |
| **API Docs** | https://reports-generator-fastapi.up.railway.app/docs |
| **Health Check** | https://reports-generator-fastapi.up.railway.app/api/health |

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL database (or use [Neon](https://neon.tech) free tier)

### Backend Setup

```bash
cd server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `.env` file from template:
```bash
cp .env.example .env
```

Edit `.env` and add your database URL:
```env
# For Neon serverless PostgreSQL:
DATABASE_URL=postgresql+asyncpg://user:password@ep-xxx.region.aws.neon.tech/dbname?ssl=require

# For local PostgreSQL:
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
```

Start the server:
```bash
fastapi dev src/app.py
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

### Local URLs

| Resource | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["React Frontend"]
        UI[User Interface]
    end

    subgraph Server["FastAPI Backend"]
        API[API Routes]
        SYNC[Sync Controller]
        ASYNC[Async Controller]
        WORK[Report Generator<br/>Shared Work Logic]

        subgraph FIFO["FIFO Queue System"]
            QUEUE[(Thread-Safe Queue)]
            WORKER[Single Worker Thread]
        end

        CALLBACK[Callback Service<br/>with Retry Logic]
    end

    subgraph DB["PostgreSQL"]
        REQUESTS[(requests table)]
        LOGS[(callback_logs table)]
    end

    UI -->|POST /sync| API
    UI -->|POST /async| API
    API --> SYNC
    API --> ASYNC
    SYNC --> WORK
    SYNC --> REQUESTS
    ASYNC -->|1. Create record| REQUESTS
    ASYNC -->|2. Enqueue job| QUEUE
    QUEUE -->|FIFO order| WORKER
    WORKER --> WORK
    WORKER -->|Update status| REQUESTS
    WORKER --> CALLBACK
    CALLBACK -->|Webhook| UI
    CALLBACK -->|Log attempts| LOGS
```

### How It Works

| Component | Description |
|-----------|-------------|
| **API Routes** | FastAPI endpoints with rate limiting (30/min sync, 60/min async) and idempotency support |
| **Sync Controller** | Processes request inline, blocks until complete, returns result directly |
| **Async Controller** | Creates DB record, enqueues job, returns immediately with `queue_position` |
| **FIFO Queue** | Thread-safe `queue.Queue` ensuring strict first-in-first-out processing order |
| **Single Worker** | One background thread processes jobs sequentially - guarantees ordering |
| **Report Generator** | Shared work logic used by both sync and async paths (no code duplication) |
| **Callback Service** | Sends webhooks with retry logic (3 attempts, exponential backoff: 2s, 4s, 8s) |

**Sync Flow:**
```
Client → POST /sync → Generate Report (blocking) → Return CSV URL
```

**Async Flow:**
```
Client → POST /async → ACK (instant) → Queue → Worker → Generate → Webhook callback
```


## API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sync` | Generate report synchronously (blocking) |
| `POST` | `/api/async` | Generate report asynchronously (webhook) |
| `GET` | `/api/requests` | List all requests |
| `GET` | `/api/requests/{id}` | Get request details |
| `DELETE` | `/api/requests/{id}` | Delete a request |
| `GET` | `/api/reports/{file}` | Download CSV file |

### Example: Sync Request
```bash
curl -X POST http://localhost:8000/api/sync \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{"num_transactions": 50, "report_name": "Q1_Report"}'
```

### Example: Async Request
```bash
curl -X POST http://localhost:8000/api/async \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {"num_transactions": 200, "report_name": "Annual"},
    "callback_url": "https://your-server.com/webhook"
  }'
```

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with system info |
| `GET` | `/api/requests/{id}/callback-logs` | View webhook retry history |
| `POST` | `/api/benchmark/both` | Run load test comparison |

---

## Features

### FIFO Queue Ordering
Async requests are processed in **strict submission order** (First-In-First-Out):

```
POST /async → queue_position: 1 → Processed 1st
POST /async → queue_position: 2 → Processed 2nd
POST /async → queue_position: 3 → Processed 3rd
```

**How it works:**
- Single worker thread processes jobs sequentially
- `queue.Queue` ensures FIFO ordering
- `queue_position` field tracks exact processing order
- Callbacks sent in same order as requests received

**Implementation Details:**

```python
# server/src/services/background_worker.py

# Thread-safe FIFO queue (Python's queue.Queue is inherently FIFO)
_job_queue: queue.Queue[str] = queue.Queue()

# Global counter for queue position (thread-safe increment)
_queue_position_counter: int = 0
_counter_lock = threading.Lock()

def enqueue_job(request_id: str) -> int:
    """Add job to FIFO queue, return queue position."""
    position = _get_next_queue_position()  # Atomic increment
    _job_queue.put(request_id)             # Add to end of queue
    _ensure_worker_running()               # Start worker if not running
    return position

def _fifo_worker():
    """Single worker processes jobs one at a time, in order."""
    while True:
        request_id = _job_queue.get(block=True)  # Blocks until job available (FIFO)
        _process_job(request_id)                  # Process synchronously
        _job_queue.task_done()                    # Mark complete, get next
```

**Why this guarantees order:**

1. **Single Queue**: All async requests go into one `queue.Queue` - Python's implementation is thread-safe and strictly FIFO
2. **Single Worker**: Only ONE background thread pulls from the queue. No race conditions.
3. **Blocking Process**: Worker calls `_job_queue.get(block=True)` which:
   - Waits if queue is empty
   - Returns the **oldest** item when available (FIFO)
   - Only gets the next job after current one completes
4. **Atomic Position Counter**: `queue_position` is assigned with a lock, ensuring unique sequential numbers

**Why single worker?**
| Approach | FIFO Guarantee | Complexity |
|----------|---------------|------------|
| **Single worker (chosen)** | ✅ Strict | Simple |
| Thread pool | ❌ Race conditions | Medium |
| Multiple workers | ❌ Out of order | Complex |

### Idempotency
Prevent duplicate processing with `X-Idempotency-Key` header:
```bash
# First request - processed
curl -X POST /api/sync -H "X-Idempotency-Key: order-123" ...

# Second request - returns cached result
curl -X POST /api/sync -H "X-Idempotency-Key: order-123" ...
# Response: {"status": "duplicate", "request_id": "..."}
```

### Rate Limiting
- **Sync**: 30 requests/minute per IP
- **Async**: 60 requests/minute per IP
- Returns `429 Too Many Requests` when exceeded

### Callback Retry Logic
Failed webhooks retry with exponential backoff:
| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |

Only 5xx errors trigger retries. 4xx errors are not retried.

### SSRF Protection
Callback URLs are validated to block:
- `localhost`, `127.0.0.1`, `::1`
- Private IP ranges (10.x, 172.16.x, 192.168.x)
- Reserved addresses

---

## Database Schema

### `requests`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| mode | VARCHAR | "sync" or "async" |
| status | VARCHAR | PENDING, PROCESSING, COMPLETED, FAILED |
| input_payload | JSON | Request parameters |
| result_payload | JSON | Report result |
| callback_url | VARCHAR | Webhook URL |
| callback_status | VARCHAR | PENDING, SUCCESS, FAILED |
| idempotency_key | VARCHAR | Unique, prevents duplicates |
| **queue_position** | **INT** | **FIFO order for async (auto-increment)** |
| created_at | TIMESTAMP | Request time |

### `callback_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| request_id | UUID | FK to requests |
| attempt_number | INT | 1, 2, or 3 |
| status_code | INT | HTTP response code |
| success | BOOL | Delivery success |
| error_message | TEXT | Error details |
| response_time_ms | INT | Latency |

---

## Design Tradeoffs

### Why Threads Instead of Celery/Redis?
| Approach | Pros | Cons |
|----------|------|------|
| **Threads (chosen)** | Simple, no infra, good for demo | Not horizontally scalable |
| Celery + Redis | Production-ready, scalable | Complex setup, overkill for demo |
| asyncio tasks | Native async | Can't do CPU-bound work |

**Decision**: Threads are sufficient for demonstrating the pattern. In production, use Celery.

### Why PostgreSQL Instead of SQLite?
| Approach | Pros | Cons |
|----------|------|------|
| **PostgreSQL (chosen)** | Production-realistic, concurrent writes | Requires connection |
| SQLite | Zero config, embedded | Single-writer lock, not realistic |

**Decision**: Neon provides free serverless PostgreSQL, making it easy to demo production patterns.

### Why Store Files on Filesystem?
| Approach | Pros | Cons |
|----------|------|------|
| **Filesystem (chosen)** | Simple, fast streaming | Not horizontally scalable |
| Database BLOB | Single source of truth | Expensive, slow for large files |
| S3/R2 | Scalable, cheap | Extra complexity |

**Decision**: Filesystem is fine for demo. Production should use S3/R2.

### Current Limitations

These are **intentional tradeoffs** for simplicity - not oversights:

| Limitation | Why It's OK for Demo | Production Solution |
|------------|---------------------|---------------------|
| **In-memory queue** | Jobs lost if server restarts | Redis/RabbitMQ persistent queue |
| **Single worker thread** | Guarantees FIFO but limits throughput | Celery with ordered task chains |
| **Local file storage** | Reports deleted on redeploy | S3/Cloudflare R2 |
| **No authentication** | Open API for easy testing | API keys or JWT |
| **Polling for status** | Simple but inefficient | WebSocket real-time updates |
| **No webhook signing** | Callbacks can be spoofed | HMAC signature verification |

---

## Future Roadmap

- [ ] **File Storage**: Move CSV files to S3/Cloudflare R2
- [ ] **Authentication**: Add API key or JWT auth
- [ ] **Webhooks Signing**: HMAC signature for callback verification
- [ ] **Priority Queue**: High/low priority job processing
- [ ] **Batch API**: Generate multiple reports in one request
- [ ] **Websocket Updates**: Real-time status instead of polling
- [ ] **Metrics**: Prometheus/Grafana for monitoring
- [ ] **Docker**: Containerize for easy deployment

---

## Project Structure

```
├── server/
│   ├── src/
│   │   ├── app.py              # FastAPI entry
│   │   ├── database.py         # PostgreSQL setup
│   │   ├── config.py           # Environment config
│   │   ├── models/             # SQLAlchemy models
│   │   ├── controllers/        # Business logic
│   │   ├── routes/             # API endpoints
│   │   └── services/           # Report gen, background worker
│   ├── data/reports/           # Generated CSV files
│   └── requirements.txt
│
├── client/
│   ├── src/App.tsx             # React UI
│   └── package.json
│
├── claude.md                   # Project spec (for AI context)
└── README.md
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL (Neon serverless) |
| ORM | SQLAlchemy (async) |
| Rate Limiting | slowapi |
| HTTP Client | httpx |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |

---

## License

MIT
