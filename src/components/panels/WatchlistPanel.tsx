"use client";
import { useState, useRef, useEffect, useMemo } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import WatchlistSettingsPopup from './WatchlistSettingsPopup'
import { LuGripVertical } from 'react-icons/lu'
import { FiStar } from 'react-icons/fi'

export default function WatchlistPanel({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Favorites')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPriceHighlight, setShowPriceHighlight] = useState(false)

  // Columns configuration based on "Image 2"
  const [columns, setColumns] = useState([
    { id: 'signal', label: 'Signal', visible: false, draggable: true },
    { id: 'description', label: 'Description', visible: false, draggable: true },
    { id: 'bid', label: 'Bid', visible: true, draggable: true },
    { id: 'spread', label: 'Spread', visible: false, draggable: true },
    { id: 'ask', label: 'Ask', visible: true, draggable: true },
    { id: 'change', label: '1D change', visible: true, draggable: true },
    { id: 'chart', label: 'Show chart', visible: false, draggable: false },
    { id: 'pl', label: 'P/L', visible: false, draggable: true },
  ])

  const isVisible = (id) => columns.find(c => c.id === id)?.visible

  const toggleColumn = (id) => {
    setColumns(columns.map(col =>
      col.id === id ? { ...col, visible: !col.visible } : col
    ))
  }

  // Categories list based on "Image 3"
  const categories = [
    'Favorites',
    'All instruments',
    'Crypto',
    'Energies',
    'Forex',
    'Indices',
    'Metals',
    'Other',
    'Stocks'
  ]

  // Mock Data Generators
  const generateData = () => {
    const common = {
      signal: 'up',
      pl: '-',
      chartData: [10, 12, 11, 14, 13, 15]
    }

    return [
      // Crypto
      { id: 'btc', symbol: 'BTCUSD', name: 'Bitcoin', bid: '89,926.15', ask: '89,942.53', change: '+0.44%', changeColor: 'green', category: 'Crypto', favorite: true, ...common },
      { id: 'doge', symbol: 'DOGUSD', name: 'Dogecoin', bid: '0.12785', ask: '0.12805', change: '+0.68%', changeColor: 'green', category: 'Crypto', favorite: true, ...common },
      { id: 'eth', symbol: 'ETHUSD', name: 'Ethereum', bid: '2,956.11', ask: '2,957.40', change: '-0.70%', changeColor: 'red', category: 'Crypto', favorite: true, signal: 'down', ...common },
      { id: 'xrp', symbol: 'XRPUSD', name: 'Ripple', bid: '1.9571', ask: '1.9795', change: '+0.74%', changeColor: 'green', category: 'Crypto', favorite: true, ...common },

      // Forex
      { id: 'audcad', symbol: 'AUDCAD', name: 'AUD/CAD', bid: '0.94348', ask: '0.94369', change: '+0.08%', changeColor: 'green', category: 'Forex', favorite: true, ...common },
      { id: 'audchf', symbol: 'AUDCHF', name: 'AUD/CHF', bid: '0.54025', ask: '0.54034', change: '-1.13%', changeColor: 'red', category: 'Forex', favorite: true, signal: 'down', ...common },
      { id: 'audjpy', symbol: 'AUDJPY', name: 'AUD/JPY', bid: '107.473', ask: '107.49', change: '-1.02%', changeColor: 'red', category: 'Forex', favorite: true, signal: 'down', ...common },
      { id: 'cadchf', symbol: 'CADCHF', name: 'CAD/CHF', bid: '0.5726', ask: '0.57268', change: '-0.55%', changeColor: 'red', category: 'Forex', favorite: true, signal: 'down', ...common },
      { id: 'cadjpy', symbol: 'CADJPY', name: 'CAD/JPY', bid: '113.896', ask: '113.931', change: '+1.33%', changeColor: 'green', category: 'Forex', favorite: true, ...common },

      // Energies
      { id: 'usoil', symbol: 'USOIL', name: 'Crude Oil', bid: '58.964', ask: '58.964', change: '+0.13%', changeColor: 'green', category: 'Energies', favorite: false, ...common },

      // Indices
      { id: 'ustec', symbol: 'USTEC', name: 'US Tech 100', bid: '25,319.41', ask: '25,319.41', change: '+0.07%', changeColor: 'green', category: 'Indices', favorite: false, ...common },

      // Metals
      { id: 'xauusd', symbol: 'XAUUSD', name: 'Gold', bid: '2,642.50', ask: '2,643.10', change: '+0.25%', changeColor: 'green', category: 'Metals', favorite: false, ...common },

      // Stocks
      { id: 'aapl', symbol: 'AAPL', name: 'Apple Inc', bid: '235.40', ask: '235.55', change: '-0.10%', changeColor: 'gray', category: 'Stocks', favorite: false, ...common },
    ]
  }

  const [items, setItems] = useState(generateData())

  const toggleFavorite = (id) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, favorite: !item.favorite } : item
    ))
  }

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by Category
    if (selectedCategory === 'Favorites') {
      filtered = filtered.filter(item => item.favorite);
    } else if (selectedCategory !== 'All instruments') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.symbol.toLowerCase().includes(lowerTerm) ||
        item.name.toLowerCase().includes(lowerTerm)
      );
    }

    return filtered;
  }, [items, selectedCategory, searchTerm]);

  // Drag and drop logic
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  const handleDragStart = (e, position) => {
    dragItem.current = position
    e.dataTransfer.effectAllowed = 'move'
    // e.target.classList.add('opacity-50') 
  }

  const handleDragEnter = (e, position) => {
    dragOverItem.current = position
    e.preventDefault()
  }

  const handleDragEnd = (e) => {
    // e.target.classList.remove('opacity-50')
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copyListItems = [...items]
      // We need to find the actual items in the main list based on the filtered list indices
      // This simple index swapping only works if we are dragging within the filtered view AND reordering the main list accordingly.
      // For simplicity in this demo, we'll just reorder the visible list if it matches the main list, 
      // or we'd need more complex logic. 
      // To strictly follow "keep scrollable with i can pick and change its numbering", 
      // we will apply the reorder to the `items` state but we need to map the filtered indices back to `items` indices.

      const itemToMove = filteredItems[dragItem.current];
      const targetItem = filteredItems[dragOverItem.current];

      const originalFromIndex = items.findIndex(i => i.id === itemToMove.id);
      const originalToIndex = items.findIndex(i => i.id === targetItem.id);

      if (originalFromIndex !== -1 && originalToIndex !== -1) {
        const newItems = [...items];
        newItems.splice(originalFromIndex, 1);
        newItems.splice(originalToIndex, 0, itemToMove);
        setItems(newItems);
      }
    }
    dragItem.current = null
    dragOverItem.current = null
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-[#b2b5be] font-sans border border-gray-800 rounded-md">

      {/* New Header Layout: Dropdown Title + Actions */}
      <header className="flex items-center justify-between pl-3 pr-2 py-2 flex-shrink-0 min-h-[44px] border-b border-gray-800/50">

        {/* Dropdown Title Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="flex items-center gap-2 text-[14px] font-semibold text-white hover:text-gray-300 transition-colors"
          >
            {selectedCategory}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`}>
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showCategoryDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCategoryDropdown(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-[220px] bg-[#1a1e25] border border-gray-700 rounded-lg shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto">
                {categories.map(cat => (
                  <div
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className="px-4 py-2.5 text-[13px] text-gray-300 hover:bg-[#2a303c] hover:text-white cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <span>{cat}</span>
                    {selectedCategory === cat ? (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-white">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 text-[#f59e0b]">
                        <FiStar size={12} fill="currentColor" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions: Settings + Close */}
        <div className="flex items-center gap-1">


          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Search Bar - Below Header */}
      <div className="px-3 py-2 flex-shrink-0 border-b border-gray-800/50">
        <div className="relative group bg-[#131720] rounded-md border border-gray-800 group-focus-within:border-gray-600 transition-colors">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-transparent text-[13px] text-white placeholder-gray-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[30px_1fr_auto_auto_auto_30px] gap-0 border-b border-gray-800 bg-background text-[11px] font-medium text-gray-500 uppercase">
        <div className="py-2 text-center bg-[#0b0e14] border-r border-gray-800"></div> {/* Grip placeholder */}
        <div className="py-2 pl-2 text-left bg-[#0b0e14] border-r border-gray-800">Symbol</div>

        {isVisible('bid') && <div className="py-2 px-1 text-center w-[70px]">Bid</div>}
        {isVisible('ask') && <div className="py-2 px-1 text-center w-[70px]">Ask</div>}
        {isVisible('change') && <div className="py-2 px-1 text-center w-[60px]">1D</div>}

        <div className="py-2 text-center"></div> {/* Star placeholder */}
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnter={(e) => handleDragEnter(e, idx)}
            onDragEnd={handleDragEnd}
            className="group grid grid-cols-[30px_1fr_auto_auto_auto_30px] gap-0 items-center border-b border-gray-800 hover:bg-[#1c252f] transition-colors h-[40px] cursor-pointer"
          >
            {/* Grip Handle */}
            <div className="flex items-center justify-center text-[#565c66] cursor-grab active:cursor-grabbing bg-[#0b0e14] group-hover:bg-[#1c252f] h-full transition-colors border-r border-gray-800">
              <LuGripVertical size={14} />
            </div>

            {/* Symbol */}
            <div className="pl-2 flex flex-col justify-center border-r border-gray-800 bg-[#0b0e14] group-hover:bg-[#1c252f] h-full transition-colors">
              <span className="text-[13px] font-bold text-gray-200">{item.symbol}</span>
              {isVisible('description') && <span className="text-[10px] text-gray-500">{item.name}</span>}
            </div>

            {/* Bid */}
            {isVisible('bid') && (
              <div className="px-1 w-[70px] text-center flex items-center justify-center h-full">
                <span className={`text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block ${showPriceHighlight
                  ? (item.changeColor === 'green' ? 'bg-[#2ebd85] text-white' : item.changeColor === 'red' ? 'bg-[#f6465d] text-white' : 'bg-[#2a303c] text-white')
                  : (item.changeColor === 'green' ? 'bg-[#2ebd85] text-white' : item.changeColor === 'red' ? 'bg-[#f6465d] text-white' : 'bg-[#2a303c] text-white')
                  }`}>
                  {item.bid}
                </span>
              </div>
            )}

            {/* Ask */}
            {isVisible('ask') && (
              <div className="px-1 w-[70px] text-center flex items-center justify-center h-full">
                <span className={`text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block ${showPriceHighlight
                  ? (item.changeColor === 'green' ? 'bg-[#2ebd85] text-white' : item.changeColor === 'red' ? 'bg-[#f6465d] text-white' : 'bg-[#2a303c] text-white')
                  : (item.changeColor === 'green' ? 'bg-[#2ebd85] text-white' : item.changeColor === 'red' ? 'bg-[#f6465d] text-white' : 'bg-[#2a303c] text-white')
                  }`}>
                  {item.ask}
                </span>
              </div>
            )}

            {/* 1D Change */}
            {isVisible('change') && (
              <div className={`px-1 w-[60px] text-center text-[11px] font-medium flex items-center justify-center h-full ${item.changeColor === 'green' ? 'text-[#2ebd85]' : item.changeColor === 'red' ? 'text-[#f6465d]' : 'text-gray-400'}`}>
                {item.change}
              </div>
            )}

            {/* Star / Favorite */}
            <div className="flex items-center justify-center h-full">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                className={`text-[14px] transition-colors ${item.favorite ? 'text-[#f59e0b]' : 'text-gray-600 hover:text-gray-400'}`}
              >
                {item.favorite ? <FiStar fill="currentColor" /> : <FiStar />}
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  )
}
