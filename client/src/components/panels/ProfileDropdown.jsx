import React from 'react'
import { FiUser, FiLogOut } from 'react-icons/fi'

export default function ProfileDropdown({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[260px] bg-[#1a2329] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden font-sans py-2">
        
        {/* Header - User Info */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center text-gray-300">
            <FiUser size={16} />
          </div>
          <span className="text-gray-300 text-sm">r****1@ekuali.com</span>
        </div>

        {/* Menu Items */}
        <div className="py-2 border-b border-gray-700">
          <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-[#2d3a45] hover:text-white transition-colors text-sm font-medium">
            Support
          </a>
          <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-[#2d3a45] hover:text-white transition-colors text-sm font-medium">
            Suggest a feature
          </a>
        </div>

        {/* Footer - Sign Out */}
        <div className="py-2">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-[#2d3a45] hover:text-white transition-colors text-sm font-medium cursor-pointer">
            <FiLogOut size={16} />
            Sign Out
          </button>
        </div>

      </div>
    </>
  )
}
