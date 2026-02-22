import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * Proxy endpoint for SignalR negotiate requests to avoid CORS issues
 * Usage: GET /apis/signalr/negotiate?hub=<hub-name>&<other-params>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hub = searchParams.get('hub') || 'mobiletrading';

    // Get all query parameters except 'hub' since we'll build the target URL
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'hub') {
        params.append(key, value);
      }
    });

    // Build the target negotiate URL
    // The hub URL should point to the SignalR hub endpoint
    const RAW_BASE = (process.env.TRADING_HUB_URL || 'https://metaapi.zuperior.com').replace(/\/$/, '');
    const TRADING_HUB_BASE = RAW_BASE.includes('/hubs/') ? RAW_BASE : `${RAW_BASE}/hubs/${hub}`;

    const negotiateUrl = `${TRADING_HUB_BASE}/negotiate${params.toString() ? '?' + params.toString() : ''}`;


    // Forward the negotiate request
    // Collect optional auth headers from the incoming request or query params
    const incomingHeaders = request.headers;
    let clientToken = incomingHeaders.get('x-client-token') || searchParams.get('clientToken') || undefined;
    let accountId = incomingHeaders.get('x-account-id') || searchParams.get('accountId') || undefined;
    let managerToken = incomingHeaders.get('x-manager-token') || process.env.MANAGER_AUTH_TOKEN || undefined;

    // If client token not provided, try to obtain a client access token using the backend API
    if (!clientToken) {
      try {
        const session = await getSession();
        if (session?.userId && accountId) {
          // Call backend API to get MetaAPI token
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5001';
          const tokenRes = await fetch(`${backendUrl}/api/accounts/${accountId}/metaapi-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            cache: 'no-store',
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json().catch(() => ({} as any));
            clientToken = tokenData?.token || tokenData?.Token || tokenData?.accessToken || undefined;
            if (clientToken) {
            }
          } else {
            const errorText = await tokenRes.text().catch(() => '');
          }
        }
      } catch (err) {
      }
    }

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(incomingHeaders.get('authorization') ? { 'Authorization': incomingHeaders.get('authorization')! } : {}),
      ...(clientToken ? { 'X-Client-Token': clientToken } : {}),
      ...(accountId ? { 'X-Account-ID': accountId } : {}),
      ...(managerToken ? { 'X-Manager-Token': managerToken } : {}),
    };

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout for SignalR negotiate

    try {
      const response = await fetch(negotiateUrl, {
        method: 'GET',
        headers: forwardHeaders,
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return NextResponse.json(
          { error: `Negotiate failed: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();

      // Modify the response to point WebSocket connections through our proxy
      // For now, we'll keep the original URL but this can be modified if needed

      return NextResponse.json(data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Request timeout - SignalR hub may be unavailable or slow. Please try again.' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to SignalR hub', details: fetchError.message },
        { status: 502 }
      );
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

// Support POST negotiate (some SignalR clients POST negotiate)
export async function POST(request: NextRequest) {
  try {
    // POST negotiate requests should work the same as GET
    // The query params are in the URL, not the body
    // Reuse GET logic - NextRequest handles query params from URL automatically
    return GET(request)
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
