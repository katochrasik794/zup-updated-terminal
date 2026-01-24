// middleware.ts (Edge runtime only)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login', // allow login
  '/api/auth/sso-login', // allow SSO auto-login from CRM
  '/api/auth/register', // allow registration
  '/apis/user', // allow getClientProfile API (will be protected by route itself)
  '/charting_library', // allow TradingView library
  '/trading_platform', // allow TradingView trading platform assets
  '/datafeeds', // allow datafeeds
  '/_next', '/favicon.ico', '/manifest.json'
];

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || 'dev-secret'
);

async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// Middleware to protect routes and verify JWT
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Add aggressive cache headers for charting library and datafeeds (static assets)
  if (pathname.startsWith('/charting_library/') || pathname.startsWith('/trading_platform/') || pathname.startsWith('/datafeeds/')) {
    const response = NextResponse.next();
    // Cache for 1 year (365 days) - these are static files that rarely change
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Expires', new Date(Date.now() + 31536000000).toUTCString());
    return response;
  }

  // skip public paths (including favicon which is handled by Next.js)
  // Also allow API routes - they handle their own authentication
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname.startsWith('/apis/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // get token from header, cookie, or localStorage (via client-side check)
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('token')?.value;

  if (!token) {
    // not authenticated -> redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

// Make sure to not run on static assets, etc.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|favicon.ico).*)'],
};
