import { useEffect } from 'react'

export default function PositionClosedToast({ position, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!position) return null

  return (
    <div className="absolute bottom-4 left-4 z-50 bg-[#2a3038] text-[#b2b5be] rounded-md shadow-lg border border-[#363c47] w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 relative">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-[#6e757c] hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-[#2ebd85]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 11 12 14 22 4" />
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-medium text-[14px] leading-tight mb-1">Position closed</h3>
            <p className="text-[13px] text-[#b2b5be] mb-3">
              {position.type} {position.volume} lot {position.symbol} at {position.currentPrice}
            </p>
            
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#b2b5be]">Profit</span>
              <span className="text-[#2ebd85] font-medium font-mono">
                {position.pl} USD
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
