"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import FlagIcon from '../ui/FlagIcon'
import IconButton from '../ui/IconButton'
import WatchlistSettingsPopup from './WatchlistSettingsPopup'
import { LuGripVertical } from 'react-icons/lu'
import { FiStar, FiSearch } from 'react-icons/fi'
import { useAccount } from '../../context/AccountContext'
import { useInstruments } from '../../context/InstrumentContext'
import { cn } from '../../lib/utils'

export default function WatchlistPanel({ onClose }) {
  const { currentAccount } = useAccount()
  const {
    instruments,
    categories: dynamicCategories,
    isLoading,
    toggleFavorite,
    reorderInstruments
  } = useInstruments()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Favorites')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPriceHighlight, setShowPriceHighlight] = useState(false)

  // Columns configuration based on "Image 2"
  const [columns, setColumns] = useState([
    { id: 'signal', label: 'Signal', visible: false, draggable: true },
    { id: 'description', label: 'Description', visible: true, draggable: true },
    { id: 'bid', label: 'Bid', visible: true, draggable: true },
    { id: 'spread', label: 'Spread', visible: false, draggable: true },
    { id: 'ask', label: 'Ask', visible: true, draggable: true },
    { id: 'change', label: '1D change', visible: true, draggable: true },
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
                {dynamicCategories.map(cat => (
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
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
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
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 grayscale opacity-40 py-10">
            <FiSearch size={48} className="mb-4" />
            <span className="text-[14px] font-medium">No symbols found</span>
            {currentAccount?.group && <span className="text-[11px] mt-1 opacity-60">for {currentAccount.group}</span>}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            // Real Price Data Mapping
            const bid = item.bid || '0.00000'
            const ask = item.ask || '0.00000'
            const change = item.change || '0.00%'
            const changeColor = parseFloat(change) >= 0 ? 'green' : 'red'

            return (
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
                <div className="pl-2 flex flex-col justify-center border-r border-gray-800 bg-[#0b0e14] group-hover:bg-[#1c252f] h-full transition-colors overflow-hidden">
                  <span className="text-[13px] font-bold text-gray-200 truncate">{item.symbol}</span>
                  {isVisible('description') && <span className="text-[10px] text-gray-500 truncate">{item.description || item.name}</span>}
                </div>

                {/* Bid */}
                {isVisible('bid') && (
                  <div className="px-1 w-[70px] text-center flex items-center justify-center h-full">
                    <span className={cn(
                      "text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block transition-colors",
                      changeColor === 'green' ? 'bg-[#2ebd85]/20 text-[#2ebd85]' : 'bg-[#f6465d]/20 text-[#f6465d]'
                    )}>
                      {bid}
                    </span>
                  </div>
                )}

                {/* Ask */}
                {isVisible('ask') && (
                  <div className="px-1 w-[70px] text-center flex items-center justify-center h-full">
                    <span className={cn(
                      "text-[12px] font-medium px-1.5 py-1 rounded-[4px] w-full block transition-colors",
                      changeColor === 'green' ? 'bg-[#2ebd85]/20 text-[#2ebd85]' : 'bg-[#f6465d]/20 text-[#f6465d]'
                    )}>
                      {ask}
                    </span>
                  </div>
                )}

                {/* 1D Change */}
                {isVisible('change') && (
                  <div className={cn(
                    "px-1 w-[60px] text-center text-[11px] font-medium flex items-center justify-center h-full",
                    changeColor === 'green' ? 'text-[#2ebd85]' : 'text-[#f6465d]'
                  )}>
                    {change}
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
            )
          })
        )}
      </div>
    </div>
  )
}
