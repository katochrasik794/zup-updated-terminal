"use client";
import { useEffect, useRef } from 'react'

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  useAbsolutePosition = false,
  width = 'w-[400px]'
}) {
  const modalRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={`${useAbsolutePosition ? 'absolute' : 'fixed'} inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in duration-200`}>
      <div
        ref={modalRef}
        className={`bg-background rounded-lg shadow-2xl ${width} border border-gray-800 overflow-hidden transform transition-all scale-100`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-foreground font-medium text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-foreground transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-300 text-[14px] leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-background flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-gray-300 hover:text-foreground transition-colors rounded hover:bg-gray-700"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="px-4 py-2 text-[13px] font-medium text-foreground bg-[#2962ff] hover:bg-[#1e4bd1] transition-colors rounded shadow-lg shadow-blue-900/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
