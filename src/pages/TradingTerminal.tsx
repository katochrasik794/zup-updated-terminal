'use client';

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import LeftSidebar from '../components/layout/LeftSidebar'
import ChartSection from '../components/layout/ChartSection'
import OrderPanel from '../components/trading/OrderPanel'
import BottomPanel from '../components/panels/BottomPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable'
import StatusBar from '../components/layout/StatusBar'

import { useSidebar } from '../context/SidebarContext'

import { ImperativePanelHandle } from 'react-resizable-panels'
import ModifyPositionModal from '../components/modals/ModifyPositionModal'

import { TradingProvider } from '../context/TradingContext'

export default function TradingTerminal() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebar();
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const [closedToast, setClosedToast] = useState(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true)

  const [openPositions, setOpenPositions] = useState([
    // 4 Buy positions for XAU/USD
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '1.00',
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
      volume: '1.00',
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
      volume: '1.00',
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
      volume: '1.00',
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
    // 3 Sell positions for XAU/USD to create Hedged scenario (if 4th sell added later)
    {
      symbol: 'XAU/USD',
      type: 'Sell',
      volume: '1.00',
      openPrice: '4,160.256',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69975877',
      openTime: 'Nov 26, 11:04:32 AM',
      swap: '0',
      commission: '-0.33',
      pl: '-49.32',
      plColor: 'text-[#f6465d]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Sell',
      volume: '1.00',
      openPrice: '4,180.000',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69975878',
      openTime: 'Nov 26, 11:10:00 AM',
      swap: '0',
      commission: '-0.33',
      pl: '+20.00',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    {
      symbol: 'XAU/USD',
      type: 'Sell',
      volume: '1.00',
      openPrice: '4,190.000',
      currentPrice: '4,174.225',
      tp: 'Add',
      sl: 'Add',
      ticket: '69975879',
      openTime: 'Nov 26, 11:15:00 AM',
      swap: '0',
      commission: '-0.33',
      pl: '+55.00',
      plColor: 'text-[#00ffaa]',
      flag: 'xauusd'
    },
    // Remaining positions
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
    <TradingProvider>
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
        {/* Left sidebar with panels */}
        <ResizablePanel
          ref={leftPanelRef}
          defaultSize={20}
          minSize={8}
          maxSize={40}
          className={`min-h-0 h-full ${!isSidebarExpanded ? "!min-w-[48px] !max-w-[48px] !flex-none" : ""}`}
          collapsedSize={0}
          collapsible={true}
          onCollapse={() => setIsSidebarExpanded(false)}
          onExpand={() => setIsSidebarExpanded(true)}
        >
          <LeftSidebar
            onPanelStateChange={setIsSidebarExpanded}
            isExpanded={isSidebarExpanded}
          />
        </ResizablePanel>

        {/* Horizontal resize handle */}
        <ResizableHandle withHandle={false} disabled={!isSidebarExpanded} className={!isSidebarExpanded ? "pointer-events-none w-0" : ""} />

        {/* Main content area with status bar */}
        <ResizablePanel defaultSize={97} className="flex flex-col h-full gap-1">
          {/* Top content area */}
          <div className="relative flex flex-1 overflow-hidden gap-1">
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <ResizablePanelGroup direction="vertical" className="flex-1">
                {/* Chart section */}
                <ResizablePanel defaultSize={70} minSize={40} maxSize={85} className="min-h-0 overflow-hidden">
                  <ChartSection />
                </ResizablePanel>

                {isBottomPanelVisible && (
                  <>
                    {/* Vertical resize handle */}
                    <ResizableHandle withHandle={false} className="" />

                    {/* Bottom panel */}
                    <ResizablePanel defaultSize={30} minSize={15} maxSize={60} className="min-h-0 overflow-hidden">
                      <BottomPanel
                        openPositions={openPositions}
                        onClosePosition={handleClosePosition}
                        onCloseGroup={handleCloseGroup}
                        closedToast={closedToast}
                        setClosedToast={setClosedToast}
                        onCloseAll={handleCloseAll}
                        onHide={() => setIsBottomPanelVisible(false)}
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>

              {/* Minimized Bottom Panel */}
              {!isBottomPanelVisible && (
                <div className="flex-none h-[40px] border-t border-gray-800 bg-black">
                  <BottomPanel
                    openPositions={openPositions}
                    onClosePosition={handleClosePosition}
                    onCloseGroup={handleCloseGroup}
                    closedToast={closedToast}
                    setClosedToast={setClosedToast}
                    onCloseAll={handleCloseAll}
                    isMinimized={true}
                    onHide={() => setIsBottomPanelVisible(true)}
                  />
                </div>
              )}
            </div>

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
                className="absolute right-0 top-2 z-50 bg-background border border-[#2a2f36] border-r-0 text-gray-400 hover:text-white transition-colors p-1.5 rounded-l-md shadow-lg cursor-pointer"
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
          <ModifyPositionModal />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TradingProvider>
  )
}