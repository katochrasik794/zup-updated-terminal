import { useEffect, useRef, useCallback } from 'react';

const BASE_SIGNALR_URL = process.env.NEXT_PUBLIC_SIGNALR_URL || 'wss://metaapi.zuperior.com/hubs/account';
const RECORD_SEPARATOR = String.fromCharCode(0x1e);

const getWsUrl = (baseUrl: string) => {
    let url = baseUrl.replace(/^http/, 'ws');
    url = url.replace(/\/+$/, '');

    const hasHub = url.includes('/hubs/') || url.includes('/account') || url.endsWith('/ws');
    if (!hasHub) {
        url = `${url}/account`;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}transport=webSockets&negotiateVersion=1`;
};

export interface AccountUpdate {
    accountId: string;
    balance: number;
    equity: number;
    marginUsed: number;
    freeMargin: number;
    marginLevel: number;
    currency: string;
}

interface UseMT5WebSocketOptions {
    accountIds: string[];
    onAccountUpdate?: (update: AccountUpdate) => void;
    enabled?: boolean;
}

export const useMT5WebSocket = ({ accountIds, onAccountUpdate, enabled = true }: UseMT5WebSocketOptions) => {
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isConnectingRef = useRef(false);

    const getFinalUrl = useCallback(() => {
        const envUrl = process.env.NEXT_PUBLIC_SIGNALR_URL || 'wss://metaapi.zuperior.com/hubs/account';
        return getWsUrl(envUrl);
    }, []);

    const subscribe = useCallback(() => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || accountIds.length === 0) return;

        // console.log('[MT5 WebSocket] 📤 Subscribing to accounts:', accountIds);
        const idsAsNumbers = accountIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        const msg = JSON.stringify({
            type: 1,
            target: 'SubscribeToAccounts',
            arguments: [idsAsNumbers],
        }) + RECORD_SEPARATOR;

        socketRef.current?.send(msg);
    }, [accountIds]);

    const connect = useCallback(() => {
        if (!enabled) return;
        if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING || isConnectingRef.current) return;

        const finalUrl = getFinalUrl();
        // console.log('[MT5 WebSocket] 📡 Attempting connection to:', finalUrl);

        isConnectingRef.current = true;

        try {
            const socket = new WebSocket(finalUrl);
            socketRef.current = socket;

            socket.onopen = () => {
                // console.log('[MT5 WebSocket] ✅ WebSocket Connected');
                isConnectingRef.current = false;

                // SignalR Handshake
                const handshake = JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR;
                // console.log('[MT5 WebSocket] 🤝 Sending Handshake...');
                socket.send(handshake);
            };

            socket.onmessage = (event) => {
                const rawData = event.data as string;
                const messages = rawData.split(RECORD_SEPARATOR).filter(Boolean);

                messages.forEach((msg) => {
                    try {
                        const data = JSON.parse(msg);

                        // SignalR Handshake response
                        if (msg === '{}' || (typeof data === 'object' && Object.keys(data).length === 0)) {
                            // console.log('[MT5 WebSocket] 🤝 Handshake complete');
                            subscribe();
                            return;
                        }

                        // Type 1 is Invocation
                        if (data.type === 1) {
                            if (data.target === 'AccountUpdate') {
                                const rawUpdate = data.arguments[0] as any;
                                // console.log('[MT5 WebSocket] 📥 AccountUpdate received:', rawUpdate);

                                // Normalize fields (handle PascalCase vs camelCase and mappings)
                                const update: AccountUpdate = {
                                    accountId: String(rawUpdate.accountId ?? rawUpdate.AccountId ?? rawUpdate.Login ?? rawUpdate.login),
                                    balance: Number(rawUpdate.balance ?? rawUpdate.Balance ?? 0),
                                    equity: Number(rawUpdate.equity ?? rawUpdate.Equity ?? 0),
                                    marginUsed: Number(rawUpdate.marginUsed ?? rawUpdate.Margin ?? rawUpdate.margin ?? 0),
                                    freeMargin: Number(rawUpdate.freeMargin ?? rawUpdate.MarginFree ?? rawUpdate.Margin_Free ?? rawUpdate.free_margin ?? 0),
                                    marginLevel: Number(rawUpdate.marginLevel ?? rawUpdate.MarginLevel ?? rawUpdate.Margin_Level ?? rawUpdate.margin_level ?? 0),
                                    currency: rawUpdate.currency ?? rawUpdate.Currency ?? 'USD'
                                };

                                if (onAccountUpdate) {
                                    onAccountUpdate(update);
                                }
                            }
                        }

                        // Reply to Ping (type 6)
                        if (data.type === 6) {
                            socket.send(JSON.stringify({ type: 6 }) + RECORD_SEPARATOR);
                        }
                    } catch (e) {
                        console.error('[MT5 WebSocket] ❌ Error parsing message:', e, msg);
                    }
                });
            };

            socket.onclose = (event) => {
                isConnectingRef.current = false;
                // console.log(`[MT5 WebSocket] 🛑 Connection closed. Code: ${event.code}`);

                // Attempt reconnection with delay
                if (enabled && !reconnectTimeoutRef.current) {
                    const delay = 5000;
                    // console.log(`[MT5 WebSocket] 🔄 Reconnecting in ${delay / 1000}s...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectTimeoutRef.current = null;
                        connect();
                    }, delay);
                }
            };

            socket.onerror = (error) => {
                if (socket.readyState === WebSocket.CONNECTING) {
                    console.warn('[MT5 WebSocket] 💡 Connection failed. Check URL and network.');
                }
            };
        } catch (err) {
            console.error('[MT5 WebSocket] 🌋 Exception during connection:', err);
            isConnectingRef.current = false;
        }
    }, [getFinalUrl, subscribe, onAccountUpdate, enabled]);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [connect, enabled]);

    // Handle account ID changes
    useEffect(() => {
        if (enabled && socketRef.current?.readyState === WebSocket.OPEN) {
            subscribe();
        }
    }, [accountIds, subscribe, enabled]);

    return {
        isConnected: socketRef.current?.readyState === WebSocket.OPEN,
        subscribe
    };
};
