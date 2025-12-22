import os
import sys
import traceback

from common.db import set_job_status
from ingest.ingest_weekend import ingest_session

def main():
  job_id = int(os.environ["JOB_ID"])
  season = int(os.environ["SEASON"])
  rnd = int(os.environ["ROUND"])
  session_code = os.environ["SESSION_CODE"]

  # GitHub Actions run URL is available via env vars
  run_id = os.environ.get("GITHUB_RUN_ID")
  repo = os.environ.get("GITHUB_REPOSITORY")
  log_url = None
  if run_id and repo:
    log_url = f"https://github.com/{repo}/actions/runs/{run_id}"

  try:
    set_job_status(job_id, "RUNNING", log_url=log_url)
    ingest_session(season, rnd, session_code, telemetry_points=1200)
    set_job_status(job_id, "SUCCESS", log_url=log_url)
  except Exception as e:
    err = f"{e}\n\n{traceback.format_exc()}"
    set_job_status(job_id, "FAILED", log_url=log_url, error=err)
    raise

if __name__ == "__main__":
  main()
