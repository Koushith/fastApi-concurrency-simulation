# fastApi-concurrency-simulation

Sync vs Async API comparison under request storms. Demonstrates the difference between synchronous (blocking) and asynchronous (non-blocking/callback) architectures under heavy load.

## Quick Start

```bash
cd server

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
fastapi dev src/app.py
```

## API Endpoints

- `POST /api/sync` - Synchronous request (blocks until complete)
- `POST /api/async` - Asynchronous request (returns immediately, callbacks later)
- `GET /api/requests?mode=sync|async` - List recent requests
- `GET /api/requests/{id}` - Get request status
- `GET /api/health` - Health check
