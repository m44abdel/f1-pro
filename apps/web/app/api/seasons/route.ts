import { NextResponse } from "next/server";
import { getReadOnlyPool } from "@/lib/db-readonly";

export async function GET() {
  try {
    const pool = getReadOnlyPool();
    const result = await pool.query(`
      SELECT DISTINCT season 
      FROM weekends 
      ORDER BY season DESC
    `);
    
    return NextResponse.json({
      success: true,
      data: result.rows.map(r => r.season),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

