"""
FastAPI Application Entry Point

This is a demo application comparing Sync vs Async API patterns
for a financial report generation service.
"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from src.config import API_PREFIX, DEBUG
from src.database import init_db
from src.routes.health import router as health_router
from src.routes.api_routes import router as api_router
from src.routes.benchmark import router as benchmark_router
from src.routes.webhook_test import router as webhook_router


# Rate limiter - limits requests per IP address
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Sync vs Async API",
    description="Financial Report Generator - comparing sync (blocking) vs async (non-blocking) patterns",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting: returns HTTP 429 when limit exceeded
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",  # Vercel preview deployments
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow all Vercel subdomains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health_router, prefix=API_PREFIX)
app.include_router(api_router, prefix=API_PREFIX)
app.include_router(benchmark_router, prefix=API_PREFIX)
app.include_router(webhook_router, prefix=API_PREFIX)


if __name__ == "__main__":
    uvicorn.run("src.app:app", reload=DEBUG)
