# Feature Checklist

## Core API

- [x] `POST /api/sync` - Synchronous report generation (blocking)
- [x] `POST /api/async` - Asynchronous with webhook callback
- [x] `GET /api/requests` - List all requests with filter
- [x] `GET /api/requests/{id}` - Get single request details
- [x] `DELETE /api/requests` - Delete all requests
- [x] `DELETE /api/requests/{id}` - Delete single request
- [x] `GET /api/reports/{file}` - Download CSV file
- [x] `GET /api/health` - Health check with system info

## Resilience Features

- [x] **Idempotency** - `X-Idempotency-Key` header prevents duplicates
- [x] **Rate Limiting** - 30/min sync, 60/min async (per IP)
- [x] **Retry Logic** - Exponential backoff (2s, 4s, 8s)
- [x] **SSRF Protection** - Blocks private IPs for callbacks
- [x] **Callback Logging** - Audit trail for every attempt

## Database

- [x] PostgreSQL (Neon serverless)
- [x] `requests` table - Stores all report requests
- [x] `callback_logs` table - Tracks webhook delivery attempts
- [x] Cascade delete (logs deleted with request)
- [x] Indexes on status and idempotency_key

## Load Testing

- [x] `POST /api/benchmark/sync` - Test sync endpoint
- [x] `POST /api/benchmark/async` - Test async endpoint
- [x] `POST /api/benchmark/both` - Compare both with stats
- [x] P50/P95/P99 latency metrics
- [x] Callback timing stats

## Frontend

- [x] Sync/Async side-by-side comparison
- [x] Real-time queue status polling
- [x] Load test UI with results table
- [x] Request history table
- [x] Callback logs viewer
- [x] Idempotency test tool
- [x] Rate limit test tool
- [x] Copy ID buttons
- [x] Download CSV buttons

## Report Generation

- [x] Realistic financial transaction data
- [x] CSV format with header summary
- [x] Configurable row count
- [x] ~10ms per row (simulated processing)
- [x] Revenue/Expense categories
- [x] Net income calculation
