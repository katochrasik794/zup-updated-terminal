"use client";
import { useState } from 'react'
import { LuGripVertical } from 'react-icons/lu'

export default function WatchlistSettingsPopup({ 
  columns, 
  onToggleColumn, 
  showPriceHighlight, 
  onTogglePriceHighlight,
  onClose 
}) {
  return (
    <div className="absolute top-[40px] right-2 z-50 w-[240px] bg-gray-800 rounded shadow-xl border border-gray-800 overflow-hidden">
      <div className="py-2">
        <div className="px-4 py-2 text-[11px] font-medium text-[#8d929b] uppercase tracking-wide">
          Columns
        </div>
        
        <div className="flex flex-col">
          {columns.map((col) => (
            <div 
              key={col.id} 
              className="flex items-center justify-between px-4 py-2 hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {col.draggable ? (
                  <LuGripVertical className="text-[#565c66] cursor-grab" size={16} />
                ) : (
                  <div className="w-4" /> // Spacer for non-draggable items
                )}
                <span className="text-[#e1e3e6] text-[13px]">{col.label}</span>
              </div>
              
              <button
                onClick={() => onToggleColumn(col.id)}
                className={`w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${
                  col.visible ? 'bg-gray-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-foreground w-3 h-3 rounded-full transition-transform duration-200 ease-in-out ${
                    col.visible ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-800 py-2">
        <div className="px-4 py-2 text-[11px] font-medium text-[#8d929b] uppercase tracking-wide">
          Appearance
        </div>
        <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-700 transition-colors">
          <span className="text-[#e1e3e6] text-[13px]">Price highlight</span>
          <button
            onClick={onTogglePriceHighlight}
            className={`w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${
              showPriceHighlight ? 'bg-gray-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-foreground w-3 h-3 rounded-full transition-transform duration-200 ease-in-out ${
                showPriceHighlight ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
