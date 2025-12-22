import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();
    
    // Get session info
    const sessionResult = await pool.query(`
      SELECT 
        s.id,
        s.session_code,
        s.start_time_utc,
        w.season,
        w.round,
        w.name as weekend_name,
        w.circuit,
        w.date
      FROM sessions s
      JOIN weekends w ON s.weekend_id = w.id
      WHERE s.id = $1
    `, [id]);
    
    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }
    
    // Get results for this session
    const resultsResult = await pool.query(`
      SELECT 
        d.id as driver_id,
        d.code as driver_code,
        d.name as driver_name,
        sr.position,
        sr.best_lap_time_ms,
        sr.status,
        sr.points,
        sr.grid
      FROM session_results sr
      JOIN drivers d ON sr.driver_id = d.id
      WHERE sr.session_id = $1
      ORDER BY sr.position ASC NULLS LAST
    `, [id]);
    
    return NextResponse.json({
      success: true,
      data: {
        session: sessionResult.rows[0],
        results: resultsResult.rows,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

