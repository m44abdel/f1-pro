import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { spawn } from "child_process";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  // Check authentication - either admin session cookie or API token
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session');
  const hasValidSession = !!sessionCookie;
  
  if (!hasValidSession) {
    // Fall back to API token authentication
    const authError = requireAuth(request);
    if (authError) return authError;
  }
  
  try {
    const { season, round, sessions } = await request.json();
    
    if (!season || !round) {
      return NextResponse.json(
        { success: false, error: "Season and round are required" },
        { status: 400 }
      );
    }

    // Check if data already exists
    const pool = getPool();
    const existingData = await pool.query(
      `SELECT s.id, s.session_code 
       FROM sessions s 
       JOIN weekends w ON s.weekend_id = w.id 
       WHERE w.season = $1 AND w.round = $2`,
      [season, round]
    );

    const existingSessions = existingData.rows.map(r => r.session_code);
    const sessionsToIngest = sessions || ["FP1", "FP2", "FP3", "Q", "R"];
    const newSessions = sessionsToIngest.filter((s: string) => !existingSessions.includes(s));

    if (newSessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All requested sessions already exist",
        existingSessions
      });
    }

    // Create ingest job
    const jobResult = await pool.query(
      `INSERT INTO ingest_jobs (season, round, session_codes, status, created_at)
       VALUES ($1, $2, $3, 'PENDING', now())
       RETURNING id`,
      [season, round, newSessions.join(",")]
    );
    
    const jobId = jobResult.rows[0].id;

    // Spawn Python process to ingest data
    // Use absolute paths for reliability
    const projectRoot = "/Users/mohebabdelmasih/Desktop/f1-pro";
    const pythonPath = path.join(projectRoot, "python");
    const venvPython = path.join(projectRoot, "f1_venv", "bin", "python");
    
    const ingestProcess = spawn(venvPython, [
      path.join(pythonPath, "ingest", "run_job.py")
    ], {
      cwd: pythonPath,
      env: {
        ...process.env,
        JOB_ID: jobId.toString(),
        SEASON: season.toString(),
        ROUND: round.toString(),
        SESSION_CODES: newSessions.join(","),
        DATABASE_URL: process.env.DATABASE_URL
      }
    });

    // Track process events
    ingestProcess.on('error', async (error) => {
      console.error('Failed to start ingest process:', error);
      // Update job status to failed
      await pool.query(
        "UPDATE ingest_jobs SET status = 'FAILED', error = $1 WHERE id = $2",
        [error.message, jobId]
      );
    });
    
    ingestProcess.stderr.on('data', (data) => {
      console.error(`Ingest stderr: ${data}`);
    });
    
    ingestProcess.stdout.on('data', (data) => {
      console.log(`Ingest stdout: ${data}`);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Started ingesting ${newSessions.length} sessions`,
      sessions: newSessions
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Check job status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    
    if (!jobId) {
      // Return recent jobs
      const pool = getPool();
      const jobs = await pool.query(
        `SELECT id, season, round, session_codes, status, created_at, started_at, finished_at, error
         FROM ingest_jobs
         ORDER BY created_at DESC
         LIMIT 10`
      );
      
      return NextResponse.json({
        success: true,
        jobs: jobs.rows
      });
    }

    // Get specific job status
    const pool = getPool();
    const job = await pool.query(
      `SELECT id, season, round, session_codes, status, created_at, started_at, finished_at, error, progress
       FROM ingest_jobs
       WHERE id = $1`,
      [jobId]
    );

    if (job.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: job.rows[0]
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
