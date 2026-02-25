import React from 'react'
import { FiLayout, FiGlobe, FiUsers } from 'react-icons/fi'

export default function ApplicationsDropdown({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[240px] bg-background border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden font-sans py-2">

        <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-foreground transition-colors">
          <FiLayout size={18} />
          <span className="text-sm font-medium">Personal Area</span>
        </a>

        <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-foreground transition-colors">
          <div className="w-[18px] flex justify-center">
            <span className="text-xs font-bold">ex</span>
          </div>
          <span className="text-sm font-medium">Public website</span>
        </a>

        <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-foreground transition-colors">
          <FiUsers size={18} />
          <span className="text-sm font-medium">Partnership</span>
        </a>

      </div>
    </>
  )
}
