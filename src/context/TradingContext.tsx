"use client";
import React, { createContext, useContext, useState } from 'react';

interface Order {
    symbol: string;
    side: 'buy' | 'sell';
    volume: string;
    type: 'market' | 'limit' | 'stop';
    price?: string;
    tp?: string;
    sl?: string;
}

interface TradingContextType {
    lastOrder: Order | null;
    placeOrder: (order: Order) => void;
    symbol: string;
    setSymbol: (symbol: string) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }) {
    const [lastOrder, setLastOrder] = useState<Order | null>(null);
    const [symbol, setSymbol] = useState<string>('AAPL');

    const placeOrder = (order: Order) => {
        console.log("Placing order globally:", order);
        setLastOrder(order);
    };

    return (
        <TradingContext.Provider value={{ lastOrder, placeOrder, symbol, setSymbol }}>
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
