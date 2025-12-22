"""Run the database schema against Neon"""
import os
from dotenv import load_dotenv
import psycopg

# Load from .env file if it exists
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

# Read the schema file
schema_path = os.path.join(os.path.dirname(__file__), "..", "infra", "db", "001_init.sql")
with open(schema_path, "r") as f:
    schema_sql = f.read()

print("Connecting to Neon...")
conn = psycopg.connect(DATABASE_URL)
print("Running schema...")
with conn.cursor() as cur:
    cur.execute(schema_sql)
conn.commit()
conn.close()
print("Schema created successfully!")

