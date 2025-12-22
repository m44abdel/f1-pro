import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();
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

