import { useRef, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import LeftSidebar from '../components/layout/LeftSidebar'
import ChartSection from '../components/layout/ChartSection'
import OrderPanel from '../components/trading/OrderPanel'
import BottomPanel from '../components/panels/BottomPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable'
import { GiNetworkBars } from "react-icons/gi";
import CloseAllPositionsDropdown from "../components/modals/CloseAllPositionsDropdown";

export default function TradingTerminal({ isSidebarExpanded, onSidebarStateChange }) {
  const leftPanelRef = useRef(null)
  const [closedToast, setClosedToast] = useState(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)

  const [openPositions, setOpenPositions] = useState([
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.01',
      openPrice: '4,174.936',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '70439011',
      openTime: 'Nov 28, 1:38:30 PM',
      swap: '0',
      commission: '-0.33',
      pl: '+34.65',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.01',
      openPrice: '4,175.347',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '70438984',
      openTime: 'Nov 28, 1:38:27 PM',
      swap: '0',
      commission: '-0.33',
      pl: '+34.23',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.01',
      openPrice: '4,153.111',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69992609',
      openTime: 'Nov 26, 12:52:01 PM',
      swap: '0',
      commission: '-0.33',
      pl: '+56.47',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.01',
      openPrice: '4,160.565',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69975898',
      openTime: 'Nov 26, 11:04:44 AM',
      swap: '0',
      commission: '-0.33',
      pl: '+49.02',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.01',
      openPrice: '4,160.256',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69975877',
      openTime: 'Nov 26, 11:04:32 AM',
      swap: '0',
      commission: '-0.33',
      pl: '+49.32',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'BTC',
      type: 'Buy',
      volume: '0.01',
      openPrice: '91,250.00',
      currentPrice: '91,419.25',
      tp: '95,000.00',
      sl: '89,000.00',
      ticket: '12345679',
      openTime: 'Nov 26, 12:30:15 PM',
      swap: '-0.50',
      commission: '-0.10',
      pl: '+169.25',
      plColor: 'text-[#00ffaa]',
      flag: 'btc'
    }
  ])

  const handleClosePosition = (position) => {
    setClosedToast(position)
    setOpenPositions(prev => prev.filter(p => p.ticket !== position.ticket))
  }

  const handleCloseGroup = (symbol) => {
    setOpenPositions(prev => prev.filter(p => p.symbol !== symbol))
  }

  const handleCloseAll = (option) => {
    setOpenPositions(prev => {
      return prev.filter(pos => {
        const pl = parseFloat(pos.pl.replace('+', ''))
        
        switch (option) {
          case 'all': return false
          case 'profitable': return pl <= 0
          case 'losing': return pl >= 0
          case 'buy': return pos.type !== 'Buy'
          case 'sell': return pos.type !== 'Sell'
          default: return true
        }
      })
    })
  }

  // Resize the left panel when it expands or collapses
  useEffect(() => {
    if (leftPanelRef.current) {
      if (isSidebarExpanded) {
        leftPanelRef.current.resize(23) // 15% ≈ 290px on 1920px screen
      } else {
        leftPanelRef.current.resize(0)
      }
    }
  }, [isSidebarExpanded])

  return (
    <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
      {/* Left sidebar with panels */}
      <ResizablePanel 
        ref={leftPanelRef}
        defaultSize={4}
        minSize={8}
        maxSize={40}
        className={`min-h-0 h-full ${!isSidebarExpanded ? "!min-w-[48px] !max-w-[48px] !flex-none" : ""}`}
        collapsedSize={0}
        collapsible={true}
        onCollapse={() => onSidebarStateChange(false)}
        onExpand={() => onSidebarStateChange(true)}
      >
        <LeftSidebar 
          onPanelStateChange={onSidebarStateChange} 
          isExpanded={isSidebarExpanded}
        />
      </ResizablePanel>
      
      {/* Horizontal resize handle */}
      <ResizableHandle disabled={!isSidebarExpanded} className={!isSidebarExpanded ? "pointer-events-none w-0" : ""} />
      
      {/* Main content area with status bar */}
      <ResizablePanel defaultSize={97} className="flex flex-col h-full gap-1">
        {/* Top content area */}
        <div className="relative flex flex-1 overflow-hidden gap-1">
          {/* Center resizable area with vertical panels */}
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Chart section */}
            <ResizablePanel defaultSize={70} minSize={40} maxSize={85} className="min-h-0 overflow-hidden">
              <ChartSection />
            </ResizablePanel>
            
            {/* Vertical resize handle */}
            <ResizableHandle />
            
            {/* Bottom panel */}
            <ResizablePanel defaultSize={30} minSize={15} maxSize={60} className="min-h-0 overflow-hidden">
              <BottomPanel 
                openPositions={openPositions}
                onClosePosition={handleClosePosition}
                onCloseGroup={handleCloseGroup}
                closedToast={closedToast}
                setClosedToast={setClosedToast}
                onCloseAll={handleCloseAll}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
          
          {/* Right sidebar - Order Panel with full height */}
          {isRightSidebarOpen && (
            <div className="w-[260px] h-full flex-shrink-0 overflow-hidden">
              <OrderPanel onClose={() => setIsRightSidebarOpen(false)} />
            </div>
          )}

          {/* Floating Open Button */}
          {!isRightSidebarOpen && (
             <button 
               onClick={() => setIsRightSidebarOpen(true)}
               className="absolute right-0 top-2 z-50 bg-[#141d22] border border-[#2a2f36] border-r-0 text-gray-400 hover:text-white transition-colors p-1.5 rounded-l-md shadow-lg cursor-pointer"
               title="Open Order Panel"
             >
               <ChevronLeft size={20} />
             </button>
          )}
        </div>
        
        {/* Status bar only for center and right areas */}
        <StatusBar 
          openPositions={openPositions} 
          onCloseAll={handleCloseAll}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

// New StatusBar component definition
export function StatusBar({ openPositions = [], onCloseAll }) {
  const totalPL = openPositions.reduce((sum, pos) => sum + parseFloat(pos.pl.replace('+', '')), 0)
  const [showDropdown, setShowDropdown] = useState(false)
  const buttonRef = useRef(null)

  return (
    <div className="bg-[#141d22] flex items-center justify-between px-4 py-2 text-xs text-gray-400 font-medium rounded-tl-md relative">
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
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={openPositions.length === 0}
          className={`px-3 mr-20 py-1 rounded text-sm flex items-center gap-2 transition-colors ${
            openPositions.length === 0 
              ? 'bg-[#2a3038] text-[#565c66] cursor-not-allowed' 
              : 'bg-[#2a3038] hover:bg-[#363c45] text-gray-200 cursor-pointer'
          }`}
        >
          Close all
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-end gap-1 ml-2" title="Internet connection is stable">
          <GiNetworkBars size={14} className="text-emerald-500" />
          <span className="text-[10px] text-gray-500 font-mono leading-none mb-0">3.7.3</span>
        </div>
      </div>

      <CloseAllPositionsDropdown 
        isOpen={showDropdown}
        onClose={() => setShowDropdown(false)}
        onConfirm={onCloseAll}
        positions={openPositions}
        anchorRef={buttonRef}
      />
    </div>
  )
}