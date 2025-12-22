"""Test ingesting a single F1 session"""
import os
from dotenv import load_dotenv

load_dotenv()

# Make sure DATABASE_URL is set before importing db module
if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL not set")

from ingest.ingest_weekend import ingest_session

print("Testing F1 data ingest...")
print("Ingesting 2024 Bahrain GP Qualifying (this may take a minute)...")

# Ingest 2024 Bahrain GP Qualifying - smaller dataset than Race
ingest_session(season=2024, rnd=1, session_code="Q", telemetry_points=300)

print("Ingest complete!")

