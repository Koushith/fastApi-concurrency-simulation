from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from src.config import API_PREFIX, DEBUG
from src.database import init_db
from src.routes.health import router as health_router
from src.routes.api_routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Sync vs Async API",
    description="Request Storm Handler - Sync & Async API comparison",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router, prefix=API_PREFIX)
app.include_router(api_router, prefix=API_PREFIX)


if __name__ == "__main__":
    uvicorn.run("src.app:app", reload=DEBUG)
