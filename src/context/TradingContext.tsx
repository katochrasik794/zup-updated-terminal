"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount } from './AccountContext';
import { useInstruments } from './InstrumentContext';

interface Order {
    symbol: string;
    side: 'buy' | 'sell';
    volume: string;
    type: 'market' | 'limit' | 'stop';
    price?: string;
    tp?: string;
    sl?: string;
}

interface ModifyModalState {
    isOpen: boolean;
    position: any | null;
}

export interface ChartSettings {
    openPositions: boolean;
    tpsl: boolean;
}

interface TradingContextType {
    lastOrder: Order | null;
    placeOrder: (order: Order) => void;
    symbol: string;
    setSymbol: (symbol: string) => void;
    modifyModalState: ModifyModalState;
    setModifyModalState: (state: ModifyModalState) => void;
    lastModification: any | null;
    requestModifyPosition: (modification: any) => void;
    clearLastModification: () => void;
    addNavbarTab: ((symbol: string) => void) | null;
    setAddNavbarTab: (fn: (symbol: string) => void) => void;
    chartSettings: ChartSettings;
    setChartSettings: (settings: Partial<ChartSettings>) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }) {
    const { currentAccountId } = useAccount();
    const [lastOrder, setLastOrder] = useState<Order | null>(null);

    // Load last selected symbol for current account from localStorage
    const [symbol, setSymbolState] = useState<string>(() => {
        if (typeof window !== 'undefined' && currentAccountId) {
            const key = `zup-symbol-${currentAccountId}`;
            return localStorage.getItem(key) || 'EURUSD';
        }
        return 'EURUSD';
    });

    const [modifyModalState, setModifyModalState] = useState<ModifyModalState>({ isOpen: false, position: null });
    const [lastModification, setLastModification] = useState<any | null>(null);
    const [addNavbarTab, setAddNavbarTab] = useState<((symbol: string) => void) | null>(null);

    // Chart visibility settings
    const [chartSettings, setChartSettingsState] = useState<ChartSettings>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('zup-chart-settings');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) { }
            }
        }
        return { openPositions: true, tpsl: true };
    });

    // Update symbol when account changes
    useEffect(() => {
        if (typeof window !== 'undefined' && currentAccountId) {
            const key = `zup-symbol-${currentAccountId}`;
            const savedSymbol = localStorage.getItem(key);
            if (savedSymbol) {
                setSymbolState(savedSymbol);
            } else {
                setSymbolState('EURUSD');
            }
        }
    }, [currentAccountId]);

    // Validate symbol against available instruments
    const { instruments, isLoading: isInstrumentsLoading, accountId: instrumentsAccountId } = useInstruments();

    useEffect(() => {
        // Only validate if we have instruments AND they belong to the current account
        if (isInstrumentsLoading || instruments.length === 0 || !symbol || !currentAccountId || (instrumentsAccountId && instrumentsAccountId !== currentAccountId)) {
            return;
        }

        // Check if current symbol exists in instruments
        const isValid = instruments.some(i => i.symbol === symbol);

        if (!isValid) {
            // Try to find a match with suffix handling
            const commonSuffixes = ['m', '.', '#', '!', '_m'];

            // 1. Try stripping suffixes from current symbol
            let baseSymbol = symbol;
            for (const suffix of commonSuffixes) {
                if (symbol.endsWith(suffix)) {
                    baseSymbol = symbol.slice(0, -suffix.length);
                    break;
                }
            }

            // 2. Try to find a match for the base symbol or base symbol + any common suffix
            let match = instruments.find(i => i.symbol === baseSymbol);

            if (!match) {
                // Try adding suffixes to the base symbol
                for (const suffix of commonSuffixes) {
                    const candidate = `${baseSymbol}${suffix}`;
                    match = instruments.find(i => i.symbol === candidate);
                    if (match) break;
                }
            }

            // 3. If still no match, try case-insensitive search on base symbol
            if (!match) {
                match = instruments.find(i => i.symbol.toUpperCase().startsWith(baseSymbol.toUpperCase()));
            }

            if (match) {
                setSymbol(match.symbol);
            } else {
                // Fallback to EURUSD if it exists, otherwise first available
                const eurusdMatch = instruments.find(i => i.symbol.startsWith('EURUSD'));
                if (eurusdMatch) {
                    setSymbol(eurusdMatch.symbol);
                } else if (instruments.length > 0) {
                    setSymbol(instruments[0].symbol);
                }
            }
        }
    }, [instruments, isInstrumentsLoading, symbol, currentAccountId, instrumentsAccountId]);

    // Wrapper to persist symbol to localStorage per account
    const setSymbol = (newSymbol: string) => {
        // Try to find the matching instrument to preserve casing (e.g. XAUUSDm)
        // We can't use useInstruments here because it would cause a circular dependency
        // if InstrumentProvider uses TradingProvider (it doesn't, but let's be safe)
        // Actually, we can just use the instruments from localStorage cache if available
        let symbolToSet = newSymbol;

        if (typeof window !== 'undefined') {
            // Try to find correct casing from cached instruments
            try {
                const keys = Object.keys(localStorage);
                const instrumentKey = keys.find(k => k.startsWith('zup-instruments-'));
                if (instrumentKey) {
                    const cached = localStorage.getItem(instrumentKey);
                    if (cached) {
                        const { data } = JSON.parse(cached);
                        if (Array.isArray(data)) {
                            const match = data.find(inst => inst.symbol.toUpperCase() === newSymbol.toUpperCase());
                            if (match) {
                                symbolToSet = match.symbol;
                            }
                        }
                    }
                }
            } catch (e) { }

            setSymbolState(symbolToSet);
            if (currentAccountId) {
                const key = `zup-symbol-${currentAccountId}`;
                localStorage.setItem(key, symbolToSet);
            }
        } else {
            setSymbolState(newSymbol);
        }
    };

    const placeOrder = (order: Order) => {

        setLastOrder(order);
    };

    const requestModifyPosition = (modification: any) => {
        setLastModification(modification);
    };

    const clearLastModification = () => {
        setLastModification(null);
    };

    const setChartSettings = (newSettings: Partial<ChartSettings>) => {
        setChartSettingsState(prev => {
            const updated = { ...prev, ...newSettings };
            if (typeof window !== 'undefined') {
                localStorage.setItem('zup-chart-settings', JSON.stringify(updated));
            }
            return updated;
        });
    };

    return (
        <TradingContext.Provider value={{
            lastOrder,
            placeOrder,
            symbol,
            setSymbol,
            modifyModalState,
            setModifyModalState,
            lastModification,
            requestModifyPosition,
            clearLastModification,
            addNavbarTab,
            setAddNavbarTab,
            chartSettings,
            setChartSettings
        }}>
            {children}
        </TradingContext.Provider>
    );
}

export function useTrading() {
    const context = useContext(TradingContext);
    if (context === undefined) {
        throw new Error('useTrading must be used within a TradingProvider');
    }
    return context;
}
