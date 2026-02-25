import { useState, useEffect, useRef } from 'react'
import { FiSearch } from 'react-icons/fi'
import { useInstruments } from '../../context/InstrumentContext'
import { useWebSocket } from '../../context/WebSocketContext'
import FlagIcon from '../ui/FlagIcon'
import { cn } from '../../lib/utils'

// Extract for blink logic
function SearchRow({ item, handleSelectSymbol, lastQuote }) {
  const prevBidRef = useRef(item.bid);
  const prevAskRef = useRef(item.ask);
  const [bidColor, setBidColor] = useState('');
  const [askColor, setAskColor] = useState('');
  const { toggleFavorite } = useInstruments();

  const quote = lastQuote || {};
  const bid = quote.bid !== undefined ? quote.bid.toFixed(2) : (item.bid ? Number(item.bid).toFixed(2) : '0.00');
  const ask = quote.ask !== undefined ? quote.ask.toFixed(2) : (item.ask ? Number(item.ask).toFixed(2) : '0.00');

  useEffect(() => {
    if (quote.bid && prevBidRef.current !== quote.bid) {
      const color = quote.bid > prevBidRef.current ? 'text-success' : 'text-danger';
      setBidColor(color);
      const timer = setTimeout(() => setBidColor(''), 300);
      prevBidRef.current = quote.bid;
      return () => clearTimeout(timer);
    }
  }, [quote.bid]);

  useEffect(() => {
    if (quote.ask && prevAskRef.current !== quote.ask) {
      const color = quote.ask > prevAskRef.current ? 'text-success' : 'text-danger';
      setAskColor(color);
      const timer = setTimeout(() => setAskColor(''), 300);
      prevAskRef.current = quote.ask;
      return () => clearTimeout(timer);
    }
  }, [quote.ask]);

  return (
    <tr
      className="border-b border-gray-800 hover:bg-gray-900 cursor-pointer transition-colors group"
      onClick={() => handleSelectSymbol(item)}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
            <FlagIcon symbol={item.symbol} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-[13px] group-hover:text-blue-400 transition-colors">{item.symbol}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-gray-400 text-[12px] group-hover:text-gray-300">{item.description || item.name}</span>
      </td>

      <td className="px-4 py-2.5 text-right">
        <span className="text-[12px] font-medium px-2 py-1 rounded bg-danger text-white">
          {bid}
        </span>
      </td>

      <td className="px-4 py-2.5 text-right">
        <span className="text-[12px] font-medium px-2 py-1 rounded bg-success text-white">
          {ask}
        </span>
      </td>

      <td className="px-4 py-2.5 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
          className="focus:outline-none"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={item.favorite ? "#f59e0b" : "none"}
            stroke={item.favorite ? "#f59e0b" : "#4b5563"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors hover:stroke-yellow-500"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </td>
    </tr>
  );
}

export default function SymbolSearchPopup({ isOpen, onClose, onSelectSymbol, triggerRef }) {
  const { instruments, categories: dynamicCategories, isLoading, toggleFavorite } = useInstruments()
  const { subscribe, unsubscribe, lastQuotes, normalizeSymbol } = useWebSocket()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Favorites')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isOpen && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }
  }, [isOpen, triggerRef])

  const filteredInstruments = instruments.filter(item => {
    // 1. Filter by Search Term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      return item.symbol.toLowerCase().includes(lowerSearch) ||
        (item.name && item.name.toLowerCase().includes(lowerSearch)) ||
        (item.description && item.description.toLowerCase().includes(lowerSearch));
    }

    // 2. Filter by Category (only if no search term)
    if (selectedCategory === 'Favorites') return item.favorite;
    if (selectedCategory === 'All instruments') return true;
    return item.category === selectedCategory;
  })

  // Subscribe to visible (top 50)
  const visibleInstruments = filteredInstruments.slice(0, 50);
  useEffect(() => {
    if (!isOpen) return;
    const symbols = visibleInstruments.map(i => i.symbol);
    subscribe(symbols);
    return () => unsubscribe(symbols);
  }, [isOpen, visibleInstruments, subscribe, unsubscribe]);


  const handleSelectSymbol = (item: any) => {
    onSelectSymbol(item);
    onClose();
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={`${triggerRef ? 'fixed' : 'absolute top-full left-0 mt-2'} w-[500px] bg-background border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col max-h-[500px]`}
        style={triggerRef ? { top: position.top, left: position.left } : {}}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-gray-700 flex-shrink-0">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search symbol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-gray-600 rounded text-sm text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Category Dropdown Section */}
        <div className="px-2 py-2 flex-shrink-0 relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-300 hover:bg-gray-900 rounded transition-colors group"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400 group-hover:text-foreground transition-colors">{selectedCategory}</span>
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu Overlay */}
          {showCategoryDropdown && (
            <div className="absolute top-full left-2 right-2 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-xl z-50 py-1 max-h-[250px] overflow-y-auto">
              {dynamicCategories.map(cat => (
                <div
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowCategoryDropdown(false);
                    setSearchTerm(''); // Clear search on category switch? Optional but usually good.
                  }}
                  className="px-3 py-2 text-[12px] text-gray-300 hover:bg-gray-800 hover:text-foreground cursor-pointer flex items-center justify-between"
                >
                  <span>{cat}</span>
                  {selectedCategory === cat && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instruments List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b border-gray-700 z-10">
              <tr className="text-gray-500 text-[10px] uppercase">
                <th className="px-4 py-2 text-left font-medium bg-background">Symbol</th>
                <th className="px-4 py-2 text-left font-medium bg-background">Description</th>
                <th className="px-4 py-2 text-right font-medium bg-background">Bid</th>
                <th className="px-4 py-2 text-right font-medium bg-background">Ask</th>
                <th className="px-4 py-2 text-center font-medium w-10 bg-background"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInstruments.map((item, idx) => (
                <SearchRow
                  key={`${item.symbol}-${idx}`}
                  item={item}
                  handleSelectSymbol={handleSelectSymbol}
                  lastQuote={lastQuotes[normalizeSymbol(item.symbol)]}
                />
              ))}
              {filteredInstruments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
