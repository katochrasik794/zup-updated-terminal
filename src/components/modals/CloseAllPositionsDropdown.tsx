"use client";
import { useEffect, useRef, useState } from 'react'

export default function CloseAllPositionsDropdown({ isOpen, onClose, onConfirm, positions, anchorRef }: any) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedOption, setSelectedOption] = useState('all')

  // Calculate stats
  const stats = positions.reduce((acc: any, pos: any) => {
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

  const formatPL = (val: number) => {
    if (val === 0) return '--'
    const sign = val > 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}`
  }

  const getColor = (val: number) => {
    if (val === 0) return 'text-gray-400'
    return val > 0 ? 'text-success' : 'text-danger'
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)) {
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
  const style: React.CSSProperties = {}
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
      className="fixed z-[100] bg-background rounded-lg shadow-2xl w-[320px] border border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="p-4">
        <h3 className="text-foreground font-medium text-[14px] mb-3">
          Close all positions at the market prices?
        </h3>

        <div className="space-y-2">
          {options.map(opt => {
            const stat = stats[opt.id]
            const isDisabled = stat.count === 0

            return (
              <label
                key={opt.id}
                className={`flex items-center justify-between cursor-pointer group p-2 rounded hover:bg-gray-700 transition-colors ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
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
                      className="peer appearance-none w-4 h-4 border border-[#565c66] rounded-full checked:border-primary checked:bg-primary transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#e1e3e6] text-[13px]">{opt.label}</span>
                    {stat.count > 0 && (
                      <span className="bg-[#141d22] text-gray-300 text-[10px] px-1.5 py-0.5 rounded">
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
            className="flex-1 py-2 text-[13px] font-medium text-[#e1e3e6] bg-gray-800 hover:bg-gray-700 transition-colors rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(selectedOption)
              onClose()
            }}
            className="flex-1 py-2 text-[13px] font-medium text-[#141d22] bg-primary hover:bg-[#ffe54f] transition-colors rounded"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
