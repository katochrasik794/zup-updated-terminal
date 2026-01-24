"use client";

import React, { createContext, useContext, useState } from 'react';

interface TradingContextType {
    broker: any;
    setBroker: (broker: any) => void;
    activeSymbol: string;
    setActiveSymbol: (symbol: string) => void;
    showOrderDialog: (order: any) => void;
    setShowOrderDialogFunc: (fn: (order: any) => void) => void;

    // Modification Modal State
    isModifyModalOpen: boolean;
    setIsModifyModalOpen: (open: boolean) => void;
    selectedPosition: any;
    setSelectedPosition: (pos: any) => void;
    selectedBrackets: any;
    setSelectedBrackets: (brackets: any) => void;

    // Resolve/Reject for library promises
    resolveModify: (result?: any) => void;
    setResolveModify: (fn: (result?: any) => void) => void;

    placeOrder: (order: any) => Promise<any>;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }: { children: React.ReactNode }) {
    const [broker, setBroker] = useState<any>(null);
    const [activeSymbol, setActiveSymbol] = useState<string>('AAPL');
    const [showOrderDialogFn, setShowOrderDialogFn] = useState<((order: any) => void) | null>(null);

    const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [selectedBrackets, setSelectedBrackets] = useState<any>(null);

    const [resolveModifyFn, setResolveModifyFn] = useState<((result?: any) => void) | null>(null);

    const placeOrder = async (order: any) => {
        if (!broker) {
            console.warn("Broker not initialized");
            return Promise.reject("Broker not initialized");
        }
        return broker.placeOrder(order);
    };

    const showOrderDialog = (order: any) => {
        if (showOrderDialogFn) {
            showOrderDialogFn(order);
        } else {
            console.warn("showOrderDialogFn not registered");
        }
    };

    const resolveModify = (result?: any) => {
        if (resolveModifyFn) {
            resolveModifyFn(result);
            setResolveModifyFn(null);
        }
    };

    return (
        <TradingContext.Provider value={{
            broker,
            setBroker,
            activeSymbol,
            setActiveSymbol,
            showOrderDialog,
            setShowOrderDialogFunc: setShowOrderDialogFn,
            isModifyModalOpen,
            setIsModifyModalOpen,
            selectedPosition,
            setSelectedPosition,
            selectedBrackets,
            setSelectedBrackets,
            resolveModify,
            setResolveModify: setResolveModifyFn,
            placeOrder
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
