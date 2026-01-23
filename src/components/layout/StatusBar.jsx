import { GiNetworkBars } from "react-icons/gi";

export default function StatusBar({ openPositions = [], onOpenCloseAllModal }) {
  const totalPL = openPositions.reduce((sum, pos) => sum + parseFloat(pos.pl.replace('+', '')), 0)

  return (
    <div className="bg-[#141d22] flex items-center justify-between px-4 py-2 text-xs text-gray-400 font-medium rounded-tl-md">
      {/* Left section - Account info */}
      <div className="flex items-center gap-6">
        <span>Equity: <span className="text-gray-200 font-mono">1,284.14 USD</span></span>
        <span>Free Margin: <span className="text-gray-200 font-mono">1,273.73 USD</span></span>
        <span>Balance: <span className="text-gray-200 font-mono">978.14 USD</span></span>
        <span>Margin: <span className="text-gray-200 font-mono">10.41 USD</span></span>
        <span>Margin level: <span className="text-gray-200 font-mono">12,335.64%</span></span>
      </div>
      
      {/* Right section - P/L, Close all, Connection */}
      <div className="flex items-center gap-4">
        <span>Total P/L, USD: <span className={`font-mono ${totalPL >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
          {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
        </span></span>
        
        <button 
          onClick={onOpenCloseAllModal}
          disabled={openPositions.length === 0}
          className={`px-3 mr-20 py-1 rounded text-sm flex items-center gap-2 transition-colors ${
            openPositions.length === 0 
              ? 'bg-[#2a3038] text-[#565c66] cursor-not-allowed' 
              : 'bg-[#2a3038] hover:bg-[#363c45] text-gray-200 cursor-pointer'
          }`}
        >
          Close all
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-end gap-1 ml-2" title="Internet connection is stable">
          <GiNetworkBars size={14} className="text-emerald-500" />
          <span className="text-[10px] text-gray-500 font-mono leading-none mb-0">3.7.3</span>
        </div>
      </div>
    </div>
  )
}