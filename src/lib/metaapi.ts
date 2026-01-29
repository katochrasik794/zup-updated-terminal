/**
 * MetaAPI Direct Client
 * 
 * Direct API calls to MetaAPI for performance-critical operations.
 * Bypasses backend proxy to achieve sub-500ms response times.
 */

const METAAPI_BASE_URL = 'https://metaapi.zuperior.com';

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

export interface ClosePositionResponse {
    success: boolean;
    message?: string;
    data?: any;
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
        if (volume && volume > 0) params.set('volume', String(volume));
        const queryString = params.toString();
        const deleteUrl = `${API_BASE}/client/position/${positionIdNum}${queryString ? `?${queryString}` : ''}`;

        const baseHeaders: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'AccountId': accountId,
            'Accept': 'application/json',
        };

        // Validate token before making requests
        if (!accessToken || accessToken.trim() === '') {
            throw new Error('Invalid or missing access token');
        }

        // Try primary method first: DELETE /client/position/{positionId}
        let response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: baseHeaders,
        });

        let finalResponse = response;
        let finalError: string | null = null;

        // If DELETE fails, try POST fallbacks
        // Auth errors (401/403) on DELETE/POST endpoints are expected - they may not support our token format
        // We'll skip directly to Trading endpoint which works
        if (!response.ok && response.status !== 204) {
            const isAuthError = response.status === 401 || response.status === 403;
            const isMethodError = response.status === 405 || response.status === 415;
            
            // Skip fallback 1 if auth error - go directly to Trading endpoint
            let shouldTryFallback2 = isAuthError || isMethodError;
            
            if (!isAuthError && !isMethodError) {
                // Only log as debug/info, not error, since this is expected fallback behavior
                console.debug(`[ClosePosition] DELETE failed with ${response.status}, trying POST fallbacks`);
                
                // Fallback 1: POST /client/position/close with JSON payload (camelCase)
                try {
                    const payload: any = { positionId: positionIdNum };
                    if (volume && volume > 0) payload.volume = Number(volume);
                    
                    const postUrl = `${API_BASE}/client/position/close`;
                    const fallback1Response = await fetch(postUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...baseHeaders,
                        },
                        body: JSON.stringify(payload),
                    });

                    if (fallback1Response.ok || fallback1Response.status === 204) {
                        finalResponse = fallback1Response;
                        console.log(`[ClosePosition] Success via POST fallback 1`);
                        shouldTryFallback2 = false; // Success, don't try fallback 2
                    } else {
                        // Check if it's an auth/method error - skip to Trading endpoint
                        if (fallback1Response.status === 401 || fallback1Response.status === 403 || 
                            fallback1Response.status === 405 || fallback1Response.status === 415) {
                            console.debug(`[ClosePosition] POST fallback 1 not supported (${fallback1Response.status}), trying Trading endpoint`);
                            shouldTryFallback2 = true;
                        } else {
                            console.log(`[ClosePosition] POST fallback 1 failed with ${fallback1Response.status}, trying Trading endpoint`);
                            shouldTryFallback2 = true;
                        }
                    }
                } catch (fallbackError: any) {
                    console.debug(`[ClosePosition] Fallback 1 error:`, fallbackError);
                    shouldTryFallback2 = true; // Try Trading endpoint on error
                }
            } else {
                // Auth or method error on DELETE - skip fallback 1
                console.debug(`[ClosePosition] DELETE endpoint issue (${response.status}), skipping to Trading endpoint`);
            }
            
            // Fallback 2: POST /Trading/position/close with PascalCase payload (always try this as last resort)
            if (shouldTryFallback2) {
                try {
                    // Trading endpoint requires Login, PositionId, and Volume (all required)
                    // Login must be parsed as integer from accountId string
                    const accountIdNum = parseInt(String(accountId), 10);
                    if (isNaN(accountIdNum)) {
                        throw new Error(`Invalid accountId: ${accountId}`);
                    }
                    
                    // Trading endpoint requires Volume in MT5 internal format
                    // Volume must be multiples of 100 (step 100) where 100 = 1 lot
                    // But volumes < 100 are also valid (e.g., 1 = 0.01 lot, 10 = 0.1 lot)
                    // If volume is 0 (full close), use positionVolumeMT5 if provided, otherwise fetch position
                    let volumeToSend = 0;
                    
                    if (volume && volume > 0) {
                        // Partial close: convert lots to MT5 format (multiply by 100)
                        volumeToSend = Math.round(volume * 100);
                        // If >= 100, ensure it's a multiple of 100
                        if (volumeToSend >= 100) {
                            volumeToSend = Math.round(volumeToSend / 100) * 100;
                        }
                    } else if (positionVolumeMT5 !== undefined && positionVolumeMT5 !== null) {
                        // Full close: positionVolumeMT5 is already in MT5 format from TradingTerminal
                        // (it was converted from lots to MT5 by multiplying by 100)
                        volumeToSend = Number(positionVolumeMT5);
                        
                        // If >= 100, ensure it's a multiple of 100
                        if (volumeToSend >= 100) {
                            volumeToSend = Math.round(volumeToSend / 100) * 100;
                        }
                    } else {
                        // Fetch position to get actual volume
                        try {
                            const positionsUrl = `${API_BASE}/client/Positions`;
                            const positionsResponse = await fetch(positionsUrl, {
                                method: 'GET',
                                headers: baseHeaders,
                            });
                            
                            if (positionsResponse.ok) {
                                const positionsData = await positionsResponse.json() as any;
                                const positions = positionsData?.positions || positionsData?.data || positionsData || [];
                                const position = positions.find((p: any) => 
                                    (p.PositionId || p.positionId || p.Id || p.id) === positionIdNum
                                );
                                
                                if (position) {
                                    // Get volume - prefer Volume (MT5 format), otherwise VolumeLots (convert to MT5)
                                    const rawVolume = position.Volume || position.volume || 0;
                                    const posVolumeLots = position.VolumeLots || position.volumeLots;
                                    
                                    if (rawVolume > 0) {
                                        // Already in MT5 format
                                        volumeToSend = Number(rawVolume);
                                        // If >= 100, ensure it's a multiple of 100
                                        if (volumeToSend >= 100) {
                                            volumeToSend = Math.round(volumeToSend / 100) * 100;
                                        }
                                    } else if (posVolumeLots !== undefined && posVolumeLots !== null) {
                                        // Convert from lots to MT5 format (multiply by 100)
                                        volumeToSend = Math.round(Number(posVolumeLots) * 100);
                                        // If >= 100, ensure it's a multiple of 100
                                        if (volumeToSend >= 100) {
                                            volumeToSend = Math.round(volumeToSend / 100) * 100;
                                        }
                                    }
                                    console.log(`[ClosePosition] Fetched position volume: ${volumeToSend} (MT5 format)`);
                                }
                            }
                        } catch (fetchError) {
                            console.warn(`[ClosePosition] Could not fetch position volume:`, fetchError);
                            // If we can't get volume, we can't close - throw error
                            throw new Error('Cannot determine position volume for closing');
                        }
                    }
                    
                    // Trading endpoint requires Volume - use MT5 format volume directly
                    const tradingPayload: any = {
                        Login: accountIdNum, // Must be integer
                        PositionId: positionIdNum, // Must be integer
                        Volume: volumeToSend, // Volume in MT5 format (e.g., 1 = 0.01 lot, 100 = 1 lot)
                    };
                    
                    console.log(`[ClosePosition] Trading payload (Volume: ${volumeToSend} MT5 units):`, tradingPayload);
                    
                    const tradingUrl = `${API_BASE}/Trading/position/close`;
                    const fallback2Response = await fetch(tradingUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...baseHeaders,
                        },
                        body: JSON.stringify(tradingPayload),
                    });

                    if (fallback2Response.ok || fallback2Response.status === 204) {
                        finalResponse = fallback2Response;
                        console.log(`[ClosePosition] Success via Trading endpoint`);
                    } else {
                        // All methods failed, use the last error
                        finalResponse = fallback2Response;
                        const errorText = await fallback2Response.text().catch(() => '');
                        finalError = errorText || `All close methods failed. Last status: ${fallback2Response.status}`;
                    }
                } catch (tradingError: any) {
                    console.error(`[ClosePosition] Trading endpoint error:`, tradingError);
                    finalError = tradingError.message || 'Trading endpoint failed';
                }
            }
        }

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
        const tradePath = side === 'sell' ? 'trade-sell' : 'trade';
        const url = `${METAAPI_BASE_URL}/api/client/${tradePath}?account_id=${encodeURIComponent(accountId)}`;

        // Volume normalized to units
        const volumeInUnits = Math.round(volume * 100);

        // Mirroring PascalCase keys from fast pending orders
        const payload = {
            Symbol: symbol,
            Volume: volumeInUnits,
            Price: 0,
            StopLoss: Number(stopLoss || 0),
            TakeProfit: Number(takeProfit || 0),
            Comment: comment || (side === 'sell' ? 'Sell' : 'Buy'),
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
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
        const volumeInUnits = Math.round(volume * 100);

        const payload = {
            Symbol: symbol,
            Price: Number(price),
            Volume: volumeInUnits,
            StopLoss: Number(stopLoss || 0),
            TakeProfit: Number(takeProfit || 0),
            Expiration: '0001-01-01T00:00:00',
            Comment: comment || '',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
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
