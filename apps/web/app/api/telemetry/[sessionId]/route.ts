import { NextResponse } from "next/server";
import { getReadOnlyPool } from "@/lib/db-readonly";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const driverIds = searchParams.get("drivers")?.split(",").map(Number) || [];
    
    const pool = getReadOnlyPool();
    
    // Get telemetry for specified drivers (or all if none specified)
    let query = `
      SELECT 
        t.id,
        t.driver_id,
        d.code as driver_code,
        d.name as driver_name,
        t.lap_number,
        t.n_points,
        t.distance_m,
        t.speed_kph,
        t.throttle,
        t.brake,
        t.gear,
        t.drs,
        t.pos_x,
        t.pos_y
      FROM telemetry_keylaps t
      JOIN drivers d ON t.driver_id = d.id
      WHERE t.session_id = $1
    `;
    
    const queryParams: (string | number | number[])[] = [sessionId];
    
    if (driverIds.length > 0) {
      query += ` AND t.driver_id = ANY($2)`;
      queryParams.push(driverIds);
    }
    
    query += ` ORDER BY d.code ASC`;
    
    const result = await pool.query(query, queryParams);
    
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

