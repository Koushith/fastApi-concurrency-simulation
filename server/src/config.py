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
