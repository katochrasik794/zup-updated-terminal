import { useState, useRef } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import Tooltip from '../ui/Tooltip'
import ModifyPositionModal from '../modals/ModifyPositionModal'
import ColumnVisibilityPopup from '../modals/ColumnVisibilityPopup'
import PositionClosedToast from '../ui/PositionClosedToast'
import GroupClosePopup from './GroupClosePopup'

export default function BottomPanel({ openPositions, onClosePosition, onCloseGroup, closedToast, setClosedToast }) {
  const [activeTab, setActiveTab] = useState('Open')
  const [isGrouped, setIsGrouped] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [editingPosition, setEditingPosition] = useState(null)
  const [isColumnPopupOpen, setIsColumnPopupOpen] = useState(false)

  const [groupPopup, setGroupPopup] = useState({ isOpen: false, symbol: null, position: null })
  const settingsButtonRef = useRef(null)

  const [visibleColumns, setVisibleColumns] = useState({
    type: true,
    volume: true,
    openPrice: true,
    currentPrice: false,
    tp: false,
    sl: false,
    ticket: true,
    openTime: true,
    swap: true,
    commission: true,
    marketCloses: false
  })

  // Initial order matching the default view
  const [columnOrder, setColumnOrder] = useState([
    'type', 'volume', 'openPrice', 'currentPrice', 'tp', 'sl', 'ticket', 'openTime', 'swap', 'commission', 'marketCloses'
  ])

  const toggleColumn = (id) => {
    setVisibleColumns(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const tabs = ['Open', 'Pending', 'Closed']



  // Group positions by symbol
  const groupedPositions = Object.values(openPositions.reduce((acc, pos) => {
    if (!acc[pos.symbol]) {
      acc[pos.symbol] = { 
        ...pos, 
        count: 0,
        totalVolume: 0,
        totalPL: 0,
        totalSwap: 0,
        totalCommission: 0,
        positions: []
      }
    }
    acc[pos.symbol].count += 1
    acc[pos.symbol].totalVolume += parseFloat(pos.volume)
    acc[pos.symbol].totalPL += parseFloat(pos.pl.replace('+', ''))
    acc[pos.symbol].totalSwap += parseFloat(pos.swap || 0)
    acc[pos.symbol].totalCommission += parseFloat(pos.commission || 0)
    acc[pos.symbol].positions.push(pos)
    return acc
  }, {})).map(group => ({
    ...group,
    volume: group.totalVolume.toFixed(2),
    pl: (group.totalPL > 0 ? '+' : '') + group.totalPL.toFixed(2),
    swap: group.totalSwap.toFixed(2),
    commission: group.totalCommission.toFixed(2),
    // Use approximation for open price in group view
    openPrice: group.positions[0].openPrice 
  }))

  const toggleGroup = (symbol) => {
    setExpandedGroups(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }))
  }



  const closedPositions = [
    {
      symbol: 'EUR/USD',
      type: 'Sell',
      volume: '1.00',
      openPrice: '1.05200',
      closePrice: '1.05100',
      tp: '1.05000',
      sl: '1.05500',
      ticket: '87654321',
      time: 'Nov 25, 10:00:00 AM',
      swap: '0',
      commission: '-5.00',
      pl: '+100.00',
      plColor: 'text-[#00ffaa]',
      flag: 'eurusd'
    },
    {
      symbol: 'GBP/USD',
      type: 'Buy',
      volume: '0.50',
      openPrice: '1.26000',
      closePrice: '1.26200',
      tp: '1.26500',
      sl: '1.25500',
      ticket: '87654322',
      time: 'Nov 25, 11:30:00 AM',
      swap: '-1.20',
      commission: '-2.50',
      pl: '+100.00',
      plColor: 'text-[#00ffaa]',
      flag: 'gbpusd'
    },
    {
      symbol: 'USD/JPY',
      type: 'Sell',
      volume: '2.00',
      openPrice: '153.500',
      closePrice: '153.200',
      tp: '153.000',
      sl: '154.000',
      ticket: '87654323',
      time: 'Nov 25, 02:15:00 PM',
      swap: '2.50',
      commission: '-10.00',
      pl: '+600.00',
      plColor: 'text-[#00ffaa]',
      flag: 'usdjpy'
    },
    {
      symbol: 'XAU/USD',
      type: 'Buy',
      volume: '0.10',
      openPrice: '2000.00',
      closePrice: '1995.00',
      tp: '2010.00',
      sl: '1990.00',
      ticket: '87654324',
      time: 'Nov 24, 09:45:00 AM',
      swap: '-0.80',
      commission: '-1.00',
      pl: '-50.00',
      plColor: 'text-[#f6465d]',
      flag: 'xauusd'
    },
    {
      symbol: 'BTC',
      type: 'Sell',
      volume: '0.05',
      openPrice: '37500.00',
      closePrice: '37600.00',
      tp: '37000.00',
      sl: '38000.00',
      ticket: '87654325',
      time: 'Nov 24, 03:20:00 PM',
      swap: '-2.00',
      commission: '-0.50',
      pl: '-500.00',
      plColor: 'text-[#f6465d]',
      flag: 'btc'
    },
    {
      symbol: 'USOIL',
      type: 'Buy',
      volume: '10.00',
      openPrice: '75.00',
      closePrice: '76.50',
      tp: '78.00',
      sl: '74.00',
      ticket: '87654326',
      time: 'Nov 23, 01:00:00 PM',
      swap: '0',
      commission: '-5.00',
      pl: '+1500.00',
      plColor: 'text-[#00ffaa]',
      flag: 'usoil'
    },
    {
      symbol: 'AAPL',
      type: 'Buy',
      volume: '50',
      openPrice: '185.00',
      closePrice: '190.00',
      tp: '200.00',
      sl: '180.00',
      ticket: '87654327',
      time: 'Nov 23, 10:00:00 AM',
      swap: '0',
      commission: '-2.00',
      pl: '+250.00',
      plColor: 'text-[#00ffaa]',
      flag: 'aapl'
    }
  ]

  // Column Definitions
  const columnDefs = {
    type: { label: 'Type', align: 'left' },
    volume: { label: 'Volume', align: 'right' },
    openPrice: { label: 'Open Price', align: 'right' },
    currentPrice: { label: 'Current Price', align: 'right' },
    tp: { label: 'Take Profit', align: 'center' },
    sl: { label: 'Stop Loss', align: 'center' },
    ticket: { label: 'Position', align: 'left' },
    openTime: { label: 'Time', align: 'left' },
    swap: { label: 'Swap', align: 'right' },
    commission: { label: 'Commission', align: 'right' },
    marketCloses: { label: 'Market Closes', align: 'left' }
  }

  const renderCell = (colId, position, isGroupedView) => {
    switch (colId) {
      case 'type':
        return (
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${position.type === 'Buy' ? 'bg-[#0099ff]' : 'bg-[#f6465d]'}`}></div>
            <span className="text-white">{position.type}</span>
          </div>
        )
      case 'volume':
        return <span className="text-white border-b border-dashed border-gray-500">{position.volume}</span>
      case 'openPrice':
        return <span className="text-white">{position.openPrice}</span>
      case 'currentPrice':
        return <span className="text-white">{position.currentPrice || (position.closePrice) || '-'}</span>
      case 'tp':
        return <span className="text-[#8b9096]">{position.tp || 'Add'}</span>
      case 'sl':
        return <span className="text-[#8b9096]">{position.sl || 'Add'}</span>
      case 'ticket':
        return <span className="text-white">{!isGroupedView ? position.ticket : ''}</span>
      case 'openTime':
        return <span className="text-white">{position.openTime || position.time}</span>
      case 'swap':
        return <span className="text-white">{position.swap || '0'}</span>
      case 'commission':
        return <span className="text-white">{position.commission || '0'}</span>
      case 'marketCloses':
        return <span className="text-white">-</span>
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
    <div className="h-full bg-[#141d22] flex flex-col overflow-hidden font-sans rounded-md min-h-0 relative">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1 border-b border-[#2a3038] bg-[#141d22] h-[40px] min-h-[40px]">
        {/* Tabs */}
        <div className="flex items-center h-full">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative h-full px-5 text-[14px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                activeTab === tab
                  ? 'text-white after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-white'
                  : 'text-[#8b9096] hover:text-white'
              }`}
            >
              {tab}
              {tab === 'Open' && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-[3px] leading-none ${
                  activeTab === 'Open' ? 'bg-[#2a3038] text-white' : 'bg-[#2a3038] text-[#8b9096]'
                }`}>{openPositions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Group/Ungroup Toggle */}
          <div className="flex items-center border border-[#2a353e] rounded p-[2px] mr-2">
            <Tooltip text="Group positions">
              <button 
                onClick={() => setIsGrouped(true)}
                className={`p-1 rounded cursor-pointer transition-colors ${isGrouped ? 'bg-[#2a353e] text-white' : 'text-[#8b9096] hover:text-white'}`}
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
                className={`p-1 rounded cursor-pointer transition-colors ${!isGrouped ? 'bg-[#2a353e] text-white' : 'text-[#8b9096] hover:text-white'}`}
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
              className={isColumnPopupOpen ? 'text-white' : ''}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </IconButton>
          </div>
          <IconButton tooltip="Hide panel">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-[#141d22] min-h-0">
        <table className="w-full text-[14px] border-collapse min-w-max">
          <thead className="sticky top-0 bg-[#141d22] z-40">
            <tr className="text-[12px] text-gray-400 border-b border-[#2a3038]">
              {/* Symbol is fixed */}
              <th className="px-4 py-[4px] text-left font-normal whitespace-nowrap">Symbol</th>
              
              {/* Dynamic Columns */}
              {columnOrder.map(colId => visibleColumns[colId] && (
                <th key={colId} className={`px-4 py-[4px] font-normal whitespace-nowrap text-${columnDefs[colId].align}`}>
                  {columnDefs[colId].label}
                </th>
              ))}
              
              {/* Sticky Columns Header */}
              <th className="px-4 text-right font-normal whitespace-nowrap sticky right-[90px] bg-[#141d22] z-50 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-[#2a3038]">P/L</th>
              <th className="px-4 text-center font-normal w-[90px] min-w-[90px] sticky right-0 bg-[#141d22] z-50 border-b border-[#2a3038]"></th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'Open' && (isGrouped ? groupedPositions : openPositions).map((position, idx) => (
              <>
                {/* Main Row (Group or Single) */}
                <tr
                  key={isGrouped ? `group-${position.symbol}` : `pos-${idx}`}
                  onClick={() => isGrouped && toggleGroup(position.symbol)}
                  className={`border-b border-[#2a3038] hover:bg-[#1c252f] group ${isGrouped ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 relative">
                        <FlagIcon type={position.flag || 'xauusd'} />
                      </div>
                      <span className="text-white font-medium">{position.symbol}</span>
                      {isGrouped && position.count > 1 && (
                        <span className="ml-1 text-[12px] bg-[#2a3038] text-[#8b9096] px-1.5 rounded">{position.count}</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Dynamic Columns */}
                  {columnOrder.map(colId => visibleColumns[colId] && (
                    <td key={colId} className={`px-4 py-3 whitespace-nowrap text-${columnDefs[colId].align}`}>
                      {renderCell(colId, position, isGrouped)}
                    </td>
                  ))}
                  
                  {/* Sticky Columns Data */}
                  <td className="px-4 py-3 text-right whitespace-nowrap sticky right-[90px] bg-[#141d22] group-hover:bg-[#1c252f] z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-[#2a3038]">
                    <span className={`font-medium ${position.plColor}`}>{position.pl}</span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-[#141d22] group-hover:bg-[#1c252f] z-20 border-b border-[#2a3038]">
                    <div className="flex items-center justify-center gap-1">
                      {!isGrouped ? (
                        <>
                          <IconButton 
                            tooltip="Edit" 
                            placement="left" 
                            className="text-[#8b9096]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPosition(position);
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </IconButton>
                          <IconButton 
                            tooltip="Close position" 
                            placement="left" 
                            className="text-[#8b9096]"
                            onClick={(e) => {
                              e.stopPropagation()
                              onClosePosition(position)
                            }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </IconButton>
                        </>
                      ) : (
                         <IconButton 
                           tooltip="Close all positions" 
                           placement="left" 
                           className="text-[#8b9096]"
                           onClick={(e) => handleCloseGroup(e, position.symbol)}
                         >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </IconButton>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Sub-rows (only for Grouped view) */}
                {isGrouped && expandedGroups[position.symbol] && position.positions.map((subPos, subIdx) => (
                  <tr
                    key={`sub-${subPos.ticket}`}
                    className="border-b border-[#2a3038] bg-[#141d22] hover:bg-[#1c252f] group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap pl-8"> {/* Indent symbol */}
                      <span className="text-white font-medium">{subPos.symbol}</span>
                    </td>
                    
                    {/* Dynamic Columns */}
                    {columnOrder.map(colId => visibleColumns[colId] && (
                      <td key={colId} className={`px-4 py-3 whitespace-nowrap text-${columnDefs[colId].align}`}>
                        {renderCell(colId, subPos, false)}
                      </td>
                    ))}
                    
                    {/* Sticky Columns Data */}
                    <td className="px-4 py-3 text-right whitespace-nowrap sticky right-[90px] bg-[#141d22] group-hover:bg-[#1c252f] z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-[#2a3038]">
                      <span className={`font-medium ${subPos.plColor}`}>{subPos.pl}</span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-[#141d22] group-hover:bg-[#1c252f] z-20 border-b border-[#2a3038]">
                      <div className="flex items-center justify-center gap-1">
                        <IconButton 
                          tooltip="Edit" 
                          placement="left" 
                          className="text-[#8b9096]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPosition(subPos);
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </IconButton>
                        <IconButton 
                          tooltip="Close position" 
                          placement="left" 
                          className="text-[#8b9096]"
                          onClick={(e) => {
                            e.stopPropagation()
                            onClosePosition(subPos)
                          }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ))}
            {activeTab === 'Closed' && closedPositions.map((position, idx) => (
              <tr
                key={idx}
                className="border-b border-[#2a3038] hover:bg-[#1c252f] group"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 relative">
                      <FlagIcon type={position.flag || 'xauusd'} />
                    </div>
                    <span className="text-white font-medium">{position.symbol}</span>
                  </div>
                </td>
                
                {/* Dynamic Columns */}
                {columnOrder.map(colId => visibleColumns[colId] && (
                  <td key={colId} className={`px-4 py-3 whitespace-nowrap text-${columnDefs[colId].align}`}>
                    {renderCell(colId, position, false)}
                  </td>
                ))}
                
                {/* Sticky Columns Data */}
                <td className="px-4 py-3 text-right whitespace-nowrap sticky right-[60px] bg-[#141d22] group-hover:bg-[#1c252f] z-20 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)] border-b border-[#2a3038]">
                  <span className={`font-medium ${position.plColor}`}>{position.pl}</span>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-[#141d22] group-hover:bg-[#1c252f] z-20 border-b border-[#2a3038]">
                  {/* Empty cell for closed positions */}
                </td>
              </tr>
            ))}

            {activeTab === 'Pending' && (
              <tr>
                <td colSpan="13" className="text-center py-16 text-[#8b9096]">
                  No pending orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModifyPositionModal 
        isOpen={!!editingPosition} 
        onClose={() => setEditingPosition(null)} 
        position={editingPosition} 
      />
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
      
      <PositionClosedToast 
        position={closedToast} 
        onClose={() => setClosedToast(null)} 
      />
      
      <GroupClosePopup
        isOpen={groupPopup.isOpen}
        onClose={() => setGroupPopup({ ...groupPopup, isOpen: false })}
        onConfirm={confirmCloseGroup}
        position={groupPopup.position}
        symbol={groupPopup.symbol}
      />
    </div>
  )
}
