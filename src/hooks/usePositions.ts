"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

export interface Position {
  id: string;
  ticket: number;
  positionId?: number;
  orderId?: number; // Order ID for pending orders (OrderId from API)
  symbol: string;
  type: 'Buy' | 'Sell' | 'Buy Limit' | 'Sell Limit' | 'Buy Stop' | 'Sell Stop' | 'Hedged';
  volume: number;
  openPrice: number;
  currentPrice: number;
  closePrice?: number; // Close price for closed trades
  takeProfit?: number;
  stopLoss?: number;
  openTime: string;
  closeTime?: string; // Close time for closed trades
  swap: number;
  profit: number;
  commission: number;
  comment?: string;
  orderType?: number; // Store the original Type value for pending orders
}

interface UsePositionsProps {
  accountId: string | null;
  enabled?: boolean;
  includeClosed?: boolean;
}

interface UsePositionsReturn {
  positions: Position[];
  pendingOrders: Position[];
  closedPositions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  refetchClosed: () => void;
}

// Polling interval tuned to balance freshness and backend load
const POLL_INTERVAL = 200; // 200ms for high responsiveness (User request)

// Format single position from API response
const formatPosition = (pos: any, isClosedTrade: boolean = false): Position => {
  const generateStableId = () => {
    const s = pos.Symbol || pos.symbol || 'unknown';
    const action = pos.Action || pos.action;
    const t = (String(action) === '0' || action === 'Buy' || String(pos.Type) === '0' || pos.type === 0 || String(pos.Type) === 'Buy' || pos.type === 'Buy') ? 'Buy' : 'Sell';
    const time = pos.TimeCreate || pos.timeCreate || pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || pos.CloseTime || pos.closeTime || '0';
    const price = pos.PriceOpen ?? pos.priceOpen ?? pos.OpenPrice ?? pos.openPrice ?? pos.Price ?? pos.price ?? '0';
    const str = `${s}-${t}-${time}-${price}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `generated-${Math.abs(hash)}`;
  };

  // Get Type field for order type mapping (for pending orders) - MUST be before ticketId calculation
  const orderType = pos.Type ?? pos.type ?? pos.OrderType ?? pos.orderType;

  // For closed trades from tradehistory, use OrderId or DealId as ticket
  // For pending orders (Type 2-5), prefer OrderId or Ticket
  // For open positions, use PositionId or Ticket
  const isPendingOrderType = typeof orderType === 'number' && orderType >= 2 && orderType <= 5;

  const ticketId = isClosedTrade
    ? (pos.OrderId ?? pos.orderId ?? pos.DealId ?? pos.dealId ?? pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? generateStableId())
    : isPendingOrderType
      ? (pos.OrderId ?? pos.orderId ?? pos.Ticket ?? pos.ticket ?? pos.PositionId ?? pos.PositionID ?? pos.Id ?? pos.id ?? generateStableId())
      : (pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? generateStableId());
  const id = String(ticketId);

  // Map order types: 0=Buy, 1=Sell, 2=Buy Limit, 3=Sell Limit, 4=Buy Stop, 5=Sell Stop
  let mappedType: 'Buy' | 'Sell' | 'Buy Limit' | 'Sell Limit' | 'Buy Stop' | 'Sell Stop' | 'Hedged';

  if (typeof orderType === 'number') {
    switch (orderType) {
      case 0:
        mappedType = 'Buy';
        break;
      case 1:
        mappedType = 'Sell';
        break;
      case 2:
        mappedType = 'Buy Limit';
        break;
      case 3:
        mappedType = 'Sell Limit';
        break;
      case 4:
        mappedType = 'Buy Stop';
        break;
      case 5:
        mappedType = 'Sell Stop';
        break;
      default:
        // Fallback to Action-based logic for open positions
        const action = pos.Action ?? pos.action;
        const isBuy = String(action) === '0' || String(action).toLowerCase() === 'buy' || String(orderType) === '0' || String(orderType).toLowerCase() === 'buy';
        mappedType = isBuy ? 'Buy' : 'Sell';
    }
  } else if (typeof orderType === 'string') {
    // Handle string-based type mapping
    const typeStr = orderType.toString().toLowerCase();
    if (typeStr === 'buy' || typeStr === '0') {
      mappedType = 'Buy';
    } else if (typeStr === 'sell' || typeStr === '1') {
      mappedType = 'Sell';
    } else if (typeStr === 'buy limit' || typeStr === '2') {
      mappedType = 'Buy Limit';
    } else if (typeStr === 'sell limit' || typeStr === '3') {
      mappedType = 'Sell Limit';
    } else if (typeStr === 'buy stop' || typeStr === '4') {
      mappedType = 'Buy Stop';
    } else if (typeStr === 'sell stop' || typeStr === '5') {
      mappedType = 'Sell Stop';
    } else {
      // Fallback to Action-based logic
      const action = pos.Action ?? pos.action;
      const isBuy = String(action).toLowerCase() === 'buy' || String(action) === '0';
      mappedType = isBuy ? 'Buy' : 'Sell';
    }
  } else {
    // Fallback to Action-based logic for open positions
    const action = pos.Action ?? pos.action;
    const isBuy = String(action).toLowerCase() === 'buy' || String(action) === '0' || String(orderType).toLowerCase() === 'buy' || String(orderType) === '0';
    mappedType = isBuy ? 'Buy' : 'Sell';
  }

  // Check if this is a pending order (Type 2-5: Buy Limit, Sell Limit, Buy Stop, Sell Stop)
  const isPendingOrder = typeof orderType === 'number' && orderType >= 2 && orderType <= 5;

  // For closed trades, handle volume differently (VolumeLots or Volume)
  let volume = 0;
  if (isClosedTrade) {
    // TradeHistory API uses VolumeLots (in lots) or Volume
    const volumeLots = pos.VolumeLots ?? pos.volumeLots;
    const rawVolume = pos.Volume ?? pos.volume ?? 0;

    if (volumeLots !== undefined && volumeLots !== null) {
      volume = Number(volumeLots);
    } else if (rawVolume !== undefined && rawVolume !== null) {
      const numVolume = Number(rawVolume);
      // If volume < 1, multiply by 1000; if >= 100, divide by 100
      if (numVolume > 0 && numVolume < 1) {
        volume = numVolume * 1000;
      } else if (numVolume >= 100) {
        volume = numVolume / 100;
      } else {
        volume = numVolume;
      }
    }
  } else if (isPendingOrder) {
    // Pending Orders: Prioritize lots, then units (assume 100 units = 1 lot based on orders.ts)
    const vLots = Number(pos.VolumeLots ?? pos.volumeLots ?? 0);
    const vRaw = Number(pos.Volume ?? pos.volume ?? 0);
    const vInit = Number(pos.InitialVolume ?? pos.initialVolume ?? 0);
    const vCurrent = Number(pos.VolumeCurrent ?? pos.volumeCurrent ?? 0);

    if (vLots > 0) {
      volume = vLots;
    } else if (vRaw > 0) {
      // Return raw volume specific to pending orders (likely units/centilots)
      // Do NOT normalize here, as Chart expects units and TradingTerminal handles display
      volume = vRaw;
    } else if (vInit > 0) {
      volume = vInit;
    } else if (vCurrent > 0) {
      volume = vCurrent;
    }
  } else {
    // Normalizing all open position volumes to lots by dividing by 100
    // This matches the scaling used for pending orders and the *100 logic in metaapi.ts
    const rawVolume = Number(pos.Volume || pos.volume || 0);
    volume = rawVolume / 100;
  }

  // For closed trades, Price is the close price, OpenPrice is the entry price
  // For pending orders, use PriceOrder instead of PriceOpen
  // For open positions, use PriceOpen
  const openPrice = isClosedTrade
    ? Number(pos.OpenPrice ?? pos.openPrice ?? pos.PriceOpen ?? pos.priceOpen ?? 0)
    : isPendingOrder
      ? Number(pos.PriceOrder ?? pos.priceOrder ?? pos.PriceOpen ?? pos.priceOpen ?? pos.OpenPrice ?? pos.openPrice ?? 0)
      : Number(pos.PriceOpen ?? pos.priceOpen ?? pos.OpenPrice ?? pos.openPrice ?? 0);

  const currentPrice = isClosedTrade
    ? Number(pos.Price ?? pos.price ?? pos.ClosePrice ?? pos.closePrice ?? 0) // Close price for closed trades
    : Number(pos.PriceCurrent ?? pos.priceCurrent ?? pos.CurrentPrice ?? pos.currentPrice ?? 0);

  // For closed trades, use CloseTime; for pending orders, prioritize TimeSetup; for open positions, use TimeCreate/TimeSetup
  let openTime: string;
  let closeTime: string | undefined;

  if (isClosedTrade) {
    // For closed trades, OpenTime is the entry time, and CloseTime is the exit time
    openTime = pos.OpenTime ?? pos.openTime ?? pos.OpenTradeTime ?? pos.openTradeTime ?? pos.TimeCreate ?? pos.timeCreate ?? new Date().toISOString();
    closeTime = pos.CloseTime ?? pos.closeTime ?? new Date().toISOString();
  } else if (isPendingOrder) {
    // For pending orders, TimeSetup is the primary source
    openTime = pos.TimeSetup ?? pos.timeSetup ?? pos.TimeCreate ?? pos.timeCreate ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString();
  } else {
    openTime = pos.TimeCreate ?? pos.timeCreate ?? pos.TimeSetup ?? pos.timeSetup ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString();
  }

  // For pending orders, also store OrderId separately if available
  // Use isPendingOrderType (defined earlier) for consistency
  const orderId = isPendingOrderType ? (pos.OrderId ?? pos.orderId ?? ticketId) : undefined;

  return {
    id,
    ticket: Number(ticketId) || 0,
    positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
    orderId: orderId ? Number(orderId) : undefined, // Store OrderId for pending orders
    symbol: pos.Symbol || pos.symbol || '',
    type: mappedType,
    orderType: typeof orderType === 'number' ? orderType : undefined,
    volume: volume,
    openPrice: openPrice,
    currentPrice: currentPrice,
    closePrice: isClosedTrade ? currentPrice : undefined, // For closed trades, closePrice is the currentPrice (close price)
    takeProfit: pos.PriceTP ?? pos.priceTP ?? pos.TakeProfit ?? pos.takeProfit ?? pos.TP ?? pos.tp ?? undefined,
    stopLoss: pos.PriceSL ?? pos.priceSL ?? pos.StopLoss ?? pos.stopLoss ?? pos.SL ?? pos.sl ?? undefined,
    openTime: openTime,
    closeTime: closeTime,
    swap: Number(pos.Swap || pos.swap || 0),
    profit: Number(pos.Profit || pos.profit || 0),
    commission: Number(pos.Commission || pos.commission || 0),
    comment: pos.Comment || pos.comment || undefined,
  };
};

// Format positions array
const formatPositions = (data: any, isClosedTrades: boolean = false): Position[] => {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.map((pos: any) => formatPosition(pos, isClosedTrades));
  }

  if (data && typeof data === 'object') {
    const nested = data.positions || data.Positions || data.Data || data.data || data.Result || data.Items || data.items || data.trades || data.Trades;
    if (Array.isArray(nested)) {
      return nested.map((pos: any) => formatPosition(pos, isClosedTrades));
    }

    if (nested && typeof nested === 'object') {
      const deeper = nested.Positions || nested.positions || nested.Items || nested.items || nested.trades || nested.Trades;
      if (Array.isArray(deeper)) {
        return deeper.map((pos: any) => formatPosition(pos, isClosedTrades));
      }
    }
  }

  return [];
};

/**
 * Hook to fetch positions using REST API polling
 * Polls the backend API every 200ms to get real-time position updates
 */
export function usePositions({ accountId, enabled = true, includeClosed = true }: UsePositionsProps): UsePositionsReturn {
  const [positions, setPositions] = useState<Position[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch positions from backend API
  const fetchPositions = useCallback(async () => {
    if (!accountId || !enabled) {
      setPositions([]);
      setPendingOrders([]);
      setClosedPositions([]);
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const url = `/api/positions/${accountId}${!includeClosed ? '?excludeClosed=true' : ''}`;
      const response = await apiClient.get<{
        success: boolean;
        positions?: any[];
        pendingOrders?: any[];
        closedPositions?: any[];
        data?: any[];
        message?: string;
        accountId?: number;
      }>(url);

      if (response.success) {
        const positionsArray = response.positions || response.data || [];
        const pendingArray = response.pendingOrders || [];

        const formattedPositions = formatPositions(positionsArray, false);
        const formattedPending = formatPositions(pendingArray, false);

        if (isMountedRef.current) {
          setPositions(formattedPositions);
          setPendingOrders(formattedPending);

          if (response.closedPositions !== undefined) {
            const formattedClosed = formatPositions(response.closedPositions, true);
            setClosedPositions(formattedClosed);
          }
        }
      } else {
        throw new Error(response.message || 'Failed to fetch positions');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }

      if (isMountedRef.current) {
        // CRITICAL: Handle 401 Unauthorized specifically
        if (err.status === 401) {
          console.warn('[usePositions] 401 Unauthorized - Clearing positions. This is expected if not logged in or token expired.');
          setPositions([]);
          setPendingOrders([]);
          setClosedPositions([]);
          setError(null); // Don't set a blocking error message for 401, as it's part of the expected auth flow
          return;
        }

        // If account not found, don't show a blocking error, just set error state
        setError(err.message || 'Failed to fetch positions');

        // If it's a specific "not found" error, we might want to clear positions
        if (err.message && err.message.includes('not found')) {
          setPositions([]);
          setPendingOrders([]);
          setClosedPositions([]);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [accountId, enabled]);

  // Refetch function
  const refetch = useCallback(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Fetch only closed positions
  const refetchClosed = useCallback(async () => {
    if (!accountId) return;

    try {
      const response = await apiClient.get<{
        success: boolean;
        closedPositions?: any[];
        message?: string;
      }>(`/api/positions/${accountId}/closed`);

      if (response.success && response.closedPositions) {
        const formattedClosed = formatPositions(response.closedPositions, true);
        if (isMountedRef.current) {
          setClosedPositions(formattedClosed);
        }
      }
    } catch (err: any) {
      console.error('Failed to refetch closed positions:', err);
    }
  }, [accountId]);

  // Setup polling
  useEffect(() => {
    isMountedRef.current = true;

    if (!accountId || !enabled) {
      setPositions([]);
      setPendingOrders([]);
      setClosedPositions([]);
      return;
    }

    // Initial fetch
    fetchPositions();

    // Setup polling interval
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current && accountId && enabled) {
        fetchPositions();
      }
    }, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [accountId, enabled, fetchPositions]);

  return {
    positions,
    pendingOrders,
    closedPositions,
    isLoading,
    error,
    refetch,
    refetchClosed,
  };
}
