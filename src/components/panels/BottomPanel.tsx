"use client";
import { useState, useRef, Fragment, useCallback } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import Tooltip from '../ui/Tooltip'
import ModifyPositionModal from '../modals/ModifyPositionModal'
import ColumnVisibilityPopup from '../modals/ColumnVisibilityPopup'
import PositionClosedToast from '../ui/PositionClosedToast'
import GroupClosePopup from './GroupClosePopup'
import { useTrading } from '../../context/TradingContext'

export default function BottomPanel({ openPositions = [], pendingPositions = [], closedPositions = [], onClosePosition, onCloseGroup, closedToast, setClosedToast, onCloseAll, onHide, isMinimized = false, onTabChange }: any) {
  const { setModifyModalState, setSymbol } = useTrading()
  const [activeTab, setActiveTab] = useState<'Open' | 'Pending' | 'Closed'>('Open')
  const [isGrouped, setIsGrouped] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [editingPosition, setEditingPosition] = useState<any>(null)
  const [isColumnPopupOpen, setIsColumnPopupOpen] = useState(false)



  const [groupPopup, setGroupPopup] = useState<{ isOpen: boolean, symbol: string | null, position: { top: number, left: number } | null }>({ isOpen: false, symbol: null, position: null })
  const settingsButtonRef = useRef(null)

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    type: true,
    volume: true,
    openPrice: true,
    currentPrice: false,
    closePrice: true, // For closed trades - show by default in Closed tab
    tp: true,
    sl: true,
    ticket: true,
    openTime: true,
    closeTime: true, // For closed trades - show by default in Closed tab
    swap: true,
    commission: true,
    marketCloses: false
  })

  // Initial order matching the default view
  const [columnOrder, setColumnOrder] = useState([
    'type', 'volume', 'openPrice', 'currentPrice', 'closePrice', 'tp', 'sl', 'ticket', 'openTime', 'closeTime', 'swap', 'commission', 'marketCloses'
  ])

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const tabs: ('Open' | 'Pending' | 'Closed')[] = ['Open', 'Pending', 'Closed']



  // Group positions by symbol
  const groupedPositions: any[] = Object.values(openPositions.reduce((acc: any, pos: any) => {
    if (!acc[pos.symbol]) {
      acc[pos.symbol] = {
        ...pos,
        count: 0,
        totalVolume: 0,
        totalBuyVolume: 0,
        totalSellVolume: 0,
        totalPL: 0,
        totalSwap: 0,
        totalCommission: 0,
        positions: []
      }
    }
    acc[pos.symbol].count += 1
    const vol = parseFloat(pos.volume)
    acc[pos.symbol].totalVolume += vol
    if (pos.type === 'Buy') {
      acc[pos.symbol].totalBuyVolume += vol
    } else if (pos.type === 'Sell') {
      acc[pos.symbol].totalSellVolume += vol
    }
    acc[pos.symbol].totalPL += parseFloat(pos.pl.replace('+', ''))
    acc[pos.symbol].totalSwap += parseFloat(pos.swap || 0)
    acc[pos.symbol].totalCommission += parseFloat(pos.commission || 0)
    acc[pos.symbol].positions.push(pos)
    return acc
  }, {})).map((group: any) => {
    // Show "Hedged" only if buy volume equals sell volume (with small epsilon for floating point comparison)
    const volumeDifference = Math.abs(group.totalBuyVolume - group.totalSellVolume);
    const isHedged = group.totalBuyVolume > 0 && group.totalSellVolume > 0 && volumeDifference < 0.0001;
    // Set plColor based on totalPL (green for positive, red for negative)
    const plColor = group.totalPL >= 0 ? 'text-success' : 'text-danger';
    return {
      ...group,
      type: isHedged ? 'Hedged' : group.positions[0].type,
      volume: group.totalVolume.toFixed(2),
      pl: (group.totalPL > 0 ? '+' : '') + group.totalPL.toFixed(2),
      plColor, // Add plColor for grouped positions
      swap: group.totalSwap.toFixed(2),
      commission: group.totalCommission.toFixed(2),
      // Use approximation for open price in group view
      openPrice: group.positions[0].openPrice
    }
  })

  const toggleGroup = (symbol) => {
    setExpandedGroups(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }))
  }



  // Use props for closed positions (no dummy data)

  // Column Definitions
  const columnDefs = {
    type: { label: 'Type', align: 'left' },
    volume: { label: 'Volume', align: 'right' },
    openPrice: { label: 'Open Price', align: 'right' }, // For pending orders, this shows PriceOrder
    currentPrice: { label: 'Current Price', align: 'right' },
    closePrice: { label: 'Close Price', align: 'right' },
    tp: { label: 'Take Profit', align: 'center' },
    sl: { label: 'Stop Loss', align: 'center' },
    ticket: { label: 'Position', align: 'left' },
    openTime: { label: 'Time', align: 'left' },
    closeTime: { label: 'Close Time', align: 'left' },
    swap: { label: 'Swap', align: 'right' },
    commission: { label: 'Commission', align: 'right' },
    marketCloses: { label: 'Market Closes', align: 'left' }
  }

  const renderCell = (colId, position, isGroupedView) => {
    switch (colId) {
      case 'type':
        const isBuy = position.type === 'Buy' || position.type === 'Buy Limit' || position.type === 'Buy Stop'
        const isSell = position.type === 'Sell' || position.type === 'Sell Limit' || position.type === 'Sell Stop'
        const isHedged = position.type === 'Hedged'
        const isLimit = position.type === 'Buy Limit' || position.type === 'Sell Limit'
        const isStop = position.type === 'Buy Stop' || position.type === 'Sell Stop'

        let badgeClass = ''
        if (isBuy) badgeClass = 'bg-success/10 text-success'
        else if (isSell) badgeClass = 'bg-danger/10 text-danger'
        else badgeClass = 'bg-white/10 text-white'

        return (
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1 w-fit ${badgeClass}`}>
            {isHedged ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="6" r="6" fill="#f6465d" />
                <path d="M6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12V0Z" fill="#0099ff" />
              </svg>
            ) : (
              <span className={`w-2 h-2 rounded-full ${isBuy ? 'bg-success' : 'bg-danger'}`}></span>
            )}
            {position.type}
          </span>
        )
      case 'volume':
        return <span className="text-foreground border-b border-dashed border-gray-500">{position.volume}</span>
      case 'openPrice':
        return <span className="text-foreground">{position.openPrice}</span>
      case 'currentPrice':
        return <span className="text-foreground">{position.currentPrice || '-'}</span>
      case 'closePrice':
        return <span className="text-foreground">{position.closePrice || position.currentPrice || '-'}</span>
      case 'tp': {
        if (isGroupedView) {
          return <span className="text-gray-400">...</span>
        }

        // For Closed tab, show plain text
        if (activeTab === 'Closed') {
          return <span className="text-foreground">{position.tp}</span>
        }

        // Check if TP is set (not 'Add', not 0, not empty, not null, not undefined)
        const tpValue = position.tp;
        const hasTP = tpValue && tpValue !== 'Add' && tpValue !== '0' && tpValue !== 0 && Number(tpValue) !== 0;
        // For pending orders and open positions, show "Modify" or "Add" instead of "Not Set"
        const displayTP = hasTP ? tpValue : 'Add';
        return (
          <span
            className="text-gray-400 cursor-pointer hover:text-foreground hover:underline decoration-dashed decoration-1 underline-offset-2"
            onClick={(e) => {
              e.stopPropagation()
              // Use TradingContext modal for both pending orders and open positions
              setModifyModalState({ isOpen: true, position })
            }}
          >
            {displayTP}
          </span>
        )
      }
      case 'sl': {
        if (isGroupedView) {
          return <span className="text-gray-400">...</span>
        }

        // For Closed tab, show plain text
        if (activeTab === 'Closed') {
          return <span className="text-foreground">{position.sl}</span>
        }

        // Check if SL is set (not 'Add', not 0, not empty, not null, not undefined)
        const slValue = position.sl;
        const hasSL = slValue && slValue !== 'Add' && slValue !== '0' && slValue !== 0 && Number(slValue) !== 0;
        // For pending orders and open positions, show "Modify" or "Add" instead of "Not Set"
        const displaySL = hasSL ? slValue : 'Add';
        return (
          <span
            className="text-gray-400 cursor-pointer hover:text-foreground hover:underline decoration-dashed decoration-1 underline-offset-2"
            onClick={(e) => {
              e.stopPropagation()
              // Use TradingContext modal for both pending orders and open positions
              setModifyModalState({ isOpen: true, position })
            }}
          >
            {displaySL}
          </span>
        )
      }
      case 'ticket':
        return <span className="text-foreground">{!isGroupedView ? position.ticket : ''}</span>
      case 'openTime':
        return <span className="text-foreground">{position.openTime || position.time}</span>
      case 'closeTime':
        return <span className="text-foreground">{position.closeTime || '-'}</span>
      case 'swap':
        return <span className="text-foreground">{position.swap || '0'}</span>
      case 'commission':
        return <span className="text-foreground">{position.commission || '0'}</span>
      case 'marketCloses':
        return <span className="text-foreground">-</span>
      default:
        return null
    }
  }

  const handleCloseGroup = (e, symbol) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setGroupPopup({
      isOpen: true,
      symbol,
      position: {
        top: rect.top - 8, // Position above the button with some gap
        left: rect.right - 320 // Align right edge of popup (320px wide) with right edge of button
      }
    })
  }

  const confirmCloseGroup = () => {
    if (groupPopup.symbol) {
      onCloseGroup(groupPopup.symbol)
    }
    setGroupPopup({ isOpen: false, symbol: null, position: null })
  }



  return (
    <div className={`flex flex-col overflow-hidden rounded-md border border-gray-800 ${isMinimized ? 'h-[40px] bg-background border-none' : 'h-full bg-background min-h-0 relative'}`} style={{ fontFamily: "'Manrope', 'Manrope Fallback', sans-serif" }}>
      {/* Header Section */}
      <div className={`flex items-center justify-between px-1 border-b border-gray-800 h-[40px] min-h-[40px] ${isMinimized ? 'bg-background border-t' : 'bg-background'}`}>
        {/* Tabs */}
        {/* Tabs - conditionally render based on isMinimized */}
        <div className="flex items-center h-full">
          {isMinimized ? (
            <div className="px-5 text-[14px] font-medium text-foreground flex items-center gap-2">
              <span>Open Positions</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-[3px] leading-none bg-primary text-white">
                {openPositions.length}
              </span>
            </div>
          ) : (
            tabs.map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  if (onTabChange) onTabChange(tab)
                }}
                className={`relative h-full px-5 text-[14px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${activeTab === tab
                  ? 'text-foreground after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-foreground'
                  : 'text-gray-400 hover:text-foreground'
                  }`}
              >
                {tab}
                {tab === 'Open' && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-[3px] leading-none bg-primary text-white`}>{openPositions.length}</span>
                )}
                {tab === 'Pending' && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-[3px] leading-none bg-primary text-white`}>{pendingPositions.length}</span>
                )}
                {tab === 'Closed' && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-[3px] leading-none bg-primary text-white`}>{closedPositions.length}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {!isMinimized && (
            <>
              {/* Group/Ungroup Toggle */}
              <div className="flex items-center border border-gray-800 rounded p-[2px] mr-2">
                <Tooltip text="Group positions">
                  <button
                    onClick={() => setIsGrouped(true)}
                    className={`p-1 rounded cursor-pointer transition-colors ${isGrouped ? 'bg-gray-800 text-foreground' : 'text-gray-400 hover:text-foreground'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7L3 12l9 5 9-5-9-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17l-9-5 9-5 9 5-9 5z" />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip text="Ungroup positions">
                  <button
                    onClick={() => setIsGrouped(false)}
                    className={`p-1 rounded cursor-pointer transition-colors ${!isGrouped ? 'bg-gray-800 text-foreground' : 'text-gray-400 hover:text-foreground'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </button>
                </Tooltip>
              </div>

              <div ref={settingsButtonRef}>
                <IconButton
                  tooltip="Settings"
                  onClick={() => setIsColumnPopupOpen(!isColumnPopupOpen)}
                  className={isColumnPopupOpen ? 'text-foreground' : ''}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </IconButton>
              </div>
            </>
          )}
          <IconButton tooltip={isMinimized ? "Show panel" : "Hide panel"} onClick={onHide}>
            {isMinimized ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </IconButton>
        </div>
      </div>

      {/* Table */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-auto bg-background min-h-0">
            <table className="w-full text-[12px] border-collapse min-w-max">
              <thead className="sticky top-0 bg-background z-40">
                <tr className="text-[11px] text-gray-400 border-b border-gray-800">
                  {/* Symbol is fixed */}
                  <th className="px-3 py-[3px] text-left font-normal whitespace-nowrap bg-background z-50 sticky left-0">Symbol</th>

                  {/* Dynamic Columns */}
                  {columnOrder.map(colId => {
                    // Hide swap, commission, and ticket (Position) columns for Pending and Closed tab
                    if ((activeTab === 'Pending' || activeTab === 'Closed') && (colId === 'swap' || colId === 'commission' || colId === 'ticket')) {
                      return null;
                    }
                    // Hide openTime and closeTime for non-Closed tabs (we handle openTime specifically below for Open tab if needed, but here we follow request)
                    // Actually, for Closed tab we NEED openTime and closeTime.
                    // For Open tab, we NEED openTime.
                    if (activeTab !== 'Closed' && colId === 'closeTime') {
                      return null;
                    }

                    // Show closePrice only in Closed tab, hide currentPrice in Closed tab
                    if (activeTab === 'Closed') {
                      if (colId === 'currentPrice') return null; // Hide currentPrice in Closed tab
                      if (colId === 'closePrice' && !visibleColumns[colId]) return null; // Show closePrice if visible
                    } else {
                      if (colId === 'closePrice') return null; // Hide closePrice in Open/Pending tabs
                    }
                    // For Pending tab, show currentPrice even if it's set to false in visibleColumns
                    const shouldShow = activeTab === 'Pending' && colId === 'currentPrice'
                      ? true
                      : visibleColumns[colId];
                    return shouldShow && (
                      <th key={colId} className={`px-3 py-[3px] font-normal whitespace-nowrap text-${columnDefs[colId].align}`}>
                        {activeTab === 'Pending' && colId === 'openPrice' ? 'Order Price' :
                          (activeTab === 'Closed' && colId === 'openTime' ? 'Open Time' : columnDefs[colId].label)}
                      </th>
                    );
                  })}

                  {/* Sticky Columns Header - Hide P/L for Pending tab */}
                  {activeTab !== 'Pending' && (
                    <th className="px-3 py-[3px] text-right font-normal whitespace-nowrap sticky right-[90px] bg-background z-50 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-gray-800 w-[120px] min-w-[120px]">P/L</th>
                  )}
                  <th className="px-3 py-[3px] text-center font-normal w-[90px] min-w-[90px] sticky right-0 bg-background z-50 border-b border-gray-800"></th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'Open' && (isGrouped ? groupedPositions : openPositions).map((position, idx) => (
                  <Fragment key={isGrouped ? `group-${position.symbol}` : `pos-${idx}`}>
                    <tr
                      onClick={() => {
                        if (isGrouped) {
                          toggleGroup(position.symbol)
                        } else {
                          setSymbol(position.symbol)
                        }
                      }}
                      className={`border-b border-gray-800 hover:bg-gray-900 group cursor-pointer`}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isGrouped && (
                            <div className={`text-gray-400 transition-transform duration-200 ${expandedGroups[position.symbol] ? '' : '-rotate-90'}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          )}
                          <div className="w-5 h-5 relative">
                            <FlagIcon type={position.flag || 'xauusd'} />
                          </div>
                          <span className="text-foreground font-medium">{position.symbol}</span>
                          {isGrouped && position.count > 1 && (
                            <span className="ml-1 text-[10px] bg-primary text-white px-1 rounded">{position.count}</span>
                          )}
                        </div>
                      </td>

                      {/* Dynamic Columns */}
                      {columnOrder.map(colId => {
                        // Hide swap, commission, and ticket (Position) columns for Pending and Closed tab
                        if (((activeTab as string) === 'Pending' || (activeTab as string) === 'Closed') && (colId === 'swap' || colId === 'commission' || colId === 'ticket')) {
                          return null;
                        }
                        // Hide closeTime for non-Closed tabs
                        if ((activeTab as string) !== 'Closed' && colId === 'closeTime') {
                          return null;
                        }

                        // Show closePrice only in Closed tab, hide currentPrice in Closed tab
                        if ((activeTab as string) === 'Closed') {
                          if (colId === 'currentPrice') return null; // Hide currentPrice in Closed tab
                          if (colId === 'closePrice' && !visibleColumns[colId]) return null; // Show closePrice if visible
                        } else {
                          if (colId === 'closePrice') return null; // Hide closePrice in Open/Pending tabs
                        }
                        // For Pending tab, show currentPrice even if it's set to false in visibleColumns
                        const shouldShow = (activeTab as string) === 'Pending' && colId === 'currentPrice'
                          ? true
                          : visibleColumns[colId];
                        return shouldShow && (
                          <td key={colId} className={`px-3 py-1.5 whitespace-nowrap text-${(columnDefs as any)[colId].align}`}>
                            {renderCell(colId, position, isGrouped)}
                          </td>
                        );
                      })}

                      {/* Sticky Columns Data - Hide P/L for Pending tab */}
                      {(activeTab as string) !== 'Pending' && (
                        <td className="px-3 py-1.5 text-right whitespace-nowrap sticky right-[90px] bg-background group-hover:bg-gray-900 z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-gray-800 w-[120px] min-w-[120px]">
                          <span className={`font-medium ${position.plColor}`}>{position.pl}</span>
                        </td>
                      )}
                      <td className="px-3 py-1.5 text-center whitespace-nowrap sticky right-0 bg-background group-hover:bg-gray-900 z-20 border-b border-gray-800">
                        <div className="flex items-center justify-center gap-0.5">
                          {!isGrouped ? (
                            <>
                              <IconButton
                                tooltip="Edit"
                                placement="left"
                                className="text-gray-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModifyModalState({ isOpen: true, position });
                                }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </IconButton>
                              <IconButton
                                tooltip="Close position"
                                placement="left"
                                className="text-gray-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onClosePosition(position)
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </IconButton>
                            </>
                          ) : (
                            <IconButton
                              tooltip="Close all positions"
                              placement="left"
                              className="text-gray-400"
                              onClick={(e) => handleCloseGroup(e, position.symbol)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>


                    {/* Expanded Sub-rows (Transitions) */}
                    {isGrouped && (
                      <tr className="border-b border-gray-800">
                        <td colSpan={100} className="p-0 border-none">
                          <div
                            className="grid transition-[grid-template-rows] duration-[400ms] ease-in-out"
                            style={{ gridTemplateRows: expandedGroups[position.symbol] ? '1fr' : '0fr' }}
                          >
                            <div className="overflow-hidden">
                              <table className="w-full border-collapse">
                                <tbody>
                                  {position.positions.map((subPos, subIdx) => (
                                    <tr
                                      key={`${position.symbol}-${subIdx}`}
                                      className="border-b border-gray-800 hover:bg-gray-900 group/sub cursor-pointer"
                                      onClick={() => setSymbol(subPos.symbol)}
                                    >
                                      <td className="px-3 py-1.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 pl-6">
                                          <div className="w-5 h-5 relative opacity-50">
                                            <FlagIcon type={subPos.flag || 'xauusd'} />
                                          </div>
                                          <span className="text-gray-400 font-medium text-[12px]">{subPos.symbol}</span>
                                        </div>
                                      </td>

                                      {/* Dynamic Columns */}
                                      {columnOrder.map(colId => {
                                        // Hide swap, commission, and ticket (Position) columns for Pending and Closed tab
                                        if (((activeTab as string) === 'Pending' || (activeTab as string) === 'Closed') && (colId === 'swap' || colId === 'commission' || colId === 'ticket')) {
                                          return null;
                                        }
                                        // Hide closeTime for non-Closed tabs
                                        if ((activeTab as string) !== 'Closed' && colId === 'closeTime') {
                                          return null;
                                        }

                                        // Show closePrice only in Closed tab, hide currentPrice in Closed tab
                                        if ((activeTab as string) === 'Closed') {
                                          if (colId === 'currentPrice') return null; // Hide currentPrice in Closed tab
                                          if (colId === 'closePrice' && !visibleColumns[colId]) return null; // Show closePrice if visible
                                        } else {
                                          if (colId === 'closePrice') return null; // Hide closePrice in Open/Pending tabs
                                        }
                                        // For Pending tab, show currentPrice even if it's set to false in visibleColumns
                                        const shouldShow = (activeTab as string) === 'Pending' && colId === 'currentPrice'
                                          ? true
                                          : visibleColumns[colId];
                                        return shouldShow && (
                                          <td key={colId} className={`px-3 py-1.5 whitespace-nowrap text-${(columnDefs as any)[colId].align}`}>
                                            {renderCell(colId, subPos, false)}
                                          </td>
                                        );
                                      })}

                                      {/* Sticky Columns Data - Hide P/L for Pending tab */}
                                      {(activeTab as string) !== 'Pending' && (
                                        <td className="px-3 py-1.5 text-right whitespace-nowrap sticky right-[90px] bg-background group-hover/sub:bg-gray-900 z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-gray-800 w-[120px] min-w-[120px]">
                                          <span className={`font-medium ${subPos.plColor}`}>{subPos.pl}</span>
                                        </td>
                                      )}
                                      <td className="px-3 py-1.5 text-center whitespace-nowrap sticky right-0 bg-background group-hover/sub:bg-gray-900 z-20 border-b border-gray-800">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <IconButton
                                            tooltip="Edit"
                                            placement="left"
                                            className="text-gray-400"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setModifyModalState({ isOpen: true, position: subPos });
                                            }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                          </IconButton>
                                          <IconButton
                                            tooltip="Close position"
                                            placement="left"
                                            className="text-gray-400"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onClosePosition(subPos)
                                            }}
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </IconButton>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {activeTab === 'Closed' && closedPositions.map((position, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-800 hover:bg-gray-900 group cursor-pointer"
                    onClick={() => setSymbol(position.symbol)}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 relative">
                          <FlagIcon type={position.flag || 'xauusd'} />
                        </div>
                        <span className="text-foreground font-medium">{position.symbol}</span>
                      </div>
                    </td>

                    {/* Dynamic Columns */}
                    {columnOrder.map(colId => {
                      // Hide swap, commission, and ticket (Position) columns for Pending and Closed tab
                      if (((activeTab as string) === 'Pending' || (activeTab as string) === 'Closed') && (colId === 'swap' || colId === 'commission' || colId === 'ticket')) {
                        return null;
                      }
                      // Hide closeTime for non-Closed tabs
                      if ((activeTab as string) !== 'Closed' && colId === 'closeTime') {
                        return null;
                      }

                      // Show closePrice only in Closed tab, hide currentPrice in Closed tab
                      if ((activeTab as string) === 'Closed') {
                        if (colId === 'currentPrice') return null; // Hide currentPrice in Closed tab
                        if (colId === 'closePrice' && !visibleColumns[colId]) return null; // Show closePrice if visible
                      } else {
                        if (colId === 'closePrice') return null; // Hide closePrice in Open/Pending tabs
                      }
                      // For Pending tab, show currentPrice even if it's set to false in visibleColumns
                      const shouldShow = (activeTab as string) === 'Pending' && colId === 'currentPrice'
                        ? true
                        : visibleColumns[colId];
                      return shouldShow && (
                        <td key={colId} className={`px-3 py-1.5 whitespace-nowrap text-${(columnDefs as any)[colId].align}`}>
                          {renderCell(colId, position, false)}
                        </td>
                      );
                    })}

                    {/* Sticky Columns Data - Hide P/L for Pending tab */}
                    {(activeTab as string) !== 'Pending' && (
                      <td className="px-3 py-1.5 text-right whitespace-nowrap sticky right-[90px] bg-background group-hover:bg-gray-900 z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-gray-800 w-[120px] min-w-[120px]">
                        <span className={`font-medium ${position.plColor}`}>{position.pl}</span>
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-center whitespace-nowrap sticky right-0 bg-background group-hover:bg-gray-900 z-20 border-b border-gray-800">
                      {/* Empty cell for closed positions */}
                    </td>
                  </tr>
                ))}

                {(activeTab as string) === 'Pending' && (
                  pendingPositions.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-16 text-gray-400">
                        No pending orders
                      </td>
                    </tr>
                  ) : (
                    pendingPositions.map((position, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-800 hover:bg-gray-900 group cursor-pointer"
                        onClick={() => setSymbol(position.symbol)}
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 relative">
                              <FlagIcon type={position.flag || 'xauusd'} />
                            </div>
                            <span className="text-foreground font-medium">{position.symbol}</span>
                          </div>
                        </td>

                        {/* Dynamic Columns */}
                        {columnOrder.map(colId => {
                          // Hide swap, commission, and ticket (Position) columns for Pending and Closed tab
                          if (((activeTab as string) === 'Pending' || (activeTab as string) === 'Closed') && (colId === 'swap' || colId === 'commission' || colId === 'ticket')) {
                            return null;
                          }
                          // Hide closeTime for non-Closed tabs
                          if ((activeTab as string) !== 'Closed' && colId === 'closeTime') {
                            return null;
                          }

                          // Show closePrice only in Closed tab, hide currentPrice in Closed tab
                          if ((activeTab as string) === 'Closed') {
                            if (colId === 'currentPrice') return null; // Hide currentPrice in Closed tab
                            if (colId === 'closePrice' && !visibleColumns[colId]) return null; // Show closePrice if visible
                          } else {
                            if (colId === 'closePrice') return null; // Hide closePrice in Open/Pending tabs
                          }
                          // For Pending tab, show currentPrice even if it's set to false in visibleColumns
                          const shouldShow = (activeTab as string) === 'Pending' && colId === 'currentPrice'
                            ? true
                            : visibleColumns[colId];
                          return shouldShow && (
                            <td key={colId} className={`px-3 py-1.5 whitespace-nowrap text-${(columnDefs as any)[colId].align}`}>
                              {renderCell(colId, position, false)}
                            </td>
                          );
                        })}

                        {/* Sticky Columns Data - Hide P/L for Pending tab */}
                        {(activeTab as string) !== 'Pending' && (
                          <td className="px-3 py-1.5 text-right whitespace-nowrap sticky right-[90px] bg-background group-hover:bg-gray-900 z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-gray-800 w-[120px] min-w-[120px]">
                            <span className={`font-medium ${position.plColor}`}>{position.pl}</span>
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-center whitespace-nowrap sticky right-0 bg-background group-hover:bg-gray-900 z-20 border-b border-gray-800">
                          <div className="flex items-center justify-center gap-0.5">
                            <IconButton
                              tooltip="Edit"
                              placement="left"
                              className="text-gray-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModifyModalState({ isOpen: true, position });
                              }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </IconButton>
                            <IconButton
                              tooltip="Cancel order"
                              placement="left"
                              className="text-gray-400"
                              onClick={(e) => {
                                e.stopPropagation()
                                onClosePosition(position)
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>

          <ModifyPositionModal />
          <ColumnVisibilityPopup
            isOpen={isColumnPopupOpen}
            onClose={() => setIsColumnPopupOpen(false)}
            visibleColumns={visibleColumns}
            toggleColumn={toggleColumn}
            anchorRef={settingsButtonRef}
            columnOrder={columnOrder}
            setColumnOrder={setColumnOrder}
            columns={columnDefs}
          />



          <GroupClosePopup
            isOpen={groupPopup.isOpen}
            onClose={() => setGroupPopup({ ...groupPopup, isOpen: false })}
            onConfirm={confirmCloseGroup}
            position={groupPopup.position}
            symbol={groupPopup.symbol}
          />
        </>
      )}
    </div >
  )
}
