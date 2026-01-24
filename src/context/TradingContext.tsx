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
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }) {
    const [lastOrder, setLastOrder] = useState<Order | null>(null);
    const [symbol, setSymbol] = useState<string>('AAPL');
    const [modifyModalState, setModifyModalState] = useState<ModifyModalState>({ isOpen: false, position: null });
    const [lastModification, setLastModification] = useState<any | null>(null);

    const placeOrder = (order: Order) => {
        console.log("Placing order globally:", order);
        setLastOrder(order);
    };

    const requestModifyPosition = (modification: any) => {
        console.log("Requesting position modification:", modification);
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
            requestModifyPosition
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
