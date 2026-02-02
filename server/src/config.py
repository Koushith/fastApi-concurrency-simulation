import os

from dotenv import load_dotenv

load_dotenv()

# Environment
ENV = os.getenv("ENV", "development")
DEBUG = ENV == "development"

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# API
API_PREFIX = "/api"
