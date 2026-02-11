
import {
    LibrarySymbolInfo,
    ResolutionString,
    HistoryCallback,
    SubscribeBarsCallback,
    PeriodParams,
    SearchSymbolsCallback
} from '../../../public/charting_library/datafeed-api';

interface CandleUpdate {
    type: 'candle_update';
    symbol: string;
    tf: string;
    t: number; // timestamp
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    isFinal: boolean;
}

interface CandleHistoryResponse {
    type: 'candle_snapshot';
    symbol: string;
    tf: string;
    ts: number;
    candles: {
        t: number;
        o: number;
        h: number;
        l: number;
        c: number;
        v: number;
        isFinal: number;
    }[];
}

interface SubSymbolsRequest {
    type: 'sub_symbols';
    symbols: string[];
    streams: ['candle_live'];
}

interface CandleHistoryRequest {
    type: 'candle_history';
    symbol: string;
    tf: string;
    count: number;
}

// Helper to map resolution string to API timeframe string
// 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M => API: M1, M5, M15, M30, H1, H4, D1, W1, Mn1
const resolutionToTimeframe = (resolution: string): string => {
    if (resolution === '1') return 'M1';
    if (resolution === '5') return 'M5';
    if (resolution === '15') return 'M15';
    // if (resolution === '30') return 'M30';
    if (resolution === '60') return 'H1';
    if (resolution === '240') return 'H4';
    if (resolution === 'D' || resolution === '1D') return 'D1';
    if (resolution === 'W' || resolution === '1W') return 'W1';
    if (resolution === 'M' || resolution === '1M') return 'Mn1';
    // Fallback
    return resolution;
};

// Normalizes symbols by stripping lowercase suffixes (e.g., BTCUSDm -> BTCUSD)
const normalizeSymbol = (symbol: string): string => {
    if (!symbol) return '';
    const s = symbol.split('.')[0].trim();
    // Strip trailing suffixes like m, a, c, f, h, r (case-insensitive)
    return s.replace(/[macfhrMACFHR]+$/, '').toUpperCase();
};

class WebSocketManager {
    private url: string;
    private ws: WebSocket | null = null;
    private reconnectTimeout: any = null;
    private subscribers: Set<{ symbol: string; tf: string; callback: SubscribeBarsCallback; lastBarTime: number }> = new Set();
    private historyCallbacks: Map<string, { onSuccess: HistoryCallback; onError: (error: string) => void }> = new Map();
    private requestQueue: (() => void)[] = [];

    constructor(url: string) {
        this.url = url;
        this.connect();
    }

    private connect() {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.resubscribe();
            this.processQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
            }
        };

        this.ws.onclose = () => {
            this.ws = null;
            this.reconnectTimeout = setTimeout(() => this.connect(), 2000);
        };

        this.ws.onerror = (err) => {
        };
    }

    private processQueue() {
        while (this.requestQueue.length > 0) {
            const req = this.requestQueue.shift();
            if (req) req();
        }
    }

    private resubscribe() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const symbolsToSubscribe = new Set<string>();
        this.subscribers.forEach(sub => symbolsToSubscribe.add(normalizeSymbol(sub.symbol)));

        if (symbolsToSubscribe.size > 0) {
            const msg: SubSymbolsRequest = {
                type: 'sub_symbols',
                symbols: Array.from(symbolsToSubscribe),
                streams: ['candle_live']
            };
            this.ws.send(JSON.stringify(msg));
        }
    }

    public subscribe(symbol: string, tf: string, callback: SubscribeBarsCallback) {
        // Use mapped timeframe for subscription tracking
        const mappedTf = resolutionToTimeframe(tf);
        const subscription = { symbol, tf: mappedTf, callback, lastBarTime: 0 };
        this.subscribers.add(subscription);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const normalizedSymbol = normalizeSymbol(symbol);
            const msg: SubSymbolsRequest = {
                type: 'sub_symbols',
                symbols: [normalizedSymbol],
                streams: ['candle_live']
            };
            this.ws.send(JSON.stringify(msg));
        }

        return subscription;
    }

    public unsubscribe(subscription: any) {
        this.subscribers.delete(subscription);
    }

    public getHistory(symbol: string, tf: string, count: number, onSuccess: HistoryCallback, onError: (error: string) => void) {
        const runRequest = () => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                onError("WebSocket not connected during execution");
                return;
            }

            const normalizedSymbol = normalizeSymbol(symbol);
            const key = `${normalizedSymbol}-${tf}`;
            this.historyCallbacks.set(key, { onSuccess, onError });

            const msg: CandleHistoryRequest = {
                type: 'candle_history',
                symbol: normalizedSymbol,
                tf,
                count
            };
            this.ws.send(JSON.stringify(msg));
        };

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.requestQueue.push(runRequest);
        } else {
            runRequest();
        }
    }

    private handleMessage(data: any) {
        if (data.type === 'candle_snapshot') {
            const response = data as CandleHistoryResponse;
            const key = `${response.symbol}-${response.tf}`;
            const callback = this.historyCallbacks.get(key);
            if (callback) {
                const bars = response.candles.map(c => ({
                    time: c.t,
                    open: c.o,
                    high: c.h,
                    low: c.l,
                    close: c.c,
                    volume: c.v
                }));
                // Sort just in case
                bars.sort((a, b) => a.time - b.time);

                callback.onSuccess(bars, { noData: bars.length === 0 });
                this.historyCallbacks.delete(key);
            }
        } else if (data.type === 'candle_update') {
            const update = data as CandleUpdate;

            Array.from(this.subscribers).forEach(sub => {
                // sub.tf is already mapped (e.g., 'H1'), update.tf uses mapped values too
                const subTf = sub.tf;
                const subNormalized = normalizeSymbol(sub.symbol);
                const updateNormalized = normalizeSymbol(update.symbol);

                if (subNormalized === updateNormalized && subTf === update.tf) {
                    const bar = {
                        time: update.t,
                        open: update.o,
                        high: update.h,
                        low: update.l,
                        close: update.c,
                        volume: update.v
                    };

                    sub.callback(bar);
                }
            });
        }
    }
}

export class RealtimeDataFeed {
    private wsManager: WebSocketManager;
    private configuration: any;

    constructor() {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://metaapi.zuperior.com/ws';
        this.wsManager = new WebSocketManager(wsUrl);

        this.configuration = {
            supports_search: false,
            supports_group_request: false,
            supported_resolutions: ['1', '5', '15', '60', '240', '1D', '1W', '1M'],
            supports_marks: false,
            supports_timescale_marks: false,
        };
    }

    public onReady(callback: (config: any) => void) {
        setTimeout(() => callback(this.configuration), 0);
    }

    public searchSymbols(
        userInput: string,
        exchange: string,
        symbolType: string,
        onResult: SearchSymbolsCallback
    ) {
        onResult([]);
    }

    public resolveSymbol(
        symbolName: string,
        onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void,
        onResolveErrorCallback: (reason: string) => void
    ) {
        const symbolInfo: LibrarySymbolInfo = {
            name: symbolName,
            description: symbolName,
            type: 'crypto', // guess
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: '',
            minmov: 1,
            pricescale: 100, // Default
            has_intraday: true,
            supported_resolutions: this.configuration.supported_resolutions,
            volume_precision: 2,
            data_status: 'streaming',
            format: 'price',
            listed_exchange: '',
            sector: '',
            industry: ''
        };

        if (symbolName.includes('JPY') || symbolName.includes('XAU')) {
            symbolInfo.pricescale = 1000;
        } else if (symbolName.includes('BTC')) {
            symbolInfo.pricescale = 100;
        } else {
            symbolInfo.pricescale = 100000;
        }

        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    }

    public getBars(
        symbolInfo: LibrarySymbolInfo,
        resolution: ResolutionString,
        periodParams: PeriodParams,
        onHistoryCallback: HistoryCallback,
        onErrorCallback: (reason: string) => void
    ) {
        const { from, to, countBack, firstDataRequest } = periodParams;
        const tf = resolutionToTimeframe(resolution);
        const count = 1000;

        if (!firstDataRequest) {
            onHistoryCallback([], { noData: true });
            return;
        }

        this.wsManager.getHistory(symbolInfo.name, tf, count, onHistoryCallback, onErrorCallback);
    }

    public subscribeBars(
        symbolInfo: LibrarySymbolInfo,
        resolution: ResolutionString,
        onRealtimeCallback: SubscribeBarsCallback,
        listenerGuid: string,
        onResetCacheNeededCallback: () => void
    ) {
        const subscription = this.wsManager.subscribe(symbolInfo.name, resolution, onRealtimeCallback);
        (this as any)._subs = (this as any)._subs || {};
        (this as any)._subs[listenerGuid] = subscription;
    }

    public unsubscribeBars(listenerGuid: string) {
        const subs = (this as any)._subs;
        if (subs && subs[listenerGuid]) {
            this.wsManager.unsubscribe(subs[listenerGuid]);
            delete subs[listenerGuid];
        }
    }

    public getQuotes(symbols: string[], onDataCallback: (quotes: any[]) => void, onErrorCallback: (msg: string) => void): void {
        onDataCallback([]);
    }

    public subscribeQuotes(symbols: string[], fastSymbols: string[], onRealtimeCallback: (quotes: any[]) => void, listenerGUID: string): void {
    }

    public unsubscribeQuotes(listenerGUID: string): void {
    }
}
