"use client";

import { useState, useRef } from 'react'
import CloseAllPositionsDropdown from "../modals/CloseAllPositionsDropdown";
import { usePrivacy } from '../../context/PrivacyContext';
import { formatCurrency } from '../../lib/utils';
import { apiClient } from '../../lib/api';
import { useWebSocket } from '../../context/WebSocketContext';

import { useAccount } from '../../context/AccountContext';

export default function StatusBar({ openPositions = [], onCloseAll, totalPL = 0 }: any) {
  const { hideBalance } = usePrivacy();
  const { ping } = useWebSocket();
  const { currentBalance } = useAccount(); // Use centralized account data
  const [showDropdown, setShowDropdown] = useState(false)
  const buttonRef = useRef(null)

  // Removed local polling and state - using currentBalance from AccountContext

  // Map values from context
  const data = currentBalance;
  const equity = data?.equity ?? 0;
  const balance = data?.balance ?? 0;
  const margin = data?.margin ?? 0;
  const marginLevel = data?.marginLevel ?? 0;
  const credit = data?.credit ?? 0;

  // Calculate Free Margin locally (Equity - Margin)
  const freeMargin = Number((equity - margin).toFixed(2));

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
        <span>Credit: <span className="text-gray-200 font-mono">{renderValue(credit)}</span></span>
        <span>Margin: <span className="text-gray-200 font-mono">{renderValue(margin)}</span></span>
        <span>Margin level: <span className="text-gray-200 font-mono">
          {hideBalance ? '****' : `${marginLevel.toFixed(2)}%`}
        </span></span>
      </div>

      {/* Right section - P/L, Close all, Connection */}
      <div className="flex items-center gap-4">
        <span className="text-gray-400">Total P/L, USD: <span className={`font-mono ${totalPL >= 0 ? 'text-success' : 'text-danger'}`}>
          {hideBalance ? '****' : <>{totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}</>}
        </span></span>

        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={openPositions.length === 0}
          className={`px-3 mr-20 py-1 rounded text-sm flex items-center gap-2 transition-colors ${openPositions.length === 0
            ? 'bg-background text-[#565c66] cursor-not-allowed'
            : 'bg-background hover:bg-gray-700 text-gray-200 cursor-pointer'
            }`}
        >
          Close all
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

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
