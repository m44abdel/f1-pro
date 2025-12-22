import { NextResponse } from "next/server";
import { getReadOnlyPool } from "@/lib/db-readonly";

export async function GET() {
  try {
    const pool = getReadOnlyPool();
    
    // Get qualifying results with driver info
    const results = await pool.query(`
      SELECT 
        w.season,
        w.round,
        w.name as weekend_name,
        w.circuit,
        w.date,
        s.session_code,
        d.code as driver_code,
        d.name as driver_name,
        sr.position,
        sr.best_lap_time_ms
      FROM session_results sr
      JOIN sessions s ON sr.session_id = s.id
      JOIN weekends w ON s.weekend_id = w.id
      JOIN drivers d ON sr.driver_id = d.id
      ORDER BY w.season DESC, w.round DESC, sr.position ASC
    `);

    return NextResponse.json({
      success: true,
      count: results.rows.length,
      data: results.rows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

