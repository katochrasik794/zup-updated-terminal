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
    volume?: number; // 0 = Full Close, partial value = Partial Close
    price?: number; // Min/Max Price (Slippage protection)
    comment?: string;
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
    comment = 'Closed from Terminal'
}: ClosePositionDirectParams): Promise<ClosePositionResponse> {
    try {
        const url = `${METAAPI_BASE_URL}/api/client/position/${positionId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'AccountId': accountId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                volume,
                price,
                comment,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return {
                success: false,
                message: `Failed to close position: ${response.status} - ${errorText}`,
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
