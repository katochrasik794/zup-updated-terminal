"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount } from './AccountContext';

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

interface TradingContextType {
    lastOrder: Order | null;
    placeOrder: (order: Order) => void;
    symbol: string;
    setSymbol: (symbol: string) => void;
    modifyModalState: ModifyModalState;
    setModifyModalState: (state: ModifyModalState) => void;
    lastModification: any | null;
    requestModifyPosition: (modification: any) => void;
    addNavbarTab: ((symbol: string) => void) | null;
    setAddNavbarTab: (fn: (symbol: string) => void) => void;
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

    // Wrapper to persist symbol to localStorage per account
    const setSymbol = (newSymbol: string) => {
        setSymbolState(newSymbol);
        if (typeof window !== 'undefined' && currentAccountId) {
            const key = `zup-symbol-${currentAccountId}`;
            localStorage.setItem(key, newSymbol);
        }
    };

    const placeOrder = (order: Order) => {

        setLastOrder(order);
    };

    const requestModifyPosition = (modification: any) => {

        setLastModification(modification);
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
            addNavbarTab,
            setAddNavbarTab
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
