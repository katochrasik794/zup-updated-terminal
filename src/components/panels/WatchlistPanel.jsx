import { useState, useRef } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import WatchlistSettingsPopup from './WatchlistSettingsPopup'

export default function WatchlistPanel({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWatchlist, setSelectedWatchlist] = useState('favorites')
  const [showSettings, setShowSettings] = useState(false)
  const [showPriceHighlight, setShowPriceHighlight] = useState(false)
  const [columns, setColumns] = useState([
    { id: 'signal', label: 'Signal', visible: true, draggable: true },
    { id: 'description', label: 'Description', visible: false, draggable: true },
    { id: 'bid', label: 'Bid', visible: true, draggable: true },
    { id: 'spread', label: 'Spread', visible: true, draggable: true },
    { id: 'ask', label: 'Ask', visible: true, draggable: true },
    { id: 'change', label: '1D change', visible: true, draggable: true },
    { id: 'chart', label: 'Show chart', visible: true, draggable: false },
    { id: 'pl', label: 'P/L', visible: true, draggable: true },
  ])

  const isVisible = (id) => columns.find(c => c.id === id)?.visible

  const toggleColumn = (id) => {
    setColumns(columns.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ))
  }
  
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  const initialInstruments = [
    {
      symbol: 'BTC',
      name: 'Bitcoin vs US Dollar',
      bid: '91,419.25',
      ask: '91,419.25',
      change: '+0.10%',
      changeColor: 'green',
      signal: 'up',
      pl: '-',
      favorite: true,
      flag: 'btc',
      chartData: [91200, 91300, 91250, 91350, 91321, 91419]
    },
    {
      symbol: 'XAU/USD',
      name: 'Gold vs US Dollar',
      bid: '4,185.245',
      ask: '4,185.245',
      change: '+0.52%',
      changeColor: 'green',
      signal: 'up',
      pl: '+81.80',
      favorite: true,
      flag: 'xauusd',
      chartData: [4160, 4170, 4175, 4180, 4184, 4185]
    },
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      bid: '278.17',
      ask: '278.22',
      change: '-',
      changeColor: 'gray',
      signal: 'down',
      pl: '-',
      favorite: true,
      flag: 'aapl',
      marketClosed: false,
      chartData: []
    },
    {
      symbol: 'EUR/USD',
      name: 'Euro vs US Dollar',
      bid: '1.15844',
      ask: '1.15847',
      change: '-0.13%',
      changeColor: 'red',
      signal: 'up',
      pl: '-',
      favorite: true,
      flag: 'eurusd',
      chartData: [1.1600, 1.1590, 1.1595, 1.1580, 1.1584]
    },
    {
      symbol: 'GBP/USD',
      name: 'Great Britain Pound vs US Dollar',
      bid: '1.32197',
      ask: '1.32197',
      change: '-0.15%',
      changeColor: 'red',
      signal: 'up',
      pl: '-',
      favorite: true,
      flag: 'gbpusd',
      chartData: [1.3240, 1.3230, 1.3235, 1.3220, 1.3219]
    },
    {
      symbol: 'USD/JPY',
      name: 'US Dollar vs Japanese Yen',
      bid: '156.388',
      ask: '156.390',
      change: '+0.06%',
      changeColor: 'green',
      signal: 'down',
      pl: '-',
      favorite: true,
      flag: 'usdjpy',
      chartData: [156.20, 156.30, 156.25, 156.35, 156.38]
    },
    {
      symbol: 'USTEC',
      name: 'US Tech 100 Index',
      bid: '25,319.41',
      ask: '25,319.41',
      change: '+0.07%',
      changeColor: 'green',
      signal: null,
      pl: '-',
      favorite: true,
      flag: 'ustec',
      chartData: [25200, 25250, 25280, 25300, 25319]
    },
    {
      symbol: 'USOIL',
      name: 'Crude Oil',
      bid: '58.964',
      ask: '58.964',
      change: '+0.13%',
      changeColor: 'green',
      signal: 'up',
      pl: '-',
      favorite: true,
      flag: 'usoil',
      chartData: [58.80, 58.90, 58.85, 58.95, 58.96]
    }
  ]

  const [items, setItems] = useState(initialInstruments)

  const handleDragStart = (e, position) => {
    dragItem.current = position
    e.dataTransfer.effectAllowed = 'move'
    e.target.classList.add('opacity-50')
  }

  const handleDragEnter = (e, position) => {
    dragOverItem.current = position
    e.preventDefault()
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50')
    const copyListItems = [...items]
    const dragItemContent = copyListItems[dragItem.current]
    copyListItems.splice(dragItem.current, 1)
    copyListItems.splice(dragOverItem.current, 0, dragItemContent)
    dragItem.current = null
    dragOverItem.current = null
    setItems(copyListItems)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const filteredInstruments = items.filter(item =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Helper to draw a simple SVG path from data
  const getChartPath = (data, width, height, color) => {
    if (!data || data.length === 0) return ''
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    
    // Points for the line
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${height} ${points} L${width},${height} Z`} fill={`url(#gradient-${color.replace('#', '')})`} />
        <path d={`M${points}`} fill="none" stroke={color} strokeWidth="1" />
      </svg>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#141d22] text-[#b2b5be] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-1 flex-shrink-0 min-h-[40px]">
        <h2 className="text-[12px] font-medium text-[#b2b5be] uppercase tracking-wide">Instruments</h2>
        <div className="flex items-center gap-1">
          <div className="relative">
            <IconButton tooltip="Menu" onClick={() => setShowSettings(!showSettings)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </IconButton>
            {showSettings && (
              <WatchlistSettingsPopup
                columns={columns}
                onToggleColumn={toggleColumn}
                showPriceHighlight={showPriceHighlight}
                onTogglePriceHighlight={() => setShowPriceHighlight(!showPriceHighlight)}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
          <IconButton onClick={onClose} tooltip="Hide panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="p-2 space-y-2 flex-shrink-0">
        <div className="relative w-[95%] mx-auto">
          <div className="items-center absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6e757c]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-2 py-[9px] bg-[#141d22] border border-gray-600 rounded text-sm text-white placeholder-[#6e757c] focus:outline-none focus:border-[#2962ff]"
          />
        </div>
        
        <div className="relative w-[95%] mx-auto">
          <select
            value={selectedWatchlist}
            onChange={(e) => setSelectedWatchlist(e.target.value)}
            className="w-full px-3 py-[9px] bg-[#141d22] border border-gray-600 rounded text-sm text-white appearance-none focus:outline-none focus:border-[#2962ff] cursor-pointer"
          >
            <option value="favorites">Favorites</option>
            <option value="forex">Forex</option>
            <option value="crypto">Crypto</option>
            <option value="indices">Indices</option>
          </select>
          <div className="absolute right-5 top-1/2 transform -translate-y-1/2 text-[#6e757c] pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0 px-[14px] pb-5">
        <div className="h-full overflow-auto custom-scrollbar">
          <table className="w-full min-w-[500px] text-[13px] border-collapse">
            <thead className="sticky top-0 bg-[#141d22] z-20">
              <tr className="text-[#6e757c] border-b border-gray-600 h-[32px]">
                <th className="px text-gray-400 py-2 text-left font-medium w-[182px] sticky left-0 bg-[#141d22] z-30">Symbol</th>
                {isVisible('signal') && <th className="px-1 text-gray-400 py-2 text-center font-medium w-[50px]">Signal</th>}
                {isVisible('bid') && <th className="px-1 text-gray-400 py-2 text-left font-medium w-[70px]">Bid</th>}
                {isVisible('spread') && <th className="px-1 text-gray-400 py-2 text-center font-medium w-[60px]">Spread</th>}
                {isVisible('ask') && <th className="px-1 text-gray-400 py-2 text-left font-medium w-[70px]">Ask</th>}
                {isVisible('change') && <th className="px-1 text-gray-400 py-2 text-left text-[10px] font-medium w-[120px]">1D change</th>}
                {isVisible('pl') && <th className="px-1 text-gray-400 py-2 text-left text-[10px] font-medium w-[90px]">P/L, USD</th>}
                <th className="px-1 text-gray-400 py-2 text-center font-normal w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInstruments.map((item, idx) => (
                <tr
                  key={`${item.symbol}-${idx}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  className="border-b border-gray-600 hover:bg-[#1c252f] cursor-pointer group transition-colors py-0 h-[32px]"
                >
                  {/* Symbol */}
                  <td className="px-1 sticky left-0 bg-[#141d22] group-hover:bg-[#1c252f] z-10 border-r border-gray-600">
                    <div className="flex items-center gap-4">
                      <div className="text-gray-500 cursor-grab active:cursor-grabbing">
                        <svg width="9" height="14" viewBox="0 0 10 14" fill="currentColor">
                           <circle cx="2" cy="2" r="1.5" />
                           <circle cx="2" cy="7" r="1.5" />
                           <circle cx="2" cy="12" r="1.5" />
                           <circle cx="8" cy="2" r="1.5" />
                           <circle cx="8" cy="7" r="1.5" />
                           <circle cx="8" cy="12" r="1.5" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 overflow-hidden rounded-sm flex-shrink-0">
                           <FlagIcon type={item.flag} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-medium text-[14px] leading-none">{item.symbol}</span>
                          {isVisible('description') && (
                            <span className="text-[#8d929b] text-[11px] mt-0.5 truncate max-w-[120px]">{item.name}</span>
                          )}
                          {!isVisible('description') && item.marketClosed && (
                            <span className="text-[#ef5350] text-[10px] mt-0.5 flex items-center gap-0.5">
                               <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                 <circle cx="12" cy="12" r="10" />
                                 <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                               </svg>
                            </span>
                          )}
                          {isVisible('description') && item.marketClosed && (
                             <span className="text-[#ef5350] text-[10px] mt-0.5 flex items-center gap-0.5">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                Market closed
                             </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Signal */}
                  {/* Signal */}
                  {isVisible('signal') && (
                    <td className="px-1 text-center">
                      {item.signal === 'up' && (
                        <button className="w-5 h-5 bg-[#2ebd85] rounded-xs flex items-center justify-center mx-1 transition-colors cursor-pointer">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                          </svg>
                        </button>
                      )}
                      {item.signal === 'down' && (
                        <button className="w-5 h-5 bg-[#f6465d] rounded-xs flex items-center justify-center mx-1 transition-colors cursor-pointer">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <polyline points="19 12 12 19 5 12" />
                          </svg>
                        </button>
                      )}
                      {!item.signal && <span className="text-[#6e757c]">-</span>}
                    </td>
                  )}
                  
                  {/* Bid */}
                  {/* Bid */}
                  {isVisible('bid') && (
                    <td className="px-1 text-left">
                      <span className={`font-mono text-[13px] px-1  rounded-sm ${
                        showPriceHighlight && (item.symbol === 'EUR/USD' || item.symbol === 'GBP/USD')
                          ? 'bg-[#2e4c48] text-white' 
                          : showPriceHighlight && item.symbol === 'USD/JPY' 
                            ? 'bg-[#3b2528] text-white' 
                            : 'text-white'
                      }`}>
                        {item.bid}
                      </span>
                    </td>
                  )}

                  {/* Spread */}
                  {isVisible('spread') && (
                    <td className="px-1 text-center">
                      <span className="font-mono text-[11px] text-[#8d929b] bg-[#2a303c] px-1 rounded-sm">12</span>
                    </td>
                  )}
                  
                  {/* Ask */}
                  {/* Ask */}
                  {isVisible('ask') && (
                    <td className="px-1 text-right">
                      <span className={`font-mono text-[13px] px-1 rounded-sm ${
                        showPriceHighlight && (item.symbol === 'EUR/USD' || item.symbol === 'GBP/USD')
                          ? 'bg-[#2e4c48] text-white' 
                          : showPriceHighlight && item.symbol === 'USD/JPY' 
                            ? 'bg-[#3b2528] text-white' 
                            : 'text-white'
                      }`}>
                        {item.ask}
                      </span>
                    </td>
                  )}
                  
                  {/* 1D Change */}
                  {/* 1D Change */}
                  {isVisible('change') && (
                    <td className="px-1 text-center">
                      <div className="flex flex-col items-center w-full">
                        <div className={`flex items-center gap-1 font-mono text-[11px] ${item.changeColor === 'red' ? 'text-[#f6465d]' : item.changeColor === 'green' ? 'text-[#2ebd85]' : 'text-[#6e757c]'}`}>
                          {item.change !== '-' && (
                             <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                               {item.changeColor === 'green' ? (
                                 <>
                                   <line x1="12" y1="19" x2="12" y2="5" />
                                   <polyline points="5 12 12 5 19 12" />
                                 </>
                               ) : (
                                 <>
                                   <line x1="12" y1="5" x2="12" y2="19" />
                                   <polyline points="19 12 12 19 5 12" />
                                 </>
                               )}
                             </svg>
                          )}
                          {item.change}
                        </div>
                        {isVisible('chart') && (
                          <div className="w-full h-[15px] mt-0.5">
                            {item.change !== '-' && getChartPath(item.chartData, 50, 15, item.changeColor === 'green' ? '#2ebd85' : '#f6465d')}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* P/L */}
                  {/* P/L */}
                  {isVisible('pl') && (
                    <td className="px-1 text-right">
                      <span className={`font-mono text-[13px] ${item.pl.startsWith('+') ? 'text-[#2ebd85]' : 'text-[#6e757c]'}`}>
                        {item.pl}
                      </span>
                    </td>
                  )}
                  
                  {/* Favorite */}
                  <td className="px-1 text-center">
                    {item.favorite && (
                      <button className="text-[#fcd535] hover:text-[#ffe54f] cursor-pointer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
