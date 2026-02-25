'use client';

import { useEffect, useRef, useState } from 'react'

export default function CloseAllPositionsModal({ isOpen, onClose, onConfirm, positions }) {
  const modalRef = useRef(null)
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
    if (val === 0) return 'text-gray-400'
    return val > 0 ? 'text-success' : 'text-danger'
  }

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const options = [
    { id: 'all', label: 'Close all' },
    { id: 'profitable', label: 'Close all profitable' },
    { id: 'losing', label: 'Close all losing' },
    { id: 'buy', label: 'Close all Buy' },
    { id: 'sell', label: 'Close all Sell' }
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="bg-background rounded-lg shadow-2xl w-[400px] border border-gray-800 overflow-hidden"
      >
        <div className="p-6">
          <h3 className="text-foreground font-medium text-[16px] mb-4">
            Close all positions at the market prices?
          </h3>

          <div className="space-y-4">
            {options.map(opt => {
              const stat = stats[opt.id]
              const isDisabled = stat.count === 0

              return (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between cursor-pointer group ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input
                        type="radio"
                        name="closeOption"
                        value={opt.id}
                        checked={selectedOption === opt.id}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        disabled={isDisabled}
                        className="peer appearance-none w-5 h-5 border-2 border-[#565c66] rounded-full checked:border-[#b2b5be] checked:bg-[#b2b5be] transition-colors"
                      />
                      <div className="absolute w-2 h-2 bg-[#2a3038] rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#e1e3e6] text-[14px]">{opt.label}</span>
                      {stat.count > 0 && (
                        <span className="bg-gray-800 text-gray-300 text-[11px] px-1.5 py-0.5 rounded">
                          {stat.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[14px] font-mono ${getColor(stat.pl)}`}>
                    {formatPL(stat.pl)}
                  </span>
                </label>
              )
            })}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-[14px] font-medium text-[#e1e3e6] bg-gray-800 hover:bg-gray-700 transition-colors rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm(selectedOption)
                onClose()
              }}
              className="flex-1 py-2.5 text-[14px] font-medium text-[#141d22] bg-primary hover:bg-[#ffe54f] transition-colors rounded"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
