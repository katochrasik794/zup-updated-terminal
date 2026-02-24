
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
    streams: string[];
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
    if (resolution === '3') return 'M3';
    if (resolution === '5') return 'M5';
    if (resolution === '15') return 'M15';
    if (resolution === '30') return 'M30';
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
    // Strip trailing lowercase suffixes like m, a, c, f, h, r
    return s.replace(/[macfhr]+$/, '').toUpperCase();
};

class WebSocketManager {
    private url: string;
    private ws: WebSocket | null = null;
    private reconnectTimeout: any = null;
    private subscribers: Set<{ symbol: string; tf: string; callback: SubscribeBarsCallback; lastBarTime: number }> = new Set();
    private historyCallbacks: Map<string, { onSuccess: HistoryCallback; onError: (error: string) => void }> = new Map();
    private requestQueue: (() => void)[] = [];
    public lastPrices: Map<string, number> = new Map();
    public lastQuotes: Map<string, { bid: number; ask: number; ts: number }> = new Map();
    public lastBarTimestamp: number = 0;
    public serverTimeOffset: number = 0;

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
                streams: ['candle_live', 'watch']
            };
            this.ws.send(JSON.stringify(msg));
        }
    }

    public subscribe(symbol: string, tf: string, callback: SubscribeBarsCallback) {
        // Use mapped timeframe for subscription tracking
        const mappedTf = resolutionToTimeframe(tf);
        // STORE original resolution (tf) for snapping
        const subscription = { symbol, tf: mappedTf, resolution: tf, callback, lastBarTime: 0 };
        this.subscribers.add(subscription);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const normalizedSymbol = normalizeSymbol(symbol);
            const msg: SubSymbolsRequest = {
                type: 'sub_symbols',
                symbols: [normalizedSymbol],
                streams: ['candle_live', 'watch']
            };
            this.ws.send(JSON.stringify(msg));
        }

        return subscription;
    }

    public unsubscribe(subscription: any) {
        this.subscribers.delete(subscription);
    }

    // Helper to snap timestamp to resolution (in MS)
    private snapTime(time: number, resolution: string): number {
        // Default to input info if resolution weird

        // Parse resolution
        let periodMs = 60 * 1000; // 1m default

        if (resolution === '1D' || resolution === 'D') periodMs = 24 * 60 * 60 * 1000;
        else if (resolution === '1W' || resolution === 'W') periodMs = 7 * 24 * 60 * 60 * 1000;
        else if (resolution === '1M' || resolution === 'M') return time; // Monthly hard to snap purely by ms
        else {
            // Minutes
            const mins = parseInt(resolution);
            if (!isNaN(mins)) periodMs = mins * 60 * 1000;
        }

        // Floor the time
        return Math.floor(time / periodMs) * periodMs;
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
        const nowMs = Date.now();

        if (data.type === 'candle_snapshot') {
            const response = data as CandleHistoryResponse;
            // Normalize TF to match what we stored in historyCallbacks (M1, M5, etc)
            const normalizedTf = resolutionToTimeframe(response.tf);
            const key = `${response.symbol}-${normalizedTf}`;
            const callback = this.historyCallbacks.get(key);
            if (callback) {
                // First pass: Detect offset if ANY bar is in the future
                if (this.serverTimeOffset === 0) {
                    const futureBar = response.candles.find(c => c.t > nowMs + 60000); // 1 min buffer
                    if (futureBar) {
                        const diff = futureBar.t - nowMs;
                        // Snap to nearest 30 mins (1800000 ms) to avoid jitter
                        this.serverTimeOffset = Math.round(diff / 1800000) * 1800000;
                        // console.log(`[RealtimeDataFeed] Detected time offset (Snapshot): ${this.serverTimeOffset / 3600000}h`);
                    }
                }

                const bars = response.candles.map(c => ({
                    time: c.t - this.serverTimeOffset, // Shift to UTC so chart can convert to 'Europe/Athens'
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

                // Cache last price from history
                if (bars.length > 0) {
                    const lastBar = bars[bars.length - 1];
                    this.lastPrices.set(normalizeSymbol(response.symbol), lastBar.close);

                    if (lastBar.time > this.lastBarTimestamp) {
                        this.lastBarTimestamp = lastBar.time;
                    }
                }
            }
        } else if (data.type === 'candle_update') {
            const update = data as CandleUpdate;

            // Normalize TF
            const updateTf = resolutionToTimeframe(update.tf);
            // console.log(`[RealtimeDataFeed] Handling update for ${update.symbol} ${update.tf} -> ${updateTf}`);

            // Ensure timestamp is in MS
            const rawTime = update.t < 1e12 ? update.t * 1000 : update.t;

            // Detect offset if we haven't already (or update if significant drift?)
            // Usually snapshot handles it, but just in case
            if (rawTime > nowMs + 60000 && this.serverTimeOffset === 0) {
                const diff = rawTime - nowMs;
                this.serverTimeOffset = Math.round(diff / 1800000) * 1800000;
                // console.log(`[RealtimeDataFeed] Detected time offset (Update): ${this.serverTimeOffset / 3600000}h`);
            }

            // RE-ENABLING OFFSET SUBTRACTION (Shift to UTC)
            // Now that we set timezone to 'Europe/Athens', we MUST provide UTC timestamps.
            // The chart will convert UTC -> Athens for grid alignment.
            const adjustedTime = rawTime - (this.serverTimeOffset || 0);

            let specificUpdateFound = false;

            Array.from(this.subscribers).forEach(sub => {
                // sub.tf is already mapped (e.g., 'H1')
                const subTf = sub.tf;
                const subNormalized = normalizeSymbol(sub.symbol);
                const updateNormalized = normalizeSymbol(update.symbol);

                if (subNormalized === updateNormalized && subTf === updateTf) {
                    specificUpdateFound = true;

                    // Trust the shifted UTC time
                    const finalTime = adjustedTime;

                    const bar = {
                        time: finalTime,
                        open: update.o,
                        high: update.h,
                        low: update.l,
                        close: update.c,
                        volume: update.v
                    };

                    if (finalTime > this.lastBarTimestamp) {
                        this.lastBarTimestamp = finalTime;
                    }

                    sub.callback(bar);
                }
            });

            if (!specificUpdateFound) {
                // console.warn(`[RealtimeDataFeed] No subscriber found matching ${normalizeSymbol(update.symbol)} ${updateTf}. (Subs count: ${this.subscribers.size})`);
                // this.subscribers.forEach(s => console.log(`  - Sub: ${normalizeSymbol(s.symbol)} ${s.tf}`));
            }

            // Cache last price from live update
            const normalized = normalizeSymbol(update.symbol);
            this.lastPrices.set(normalized, update.c);
        } else if (data.type === 'watch') {
            const quote = data as { symbol: string; bid: number; ask: number; ts: number };
            const normalizedSymbolName = normalizeSymbol(quote.symbol);
            this.lastPrices.set(normalizedSymbolName, quote.bid);
            this.lastQuotes.set(normalizedSymbolName, { bid: quote.bid, ask: quote.ask, ts: quote.ts });

            // Notify quote subscribers if any
            if ((this as any)._quoteSubscribers) {
                const sub = (this as any)._quoteSubscribers.get(normalizedSymbolName);
                if (sub) {
                    sub.callback({
                        s: 'ok',
                        n: sub.originalSymbol || quote.symbol,
                        v: {
                            lp: quote.bid,
                            ask: quote.ask,
                            bid: quote.bid,
                            ch: 0,
                            chp: 0
                        }
                    });
                }
            }
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
            supported_resolutions: ['1', '3', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
            supports_quotes: true,
        };
    }

    public getLastPrice(symbol: string): number | undefined {
        const normalized = normalizeSymbol(symbol);
        const lastPrice = this.wsManager.lastPrices.get(normalized);
        // console.log(`[RealtimeDataFeed] getLastPrice for ${symbol} (norm: ${normalized}): ${lastPrice}. Cache size: ${this.wsManager.lastPrices.size}`);
        return lastPrice;
    }

    public onReady(callback: (config: any) => void) {
        callback(this.configuration);
    }

    public getServerTime(callback: (time: number) => void) {
        // SIMPLIFIED: Just return local time in seconds as per standard practice (UTC)
        // Data is now shifted to UTC in handleMessage, and Chart converts to 'Europe/Athens'
        // console.log('[RealtimeDataFeed] getServerTime called (UTC)');
        callback(Math.floor(Date.now() / 1000));
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
            ticker: symbolName,
            description: symbolName,
            type: 'forex',
            session: '24x7',
            timezone: 'Europe/Athens', // Set to MT5 Server Timezone (EET) to align H4/D1 grids correctly
            exchange: '',
            listed_exchange: '',
            minmov: 1,
            pricescale: 100, // Default
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: this.configuration.supported_resolutions,
            intraday_multipliers: ['1', '3', '5', '15', '30', '60', '240'],
            volume_precision: 2,
            data_status: 'streaming',
            format: 'price',
            supports_time: true, // Explicitly supported
        } as any;

        // Note: TradingView uses `pip_size` or `pipSize` and `pipValue` for chart PNL calculations.
        // If not set, it defaults to standard Forex contract sizes (100,000 units).
        if (symbolName.includes('XAG')) {
            symbolInfo.pricescale = 100000;
            // @ts-ignore
            symbolInfo.pip_size = 0.00001;
            // @ts-ignore
            symbolInfo.pipValue = 0.05; // 5000 units contract (0.01 lot = 50 units. 1.0 move = $50. 1.0 move * 0.01 lot * 0.05 * 100000 = 50)
        } else if (symbolName.includes('JPY') || symbolName.includes('XAU')) {
            symbolInfo.pricescale = 1000;
            // @ts-ignore
            symbolInfo.pip_size = 0.01;
            // @ts-ignore
            symbolInfo.pipValue = 10;
        } else if (symbolName.includes('BTC')) {
            symbolInfo.pricescale = 100;
            // @ts-ignore
            symbolInfo.pip_size = 0.01;
            // @ts-ignore
            symbolInfo.pipValue = 0.01;
        } else if (symbolName.includes('ETH')) {
            symbolInfo.pricescale = 100;
            // @ts-ignore
            symbolInfo.pip_size = 0.01;
            // @ts-ignore
            symbolInfo.pipValue = 0.10;
        } else if (
            symbolName.includes('US30') ||
            symbolName.includes('US500') ||
            symbolName.includes('USTEC') ||
            symbolName.includes('DE30') ||
            symbolName.includes('FR40') ||
            symbolName.includes('UK100') ||
            symbolName.includes('AUS200') ||
            symbolName.includes('HK50') ||
            symbolName.includes('JP225')
        ) {
            symbolInfo.pricescale = 100;
            // @ts-ignore
            symbolInfo.pip_size = 0.01;
            // @ts-ignore
            symbolInfo.pipValue = 0.10; // 10 unit contract: $1 move = $10 profit per lot
        } else {
            symbolInfo.pricescale = 100000;
            // @ts-ignore
            symbolInfo.pip_size = 0.0001;
            // @ts-ignore
            symbolInfo.pipValue = 10;
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
        const quotes = symbols.map(s => {
            const normalized = normalizeSymbol(s);
            const quote = this.wsManager.lastQuotes.get(normalized);
            return {
                s: 'ok',
                n: s,
                v: {
                    ch: 0,
                    chp: 0,
                    lp: quote?.bid || this.wsManager.lastPrices.get(normalized) || 0,
                    ask: quote?.ask || 0,
                    bid: quote?.bid || 0,
                }
            };
        });
        onDataCallback(quotes);
    }

    public subscribeQuotes(symbols: string[], fastSymbols: string[], onRealtimeCallback: (quotes: any[]) => void, listenerGUID: string): void {
        const ws = this.wsManager;
        (ws as any)._quoteSubscribers = (ws as any)._quoteSubscribers || new Map();

        symbols.forEach(s => {
            const normalized = normalizeSymbol(s);
            (ws as any)._quoteSubscribers.set(normalized, {
                callback: (data: any) => onRealtimeCallback([data]),
                guid: listenerGUID,
                originalSymbol: s
            });
        });
    }

    public unsubscribeQuotes(listenerGUID: string): void {
        const ws = this.wsManager;
        if ((ws as any)._quoteSubscribers) {
            for (const [symbol, sub] of (ws as any)._quoteSubscribers.entries()) {
                if ((sub as any).guid === listenerGUID) {
                    (ws as any)._quoteSubscribers.delete(symbol);
                }
            }
        }
    }
}
