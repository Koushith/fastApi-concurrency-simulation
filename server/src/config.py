import os

from dotenv import load_dotenv

load_dotenv()

# Environment
ENV = os.getenv("ENV", "development")
DEBUG = ENV == "development"

# Database - PostgreSQL (Neon)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://neondb_owner:npg_LngjGiS2ZP5I@ep-soft-sky-a18et3tx-pooler.ap-southeast-1.aws.neon.tech/neondb?ssl=require"
)

# API
API_PREFIX = "/api"
