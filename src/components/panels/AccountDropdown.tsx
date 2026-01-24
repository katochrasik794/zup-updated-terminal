"use client";

import React, { useState, useMemo } from 'react'
import { FiChevronRight, FiHelpCircle } from 'react-icons/fi'
import { usePrivacy } from '../../context/PrivacyContext';
import { useAccount } from '../../context/AccountContext';
import { formatCurrency } from '../../lib/utils';

export default function AccountDropdown({ isOpen, onClose }) {
  const { hideBalance, toggleHideBalance } = usePrivacy();
  const { 
    mt5Accounts, 
    currentAccountId, 
    setCurrentAccountId, 
    balances, 
    isBalanceLoading 
  } = useAccount();

  // Get current account balance data
  const currentBalanceData = useMemo(() => {
    if (!currentAccountId) return null
    return balances[currentAccountId] || null
  }, [currentAccountId, balances])

  const handleAccountSelect = (accountId: string) => {
    setCurrentAccountId(accountId)
    onClose()
  }

  const handleManageAccounts = () => {
    window.location.href = 'https://dashboard.zuperior.com'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[340px] bg-[#0b0e14] border border-gray-800 rounded-lg shadow-2xl z-[100] overflow-hidden font-sans">

        {/* Header - Hide Balance */}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-gray-300 text-[13px]">Hide balance</span>
          <button
            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${hideBalance ? 'bg-white' : 'bg-gray-800'}`}
            onClick={toggleHideBalance}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full transition-transform ${hideBalance ? 'left-5 bg-black' : 'left-1 bg-white'}`}></div>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="px-4 pb-4 space-y-2 border-b border-gray-800">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Balance</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${formatCurrency(currentBalanceData.balance, 2)} USD`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 USD'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Equity</span>
            <div className="flex items-center gap-2">
              <span className="text-[#00ffaa]">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${formatCurrency(currentBalanceData.equity, 2)} USD`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 USD'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Margin</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${formatCurrency(currentBalanceData.margin, 2)} USD`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 USD'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Free margin</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${formatCurrency(currentBalanceData.freeMargin, 2)} USD`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 USD'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Margin level</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${(currentBalanceData.marginLevel || 0).toFixed(2)} %`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 %'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Account leverage</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {currentBalanceData 
                  ? currentBalanceData.leverage || '1:200'
                  : isBalanceLoading[currentAccountId || '']
                    ? 'Loading...'
                    : '1:200'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-gray-400">Credit</span>
            <div className="flex items-center gap-2">
              <span className="text-white">
                {hideBalance 
                  ? '***' 
                  : currentBalanceData 
                    ? `${formatCurrency(currentBalanceData.credit, 2)} USD`
                    : isBalanceLoading[currentAccountId || '']
                      ? 'Loading...'
                      : '0.00 USD'
                }
              </span>
              <FiHelpCircle className="text-gray-600" size={14} />
            </div>
          </div>

          <button className="w-full py-2.5 mt-2 border border-gray-800 hover:bg-gray-800 text-white rounded text-[13px] font-medium transition-colors cursor-pointer uppercase">
            Top Up
          </button>
        </div>

        {/* Account Selection */}
        <div className="p-4 border-b border-gray-800">
          <div className="text-gray-500 text-[13px] mb-3">
            Choose an account
          </div>
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {mt5Accounts.length === 0 ? (
              <div className="text-gray-400 text-[13px] text-center py-4">
                {isLoading ? 'Loading accounts...' : 'No accounts found'}
              </div>
            ) : (
              mt5Accounts.map(account => {
                const isSelected = currentAccountId === account.accountId
                const accountBalance = balances[account.accountId]
                const accountEquity = accountBalance?.equity || 0
                const isLoadingBalance = isBalanceLoading[account.accountId]

                return (
                  <div
                    key={account.id}
                    onClick={() => handleAccountSelect(account.accountId)}
                    className={`relative p-3 rounded-md cursor-pointer transition-colors border ${isSelected
                      ? 'bg-[#1e1b2e] border-[#5a4d9e]' // Purple tint background and border for selected
                      : 'bg-[#151921] border-transparent hover:bg-[#1c222b]'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-[2px] text-[10px] rounded font-medium ${account.accountType === 'Live' ? 'bg-[#3d2e18] text-[#eab308]' : 'bg-green-900/40 text-green-400'}`}>
                        {account.accountType}
                      </span>
                      <span className="text-gray-400 text-[13px]">{account.displayAccountId}</span>
                    </div>
                    <div className="text-white text-[13px] font-medium">
                      {hideBalance 
                        ? '***' 
                        : isLoadingBalance
                          ? 'Loading...'
                          : `${formatCurrency(accountEquity, 2)} USD`
                      }
                    </div>

                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#8b5cf6]"></div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="py-1">
          <button
            onClick={handleManageAccounts}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-[#151921] hover:text-white transition-colors cursor-pointer group"
          >
            <span className="text-[13px]">Manage Accounts</span>
            <FiChevronRight size={14} className="text-gray-500 group-hover:text-white" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-[#151921] hover:text-white transition-colors cursor-pointer group">
            <span className="text-[13px]">Download Trading Log</span>
            <FiChevronRight size={14} className="text-gray-500 group-hover:text-white" />
          </button>
        </div>
      </div>
    </>
  )
}
