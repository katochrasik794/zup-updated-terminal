import React, { useState } from 'react'
import { FiX } from 'react-icons/fi'
import { useAccount } from '../../context/AccountContext';
import { accountsApi } from '../../lib/api';

export default function DepositPopup({ isOpen, onClose }) {
  const { currentAccountId, currentAccount, refreshBalance } = useAccount();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null

  const handleTopUp = async () => {
    if (!currentAccountId || isLoading) return;

    // If it's a real account, redirect to the CRM deposit page
    if (currentAccount?.accountType === 'Live') {
      window.open('https://dashboard.zuperior.com/deposit', '_blank');
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      const response = await accountsApi.topup(currentAccountId);

      if (response.success) {
        // Use alert instead of CustomEvent to avoid NaN toast hijack
        alert(response.message || 'Account topped up successfully!');

        // Refresh balance
        refreshBalance(currentAccountId);
        // Close on success
        onClose();
      } else {
        throw new Error(response.message || 'Failed to top up');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred during top up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealDeposit = () => {
    window.open('https://dashboard.zuperior.com/deposit', '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xs">
      <div className="bg-background rounded-lg shadow-2xl w-[600px] overflow-hidden border border-gray-700 font-sans">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-foreground">Make a deposit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-foreground transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6">

          {/* Virtual Top Up Column */}
          <div className="flex flex-col h-full p-4 rounded-lg bg-gray-900/50 border border-gray-800">
            <h3 className="text-lg font-bold text-foreground mb-4">Top Up</h3>
            <ul className="space-y-2 mb-8 flex-grow">
              <li className="flex items-center text-gray-300 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full mr-2 flex-shrink-0"></span>
                Virtual money ($10,000)
              </li>
              <li className="flex items-center text-gray-300 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full mr-2 flex-shrink-0"></span>
                Works for all accounts
              </li>
              <li className="flex items-center text-blue-400 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2 flex-shrink-0"></span>
                For testing purposes
              </li>
            </ul>
            <button
              onClick={handleTopUp}
              disabled={isLoading}
              className="w-full py-3 bg-gray-800 hover:bg-[#384652] disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-bold rounded transition-colors text-sm mt-auto"
            >
              {isLoading ? 'Processing...' : 'Top up current account'}
            </button>
          </div>

          {/* Real Deposit Column */}
          <div className="flex flex-col h-full p-4 rounded-lg bg-gray-900/50 border border-gray-800">
            <h3 className="text-lg font-bold text-foreground mb-4">Real Deposit</h3>
            <ul className="space-y-2 mb-8 flex-grow">
              <li className="flex items-center text-gray-300 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full mr-2 flex-shrink-0"></span>
                Full access to the terminal
              </li>
              <li className="flex items-center text-green-400 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2 flex-shrink-0"></span>
                Instant, automated withdrawals
              </li>
            </ul>
            <button
              onClick={handleRealDeposit}
              className="w-full py-3 bg-primary hover:bg-[#e6cf00] text-black font-bold rounded transition-colors text-sm mt-auto"
            >
              Deposit on real account
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
