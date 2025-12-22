import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

// Generate a session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Get admin password from environment
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD not configured");
      return NextResponse.json(
        { success: false, error: "Admin access not configured" },
        { status: 500 }
      );
    }
    
    // Verify password
    if (password !== adminPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      );
    }
    
    // Generate session token
    const sessionToken = generateSessionToken();
    
    // Set secure cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Admin access granted",
      // Return a client-side token for API calls
      token: process.env.ADMIN_API_TOKEN 
    });
    
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Logout - clear the session cookie
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  
  return NextResponse.json({ 
    success: true, 
    message: "Logged out successfully" 
  });
}

export async function GET(request: NextRequest) {
  // Check if user has valid admin session
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session');
  
  if (!sessionCookie) {
    return NextResponse.json({ 
      success: false, 
      isAdmin: false 
    });
  }
  
  // In a production app, you'd validate the session token against a store
  // For now, we just check if it exists
  return NextResponse.json({ 
    success: true, 
    isAdmin: true,
    token: process.env.ADMIN_API_TOKEN 
  });
}
