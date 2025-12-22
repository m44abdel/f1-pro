import { NextResponse } from "next/server";
import { getReadOnlyPool } from "@/lib/db-readonly";

export async function GET() {
  try {
    const pool = getReadOnlyPool();
    const result = await pool.query("SELECT NOW() as current_time, version() as pg_version");
    
    return NextResponse.json({
      success: true,
      message: "Connected to Neon PostgreSQL successfully!",
      data: result.rows[0],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to database",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

