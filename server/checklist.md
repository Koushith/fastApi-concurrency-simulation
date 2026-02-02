# Requirements Checklist

Based on `problem-context.md`

## Core Endpoints

- [x] **POST /sync** - Request comes in, response returned inline
- [x] **POST /async** - Request comes in, returns ACK with request_id, calls callback later
- [x] **GET /requests** - Query recent requests (with optional `?mode=sync|async` filter)
- [x] **GET /requests/{id}** - Get single request details
- [x] **GET /healthz** - Health check endpoint
- [x] **DELETE /requests** - Delete all requests
- [x] **DELETE /requests/{id}** - Delete single request
- [x] **GET /reports/{filename}** - Download generated CSV file

## Core Requirements

- [x] **Shared work logic** - Same `generate_report()` function used by both sync and async
- [x] **Persist state** - SQLite database stores all requests
- [x] **Trace async requests** - Can track status, callback delivery, retry attempts

## Callback Handling

- [x] **Callback failures handled** - Retry with exponential backoff (2s, 4s, 8s)
- [x] **SSRF protection** - Block localhost, 127.0.0.1, private IPs
- [x] **Test webhook endpoint** - `/api/webhook/test` for demo (bypasses SSRF for localhost)

## Load Generator

- [x] **High volume requests** - Can fire concurrent requests via frontend or CLI
- [x] **Summary stats** - Shows total requests, success/failure, latency comparison
- [x] **P50/P95/P99 stats** - Available via `/api/benchmark/sync` and `/api/benchmark/async`
- [x] **Time-to-callback stats** - CLI load generator tracks callback times

## Deliverables

- [x] **Python backend** - FastAPI with async SQLAlchemy
- [x] **README.md** - How to run locally, load generator usage, design decisions
- [x] **Frontend demo** - React UI to visualize sync vs async

## API Parameter: `num_transactions`

The payload uses `num_transactions` to specify how many financial transactions to include in the report:
- Sync: Limited to < 100 transactions
- Async: No limit

Example:
```json
{
  "num_transactions": 50,
  "report_name": "Q1_Finance"
}
```

## Generated Output

CSV file with realistic financial data:
- Transaction ID, Date, Type, Category, Description, Amount
- Summary header with Total Revenue, Expenses, Net Income
- Download via `/api/reports/{filename}`

## Files Updated

| File | Status | Description |
|------|--------|-------------|
| `src/routes/api_routes.py` | ✅ | Uses `num_transactions`, has download endpoint |
| `src/controllers/sync_controller.py` | ✅ | Uses `num_transactions`, limit < 100 |
| `src/controllers/async_controller.py` | ✅ | Uses `num_transactions` |
| `src/services/report_service.py` | ✅ | Generates CSV with financial data |
| `src/services/background_worker.py` | ✅ | Retry logic with exponential backoff |
| `src/routes/benchmark.py` | ✅ | Uses `num_transactions` |
| `tests/load_generator.py` | ✅ | Uses `num_transactions` |
| `client/src/App.tsx` | ✅ | Uses `num_transactions`, shows download button |
