# Financial Report Generator - Sync vs Async API Demo

## Overview

FastAPI backend demonstrating sync (blocking) vs async (callback-based) request handling. Generates realistic financial reports as downloadable CSV files.

## Architecture

- **Framework**: FastAPI with async SQLAlchemy
- **Database**: SQLite (file-based, no server needed)
- **Background Processing**: Python threads (simple, no Redis/RQ needed)
- **Frontend**: React + Vite + Tailwind

## Key Files

- `server/src/app.py` - FastAPI entry point
- `server/src/services/report_service.py` - Generates financial report CSV files
- `server/src/services/background_worker.py` - Thread-based job processor with retry logic
- `server/src/controllers/sync_controller.py` - Sync endpoint handler
- `server/src/controllers/async_controller.py` - Async endpoint handler
- `client/src/App.tsx` - Demo UI

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync` | POST | Generate report synchronously (blocking) |
| `/api/async` | POST | Generate report asynchronously (returns immediately) |
| `/api/requests` | GET | List all requests |
| `/api/requests/{id}` | GET | Get single request details |
| `/api/requests` | DELETE | Delete all requests |
| `/api/reports/{filename}` | GET | Download generated CSV file |
| `/api/healthz` | GET | Health check |

## Request Payload

```json
{
  "num_transactions": 50,
  "report_name": "Q1_Finance"
}
```

## Response (includes download URL)

```json
{
  "report_name": "Q1_Finance",
  "file_name": "Q1_Finance_abc123.csv",
  "download_url": "/api/reports/Q1_Finance_abc123.csv",
  "summary": {
    "total_transactions": 50,
    "total_revenue": 245830.50,
    "total_expenses": 189420.75,
    "net_income": 56409.75
  }
}
```

## Conventions

- Use functions over classes where possible
- Keep code simple, minimal abstraction
- Literal types instead of Enum classes

## Running

```bash
# Server
cd server && source venv/bin/activate && fastapi dev src/app.py

# Client
cd client && npm run dev
```
