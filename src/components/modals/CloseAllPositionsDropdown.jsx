import { useEffect, useRef, useState } from 'react'

export default function CloseAllPositionsDropdown({ isOpen, onClose, onConfirm, positions, anchorRef }) {
  const dropdownRef = useRef(null)
  const [selectedOption, setSelectedOption] = useState('all')

  // Calculate stats
  const stats = positions.reduce((acc, pos) => {
    const pl = parseFloat(pos.pl.replace('+', ''))
    
    // All
    acc.all.count++
    acc.all.pl += pl

    // Profitable
    if (pl > 0) {
      acc.profitable.count++
      acc.profitable.pl += pl
    }

    // Losing
    if (pl < 0) {
      acc.losing.count++
      acc.losing.pl += pl
    }

    // Buy
    if (pos.type === 'Buy') {
      acc.buy.count++
      acc.buy.pl += pl
    }

    // Sell
    if (pos.type === 'Sell') {
      acc.sell.count++
      acc.sell.pl += pl
    }

    return acc
  }, {
    all: { count: 0, pl: 0 },
    profitable: { count: 0, pl: 0 },
    losing: { count: 0, pl: 0 },
    buy: { count: 0, pl: 0 },
    sell: { count: 0, pl: 0 }
  })

  const formatPL = (val) => {
    if (val === 0) return '--'
    const sign = val > 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}`
  }

  const getColor = (val) => {
    if (val === 0) return 'text-[#8b9096]'
    return val > 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          anchorRef.current && !anchorRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  // Calculate position
  const style = {}
  if (anchorRef?.current) {
    const rect = anchorRef.current.getBoundingClientRect()
    style.bottom = `${window.innerHeight - rect.top + 8}px`
    style.right = `${window.innerWidth - rect.right}px`
  }

  const options = [
    { id: 'all', label: 'Close all' },
    { id: 'profitable', label: 'Close all profitable' },
    { id: 'losing', label: 'Close all losing' },
    { id: 'buy', label: 'Close all Buy' },
    { id: 'sell', label: 'Close all Sell' }
  ]

  return (
    <div 
      ref={dropdownRef}
      style={style}
      className="fixed z-[100] bg-[#2a3038] rounded-lg shadow-2xl w-[320px] border border-[#363c47] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="p-4">
        <h3 className="text-white font-medium text-[14px] mb-3">
          Close all positions at the market prices?
        </h3>

        <div className="space-y-2">
          {options.map(opt => {
            const stat = stats[opt.id]
            const isDisabled = stat.count === 0

            return (
              <label 
                key={opt.id}
                className={`flex items-center justify-between cursor-pointer group p-2 rounded hover:bg-[#363c47] transition-colors ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-4 h-4">
                    <input
                      type="radio"
                      name="closeOption"
                      value={opt.id}
                      checked={selectedOption === opt.id}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      disabled={isDisabled}
                      className="peer appearance-none w-4 h-4 border border-[#565c66] rounded-full checked:border-[#fcd535] checked:bg-[#fcd535] transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#e1e3e6] text-[13px]">{opt.label}</span>
                    {stat.count > 0 && (
                      <span className="bg-[#141d22] text-[#b2b5be] text-[10px] px-1.5 py-0.5 rounded">
                        {stat.count}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[13px] font-mono ${getColor(stat.pl)}`}>
                  {formatPL(stat.pl)}
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-[13px] font-medium text-[#e1e3e6] bg-[#363c47] hover:bg-[#404652] transition-colors rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(selectedOption)
              onClose()
            }}
            className="flex-1 py-2 text-[13px] font-medium text-[#141d22] bg-[#fcd535] hover:bg-[#ffe54f] transition-colors rounded"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
