"use client";
import { X } from 'lucide-react'
import { useState } from 'react'

export default function OrderModeModal({ isOpen, onClose, onConfirm, mode }) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!isOpen) return null

  const isRiskCalculator = mode === 'Risk calculator form'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm">
      <div className="bg-background w-[500px] rounded-lg shadow-2xl border border-gray-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-foreground">
            {isRiskCalculator ? 'Risk Calculator mode' : 'One-click trading mode'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-[#c0c0c0] text-[14px] leading-relaxed space-y-4 custom-scrollbar">
          {isRiskCalculator ? (
            <>
              <p>
                Selecting this option activates the Risk Calculator mode for order placement.
              </p>
              <p>
                In this mode, position size is calculated automatically based on the specified Risk and Stop Loss level.
              </p>
              <p>
                By enabling this mode, you understand that your market or pending orders will be submitted by clicking the Confirm button, using volume, calculated based on entered parameters.
              </p>
              <p>
                You agree to accept all risks associated with the use of the order submission mode you have chosen, including, without limitation, the risk of errors, commissions or mistakes made in submitting any order.
              </p>
              <p>To place an order:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Specify preferred Risk value, this is the maximum amount of loss you are willing to tolerate should the order close by Stop Loss</li>
                <li>Enter Stop Loss level at which you are willing to risk the specified amount</li>
                <li>Optionally, specify Take Profit</li>
                <li>Click on Confirm to place the order with specified Stop Loss and Take Profit, and calculated volume</li>
              </ul>
            </>
          ) : (
            <>
              <p>
                Selecting this option activates One-click Trading mode for order placement.
              </p>
              <p>
                By enabling this mode, you understand that your market or limit orders will be submitted by clicking the bid or ask rate button, without any further order confirmation. You agree to accept all risks associated with the use of the order submission mode you have chosen, including, without limitation, the risk of errors, commissions or mistakes made in submitting any order.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dont-show"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="dont-show" className="text-[14px] text-gray-400 cursor-pointer select-none">
              Don't show again
            </label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-foreground text-[14px] font-medium rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(dontShowAgain)}
              className="px-4 py-2 bg-primary hover:bg-[#7c3aed] text-white text-[14px] font-bold rounded transition-colors"
            >
              Yes, proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
