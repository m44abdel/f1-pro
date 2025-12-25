import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { spawn, spawnSync } from "child_process";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { cookies } from "next/headers";
import fs from "fs";

// Helper to get DATABASE_URL with fallback
function getDatabaseUrl(): string {
  // First try process.env
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('...')) {
    return process.env.DATABASE_URL;
  }
  
  // Try reading from .env.local directly
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/DATABASE_URL="([^"]+)"/);
      if (match) {
        return match[1];
      }
    }
  } catch (e) {
    console.error('Failed to read .env.local:', e);
  }
  
  return process.env.DATABASE_URL || '';
}

// Find repository root by walking up until we see python/ or f1_venv/
function findProjectRoot(): string {
  let currentDir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(currentDir, "python")) ||
      fs.existsSync(path.join(currentDir, "f1_venv"))
    ) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return process.cwd();
}

// Resolve a working Python executable, preferring the repo virtualenv
function resolvePythonExecutable(projectRoot: string): string {
  const isWindows = process.platform === "win32";

  const envPython = process.env.PYTHON_EXECUTABLE;
  if (envPython) {
    const envPath = path.isAbsolute(envPython)
      ? envPython
      : path.resolve(projectRoot, envPython);
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }

  const venvPython = path.join(
    projectRoot,
    "f1_venv",
    isWindows ? "Scripts" : "bin",
    isWindows ? "python.exe" : "python"
  );
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  const systemCandidate = isWindows ? "python" : "python3";
  try {
    const probe = spawnSync(systemCandidate, ["--version"], { stdio: "pipe" });
    if (!probe.error) {
      return systemCandidate;
    }
  } catch (e) {
    // ignore and fall through to error below
  }

  throw new Error(
    'Could not find a Python executable. Create the virtualenv with "python -m venv f1_venv" (then install deps) or set PYTHON_EXECUTABLE to a valid interpreter.'
  );
}

export async function POST(request: NextRequest) {
  // Check authentication - either admin session cookie or API token
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin-session');
  const hasValidSession = !!sessionCookie;
  
  if (!hasValidSession) {
    // Fall back to API token authentication
    const authError = requireAuth(request);
    if (authError) return authError;
  }
  
  let jobId: number | null = null;

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
    
    jobId = jobResult.rows[0].id;

    if (!jobId) {
      throw new Error("Failed to create ingest job id");
    }

    // Spawn Python process to ingest data
    const projectRoot = findProjectRoot();
    const pythonPath = path.join(projectRoot, "python");
    const pythonExecutable = resolvePythonExecutable(projectRoot);
    const ingestScript = path.join(pythonPath, "ingest", "run_job.py");
    
    // Get the database URL
    const databaseUrl = getDatabaseUrl();
    console.log('DATABASE_URL available:', !!databaseUrl && databaseUrl.length > 20);
    console.log('Python executable resolved to:', pythonExecutable);
    console.log('Ingest script path:', ingestScript);
    
    if (!databaseUrl || databaseUrl.length < 20) {
      throw new Error('DATABASE_URL is not properly configured');
    }
    
    if (!fs.existsSync(ingestScript)) {
      throw new Error(`Ingest script not found at ${ingestScript}`);
    }

    const ingestProcess = spawn(pythonExecutable, [ingestScript], {
      cwd: pythonPath,
      env: {
        ...process.env,
        JOB_ID: jobId.toString(),
        SEASON: season.toString(),
        ROUND: round.toString(),
        SESSION_CODES: newSessions.join(","),
        DATABASE_URL: databaseUrl,
        // Ensure Python uses system DNS settings
        PYTHONPATH: pythonPath,
        // Pass through any proxy settings
        HTTP_PROXY: process.env.HTTP_PROXY || '',
        HTTPS_PROXY: process.env.HTTPS_PROXY || '',
        NO_PROXY: process.env.NO_PROXY || '',
      },
      // Ensure the process inherits the parent's network configuration
      stdio: ['inherit', 'pipe', 'pipe']
    });

    // Collect all output for debugging
    let stdout = '';
    let stderr = '';
    
    // Track process events
    ingestProcess.on('error', async (error) => {
      console.error('Failed to start ingest process:', error);
      // Update job status to failed
      await pool.query(
        "UPDATE ingest_jobs SET status = 'FAILED', error = $1 WHERE id = $2",
        [`Process spawn error: ${error.message}`, jobId]
      );
    });
    
    ingestProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.error(`Ingest stderr: ${text}`);
    });
    
    ingestProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      console.log(`Ingest stdout: ${text}`);
    });
    
    ingestProcess.on('exit', async (code) => {
      if (code !== 0) {
        console.error(`Ingest process exited with code ${code}`);
        console.error(`Full stderr: ${stderr}`);
        console.error(`Full stdout: ${stdout}`);
        
        // If job is still pending/running, mark as failed
        const jobStatus = await pool.query(
          "SELECT status FROM ingest_jobs WHERE id = $1",
          [jobId]
        );
        
        if (jobStatus.rows[0]?.status === 'PENDING' || jobStatus.rows[0]?.status === 'RUNNING') {
          await pool.query(
            "UPDATE ingest_jobs SET status = 'FAILED', error = $1 WHERE id = $2",
            [`Process exited with code ${code}. ${stderr || 'Check logs for details.'}`, jobId]
          );
        }
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Started ingesting ${newSessions.length} sessions`,
      sessions: newSessions
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Ingestion API error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("DATABASE_URL exists:", !!process.env.DATABASE_URL);
    try {
      const projectRoot = findProjectRoot();
      const pythonCandidate = resolvePythonExecutable(projectRoot);
      console.error("Resolved Python candidate:", pythonCandidate);
    } catch (resolveError) {
      console.error("Could not resolve Python executable:", resolveError);
    }
    try {
      // If a job was created, mark it failed so it does not stay pending
      if (typeof jobId === "number") {
        const pool = getPool();
        await pool.query(
          "UPDATE ingest_jobs SET status = 'FAILED', error = $1 WHERE id = $2",
          [errorMessage, jobId]
        );
      }
    } catch (e) {
      console.error("Failed to update ingest job status after error:", e);
    }
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
