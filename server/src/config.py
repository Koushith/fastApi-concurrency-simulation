import os

from dotenv import load_dotenv

load_dotenv()

# Environment
ENV = os.getenv("ENV", "development")
DEBUG = ENV == "development"

# Database - PostgreSQL (Neon)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# API
API_PREFIX = "/api"

# Server URL (for self-referencing callbacks in benchmark)
if ENV == "production":
    SERVER_URL = os.getenv("SERVER_URL", "https://reports-generator-server.vercel.app")
else:
    SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000")
