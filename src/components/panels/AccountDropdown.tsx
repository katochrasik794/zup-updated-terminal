"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { FiChevronRight, FiHelpCircle } from 'react-icons/fi'
import { usePrivacy } from '../../context/PrivacyContext';
import { useAccount } from '../../context/AccountContext';
import { formatCurrency, cn } from '../../lib/utils';
import { apiClient } from '../../lib/api';

export default function AccountDropdown({ isOpen, onClose }) {
  const { hideBalance, toggleHideBalance } = usePrivacy();
  const {
    mt5Accounts,
    currentAccountId,
    setCurrentAccountId,
    isLoading: isAccountsLoading,
    isAccountSwitching
  } = useAccount();

  const [currentData, setCurrentData] = useState<any>(null);
  const [listBalances, setListBalances] = useState<Record<string, any>>({});
  const [showLoader, setShowLoader] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Trigger loader ONLY if we haven't loaded data yet
  useEffect(() => {
    if (isOpen && !hasLoadedOnce.current) {
      // Logic for background loading if needed, but no artificial delay
      hasLoadedOnce.current = true;
    }
  }, [isOpen]);

  // Direct fetch for selected account
  const fetchCurrentBalance = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const token = localStorage.getItem('token');
      const baseURL = apiClient.getBaseURL();
      const response = await fetch(`${baseURL}/api/accounts/${currentAccountId}/profile`, {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setCurrentData(result.data);
      }
    } catch (err) {
      // Silently fail - balance fetch errors are not critical
      // console.error('[AccountDropdown] Fetch Current Error:', err);
    }
  }, [currentAccountId]);

  // Polling for selection list balances
  const fetchListBalances = useCallback(async () => {
    if (mt5Accounts.length === 0) return;
    try {
      const token = localStorage.getItem('token');
      const results: Record<string, any> = {};

      // Fetch all visible accounts - doing it in parallel
      const baseURL = apiClient.getBaseURL();
      await Promise.all(mt5Accounts.map(async (acc) => {
        try {
          const response = await fetch(`${baseURL}/api/accounts/${acc.accountId}/profile`, {
            cache: 'no-store',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const res = await response.json();
          if (res.success && res.data) {
            results[acc.accountId] = res.data;
          }
        } catch (e) {
          // ignore individual errors
        }
      }));

      setListBalances(prev => ({ ...prev, ...results }));
    } catch (err) {
      console.error('[AccountDropdown] Fetch List Error:', err);
    }
  }, [isOpen, mt5Accounts]);

  // 1. High-priority polling for the active account (200ms)
  useEffect(() => {
    fetchCurrentBalance();
    const intervalId = setInterval(fetchCurrentBalance, 200);
    return () => clearInterval(intervalId);
  }, [fetchCurrentBalance]);

  // 2. Lower-priority polling for the account selection list (2000ms)
  useEffect(() => {
    fetchListBalances();
    const intervalId = setInterval(fetchListBalances, 2000); // 2s is enough for background list
    return () => clearInterval(intervalId);
  }, [fetchListBalances]);

  const handleAccountSelect = async (accountId: string) => {
    // 1. Persist to localStorage immediately
    localStorage.setItem('defaultMt5Account', accountId);
    localStorage.setItem('accountId', accountId);

    // 2. Perform a HARD RELOAD with the new accountId in the URL
    // This ensures total re-initialization of DOM and all context layers
    window.location.href = `/terminal?accountId=${accountId}`;
  }

  const handleManageAccounts = () => {
    window.location.href = 'https://dashboard.zuperior.com'
  }


  // Mapping values
  const balance = currentData?.Balance ?? 0;
  const equity = currentData?.Equity ?? 0;
  const margin = currentData?.Margin ?? 0;
  const freeMargin = currentData?.MarginFree ?? 0;
  const marginLevel = currentData?.MarginLevel ?? 0;
  const leverage = (currentData?.Leverage || currentData?.MarginLeverage) ? `1:${currentData.Leverage || currentData.MarginLeverage}` : '1:200';
  const credit = currentData?.Credit ?? 0;
  // Calculate P/L: Use Profit field from API (same as StatusBar)
  const profitLoss = currentData?.Profit ?? 0;

  const renderValue = (val: number, isPercent = false) => {
    if (hideBalance) return '***';
    if (isAccountSwitching) return <span className="animate-pulse text-gray-500">...</span>;
    if (showLoader && !currentData) return <span className="animate-wavy opacity-40">~~~</span>;
    if (isPercent) return `${val.toFixed(2)} %`;
    return `${formatCurrency(val, 2)} USD`;
  }

  return (
    <div className={cn("transition-all duration-200", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute top-full right-0 mt-2 w-[340px] bg-[#0b0e14] border border-gray-800 rounded-lg shadow-2xl z-[100] overflow-hidden font-sans">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-gray-300 text-[13px]">Hide balance</span>
          <button
            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${hideBalance ? 'bg-white' : 'bg-gray-800'}`}
            onClick={toggleHideBalance}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full transition-transform ${hideBalance ? 'left-5 bg-black' : 'left-1 bg-white'}`}></div>
          </button>
        </div>

        <div className="px-4 pb-4 space-y-2 border-b border-gray-800">
          {[
            { label: 'Balance', value: balance },
            { label: 'Equity', value: equity, color: 'text-[#00ffaa]' },
            { label: 'Margin', value: margin },
            { label: 'Free margin', value: freeMargin },
            { label: 'Margin level', value: marginLevel, isPercent: true },
            { label: 'Account leverage', value: leverage, isLeverage: true },
            { label: 'Credit', value: credit },
            { label: 'Total P/L, USD', value: profitLoss, color: profitLoss >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]', isPL: true }
          ].map((item, idx) => {
            // Debug: Log P/L item
            if (item.isPL && isOpen) {
              console.log('[AccountDropdown] Rendering P/L item:', {
                label: item.label,
                value: item.value,
                profitLoss,
                currentData: currentData,
                hasProfit: !!currentData?.Profit
              });
            }
            // Handle P/L rendering with proper loading states
            let displayValue: string | React.ReactNode;
            if (item.isLeverage) {
              displayValue = item.value;
            } else if (item.isPL) {
              if (hideBalance) {
                displayValue = '***';
              } else if (isAccountSwitching) {
                displayValue = <span className="animate-pulse text-gray-500">...</span>;
              } else if (showLoader && !currentData) {
                displayValue = <span className="animate-wavy opacity-40">~~~</span>;
              } else {
                const plValue = profitLoss ?? 0;
                // Match StatusBar format exactly: +X.XX or -X.XX (no USD suffix, no formatCurrency)
                displayValue = `${plValue >= 0 ? '+' : ''}${plValue.toFixed(2)}`;
              }
            } else {
              displayValue = renderValue(item.value as number, item.isPercent);
            }

            return (
              <div key={idx} className="flex justify-between items-center text-[13px]">
                <span className="text-gray-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={item.color || 'text-white'}>
                    {displayValue}
                  </span>
                  <FiHelpCircle className="text-gray-600" size={14} />
                </div>
              </div>
            );
          })}

          <button className="w-full py-2.5 mt-2 border border-gray-800 hover:bg-gray-800 text-white rounded text-[13px] font-medium transition-colors cursor-pointer uppercase">
            Top Up
          </button>
        </div>

        <div className="p-4 border-b border-gray-800">
          <div className="text-gray-500 text-[13px] mb-3">Choose an account</div>
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {mt5Accounts.length === 0 ? (
              <div className="text-gray-400 text-[13px] text-center py-4">
                {isAccountsLoading ? 'Loading accounts...' : 'No accounts found'}
              </div>
            ) : (
              mt5Accounts.map(account => {
                const isSelected = currentAccountId === account.accountId
                const accData = listBalances[account.accountId]
                const accEquity = accData?.Equity ?? 0

                return (
                  <div
                    key={account.id}
                    onClick={() => handleAccountSelect(account.accountId)}
                    className={`relative p-3 rounded-md cursor-pointer transition-colors border ${isSelected
                      ? 'bg-[#1e1b2e] border-[#5a4d9e]'
                      : 'bg-[#151921] border-transparent hover:bg-[#1c222b]'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-[2px] text-[10px] rounded font-medium ${account.accountType === 'Live' ? 'bg-[#3d2e18] text-[#eab308]' : 'bg-green-900/40 text-green-400'}`}>
                        {account.accountType}
                      </span>
                      <span className="text-gray-400 text-[12px]">{account.displayAccountId}</span>
                    </div>
                    <div className="text-white text-[14px] font-semibold">
                      {hideBalance
                        ? '***'
                        : (showLoader && !accData)
                          ? <div className="h-4 w-20 animate-shimmer rounded bg-white/5" />
                          : `${formatCurrency(accEquity, 2)} USD`
                      }
                    </div>
                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]"></div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="py-2">
          <button
            onClick={handleManageAccounts}
            className="w-full px-4 py-2.5 flex items-center justify-between text-gray-300 hover:bg-gray-800/50 transition-colors text-[13px]"
          >
            <span>Manage Accounts</span>
            <FiChevronRight size={16} className="text-gray-600" />
          </button>
          <button className="w-full px-4 py-2.5 flex items-center justify-between text-gray-300 hover:bg-gray-800/50 transition-colors text-[13px]">
            <span>Download Trading Log</span>
            <FiChevronRight size={16} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
