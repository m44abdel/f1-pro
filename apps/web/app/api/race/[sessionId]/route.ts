import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const pool = getPool();
    
    // Get all lap times for the session
    const lapsResult = await pool.query(`
      SELECT 
        l.driver_id,
        d.code as driver_code,
        d.name as driver_name,
        l.lap_number,
        l.lap_time_ms,
        l.compound,
        l.stint,
        l.is_personal_best,
        sr.position as final_position
      FROM laps l
      JOIN drivers d ON l.driver_id = d.id
      LEFT JOIN session_results sr ON sr.session_id = l.session_id AND sr.driver_id = l.driver_id
      WHERE l.session_id = $1
      ORDER BY l.driver_id, l.lap_number
    `, [sessionId]);
    
    // Get stints data
    const stintsResult = await pool.query(`
      SELECT 
        s.driver_id,
        d.code as driver_code,
        s.stint_number,
        s.compound,
        s.start_lap,
        s.end_lap,
        s.tire_age_at_start
      FROM stints s
      JOIN drivers d ON s.driver_id = d.id
      WHERE s.session_id = $1
      ORDER BY s.driver_id, s.stint_number
    `, [sessionId]);
    
    // Get pit stops
    const pitStopsResult = await pool.query(`
      SELECT 
        p.driver_id,
        d.code as driver_code,
        p.lap_number,
        p.duration_ms,
        p.pit_in_time,
        p.pit_out_time
      FROM pit_stops p
      JOIN drivers d ON p.driver_id = d.id
      WHERE p.session_id = $1
      ORDER BY p.driver_id, p.lap_number
    `, [sessionId]);
    
    // Get lap positions (for position changes chart)
    const positionsResult = await pool.query(`
      SELECT 
        lp.lap_number,
        lp.driver_id,
        d.code as driver_code,
        lp.position,
        lp.gap_to_leader_ms,
        lp.interval_ms
      FROM lap_positions lp
      JOIN drivers d ON lp.driver_id = d.id
      WHERE lp.session_id = $1
      ORDER BY lp.lap_number, lp.position
    `, [sessionId]);
    
    // Group data by driver
    const driversMap = new Map();
    
    // Process laps
    lapsResult.rows.forEach(lap => {
      const driverId = lap.driver_id;
      if (!driversMap.has(driverId)) {
        driversMap.set(driverId, {
          driver_id: driverId,
          driver_code: lap.driver_code,
          driver_name: lap.driver_name,
          final_position: lap.final_position,
          laps: [],
          stints: [],
          pit_stops: []
        });
      }
      driversMap.get(driverId).laps.push({
        lap_number: lap.lap_number,
        lap_time_ms: lap.lap_time_ms,
        compound: lap.compound,
        stint: lap.stint,
        is_personal_best: lap.is_personal_best
      });
    });
    
    // Add stints
    stintsResult.rows.forEach(stint => {
      const driver = driversMap.get(stint.driver_id);
      if (driver) {
        driver.stints.push({
          stint_number: stint.stint_number,
          compound: stint.compound,
          start_lap: stint.start_lap,
          end_lap: stint.end_lap,
          tire_age_at_start: stint.tire_age_at_start
        });
      }
    });
    
    // Add pit stops
    pitStopsResult.rows.forEach(stop => {
      const driver = driversMap.get(stop.driver_id);
      if (driver) {
        driver.pit_stops.push({
          lap_number: stop.lap_number,
          duration_ms: stop.duration_ms,
          pit_in_time: stop.pit_in_time,
          pit_out_time: stop.pit_out_time
        });
      }
    });
    
    // Process position changes by lap
    const positionsByLap = new Map();
    positionsResult.rows.forEach(pos => {
      if (!positionsByLap.has(pos.lap_number)) {
        positionsByLap.set(pos.lap_number, []);
      }
      positionsByLap.get(pos.lap_number).push({
        driver_id: pos.driver_id,
        driver_code: pos.driver_code,
        position: pos.position,
        gap_to_leader_ms: pos.gap_to_leader_ms,
        interval_ms: pos.interval_ms
      });
    });
    
    return NextResponse.json({
      success: true,
      data: {
        drivers: Array.from(driversMap.values()),
        positions: Array.from(positionsByLap.entries()).map(([lap, positions]) => ({
          lap_number: lap,
          positions
        }))
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
