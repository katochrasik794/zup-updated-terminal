import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// Configuration
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5000';

// The main GET handler - proxies to backend API
export async function GET(
  request: Request,
  context: { params: Promise<{ login: string }> }
) {
  let login: string = 'unknown';
  
  try {
    // Parse params
    const params = await context.params;
    login = params.login;

    // Validate login parameter
    if (!login || login.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request: login parameter is required' 
      }, { status: 400 });
    }

    // Get session to verify user access
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Forward request to backend API
    const backendResponse = await fetch(`${BACKEND_URL}/api/accounts/${login}/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ error: 'Backend request failed' }));
      return NextResponse.json({
        success: false,
        error: errorData.message || errorData.error || 'Failed to fetch account profile',
        accountId: login
      }, { status: backendResponse.status });
    }

    const backendData = await backendResponse.json();
    
    // Return the backend response
    return NextResponse.json({
      success: true,
      data: backendData.data || backendData
    }, { status: 200 });

  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      accountId: login !== 'unknown' ? login : undefined
    }, { status: 500 });
  }
}
