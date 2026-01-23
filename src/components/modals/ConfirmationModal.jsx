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
    <div className={`${useAbsolutePosition ? 'absolute' : 'fixed'} inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200`}>
      <div 
        ref={modalRef}
        className={`bg-[#2a3038] rounded-lg shadow-2xl ${width} border border-[#363c47] overflow-hidden transform transition-all scale-100`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#363c47] flex items-center justify-between">
          <h3 className="text-white font-medium text-lg">{title}</h3>
          <button 
            onClick={onClose}
            className="text-[#8b9096] hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[#b2b5be] text-[14px] leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#23282f] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-[#b2b5be] hover:text-white transition-colors rounded hover:bg-[#363c47]"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="px-4 py-2 text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#1e4bd1] transition-colors rounded shadow-lg shadow-blue-900/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
