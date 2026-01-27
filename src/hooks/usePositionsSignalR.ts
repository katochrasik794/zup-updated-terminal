"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

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

interface UsePositionsSignalRProps {
  accountId: string | null;
  accessToken: string | null;
  enabled?: boolean;
}

interface UsePositionsSignalRReturn {
  positions: Position[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

// Use actual hub URL - custom HTTP client will proxy negotiate requests
const HUB_URL = 'https://metaapi.zuperior.com/hubs/mobiletrading';
const UPDATE_INTERVAL = 200; // 200ms for enrichment API calls

// Format single position
const formatPosition = (pos: any): Position => {
  const generateStableId = () => {
    const s = pos.Symbol || pos.symbol || 'unknown';
    const t = (pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' : 'Sell';
    const time = pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || '0';
    const price = pos.OpenPrice || pos.openPrice || pos.PriceOpen || pos.priceOpen || '0';
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

  return {
    id,
    ticket: Number(pos.Ticket ?? pos.ticket ?? pos.PositionId ?? pos.PositionID ?? 0) || 0,
    positionId: Number(pos.PositionId ?? pos.PositionID ?? 0) || undefined,
    symbol: pos.Symbol || pos.symbol || '',
    type: (pos.Type === 0 || pos.type === 0 || pos.Type === 'Buy' || pos.type === 'Buy') ? 'Buy' as const : 'Sell' as const,
    volume: Number(pos.Volume || pos.volume || 0),
    openPrice: Number(pos.OpenPrice || pos.openPrice || pos.PriceOpen || pos.priceOpen || 0),
    currentPrice: Number(pos.PriceCurrent ?? pos.priceCurrent ?? pos.CurrentPrice ?? pos.currentPrice ?? 0),
    takeProfit: pos.TakeProfit || pos.takeProfit || pos.TP || pos.tp || undefined,
    stopLoss: pos.StopLoss || pos.stopLoss || pos.SL || pos.sl || undefined,
    openTime: pos.TimeSetup || pos.timeSetup || pos.OpenTime || pos.openTime || new Date().toISOString(),
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
    const nested = data.Positions || data.positions || data.Data || data.data || data.Result || data.Items || data.items;
    if (Array.isArray(nested)) {
      return nested.map((pos: any) => formatPosition(pos));
    }
    
    if (nested && typeof nested === 'object') {
      const deeper = nested.Positions || nested.positions || nested.Items || nested.items;
      if (Array.isArray(deeper)) {
        return deeper.map((pos: any) => formatPosition(pos));
      }
    }
    
    return [formatPosition(data)];
  }
  
  return [];
};

// Enrich positions with TP/SL from REST API
const enrichPositions = async (positions: Position[], accountId: string, accessToken: string): Promise<Position[]> => {
  if (positions.length === 0) return positions;

  try {
    const response = await fetch(`https://metaapi.zuperior.com/api/client/Positions?accountId=${accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const enriched = formatPositions(data);
      
      // Merge enriched data with existing positions
      const enrichedMap = new Map(enriched.map(p => [p.ticket, p]));
      
      return positions.map(pos => {
        const enrichedPos = enrichedMap.get(pos.ticket);
        if (enrichedPos) {
          return {
            ...pos,
            takeProfit: enrichedPos.takeProfit || pos.takeProfit,
            stopLoss: enrichedPos.stopLoss || pos.stopLoss,
          };
        }
        return pos;
      });
    }
  } catch (err) {

  }

  return positions;
};

export function usePositionsSignalR({
  accountId,
  accessToken,
  enabled = true
}: UsePositionsSignalRProps): UsePositionsSignalRReturn {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const enrichmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Connect to SignalR hub
  const connect = useCallback(async () => {
    if (!accountId || !accessToken || !enabled) {
      return;
    }

    // Disconnect existing connection
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
      } catch {}
      connectionRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const qp = new URLSearchParams({
        accountId: accountId,
        clientVersion: '1.0.0',
        clientPlatform: 'Web',
        deviceId: `web_${accountId}`,
      }).toString();
      // Build hub URL with query params - use actual MetaAPI URL
      const hubUrl = `${HUB_URL}?${qp}`;

      // Custom HTTP client that proxies negotiate requests
      class ProxyHttpClient extends signalR.HttpClient {
        async send(request: signalR.HttpRequest): Promise<signalR.HttpResponse> {
          const url = request.url || '';
          const method = request.method || 'GET';
          
          // Intercept negotiate requests and route through our proxy
          if (url.includes('/negotiate')) {
            const urlObj = new URL(url);
            // Build proxy URL with all query params plus accountId if available
            const proxyParams = new URLSearchParams(urlObj.searchParams);
            proxyParams.set('hub', 'mobiletrading');
            if (accountId) {
              proxyParams.set('accountId', accountId);
            }
            // Always use GET for proxy request (as per zuperior-terminal implementation)
            const proxyUrl = `${window.location.origin}/apis/signalr/negotiate?${proxyParams.toString()}`;
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(request.headers || {}),
            };
            
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }
            
            if (accountId) {
              headers['x-account-id'] = accountId;
            }

            const response = await fetch(proxyUrl, {
              method: 'GET', // Always use GET for proxy (original method might be POST)
              headers: headers,
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => '');
              throw new Error(`Negotiate failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return new signalR.HttpResponse(
              response.status,
              response.statusText,
              JSON.stringify(data)
            );
          }
          
          // For non-negotiate requests, use fetch directly
          const response = await fetch(url, {
            method: method,
            headers: request.headers || {},
            body: request.content || undefined,
          });

          const responseText = await response.text();
          return new signalR.HttpResponse(
            response.status,
            response.statusText,
            responseText
          );
        }
      }

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => accessToken,
          httpClient: new ProxyHttpClient(),
          transport: signalR.HttpTransportType.WebSockets,
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < 3) return 2000;
            return 5000;
          }
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      // Handle position updates
      connection.on('PositionUpdate', (data: any) => {
        if (!isMountedRef.current) return;
        const formatted = formatPositions(data);
        setPositions(prev => {
          const merged = [...prev];
          formatted.forEach(newPos => {
            const index = merged.findIndex(p => p.ticket === newPos.ticket || p.id === newPos.id);
            if (index >= 0) {
              merged[index] = newPos;
            } else {
              merged.push(newPos);
            }
          });
          return merged;
        });
      });

      connection.on('positions', (data: any) => {
        if (!isMountedRef.current) return;
        const formatted = formatPositions(data);
        setPositions(formatted);
      });

      connection.on('Positions', (data: any) => {
        if (!isMountedRef.current) return;
        const formatted = formatPositions(data);
        setPositions(formatted);
      });

      connection.on('PositionsUpdate', (data: any) => {
        if (!isMountedRef.current) return;
        const formatted = formatPositions(data);
        setPositions(formatted);
      });

      // Handle connection events
      connection.onclose(() => {
        if (isMountedRef.current) {
          setIsConnected(false);
        }
      });

      await connection.start();
      
      connectionRef.current = connection;
      setIsConnected(true);
      setIsConnecting(false);

      // Subscribe to positions
      try {
        await connection.invoke('SubscribeToPositions');
      } catch {
        try {
          await connection.invoke('SubscribePositions');
        } catch {
          // Ignore subscription errors
        }
      }

      // Initial fetch
      try {
        const result = await connection.invoke('GetPositions');
        if (result) {
          const formatted = formatPositions(result);
          setPositions(formatted);
        }
      } catch {
        // Try alternative methods
        try {
          const result = await connection.invoke('GetOpenPositions');
          if (result) {
            const formatted = formatPositions(result);
            setPositions(formatted);
          }
        } catch {
          // Ignore
        }
      }

      // Setup enrichment polling
      if (enrichmentIntervalRef.current) {
        clearInterval(enrichmentIntervalRef.current);
      }

      const enrichmentHandler = async () => {
        if (!isMountedRef.current || !accountId || !accessToken) return;
        
        setPositions(current => {
          if (current.length > 0) {
            enrichPositions(current, accountId, accessToken).then(enriched => {
              if (isMountedRef.current) {
                setPositions(enriched);
              }
            }).catch(err => {

            });
          }
          return current;
        });
      };

      enrichmentIntervalRef.current = setInterval(enrichmentHandler, UPDATE_INTERVAL);

    } catch (err: any) {

      setError(err.message || 'Failed to connect');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [accountId, accessToken, enabled]);

  // Reconnect function
  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  // Setup connection
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (enrichmentIntervalRef.current) {
        clearInterval(enrichmentIntervalRef.current);
      }
      if (connectionRef.current) {
        connectionRef.current.stop().catch(() => {});
        connectionRef.current = null;
      }
    };
  }, [connect]);

  return {
    positions,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}
