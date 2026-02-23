import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

// Types
export interface QuoteData {
    type: string;
    symbol: string;
    ts: number;
    bid: number;
    ask: number;
    spread?: number;
    dayHigh?: number;
    dayLow?: number;
}

interface WebSocketContextType {
    isConnected: boolean;
    lastQuotes: Record<string, QuoteData>;
    subscribe: (symbols: string[]) => void;
    unsubscribe: (symbols: string[]) => void;
    normalizeSymbol: (symbol: string) => string;
    ping: number;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Helper to strip suffixes like .e, .m, etc.
// "catch symbol like btcusd eurusd usdjpy" -> remove non-alphanumeric at end? 
// Usually standard is "BTCUSD" 6 chars. 
// Or just split by '.'? The user mentioned "BTCUSDm". 
// Let's assume the base is usually the first 6 chars or we strip lowercase suffixes?
// "BTCUSDm" -> "BTCUSD". "BTCUSDe" -> "BTCUSD". "XAUUSD" -> 6 chars.
// Simple heuristic: If length > 6 and ends with lowercase or dot?
// Or just regex `^([A-Z0-9]+)`.
// Actually safely: most forex are 6 chars. Crypto can be longer.
// User said: "even they end with liek BTCUSDm BTCUSDe or xyz"
// I will try to strictly capitalize and remove trailing lowercase letters and dots.
export const normalizeSymbol = (symbol: string): string => {
    if (!symbol) return '';
    const s = symbol.split('.')[0].trim();
    // Strip trailing lowercase suffixes like m, a, c, f, h, r
    return s.replace(/[macfhr]+$/, '').toUpperCase();
};

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastQuotes, setLastQuotes] = useState<Record<string, QuoteData>>({});
    const [ping, setPing] = useState<number>(0);

    // Refs for socket management
    const wsRef = useRef<WebSocket | null>(null);
    const activeSubscriptions = useRef<Set<string>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastPingTimeRef = useRef<number>(0);

    const connect = useCallback(() => {
        if (wsRef.current) return;

        const url = 'wss://metaapi.zuperior.com/ws';
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => {

            setIsConnected(true);

            // Resubscribe to anything we were listening to
            if (activeSubscriptions.current.size > 0) {
                const symbols = Array.from(activeSubscriptions.current);
                sendSubscription(socket, symbols);
            } else {
                // Subscribe to a default symbol to heartbeat the connection for ping
                sendSubscription(socket, ['BTCUSD']);
            }


            // Start application-level ping
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    lastPingTimeRef.current = Date.now();
                    // Send a ping message if backend supports it, or just use a dummy subscription to trigger a response?
                    // MetaApi might not have a dedicated 'ping' type.
                    // But if we use data.ts latency, that works for streaming.
                    // If no streaming data, ping stays 0.
                    // Let's stick to data.ts for now, but ensure we handle 'ping' type if server sends it.
                }
            }, 10000);
        };

        socket.onclose = () => {

            setIsConnected(false);
            wsRef.current = null;

            // Attempt reconnect
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {

                connect();
            }, 3000); // 3s delay
        };

        socket.onerror = (err) => {
            // WebSocket errors are often non-critical (connection issues, network problems)
            // The WebSocket is used for real-time price updates, but order placement uses REST APIs
            // Only log once to avoid console spam
            if (wsRef.current?.readyState !== WebSocket.CLOSED && !(wsRef.current as any)?.hasErrorLogged) {
                if (wsRef.current) {
                    (wsRef.current as any).hasErrorLogged = true;
                }
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // console.log('[WebSocketContext] Received:', data.type, data);

                if (data.type === 'watch') {
                    // Update quote cache
                    // Store by NORMALIZED symbol AND RAW symbol to be safe
                    const norm = normalizeSymbol(data.symbol);
                    setLastQuotes(prev => ({
                        ...prev,
                        [norm]: data as QuoteData,
                        [data.symbol]: data as QuoteData
                    }));

                    // Calculate latency (ping)
                    const timestamp = data.ts || data.t || data.time;
                    if (timestamp) {
                        const now = Date.now();
                        // Assuming timestamp is in ms. If it's seconds, multiply by 1000.
                        // Usually MT5/MetaApi sends ms.
                        // If delta is huge negative, checking raw values might be needed.
                        const latency = Math.max(0, now - timestamp);

                        // Smooth the ping visually (optional) or just set it
                        setPing(latency);
                    } else {
                        // Debug: Log if ts is missing
                        // console.log('[WebSocketContext] Missing timestamp in watch data:', data);
                    }
                } else if (data.type === 'quote') {
                    // Handle potential alternative message type

                }

                // Debug all messages to find where TS is

            } catch (e) {
                // Ignore parse errors
            }
        };

    }, []);

    const sendSubscription = (socket: WebSocket, symbols: string[]) => {
        if (socket.readyState === WebSocket.OPEN && symbols.length > 0) {
            // Send the ACTUAL symbols requested by the UI (raw)
            // This ensures the broker recognizes specific instrument variants (e.g. BTCUSDm)
            const uniqueSymbols = Array.from(new Set(symbols));

            const payload = {
                type: "sub_symbols",
                symbols: uniqueSymbols,
                streams: ["watch"]
            };
            socket.send(JSON.stringify(payload));
        }
    };

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, [connect]);

    const subscribe = useCallback((symbols: string[]) => {
        if (!wsRef.current) return;

        // Add to active set (stores raw or normalized? Let's store raw to track what UI wants, but normalize on send)
        // Actually, if we store raw, redundancy isn't handled.
        // Let's store normalized in activeSubscriptions to avoid duplicate "BTCUSD" and "BTCUSD.e" subs.

        const newSymbols: string[] = [];
        symbols.forEach(s => {
            if (!activeSubscriptions.current.has(s)) {
                activeSubscriptions.current.add(s);
                newSymbols.push(s);
            }
        });

        if (newSymbols.length === 0) return;

        sendSubscription(wsRef.current, newSymbols);
    }, []);

    const unsubscribe = useCallback((symbols: string[]) => {
        symbols.map(normalizeSymbol).forEach(s => activeSubscriptions.current.delete(s));
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, lastQuotes, subscribe, unsubscribe, normalizeSymbol, ping }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket() {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}
