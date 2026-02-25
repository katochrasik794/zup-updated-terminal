import React from 'react'
import { FiX } from 'react-icons/fi'

export default function DepositPopup({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
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

          {/* Demo Column */}
          <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-foreground mb-4">Demo</h3>
            <ul className="space-y-2 mb-8 flex-grow">
              <li className="flex items-center text-gray-300 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full mr-2 flex-shrink-0"></span>
                Virtual money
              </li>
              <li className="flex items-center text-gray-300 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-foreground rounded-full mr-2 flex-shrink-0"></span>
                Full access to the terminal
              </li>
              <li className="flex items-center text-red-400 text-sm whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2 flex-shrink-0"></span>
                No withdrawals
              </li>
            </ul>
            <button className="w-full py-3 bg-gray-800 hover:bg-[#384652] text-foreground font-bold rounded transition-colors text-sm mt-auto">
              Top up demo account
            </button>
          </div>

          {/* Real Column */}
          <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-foreground mb-4">Real</h3>
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
            <button className="w-full py-3 bg-primary hover:bg-[#e6cf00] text-black font-bold rounded transition-colors text-sm mt-auto">
              Deposit on real account
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
