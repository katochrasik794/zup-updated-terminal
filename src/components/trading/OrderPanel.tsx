"use client";

import * as React from "react"
import { X, Plus, Minus, HelpCircle } from "lucide-react"
import { cn, formatSymbolDisplay, checkIsMarketClosed } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Tooltip from "@/components/ui/Tooltip"
import FlagIcon from "@/components/ui/FlagIcon"
import { useTrading } from '../../context/TradingContext'
import { useWebSocket } from '../../context/WebSocketContext'
import { useAccount } from '../../context/AccountContext'
import { useInstruments } from '../../context/InstrumentContext'
import OrderModeModal from '../modals/OrderModeModal'
import MarketClosedToast from '@/components/ui/MarketClosedToast'
import ReactDOM from 'react-dom'

export interface OrderPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
  onBuy?: (data: OrderData) => any
  onSell?: (data: OrderData) => any
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
  const { instruments } = useInstruments()
  const [marketClosedToast, setMarketClosedToast] = React.useState<string | null>(null)

  // Get real-time prices from WebSocket
  const hubSymbol = React.useMemo(() => {
    const s = (symbol || 'BTCUSD').replace('/', '');
    // Convert trailing uppercase M or R to lowercase to match instrument feed
    return s.replace(/M$/, 'm').replace(/R$/, 'r');
  }, [symbol])

  React.useEffect(() => {
    if (hubSymbol) {
      subscribe([hubSymbol])
      return () => unsubscribe([hubSymbol])
    }
  }, [hubSymbol, subscribe, unsubscribe])

  const quote = lastQuotes[normalizeSymbol(hubSymbol)] || lastQuotes[hubSymbol] || {}
  const instrument = React.useMemo(() => {
    const norm = normalizeSymbol(hubSymbol)
    return instruments.find(i => normalizeSymbol(i.symbol) === norm || i.symbol === hubSymbol || i.symbol === symbol)
  }, [hubSymbol, instruments, normalizeSymbol, symbol])

  const isMarketClosed = React.useMemo(() => {
    return checkIsMarketClosed(symbol || hubSymbol, instrument?.category || '', quote.bid, quote.ask)
  }, [symbol, hubSymbol, instrument, quote.bid, quote.ask])
  const marketClosedMessage = "Market closed";

  // Use live prices if available, otherwise fall back to defaults
  const currentSellPrice = quote.bid ?? 0
  const currentBuyPrice = quote.ask ?? 0
  const spreadVal = (quote.spread || 0) * 100
  const currentSpread = React.useMemo(() => {
    // Priority: DB spread > Live Quote Spread
    if (instrument?.spread && instrument.spread > 0) {
      // Return spread from DB as points.
      return `${instrument.spread} pts`
    }
    return `${spreadVal.toFixed(2)} pips`
  }, [instrument, spreadVal])

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
  const [isLoading, setIsLoading] = React.useState(false)
  const isSyncingFromChart = React.useRef(false)
  const lastPreviewData = React.useRef<string | null>(null)

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
    // Reset TP and SL when switching forms as requested
    setTakeProfit("")
    setStopLoss("")

    if (newFormType === "one-click" && shouldShowOneClickModal()) {
      setPendingFormType(newFormType)
      setShowOneClickModal(true)
    } else if (newFormType === "risk-calculator" && shouldShowRiskCalculatorModal()) {
      setPendingFormType(newFormType)
      setShowRiskCalculatorModal(true)
    } else {
      // Force market and clear pending state for Risk Calculator
      if (newFormType === "risk-calculator") {
        setOrderType("market")
        setPendingOrderSide(null)
        setOpenPrice("")
      }
      setFormType(newFormType)
    }
  }, [setFormType, setTakeProfit, setStopLoss, setOrderType, setPendingOrderSide, setOpenPrice, shouldShowOneClickModal, shouldShowRiskCalculatorModal])

  // Handle one-click modal confirmation
  const handleOneClickModalConfirm = React.useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('zup_oneclick_modal_dismissed', 'true')
    }
    if (pendingFormType) {
      if (pendingFormType === "risk-calculator") {
        setOrderType("market")
        setPendingOrderSide(null)
        setOpenPrice("")
      }
      setFormType(pendingFormType)
      setPendingFormType(null)
    }
    setShowOneClickModal(false)
  }, [pendingFormType, setOrderType, setPendingOrderSide, setOpenPrice, setFormType])

  // Ref for orderType to avoid stale usage in event listener
  const orderTypeRef = React.useRef(orderType)
  React.useEffect(() => {
    orderTypeRef.current = orderType
  }, [orderType])

  // Ref to track the debounce timeout for clearing the sync flag
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Sync TP/SL from chart preview
  React.useEffect(() => {
    const handlePreviewChange = (e: any) => {
      const { takeProfit: tp, stopLoss: sl, price, source, type: orderTypeFromChart, side: sideFromChart } = e.detail || {}
      // console.log("[OrderPanel] Received __ON_ORDER_PREVIEW_CHANGE__ event:", { tp, sl, price, source, type: orderTypeFromChart, side: sideFromChart });

      // Prevent loops - only if we initiated the change
      if (source === 'panel') {
        // console.log("[OrderPanel] Ignoring event from 'panel' source to avoid loops");
        return;
      }

      // Handle explicit cancellation from chart (e.g. clicking 'X')
      if (source === 'chart_cancel') {
        // console.log("[OrderPanel] Received cancellation from chart. resetting state.");
        setPendingOrderSide(null);
        setTakeProfit("");
        setStopLoss("");
        // No need to clear chart preview here as the chart initiated it, 
        // but setting pendingOrderSide(null) prevents the loop.
        return;
      }

      // Start syncing: Cancel any pending clear
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
      isSyncingFromChart.current = true

      try {
        if (tp !== undefined) {
          const tpNum = parseFloat(tp);
          if (!isNaN(tpNum) && tpNum > 0) {
            const val = tpNum.toFixed(5).replace(/\.?0+$/, "");
            setTakeProfit(val);
            setTakeProfitMode('price');
          } else if (tpNum === 0 || tp === "") {
            setTakeProfit("");
          }
        }
        if (sl !== undefined) {
          const slNum = parseFloat(sl);
          if (!isNaN(slNum) && slNum > 0) {
            const val = slNum.toFixed(5).replace(/\.?0+$/, "");
            setStopLoss(val);
            setStopLossMode('price');
          } else if (slNum === 0 || sl === "") {
            setStopLoss("");
          }
        }
        if (price !== undefined && price !== null) {
          const priceNum = parseFloat(price);
          if (!isNaN(priceNum)) {
            // console.log("[OrderPanel] Updating OpenPrice to:", priceNum);
            setOpenPrice(priceNum.toString());
          }
        }

        if (orderTypeFromChart === 'limit' || orderTypeFromChart === 'stop') {
          // console.log(`[OrderPanel] >>> SYNCING TAB: Switching to ${orderTypeFromChart.toUpperCase()} <<<`);
          setPendingOrderType(orderTypeFromChart as "limit" | "stop");

          // DO NOT force orderType to 'pending'. Let the user stay on their current tab.
        } else if (orderTypeFromChart === 'market') {
          // DO NOT force orderType to 'market'. Let the user stay on their current tab.
        }

        if (sideFromChart === 'buy' || sideFromChart === 'sell') {
          // console.log(`[OrderPanel] >>> SYNCING SIDE: Switching to ${sideFromChart.toUpperCase()} <<<`);
          setPendingOrderSide(sideFromChart as 'buy' | 'sell');
        }
      } catch (err) {
        console.error("[OrderPanel] Error updating values from chart:", err);
      } finally {
        syncTimeoutRef.current = setTimeout(() => {
          // console.log("[OrderPanel] isSyncingFromChart cleared to false");
          isSyncingFromChart.current = false
          syncTimeoutRef.current = null
        }, 300)
      }
    }

    if (typeof window !== 'undefined') {
      (window as any).addEventListener('__ON_ORDER_PREVIEW_CHANGE__', handlePreviewChange)
      return () => {
        (window as any).removeEventListener('__ON_ORDER_PREVIEW_CHANGE__', handlePreviewChange)
      }
    }
  }, [])

  // Local Auto-switch logic for Limit/Stop tabs in OrderPanel
  React.useEffect(() => {
    // Only auto-switch if we are in pending mode and have an active preview side
    if (orderType !== "pending" || !pendingOrderSide) return;

    // Skip if we just synced from the chart (to avoid bouncing, though less likely now)
    // if (isSyncingFromChart.current) return;

    const priceNum = parseFloat(openPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const marketPrice = pendingOrderSide === 'buy' ? currentBuyPrice : currentSellPrice;
    if (!marketPrice || marketPrice <= 0) return;

    let newType: "limit" | "stop" = pendingOrderType;
    if (pendingOrderSide === 'buy') {
      newType = priceNum < marketPrice ? "limit" : "stop";
    } else {
      newType = priceNum > marketPrice ? "limit" : "stop";
    }

    if (newType !== pendingOrderType) {
      // console.log(`[OrderPanel] Local Auto-Switch detected: price=${priceNum} market=${marketPrice} side=${pendingOrderSide} -> switching to ${newType.toUpperCase()}`);
      setPendingOrderType(newType);
    }
  }, [openPrice, currentBuyPrice, currentSellPrice, pendingOrderSide, orderType]);



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
      if (pendingFormType === "risk-calculator") {
        setOrderType("market")
        setPendingOrderSide(null)
        setOpenPrice("")
      }
      setFormType(pendingFormType)
      setPendingFormType(null)
    }
    setShowRiskCalculatorModal(false)
  }, [pendingFormType, setOrderType, setPendingOrderSide, setOpenPrice, setFormType])

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

  // Auto-set TP/SL upon preview start OR symbol change
  // REMOVED: Auto-calculation of 20 pips default TP/SL as per user request to keep fields empty.

  // Trigger order preview on chart
  React.useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).__SET_ORDER_PREVIEW__) return

    // If we just got an update FROM the chart, don't send it back to the chart
    if (isSyncingFromChart.current) return;

    if (!pendingOrderSide) {
      if (lastPreviewData.current !== 'null') {
        (window as any).__SET_ORDER_PREVIEW__({ side: null })
        lastPreviewData.current = 'null'
      }
      return
    }

    const previewPrice = orderType === 'market'
      ? (pendingOrderSide === 'buy' ? currentBuyPrice : currentSellPrice)
      : parseFloat(openPrice)

    if (isNaN(previewPrice) || previewPrice <= 0) {
      // If pending but no price, maybe show nothing or keep previous? 
      // Better to clear if invalid price
      if (orderType !== 'market') {
        (window as any).__SET_ORDER_PREVIEW__({ side: null })
        return
      }
    }

    const tpVal = parseFloat(takeProfit);
    const slVal = parseFloat(stopLoss);
    let tpPrice: number | undefined;
    let slPrice: number | undefined;

    const isTpSet = !isNaN(tpVal) && tpVal > 0;
    const isSlSet = !isNaN(slVal) && slVal > 0;

    const pipSize = getPipSize; // Keep in case needed for pips mode calculation

    if (takeProfitMode === 'price' && isTpSet) {
      tpPrice = tpVal;
    } else if (takeProfitMode === 'pips' && isTpSet) {
      const offset = tpVal * pipSize;
      tpPrice = pendingOrderSide === 'buy' ? previewPrice + offset : previewPrice - offset;
    }

    if (stopLossMode === 'price' && isSlSet) {
      slPrice = slVal;
    } else if (stopLossMode === 'pips' && isSlSet) {
      const offset = slVal * pipSize;
      slPrice = pendingOrderSide === 'buy' ? previewPrice - offset : previewPrice + offset;
    }

    // Directional validation (User request: TP must be below for Sell, above for Buy)
    if (tpPrice !== undefined) {
      const isValid = pendingOrderSide === 'buy' ? tpPrice > previewPrice : tpPrice < previewPrice
      if (!isValid) tpPrice = undefined
    }
    if (slPrice !== undefined) {
      const isValid = pendingOrderSide === 'buy' ? slPrice < previewPrice : slPrice > previewPrice
      if (!isValid) slPrice = undefined
    }

    // 4. Send to chart
    const previewPayload = {
      symbol: symbol,
      side: pendingOrderSide,
      qty: parseFloat(volume) || 0.01,
      price: previewPrice,
      type: orderType === 'market' ? 'market' : pendingOrderType,
      takeProfit: tpPrice || 0,
      stopLoss: slPrice || 0,
      text: (parseFloat(volume) || 0.01).toString()
    }

    // Performance Optimization: 
    // If we are currently receiving an update from the chart, don't send one back.
    // This breaks the infinite loop and makes dragging much smoother.
    if (isSyncingFromChart.current) {
      console.log("[OrderPanel] Skipping preview update to chart: Syncing from chart in progress");
      return
    }

    // Dirty check: Only update if anything meaningful changed to avoid chart flicker
    const payloadStr = JSON.stringify(previewPayload)
    if (lastPreviewData.current === payloadStr) return
    lastPreviewData.current = payloadStr;

    (window as any).__SET_ORDER_PREVIEW__(previewPayload)
  }, [pendingOrderSide, orderType, openPrice, volume, currentBuyPrice, currentSellPrice, symbol, pendingOrderType, takeProfit, stopLoss, takeProfitMode, stopLossMode])

  // Get pip size based on symbol type
  const getPipSize = React.useMemo(() => {
    const symbolUpper = (symbol || '').toUpperCase()
    const cat = (instrument?.category || '').toLowerCase()

    if (symbolUpper.includes('JPY')) {
      return 0.01
    } else if (cat.includes('crypto') || symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
      return 1.00 // 1 point = 1 dollar
    } else if (cat.includes('index') || cat.includes('indice') || symbolUpper.includes('US30') || symbolUpper.includes('SPX') || symbolUpper.includes('NAS')) {
      return 1.00 // 1 point = 1 unit (4500 -> 4520 is 20 points)
    } else if (cat.includes('metal') || symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
      return 1.00 // 1 point = 1 dollar (2500 -> 2520 is 20 points)
    } else {
      return 0.0001 // Forex default (0.0001 = 1 pip)
    }
  }, [symbol, instrument])

  // Get default TP/SL offsets in "points/pips" (20 for all instruments as requested)
  const getDefaultOffsets = React.useMemo(() => {
    return { tp: 50, sl: 50 }
  }, [])

  // Get pip value per lot based on symbol type
  const getPipValuePerLot = React.useMemo(() => {
    const symbolUpper = (symbol || '').toUpperCase()
    if (symbolUpper.includes('JPY')) {
      return 10
    } else if (symbolUpper.includes('XAU') || symbolUpper.includes('GOLD')) {
      return 100
    } else if (symbolUpper.includes('XAG') || symbolUpper.includes('SILVER')) {
      return 50 // Standard silver contract is 5000 oz, but often 50 on retail brokers, using 50 as a safer bet for point value
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('BTCUSD')) {
      return getPipSize
    } else if (symbolUpper.includes('ETH') || symbolUpper.includes('ETHUSD')) {
      return 10
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
    if (formType !== "risk-calculator" || !risk || !stopLoss) {
      return null
    }

    let riskAmount = parseFloat(risk)
    // Handle risk in percentage
    if (riskMode === "percent") {
      const equity = currentBalance?.equity || 0
      if (equity <= 0) return null
      riskAmount = (riskAmount / 100) * equity
    }

    let stopLossPips = 0

    if (stopLossMode === "pips") {
      stopLossPips = Math.abs(parseFloat(stopLoss))
    } else {
      // stopLossMode === "price"
      const slPrice = parseFloat(stopLoss)
      if (isNaN(slPrice) || slPrice <= 0) return null

      let entryPrice = 0
      if (orderType === "pending" || orderType === "limit") {
        entryPrice = openPrice ? parseFloat(openPrice) : 0
      } else {
        // For market orders, determine if it's a Buy or Sell based on SL position
        // If SL is below the current prices, it's a Buy (Entry at Ask/BuyPrice)
        // If SL is above the current prices, it's a Sell (Entry at Bid/SellPrice)
        const midPrice = (currentBuyPrice + currentSellPrice) / 2

        if (slPrice < midPrice) {
          // It's a Buy order, entering at Ask
          entryPrice = currentBuyPrice
        } else {
          // It's a Sell order, entering at Bid
          entryPrice = currentSellPrice
        }
      }

      if (entryPrice <= 0) return null

      // Use pipSize from hook
      const pipSize = getPipSize
      stopLossPips = Math.abs(entryPrice - slPrice) / pipSize
    }

    if (!riskAmount || !stopLossPips || stopLossPips <= 0 || riskAmount <= 0) {
      return null
    }

    const pipValuePerLot = getPipValuePerLot
    const calculatedVolume = riskAmount / (stopLossPips * pipValuePerLot)
    const clampedVolume = Math.max(0.01, Math.min(50.00, calculatedVolume))

    return clampedVolume
  }, [formType, risk, stopLoss, stopLossMode, riskMode, getPipValuePerLot, currentBalance, orderType, openPrice, currentBuyPrice, currentSellPrice, getPipSize])

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

  const validateSLTP = (side: 'buy' | 'sell', entryPrice: number, sl?: number, tp?: number) => {
    if (sl && sl > 0) {
      if (side === 'buy' && sl >= entryPrice) {
        alert("Buy Stop Loss must be below the entry price.");
        return false;
      }
      if (side === 'sell' && sl <= entryPrice) {
        alert("Sell Stop Loss must be above the entry price.");
        return false;
      }
    }
    if (tp && tp > 0) {
      if (side === 'buy' && tp <= entryPrice) {
        alert("Buy Take Profit must be above the entry price.");
        return false;
      }
      if (side === 'sell' && tp >= entryPrice) {
        alert("Sell Take Profit must be below the entry price.");
        return false;
      }
    }
    return true;
  }

  // Reset state and clear preview when symbol changes
  React.useEffect(() => {
    setPendingOrderSide(null);
    setTakeProfit("");
    setStopLoss("");
    setOpenPrice("");
    setVolume("0.01");
    // Explicitly clear chart preview
    if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
      (window as any).__SET_ORDER_PREVIEW__({ side: null });
      lastPreviewData.current = 'null';
    }
  }, [symbol])

  // Helper to format price for panel with superscript
  const formatPriceForPanel = (price: number) => {
    if (price === undefined || price === null || isNaN(price)) {
      return (
        <>
          0<span className="text-lg">.00</span><sup className="text-sm">0</sup>
        </>
      )
    }

    // Determine precision
    let digits = 5; // Default for most Forex
    if (instrument?.digits !== undefined) {
      digits = instrument.digits;
    } else {
      // Heuristic fallback if digits not available
      const symbolUpper = (symbol || '').toUpperCase();
      if (symbolUpper.includes('JPY')) {
        digits = 3;
      } else if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
        digits = 3; // Gold/Silver often 2 or 3
      } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
        digits = 2; // Crypto often 2
      }
    }

    // User override request: "upto 6 digit for all"
    // We should respect feed digits if possible, but ensure we show enough.
    // If we don't have instrument.digits, defaulting to 5 or 6 is safe.
    // Let's cap at 6 max, ensure at least 2.
    digits = Math.min(Math.max(digits, 2), 6);

    const priceStr = price.toFixed(digits);
    const [intPart, decPart] = priceStr.split('.');

    if (!decPart) return <>{intPart}</>;

    const mainDecimals = decPart.slice(0, -1);
    const lastDigit = decPart.slice(-1);

    return (
      <>
        {parseInt(intPart).toLocaleString()}
        <span className="text-lg">.{mainDecimals}</span>
        <sup className="text-sm">{lastDigit}</sup>
      </>
    )
  }

  // Render buy/sell price buttons with spread overlay - solid backgrounds for one-click
  const renderPriceButtonsSolid = () => (
    <div className="relative grid grid-cols-2 gap-3">
      <button
        onClick={async () => {
          if (isMarketClosed) {
            setMarketClosedToast(marketClosedMessage)
            return
          }
          if (isLoading) return;
          setIsLoading(true);
          try {
            const entry = openPrice ? parseFloat(openPrice) : currentSellPrice;
            const sl = stopLoss ? parseFloat(stopLoss) : undefined;
            const tp = takeProfit ? parseFloat(takeProfit) : undefined;

            if (!validateSLTP('sell', entry, sl, tp)) {
              setIsLoading(false);
              return;
            }

            // INSTANT UI RESET (10ms feel) - trigger BEFORE await for snappiness
            setPendingOrderSide(null);
            setTakeProfit("");
            setStopLoss("");
            setRisk("");
            if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
              (window as any).__SET_ORDER_PREVIEW__({ side: null });
              lastPreviewData.current = 'null';
            }

            // Await execution to ensure isLoading blocks further clicks
            await onSell?.({
              orderType,
              pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
              volume: parseFloat(volume),
              openPrice: entry,
              stopLoss: sl,
              takeProfit: tp,
            });
          } catch (err) {
            console.error("[OrderPanel] Sell order failed:", err);
          } finally {
            setIsLoading(false);
          }
        }}
        disabled={isLoading}
        className={cn(
          "rounded-md p-3 bg-danger hover:bg-danger/90 cursor-pointer text-left relative overflow-hidden transition-all text-[#ffffff]"
        )}
      >
        <div className="text-xs text-white/80 mb-1">Sell</div>
        <div className="price-font text-foreground font-bold text-sm leading-tight">
          {formatPriceForPanel(currentSellPrice)}
        </div>
      </button>

      <button
        onClick={async () => {
          if (isMarketClosed) {
            setMarketClosedToast(marketClosedMessage)
            return
          }
          if (isLoading) return;
          setIsLoading(true);
          try {
            const entry = openPrice ? parseFloat(openPrice) : currentBuyPrice;
            const sl = stopLoss ? parseFloat(stopLoss) : undefined;
            const tp = takeProfit ? parseFloat(takeProfit) : undefined;

            if (!validateSLTP('buy', entry, sl, tp)) {
              setIsLoading(false);
              return;
            }

            // INSTANT UI RESET - BEFORE await
            setStopLoss("");
            setTakeProfit("");
            setRisk("");
            setPendingOrderSide(null);
            if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
              (window as any).__SET_ORDER_PREVIEW__({ side: null });
              lastPreviewData.current = 'null';
            }

            // Await execution
            await onBuy?.({
              orderType,
              pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
              volume: parseFloat(volume),
              openPrice: entry,
              stopLoss: sl,
              takeProfit: tp,
            });
          } catch (err) {
            console.error("[OrderPanel] Buy order failed:", err);
          } finally {
            setIsLoading(false);
          }
        }}
        disabled={isLoading}
        className={cn(
          "rounded-md p-3 bg-info hover:bg-info/90 cursor-pointer text-right relative overflow-hidden transition-all text-[#ffffff]"
        )}
      >
        <div className="text-xs text-white/80 mb-1">Buy</div>
        <div className="price-font text-foreground font-bold text-sm leading-tight">
          {formatPriceForPanel(currentBuyPrice)}
        </div>
      </button>

      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-foreground/10 text-[10px] text-foreground/80 font-medium whitespace-nowrap z-10">
        {currentSpread} {isConnected && <span className="text-green-500 ml-1">●</span>}
      </div>
    </div >
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
      if (stopLossMode === "price") {
        finalStopLoss = stopLoss ? parseFloat(stopLoss) : undefined
      } else {
        finalStopLoss = calculatedStopLossPrice ?? undefined
      }

      if (takeProfitMode === "price") {
        finalTakeProfit = takeProfit ? parseFloat(takeProfit) : undefined
      } else {
        finalTakeProfit = calculatedTakeProfitPrice ?? undefined
      }
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

    // Use violet for risk calculator form buttons, keep red/blue for regular form
    const isRiskCalculator = formType === "risk-calculator"
    const sellButtonBorder = isRiskCalculator ? 'border-primary' : 'border-danger'
    const sellButtonHover = isRiskCalculator ? 'hover:bg-primary/10' : 'hover:bg-danger/10'
    const buyButtonBorder = isRiskCalculator ? 'border-primary' : 'border-info'
    const buyButtonHover = isRiskCalculator ? 'hover:bg-primary/10' : 'hover:bg-info/10'
    const sellButtonTextColor = isRiskCalculator ? 'text-primary' : 'text-danger'
    const buyButtonTextColor = isRiskCalculator ? 'text-primary' : 'text-info'

    return (
      <div className="relative grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`rounded-md p-3 border-2 ${sellButtonBorder} bg-transparent ${readOnly ? '' : sellButtonHover} text-left cursor-pointer`}
          onClick={readOnly ? undefined : async () => {
            if (isMarketClosed) {
              setMarketClosedToast(marketClosedMessage)
              return
            }
            if (showConfirmation) {
              // ALWAYS allow opening the confirmation box, even if loading
              setPendingOrderSide('sell')
            } else {
              // For direct execution (Risk Calculator), prevent double clicks
              if (isLoading) return;
              if (!onSell) return
              if (!finalVolume || finalVolume <= 0) {
                return
              }
              // For pending orders, validate that openPrice is provided
              if (orderType === 'pending' && !finalOpenPrice) {
                alert('Please enter an open price for pending orders')
                return
              }

              setIsLoading(true);

              // Calculate Sell-specific SL/TP if in Pips mode
              let sellStopLoss = finalStopLoss
              let sellTakeProfit = finalTakeProfit

              if (formType === "risk-calculator" && stopLossMode === "pips" && stopLoss) {
                const pips = parseFloat(stopLoss)
                if (!isNaN(pips)) {
                  const pipSize = getPipSize
                  // For Sell: SL is ABOVE entry (Entry + Pips)
                  const entry = orderType === 'market' ? currentSellPrice : (finalOpenPrice || 0)
                  sellStopLoss = entry + (pips * pipSize)
                }
              }

              if (formType === "risk-calculator" && takeProfitMode === "pips" && takeProfit) {
                const pips = parseFloat(takeProfit)
                if (!isNaN(pips) && pips > 0) {
                  const pipSize = getPipSize
                  // For Sell: TP is BELOW entry (Entry - Pips)
                  const entry = orderType === 'market' ? currentSellPrice : (finalOpenPrice || 0)
                  sellTakeProfit = entry - (pips * pipSize)
                }
              }

              const orderData: OrderData = {
                orderType,
                pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
                volume: finalVolume,
                openPrice: orderType === 'market' ? currentSellPrice : finalOpenPrice,
                stopLoss: sellStopLoss,
                takeProfit: sellTakeProfit,
              }
              if (!validateSLTP('sell', orderData.openPrice || 0, orderData.stopLoss, orderData.takeProfit)) {
                setIsLoading(false);
                return;
              }

              try {
                // INSTANT reset BEFORE await
                setStopLoss("");
                setTakeProfit("");
                setRisk("");
                setPendingOrderSide(null);
                if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
                  (window as any).__SET_ORDER_PREVIEW__({ side: null });
                  lastPreviewData.current = 'null';
                }

                await onSell(orderData)
              } catch (err) {
                console.error("[OrderPanel] Sell order (bordered) failed:", err);
              } finally {
                setIsLoading(false);
              }
            }
          }}
          disabled={readOnly}
        >
          <div className="text-xs text-foreground/60 mb-1">Sell</div>
          <div className={`price-font ${sellButtonTextColor} font-bold text-sm leading-tight`}>
            {formatPriceForPanel(currentSellPrice)}
          </div>
        </button>

        <button
          type="button"
          className={`rounded-md p-3 border-2 ${buyButtonBorder} bg-transparent ${readOnly ? '' : buyButtonHover} text-right cursor-pointer`}
          onClick={readOnly ? undefined : async () => {
            if (isMarketClosed) {
              setMarketClosedToast(marketClosedMessage)
              return
            }
            if (showConfirmation) {
              // ALWAYS allow opening the confirmation box, even if loading
              setPendingOrderSide('buy')
            } else {
              // For direct execution, prevent double clicks
              if (isLoading) return;
              if (!onBuy) return
              if (!finalVolume || finalVolume <= 0) {
                return
              }
              // For pending orders, validate that openPrice is provided
              if (orderType === 'pending' && !finalOpenPrice) {
                alert('Please enter an open price for pending orders')
                return
              }

              setIsLoading(true);

              // Calculate Buy-specific SL/TP if in Pips mode
              let buyStopLoss = finalStopLoss
              let buyTakeProfit = finalTakeProfit

              if (formType === "risk-calculator" && stopLossMode === "pips" && stopLoss) {
                const pips = parseFloat(stopLoss)
                if (!isNaN(pips)) {
                  const pipSize = getPipSize
                  // For Buy: SL is BELOW entry (Entry - Pips)
                  const entry = orderType === 'market' ? currentBuyPrice : (finalOpenPrice || 0)
                  buyStopLoss = entry - (pips * pipSize)
                }
              }

              if (formType === "risk-calculator" && takeProfitMode === "pips" && takeProfit) {
                const pips = parseFloat(takeProfit)
                if (!isNaN(pips) && pips > 0) {
                  const pipSize = getPipSize
                  // For Buy: TP is ABOVE entry (Entry + Pips)
                  const entry = orderType === 'market' ? currentBuyPrice : (finalOpenPrice || 0)
                  buyTakeProfit = entry + (pips * pipSize)
                }
              }

              const orderData: OrderData = {
                orderType,
                pendingOrderType: orderType === "pending" ? pendingOrderType : undefined,
                volume: finalVolume,
                openPrice: orderType === 'market' ? currentBuyPrice : finalOpenPrice,
                stopLoss: buyStopLoss,
                takeProfit: buyTakeProfit,
              }
              if (!validateSLTP('buy', orderData.openPrice || 0, orderData.stopLoss, orderData.takeProfit)) {
                setIsLoading(false);
                return;
              }

              try {
                // INSTANT reset BEFORE await
                setStopLoss("");
                setTakeProfit("");
                setRisk("");
                setPendingOrderSide(null);
                if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
                  (window as any).__SET_ORDER_PREVIEW__({ side: null });
                  lastPreviewData.current = 'null';
                }

                await onBuy(orderData)
              } catch (err) {
                console.error("[OrderPanel] Buy order (bordered) failed:", err);
              } finally {
                setIsLoading(false);
              }
            }
          }}
          disabled={readOnly}
        >
          <div className="text-xs text-foreground/60 mb-1">Buy</div>
          <div className={`price-font ${buyButtonTextColor} font-bold text-sm leading-tight`}>
            {formatPriceForPanel(currentBuyPrice)}
          </div>
        </button>

        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-foreground/10 text-[10px] text-foreground/80 font-medium whitespace-nowrap z-10">
          {currentSpread} {isConnected && <span className="text-green-500 ml-1">●</span>}
        </div>
      </div>
    )
  }

  // Render confirmation section - Shared between Regular and Risk Calculator forms
  const renderConfirmationSection = () => {
    return (
      <>
        {/* Stop Loss Metrics - Show above confirmation button */}
        {stopLoss && (
          <div className="flex items-center justify-center gap-4 pt-2 pb-1 text-xs text-foreground/60">
            {stopLossMode === "pips" ? (
              <>
                <span>{stopLoss.startsWith('-') ? stopLoss : `-${stopLoss}`} pips</span>
                <span className="text-foreground/40">|</span>
                <span>
                  {(() => {
                    const pips = Math.abs(parseFloat(stopLoss) || 0)
                    const isBuy = pendingOrderSide === 'buy'
                    const calculatedPrice = calculatePriceFromPips(pips, isBuy, true)
                    if (calculatedPrice !== null) {
                      const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null
                        ? calculateRiskBasedVolume
                        : (parseFloat(volume) || 0.01)
                      const pipValue = pips * getPipValuePerLot * finalVolume
                      return `-${Math.abs(pipValue).toFixed(2)} USD`
                    }
                    return '-0.00 USD'
                  })()}
                </span>
                <span className="text-foreground/40">|</span>
                <span>
                  {(() => {
                    const pips = Math.abs(parseFloat(stopLoss) || 0)
                    const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null
                      ? calculateRiskBasedVolume
                      : (parseFloat(volume) || 0.01)
                    const pipValue = pips * getPipValuePerLot * finalVolume
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
                <span className="text-foreground/40">|</span>
                <span>
                  {(() => {
                    const slPrice = parseFloat(stopLoss) || 0
                    const isBuy = pendingOrderSide === 'buy'
                    const entryPrice = isBuy ? currentBuyPrice : currentSellPrice
                    const priceDiff = Math.abs(entryPrice - slPrice)
                    const pipSize = getPipSize
                    const pips = priceDiff / pipSize
                    const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null
                      ? calculateRiskBasedVolume
                      : (parseFloat(volume) || 0.01)
                    const pipValue = pips * getPipValuePerLot * finalVolume
                    return `-${pipValue.toFixed(2)} USD`
                  })()}
                </span>
                <span className="text-foreground/40">|</span>
                <span>
                  {(() => {
                    const slPrice = parseFloat(stopLoss) || 0
                    const isBuy = pendingOrderSide === 'buy'
                    const entryPrice = isBuy ? currentBuyPrice : currentSellPrice
                    const priceDiff = Math.abs(entryPrice - slPrice)
                    const pipSize = getPipSize
                    const pips = priceDiff / pipSize
                    const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null
                      ? calculateRiskBasedVolume
                      : (parseFloat(volume) || 0.01)
                    const pipValue = pips * getPipValuePerLot * finalVolume
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
            disabled={isLoading}
            onClick={async () => {
              if (isMarketClosed) {
                setMarketClosedToast(marketClosedMessage)
                return
              }
              if (isLoading) return;
              const handler = pendingOrderSide === 'buy' ? onBuy : onSell
              if (!handler) return

              const finalVolume = formType === "risk-calculator" && calculateRiskBasedVolume !== null
                ? calculateRiskBasedVolume
                : (parseFloat(volume) || 0.01)

              if (finalVolume <= 0) {
                return
              }
              let finalStopLoss: number | undefined = undefined
              let finalTakeProfit: number | undefined = undefined

              const isBuy = pendingOrderSide === 'buy'

              // Calculate SL
              if (stopLossMode === "price") {
                finalStopLoss = stopLoss ? parseFloat(stopLoss) : undefined
              } else if (stopLossMode === "pips" && stopLoss) {
                const pips = parseFloat(stopLoss)
                if (!isNaN(pips)) {
                  if (formType === "risk-calculator") {
                    // Risk Calculator: Pips are distance (absolute)
                    const dist = Math.abs(pips)
                    const pipSize = getPipSize
                    // Determine Entry Price for calculation
                    const entryPrice = orderType === 'market'
                      ? (isBuy ? currentBuyPrice : currentSellPrice)
                      : (parseFloat(openPrice) || 0)

                    if (entryPrice > 0) {
                      // Buy SL = Entry - Dist, Sell SL = Entry + Dist
                      finalStopLoss = isBuy ? entryPrice - (dist * pipSize) : entryPrice + (dist * pipSize)
                    }
                  } else {
                    // Regular Form: Use existing helper (pips can be negative)
                    const calculatedPrice = calculatePriceFromPips(pips, isBuy, true)
                    if (calculatedPrice !== null) {
                      finalStopLoss = calculatedPrice
                    }
                  }
                }
              }

              // Calculate TP
              if (takeProfitMode === "price") {
                finalTakeProfit = takeProfit ? parseFloat(takeProfit) : undefined
              } else if (takeProfitMode === "pips" && takeProfit) {
                const pips = parseFloat(takeProfit)
                if (!isNaN(pips) && pips > 0) {
                  if (formType === "risk-calculator") {
                    // Risk Calculator: Pips are distance (absolute)
                    const dist = Math.abs(pips)
                    const pipSize = getPipSize
                    const entryPrice = orderType === 'market'
                      ? (isBuy ? currentBuyPrice : currentSellPrice)
                      : (parseFloat(openPrice) || 0)

                    if (entryPrice > 0) {
                      // Buy TP = Entry + Dist, Sell TP = Entry - Dist
                      finalTakeProfit = isBuy ? entryPrice + (dist * pipSize) : entryPrice - (dist * pipSize)
                    }
                  } else {
                    const calculatedPrice = calculatePriceFromPips(pips, isBuy, false)
                    if (calculatedPrice !== null) {
                      finalTakeProfit = calculatedPrice
                    }
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

              if (!validateSLTP(pendingOrderSide as 'buy' | 'sell', orderData.openPrice || 0, orderData.stopLoss, orderData.takeProfit)) {
                return;
              }

              setIsLoading(true);
              try {
                // INSTANT UI RESET - Trigger BEFORE await for snappiness
                setStopLoss("");
                setTakeProfit("");
                setRisk("");
                setPendingOrderSide(null);

                // EXPLICIT INSTANT CLEAR (User requested robust cleanup)
                if (typeof window !== 'undefined' && (window as any).__SET_ORDER_PREVIEW__) {
                  (window as any).__SET_ORDER_PREVIEW__({ side: null });
                  lastPreviewData.current = 'null';
                }

                // Await the handler execution
                await handler(orderData);
              } catch (err) {
                console.error("[OrderPanel] Confirm order failed:", err);
                setPendingOrderSide(null);
              } finally {
                setIsLoading(false);
              }
            }}
            className={cn(
              "w-full font-semibold py-3 px-4 rounded-md transition-all flex flex-col items-center justify-center relative overflow-hidden text-white",
              pendingOrderSide === 'buy' ? 'bg-info hover:bg-info/90' : 'bg-danger hover:bg-danger/90',
            )}
          >
            <span className="text-sm">Confirm {pendingOrderSide === 'buy' ? 'Buy' : 'Sell'}</span>
            <span className="text-xs opacity-90">{formType === "risk-calculator" && calculateRiskBasedVolume !== null ? calculateRiskBasedVolume.toFixed(2) : volume} lots</span>
          </button>
          <button
            onClick={() => setPendingOrderSide(null)}
            disabled={isLoading}
            className="w-full bg-gray-800 hover:bg-gray-700 text-foreground font-medium py-2.5 px-4 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Financial Details - Show below confirmation buttons */}
        {renderFinancialDetails()}
      </>
    )
  }

  // Simple toast for market closed
  const renderMarketClosedToast = () => {
    if (!marketClosedToast) return null
    return ReactDOM.createPortal(
      <div className="fixed bottom-4 left-4 z-[99999] bg-background text-[#d1d5db] rounded-md shadow-lg border border-amber-500/60 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 relative">
          <button
            onClick={() => setMarketClosedToast(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-foreground transition-colors"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">⚠</div>
            <div className="flex-1">
              <h3 className="text-foreground font-medium text-[14px] leading-tight mb-1">Market closed</h3>
              <p className="text-[13px] text-[#d1d5db]">{marketClosedMessage}</p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Calculate financial metrics in real-time
  const calculateFinancialMetrics = React.useMemo(() => {
    const vol = parseFloat(volume) || 0
    const price = orderType === "limit" && openPrice ? parseFloat(openPrice) : currentBuyPrice
    const symbolUpper = (symbol || '').toUpperCase()

    // Default values
    let contractSize = 100000
    let pipValue = 0.0001
    let commission = 0 // Per lot or per trade

    // Use dynamic data from instrument if available
    if (instrument?.contractSize) {
      contractSize = instrument.contractSize
    } else {
      // Fallback hardcoded logic
      if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
        contractSize = 100
      } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
        contractSize = 1
      } else {
        contractSize = 100000
      }
    }

    // Determine pip value logic
    if (instrument?.pipValue) {
      // If provided by backend
      pipValue = instrument.pipValue
    } else {
      // Fallback
      if (symbolUpper.includes('JPY')) {
        pipValue = 0.01
      } else if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
        pipValue = 0.01
      } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH') || instrument?.category?.toLowerCase().includes('crypto')) {
        pipValue = 1.00 // Crypto usually $1 per point
      } else if (instrument?.category?.toLowerCase().includes('index') || symbolUpper.includes('US30')) {
        pipValue = 1.00
      } else {
        pipValue = 0.0001
      }
    }

    const leverageStr = String(currentBalance?.leverage || "1:2000")
    // Correctly parse leverage from strings like "1:2000" or "2000"
    const leverageMatch = leverageStr.match(/(\d+)$/)
    const accountLeverage = leverageMatch ? parseInt(leverageMatch[1], 10) : 2000

    // Prioritize symbol-specific leverage if available from instrument table (ib_symbol_spreads)
    const leverage = (instrument?.leverage && Number(instrument.leverage) > 0)
      ? Number(instrument.leverage)
      : accountLeverage


    const margin = (vol * contractSize * price) / leverage
    const tradeValue = vol * contractSize * price

    // Spread calculation
    // backend might send spread in points. 
    // quote.spread is usually raw difference (e.g. 0.00015)
    // We need to verify if we should use instrument.spread (which might be from DB) or live quote.spread.
    // Live quote is better.
    // If quote.spread is 16 for BTC.

    // Fee Calculation
    // Logic: Volume * ContractSize * Spread * PipValue
    // User complaint: "calculation here is wrong for pairs , it should be acocording to the volume contract"

    let fees = 0
    // If instrument has specific commission field
    if (instrument?.commission) {
      // Assuming commission is per lot?
      fees = vol * instrument.commission
    } else {
      // Fee Calculation
      // Use spread from DB (instrument.spread) if available, as requested by user.
      // If not, fall back to live quote spread.

      let spreadToUse = 0;

      if (instrument?.spread && instrument.spread > 0) {
        // Backend now maps this from ib_symbol_spreads (startup/pro spread)
        spreadToUse = instrument.spread;
      } else {
        spreadToUse = quote.spread || 0;
      }

      // Calculate Fees
      // Formula: Lot size * pip_value (from DB) * spread
      // User requested: "Lot size * pip_value (from ib_symbol_spreads table) * spread"

      const pipValuePerPoint = instrument?.pipValue ? Number(instrument.pipValue) : 1;
      fees = vol * pipValuePerPoint * spreadToUse;

      // Debug logging
      /*
      console.log('[FeeCalc] Corrected:', {
        symbol: symbolUpper,
        vol,
        pipValuePerPoint,
        spreadToUse,
        fees
      });
      */
    }

    // Round fees to 2 decimals
    // fees = Math.round(fees * 100) / 100

    const calculatedPipValue = contractSize * pipValue * vol
    const swapLong = -(tradeValue * 0.0001)
    const swapShort = 0
    // User requested "Volume in units will have Volume Contract"
    // We will use contractSize here to display it later
    const volumeInUnits = contractSize // vol * contractSize
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
  }, [volume, currentBuyPrice, openPrice, orderType, symbol, currentBalance, quote.spread, instrument])

  // Render financial details section
  const renderFinancialDetails = () => (
    <div className="space-y-2 pt-2 border-t border-foreground/10">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/60">Fees:</span>
        <div className="flex items-center gap-1">
          <span className="text-foreground price-font">≈ {calculateFinancialMetrics.fees.toFixed(2)} USD</span>
          <Tooltip text="Estimated commission and spread costs">
            <HelpCircle className="h-3 w-3 text-foreground/40" />
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/60">Leverage:</span>
        <div className="flex items-center gap-1">
          <span className="text-foreground price-font">{calculateFinancialMetrics.leverage.startsWith('1:') ? calculateFinancialMetrics.leverage : `1:${calculateFinancialMetrics.leverage}`}</span>
          <Tooltip text="Account leverage ratio">
            <HelpCircle className="h-3 w-3 text-foreground/40" />
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/60">Margin:</span>
        <span className="text-foreground price-font">{calculateFinancialMetrics.margin.toFixed(2)} USD</span>
      </div>

      {showMoreDetails && (
        <>


          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground/60">Pip Value:</span>
            <span className="text-foreground price-font">{calculateFinancialMetrics.pipValue.toFixed(2)} USD</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground/60">Volume Contract:</span>
            <span className="text-foreground price-font">{calculateFinancialMetrics.volumeInUnits}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground/60">Volume in USD:</span>
            <span className="text-foreground price-font">{calculateFinancialMetrics.volumeInUSD.toFixed(2)} USD</span>
          </div>


        </>
      )}

      <button
        onClick={() => setShowMoreDetails(!showMoreDetails)}
        className="w-full flex items-center justify-center gap-1 text-xs text-foreground/60 hover:text-foreground/80 pt-1"
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
        <div className="text-xs font-medium text-foreground/80">{label}</div>
        {showTooltip && (
          <Tooltip text={`Set ${label.toLowerCase()}`}>
            <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Not set"
          className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
        />
        <select value={mode} onChange={(e) => onModeChange(e.target.value)} className="w-[70px] border-0 h-9 bg-transparent text-xs text-foreground focus:outline-none focus:ring-0">
          {modeOptions.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => decrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5 text-foreground/60" />
        </button>
        <button
          onClick={() => incrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-foreground/60" />
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
    <div className={cn("w-full h-full flex flex-col glass-card border border-foreground/10 rounded-lg overflow-hidden", className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5">
            <FlagIcon symbol={symbol || 'BTCUSD'} />
          </div>
          <span className="text-sm font-semibold text-foreground">{formatSymbolDisplay(symbol) || 'Select Symbol'}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:border border-transparent hover:border-foreground/20 cursor-pointer group"
            title="Close Order Panel"
          >
            <X className="h-4 w-4 text-foreground/60 group-hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {/* Form Type Selector */}
        <select value={formType} onChange={(e) => handleFormTypeChange(e.target.value as FormType)} className="w-full bg-white/[0.02] border border-foreground/10 rounded-md h-9 px-3 text-sm text-foreground focus:outline-none focus:ring-0 focus:border-primary">
          <option value="regular" className="bg-gray-900">Regular form</option>
          <option value="one-click" className="bg-gray-900">One-click form</option>
          <option value="risk-calculator" className="bg-gray-900">Risk calculator form</option>
        </select>

        {/* ONE-CLICK FORM */}
        {formType === "one-click" && (
          <>
            <Tabs value={orderType === "pending" ? "limit" : orderType} onValueChange={(value: string) => {
              if (value === "limit") {
                setOrderType("pending");
                setPendingOrderType("limit");
                // Auto-initialize preview for pending order
                setPendingOrderSide('buy');
                // Default to current price for immediate visibility
                if (!openPrice) setOpenPrice(currentBuyPrice.toFixed(getPipSize === 0.01 ? 2 : 5));
              } else {
                setOrderType(value as "market" | "pending");
                // Clear pending preview if switching back to market
                setPendingOrderSide(null);
                setOpenPrice("");
              }
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
                    <div className="text-xs font-medium text-foreground/80">Open price</div>
                    <Tooltip text={`Set open price for ${pendingOrderType === "limit" ? "limit" : "stop"} order`}>
                      <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-foreground/60 min-w-[50px]">
                      {pendingOrderType === "limit" ? "Limit" : "Stop"}
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-foreground/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-foreground/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-foreground/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground/80">Volume</div>
              <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
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
                <div className="flex items-center justify-center px-3 text-xs text-foreground/60 min-w-[50px]">
                  Lots
                </div>
                <button
                  onClick={decrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
                <button
                  onClick={incrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
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

            <Tabs value={orderType} onValueChange={(value: string) => {
              if (value === "pending") {
                setOrderType("pending");
                setPendingOrderSide('buy');
                if (!openPrice) setOpenPrice(currentBuyPrice.toFixed(getPipSize === 0.01 ? 2 : 5));
              } else {
                setOrderType(value as "market" | "limit" | "pending");
                setPendingOrderSide(null);
                setOpenPrice("");
              }
            }}>
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
                    <div className="text-xs font-medium text-foreground/80">Open price</div>
                    <Tooltip text={`Set open price for ${pendingOrderType === "limit" ? "limit" : "stop"} order`}>
                      <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-foreground/60 min-w-[50px]">
                      {pendingOrderType === "limit" ? "Limit" : "Stop"}
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-foreground/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-foreground/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-foreground/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                      {pendingOrderType === "limit" && (
                        <span className="ml-2 text-foreground/40">
                          (Buy Limit: below current, Sell Limit: above current)
                        </span>
                      )}
                      {pendingOrderType === "stop" && (
                        <span className="ml-2 text-foreground/40">
                          (Buy Stop: above current, Sell Stop: below current)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground/80">Volume</div>
              <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
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
                <div className="flex items-center justify-center px-3 text-xs text-foreground/60 min-w-[50px]">
                  Lots
                </div>
                <button
                  onClick={decrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
                <button
                  onClick={incrementVolume}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
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
            {pendingOrderSide && renderConfirmationSection()}
          </>
        )}

        {/* RISK CALCULATOR FORM */}
        {formType === "risk-calculator" && (
          <>
            {renderPriceButtonsBordered(false, true)}

            {/* Removed redundant Tabs for Market/Pending in Risk Calculator */}
            <div className="text-sm font-semibold text-foreground/90 border-b border-foreground/5 pb-2 mb-1">
              Market Execution
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground/80">Risk</div>
                <Tooltip text="Maximum amount you're willing to risk on this trade">
                  <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
                <Input
                  type="number"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
                />
                <select value={riskMode} onChange={(e) => setRiskMode(e.target.value as "usd" | "percent")} className="w-[70px] border-0 h-9 bg-transparent text-xs text-foreground focus:outline-none focus:ring-0">
                  <option value="usd" className="bg-gray-900">USD</option>
                  <option value="percent" className="bg-gray-900">%</option>
                </select>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(risk) || 0
                    const jump = riskMode === "usd" ? 10 : 1
                    setRisk(Math.max(0, currentValue - jump).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(risk) || 0
                    const jump = riskMode === "usd" ? 10 : 1
                    setRisk((currentValue + jump).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
              </div>
              {riskMode === "percent" && risk && (
                <div className="text-xs text-foreground/60 text-center">
                  {((parseFloat(risk) || 0) * (currentBalance?.equity || 0) / 100).toFixed(2)} USD
                </div>
              )}
              {riskMode === "usd" && calculateRiskBasedVolume !== null && (
                <div className="text-xs text-foreground/80 text-center font-medium">
                  {calculateRiskBasedVolume.toFixed(2)} lots
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground/80">Stop Loss</div>
                <Tooltip text="Stop loss distance in pips (negative for Buy, positive for Sell)">
                  <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
                <Input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
                />
                <select
                  value={stopLossMode}
                  onChange={(e) => setStopLossMode(e.target.value as "pips" | "price")}
                  className="w-[70px] border-0 h-9 bg-transparent text-xs text-foreground focus:outline-none focus:ring-0 text-center"
                >
                  <option value="pips" className="bg-gray-900">Pips</option>
                  <option value="price" className="bg-gray-900">Price</option>
                </select>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(stopLoss) || 0
                    setStopLoss((currentValue - 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(stopLoss) || 0
                    setStopLoss((currentValue + 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
              </div>
              {(calculatedStopLossPrice !== null || (stopLossMode === "price" && stopLoss)) && calculateRiskBasedVolume !== null && (
                <div className="space-y-0.5">
                  {stopLossMode === "pips" && stopLoss && !isNaN(parseFloat(stopLoss)) && (
                    <div className="text-xs text-foreground/60 text-center flex justify-center gap-3">
                      <span>B: {(currentBuyPrice - parseFloat(stopLoss) * getPipSize).toFixed(2)}</span>
                      <span>S: {(currentSellPrice + parseFloat(stopLoss) * getPipSize).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="text-xs text-red-400/80 text-center font-medium">
                    {(() => {
                      let riskVal = parseFloat(risk) || 0;
                      if (riskMode === "percent") {
                        const equity = currentBalance?.equity || 0;
                        riskVal = (riskVal / 100) * equity;
                      }
                      return riskVal.toFixed(2) + " USD loss";
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground/80">Take Profit</div>
                <Tooltip text="Take profit distance in pips">
                  <HelpCircle className="h-3.5 w-3.5 text-foreground/40" />
                </Tooltip>
              </div>
              <div className="flex items-stretch border border-foreground/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-primary">
                <Input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="Not set"
                  className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-foreground/40"
                />
                <select
                  value={takeProfitMode}
                  onChange={(e) => setTakeProfitMode(e.target.value as "pips" | "price")}
                  className="w-[70px] border-0 h-9 bg-transparent text-xs text-foreground focus:outline-none focus:ring-0 text-center"
                >
                  <option value="pips" className="bg-gray-900">Pips</option>
                  <option value="price" className="bg-gray-900">Price</option>
                </select>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(takeProfit) || 0
                    setTakeProfit(Math.max(0, currentValue - 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
                <button
                  onClick={() => {
                    const currentValue = parseFloat(takeProfit) || 0
                    setTakeProfit((currentValue + 1).toString())
                  }}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
                </button>
              </div>
              {(calculatedTakeProfitPrice !== null || (takeProfitMode === "price" && takeProfit)) && calculateRiskBasedVolume !== null && (
                <div className="space-y-0.5">
                  {takeProfitMode === "pips" && calculatedTakeProfitPrice !== null && (
                    <div className="text-xs text-foreground/60 text-center">
                      {calculatedTakeProfitPrice.toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-green-400/80 text-center font-medium">
                    {(() => {
                      let pips = 0;
                      if (takeProfitMode === "pips") {
                        pips = parseFloat(takeProfit);
                      } else {
                        // Price mode
                        const tpPrice = parseFloat(takeProfit);
                        if (!isNaN(tpPrice)) {
                          let entryPrice = 0;
                          if (orderType === "pending" || orderType === "limit") {
                            entryPrice = openPrice ? parseFloat(openPrice) : 0;
                          } else {
                            entryPrice = (currentBuyPrice + currentSellPrice) / 2;
                          }
                          if (entryPrice > 0) {
                            const pipSize = getPipSize;
                            pips = Math.abs(tpPrice - entryPrice) / pipSize;
                          }
                        }
                      }
                      const profit = pips * getPipValuePerLot * calculateRiskBasedVolume;
                      return profit.toFixed(2) + " USD profit";
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation Section for Risk Calculator */}
            {pendingOrderSide && renderConfirmationSection()}

            {!pendingOrderSide && renderFinancialDetails()}
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

      {marketClosedToast && (
        <MarketClosedToast
          info={marketClosedToast}
          onClose={() => setMarketClosedToast(null)}
        />
      )}
    </div>
  )
}

export default OrderPanel
