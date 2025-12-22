"""Progress tracking for ingest jobs"""
import json
from common.db import get_conn

def update_job_progress(job_id: int, session_progress: dict):
    """Update job progress in database"""
    if not job_id:
        return
        
    progress_json = json.dumps(session_progress)
    
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE ingest_jobs SET progress = %s WHERE id = %s",
                (progress_json, job_id)
            )
        conn.commit()
