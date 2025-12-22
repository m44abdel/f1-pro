import os
import psycopg
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
  raise RuntimeError("DATABASE_URL is not set")

@contextmanager
def get_conn():
  conn = psycopg.connect(DATABASE_URL)
  try:
    yield conn
  finally:
    conn.close()

def set_job_status(job_id: int, status: str, log_url: str | None = None, error: str | None = None):
  fields = ["status = %s"]
  params = [status]

  if status == "RUNNING":
    fields.append("started_at = now()")
  if status in ("SUCCESS", "FAILED"):
    fields.append("finished_at = now()")

  if log_url is not None:
    fields.append("log_url = %s")
    params.append(log_url)

  if error is not None:
    fields.append("error = %s")
    params.append(error)

  params.append(job_id)

  q = f"update ingest_jobs set {', '.join(fields)} where id = %s"
  with get_conn() as conn:
    with conn.cursor() as cur:
      cur.execute(q, params)
    conn.commit()
