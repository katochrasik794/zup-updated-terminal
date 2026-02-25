"use client";
import { useEffect, useRef } from 'react'

export default function GroupClosePopup({ isOpen, onClose, onConfirm, position, symbol }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, position: { top: number, left: number } | null, symbol: string | null }) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current && !popupRef.current.contains(target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen || !position) return null

  return (
    <div
      ref={popupRef}
      className="fixed z-[100] bg-background border border-gray-800 rounded-lg shadow-xl p-4 flex flex-col gap-4 w-[320px]"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)' // Move up by its own height
      }}
    >
      <div className="text-foreground text-[14px] font-medium leading-tight">
        Close all {symbol} positions at the market price?
      </div>

      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 py-2 text-[14px] font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 text-[14px] font-medium text-black bg-primary hover:bg-[#7c3aed] rounded transition-colors cursor-pointer"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
