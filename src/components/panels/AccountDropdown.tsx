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
    isLoading: isAccountsLoading,
    isAccountSwitching,
    currentBalance,
    balances
  } = useAccount();

  // const [currentData, setCurrentData] = useState<any>(null); // Removed local state
  // const [listBalances, setListBalances] = useState<Record<string, any>>({}); // Removed local state
  // const [showLoader, setShowLoader] = useState(false); // Removed unused local state
  // const hasLoadedOnce = useRef(false); // Removed unused ref

  // Removed local polling effects as data is now provided by AccountContext via WebSocket

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
  // Mapping values from AccountContext
  const data = currentBalance;

  const balance = data?.balance ?? 0;
  const equity = data?.equity ?? 0;
  const margin = data?.margin ?? 0;
  const credit = data?.credit ?? 0;

  // Calculate derived values locally for robustness
  const freeMargin = Number((equity - margin).toFixed(2));
  const profitLoss = Number((equity - balance - credit).toFixed(2));

  const marginLevel = data?.marginLevel ?? 0;
  const rawLeverage = data?.leverage || '2000';
  const cleanLeverage = (String(rawLeverage).split(':').pop() || '2000').trim();
  const leverage = `1:${cleanLeverage}`;

  const renderValue = (val: number, isPercent = false) => {
    if (hideBalance) return '***';
    if (isAccountSwitching) return <span className="animate-pulse text-gray-500">...</span>;
    if (hideBalance) return '***';
    if (isAccountSwitching) return <span className="animate-pulse text-gray-500">...</span>;
    // Removed showLoader check as we rely on context data availability

    if (isPercent) return `${val.toFixed(2)} %`;
    return `${formatCurrency(val, 2)} USD`;
  }

  return (
    <div className={cn("transition-all duration-200", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute top-full right-0 mt-2 w-[340px] bg-background border border-gray-800 rounded-lg shadow-2xl z-[100] overflow-hidden font-sans">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-gray-300 text-[13px]">Hide balance</span>
          <button
            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${hideBalance ? 'bg-foreground' : 'bg-gray-800'}`}
            onClick={toggleHideBalance}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full transition-transform ${hideBalance ? 'left-5 bg-background' : 'left-1 bg-foreground'}`}></div>
          </button>
        </div>

        <div className="px-4 pb-4 space-y-2 border-b border-gray-800">
          {[
            { label: 'Balance', value: balance },
            { label: 'Equity', value: equity, color: 'text-success' },
            { label: 'Margin', value: margin },
            { label: 'Free margin', value: freeMargin },
            { label: 'Margin level', value: marginLevel, isPercent: true },
            { label: 'Account leverage', value: leverage, isLeverage: true },
            { label: 'Credit', value: credit },
            { label: 'Total P/L, USD', value: profitLoss, color: profitLoss >= 0 ? 'text-success' : 'text-danger', isPL: true }
          ].map((item, idx) => {
            // Handle P/L rendering with proper loading states
            let displayValue: string | React.ReactNode;
            if (item.isLeverage) {
              displayValue = item.value;
            } else if (item.isPL) {
              if (hideBalance) {
                displayValue = '***';
              } else if (isAccountSwitching) {
                displayValue = <span className="animate-pulse text-gray-500">...</span>;
              } else if (isAccountSwitching) {
                displayValue = <span className="animate-pulse text-gray-500">...</span>;
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
                  <span className={item.color || 'text-foreground'}>
                    {displayValue}
                  </span>
                  <FiHelpCircle className="text-gray-600" size={14} />
                </div>
              </div>
            );
          })}

          <button className="w-full py-2.5 mt-2 border border-gray-800 hover:bg-gray-800 text-foreground rounded text-[13px] font-medium transition-colors cursor-pointer uppercase">
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
                const accData = balances[account.accountId]
                const accEquity = accData?.equity ?? 0
                // We can also calculate PL for other accounts if we want consistency
                // const accPL = accData ? (accData.equity - accData.balance - (accData.credit || 0)) : 0

                return (
                  <div
                    key={account.id}
                    onClick={() => handleAccountSelect(account.accountId)}
                    className={cn(
                      "relative p-3 rounded-md cursor-pointer transition-colors border",
                      isSelected
                        ? "bg-gray-800 border-primary"
                        : "bg-gray-900 border-transparent hover:bg-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-[2px] text-[10px] rounded font-medium ${account.accountType === 'Live' ? 'bg-[#3d2e18] text-[#eab308]' : 'bg-green-900/40 text-green-400'}`}>
                        {account.accountType}
                      </span>
                      <span className="text-gray-400 text-[12px]">{account.displayAccountId}</span>
                    </div>
                    <div className="text-foreground text-[14px] font-semibold">
                      {hideBalance
                        ? '***'
                        : (!accData)
                          ? <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
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

          {/* <button className="w-full px-4 py-2.5 flex items-center justify-between text-gray-300 hover:bg-gray-800/50 transition-colors text-[13px]">
            <span>Download Trading Log</span>
            <FiChevronRight size={16} className="text-gray-600" />
          </button> */}
        </div>
      </div>
    </div >
  )
}
