import React from 'react'
import eurusdIcon from '../../assets/eurusd.png'
import btcIcon from '../../assets/btc.png'

// Flag Icon Component - using flagsapi.com
export default function FlagIcon({ type, className = "" }) {
  const baseClass = `relative w-full h-full ${className}`
  const flagUrl = (code) => `https://flagsapi.com/${code}/flat/64.png`

  // Helper for rendering a single flag image
  const FlagImage = ({ code }) => (
    <img 
      src={flagUrl(code)} 
      alt={code} 
      className="w-full h-full object-cover scale-175"
    />
  )

  switch (type) {
    case 'xauusd':
      return (
        <div className={baseClass}>
          {/* Gold Icon (Custom) */}
          <div className="absolute top-0 left-0 w-[70%] h-[70%] rounded-full bg-[#e8d3a3] z-10 flex items-center justify-center overflow-hidden">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="#8b6c42">
               {/* Top Bar */}
               <path d="M8 8h8l-2-6h-5z" />
               {/* Bottom Left Bar */}
               <path d="M3 16h8l-2-6h-5z" />
               {/* Bottom Right Bar */}
               <path d="M13 16h8l-2-6h-5z" />
             </svg>
          </div>
          {/* US Flag */}
          <div className="absolute bottom-0 right-0 w-[70%] h-[70%] rounded-full z-20 overflow-hidden bg-[#141d22] ring-0 ring-[#141d22]">
             <FlagImage code="US" />
          </div>
        </div>
      )
    case 'eurusd':
      return (
        <div className={`${baseClass} overflow-hidden`}>
          <img src={eurusdIcon} alt="EUR/USD" className="w-full h-full object-cover scale-150" />
        </div>
      )
    case 'gbpusd':
      return (
        <div className={baseClass}>
           {/* UK Flag */}
          <div className="absolute top-0 left-0 w-[70%] h-[70%] rounded-full z-10 overflow-hidden bg-[#141d22]">
            <FlagImage code="GB" />
          </div>
          {/* US Flag */}
          <div className="absolute bottom-0 right-0 w-[70%] h-[70%] rounded-full z-20 overflow-hidden bg-[#141d22] ring-0 ring-[#141d22]">
             <FlagImage code="US" />
          </div>
        </div>
      )
    case 'usdjpy':
      return (
        <div className={baseClass}>
          {/* US Flag */}
          <div className="absolute top-0 left-0 w-[70%] h-[70%] rounded-full z-10 overflow-hidden bg-[#141d22]">
            <FlagImage code="US" />
          </div>
          {/* JPY Flag */}
          <div className="absolute bottom-0 right-0 w-[70%] h-[70%] rounded-full z-20 overflow-hidden bg-[#141d22] ring-0 ring-[#141d22]">
            <FlagImage code="JP" />
          </div>
        </div>
      )
    case 'us500':
      return (
        <div className={`${baseClass} rounded-full overflow-hidden`}>
           <FlagImage code="US" />
        </div>
      )
    case 'btc':
      return (
        <div className={`${baseClass} rounded-full overflow-hidden`}>
          <img src={btcIcon} alt="Bitcoin" className="w-full h-full object-cover scale-[1.75]" />
        </div>
      )
    case 'aapl':
      return (
        <div className={`${baseClass} flex items-center justify-center text-gray-300`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.3-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.66-1.6 3.05-2.47 3.05-2.47s.34 2.29-1.5 4.43c-.61.74-1.59 1.37-2.5 1.37-.23 0-2.48-.18-1.53-4.43z" />
          </svg>
        </div>
      )
    case 'ustec':
       return (
        <div className={`${baseClass} rounded-full overflow-hidden`}>
           <FlagImage code="US" />
        </div>
      )
    case 'usoil':
      return (
        <div className={`${baseClass} flex items-center justify-center text-white`}>
           <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
             <path d="M12 2C12 2 5 11 5 16C5 19.866 8.13401 23 12 23C15.866 23 19 19.866 19 16C19 11 12 2 12 2Z" />
           </svg>
        </div>
      )
    default:
      return <div className={`${baseClass} bg-gray-600 rounded-full border border-gray-500`}></div>
  }
}
