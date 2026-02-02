# Feature Checklist

## Setup & Config
- [x] Restructure folders to match spec (models/, controllers/, services/, workers/)
- [x] Create config.py (REDIS_URL, DB_URL, etc.)
- [x] Update requirements.txt with all dependencies

## Database
- [x] Setup SQLAlchemy async with SQLite
- [x] Create Request model (id, mode, status, input_payload, result_payload, callback_url, created_at, completed_at)

## Services
- [x] Create report_service.py (generate_report with CPU/IO simulation)
- [x] Create queue_service.py (Redis/RQ wrapper)

## API Endpoints
- [x] POST /sync - executes work inline, records < 50 limit
- [x] POST /async - queues work, returns 202 with request_id
- [x] GET /requests?mode=sync|async - list recent requests
- [x] GET /requests/{id} - get single request status
- [ ] GET /health - update to check Redis & DB connections

## Worker
- [x] Create callback_worker.py (dequeue, process, callback)
- [x] SSRF protection (block localhost/private IPs)
- [x] Retry logic with exponential backoff (3 retries: 2s, 4s, 8s)

## Infrastructure
- [ ] docker-compose.yml (redis, api, worker services)
- [ ] Dockerfile for API

## Testing
- [ ] Load generator script (sync test, async test, callback listener)
- [ ] Summary output (p50/p95/p99 latency, success/failure counts)

## Documentation
- [ ] README.md with setup & run instructions
