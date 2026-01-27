"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { GiNetworkBars } from "react-icons/gi";
import CloseAllPositionsDropdown from "../modals/CloseAllPositionsDropdown";
import { usePrivacy } from '../../context/PrivacyContext';
import { formatCurrency } from '../../lib/utils';
import { apiClient } from '../../lib/api';

export default function StatusBar({ openPositions = [], onCloseAll }: any) {
  const { hideBalance } = usePrivacy();
  const [data, setData] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false)
  const buttonRef = useRef(null)

  const fetchBalance = useCallback(async () => {
    try {
      // Get account ID directly from localStorage to be independent
      const accountId = localStorage.getItem('defaultMt5Account') || localStorage.getItem('accountId');
      const token = localStorage.getItem('token');
      if (!accountId) return;

      const baseURL = apiClient.getBaseURL();
      const response = await fetch(`${baseURL}/api/accounts/${accountId}/profile`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      // Silently fail - balance fetch errors are not critical
      // console.error('[StatusBar] Direct Fetch Error:', err);
    }
  }, []);

  // Standalone polling loop
  useEffect(() => {
    fetchBalance(); // Initial fetch
    const interval = setInterval(fetchBalance, 200); // 200ms poll
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Map values
  const equity = data?.Equity ?? data?.equity ?? 0;
  const balance = data?.Balance ?? data?.balance ?? 0;
  const margin = data?.Margin ?? data?.margin ?? data?.MarginUsed ?? data?.marginUsed ?? 0;
  
  // Calculate Free Margin: Always calculate as Equity - Margin (standard MT5 formula)
  const freeMargin = useMemo(() => {
    const eq = Number(equity) || 0;
    const mg = Number(margin) || 0;
    return parseFloat((eq - mg).toFixed(2));
  }, [equity, margin]);
  
  const marginLevel = data?.MarginLevel ?? data?.marginLevel ?? 0;
  
  // Calculate P/L from open positions (same as CloseAllPositionsDropdown)
  // Sum up all position P/L values
  const totalPL = openPositions.reduce((sum, pos) => {
    const pl = parseFloat(String(pos.pl || '0').replace('+', ''));
    return sum + (isNaN(pl) ? 0 : pl);
  }, 0);

  const renderValue = (value: number, suffix: string = 'USD') => {
    if (hideBalance) return '****';
    return `${formatCurrency(value, 2)} ${suffix}`;
  };

  return (
    <div className="bg-background flex items-center justify-between px-4 py-2 text-xs text-gray-400 font-medium rounded-tl-md relative border-t border-gray-800">
      {/* Left section - Account info */}
      <div className="flex items-center gap-6">
        <span>Equity: <span className="text-gray-200 font-mono">{renderValue(equity)}</span></span>
        <span>Free Margin: <span className="text-gray-200 font-mono">{renderValue(freeMargin)}</span></span>
        <span>Balance: <span className="text-gray-200 font-mono">{renderValue(balance)}</span></span>
        <span>Margin: <span className="text-gray-200 font-mono">{renderValue(margin)}</span></span>
        <span>Margin level: <span className="text-gray-200 font-mono">
          {hideBalance ? '****' : `${marginLevel.toFixed(2)}%`}
        </span></span>
      </div>

      {/* Right section - P/L, Close all, Connection */}
      <div className="flex items-center gap-4">
        <span className="text-gray-400">Total P/L, USD: <span className={`font-mono ${totalPL >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
          {hideBalance ? '****' : <>{totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}</>}
        </span></span>

        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={openPositions.length === 0}
          className={`px-3 mr-20 py-1 rounded text-sm flex items-center gap-2 transition-colors ${openPositions.length === 0
            ? 'bg-background text-[#565c66] cursor-not-allowed'
            : 'bg-background hover:bg-[#363c45] text-gray-200 cursor-pointer'
            }`}
        >
          Close all
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-end gap-1 ml-2" title="Internet connection is stable">
          <GiNetworkBars size={14} className="text-emerald-500" />
          <span className="text-[10px] text-gray-500 font-mono leading-none mb-0">3.7.3</span>
        </div>
      </div>

      <CloseAllPositionsDropdown
        isOpen={showDropdown}
        onClose={() => setShowDropdown(false)}
        onConfirm={onCloseAll}
        positions={openPositions}
        anchorRef={buttonRef}
      />
    </div>
  )
}