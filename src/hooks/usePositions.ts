"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

export interface Position {
  id: string;
  ticket: number;
  positionId?: number;
  symbol: string;
  type: 'Buy' | 'Sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  openTime: string;
  swap: number;
  profit: number;
  commission: number;
  comment?: string;
}

interface UsePositionsProps {
  accountId: string | null;
  enabled?: boolean;
}

interface UsePositionsReturn {
  positions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = 200; // 200ms polling interval

// Format single position from API response
const formatPosition = (pos: any): Position => {
  const generateStableId = () => {
    const s = pos.Symbol || pos.symbol || 'unknown';
    const action = pos.Action || pos.action;
    const t = (action === 0 || action === 'Buy' || pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' : 'Sell';
    const time = pos.TimeCreate || pos.timeCreate || pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || '0';
    const price = pos.PriceOpen || pos.priceOpen || pos.OpenPrice || pos.openPrice || '0';
    const str = `${s}-${t}-${time}-${price}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `generated-${Math.abs(hash)}`;
  };

  const id = (pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? pos.Id ?? pos.id ?? generateStableId()).toString();

  // Action: 0 = Buy, 1 = Sell (MT5 convention)
  const action = pos.Action ?? pos.action;
  const isBuy = action === 0 || action === 'Buy' || pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy';

  return {
    id,
    ticket: Number(pos.PositionId ?? pos.PositionID ?? pos.Ticket ?? pos.ticket ?? 0) || 0,
    positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
    symbol: pos.Symbol || pos.symbol || '',
    type: isBuy ? 'Buy' as const : 'Sell' as const,
    volume: Number(pos.Volume || pos.volume || 0),
    openPrice: Number(pos.PriceOpen ?? pos.priceOpen ?? pos.OpenPrice ?? pos.openPrice ?? 0),
    currentPrice: Number(pos.PriceCurrent ?? pos.priceCurrent ?? pos.CurrentPrice ?? pos.currentPrice ?? 0),
    takeProfit: pos.PriceTP ?? pos.priceTP ?? pos.TakeProfit ?? pos.takeProfit ?? pos.TP ?? pos.tp ?? undefined,
    stopLoss: pos.PriceSL ?? pos.priceSL ?? pos.StopLoss ?? pos.stopLoss ?? pos.SL ?? pos.sl ?? undefined,
    openTime: pos.TimeCreate ?? pos.timeCreate ?? pos.TimeSetup ?? pos.timeSetup ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString(),
    swap: Number(pos.Swap || pos.swap || 0),
    profit: Number(pos.Profit || pos.profit || 0),
    commission: Number(pos.Commission || pos.commission || 0),
    comment: pos.Comment || pos.comment || undefined,
  };
};

// Format positions array
const formatPositions = (data: any): Position[] => {
  if (!data) return [];
  
  if (Array.isArray(data)) {
    return data.map((pos: any) => formatPosition(pos));
  }
  
  if (data && typeof data === 'object') {
    const nested = data.positions || data.Positions || data.Data || data.data || data.Result || data.Items || data.items;
    if (Array.isArray(nested)) {
      return nested.map((pos: any) => formatPosition(pos));
    }
    
    if (nested && typeof nested === 'object') {
      const deeper = nested.Positions || nested.positions || nested.Items || nested.items;
      if (Array.isArray(deeper)) {
        return deeper.map((pos: any) => formatPosition(pos));
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch positions from backend API
  const fetchPositions = useCallback(async () => {
    if (!accountId || !enabled) {
      setPositions([]);
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
        data?: any[];
        message?: string;
        accountId?: number;
      }>(`/api/positions/${accountId}`);

      if (response.success) {
        // Backend returns: { success: true, positions: [...], data: [...] }
        // apiClient.get returns the response directly
        const positionsArray = response.positions || response.data || [];
        const formatted = formatPositions(positionsArray);
        
        if (isMountedRef.current) {
          setPositions(formatted);
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
    isLoading,
    error,
    refetch,
  };
}
