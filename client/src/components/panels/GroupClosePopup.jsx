import { useEffect, useRef } from 'react'

export default function GroupClosePopup({ isOpen, onClose, onConfirm, position, symbol }) {
  const popupRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
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
      className="fixed z-[100] bg-[#2a3038] border border-[#363c47] rounded-lg shadow-xl p-4 flex flex-col gap-4 w-[320px]"
      style={{ 
        top: position.top, 
        left: position.left,
        transform: 'translateY(-100%)' // Move up by its own height
      }}
    >
      <div className="text-white text-[14px] font-medium leading-tight">
        Close all {symbol} positions at the market price?
      </div>
      
      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 py-2 text-[14px] font-medium text-[#b2b5be] bg-[#363c47] hover:bg-[#404652] rounded transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 text-[14px] font-medium text-[#141d22] bg-[#b2b5be] hover:bg-white rounded transition-colors cursor-pointer"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
