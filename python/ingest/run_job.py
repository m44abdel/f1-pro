import os
import sys
import traceback

# Add parent directory to path to import from common
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up FastF1 cache before importing anything that uses it
import fastf1
cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".fastf1_cache")
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)
print(f"FastF1 cache directory: {cache_dir}")

from common.db import set_job_status
from common.progress import update_job_progress
from ingest.ingest_weekend import ingest_session

def main():
  job_id = int(os.environ.get("JOB_ID", 0))
  season = int(os.environ["SEASON"])
  rnd = int(os.environ["ROUND"])
  session_codes = os.environ.get("SESSION_CODES", os.environ.get("SESSION_CODE", "Q")).split(",")

  # GitHub Actions run URL is available via env vars
  run_id = os.environ.get("GITHUB_RUN_ID")
  repo = os.environ.get("GITHUB_REPOSITORY")
  log_url = None
  if run_id and repo:
    log_url = f"https://github.com/{repo}/actions/runs/{run_id}"

  try:
    if job_id:
      set_job_status(job_id, "RUNNING", log_url=log_url)
    
    # Initialize progress tracking
    progress = {}
    for session in session_codes:
      progress[session.strip()] = 0
    
    # Ingest each session
    for i, session_code in enumerate(session_codes):
      session_code = session_code.strip()
      print(f"Ingesting {season} Round {rnd} - {session_code}")
      
      # Update progress to show this session is starting
      progress[session_code] = 10
      if job_id:
        update_job_progress(job_id, progress)
      
      # Use standard ingestion with fewer telemetry points
      # Q: 150 points (shorter session), R: 100 points (longer session)
      points = 150 if session_code in ["Q", "SS"] else 100
      ingest_session(season, rnd, session_code, telemetry_points=points)
      
      # Update progress to show this session is complete
      progress[session_code] = 100
      if job_id:
        update_job_progress(job_id, progress)
    
    if job_id:
      set_job_status(job_id, "SUCCESS", log_url=log_url)
  except Exception as e:
    err = f"{e}\n\n{traceback.format_exc()}"
    if job_id:
      set_job_status(job_id, "FAILED", log_url=log_url, error=err)
    raise

if __name__ == "__main__":
  main()
