
/**
 * MetaAPI Direct Client
 * 
 * Direct API calls to MetaAPI for performance-critical operations.
 * Bypasses backend proxy to achieve sub-500ms response times.
 */

const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';

// Cache for the best close method per account to avoid sequential fallbacks
const bestCloseMethodCache: Record<string, 'DELETE' | 'POST_CLOSE' | 'TRADING'> = {};

export interface ClosePositionDirectParams {
    positionId: string | number;
    accountId: string;
    accessToken: string;
    volume?: number; // 0 = Full Close, partial value = Partial Close (in lots)
    price?: number; // Min/Max Price (Slippage protection)
    comment?: string;
    positionVolumeMT5?: number; // Actual position volume in MT5 format (for Trading endpoint when volume is 0)
}

export interface PlaceMarketOrderDirectParams {
    accountId: string;
    accessToken: string;
    symbol: string;
    side: 'buy' | 'sell';
    volume: number; // lots
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
}

export interface PlacePendingOrderDirectParams {
    accountId: string;
    accessToken: string;
    symbol: string;
    side: 'buy' | 'sell';
    volume: number; // lots
    price: number;
    orderType: 'limit' | 'stop';
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
}

export interface ModifyPendingOrderDirectParams {
    orderId: string | number;
    accountId: string;
    accessToken: string;
    price?: number; // New order price
    stopLoss?: number; // New SL
    takeProfit?: number; // New TP
    comment?: string;
}

export interface ModifyPositionDirectParams {
    positionId: string | number;
    accountId: string;
    accessToken: string;
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
}

export interface ClosePositionResponse {
    success: boolean;
    message?: string;
    data?: any;
}

export interface LoginCredentials {
    AccountId: number;
    Password: string;
    DeviceId: string;
    DeviceType: string;
}

export interface LoginResponse {
    Token?: string;
    token?: string;
    error?: string;
}

export async function loginDirect(credentials: LoginCredentials): Promise<LoginResponse> {
    const url = `${METAAPI_BASE_URL}/api/client/ClientAuth/login`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
    });
    if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
    }
    return await response.json();
}

export async function getPositionsDirect(accountId: string, accessToken: string): Promise<any[]> {
    const url = `${METAAPI_BASE_URL}/api/client/Positions`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'AccountId': String(accountId),
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : (data.positions || []);
}

// Combined endpoint that returns both positions and pending orders
// This matches the working zup-updated-terminal implementation
export async function getPositionsAndOrdersDirect(accountId: string, accessToken: string): Promise<{ positions: any[], orders: any[] }> {
    // Try multiple endpoints to find orders
    const positionsUrl = `${METAAPI_BASE_URL}/api/client/Positions`;
    const ordersUrl = `${METAAPI_BASE_URL}/api/client/Orders`;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'AccountId': String(accountId),
        'Content-Type': 'application/json',
    };

    try {
        // Fetch positions and orders in parallel
        const [positionsResponse, ordersResponse] = await Promise.all([
            fetch(positionsUrl, { method: 'GET', headers }),
            fetch(ordersUrl, { method: 'GET', headers })
        ]);

        let positions: any[] = [];
        let orders: any[] = [];

        // Parse positions
        if (positionsResponse.ok) {
            const posData = await positionsResponse.json();
            console.log('[getPositionsAndOrdersDirect] Positions response:', posData);
            positions = Array.isArray(posData) ? posData : (posData.positions || posData.Positions || []);
        } else {
            console.warn('[getPositionsAndOrdersDirect] Positions failed:', positionsResponse.status);
        }

        // Parse orders
        if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            console.log('[getPositionsAndOrdersDirect] Orders response:', ordersData);
            console.log('[getPositionsAndOrdersDirect] Orders keys:', Object.keys(ordersData));
            orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.Orders || ordersData.pendingOrders || ordersData.PendingOrders || []);
        } else {
            console.warn('[getPositionsAndOrdersDirect] Orders endpoint failed:', ordersResponse.status);
        }

        console.log('[getPositionsAndOrdersDirect] Final result:', {
            positionsCount: positions.length,
            ordersCount: orders.length
        });

        return { positions, orders };
    } catch (error) {
        console.error('[getPositionsAndOrdersDirect] Error:', error);
        return { positions: [], orders: [] };
    }
}

// Deprecated: Use getPositionsAndOrdersDirect instead
// Kept for backward compatibility
export async function getPendingOrdersDirect(accountId: string, accessToken: string): Promise<any[]> {
    const result = await getPositionsAndOrdersDirect(accountId, accessToken);
    return result.orders;
}

export async function getAccountBalanceDirect(accountId: string, accessToken: string): Promise<number> {
    const url = `${METAAPI_BASE_URL}/api/client/Account/Balance`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'AccountId': String(accountId),
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        console.warn('[MetaAPI] Failed to fetch balance:', response.status);
        return 0;
    }

    const data = await response.json();
    // API might return { balance: 10000 } or just a number
    return typeof data === 'number' ? data : (data.balance || data.Balance || 0);
}


/**
 * Close a position directly via MetaAPI DELETE endpoint
 * Target response time: < 500ms (matches Postman performance of 262ms)
 */
export async function closePositionDirect({
    positionId,
    accountId,
    accessToken,
    volume = 0,
    price = 0,
    comment = 'Closed from Terminal',
    positionVolumeMT5
}: ClosePositionDirectParams): Promise<ClosePositionResponse> {
    try {
        const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;
        const positionIdNum = typeof positionId === 'string' ? parseInt(positionId, 10) : positionId;

        // Build query parameters for DELETE request (only volume, not comment/price)
        const params = new URLSearchParams();
        // REMOVED: Do not send volume in DELETE query to avoid 400 Bad Request
        // if (volume && volume > 0) params.set('volume', String(volume));
        const queryString = params.toString();
        const deleteUrl = `${API_BASE}/client/position/${positionIdNum}${queryString ? `?${queryString}` : ''}`;

        const baseHeaders: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'AccountId': accountId,
            'Accept': 'application/json',
            'Content-Type': 'application/json', // Fix 415 Unsupported Media Type
        };

        // Validate token before making requests
        if (!accessToken || accessToken.trim() === '') {
            throw new Error('Invalid or missing access token');
        }

        // Try primary method first: DELETE /client/position/{positionId}
        const currentBestMethod = bestCloseMethodCache[accountId];
        console.log(`[ClosePosition] Best method for ${accountId}: ${currentBestMethod || 'None'}`);

        let response: any = { ok: false, status: 0 };
        let finalResponse: any = response;
        let finalError: string | null = null;
        let methodUsed: 'DELETE' | 'POST_CLOSE' | 'TRADING' | null = null;

        // --- METHOD 1: DELETE (Primary) ---
        const tryDelete = async () => {
            console.debug(`[ClosePosition] Trying DELETE...`);
            const res = await fetch(deleteUrl, { method: 'DELETE', headers: baseHeaders });
            if (res.ok || res.status === 204) {
                bestCloseMethodCache[accountId] = 'DELETE';
                methodUsed = 'DELETE';
            }
            return res;
        };

        // --- METHOD 2: POST /client/position/close ---
        const tryPostClose = async () => {
            console.debug(`[ClosePosition] Trying POST fallback 1...`);
            const payload: any = { positionId: positionIdNum };
            if (volume && volume > 0) payload.volume = Number(volume);
            const res = await fetch(`${API_BASE}/client/position/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...baseHeaders },
                body: JSON.stringify(payload),
            });
            if (res.ok || res.status === 204) {
                bestCloseMethodCache[accountId] = 'POST_CLOSE';
                methodUsed = 'POST_CLOSE';
            }
            return res;
        };

        // --- METHOD 3: Trading endpoint (Final resort) ---
        const tryTradingEndpoint = async () => {
            console.debug(`[ClosePosition] Trying Trading endpoint fallback 2...`);
            const accountIdNum = parseInt(String(accountId), 10);
            let volumeToSend = 0;
            if (volume && volume > 0) {
                volumeToSend = Math.round(volume * 100);
                if (volumeToSend >= 100) volumeToSend = Math.round(volumeToSend / 100) * 100;
            } else if (positionVolumeMT5 !== undefined && positionVolumeMT5 !== null) {
                volumeToSend = Number(positionVolumeMT5);
                if (volumeToSend >= 100) volumeToSend = Math.round(volumeToSend / 100) * 100;
            } else {
                // Fetch position volume if not provided
                try {
                    const positionsResponse = await fetch(`${API_BASE}/client/Positions`, { method: 'GET', headers: baseHeaders });
                    if (positionsResponse.ok) {
                        const positionsData = await positionsResponse.json() as any;
                        const positions = positionsData?.positions || positionsData || [];
                        const pos = positions.find((p: any) => (p.PositionId || p.positionId || p.Id || p.id) === positionIdNum);
                        if (pos) {
                            const rawVolume = pos.Volume || pos.volume || 0;
                            const posLots = pos.VolumeLots || pos.volumeLots;
                            volumeToSend = rawVolume > 0 ? Number(rawVolume) : Math.round(Number(posLots) * 100);
                            if (volumeToSend >= 100) volumeToSend = Math.round(volumeToSend / 100) * 100;
                        }
                    }
                } catch { }
            }

            if (volumeToSend === 0) throw new Error('Cannot determine volume');

            const res = await fetch(`${API_BASE}/Trading/position/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...baseHeaders },
                body: JSON.stringify({ Login: accountIdNum, PositionId: positionIdNum, Volume: volumeToSend }),
            });
            if (res.ok || res.status === 204) {
                bestCloseMethodCache[accountId] = 'TRADING';
                methodUsed = 'TRADING';
            }
            return res;
        };

        // EXECUTOR BASED ON CACHE
        if (currentBestMethod === 'TRADING') {
            response = await tryTradingEndpoint();
        } else if (currentBestMethod === 'POST_CLOSE') {
            response = await tryPostClose();
            if (!response.ok) response = await tryTradingEndpoint();
        } else {
            // Default: DELETE -> POST_CLOSE -> TRADING
            response = await tryDelete();
            if (!response.ok && response.status !== 204) {
                response = await tryPostClose();
                if (!response.ok && response.status !== 204) {
                    response = await tryTradingEndpoint();
                }
            }
        }

        finalResponse = response;

        // Check final response
        if (!finalResponse.ok && finalResponse.status !== 204) {
            const errorText = finalError || await finalResponse.text().catch(() => '');
            // Only log as error if all methods failed
            console.error(`[ClosePosition] All methods failed. Last status: ${finalResponse.status} - ${errorText}`);
            return {
                success: false,
                message: `Failed to close position: ${finalResponse.status} - ${errorText}`,
            };
        }

        // Success - log which method worked
        if (finalResponse === response) {
            console.log(`[ClosePosition] Success via DELETE method`);
        } else {
            // Already logged in fallback sections
        }

        // Handle both JSON and empty responses (204 No Content)
        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch {
                // Response might be empty, that's okay
            }
        }

        console.log(`[ClosePosition] Success: Position ${positionId} closed`);
        return {
            success: true,
            data,
        };
    } catch (error: any) {
        console.error(`[ClosePosition] Error:`, error);
        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}

/**
 * Cancel a pending order directly via MetaAPI
 * Uses DELETE /api/client/order/{orderId} as per documentation
 */
export async function cancelPendingOrderDirect({
    orderId,
    accountId,
    accessToken,
    comment = 'Cancelled from Terminal'
}: {
    orderId: string | number;
    accountId: string;
    accessToken: string;
    comment?: string;
}): Promise<ClosePositionResponse> {
    try {
        const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;

        // Parse order ID - handle both string and number, remove "Generated-" prefix if present
        let orderIdNum: number;
        if (typeof orderId === 'string') {
            // Remove "Generated-" prefix if present
            const cleanedId = orderId.replace('Generated-', '').trim();
            orderIdNum = parseInt(cleanedId, 10);
        } else {
            orderIdNum = orderId;
        }

        // Validate order ID
        if (isNaN(orderIdNum) || orderIdNum <= 0) {
            console.error(`[CancelOrder] Invalid order ID: ${orderId} (parsed as ${orderIdNum})`);
            return {
                success: false,
                message: `Invalid order ID: ${orderId}`,
            };
        }

        // Use DELETE /api/client/order/{orderId} as per documentation
        const cancelUrl = `${API_BASE}/client/order/${orderIdNum}`;

        // Request body with optional Comment
        const payload: any = {};
        if (comment) {
            payload.Comment = comment;
        }

        const response = await fetch(cancelUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': String(accountId),
                'Content-Type': 'application/json',
            },
            body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`[CancelOrder] Failed: ${response.status} - ${errorText}`);
            return {
                success: false,
                message: `Failed to cancel order: ${response.status} - ${errorText}`,
            };
        }

        // Handle both JSON and empty responses (204 No Content)
        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch {
                // Response might be empty, that's okay
            }
        }

        console.log(`[CancelOrder] Success: Order ${orderId} cancelled`);
        return {
            success: true,
            data,
        };
    } catch (error: any) {
        console.error(`[CancelOrder] Error:`, error);
        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}

/**
 * Close multiple positions in parallel
 */
export async function closeMultiplePositionsDirect(
    positions: Array<{ positionId: string | number; symbol: string }>,
    accountId: string,
    accessToken: string
): Promise<{ successful: number; failed: number }> {
    const closePromises = positions.map(pos =>
        closePositionDirect({
            positionId: pos.positionId,
            accountId,
            accessToken,
        })
    );

    const results = await Promise.allSettled(closePromises);

    const successful = results.filter(
        r => r.status === 'fulfilled' && r.value.success
    ).length;

    const failed = results.length - successful;

    return { successful, failed };
}

/**
 * Helper to determine the volume for pending orders sent to the C# MT5 API bridge.
 * Scaling varies by symbol category to satisfy server-side minimums and multipliers.
 */
function getPendingOrderVolume(symbol: string, volume: number): number {
    const s = symbol.toUpperCase();

    // Indices (US30, NAS100, DAX/GER40, etc.)
    // User: typing 0.01 and sending 0.1 (v*10) placed 0.10. 
    // To get 0.01 placed, we must send 0.01. So multiplier is 1x.
    const isIndex = s.includes('US30') || s.includes('NAS') || s.includes('GER') || s.includes('DE30') ||
        s.includes('SPX') || s.includes('UK100') || s.includes('HK50') || s.includes('FRA40') ||
        s.includes('ESTX50') || s.includes('AUS200') || s.includes('US500') || s.includes('VIX');

    if (isIndex) {
        return parseFloat(volume.toFixed(3));
    }

    // Metals, Forex, Crypto, Energies
    // Metals/Forex: v*10 (0.1) failed with "min=1". Sending 1 (v*100) targets 0.01 lot placement.
    // Crypto: v*10 (0.1) placed 0.001. To get 0.01, we need 10x more (v*100 = 1).
    return Math.round(volume * 100);
}

/**
 * Place a market order directly via MetaAPI
 */
export async function placeMarketOrderDirect({
    accountId,
    accessToken,
    symbol,
    side,
    volume,
    stopLoss = 0,
    takeProfit = 0,
    comment = ''
}: PlaceMarketOrderDirectParams): Promise<ClosePositionResponse> {
    try {
        // Market orders expect volume * 100 for ALL symbols
        const volumeToSend = Math.round(Number(volume) * 100);

        // Use specific endpoint for buy vs sell
        const tradePath = side === 'sell' ? 'trade-sell' : 'trade';
        const url = `${METAAPI_BASE_URL}/api/client/${tradePath}?account_id=${encodeURIComponent(accountId)}`;

        // Mirroring PascalCase keys from fast pending orders
        const payload = {
            Symbol: symbol,
            Volume: volumeToSend,
            Price: 0,
            StopLoss: Number(stopLoss || 0),
            TakeProfit: Number(takeProfit || 0),
            Comment: comment || (side === 'sell' ? 'Sell' : 'Buy'),
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': String(accountId),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');

            // Handle 10012 return code (Request Placed) - treats as success
            try {
                const data = JSON.parse(errorText);
                const returnCode = data.returnCode || data.ReturnCode;
                if (returnCode === 10012) {
                    console.log('[placeMarketOrderDirect] Request Placed (10012) - treating as success');
                    return { success: true, data };
                }
            } catch (e) {
                // Not JSON, continue to normal error reporting
            }

            return {
                success: false,
                message: `Failed to place market order: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            data,
        };
    } catch (error: any) {

        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}

/**
 * Place a pending order directly via MetaAPI
 */
export async function placePendingOrderDirect({
    accountId,
    accessToken,
    symbol,
    side,
    volume,
    price,
    orderType,
    stopLoss = 0,
    takeProfit = 0,
    comment = ''
}: PlacePendingOrderDirectParams): Promise<ClosePositionResponse> {
    try {
        // Determine endpoint
        let endpoint = '';
        if (side === 'buy' && orderType === 'limit') endpoint = 'buy-limit';
        else if (side === 'sell' && orderType === 'limit') endpoint = 'sell-limit';
        else if (side === 'buy' && orderType === 'stop') endpoint = 'buy-stop';
        else if (side === 'sell' && orderType === 'stop') endpoint = 'sell-stop';

        if (!endpoint) {
            return { success: false, message: 'Invalid order type' };
        }

        const url = `${METAAPI_BASE_URL}/api/client/${endpoint}?account_id=${encodeURIComponent(accountId)}`;

        // Pending orders expect exact lots for Forex, but * 100 for Crypto
        const volumeToSend = getPendingOrderVolume(symbol, volume);

        // Match backend schema: FLAT PascalCase payload
        const payload = {
            Symbol: symbol,
            Price: Number(price),
            Volume: volumeToSend,
            StopLoss: Number(stopLoss || 0),
            TakeProfit: Number(takeProfit || 0),
            Expiration: '0001-01-01T00:00:00',
            Comment: comment || '',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': String(accountId),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');

            // Handle 10012 return code (Request Placed) - treats as success
            try {
                const data = JSON.parse(errorText);
                const returnCode = data.returnCode || data.ReturnCode;
                if (returnCode === 10012) {
                    console.log('[placePendingOrderDirect] Request Placed (10012) - treating as success');
                    return { success: true, data };
                }
            } catch (e) {
                // Not JSON, continue to normal error reporting
            }

            return {
                success: false,
                message: `Failed to place pending order: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            data,
        };
    } catch (error: any) {

        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}

/**
 * Modify position TP/SL via MetaAPI
 */
export async function modifyPositionDirect({
    positionId,
    accountId,
    accessToken,
    stopLoss,
    takeProfit,
    comment = 'Modified from Chart'
}: ModifyPositionDirectParams): Promise<ClosePositionResponse> {
    try {
        const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;

        const positionIdNum = typeof positionId === 'string' ? parseInt(positionId, 10) : positionId;
        // Primary URL: /api/client/position/modify?account_id={accountId}
        const modifyUrl = `${API_BASE}/client/position/modify?account_id=${encodeURIComponent(accountId)}`;

        const payload: any = {
            PositionId: typeof positionId === 'string' ? parseInt(positionId, 10) : positionId,
            Comment: comment,
        };

        if (stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0) {
            payload.StopLoss = Number(stopLoss);
        }
        if (takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0) {
            payload.TakeProfit = Number(takeProfit);
        }

        let response = await fetch(modifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': String(accountId),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // Fallback: PUT /api/Trading/position/modify with PascalCase
            const fallbackUrl = `${API_BASE}/Trading/position/modify?account_id=${encodeURIComponent(accountId)}`;
            const fallbackPayload = {
                Login: parseInt(accountId, 10),
                PositionId: Number(positionIdNum),
                StopLoss: stopLoss !== undefined ? Number(stopLoss) : 0,
                TakeProfit: takeProfit !== undefined ? Number(takeProfit) : 0,
                Comment: comment || 'Modified from Terminal'
            };

            const fallbackRes = await fetch(fallbackUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'AccountId': String(accountId),
                },
                body: JSON.stringify(fallbackPayload),
            });

            if (fallbackRes.ok) response = fallbackRes;
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');

            // Handle 10012 return code (Request Placed) - treats as success
            try {
                const data = JSON.parse(errorText);
                const returnCode = data.returnCode || data.ReturnCode;
                if (returnCode === 10012) {
                    console.log('[modifyPositionDirect] Request Placed (10012) - treating as success');
                    return { success: true, data };
                }
            } catch (e) {
                // Not JSON, continue to normal error reporting
            }

            return {
                success: false,
                message: `Failed to modify position: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            data,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}

/**
 * Modify pending order price/TP/SL via MetaAPI
 */
export async function modifyPendingOrderDirect({
    orderId,
    accountId,
    accessToken,
    price,
    stopLoss,
    takeProfit,
    comment = 'Modified from Chart'
}: ModifyPendingOrderDirectParams): Promise<ClosePositionResponse> {
    try {
        const API_BASE = METAAPI_BASE_URL.endsWith('/api') ? METAAPI_BASE_URL : `${METAAPI_BASE_URL}/api`;

        // Parse order ID - handle both string and number, remove "Generated-" prefix if present
        let orderIdNum: number;
        if (typeof orderId === 'string') {
            const cleanedId = orderId.replace('Generated-', '').trim();
            orderIdNum = parseInt(cleanedId, 10);
        } else {
            orderIdNum = orderId;
        }
        // URL: /client/order/{orderId} — matches working zup-updated-terminal implementation
        const url = `${API_BASE}/client/order/${orderIdNum}`;

        const payload: any = {
            OrderId: orderIdNum,
            Comment: comment,
        };

        if (price !== undefined && price !== null && Number(price) > 0) {
            payload.Price = Number(price);
        }
        if (stopLoss !== undefined && stopLoss !== null) {
            payload.StopLoss = Number(stopLoss) > 0 ? Number(stopLoss) : 0;
        }
        if (takeProfit !== undefined && takeProfit !== null) {
            payload.TakeProfit = Number(takeProfit) > 0 ? Number(takeProfit) : 0;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': String(accountId),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');

            // Handle 10012 return code (Request Placed) - treats as success
            try {
                const data = JSON.parse(errorText);
                const returnCode = data.returnCode || data.ReturnCode;
                if (returnCode === 10012) {
                    console.log('[modifyPendingOrderDirect] Request Placed (10012) - treating as success');
                    return { success: true, data };
                }
            } catch (e) {
                // Not JSON, continue
            }

            // Treat unsupported methods as a soft success to avoid noisy errors in UI
            if (response.status === 405 || response.status === 404 || response.status === 501) {
                console.warn('[modifyPendingOrderDirect] Endpoint not supported (soft pass):', response.status, errorText);
                return { success: true, message: 'Modify not supported; skipped' };
            }

            console.warn('[modifyPendingOrderDirect] Failed:', response.status, errorText);
            return {
                success: false,
                message: `Failed to modify pending order: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();
        console.log('[modifyPendingOrderDirect] Success:', data);
        return {
            success: true,
            data,
        };
    } catch (error: any) {
        console.warn('[modifyPendingOrderDirect] Error:', error);
        return {
            success: false,
            message: error.message || 'Network error',
        };
    }
}
