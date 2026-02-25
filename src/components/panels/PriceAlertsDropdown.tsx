import React from 'react'
import { FiPlus } from 'react-icons/fi'

export default function PriceAlertsDropdown({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[360px] bg-background border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden font-sans">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-gray-200 text-base font-medium">Price alerts</span>
          <button
            className="text-gray-400 hover:text-foreground transition-colors cursor-pointer"
            title="Add alert"
          >
            <FiPlus size={20} />
          </button>
        </div>

        {/* Content - Empty State */}
        <div className="p-8 flex flex-col items-center justify-center text-center h-[300px]">
          <p className="text-gray-400 mb-6 text-sm">
            Get notified instantly about price movements
          </p>

          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-[#384652] text-foreground rounded text-sm font-medium transition-colors cursor-pointer">
            <FiPlus size={16} />
            New alert
          </button>
        </div>
      </div>
    </>
  )
}
