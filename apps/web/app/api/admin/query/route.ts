import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  // Check admin session
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session');
  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const { query, params = [] } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // Basic SQL injection prevention - only allow SELECT queries
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed' },
        { status: 403 }
      );
    }
    
    const pool = getPool();
    const startTime = Date.now();
    
    try {
      const result = await pool.query(query, params);
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map(f => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
        duration,
      });
    } catch (dbError: any) {
      return NextResponse.json(
        { 
          success: false,
          error: dbError.message,
          code: dbError.code,
          detail: dbError.detail
        },
        { status: 400 }
      );
    }
    
  } catch (error: any) {
    console.error('Query error:', error);
    return NextResponse.json(
      { error: error.message || 'Query failed' },
      { status: 500 }
    );
  }
}
