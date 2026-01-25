"use client";

import * as React from "react"
import { X, Plus, Minus, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Tooltip from "@/components/ui/Tooltip"
import FlagIcon from "@/components/ui/FlagIcon"
import { useTrading } from '../../context/TradingContext'
import { useWebSocket } from '../../context/WebSocketContext'
import { useAccount } from '../../context/AccountContext'
import OrderModeModal from '../modals/OrderModeModal'

export interface OrderPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
  onBuy?: (data: OrderData) => void
  onSell?: (data: OrderData) => void
}

export interface OrderData {
  orderType: "market" | "pending" | "limit"
  pendingOrderType?: "limit" | "stop" // For pending orders: "limit" = Buy/Sell Limit, "stop" = Buy/Sell Stop
  volume: number
  openPrice?: number
  stopLoss?: number
  takeProfit?: number
  risk?: number
}

type FormType = "one-click" | "regular" | "risk-calculator"

const OrderPanel: React.FC<OrderPanelProps> = ({
  onClose,
  onBuy,
  onSell,
  className,
  ...props
}) => {
  const { symbol } = useTrading()
  const { subscribe, unsubscribe, lastQuotes, normalizeSymbol, isConnected } = useWebSocket()
  const { currentBalance } = useAccount()

  // Get real-time prices from WebSocket
  const hubSymbol = React.useMemo(() => (symbol || 'BTCUSD').replace('/', ''), [symbol])
  
  React.useEffect(() => {
    if (hubSymbol) {
      subscribe([hubSymbol])
      return () => unsubscribe([hubSymbol])
    }
  }, [hubSymbol, subscribe, unsubscribe])

  const quote = lastQuotes[normalizeSymbol(hubSymbol)] || {}
  
  // Use live prices if available, otherwise fall back to defaults
  const currentSellPrice = quote.bid ?? 0
  const currentBuyPrice = quote.ask ?? 0
  const currentSpread = quote.spread !== undefined ? `${quote.spread.toFixed(2)} pips` : '0.00 pips'
  
  const [formType, setFormType] = React.useState<FormType>("regular")
  const [orderType, setOrderType] = React.useState<"market" | "limit" | "pending">("market")
  const [pendingOrderType, setPendingOrderType] = React.useState<"limit" | "stop">("limit") // For pending orders: limit or stop
  const [volume, setVolume] = React.useState("0.01")
  const [risk, setRisk] = React.useState("")
  const [riskMode, setRiskMode] = React.useState<"usd" | "percent">("usd")
  const [takeProfit, setTakeProfit] = React.useState("")
  const [takeProfitMode, setTakeProfitMode] = React.useState<"pips" | "price">("price")
  const [stopLoss, setStopLoss] = React.useState("")
  const [stopLossMode, setStopLossMode] = React.useState<"pips" | "price">("price")
  const [openPrice, setOpenPrice] = React.useState("")
  const [showMoreDetails, setShowMoreDetails] = React.useState(false)
  const [showOneClickModal, setShowOneClickModal] = React.useState(false)
  const [showRiskCalculatorModal, setShowRiskCalculatorModal] = React.useState(false)
  const [pendingFormType, setPendingFormType] = React.useState<FormType | null>(null)
  const [pendingOrderSide, setPendingOrderSide] = React.useState<'buy' | 'sell' | null>(null)

  // Check if user has dismissed the one-click modal
  const shouldShowOneClickModal = React.useCallback(() => {
    if (typeof window === 'undefined') return false
    const dismissed = localStorage.getItem('zup_oneclick_modal_dismissed')
    return dismissed !== 'true'
  }, [])

  // Check if user has dismissed the risk calculator modal
  const shouldShowRiskCalculatorModal = React.useCallback(() => {
    if (typeof window === 'undefined') return false
    const dismissed = localStorage.getItem('zup_riskcalculator_modal_dismissed')
    return dismissed !== 'true'
  }, [])

  // Handle form type change - show modal for one-click or risk calculator if needed
  const handleFormTypeChange = React.useCallback((newFormType: FormType) => {
    if (newFormType === "one-click" && shouldShowOneClickModal()) {
      setPendingFormType(newFormType)
      setShowOneClickModal(true)
    } else if (newFormType === "risk-calculator" && shouldShowRiskCalculatorModal()) {
      setPendingFormType(newFormType)
      setShowRiskCalculatorModal(true)
    } else {
      setFormType(newFormType)
    }
  }, [shouldShowOneClickModal, shouldShowRiskCalculatorModal])

  // Handle one-click modal confirmation
  const handleOneClickModalConfirm = React.useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('zup_oneclick_modal_dismissed', 'true')
    }
    if (pendingFormType) {
      setFormType(pendingFormType)
      setPendingFormType(null)
    }
    setShowOneClickModal(false)
  }, [pendingFormType])

  // Handle one-click modal cancel
  const handleOneClickModalCancel = React.useCallback(() => {
    setShowOneClickModal(false)
    setPendingFormType(null)
  }, [])

  // Handle risk calculator modal confirmation
  const handleRiskCalculatorModalConfirm = React.useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('zup_riskcalculator_modal_dismissed', 'true')
    }
    if (pendingFormType) {
      setFormType(pendingFormType)
      setPendingFormType(null)
    }
    setShowRiskCalculatorModal(false)
  }, [pendingFormType])

  // Handle risk calculator modal cancel
  const handleRiskCalculatorModalCancel = React.useCallback(() => {
    setShowRiskCalculatorModal(false)
    setPendingFormType(null)
  }, [])

  // Update dropdown modes when form type changes
  React.useEffect(() => {
    if (formType === "regular") {
      setTakeProfitMode("price")
      setStopLossMode("price")
    } else if (formType === "risk-calculator") {
      setTakeProfitMode("pips")
      setStopLossMode("pips")
      setRiskMode("usd")
    }
    // Reset pending order side when form type changes
    setPendingOrderSide(null)
  }, [formType])
  
  // Get pip size based on symbol type
  const getPipSize = React.useMemo(() => {
    const symbolUpper = (symbol || '').toUpperCase()
    if (symbolUpper.includes('JPY')) {
      return 0.01
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('BTCUSD')) {
      return 0.10
    } else if (symbolUpper.includes('ETH') || symbolUpper.includes('ETHUSD')) {
      return 0.01
    } else if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
      return 0.01
    } else {
      return 0.0001
    }
  }, [symbol])
  
  // Get pip value per lot based on symbol type
  const getPipValuePerLot = React.useMemo(() => {
    const symbolUpper = (symbol || '').toUpperCase()
    if (symbolUpper.includes('JPY')) {
      return 10
    } else if (symbolUpper.includes('XAU') || symbolUpper.includes('GOLD')) {
      return 10
    } else if (symbolUpper.includes('XAG') || symbolUpper.includes('SILVER')) {
      return 10
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('BTCUSD')) {
      return getPipSize
    } else if (symbolUpper.includes('ETH') || symbolUpper.includes('ETHUSD')) {
      return getPipSize
    } else {
      return 10
    }
  }, [symbol, getPipSize])
  
  // Calculate SL and TP prices from pips (for risk calculator)
  const calculatePriceFromPips = React.useCallback((pips: number, isBuy: boolean, isStopLoss: boolean = false) => {
    if (pips === null || pips === undefined || isNaN(pips)) return null
    const pipSize = getPipSize
    const priceChange = pips * pipSize
    if (isBuy) {
      return currentBuyPrice + priceChange
    } else {
      return currentSellPrice - priceChange
    }
  }, [getPipSize, currentBuyPrice, currentSellPrice])
  
  // Calculate volume for risk calculator based on Risk and Stop Loss
  const calculateRiskBasedVolume = React.useMemo(() => {
    if (formType !== "risk-calculator" || !risk || !stopLoss || stopLossMode !== "pips" || riskMode !== "usd") {
      return null
    }
    
    const riskAmount = parseFloat(risk)
    const stopLossPips = Math.abs(parseFloat(stopLoss))
    
    if (!riskAmount || !stopLossPips || stopLossPips <= 0 || riskAmount <= 0) {
      return null
    }
    
    const pipValuePerLot = getPipValuePerLot
    const calculatedVolume = riskAmount / (stopLossPips * pipValuePerLot)
    const clampedVolume = Math.max(0.01, Math.min(50.00, calculatedVolume))
    
    return clampedVolume
  }, [formType, risk, stopLoss, stopLossMode, riskMode, getPipValuePerLot])
  
  // Calculate SL and TP prices from pips
  const calculatedStopLossPrice = React.useMemo(() => {
    if (formType !== "risk-calculator" || !stopLoss || stopLossMode !== "pips") return null
    const pips = parseFloat(stopLoss)
    if (isNaN(pips)) return null
    return calculatePriceFromPips(pips, true, true)
  }, [formType, stopLoss, stopLossMode, calculatePriceFromPips])

  const calculatedTakeProfitPrice = React.useMemo(() => {
    if (formType !== "risk-calculator" || !takeProfit || takeProfitMode !== "pips") return null
    const pips = parseFloat(takeProfit)
    if (isNaN(pips) || pips <= 0) return null
    return calculatePriceFromPips(pips, true, false)
  }, [formType, takeProfit, takeProfitMode, calculatePriceFromPips])
  
  // Update volume when risk calculator values change
  React.useEffect(() => {
    if (formType === "risk-calculator" && calculateRiskBasedVolume !== null) {
      setVolume(calculateRiskBasedVolume.toFixed(2))
    }
  }, [formType, calculateRiskBasedVolume])

  const handleVolumeChange = (value: string) => {
    if (value === '') {
      setVolume('')
      return
    }
    
    const trimmedValue = value.trim()
    
    if (!/^[\d.]*$/.test(trimmedValue) || (trimmedValue.match(/\./g) || []).length > 1) {
      return
    }
    
    const decimalIndex = trimmedValue.indexOf('.')
    if (decimalIndex !== -1) {
      const decimalPart = trimmedValue.substring(decimalIndex + 1)
      if (decimalPart.length > 2) {
        const truncated = trimmedValue.substring(0, decimalIndex + 3)
        setVolume(truncated)
        return
      }
    }
    
    setVolume(trimmedValue)
  }

  const incrementVolume = () => {
    const currentValue = parseFloat(volume) || 0.01
    const roundedCurrent = Math.round(currentValue * 100) / 100
    const newValue = Math.min(50.00, roundedCurrent + 0.01)
    setVolume(newValue.toFixed(2))
  }

  const decrementVolume = () => {
    const currentValue = parseFloat(volume) || 0.01
    const roundedCurrent = Math.round(currentValue * 100) / 100
    const newValue = Math.max(0.01, roundedCurrent - 0.01)
    setVolume(newValue.toFixed(2))
  }

  const incrementField = (value: string, setter: (v: string) => void) => {
    const basePrice = value && !isNaN(parseFloat(value)) ? parseFloat(value) : currentBuyPrice
    setter((basePrice + 0.001).toFixed(3))
  }

  const decrementField = (value: string, setter: (v: string) => void) => {
    const basePrice = value && !isNaN(parseFloat(value)) ? parseFloat(value) : currentBuyPrice
    setter(Math.max(0, basePrice - 0.001).toFixed(3))
  }

  // Render buy/sell price buttons with spread overlay - solid backgrounds for one-click
  const renderPriceButtonsSolid = () => (
    <div className="relative grid grid-cols-2 gap-3">
      <button
        onClick={() => onSell?.({
          orderType,
          pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : currentSellPrice,
          stopLoss: undefined,
          takeProfit: undefined,
        })}
        className="rounded-md p-3 bg-[#FF5555] hover:bg-[#FF5555]/90 cursor-pointer text-left"
      >
        <div className="text-xs text-white/80 mb-1">Sell</div>
        <div className="price-font text-white font-bold text-sm leading-tight">
          {Math.floor(currentSellPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentSellPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentSellPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      <button
        onClick={() => onBuy?.({
          orderType,
          pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : currentBuyPrice,
          stopLoss: undefined,
          takeProfit: undefined,
        })}
        className="rounded-md p-3 bg-[#4A9EFF] hover:bg-[#4A9EFF]/90 cursor-pointer text-right"
      >
        <div className="text-xs text-white/80 mb-1">Buy</div>
        <div className="price-font text-white font-bold text-sm leading-tight">
          {Math.floor(currentBuyPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentBuyPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentBuyPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-white/10 text-[10px] text-white/80 font-medium whitespace-nowrap z-10">
        {currentSpread} {isConnected && <span className="text-green-500 ml-1">●</span>}
      </div>
    </div>
  )

  // Render buy/sell price buttons with spread overlay - bordered for regular/risk calculator
  // In regular form, clicking these buttons sets pendingOrderSide to show confirmation
  const renderPriceButtonsBordered = (readOnly: boolean = false, showConfirmation: boolean = false) => {
    const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null 
      ? calculateRiskBasedVolume 
      : (parseFloat(volume) || 0.01)
    
    let finalStopLoss: number | undefined = undefined
    let finalTakeProfit: number | undefined = undefined
    
    if (formType === "risk-calculator") {
      finalStopLoss = calculatedStopLossPrice ?? undefined
      finalTakeProfit = calculatedTakeProfitPrice ?? undefined
    } else {
      // Regular form: convert pips to price if needed
      if (stopLoss) {
        if (stopLossMode === "price") {
          finalStopLoss = parseFloat(stopLoss)
        } else if (stopLossMode === "pips") {
          // Convert pips to price - for buy orders, negative pips means price goes down (SL below entry)
          // For sell orders, positive pips means price goes up (SL above entry)
          const pips = parseFloat(stopLoss)
          if (!isNaN(pips)) {
            const pipSize = getPipSize
            const priceChange = pips * pipSize
            // Use buy price as base for calculation (will be adjusted based on order side in API)
            finalStopLoss = currentBuyPrice + priceChange
          }
        }
      }
      
      if (takeProfit) {
        if (takeProfitMode === "price") {
          finalTakeProfit = parseFloat(takeProfit)
        } else if (takeProfitMode === "pips") {
          // Convert pips to price - for buy orders, positive pips means price goes up (TP above entry)
          // For sell orders, negative pips means price goes down (TP below entry)
          const pips = parseFloat(takeProfit)
          if (!isNaN(pips) && pips > 0) {
            const pipSize = getPipSize
            const priceChange = pips * pipSize
            // Use buy price as base for calculation
            finalTakeProfit = currentBuyPrice + priceChange
          }
        }
      }
    }
    
    const finalOpenPrice = orderType !== "market" && openPrice 
      ? parseFloat(openPrice) 
      : undefined
    
    return (
      <div className="relative grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`rounded-md p-3 border-2 border-[#FF5555] bg-transparent ${readOnly ? '' : 'hover:bg-[#FF5555]/10'} text-left cursor-pointer`}
          onClick={readOnly ? undefined : () => {
            if (showConfirmation) {
              // In regular form, set pending order side to show confirmation
              setPendingOrderSide('sell')
            } else {
              // In risk calculator or pending orders, place order directly
              if (!onSell) return
              if (!finalVolume || finalVolume <= 0) {
                console.warn('Invalid volume for sell order:', finalVolume)
                return
              }
              // For pending orders, validate that openPrice is provided
              if (orderType === 'pending' && !finalOpenPrice) {
                alert('Please enter an open price for pending orders')
                return
              }
              const orderData: OrderData = {
                orderType,
                pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
                volume: finalVolume,
                openPrice: orderType === 'market' ? currentSellPrice : finalOpenPrice,
                stopLoss: finalStopLoss,
                takeProfit: finalTakeProfit,
              }
              onSell(orderData)
            }
          }}
          disabled={readOnly}
        >
          <div className="text-xs text-white/60 mb-1">Sell</div>
          <div className="price-font text-[#FF5555] font-bold text-sm leading-tight">
            {Math.floor(currentSellPrice).toLocaleString()}
            <span className="text-lg">.{String(Math.floor((currentSellPrice % 1) * 100)).padStart(2, '0')}</span>
            <sup className="text-sm">{String(Math.floor((currentSellPrice % 1) * 1000) % 10)}</sup>
          </div>
        </button>

        <button
          type="button"
          className={`rounded-md p-3 border-2 border-[#4A9EFF] bg-transparent ${readOnly ? '' : 'hover:bg-[#4A9EFF]/10'} text-right cursor-pointer`}
          onClick={readOnly ? undefined : () => {
            if (showConfirmation) {
              // In regular form, set pending order side to show confirmation
              setPendingOrderSide('buy')
            } else {
              // In risk calculator or pending orders, place order directly
              if (!onBuy) return
              if (!finalVolume || finalVolume <= 0) {
                console.warn('Invalid volume for buy order:', finalVolume)
                return
              }
              // For pending orders, validate that openPrice is provided
              if (orderType === 'pending' && !finalOpenPrice) {
                alert('Please enter an open price for pending orders')
                return
              }
              const orderData: OrderData = {
                orderType,
                pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
                volume: finalVolume,
                openPrice: orderType === 'market' ? currentBuyPrice : finalOpenPrice,
                stopLoss: finalStopLoss,
                takeProfit: finalTakeProfit,
              }
              onBuy(orderData)
            }
          }}
          disabled={readOnly}
        >
          <div className="text-xs text-white/60 mb-1">Buy</div>
          <div className="price-font text-[#4A9EFF] font-bold text-sm leading-tight">
            {Math.floor(currentBuyPrice).toLocaleString()}
            <span className="text-lg">.{String(Math.floor((currentBuyPrice % 1) * 100)).padStart(2, '0')}</span>
            <sup className="text-sm">{String(Math.floor((currentBuyPrice % 1) * 1000) % 10)}</sup>
          </div>
        </button>

        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-white/10 text-[10px] text-white/80 font-medium whitespace-nowrap z-10">
          {currentSpread} {isConnected && <span className="text-green-500 ml-1">●</span>}
        </div>
      </div>
    )
  }

  // Calculate financial metrics in real-time
  const calculateFinancialMetrics = React.useMemo(() => {
    const vol = parseFloat(volume) || 0
    const price = orderType === "limit" && openPrice ? parseFloat(openPrice) : currentBuyPrice
    const symbolUpper = (symbol || '').toUpperCase()
    
    let contractSize = 100000
    let pipValue = 0.0001
    
    if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
      contractSize = 100
      pipValue = 0.01
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
      contractSize = 1
      pipValue = 0.01
    } else {
      contractSize = 100000
      pipValue = symbolUpper.includes('JPY') ? 0.01 : 0.0001
    }
    
    const leverageStr = String(currentBalance?.leverage || "1:400")
    const leverageMatch = leverageStr.match(/:?(\d+)/)
    const leverage = leverageMatch ? parseInt(leverageMatch[1], 10) : 400
    
    const margin = (vol * contractSize * price) / leverage
    const tradeValue = vol * contractSize * price
    const fees = tradeValue * 0.001
    const calculatedPipValue = contractSize * pipValue * vol
    const swapLong = -(tradeValue * 0.0001)
    const swapShort = 0
    const volumeInUnits = vol * contractSize
    const volumeInUSD = tradeValue
    const credit = currentBalance?.credit || 0
    
    return {
      fees,
      leverage: `1:${leverage}`,
      margin,
      swapLong,
      swapShort,
      pipValue: calculatedPipValue,
      volumeInUnits,
      volumeInUSD,
      credit
    }
  }, [volume, currentBuyPrice, openPrice, orderType, symbol, currentBalance])
  
  // Render financial details section
  const renderFinancialDetails = () => (
    <div className="space-y-2 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Fees:</span>
        <div className="flex items-center gap-1">
          <span className="text-white price-font">≈ {calculateFinancialMetrics.fees.toFixed(2)} USD</span>
          <Tooltip text="Estimated commission and spread costs">
            <HelpCircle className="h-3 w-3 text-white/40" />
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Leverage:</span>
        <div className="flex items-center gap-1">
          <span className="text-white price-font">{calculateFinancialMetrics.leverage}</span>
          <Tooltip text="Account leverage ratio">
            <HelpCircle className="h-3 w-3 text-white/40" />
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Margin:</span>
        <span className="text-white price-font">{calculateFinancialMetrics.margin.toFixed(2)} USD</span>
      </div>
      
      {showMoreDetails && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Swap Long:</span>
            <div className="flex items-center gap-1">
              <span className="text-white price-font">{calculateFinancialMetrics.swapLong.toFixed(2)} USD</span>
              <Tooltip text="Overnight swap for long positions">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Swap Short:</span>
            <div className="flex items-center gap-1">
              <span className="text-white price-font">{calculateFinancialMetrics.swapShort.toFixed(2)} USD</span>
              <Tooltip text="Overnight swap for short positions">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Pip Value:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.pipValue.toFixed(2)} USD</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Volume in units:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.volumeInUnits.toFixed(2)} {symbol?.toUpperCase().includes('BTC') ? 'BTC' : symbol?.toUpperCase().includes('ETH') ? 'ETH' : symbol?.toUpperCase().includes('XAU') ? 'oz' : ''}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Volume in USD:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.volumeInUSD.toFixed(2)} USD</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Credit:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.credit.toFixed(2)} USD</span>
          </div>
        </>
      )}
      
      <button
        onClick={() => setShowMoreDetails(!showMoreDetails)}
        className="w-full flex items-center justify-center gap-1 text-xs text-white/60 hover:text-white/80 pt-1"
      >
        {showMoreDetails ? (
          <>
            <span>Less</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </>
        ) : (
          <>
            <span>More</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
    </div>
  )

  // Render input field with dropdown and +/- buttons
  const renderInputField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    mode: string,
    onModeChange: (v: string) => void,
    modeOptions: { value: string; label: string }[],
    showTooltip?: boolean
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-white/80">{label}</div>
        {showTooltip && (
          <Tooltip text={`Set ${label.toLowerCase()}`}>
            <HelpCircle className="h-3.5 w-3.5 text-white/40" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Not set"
          className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
        />
        <select value={mode} onChange={(e) => onModeChange(e.target.value)} className="w-[70px] border-0 h-9 bg-transparent text-xs text-white focus:outline-none focus:ring-0">
          {modeOptions.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1f28]">{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => decrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5 text-white/60" />
        </button>
        <button
          onClick={() => incrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-white/60" />
        </button>
      </div>
    </div>
  )

  // Get country code from symbol (simplified - can be enhanced)
  const getCountryCode = () => {
    const symbolUpper = (symbol || '').toUpperCase()
    if (symbolUpper.includes('USD')) return 'US'
    if (symbolUpper.includes('EUR')) return 'EU'
    if (symbolUpper.includes('GBP')) return 'GB'
    if (symbolUpper.includes('JPY')) return 'JP'
    return 'US'
  }

  return (
    <div className={cn("w-full h-full flex flex-col glass-card border border-white/10 rounded-lg overflow-hidden", className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5">
            <FlagIcon symbol={symbol || 'BTCUSD'} />
          </div>
          <span className="text-sm font-semibold text-white">{symbol || 'Select Symbol'}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:border border-transparent hover:border-white/20 cursor-pointer group"
            title="Close Order Panel"
          >
            <X className="h-4 w-4 text-white/60 group-hover:text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {/* Form Type Selector */}
        <select value={formType} onChange={(e) => handleFormTypeChange(e.target.value as FormType)} className="w-full bg-white/[0.02] border border-white/10 rounded-md h-9 px-3 text-sm text-white focus:outline-none focus:ring-0 focus:border-[#8B5CF6]">
          <option value="regular" className="bg-[#1a1f28]">Regular form</option>
          <option value="one-click" className="bg-[#1a1f28]">One-click form</option>
          <option value="risk-calculator" className="bg-[#1a1f28]">Risk calculator form</option>
        </select>

        {/* ONE-CLICK FORM */}
        {formType === "one-click" && (
          <>
            <Tabs value={orderType === "pending" ? "limit" : orderType} onValueChange={(value: string) => {
              setOrderType(value === "limit" ? "pending" : (value as "market" | "pending"))
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="limit">Limit</TabsTrigger>
              </TabsList>
            </Tabs>

            {orderType === "pending" && (
              <>
                {/* Pending Order Type Selector: Limit vs Stop */}
                <Tabs value={pendingOrderType} onValueChange={(value: string) => setPendingOrderType(value as "limit" | "stop")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="limit">Limit</TabsTrigger>
                    <TabsTrigger value="stop">Stop</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/80">Open price</div>
                    <Tooltip text={`Set open price for ${pendingOrderType === "limit" ? "limit" : "stop"} order`}>
                      <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                      {pendingOrderType === "limit" ? "Limit" : "Stop"}
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-white/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-white/80">Volume</div>
              <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={volume}
                  onChange={(e) => handleVolumeChange(e.target.value)}
                  onBlur={(e) => {
                    const numValue = parseFloat(e.target.value) || 0.01
                    const roundedValue = Math.round(numValue * 100) / 100
                    const clampedValue = Math.max(0.01, Math.min(50.00, roundedValue))
                    setVolume(clampedValue.toFixed(2))
                  }}
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                  Lots
                </div>
                <button
                  onClick={decrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-white/60" />
                </button>
                <button
                  onClick={incrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
            </div>

            {renderPriceButtonsSolid()}
            {renderFinancialDetails()}
          </>
        )}

        {/* REGULAR FORM */}
        {formType === "regular" && (
          <>
            {renderPriceButtonsBordered(false, true)}

            <Tabs value={orderType} onValueChange={(value: string) => setOrderType(value as "market" | "limit" | "pending")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            </Tabs>

            {orderType === "pending" && (
              <>
                {/* Pending Order Type Selector: Limit vs Stop */}
                <Tabs value={pendingOrderType} onValueChange={(value: string) => setPendingOrderType(value as "limit" | "stop")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="limit">Limit</TabsTrigger>
                    <TabsTrigger value="stop">Stop</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/80">Open price</div>
                    <Tooltip text={`Set open price for ${pendingOrderType === "limit" ? "limit" : "stop"} order`}>
                      <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                      {pendingOrderType === "limit" ? "Limit" : "Stop"}
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-white/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                      {pendingOrderType === "limit" && (
                        <span className="ml-2 text-white/40">
                          (Buy Limit: below current, Sell Limit: above current)
                        </span>
                      )}
                      {pendingOrderType === "stop" && (
                        <span className="ml-2 text-white/40">
                          (Buy Stop: above current, Sell Stop: below current)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-white/80">Volume</div>
              <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={volume}
                  onChange={(e) => handleVolumeChange(e.target.value)}
                  onBlur={(e) => {
                    const numValue = parseFloat(e.target.value) || 0.01
                    const roundedValue = Math.round(numValue * 100) / 100
                    const clampedValue = Math.max(0.01, Math.min(50.00, roundedValue))
                    setVolume(clampedValue.toFixed(2))
                  }}
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                  Lots
                </div>
                <button
                  onClick={decrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-white/60" />
                </button>
                <button
                  onClick={incrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
            </div>

            {renderInputField(
              "Take Profit",
              takeProfit,
              setTakeProfit,
              takeProfitMode,
              (value: string) => setTakeProfitMode(value as "pips" | "price"),
              [
                { value: "price", label: "Price" },
                { value: "pips", label: "Pips" }
              ],
              true
            )}

            {renderInputField(
              "Stop Loss",
              stopLoss,
              setStopLoss,
              stopLossMode,
              (value: string) => setStopLossMode(value as "pips" | "price"),
              [
                { value: "price", label: "Price" },
                { value: "pips", label: "Pips" }
              ],
              true
            )}

            {/* Confirmation Buttons - Only show when a side is selected */}
            {pendingOrderSide && (
              <>
                {/* Stop Loss Metrics - Show above confirmation button */}
                {stopLoss && (
                  <div className="flex items-center justify-center gap-4 pt-2 pb-1 text-xs text-white/60">
                    {stopLossMode === "pips" ? (
                      <>
                        <span>{stopLoss.startsWith('-') ? stopLoss : `-${stopLoss}`} pips</span>
                        <span className="text-white/40">|</span>
                        <span>
                          {(() => {
                            const pips = Math.abs(parseFloat(stopLoss) || 0)
                            const isBuy = pendingOrderSide === 'buy'
                            const calculatedPrice = calculatePriceFromPips(pips, isBuy, true)
                            if (calculatedPrice !== null) {
                              const priceDiff = isBuy 
                                ? currentBuyPrice - calculatedPrice 
                                : calculatedPrice - currentSellPrice
                              const pipValue = pips * getPipValuePerLot * (parseFloat(volume) || 0.01)
                              return `-${Math.abs(pipValue).toFixed(2)} USD`
                            }
                            return '-0.00 USD'
                          })()}
                        </span>
                        <span className="text-white/40">|</span>
                        <span>
                          {(() => {
                            const pips = Math.abs(parseFloat(stopLoss) || 0)
                            const pipValue = pips * getPipValuePerLot * (parseFloat(volume) || 0.01)
                            const balance = currentBalance?.equity || 1
                            const percent = (Math.abs(pipValue) / balance) * 100
                            return `-${percent.toFixed(2)} %`
                          })()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {(() => {
                            const slPrice = parseFloat(stopLoss) || 0
                            const isBuy = pendingOrderSide === 'buy'
                            const entryPrice = isBuy ? currentBuyPrice : currentSellPrice
                            const priceDiff = isBuy ? entryPrice - slPrice : slPrice - entryPrice
                            const pipSize = getPipSize
                            const pips = priceDiff / pipSize
                            return `${pips.toFixed(1)} pips`
                          })()}
                        </span>
                        <span className="text-white/40">|</span>
                        <span>
                          {(() => {
                            const slPrice = parseFloat(stopLoss) || 0
                            const isBuy = pendingOrderSide === 'buy'
                            const entryPrice = isBuy ? currentBuyPrice : currentSellPrice
                            const priceDiff = Math.abs(entryPrice - slPrice)
                            const pipSize = getPipSize
                            const pips = priceDiff / pipSize
                            const pipValue = pips * getPipValuePerLot * (parseFloat(volume) || 0.01)
                            return `-${pipValue.toFixed(2)} USD`
                          })()}
                        </span>
                        <span className="text-white/40">|</span>
                        <span>
                          {(() => {
                            const slPrice = parseFloat(stopLoss) || 0
                            const isBuy = pendingOrderSide === 'buy'
                            const entryPrice = isBuy ? currentBuyPrice : currentSellPrice
                            const priceDiff = Math.abs(entryPrice - slPrice)
                            const pipSize = getPipSize
                            const pips = priceDiff / pipSize
                            const pipValue = pips * getPipValuePerLot * (parseFloat(volume) || 0.01)
                            const balance = currentBalance?.equity || 1
                            const percent = (pipValue / balance) * 100
                            return `-${percent.toFixed(2)} %`
                          })()}
                        </span>
                      </>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      const handler = pendingOrderSide === 'buy' ? onBuy : onSell
                      if (!handler) return
                      const finalVolume = parseFloat(volume) || 0.01
                      if (finalVolume <= 0) {
                        console.warn(`Invalid volume for ${pendingOrderSide} order:`, finalVolume)
                        return
                      }
                      let finalStopLoss: number | undefined = undefined
                      let finalTakeProfit: number | undefined = undefined
                      
                      const isBuy = pendingOrderSide === 'buy'
                      
                      if (stopLossMode === "price") {
                        finalStopLoss = stopLoss ? parseFloat(stopLoss) : undefined
                      } else if (stopLossMode === "pips" && stopLoss) {
                        const pips = parseFloat(stopLoss)
                        if (!isNaN(pips)) {
                          const calculatedPrice = calculatePriceFromPips(pips, isBuy, true)
                          if (calculatedPrice !== null) {
                            finalStopLoss = calculatedPrice
                          }
                        }
                      }
                      
                      if (takeProfitMode === "price") {
                        finalTakeProfit = takeProfit ? parseFloat(takeProfit) : undefined
                      } else if (takeProfitMode === "pips" && takeProfit) {
                        const pips = parseFloat(takeProfit)
                        if (!isNaN(pips) && pips > 0) {
                          const calculatedPrice = calculatePriceFromPips(pips, isBuy, false)
                          if (calculatedPrice !== null) {
                            finalTakeProfit = calculatedPrice
                          }
                        }
                      }
                      
                      // For pending orders, validate that openPrice is provided
                      if (orderType === 'pending' && !openPrice) {
                        alert('Please enter an open price for pending orders')
                        return
                      }

                      const orderData: OrderData = {
                        orderType,
                        pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
                        volume: finalVolume,
                        openPrice: orderType === 'market' 
                          ? (pendingOrderSide === 'buy' ? currentBuyPrice : currentSellPrice)
                          : (openPrice ? parseFloat(openPrice) : undefined),
                        stopLoss: finalStopLoss,
                        takeProfit: finalTakeProfit,
                      }
                      handler(orderData)
                      setPendingOrderSide(null)
                    }}
                    className={`w-full ${pendingOrderSide === 'buy' ? 'bg-[#4A9EFF] hover:bg-[#4A9EFF]/90' : 'bg-[#FF5555] hover:bg-[#FF5555]/90'} text-white font-semibold py-3 px-4 rounded-md transition-colors flex flex-col items-center justify-center`}
                  >
                    <span className="text-sm">Confirm {pendingOrderSide === 'buy' ? 'Buy' : 'Sell'}</span>
                    <span className="text-xs opacity-90">{volume} lots</span>
                  </button>
                  <button
                    onClick={() => setPendingOrderSide(null)}
                    className="w-full bg-[#2a2f36] hover:bg-[#363c45] text-white font-medium py-2.5 px-4 rounded-md text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                
                {/* Financial Details - Show below confirmation buttons */}
                {renderFinancialDetails()}
              </>
            )}
          </>
        )}

        {/* RISK CALCULATOR FORM */}
        {formType === "risk-calculator" && (
          <>
            {renderPriceButtonsBordered(false)}
            
            <Tabs value={orderType} onValueChange={(value: string) => setOrderType(value as "market" | "limit" | "pending")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/80">Risk</div>
                <Tooltip text="Maximum amount you're willing to risk on this trade">
                  <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                <Input
                  type="number"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                />
                <select value={riskMode} onChange={(e) => setRiskMode(e.target.value as "usd" | "percent")} className="w-[70px] border-0 h-9 bg-transparent text-xs text-white focus:outline-none focus:ring-0">
                  <option value="usd" className="bg-[#1a1f28]">USD</option>
                  <option value="percent" className="bg-[#1a1f28]">%</option>
                </select>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(risk) || 0
                    setRisk(Math.max(0, currentValue - 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-white/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(risk) || 0
                    setRisk((currentValue + 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
              {riskMode === "percent" && risk && (
                <div className="text-xs text-white/60 text-center">
                  {((parseFloat(risk) || 0) * (currentBalance?.equity || 0) / 100).toFixed(2)} USD
                </div>
              )}
              {riskMode === "usd" && calculateRiskBasedVolume !== null && (
                <div className="text-xs text-white/80 text-center font-medium">
                  {calculateRiskBasedVolume.toFixed(2)} lots
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/80">Stop Loss</div>
                <Tooltip text="Stop loss distance in pips (negative for Buy, positive for Sell)">
                  <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                <Input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                />
                <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[70px] opacity-50">
                  Pips
                </div>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(stopLoss) || 0
                    setStopLoss((currentValue - 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-white/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(stopLoss) || 0
                    setStopLoss((currentValue + 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
              {calculatedStopLossPrice !== null && (
                <div className="space-y-0.5">
                  <div className="text-xs text-white/60 text-center">
                    {calculatedStopLossPrice.toFixed(2)}
                  </div>
                  {stopLoss && calculateRiskBasedVolume !== null && (
                    <div className="text-xs text-red-400/80 text-center font-medium">
                      {((Math.abs(parseFloat(stopLoss)) || 0) * getPipValuePerLot * calculateRiskBasedVolume).toFixed(2)} USD loss
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/80">Take Profit</div>
                <Tooltip text="Take profit distance in pips">
                  <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                <Input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                />
                <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[70px] opacity-50">
                  Pips
                </div>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(takeProfit) || 0
                    setTakeProfit(Math.max(0, currentValue - 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-white/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(takeProfit) || 0
                    setTakeProfit((currentValue + 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white/60" />
                </button>
              </div>
              {calculatedTakeProfitPrice !== null && (
                <div className="space-y-0.5">
                  <div className="text-xs text-white/60 text-center">
                    {calculatedTakeProfitPrice.toFixed(2)}
                  </div>
                  {takeProfit && calculateRiskBasedVolume !== null && (
                    <div className="text-xs text-green-400/80 text-center font-medium">
                      {((parseFloat(takeProfit) || 0) * getPipValuePerLot * calculateRiskBasedVolume).toFixed(2)} USD profit
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {renderFinancialDetails()}
          </>
        )}

      </div>

      {/* One-click Trading Modal */}
      <OrderModeModal
        isOpen={showOneClickModal}
        onClose={handleOneClickModalCancel}
        onConfirm={handleOneClickModalConfirm}
        mode="One-click form"
      />

      {/* Risk Calculator Modal */}
      <OrderModeModal
        isOpen={showRiskCalculatorModal}
        onClose={handleRiskCalculatorModalCancel}
        onConfirm={handleRiskCalculatorModalConfirm}
        mode="Risk calculator form"
      />
    </div>
  )
}

export default OrderPanel
