"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

export interface Position {
  id: string;
  ticket: number;
  positionId?: number;
  symbol: string;
  type: 'Buy' | 'Sell' | 'Buy Limit' | 'Sell Limit' | 'Buy Stop' | 'Sell Stop' | 'Hedged';
  volume: number;
  openPrice: number;
  currentPrice: number;
  closePrice?: number; // Close price for closed trades
  takeProfit?: number;
  stopLoss?: number;
  openTime: string;
  swap: number;
  profit: number;
  commission: number;
  comment?: string;
  orderType?: number; // Store the original Type value for pending orders
}

interface UsePositionsProps {
  accountId: string | null;
  enabled?: boolean;
}

interface UsePositionsReturn {
  positions: Position[];
  pendingOrders: Position[];
  closedPositions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = 200; // 200ms polling interval

// Format single position from API response
const formatPosition = (pos: any, isClosedTrade: boolean = false): Position => {
  const generateStableId = () => {
    const s = pos.Symbol || pos.symbol || 'unknown';
    const action = pos.Action || pos.action;
    const t = (action === 0 || action === 'Buy' || pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' : 'Sell';
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

  // For closed trades from tradehistory, use OrderId or DealId as ticket
  const ticketId = isClosedTrade 
    ? (pos.OrderId ?? pos.orderId ?? pos.DealId ?? pos.dealId ?? pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? generateStableId())
    : (pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? generateStableId());
  const id = String(ticketId);

  // Get Type field for order type mapping (for pending orders)
  const orderType = pos.Type ?? pos.type ?? pos.OrderType ?? pos.orderType;
  
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
        const isBuy = action === 0 || action === 'Buy' || orderType === 0 || orderType === 'Buy';
        mappedType = isBuy ? 'Buy' : 'Sell';
    }
  } else {
    // Fallback to Action-based logic for open positions
    const action = pos.Action ?? pos.action;
    const isBuy = action === 0 || action === 'Buy' || orderType === 0 || orderType === 'Buy';
    mappedType = isBuy ? 'Buy' : 'Sell';
  }

  // For closed trades, handle volume differently (VolumeLots or Volume)
  let volume = 0;
  if (isClosedTrade) {
    // TradeHistory API uses VolumeLots (in lots) or Volume
    const volumeLots = pos.VolumeLots ?? pos.volumeLots;
    const rawVolume = pos.Volume ?? pos.volume ?? 0;
    
    // Log volume fields for debugging
    if (pos.OrderId || pos.orderId || pos.DealId || pos.dealId) {
      console.log(`[formatPosition] Closed trade volume fields:`, {
        OrderId: pos.OrderId ?? pos.orderId,
        DealId: pos.DealId ?? pos.dealId,
        Symbol: pos.Symbol ?? pos.symbol,
        VolumeLots: volumeLots,
        Volume: rawVolume,
        allKeys: Object.keys(pos).filter(k => k.toLowerCase().includes('volume'))
      });
    }
    
    if (volumeLots !== undefined && volumeLots !== null) {
      volume = Number(volumeLots);
      console.log(`[formatPosition] Using VolumeLots: ${volumeLots} -> ${volume}`);
    } else if (rawVolume !== undefined && rawVolume !== null) {
      const numVolume = Number(rawVolume);
      console.log(`[formatPosition] Using Volume: ${rawVolume} (raw) -> ${numVolume} (parsed)`);
      // If volume < 1, multiply by 1000; if >= 100, divide by 100
      if (numVolume > 0 && numVolume < 1) {
        volume = numVolume * 1000;
        console.log(`[formatPosition] Volume < 1, multiplied by 1000: ${volume}`);
      } else if (numVolume >= 100) {
        volume = numVolume / 100;
        console.log(`[formatPosition] Volume >= 100, divided by 100: ${volume}`);
      } else {
        volume = numVolume;
        console.log(`[formatPosition] Volume used as-is: ${volume}`);
      }
    } else {
      console.warn(`[formatPosition] No volume found for closed trade:`, {
        OrderId: pos.OrderId ?? pos.orderId,
        DealId: pos.DealId ?? pos.dealId,
        Symbol: pos.Symbol ?? pos.symbol,
        allKeys: Object.keys(pos)
      });
    }
  } else {
    volume = Number(pos.Volume || pos.volume || 0);
  }

  // Check if this is a pending order (Type 2-5: Buy Limit, Sell Limit, Buy Stop, Sell Stop)
  const isPendingOrder = typeof orderType === 'number' && orderType >= 2 && orderType <= 5;
  
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
  if (isClosedTrade) {
    openTime = pos.CloseTime ?? pos.closeTime ?? pos.OpenTradeTime ?? pos.openTradeTime ?? new Date().toISOString();
  } else if (isPendingOrder) {
    // For pending orders, TimeSetup is the primary source
    openTime = pos.TimeSetup ?? pos.timeSetup ?? pos.TimeCreate ?? pos.timeCreate ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString();
    // Log to verify TimeSetup is being used
    if (pos.TimeSetup || pos.timeSetup) {
      console.log(`[formatPosition] Pending order using TimeSetup:`, {
        OrderId: pos.OrderId ?? pos.orderId,
        Symbol: pos.Symbol ?? pos.symbol,
        TimeSetup: pos.TimeSetup ?? pos.timeSetup,
        formattedOpenTime: openTime
      });
    }
  } else {
    openTime = pos.TimeCreate ?? pos.timeCreate ?? pos.TimeSetup ?? pos.timeSetup ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString();
  }

  return {
    id,
    ticket: Number(ticketId) || 0,
    positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
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
export function usePositions({ accountId, enabled = true }: UsePositionsProps): UsePositionsReturn {
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

      const response = await apiClient.get<{
        success: boolean;
        positions?: any[];
        pendingOrders?: any[];
        closedPositions?: any[];
        data?: any[];
        message?: string;
        accountId?: number;
      }>(`/api/positions/${accountId}`);

      if (response.success) {
        // Backend returns: { success: true, positions: [...], pendingOrders: [...], closedPositions: [...] }
        // apiClient.get returns the response directly
        const positionsArray = response.positions || response.data || [];
        const pendingArray = response.pendingOrders || [];
        const closedArray = response.closedPositions || [];
        
        const formattedPositions = formatPositions(positionsArray, false);
        const formattedPending = formatPositions(pendingArray, false);
        const formattedClosed = formatPositions(closedArray, true); // Mark as closed trades for proper formatting
        
        if (isMountedRef.current) {
          setPositions(formattedPositions);
          setPendingOrders(formattedPending);
          setClosedPositions(formattedClosed);
        }
      } else {
        throw new Error(response.message || 'Failed to fetch positions');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      console.error('[usePositions] Error fetching positions:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch positions');
        // Don't clear positions on error, keep last known state
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
  };
}
