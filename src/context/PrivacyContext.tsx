"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

const PrivacyContext = createContext({
    hideBalance: false,
    toggleHideBalance: () => { },
});

export const PrivacyProvider = ({ children }) => {
    const [hideBalance, setHideBalance] = useState(false);

    // Initialize from localStorage if available
    useEffect(() => {
        const saved = localStorage.getItem('hideBalance');
        if (saved) {
            setHideBalance(JSON.parse(saved));
        }
    }, []);

    const toggleHideBalance = () => {
        setHideBalance(prev => {
            const newValue = !prev;
            localStorage.setItem('hideBalance', JSON.stringify(newValue));
            return newValue;
        });
    };

    return (
        <PrivacyContext.Provider value={{ hideBalance, toggleHideBalance }}>
            {children}
        </PrivacyContext.Provider>
    );
};

export const usePrivacy = () => useContext(PrivacyContext);
