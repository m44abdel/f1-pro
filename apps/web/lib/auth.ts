import { NextRequest } from 'next/server';

// Simple authentication for admin features
// In production, use a proper auth solution like NextAuth.js, Clerk, or Auth0

export function isAuthenticated(request: NextRequest): boolean {
  // Check for admin token in Authorization header
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken) {
    console.warn('ADMIN_API_TOKEN not configured');
    return false;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminToken;
}

export function requireAuth(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
