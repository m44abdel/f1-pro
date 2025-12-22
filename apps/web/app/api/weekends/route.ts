import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season");
    
    if (!season) {
      return NextResponse.json(
        { success: false, error: "Season parameter required" },
        { status: 400 }
      );
    }
    
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        w.id,
        w.season,
        w.round,
        w.name,
        w.circuit,
        w.date,
        COALESCE(
          json_agg(
            json_build_object('code', s.session_code, 'id', s.id)
            ORDER BY 
              CASE s.session_code 
                WHEN 'FP1' THEN 1 
                WHEN 'FP2' THEN 2 
                WHEN 'FP3' THEN 3 
                WHEN 'Q' THEN 4 
                WHEN 'SQ' THEN 5
                WHEN 'R' THEN 6 
                ELSE 7 
              END
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as sessions
      FROM weekends w
      LEFT JOIN sessions s ON s.weekend_id = w.id
      WHERE w.season = $1
      GROUP BY w.id
      ORDER BY w.round ASC
    `, [season]);
    
    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

