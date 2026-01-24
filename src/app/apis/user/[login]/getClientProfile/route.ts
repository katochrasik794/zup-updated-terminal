import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

// Validate Prisma is initialized
if (!prisma) {
  console.error('[getClientProfile] Prisma client is not initialized!');
}

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com';
const LIVE_API_URL = process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api';

/**
 * Get Client Access Token using AccountId and password
 */
async function getClientToken(accountId: string): Promise<{ token: string | null; accountId: string | null; error: string | null }> {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return { token: null, accountId: null, error: 'Unauthorized. Please log in.' };
    }

    // Get MT5 account credentials from database
    const mt5Account = await prisma.mT5Account.findFirst({
      where: {
        accountId: accountId,
        userId: session.userId,
      },
      select: {
        accountId: true,
        password: true,
      },
    });

    if (!mt5Account) {
      return { token: null, accountId: null, error: 'MT5 account not found or access denied' };
    }

    if (!mt5Account.password) {
      return { token: null, accountId: null, error: 'MT5 account password not configured' };
    }

    // Authenticate with client credentials
    const loginUrl = `${LIVE_API_URL.replace(/\/$/, '')}/client/ClientAuth/login`;
    
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AccountId: parseInt(mt5Account.accountId, 10),
        Password: mt5Account.password,
        DeviceId: `web_${session.userId}`,
        DeviceType: 'web',
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text().catch(() => 'No response body');
      console.error('[getClientProfile] Client login failed:', errorText);
      return { token: null, accountId: null, error: `Client login failed: ${loginResponse.status}` };
    }

    const loginData = await loginResponse.json();
    const token = loginData?.accessToken || loginData?.AccessToken || loginData?.Token || loginData?.token || null;

    if (!token) {
      return { token: null, accountId: null, error: 'No access token in response' };
    }

    return { token, accountId: mt5Account.accountId, error: null };
  } catch (error) {
    console.error('[getClientProfile] Client token fetch error:', error);
    return { token: null, accountId: null, error: 'Network error' };
  }
}

// The main GET handler - fetches account balance from external API and merges with database data
export async function GET(
  request: Request,
  context: { params: Promise<{ login: string }> }
) {
  let login: string = 'unknown';
  
  try {
    // Parse params
    const params = await context.params;
    login = params.login;

    // 0. Validate login parameter
    if (!login || login.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request: login parameter is required' 
      }, { status: 400 });
    }

    console.log(`[getClientProfile] Fetching profile for account: ${login}`);
    
    // Get session to verify user access
    const session = await getSession();
    console.log(`[getClientProfile] Session check:`, {
      hasSession: !!session,
      hasUserId: !!session?.userId,
      userId: session?.userId
    });
    
    // 1. Fetch account from MT5Account table
    let mt5Account;
    try {
      mt5Account = await prisma.mT5Account.findUnique({
        where: { 
          accountId: login 
        },
        select: {
          accountId: true,
          group: true,
          accountType: true,
          balance: true,
          equity: true,
          margin: true,
          marginFree: true,
          marginLevel: true,
          profit: true,
          credit: true,
          leverage: true,
          nameOnAccount: true,
          currency: true,
          userId: true,
        }
      });
      console.log(`[getClientProfile] Database query result:`, {
        found: !!mt5Account,
        accountId: mt5Account?.accountId,
        hasGroup: !!mt5Account?.group
      });
    } catch (dbError) {
      console.error(`[getClientProfile] Database query error:`, dbError);
      throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    if (!mt5Account) {
      console.warn(`[getClientProfile] Account not found: ${login}`);
      return NextResponse.json({
        success: false,
        error: 'Account not found',
        accountId: login
      }, { status: 404 });
    }

    // 2. Verify user has access to this account (if session exists)
    if (session?.userId && mt5Account.userId && mt5Account.userId !== session.userId) {
      console.warn(`[getClientProfile] Access denied for account ${login}`, {
        accountUserId: mt5Account.userId,
        sessionUserId: session.userId
      });
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // 3. Get client access token for external API (optional - will fallback to DB if fails)
    let accessToken: string | null = null;
    let verifiedAccountId: string | null = null;
    const { token, accountId, error: tokenError } = await getClientToken(login);
    if (token && accountId) {
      accessToken = token;
      verifiedAccountId = accountId;
      console.log(`[getClientProfile] Successfully obtained access token for account ${login}`);
    } else {
      console.warn(`[getClientProfile] Failed to get access token for account ${login}:`, tokenError);
      console.log(`[getClientProfile] Will use database data as fallback`);
    }

    // 4. Fetch account balance from external API (if we have a token)
    let balanceData: any = null;
    
    if (accessToken && verifiedAccountId) {
      // Use the correct endpoint format: /api/Users/{MT5AccountID}/GetClientBalance
      const balanceApiUrl = `${API_BASE_URL}/api/Users/${verifiedAccountId}/GetClientBalance`;
      
      try {
        console.log(`[getClientProfile] Fetching balance from external API: ${balanceApiUrl}`);
        const balanceResponse = await fetch(balanceApiUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'AccountId': verifiedAccountId,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        console.log(`[getClientProfile] Balance API response status: ${balanceResponse.status} ${balanceResponse.statusText}`);

        if (balanceResponse.ok) {
          const balanceResult = await balanceResponse.json();
          console.log(`[getClientProfile] Balance API raw response:`, JSON.stringify(balanceResult, null, 2));
          
          // Handle different response formats
          balanceData = balanceResult?.data || balanceResult?.Data || balanceResult;
          
          // If the response is wrapped, unwrap it
          if (balanceData && typeof balanceData === 'object' && !balanceData.Balance && !balanceData.balance) {
            // Check if it's nested
            balanceData = balanceData.result || balanceData.response || balanceData;
          }
          
          console.log(`[getClientProfile] Processed balance data:`, balanceData);
        } else {
          const errorText = await balanceResponse.text().catch(() => 'No response body');
          console.error(`[getClientProfile] Balance API failed (${balanceResponse.status}):`, errorText.substring(0, 500));
          throw new Error(`Balance API returned ${balanceResponse.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (err) {
        console.error(`[getClientProfile] Error calling balance API:`, err);
        // Will fallback to database data below
      }
    }
    
    // Fallback to database data if API call failed or no token
    if (!balanceData) {
      console.log(`[getClientProfile] Using database data (API unavailable or failed)`);
      balanceData = {
        Balance: mt5Account.balance ?? 0,
        Equity: mt5Account.equity ?? 0,
        Margin: mt5Account.margin ?? 0,
        MarginUsed: mt5Account.margin ?? 0,
        FreeMargin: mt5Account.marginFree ?? 0,
        MarginLevel: mt5Account.marginLevel ?? 0,
        Profit: mt5Account.profit ?? 0,
        Credit: mt5Account.credit ?? 0,
      };
    }

    // 5. Determine account type from group or accountType field
    let accountType: 'Demo' | 'Live' = 'Live';
    const groupLower = (mt5Account.group || '').toLowerCase();
    if (groupLower.includes('demo')) {
      accountType = 'Demo';
    } else if (groupLower.includes('live')) {
      accountType = 'Live';
    } else if (mt5Account.accountType === 'Demo') {
      accountType = 'Demo';
    } else if (mt5Account.accountType === 'Live') {
      accountType = 'Live';
    }

    // 6. Format response to match expected structure (merge API data with database metadata)
    const responseData = {
      Balance: balanceData?.Balance ?? balanceData?.balance ?? mt5Account.balance ?? 0,
      balance: balanceData?.Balance ?? balanceData?.balance ?? mt5Account.balance ?? 0,
      Equity: balanceData?.Equity ?? balanceData?.equity ?? mt5Account.equity ?? 0,
      equity: balanceData?.Equity ?? balanceData?.equity ?? mt5Account.equity ?? 0,
      Margin: balanceData?.Margin ?? balanceData?.margin ?? mt5Account.margin ?? 0,
      margin: balanceData?.Margin ?? balanceData?.margin ?? mt5Account.margin ?? 0,
      MarginUsed: balanceData?.MarginUsed ?? balanceData?.marginUsed ?? balanceData?.Margin ?? balanceData?.margin ?? mt5Account.margin ?? 0,
      marginUsed: balanceData?.MarginUsed ?? balanceData?.marginUsed ?? balanceData?.Margin ?? balanceData?.margin ?? mt5Account.margin ?? 0,
      FreeMargin: balanceData?.FreeMargin ?? balanceData?.freeMargin ?? mt5Account.marginFree ?? 0,
      freeMargin: balanceData?.FreeMargin ?? balanceData?.freeMargin ?? mt5Account.marginFree ?? 0,
      MarginLevel: balanceData?.MarginLevel ?? balanceData?.marginLevel ?? mt5Account.marginLevel ?? 0,
      marginLevel: balanceData?.MarginLevel ?? balanceData?.marginLevel ?? mt5Account.marginLevel ?? 0,
      Profit: balanceData?.Profit ?? balanceData?.profit ?? mt5Account.profit ?? 0,
      profit: balanceData?.Profit ?? balanceData?.profit ?? mt5Account.profit ?? 0,
      Credit: balanceData?.Credit ?? balanceData?.credit ?? mt5Account.credit ?? 0,
      credit: balanceData?.Credit ?? balanceData?.credit ?? mt5Account.credit ?? 0,
      Leverage: balanceData?.Leverage ?? balanceData?.leverage ?? (mt5Account.leverage ? `1:${mt5Account.leverage}` : '1:200'),
      leverage: balanceData?.Leverage ?? balanceData?.leverage ?? (mt5Account.leverage ? `1:${mt5Account.leverage}` : '1:200'),
      Name: balanceData?.Name ?? balanceData?.name ?? mt5Account.nameOnAccount || 'Account',
      name: balanceData?.Name ?? balanceData?.name ?? mt5Account.nameOnAccount || 'Account',
      Group: mt5Account.group || '',
      group: mt5Account.group || '',
      AccountType: accountType,
      accountType: accountType,
      Currency: balanceData?.Currency ?? balanceData?.currency ?? mt5Account.currency || 'USD',
      currency: balanceData?.Currency ?? balanceData?.currency ?? mt5Account.currency || 'USD',
    };

    console.log(`[getClientProfile] Successfully fetched profile for account: ${login}`);
    
    // 7. Return success response
    return NextResponse.json({
      success: true,
      data: responseData
    }, { status: 200 });

  } catch (error) {
    console.error(`[getClientProfile] Error for account ${login}:`, error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error: Failed to fetch account data.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      // Database connection errors
      if (error.message.includes('PrismaClient') || error.message.includes('connection') || error.message.includes('Database')) {
        errorMessage = 'Database connection error. Please try again.';
        statusCode = 502;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
        statusCode = 504;
      } else if (error.message.includes('params') || error.message.includes('login')) {
        errorMessage = 'Invalid request parameters.';
        statusCode = 400;
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      accountId: login !== 'unknown' ? login : undefined,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
    }, { status: statusCode });
  }
}
