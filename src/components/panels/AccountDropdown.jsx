import React, { useState } from 'react'
import { FiChevronRight, FiHelpCircle, FiCheck } from 'react-icons/fi'

export default function AccountDropdown({ isOpen, onClose }) {
  const [hideBalance, setHideBalance] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState('83067517')

  if (!isOpen) return null

  const accounts = [
    { id: '83067517', type: 'Demo', label: 'Zero', balance: '981.32', currency: 'USD', isReal: false }
  ]

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[360px] bg-[#1a2329] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden font-sans">
        
        {/* Header - Hide Balance */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-gray-200 text-sm font-medium">Hide balance</span>
          <button 
            className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${hideBalance ? 'bg-blue-600' : 'bg-gray-600'}`}
            onClick={() => setHideBalance(!hideBalance)}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${hideBalance ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="p-4 space-y-3 border-b border-gray-700">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Balance</span>
            <span className="text-white font-medium text-right">{hideBalance ? '***' : '978.50 USD'}</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Equity</span>
            <span className="text-white font-medium text-right">{hideBalance ? '***' : '981.47 USD'}</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Margin</span>
            <span className="text-white font-medium text-right">{hideBalance ? '***' : '6.24 USD'}</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Free margin</span>
            <span className="text-white font-medium text-right">{hideBalance ? '***' : '975.23 USD'}</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Margin level</span>
            <span className="text-white font-medium text-right">{hideBalance ? '***' : '15,728.69 %'}</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center text-sm">
            <span className="text-gray-400">Account leverage</span>
            <span className="text-white font-medium text-right">1:2000</span>
            <FiHelpCircle className="text-gray-500" size={14} />
          </div>

          <button className="w-full py-2 mt-4 bg-[#2d3a45] hover:bg-[#384652] text-white rounded text-sm font-medium transition-colors cursor-pointer">
            Top Up
          </button>
        </div>

        {/* Account Selection */}
        <div className="border-b border-gray-700">
          <div className="px-4 py-2 text-gray-400 text-xs font-medium uppercase tracking-wider">
            Choose an account
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {accounts.map(account => (
              <div 
                key={account.id}
                className="px-4 py-3 hover:bg-[#2d3a45] cursor-pointer flex items-center justify-between bg-[#2d3a45]"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-green-900 text-green-400 text-[10px] rounded font-medium uppercase">
                      {account.type}
                    </span>
                    <span className="text-gray-400 text-xs"># {account.id} {account.label}</span>
                  </div>
                  <div className="text-white font-bold">
                    {hideBalance ? '***' : `${account.balance} ${account.currency}`}
                  </div>
                </div>
                {selectedAccount === account.id && (
                  <FiCheck className="text-blue-500" size={18} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div>
          <button className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-[#2d3a45] hover:text-white transition-colors border-b border-gray-700 cursor-pointer">
            <span className="text-sm">Manage Accounts</span>
            <FiChevronRight size={16} />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-[#2d3a45] hover:text-white transition-colors cursor-pointer">
            <span className="text-sm">Download Trading Log</span>
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
