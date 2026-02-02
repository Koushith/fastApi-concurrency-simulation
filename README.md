# Financial Report Generator - Sync vs Async API

A FastAPI backend demonstrating **synchronous** (blocking) vs **asynchronous** (callback-based) request handling. Generates realistic financial reports as downloadable CSV files.

## What This Demonstrates

| Endpoint | Behavior | Use Case |
|----------|----------|----------|
| `POST /api/sync` | Blocks until report is ready, returns result | Small reports (< 100 transactions) |
| `POST /api/async` | Returns immediately with request ID, notifies via webhook | Large reports, better UX |

## Quick Start

### Server
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
fastapi dev src/app.py
```
Server runs at http://localhost:8000

### Frontend
```bash
cd client
npm install
npm run dev
```
Frontend runs at http://localhost:5173

## API Endpoints

### Generate Report (Sync)
```bash
curl -X POST http://localhost:8000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"num_transactions": 50, "report_name": "Q1_Report"}'
```
- Blocks until complete
- Limited to < 100 transactions
- Returns report summary + download URL

### Generate Report (Async)
```bash
curl -X POST http://localhost:8000/api/async \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {"num_transactions": 200, "report_name": "Annual_Report"},
    "callback_url": "https://webhook.site/your-id"
  }'
```
- Returns `request_id` immediately (~20ms)
- Processes in background
- POSTs result to `callback_url` when done

### Download Report
```bash
curl http://localhost:8000/api/reports/Q1_Report_abc123.csv --output report.csv
```

### Check Request Status
```bash
curl http://localhost:8000/api/requests/{request_id}
```

### List All Requests
```bash
curl http://localhost:8000/api/requests
curl http://localhost:8000/api/requests?mode=async
```

### Delete All Requests
```bash
curl -X DELETE http://localhost:8000/api/requests
```

### Health Check
```bash
curl http://localhost:8000/api/healthz
```

## Load Testing

### Using Frontend
The UI includes a **Load Generator** that fires concurrent requests and shows latency comparison.

### Using CLI
```bash
cd server
python -m tests.load_generator
```

### Using API
```bash
curl -X POST http://localhost:8000/api/benchmark/both \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 20, "num_transactions": 50}'
```

## Generated Report Format

The CSV file includes:
```csv
# Financial Report: Q1_Report
# Generated: 2024-01-15 10:30:00
# Period: Last 30 Days
# Total Transactions: 50
#
# SUMMARY
# Total Revenue: $125,430.50
# Total Expenses: $89,210.25
# Net Income: $36,220.25
#
Transaction ID,Date,Type,Category,Description,Amount
TXN-00001,2024-01-10,Revenue,Sales Income,Sales Income - January 2024,$12,500.00
TXN-00002,2024-01-08,Expense,Payroll,Payroll - January 2024,$8,500.00
...
```

## Key Design Decisions

### Why Threads Instead of Redis/Celery?
- **Simplicity**: No external dependencies
- **Demo Focus**: Shows the sync/async pattern clearly
- **Good Enough**: Works for moderate load

### SSRF Protection
Callback URLs are validated to block:
- localhost, 127.0.0.1, ::1
- Private IP ranges (10.x, 192.168.x)
- Reserved addresses

### Callback Retry Logic
Failed callbacks retry with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After 2s
- Attempt 3: After 4s
- Attempt 4: After 8s

### Database
SQLite with async SQLAlchemy. Database file persists at `data/app.db`.

## Project Structure

```
server/
├── src/
│   ├── app.py                  # FastAPI entry point
│   ├── database.py             # SQLite async setup
│   ├── controllers/            # Business logic
│   ├── routes/                 # API route handlers
│   └── services/
│       ├── report_service.py   # CSV report generation
│       └── background_worker.py # Job processor
├── data/
│   ├── app.db                  # SQLite database
│   └── reports/                # Generated CSV files
└── requirements.txt

client/
└── src/
    └── App.tsx                 # React demo UI
```

## Requirements Met

- [x] POST /sync - blocks until work completes
- [x] POST /async - returns ACK, calls callback later
- [x] Shared work logic between sync/async
- [x] GET /requests - list recent requests
- [x] GET /requests/{id} - get single request
- [x] GET /healthz - health check
- [x] Callback failure handling (retry with backoff)
- [x] SSRF protection
- [x] Load generator with latency stats
- [x] Downloadable CSV reports
