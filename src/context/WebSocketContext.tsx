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
    // Remove period and anything after? "BTCUSD.e" -> "BTCUSD"
    let s = symbol.split('.')[0];
    // Remove trailing lowercase "m", "e" if attached directly? "BTCUSDm"
    // Regex: Replace any suffix that is not uppercase/digit?
    // Assuming standard symbols are uppercase.
    s = s.replace(/[^A-Z0-9]+$/, ''); // Remove trailing non-uppercase/non-numbers if mixed?
    // Wait, usually modifiers are lowercase?
    // Let's try: take the first 6 characters if standard forex? No, simple regex: `^([A-Z0-9]+)`?
    // Use a regex that captures the main uppercase part.
    // "BTCUSDm" -> match /^[A-Z0-9]+/ -> "BTCUSD"
    const match = s.match(/^([A-Z0-9]+)/);
    if (match) return match[1];
    return s;
};

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastQuotes, setLastQuotes] = useState<Record<string, QuoteData>>({});

    // Refs for socket management
    const wsRef = useRef<WebSocket | null>(null);
    const activeSubscriptions = useRef<Set<string>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current) return;

        const url = 'wss://metaapi.zuperior.com/ws';
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => {
            console.log('[WebSocket] Connected');
            setIsConnected(true);

            // Resubscribe to anything we were listening to
            if (activeSubscriptions.current.size > 0) {
                const symbols = Array.from(activeSubscriptions.current);
                sendSubscription(socket, symbols);
            }
        };

        socket.onclose = () => {
            console.log('[WebSocket] Disconnected');
            setIsConnected(false);
            wsRef.current = null;

            // Attempt reconnect
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('[WebSocket] Attempting reconnect...');
                connect();
            }, 3000); // 3s delay
        };

        socket.onerror = (err) => {
            // WebSocket errors are often non-critical (connection issues, network problems)
            // The WebSocket is used for real-time price updates, but order placement uses REST APIs
            // Only log once to avoid console spam
            if (wsRef.current?.readyState !== WebSocket.CLOSED && !wsRef.current?.hasErrorLogged) {
                console.warn('[WebSocket] Connection error (non-critical - order placement will still work via REST APIs)');
                if (wsRef.current) {
                    (wsRef.current as any).hasErrorLogged = true;
                }
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'watch') {
                    // Update quote cache
                    // Store by NORMALIZED symbol so "BTCUSD" updates apply to "BTCUSD.e" lookups
                    const norm = normalizeSymbol(data.symbol);
                    setLastQuotes(prev => ({
                        ...prev,
                        [norm]: data as QuoteData
                    }));
                }
            } catch (e) {
                console.error('[WebSocket] Message Parse Error:', e);
            }
        };

    }, []);

    const sendSubscription = (socket: WebSocket, symbols: string[]) => {
        if (socket.readyState === WebSocket.OPEN && symbols.length > 0) {
            // Normalize before sending if the server expects base symbols
            // or send both? User said "catch symbol like btcusd".
            // I'll assume sending the BASE symbol is correct for the socket.
            const normalized = Array.from(new Set(symbols.map(normalizeSymbol)));

            const payload = {
                type: "sub_symbols",
                symbols: normalized,
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
        };
    }, [connect]);

    const subscribe = useCallback((symbols: string[]) => {
        if (!wsRef.current) return;

        // Add to active set (stores raw or normalized? Let's store raw to track what UI wants, but normalize on send)
        // Actually, if we store raw, redundancy isn't handled.
        // Let's store normalized in activeSubscriptions to avoid duplicate "BTCUSD" and "BTCUSD.e" subs.

        const newSymbols: string[] = [];
        symbols.forEach(s => {
            const n = normalizeSymbol(s);
            if (!activeSubscriptions.current.has(n)) {
                activeSubscriptions.current.add(n);
                newSymbols.push(n);
            }
        });

        if (newSymbols.length === 0) return;

        sendSubscription(wsRef.current, newSymbols);
    }, []);

    const unsubscribe = useCallback((symbols: string[]) => {
        symbols.map(normalizeSymbol).forEach(s => activeSubscriptions.current.delete(s));
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, lastQuotes, subscribe, unsubscribe, normalizeSymbol }}>
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
