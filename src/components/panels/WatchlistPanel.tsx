import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import { LuGripVertical } from 'react-icons/lu'
import { FiStar, FiSearch, FiSlash } from 'react-icons/fi'
import { useAccount } from '../../context/AccountContext'
import { useInstruments } from '../../context/InstrumentContext'
import { useWebSocket } from '../../context/WebSocketContext'
import { useTrading } from '../../context/TradingContext'
import { cn, checkIsMarketClosed } from '../../lib/utils'

// Extract Row for performance/blink logic
const InstrumentRow = ({ item, isVisible, toggleFavorite, lastQuote, handleDragStart, handleDragEnter, handleDragEnd, idx, onSelect, addNavbarTab }) => {
  // Refs for tracking previous values to trigger blinks
  const prevBidRef = useRef(item.bid);
  const prevAskRef = useRef(item.ask);

  // Live Data or Static Fallback
  const quote = lastQuote || {};

  // Format to 6 significant digits total
  const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null) return '0.00000';

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum === 0) return '0.00000';

    // Use toPrecision(6) for exactly 6 significant digits
    return parseFloat(priceNum.toPrecision(6)).toString();
  };

  const bid = formatPrice(quote.bid ?? item.bid);
  const ask = formatPrice(quote.ask ?? item.ask);

  // Spread calculation
  const spread = quote.spread !== undefined ? quote.spread : (item.spread || 0);

  // Use centralized market status check
  const isMarketClosed = checkIsMarketClosed(item.symbol, item.category, quote.bid, quote.ask);

  // Calculate Day Change (as Range %)
  // "calculate how much is in +ve or -ve inpercentage based on day high/low and current"
  let dayChangeLabel = '0.00%';
  let changeColor = 'gray';

  if (quote.dayHigh && quote.dayLow && quote.bid) {
    const range = quote.dayHigh - quote.dayLow;
    if (range > 0) {
      const pct = ((quote.bid - quote.dayLow) / range) * 100;
      // If closer to High = Green? Closer to Low = Red?
      // Or usually change is vs Open. Since we don't have Open, I will map Range % to a visual indicator
      // But the column says "1D Change". Let's show Range % for now as requested.
      dayChangeLabel = `${pct.toFixed(2)}%`;
      changeColor = pct > 50 ? 'green' : 'red';
    }
  } else if (item.change) {
    dayChangeLabel = item.change;
    changeColor = parseFloat(item.change) >= 0 ? 'green' : 'red';
  }

  // Blink Logic
  const [bidColor, setBidColor] = useState('');
  const [askColor, setAskColor] = useState('');

  useEffect(() => {
    if (quote.bid && prevBidRef.current !== quote.bid) {
      const color = quote.bid > prevBidRef.current ? 'text-success' : 'text-danger';
      setBidColor(color);
      const timer = setTimeout(() => setBidColor(''), 300); // Blink duration
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

  // Fallback static color logic
  const staticBidColor = changeColor === 'green' ? 'text-success' : 'text-danger';
  const staticAskColor = changeColor === 'green' ? 'text-success' : 'text-danger';

  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, idx)}
      onDragEnter={(e) => handleDragEnter(e, idx)}
      onDragEnd={handleDragEnd}
      onClick={() => {
        onSelect(item.symbol);
        // Also add to Navbar if not already there
        if (addNavbarTab) {
          addNavbarTab(item.symbol);
        }
      }}
      className="group grid grid-cols-[36px_minmax(70px,100px)_auto_auto_30px] gap-0 items-center border-b border-gray-800 hover:bg-gray-900 transition-colors h-[40px] cursor-pointer min-w-0"
    >
      {/* Flag - Sticky Left 0 */}
      <div className="sticky left-0 z-10 flex items-center justify-center bg-background group-hover:bg-gray-900 h-full transition-colors border-r border-gray-800 p-1.5">
        <div className="w-6 h-6 rounded-full overflow-hidden">
          <FlagIcon symbol={item.symbol} />
        </div>
      </div>

      {/* Symbol - Sticky Left 36px */}
      <div className="sticky left-[36px] z-10 pl-2 flex flex-col justify-center border-r border-gray-800 bg-background group-hover:bg-gray-900 h-full transition-colors overflow-hidden min-w-[70px] flex-shrink-0">
        <span className="text-[13px] font-bold text-gray-200 truncate">{item.symbol}</span>
        {isVisible('description') && <span className="text-[10px] text-gray-500 truncate">{item.description || item.name}</span>}
        {isMarketClosed && (
          <span className="flex items-center gap-1 text-amber-400">
            <FiSlash size={12} />
          </span>
        )}
      </div>

      {/* Bid */}
      {isVisible('bid') && (
        <div className="px-1 w-[90px] min-w-[90px] text-center flex items-center justify-center h-full flex-shrink-0">
          <span className={cn(
            "text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block transition-colors bg-success/10 truncate",
            bidColor || staticBidColor
          )}>
            {bid}
          </span>
        </div>
      )}

      {/* Ask */}
      {isVisible('ask') && (
        <div className="px-1 w-[90px] min-w-[90px] text-center flex items-center justify-center h-full flex-shrink-0">
          <span className={cn(
            "text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block transition-colors bg-danger/10 truncate",
            askColor || staticAskColor
          )}>
            {ask}
          </span>
        </div>
      )}





      {/* Star / Favorite */}
      <div className="flex items-center justify-center h-full">
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
          className={`text-[14px] transition-colors ${item.favorite ? 'text-warning' : 'text-gray-600 hover:text-gray-400'}`}
        >
          {item.favorite ? <FiStar fill="currentColor" /> : <FiStar />}
        </button>
      </div>

    </div>
  )
}

export default function WatchlistPanel({ onClose }) {
  const { currentAccount } = useAccount()
  const { setSymbol, addNavbarTab } = useTrading()
  const {
    instruments,
    categories: dynamicCategories,
    isLoading,
    toggleFavorite,
    reorderInstruments
  } = useInstruments()
  const { subscribe, unsubscribe, lastQuotes, normalizeSymbol } = useWebSocket()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Favorites')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showPriceHighlight, setShowPriceHighlight] = useState(false)

  // Columns configuration based on "Image 2"
  const [columns, setColumns] = useState([
    { id: 'flag', label: '', visible: true, draggable: false },
    { id: 'signal', label: 'Signal', visible: false, draggable: true },
    { id: 'description', label: 'Description', visible: true, draggable: true },
    { id: 'bid', label: 'Bid', visible: true, draggable: true },
    { id: 'spread', label: 'Spread', visible: false, draggable: true },
    { id: 'ask', label: 'Ask', visible: true, draggable: true },
    // { id: 'change', label: '1D change', visible: true, draggable: true }, // Removed
    { id: 'chart', label: 'Show chart', visible: false, draggable: false },
    { id: 'pl', label: 'P/L', visible: false, draggable: true },
  ])

  // Drag and drop logic
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position
    e.preventDefault()
  }

  const handleDragEnd = async () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newList = [...instruments]

      // Map filtered indices back to original indices
      const itemToMove = filteredItems[dragItem.current]
      const targetItem = filteredItems[dragOverItem.current]

      const fromIdx = newList.findIndex(i => i.id === itemToMove.id)
      const toIdx = newList.findIndex(i => i.id === targetItem.id)

      if (fromIdx !== -1 && toIdx !== -1) {
        newList.splice(fromIdx, 1)
        newList.splice(toIdx, 0, itemToMove)
        await reorderInstruments(newList)
      }
    }
    dragItem.current = null
    dragOverItem.current = null
  }

  const items = instruments

  const isVisible = (id: string) => columns.find(c => c.id === id)?.visible

  const toggleColumn = (id: string) => {
    setColumns(columns.map(col =>
      col.id === id ? { ...col, visible: !col.visible } : col
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
        (item.name && item.name.toLowerCase().includes(lowerTerm)) ||
        (item.description && item.description.toLowerCase().includes(lowerTerm))
      );
    }

    return filtered;
  }, [items, selectedCategory, searchTerm]);

  // Automatically switch to 'All instruments' if Favorites is selected but empty
  useEffect(() => {
    if (selectedCategory === 'Favorites' && filteredItems.length === 0 && items.length > 0) {
      setSelectedCategory('All instruments');
    }
  }, [selectedCategory, filteredItems.length, items.length]);

  // Handle Subscriptions
  useEffect(() => {
    const symbols = filteredItems.map(i => i.symbol);
    subscribe(symbols);
    return () => unsubscribe(symbols); // Cleanup on unmount/change
  }, [filteredItems, subscribe, unsubscribe]);


  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-gray-300 font-sans border border-gray-800 rounded-md">

      {/* New Header Layout: Dropdown Title + Actions */}
      <header className="flex items-center justify-between pl-3 pr-2 py-2 flex-shrink-0 min-h-[44px] border-b border-gray-800/50">

        {/* Dropdown Title Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="flex items-center gap-2 text-[14px] font-semibold text-foreground hover:text-gray-300 transition-colors"
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
              <div className="absolute top-full left-0 mt-2 w-[220px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto">
                {dynamicCategories.map(cat => (
                  <div
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className="px-4 py-2.5 text-[13px] text-gray-300 hover:bg-gray-800 hover:text-foreground cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <span>{cat}</span>
                    {selectedCategory === cat ? (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-foreground">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 text-warning">
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
            className="p-1.5 text-gray-400 hover:text-foreground hover:bg-gray-800 rounded transition-colors"
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
        <div className="relative group bg-gray-900 rounded-md border border-gray-800 group-focus-within:border-gray-600 transition-colors">
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
            className="w-full pl-9 pr-3 py-1.5 bg-transparent text-[13px] text-foreground placeholder-gray-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 grid grid-cols-[36px_minmax(70px,100px)_auto_auto_30px] gap-0 border-b border-gray-800 bg-background text-[11px] font-medium text-gray-500 uppercase min-w-0">
          <div className="sticky left-0 z-30 py-2 text-center bg-background border-r border-gray-800"></div> {/* Flag placeholder */}
          <div className="sticky left-[36px] z-30 py-2 pl-2 text-left bg-background border-r border-gray-800 min-w-[70px] flex-shrink-0">Symbol</div>

          {isVisible('bid') && <div className="py-2 px-1 text-center w-[90px] min-w-[90px] flex-shrink-0 bg-background border-r border-gray-800">Bid</div>}
          {isVisible('ask') && <div className="py-2 px-1 text-center w-[90px] min-w-[90px] flex-shrink-0 bg-background border-r border-gray-800">Ask</div>}

          <div className="py-2 text-center bg-background"></div> {/* Star placeholder */}
        </div>

        {/* Content */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 grayscale opacity-40 py-10">
            <FiSearch size={48} className="mb-4" />
            <span className="text-[14px] font-medium">No symbols found</span>
            {currentAccount?.group && <span className="text-[11px] mt-1 opacity-60">for {currentAccount.group}</span>}
          </div>
        ) : (
          <div className="min-w-max">
            {filteredItems.map((item, idx) => (
              <InstrumentRow
                key={item.id}
                item={item}
                idx={idx}
                isVisible={isVisible}
                toggleFavorite={toggleFavorite}
                lastQuote={lastQuotes[normalizeSymbol(item.symbol)]}
                handleDragStart={handleDragStart}
                handleDragEnter={handleDragEnter}
                handleDragEnd={handleDragEnd}
                onSelect={setSymbol}
                addNavbarTab={addNavbarTab}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
