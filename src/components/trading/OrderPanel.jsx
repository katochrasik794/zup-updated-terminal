import { useState } from 'react'
import { ChevronDown, X, Minus, Plus, HelpCircle } from 'lucide-react'
import FlagIcon from '../ui/FlagIcon'
import OrderModeModal from '../modals/OrderModeModal'

export default function OrderPanel({ onClose }) {
  const [isPending, setIsPending] = useState(false)
  const [orderSide, setOrderSide] = useState(null)
  const [volume, setVolume] = useState('0.01')
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState('Regular form')
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [pendingMode, setPendingMode] = useState(null)

  const handleModeSelect = (mode) => {
    setIsModeDropdownOpen(false)
    if (mode === 'Regular form') {
      setSelectedMode(mode)
    } else {
      setPendingMode(mode)
      setShowModeModal(true)
    }
  }

  const handleModeConfirm = (dontShowAgain) => {
    setSelectedMode(pendingMode)
    setShowModeModal(false)
    setPendingMode(null)
    // Here you could save dontShowAgain preference to local storage
  }

  return (
    <div className="bg-[#141d22] flex flex-col h-full w-full overflow-hidden text-[#c0c0c0] font-sans border-l border-[#2a2f36] rounded-l-md">
      <form className="flex flex-col h-full overflow-y-auto overflow-x-hidden custom-scrollbar" onSubmit={(e) => e.preventDefault()}>
        
        {/* Header */}
        <div className="px-2 py-4 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-200 font-medium text-[14px]">
              <div className="w-4 h-4 rounded-full overflow-hidden">
                 <FlagIcon type="xauusd" />
              </div>
              XAU/USD
            </div>
          </div>
          <button 
            className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 hover:bg-gray-800 rounded-md" 
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Select */}
        <div className="px-2 pb-4 flex-shrink-0 relative z-50">
          <div className="relative">
            <button 
              type="button" 
              onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
              className="w-full bg-[#141d22] border-[1px] border-gray-600 rounded px-3 py-2 text-gray-200 text-[14px] flex items-center justify-between hover:border-gray-400 transition-colors cursor-pointer"
            >
              <span>{selectedMode}</span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isModeDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-[#2a2f36] border border-[#3b4148] rounded-md shadow-xl overflow-hidden py-1 z-50">
                {['Regular form', 'One-click form', 'Risk calculator form'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeSelect(mode)}
                    className={`w-full text-left px-3 py-2 text-[14px] text-[#c0c0c0] hover:bg-[#3b4148] hover:text-gray-200 transition-colors cursor-pointer ${selectedMode === mode ? 'bg-[#3b4148] text-gray-200' : ''}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inputs Container */}
        <div className="px-2 flex-col flex gap-2">
          
          {/* Order Buttons & Sentiment */}
          <div>
            <div className="flex gap-1 mb-1 relative">
              {/* Sell Button */}
              <button 
                className={`flex-1 rounded-sm border px-2 pt-2 flex flex-col items-start transition-colors relative overflow-hidden group cursor-pointer ${
                  orderSide === 'sell' 
                    ? 'bg-[#eb483f] border-[#eb483f]' 
                    : 'bg-transparent border-[#ff444f] hover:bg-[#ff444f]/5'
                }`}
                type="button"
                onClick={() => setOrderSide('sell')}
              >
                <span className={`${orderSide === 'sell' ? 'text-white' : 'text-[#ff444f]'} text-[12px] mb-0 font-normal opacity-60`}>Sell</span>
                <div className={`flex items-baseline ${orderSide === 'sell' ? 'text-white' : 'text-[#ff444f]'}`}>
                  <span className="text-[16px]">4,186.</span>
                  <span className="text-[24px] font-bold">36</span>
                  <span className="text-[14px] align-top ml-0.5 -mt-1">5</span>
                </div>
              </button>

              {/* Buy Button */}
              <button 
                className={`flex-1 rounded-sm border px-2 pt-2 flex flex-col items-end transition-colors relative overflow-hidden group cursor-pointer ${
                  orderSide === 'buy' 
                    ? 'bg-[#158bf9] border-[#158bf9]' 
                    : 'bg-transparent border-[#007bff] hover:bg-[#007bff]/5'
                }`}
                type="button"
                onClick={() => setOrderSide('buy')}
              >
                <span className={`${orderSide === 'buy' ? 'text-white' : 'text-[#007bff]'} text-[12px] mb-0 font-normal opacity-60`}>Buy</span>
                <div className={`flex items-baseline ${orderSide === 'buy' ? 'text-white' : 'text-[#007bff]'}`}>
                  <span className="text-[16px]">4,186.</span>
                  <span className="text-[24px] font-bold">36</span>
                  <span className="text-[14px] align-top ml-0.5 -mt-1">5</span>
                </div>
              </button>

              {/* Spread Badge */}
              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-10">
                 <div className="bg-[#141d22] text-white text-[11px] px-1.5 py-0.5 rounded border border-gray-600 shadow-sm">
                   0.00 USD
                 </div>
              </div>
            </div>

            {/* Sentiment Bar */}
            <div className="mb-1 mt-2 flex items-center gap-2">
              <span className="text-[#ff444f] text-[12px] font-medium">27%</span>
              <div className="h-[4px] flex-1 bg-[#2a2f36] rounded-full overflow-hidden flex">
                <div className="h-full bg-[#ff444f] w-[27%]"></div>
                <div className="h-full bg-[#007bff] w-[73%]"></div>
              </div>
              <span className="text-[#007bff] text-[12px] font-medium">73%</span>
            </div>
          </div>

          {/* Tabs (Market / Pending) */}
          <div className="bg-[#141d22] p-1 rounded-md flex border-[1px] border-gray-500">
            <button 
              className={`flex-1 py-1 text-[14px] border border-transparent hover:border-gray-400 font-medium rounded-md transition-colors cursor-pointer ${
                !isPending ? 'bg-[#222d35] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              type="button"
              onClick={() => setIsPending(false)}
            >
              Market
            </button>
            <button 
              className={`flex-1 py-1 text-[14px] border border-transparent hover:border-gray-400 font-medium rounded-md transition-colors cursor-pointer ${
                isPending ? 'bg-[#222d35] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              type="button"
              onClick={() => setIsPending(true)}
            >
              Pending
            </button>
          </div>

          {/* Open Price (Pending Only) */}
          {isPending && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <label className="text-[#c0c0c0] text-[12px]">Open price</label>
                <HelpCircle size={14} className="text-gray-500" />
              </div>
              <div className="flex items-center h-[36px] border border-[#2a2f36] rounded bg-[#1e2329] hover:border-gray-500 transition-colors group">
                <div className="relative flex-1 h-full">
                  <input 
                    type="text" 
                    defaultValue="4068.515"
                    className="w-full h-full bg-transparent border-none px-3 text-white text-[14px] focus:outline-none font-medium"
                  />
                  <div className="absolute right-0 top-0 h-full flex items-center pr-2 gap-1">
                    <span className="bg-gray-700 text-[10px] px-1.5 py-0.5 rounded text-white">Stop</span>
                  </div>
                </div>
                <div className="flex items-center h-full border-l border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                  <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                    <Minus size={14} />
                  </button>
                  <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1 text-right">
                +31.0 pips
              </div>
            </div>
          )}

          {/* Volume Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5 ">
              <label className="text-gray-100 text-[12px]">Volume</label>
            </div>
            <div className="flex items-center h-[36px] border-[1px] border-gray-600 rounded bg-transparent hover:border-gray-400 transition-colors group">
              <div className="relative flex-1 h-full">
                <input 
                  type="text" 
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full h-full bg-transparent border-none px-3 text-white text-[14px] focus:outline-none font-medium"
                />
              </div>
              <div className="flex items-center h-full border-l border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                <div className="px-3 text-[12px] text-gray-400 border-r border-[#2a2f36] h-full flex items-center group-hover:border-gray-500 transition-colors">
                  Lots
                </div>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                  <Minus size={14} />
                </button>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Take Profit */}
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label className="text-gray-100 text-[12px]">Take Profit</label>
              <HelpCircle size={14} className="text-gray-500" />
            </div>
            <div className="flex items-center h-[36px] border-[1px] border-gray-600 rounded bg-transparent hover:border-gray-500 transition-colors group">
              <div className="relative flex-1 h-full">
                <input 
                  type="text" 
                  placeholder="Not set"
                  className="w-full h-full bg-transparent border-none px-3 text-white text-[14px] focus:outline-none placeholder-gray-500"
                />
              </div>
              <div className="flex items-center h-full border-l border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                <button type="button" className="px-2 h-full flex items-center gap-1 text-[12px] text-gray-400 hover:text-white border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors cursor-pointer">
                  Price <ChevronDown size={12} />
                </button>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                  <Minus size={14} />
                </button>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Stop Loss */}
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label className="text-gray-100 text-[12px]">Stop Loss</label>
              <HelpCircle size={14} className="text-gray-500" />
            </div>
            <div className="flex items-center h-[36px] border-[1px] border-gray-500 rounded bg-transparent hover:border-gray-500 transition-colors group">
              <div className="relative flex-1 h-full">
                <input 
                  type="text" 
                  placeholder="Not set"
                  className="w-full h-full bg-transparent border-none px-3 text-white text-[14px] focus:outline-none placeholder-gray-500"
                />
              </div>
              <div className="flex items-center h-full border-l border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                <button type="button" className="px-2 h-full flex items-center gap-1 text-[12px] text-gray-400 hover:text-white border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors cursor-pointer">
                  Price <ChevronDown size={12} />
                </button>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer border-r border-[#2a2f36] group-hover:border-gray-500 transition-colors">
                  <Minus size={14} />
                </button>
                <button type="button" className="w-[36px] h-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Confirmation Button & Footer (Only when orderSide is selected) */}
        {orderSide && (
          <>
            <div className="px-2 mt-2 flex-shrink-0">
              <button 
                className={`w-full text-white font-medium py-2.5 rounded text-[14px] transition-colors shadow-lg cursor-pointer ${
                  orderSide === 'sell' 
                    ? 'bg-[#ff444f] hover:bg-[#eb3b46] shadow-red-900/20' 
                    : 'bg-[#007bff] hover:bg-[#0069d9] shadow-blue-900/20'
                }`}
                type="submit"
              >
                Confirm {orderSide === 'sell' ? 'Sell' : 'Buy'} {volume} lots
              </button>
              
              <button 
                className="w-full mt-2 py-2 bg-gray-800 text-white text-[13px] transition-colors border border-transparent hover:border-gray-400 rounded cursor-pointer"
                type="button"
                onClick={() => setOrderSide(null)}
              >
                Cancel
              </button>
            </div>

            {/* Footer Details */}
            <div className="px-2 py-2 flex-shrink-0 space-y-1">
              <div className="flex items-center justify-between text-[12px] font-medium">
                <span className="text-gray-400">Fees:</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-300">≈ 0.11 USD</span>
                  <HelpCircle size={12} className="text-gray-500" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px] font-medium">
                <span className="text-gray-400">Leverage:</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-300">1:2000</span>
                  <HelpCircle size={12} className="text-gray-500" />  
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px] font-medium">
                <span className="text-gray-400">Margin:</span>
                <span className="text-gray-300">2.10 USD</span>
              </div>

              {isDetailsExpanded && (
                <>
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span className="text-gray-400">Swap:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-300">0.00 USD</span>
                      <HelpCircle size={12} className="text-gray-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span className="text-gray-400">Pip Value:</span>
                    <span className="text-gray-300">0.01 USD</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span className="text-gray-400">Volume in units:</span>
                    <span className="text-gray-300">1.00 Troy oz.</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span className="text-gray-400">Volume in USD:</span>
                    <span className="text-gray-300">4,203.70 USD</span>
                  </div>
                </>
              )}

              <button 
                className="text-gray-400 hover:text-white text-[12px] cursor-pointer flex items-center gap-1 mt-1 underline decoration-gray-500 hover:decoration-white underline-offset-2 transition-colors" 
                type="button"
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              >
                {isDetailsExpanded ? 'Less' : 'More'}
                <ChevronDown size={12} className={`transition-transform duration-200 ${isDetailsExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </>
        )}

      </form>

      <OrderModeModal 
        isOpen={showModeModal}
        onClose={() => {
          setShowModeModal(false)
          setPendingMode(null)
        }}
        onConfirm={handleModeConfirm}
        mode={pendingMode}
      />
    </div>
  )
}
