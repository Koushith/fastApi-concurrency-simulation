# Financial Report Generator - Project Specification

## Overview

API pattern simulator demonstrating **Sync vs Async** request handling for a financial reporting service. Built with FastAPI + React.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL (Neon serverless) |
| ORM | SQLAlchemy (async) |
| Frontend | React, TypeScript, Vite, Tailwind |
| Background Jobs | Python threads |

## Database Schema

### `requests` table
- `id` (UUID) - Primary key
- `mode` - "sync" or "async"
- `status` - PENDING, PROCESSING, COMPLETED, FAILED
- `input_payload` (JSON) - Request parameters
- `result_payload` (JSON) - Report result
- `callback_url` - Webhook URL (async only)
- `callback_status` - PENDING, SUCCESS, FAILED
- `callback_attempts` - Retry count
- `idempotency_key` - Unique key for deduplication
- `created_at`, `completed_at` - Timestamps

### `callback_logs` table
- `id` (UUID) - Primary key
- `request_id` (FK) - Links to request
- `attempt_number` - 1, 2, or 3
- `status_code` - HTTP response code
- `success` - Boolean
- `error_message` - Error details
- `response_time_ms` - Latency
- `attempted_at` - Timestamp

## API Endpoints

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync` | Blocking report generation |
| POST | `/api/async` | Non-blocking with webhook |
| GET | `/api/requests` | List all requests |
| GET | `/api/requests/{id}` | Get request details |
| GET | `/api/reports/{file}` | Download CSV |

### Resilience
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests/{id}/callback-logs` | View retry history |
| POST | `/api/callbacks/simulate-failures` | Test retry logic |

### Benchmarking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/benchmark/both` | Run load test |

## Features

- **Idempotency**: `X-Idempotency-Key` header prevents duplicate processing
- **Rate Limiting**: 30/min (sync), 60/min (async) per IP
- **Retry Logic**: Exponential backoff (2s, 4s, 8s) for failed callbacks
- **SSRF Protection**: Blocks localhost/private IPs for callbacks
- **Callback Audit**: Every attempt logged with timing

## File Structure

```
server/src/
├── app.py                 # FastAPI app
├── database.py            # PostgreSQL connection
├── config.py              # Environment config
├── models/
│   ├── request_model.py   # Request table
│   └── callback_log_model.py
├── controllers/
│   ├── sync_controller.py
│   ├── async_controller.py
│   └── requests_controller.py
├── routes/
│   ├── api_routes.py      # Core endpoints
│   ├── benchmark.py       # Load testing
│   └── webhook_test.py    # Demo callback receiver
└── services/
    ├── report_service.py  # CSV generation
    └── background_worker.py # Job processor + retries

client/src/
└── App.tsx                # Full demo UI
```

## Running Locally

```bash
# Backend
cd server
source venv/bin/activate
fastapi dev src/app.py

# Frontend
cd client
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://...
DEBUG=true
```
