"use client";
import { useState, useEffect } from 'react'
import { FiSearch } from 'react-icons/fi'
import FlagIcon from '../ui/FlagIcon'

export default function SymbolSearchPopup({ isOpen, onClose, onSelectSymbol, triggerRef }) {
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

  // Categories same as Watchlist
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

  // Enhanced mock data with categories
  const instruments = [
    { symbol: 'BTC', name: 'Bitcoin vs US Dollar', flag: 'btc', favorite: true, category: 'Crypto' },
    { symbol: 'XAU/USD', name: 'Gold vs US Dollar', flag: 'xauusd', favorite: true, category: 'Metals' },
    { symbol: 'AAPL', name: 'Apple Inc.', flag: 'aapl', favorite: true, marketClosed: true, category: 'Stocks' },
    { symbol: 'EUR/USD', name: 'Euro vs US Dollar', flag: 'eurusd', favorite: true, category: 'Forex' },
    { symbol: 'GBP/USD', name: 'Great Britain Pound vs US Dollar', flag: 'gbpusd', favorite: true, category: 'Forex' },
    { symbol: 'USD/JPY', name: 'US Dollar vs Japanese Yen', flag: 'usdjpy', favorite: true, category: 'Forex' },
    { symbol: 'USTEC', name: 'US Tech 100 Index', flag: 'ustec', favorite: true, category: 'Indices' },
    { symbol: 'USOIL', name: 'Crude Oil', flag: 'usoil', favorite: true, category: 'Energies' },
    { symbol: 'DOGUSD', name: 'Dogecoin', flag: 'btc', favorite: false, category: 'Crypto' }, // Added for non-fav testing
    { symbol: 'CADCHF', name: 'CAD/CHF', flag: 'cadchf', favorite: false, category: 'Forex' }
  ]

  const filteredInstruments = instruments.filter(item => {
    // 1. Filter by Search Term
    if (searchTerm) {
      return item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    }

    // 2. Filter by Category (only if no search term)
    if (selectedCategory === 'Favorites') return item.favorite;
    if (selectedCategory === 'All instruments') return true;
    return item.category === selectedCategory;
  })

  // ... (handleSelectSymbol, etc.)

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={`${triggerRef ? 'fixed' : 'absolute top-full left-0 mt-2'} w-[400px] bg-[#02040d] border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col`}
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
              className="w-full pl-9 pr-3 py-2 bg-[#0b0e14] border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Category Dropdown Section */}
        <div className="px-2 py-2 flex-shrink-0 relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-300 hover:bg-[#1a1e25] rounded transition-colors group"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400 group-hover:text-white transition-colors">{selectedCategory}</span>
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
            <div className="absolute top-full left-2 right-2 mt-1 bg-[#1a1e25] border border-gray-700 rounded-md shadow-xl z-50 py-1 max-h-[250px] overflow-y-auto">
              {categories.map(cat => (
                <div
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowCategoryDropdown(false);
                    setSearchTerm(''); // Clear search on category switch? Optional but usually good.
                  }}
                  className="px-3 py-2 text-[12px] text-gray-300 hover:bg-[#2a303c] hover:text-white cursor-pointer flex items-center justify-between"
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
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#02040d] border-b border-gray-700 z-10">
              <tr className="text-gray-500 text-[10px] uppercase">
                <th className="px-4 py-2 text-left font-medium bg-[#02040d]">Symbol</th>
                <th className="px-4 py-2 text-left font-medium bg-[#02040d]">Description</th>
                <th className="px-4 py-2 text-center font-medium w-10 bg-[#02040d]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInstruments.map((item, idx) => (
                <tr
                  key={`${item.symbol}-${idx}`}
                  className="border-b border-gray-800 hover:bg-[#1a1e25] cursor-pointer transition-colors group"
                  onClick={() => handleSelectSymbol(item)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
                        {/* Fallback if flag icon missing or use simple circle */}
                        <FlagIcon type={item.flag} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-[13px] group-hover:text-blue-400 transition-colors">{item.symbol}</span>
                        {item.marketClosed && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Market Closed"></div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-400 text-[12px] group-hover:text-gray-300">{item.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={item.favorite ? "#f59e0b" : "none"}
                      stroke={item.favorite ? "#f59e0b" : "#4b5563"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-colors"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </td>
                </tr>
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
