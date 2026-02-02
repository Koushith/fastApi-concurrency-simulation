# Financial Report Generator

API pattern simulator comparing **Sync** (blocking) vs **Async** (webhook callback) request handling.

Built for a take-home assignment demonstrating production-ready API design patterns.

![Demo](https://img.shields.io/badge/demo-localhost:5173-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-orange)

## Quick Start

```bash
# Backend
cd server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your DATABASE_URL
fastapi dev src/app.py

# Frontend
cd client
npm install && npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

---

## Architecture

![Architecture Diagram](docs/architecture.svg)

### Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Report Service
    participant D as Database
    participant W as Webhook

    Note over C,W: Sync Flow (blocking)
    C->>+A: POST /api/sync
    A->>+R: Generate Report
    R-->>-A: CSV Ready
    A-->>-C: Return Result (1-5s)

    Note over C,W: Async Flow (non-blocking)
    C->>+A: POST /api/async
    A-->>-C: Return ACK (20ms)
    A->>+R: Background Thread
    R->>D: Save Result
    R->>W: POST Callback
    W-->>R: 200 OK
```

---

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
