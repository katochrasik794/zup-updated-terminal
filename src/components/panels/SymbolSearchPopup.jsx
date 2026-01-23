import { useState, useEffect } from 'react'
import { FiSearch } from 'react-icons/fi'
import FlagIcon from '../ui/FlagIcon'

export default function SymbolSearchPopup({ isOpen, onClose, onSelectSymbol, triggerRef }) {
  const [searchTerm, setSearchTerm] = useState('')
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

  // Sample instruments data
  const instruments = [
    {
      symbol: 'BTC',
      name: 'Bitcoin vs US Dollar',
      flag: 'btc',
      favorite: true
    },
    {
      symbol: 'XAU/USD',
      name: 'Gold vs US Dollar',
      flag: 'xauusd',
      favorite: true
    },
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      flag: 'aapl',
      favorite: true,
      marketClosed: true
    },
    {
      symbol: 'EUR/USD',
      name: 'Euro vs US Dollar',
      flag: 'eurusd',
      favorite: true
    },
    {
      symbol: 'GBP/USD',
      name: 'Great Britain Pound vs US Dollar',
      flag: 'gbpusd',
      favorite: true
    },
    {
      symbol: 'USD/JPY',
      name: 'US Dollar vs Japanese Yen',
      flag: 'usdjpy',
      favorite: true
    },
    {
      symbol: 'USTEC',
      name: 'US Tech 100 Index',
      flag: 'ustec',
      favorite: true
    },
    {
      symbol: 'USOIL',
      name: 'Crude Oil',
      flag: 'usoil',
      favorite: true
    }
  ]

  const filteredInstruments = searchTerm
    ? instruments.filter(item =>
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : instruments.filter(item => item.favorite)

  const handleSelectSymbol = (symbol) => {
    if (onSelectSymbol) {
      onSelectSymbol(symbol)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Dropdown Popup */}
      <div 
        className={`${triggerRef ? 'fixed' : 'absolute top-full left-0 mt-2'} w-[400px] bg-[#1a2329] border border-gray-700 rounded-lg shadow-2xl z-50`}
        style={triggerRef ? { top: position.top, left: position.left } : {}}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-gray-700">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search symbol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#141d22] border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Favorites Section */}
        <div className="px-2 py-2">
          <button className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-300 hover:bg-[#141d22] rounded transition-colors">
            <span className="text-xs font-medium uppercase tracking-wider">Favorites</span>
            <svg 
              className="w-3 h-3 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Instruments List */}
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#1a2329] border-b border-gray-700">
              <tr className="text-gray-500 text-[10px] uppercase">
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-center font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInstruments.map((item, idx) => (
                <tr
                  key={`${item.symbol}-${idx}`}
                  className="border-b border-gray-800 hover:bg-[#141d22] cursor-pointer transition-colors group"
                  onClick={() => handleSelectSymbol(item)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                        <FlagIcon type={item.flag} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">{item.symbol}</span>
                        {item.marketClosed && (
                          <div className="w-2 h-2 rounded-full bg-red-500" title="Market Closed"></div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-400 text-xs group-hover:text-gray-300">{item.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {item.favorite && (
                      <svg width="14" height="14" fill="#ffd700" stroke="#ffd700" strokeWidth="1">
                        <path d="M8 2l1.5 3h3.5l-2.5 2 1 3.5-3-2-3 2 1-3.5-2.5-2h3.5z"/>
                      </svg>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
