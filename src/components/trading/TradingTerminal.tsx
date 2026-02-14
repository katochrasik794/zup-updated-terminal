'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import LeftSidebar from '@/components/layout/LeftSidebar'
import ChartSection from '@/components/layout/ChartSection'
import OrderPanel from '@/components/trading/OrderPanel'
import BottomPanel from '@/components/panels/BottomPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import StatusBar from '@/components/layout/StatusBar'

import { useSidebar } from '@/context/SidebarContext'
import { useAccount } from '@/context/AccountContext'
import { useTrading } from '@/context/TradingContext'
import { useInstruments } from '@/context/InstrumentContext'
import { normalizeSymbol as normalizeWsSymbol } from '@/context/WebSocketContext'
import { usePositions, Position } from '@/hooks/usePositions'
import { ordersApi, positionsApi, apiClient, PlaceMarketOrderParams, PlacePendingOrderParams, ClosePositionParams, CloseAllParams, ModifyPendingOrderParams, ModifyPositionParams } from '@/lib/api'
import { closePositionDirect, placeMarketOrderDirect, placePendingOrderDirect, cancelPendingOrderDirect } from '@/lib/metaapi'
import { checkIsMarketClosed } from '@/lib/utils'

import { ImperativePanelHandle } from 'react-resizable-panels'

import ModifyPositionModal from '@/components/modals/ModifyPositionModal'
import OrderPlacedToast from '@/components/ui/OrderPlacedToast'
import MarketClosedToast from '@/components/ui/MarketClosedToast'
import ReactDOM from 'react-dom'

export default function TradingTerminal() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebar();
  const { currentAccountId, currentBalance, getMetaApiToken, metaApiTokens } = useAccount();
  const { symbol, lastModification, clearLastModification } = useTrading();
  const { instruments } = useInstruments();
  const [marketClosedToast, setMarketClosedToast] = useState<any | null>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const [closedToast, setClosedToast] = useState<any>(null)
  const [orderToast, setOrderToast] = useState<any>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true)
  const [confirmedInjections, setConfirmedInjections] = useState<any[]>([])
  const [closedTickets, setClosedTickets] = useState<string[]>([])

  // Memoize toast close handlers to prevent timer resets
  const handleOrderToastClose = useCallback(() => {
    setOrderToast(null);
  }, []);

  const handleClosedToastClose = useCallback(() => {
    setClosedToast(null);
  }, []);

  // Fetch positions, pending orders, and closed positions using REST API hook
  const {
    positions: rawPositions,
    pendingOrders: rawPendingOrders,
    closedPositions: rawClosedPositions,
    isLoading: isPositionsLoading,
    error: positionsError,
    refetch: refetchPositions
  } = usePositions({
    accountId: currentAccountId,
    enabled: !!currentAccountId,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__LIVE_POSITIONS_DATA__ = {
        openPositions: rawPositions || [],
        pendingOrders: rawPendingOrders || [],
        closedPositions: rawClosedPositions || [],
      };
      // Notify ZuperiorBroker to refresh immediately
      window.dispatchEvent(new CustomEvent('zuperior-positions-updated'));
    }
  }, [rawPositions, rawPendingOrders, rawClosedPositions]);

  // Market closed helper
  const isMarketClosed = useCallback((sym?: string) => {
    if (!sym) return false;

    // Find instrument to get category and symbol
    const norm = normalizeWsSymbol(sym);
    const inst = instruments.find(i => normalizeWsSymbol(i.symbol) === norm || i.symbol === sym);

    // For price override, we'll try to find the last quote if possible. 
    // In TradingTerminal, lastQuotes might not be directly available here but we can pass them or just rely on time + category
    // Actually, TradingTerminal doesn't have easy access to lastQuotes here without adding more context usage.
    // For now, time-based check is sufficient for disabling buttons, and the override will naturally work in Watchlist indicator.
    return checkIsMarketClosed(sym, inst?.category || inst?.group || '');
  }, [instruments]);


  // Format positions for BottomPanel display
  const openPositions = useMemo(() => {
    const raw = rawPositions || [];
    // Filter out closed tickets first
    const activeRaw = raw.filter(p => !closedTickets.includes(p.ticket.toString()));

    // Merge manual injections (confirmed by API but maybe not yet in poll)
    const confirmedTickets = new Set(activeRaw.map(p => p.ticket.toString()));
    const pendingInjections = confirmedInjections.filter(p => p.isPosition && !confirmedTickets.has(p.ticket.toString()) && !closedTickets.includes(p.ticket.toString()));

    const combined = [...activeRaw, ...pendingInjections];
    if (combined.length === 0) return [];

    return combined.map((pos: Position) => {
      const profit = pos.profit || 0;
      const plFormatted = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
      const plColor = profit >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]';
      const symbol = pos.symbol || '';
      const flag = symbol.toLowerCase().replace('/', '');

      return {
        symbol,
        type: pos.type,
        volume: (pos.volume / 10000).toFixed(2),
        openPrice: pos.openPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        currentPrice: pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        tp: pos.takeProfit && pos.takeProfit !== 0 ? pos.takeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Add',
        sl: pos.stopLoss && pos.stopLoss !== 0 ? pos.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Add',
        ticket: pos.ticket.toString(),
        openTime: new Date(pos.openTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        swap: pos.swap.toFixed(2),
        commission: pos.commission.toFixed(2),
        pl: plFormatted,
        plColor,
        flag,
        id: pos.id, // Keep original ID for closing
      };
    });
  }, [rawPositions, confirmedInjections, closedTickets]);

  // Format pending orders for BottomPanel display
  const pendingPositions = useMemo(() => {
    const raw = rawPendingOrders || [];
    // Filter out closed/cancelled tickets
    const activeRaw = raw.filter(p => !closedTickets.includes(p.ticket.toString()));

    // Merge injections
    const confirmedIds = new Set(activeRaw.map(p => p.ticket.toString()));
    const pendingInjections = confirmedInjections.filter(p => !p.isPosition && !confirmedIds.has(p.ticket.toString()) && !closedTickets.includes(p.ticket.toString()));

    const combined = [...activeRaw, ...pendingInjections];
    if (combined.length === 0) return [];

    return combined.map((pos: Position) => {
      const profit = pos.profit || 0;
      const plFormatted = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
      const plColor = profit >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]';
      const symbol = pos.symbol || '';
      const flag = symbol.toLowerCase().replace('/', '');

      return {
        symbol,
        type: pos.type,
        volume: (pos.volume / 100).toFixed(2),
        openPrice: pos.openPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        currentPrice: pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        tp: pos.takeProfit && pos.takeProfit !== 0 ? pos.takeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Add',
        sl: pos.stopLoss && pos.stopLoss !== 0 ? pos.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Add',
        ticket: pos.ticket.toString(),
        openTime: new Date(pos.openTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        swap: pos.swap.toFixed(2),
        commission: pos.commission.toFixed(2),
        pl: plFormatted,
        plColor,
        flag,
        id: pos.id,
      };
    });
  }, [rawPendingOrders, confirmedInjections, closedTickets]);

  // Format closed positions for BottomPanel display
  const closedPositions = useMemo(() => {
    if (!rawClosedPositions || rawClosedPositions.length === 0) return [];

    return rawClosedPositions.map((pos: Position) => {
      const profit = pos.profit || 0;
      const plFormatted = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
      const plColor = profit >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]';
      const symbol = pos.symbol || '';
      const flag = symbol.toLowerCase().replace('/', '');

      // Closed trades volume is already in lots from formatPosition, use as-is
      // No division needed (unlike open positions which need /10000)
      return {
        symbol,
        type: pos.type,
        volume: pos.volume.toFixed(2),
        openPrice: pos.openPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        currentPrice: pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        closePrice: pos.closePrice ? pos.closePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        tp: pos.takeProfit && pos.takeProfit !== 0 ? pos.takeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Not Set',
        sl: pos.stopLoss && pos.stopLoss !== 0 ? pos.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'Not Set',
        ticket: pos.ticket.toString(),
        openTime: new Date(pos.openTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        closeTime: pos.closeTime ? new Date(pos.closeTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : '-',
        swap: pos.swap.toFixed(2),
        commission: pos.commission.toFixed(2),
        pl: plFormatted,
        plColor,
        flag,
        id: pos.id,
      };
    });
  }, [rawClosedPositions]);

  const handleClosePosition = async (position: any) => {
    if (!currentAccountId) {
      return;
    }

    if (isMarketClosed(position?.symbol)) {
      setMarketClosedToast('Market closed for this instrument. Trading resumes Sunday 21:05 UTC.');
      return;
    }

    try {
      // Check if this is a pending order (Type 2-5: Buy Limit, Sell Limit, Buy Stop, Sell Stop)
      const isPendingOrder = position.orderType !== undefined &&
        typeof position.orderType === 'number' &&
        position.orderType >= 2 && position.orderType <= 5;

      // Also check by type string
      const typeStr = (position.type || '').toString();
      const isPendingOrderByType = typeStr.includes('Limit') || typeStr.includes('Stop');

      if (isPendingOrder || isPendingOrderByType) {
        // Cancel pending order
        // For pending orders, prefer orderId field, then ticket, then id
        // orderId is set from OrderId field in API response for pending orders
        let orderId = position.orderId || position.ticket || position.id;

        // Validate order ID - must be a valid number > 0
        const orderIdNum = typeof orderId === 'string' ? parseInt(orderId, 10) : Number(orderId);
        if (!orderId || orderIdNum === 0 || isNaN(orderIdNum)) {
          console.error('[ClosePosition] Invalid order ID for pending order:', {
            orderId: position.orderId,
            ticket: position.ticket,
            id: position.id,
            positionId: position.positionId,
            orderType: position.orderType,
            type: position.type,
            fullPosition: position
          });
          return;
        }

        // Get MetaAPI access token
        const accessToken = await getMetaApiToken(currentAccountId);
        if (!accessToken) {
          return;
        }

        const response = await cancelPendingOrderDirect({
          orderId: orderId,
          accountId: currentAccountId,
          accessToken: accessToken,
          comment: "Cancelled from Terminal"
        });

        if (!response.success) {
          console.error('[ClosePosition] Failed to cancel pending order:', response.message);
        } else {
          // Confident Deletion: Hide immediately from UI
          setClosedTickets(prev => [...prev, String(orderId)]);

          // Refresh positions/orders to update UI
          refetchPositions();
        }
        return;
      }

      // Close open position
      const positionId = position.ticket || position.id || position.positionId;
      if (!positionId) {
        return;
      }

      // Get MetaAPI access token
      const accessToken = await getMetaApiToken(currentAccountId);
      if (!accessToken) {
        return;
      }

      // Get position volume for full close (if volume is 0, we need actual position volume for Trading endpoint)
      // position.volume is stored in lots format (e.g., 0.01 = 0.01 lot, 1.0 = 1 lot)
      // Trading endpoint expects MT5 format (e.g., 1 = 0.01 lot, 100 = 1 lot)
      // Convert lots to MT5 format: multiply by 100
      const positionVolumeMT5 = position.volume ? Math.round(Number(position.volume) * 100) : undefined;

      const response = await closePositionDirect({
        positionId: positionId,
        accountId: currentAccountId,
        accessToken: accessToken,
        volume: 0, // 0 = full close
        positionVolumeMT5: positionVolumeMT5, // Actual position volume in MT5 format for Trading endpoint fallback
        comment: "Closed from Terminal (Fast)"
      });

      if (!response.success) {
        // Optionally handle failure (e.g., revert toast or show error)
      } else {
        // Confident Deletion: Hide immediately from UI
        setClosedTickets(prev => [...prev, String(positionId)]);

        // Show toast ONLY after successful closing
        setClosedToast(position);
        // Refresh positions immediately
        refetchPositions();
      }
    } catch (error) {
      console.error('[ClosePosition] Error:', error);
    }
  }

  const handleCloseGroup = async (symbol: string) => {
    if (!currentAccountId) {
      return;
    }

    if (isMarketClosed(symbol)) {
      setMarketClosedToast({
        symbol: symbol,
        message: 'Market is currently closed for this instrument.',
        nextOpen: 'Sunday 21:05 UTC'
      });
      return;
    }

    try {
      // Get all positions for this symbol
      const symbolPositions = openPositions.filter((pos: any) => pos.symbol === symbol);

      if (symbolPositions.length === 0) {
        return;
      }

      // Show toast for the first position immediately
      // setClosedToast(symbolPositions[0]); // MOVED TO AFTER SUCCESS

      // Get MetaAPI access token
      const accessToken = await getMetaApiToken(currentAccountId);
      if (!accessToken) return;

      // Implement Lead Trade pattern: Pick first position as lead, fire remaining with tiny stagger
      const [leadPos, ...remainingPositions] = symbolPositions;
      console.log(`[LeadTrade] Closing Lead Position: ${leadPos.ticket || leadPos.id}`);

      const leadPromise = closePositionDirect({
        positionId: leadPos.ticket || leadPos.id,
        accountId: currentAccountId,
        accessToken: accessToken,
        volume: 0,
        positionVolumeMT5: leadPos.volume ? Math.round(Number(leadPos.volume) * 100) : undefined,
        comment: "Lead Trade (Symbol)"
      });

      // 50ms pulse
      await new Promise(resolve => setTimeout(resolve, 50));

      const remainingPromises = remainingPositions.map((pos: any) => {
        const positionId = pos.ticket || pos.id;
        const positionVolumeMT5 = pos.volume ? Math.round(Number(pos.volume) * 100) : undefined;

        return closePositionDirect({
          positionId: positionId,
          accountId: currentAccountId,
          accessToken: accessToken,
          volume: 0,
          positionVolumeMT5: positionVolumeMT5,
          comment: "Group Closed Parallel"
        });
      });

      const results = await Promise.allSettled([leadPromise, ...remainingPromises]);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successful > 0) {
        // Confident Deletion for Group
        const closedThisGroup = results
          .map((r, i) => r.status === 'fulfilled' && r.value.success ? (symbolPositions[i].ticket || symbolPositions[i].id) : null)
          .filter(t => t !== null) as string[];

        if (closedThisGroup.length > 0) {
          setClosedTickets(prev => [...prev, ...closedThisGroup]);
        }

        setClosedToast(symbolPositions[0]);
        // Refresh positions immediately
        refetchPositions();
      }
    } catch (error) {
    }
  }

  const handleCloseAll = async (option: string) => {
    if (!currentAccountId) {
      return;
    }

    try {
      // Filter positions based on the selected option
      let positionsToClose = [...openPositions];

      if (option === 'profitable') {
        positionsToClose = openPositions.filter((pos: any) => {
          const pl = parseFloat(pos.pl.replace('+', ''));
          return pl > 0;
        });
      } else if (option === 'losing') {
        positionsToClose = openPositions.filter((pos: any) => {
          const pl = parseFloat(pos.pl.replace('+', ''));
          return pl < 0;
        });
      } else if (option === 'buy') {
        positionsToClose = openPositions.filter((pos: any) => pos.type === 'Buy');
      } else if (option === 'sell') {
        positionsToClose = openPositions.filter((pos: any) => pos.type === 'Sell');
      }

      const closedDueToMarket = positionsToClose.filter((pos: any) => isMarketClosed(pos.symbol));
      if (closedDueToMarket.length > 0) {
        setMarketClosedToast({
          symbol: 'Multiple Symbols',
          message: 'Market closed for one or more selected instruments.',
          nextOpen: 'Sunday 21:05 UTC'
        });
        positionsToClose = positionsToClose.filter((pos: any) => !isMarketClosed(pos.symbol));
      }

      if (positionsToClose.length === 0) {
        return;
      }

      // Show notification immediately for the first closed position
      // setClosedToast(positionsToClose[0]); // MOVED TO AFTER SUCCESS

      // Get MetaAPI access token
      const accessToken = await getMetaApiToken(currentAccountId);
      if (!accessToken) return;

      // Implement Lead Trade pattern for Close All
      const [leadPos, ...remainingPositions] = positionsToClose;
      console.log(`[LeadTrade] Closing Lead Position (Close All): ${leadPos.ticket || leadPos.id}`);

      const leadPromise = closePositionDirect({
        positionId: leadPos.ticket || leadPos.id,
        accountId: currentAccountId,
        accessToken: accessToken,
        volume: 0,
        positionVolumeMT5: leadPos.volume ? Math.round(Number(leadPos.volume) * 100) : undefined,
        comment: "Lead Trade (All)"
      });

      // 50ms pulse
      await new Promise(resolve => setTimeout(resolve, 50));

      const remainingPromises = remainingPositions.map((pos: any) => {
        const positionId = pos.ticket || pos.id;
        const positionVolumeMT5 = pos.volume ? Math.round(Number(pos.volume) * 100) : undefined;

        return closePositionDirect({
          positionId: positionId,
          accountId: currentAccountId,
          accessToken: accessToken,
          volume: 0,
          positionVolumeMT5: positionVolumeMT5,
          comment: "Close All Parallel"
        });
      });

      const results = await Promise.allSettled([leadPromise, ...remainingPromises]);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successful > 0) {
        // Confident Deletion for All
        const closedAllMatch = results
          .map((r, i) => (r.status === 'fulfilled' && (r.value as any).success) ? (positionsToClose[i].ticket || positionsToClose[i].id) : null)
          .filter(t => t !== null) as string[];

        if (closedAllMatch.length > 0) {
          setClosedTickets(prev => [...prev, ...closedAllMatch]);
        }

        setClosedToast(positionsToClose[0]);
        // Refresh positions immediately
        refetchPositions();
      }
    } catch (error) {
    }
  }

  // Helper function to normalize symbol suffixes (convert uppercase M or R to lowercase)
  const normalizeSymbolForOrder = useCallback((symbol: string): string => {
    if (!symbol) return symbol;
    // Convert trailing uppercase M or R to lowercase to match instrument feed
    return symbol.replace(/M$/, 'm').replace(/R$/, 'r');
  }, []);

  // Helper function to calculate required margin (matching zuperior-terminal)
  const calculateRequiredMargin = useCallback((volume: number, price: number, symbol: string, leverage: number): number => {
    const symbolUpper = symbol.toUpperCase();

    let contractSize: number;
    if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
      contractSize = 100; // Metals: 1 lot = 100 oz
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
      contractSize = 1; // Crypto: 1 lot = 1 unit
    } else {
      contractSize = 100000; // Forex: 1 lot = 100,000 units
    }

    // Calculate margin: (Volume * ContractSize * Price) / Leverage
    const requiredMargin = (volume * contractSize * price) / leverage;

    // Add 5% buffer for safety (spread, slippage, etc.)
    return requiredMargin * 1.05;
  }, []);

  // Order placement handlers
  const handleBuyOrder = async (orderData: any) => {
    if (!currentAccountId) {
      return;
    }

    try {
      const chosenSymbol = normalizeSymbolForOrder(symbol || 'BTCUSD');

      if (orderData.orderType === 'market') {
        // Get MetaAPI access token - Try cache first for speed
        let accessToken = (metaApiTokens as any)[currentAccountId];
        if (!accessToken) {
          accessToken = await getMetaApiToken(currentAccountId);
        }

        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place market order directly
        const response = await placeMarketOrderDirect({
          accountId: currentAccountId,
          accessToken: accessToken,
          symbol: chosenSymbol,
          side: 'buy',
          volume: orderData.volume,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          comment: 'Buy from Terminal (Fast)'
        });

        if (response.success) {
          // Confident Injection: Zero-latency confirmation UI
          const apiData: any = response.data || {};
          const ticket = apiData.PriceOpen || apiData.priceOpen || apiData.OrderId || apiData.Ticket || apiData.PositionId || 0;

          if (ticket) {
            const confirmedTrade: any = {
              id: String(ticket),
              ticket: Number(ticket),
              symbol: chosenSymbol,
              type: 'Buy',
              volume: (orderData.volume || 0) * 10000, // Normalized to units for openPositions 1/10000 scaling
              openPrice: apiData.PriceOpen || apiData.priceOpen || apiData.Price || 0,
              currentPrice: apiData.PriceOpen || apiData.priceOpen || apiData.Price || 0,
              takeProfit: orderData.takeProfit || 0,
              stopLoss: orderData.stopLoss || 0,
              openTime: new Date().toISOString(),
              swap: 0,
              profit: 0,
              commission: 0,
              isPosition: true
            };
            setConfirmedInjections(prev => [...prev, confirmedTrade]);
          }

          refetchPositions();
          // Show toast notification
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: apiData.PriceOpen || apiData.priceOpen || apiData.Price || apiData.price || null,
            orderType: 'market',
            profit: apiData.Profit || apiData.profit || null,
          });
        } else {
          // If API call failed, show error toast
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: 'market',
            profit: null,
            error: response.message || 'Not enough money',
          });
        }
      } else if (orderData.orderType === 'pending' || orderData.orderType === 'limit') {
        // Validate that openPrice is provided for pending orders
        if (!orderData.openPrice || orderData.openPrice <= 0) {
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null,
            error: 'Open price is required for pending orders',
          });
          return;
        }

        // Get MetaAPI access token - Try cache first for speed
        let accessToken = (metaApiTokens as any)[currentAccountId];
        if (!accessToken) {
          accessToken = await getMetaApiToken(currentAccountId);
        }

        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place pending order directly (symbol already normalized above)
        const response = await placePendingOrderDirect({
          accountId: currentAccountId,
          accessToken: accessToken,
          symbol: chosenSymbol,
          side: 'buy',
          volume: orderData.volume,
          price: orderData.openPrice,
          orderType: orderData.pendingOrderType || 'limit',
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          comment: 'Buy Limit/Stop from Terminal (Fast)'
        });

        if (response.success) {
          // Confident Injection: Zero-latency confirmation UI for pending orders
          const apiData: any = response.data || {};
          const ticket = apiData.OrderId || apiData.Ticket || apiData.Id || 0;
          const pType = orderData.pendingOrderType || 'limit';

          if (ticket) {
            const confirmedTrade: any = {
              id: String(ticket),
              ticket: Number(ticket),
              symbol: chosenSymbol,
              type: `Buy ${pType.charAt(0).toUpperCase() + pType.slice(1)}`,
              volume: (orderData.volume || 0) * 100, // Normalized to lots * 100 for pending 1/100 scaling
              openPrice: orderData.openPrice || 0,
              currentPrice: orderData.openPrice || 0,
              takeProfit: orderData.takeProfit || 0,
              stopLoss: orderData.stopLoss || 0,
              openTime: new Date().toISOString(),
              swap: 0,
              profit: 0,
              commission: 0,
              isPosition: false
            };
            setConfirmedInjections(prev => [...prev, confirmedTrade]);
          }

          // Immediately refresh UI
          refetchPositions();

          // Show toast notification
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: orderData.openPrice || apiData.PriceOrder || apiData.priceOrder || null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null, // Pending orders don't have profit yet
          });
        } else {
          // If API call failed, show error toast
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null,
            error: response.message || 'Not enough money',
          });
        }
      }
    } catch (error: any) {
      // If API call fails, show error toast
      const chosenSymbol = symbol || 'BTCUSD';
      setOrderToast({
        side: 'buy',
        symbol: chosenSymbol,
        volume: orderData.volume || 0,
        price: null,
        orderType: orderData.orderType || 'market',
        profit: null,
        error: error?.message || 'Not enough money',
      });
    }
  };

  const handleSellOrder = async (orderData: any) => {
    if (!currentAccountId) {
      return;
    }

    try {
      const chosenSymbol = normalizeSymbolForOrder(symbol || 'BTCUSD');

      if (orderData.orderType === 'market') {
        // Get MetaAPI access token - Try cache first for speed
        let accessToken = (metaApiTokens as any)[currentAccountId];
        if (!accessToken) {
          accessToken = await getMetaApiToken(currentAccountId);
        }

        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place market order directly
        const response = await placeMarketOrderDirect({
          accountId: currentAccountId,
          accessToken: accessToken,
          symbol: chosenSymbol,
          side: 'sell',
          volume: orderData.volume,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          comment: 'Sell from Terminal (Fast)'
        });

        if (response.success) {
          // Confident Injection: Zero-latency confirmation UI
          const apiData: any = response.data || {};
          const ticket = apiData.PriceOpen || apiData.priceOpen || apiData.OrderId || apiData.Ticket || apiData.PositionId || 0;

          if (ticket) {
            const confirmedTrade: any = {
              id: String(ticket),
              ticket: Number(ticket),
              symbol: chosenSymbol,
              type: 'Sell',
              volume: (orderData.volume || 0) * 10000,
              openPrice: apiData.PriceOpen || apiData.priceOpen || apiData.Price || 0,
              currentPrice: apiData.PriceOpen || apiData.priceOpen || apiData.Price || 0,
              takeProfit: orderData.takeProfit || 0,
              stopLoss: orderData.stopLoss || 0,
              openTime: new Date().toISOString(),
              swap: 0,
              profit: 0,
              commission: 0,
              isPosition: true
            };
            setConfirmedInjections(prev => [...prev, confirmedTrade]);
          }

          refetchPositions();
          // Show toast notification
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: apiData.PriceOpen || apiData.priceOpen || apiData.Price || apiData.price || null,
            orderType: 'market',
            profit: apiData.Profit || apiData.profit || null,
          });
        } else {
          // If API call failed, show error toast
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: 'market',
            profit: null,
            error: response.message || 'Not enough money',
          });
        }
      } else if (orderData.orderType === 'pending' || orderData.orderType === 'limit') {
        // Validate that openPrice is provided for pending orders
        if (!orderData.openPrice || orderData.openPrice <= 0) {
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null,
            error: 'Open price is required for pending orders',
          });
          return;
        }

        // Get MetaAPI access token - Try cache first for speed
        let accessToken = (metaApiTokens as any)[currentAccountId];
        if (!accessToken) {
          accessToken = await getMetaApiToken(currentAccountId);
        }

        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place pending order directly (symbol already normalized above)
        const response = await placePendingOrderDirect({
          accountId: currentAccountId,
          accessToken: accessToken,
          symbol: chosenSymbol,
          side: 'sell',
          volume: orderData.volume,
          price: orderData.openPrice,
          orderType: orderData.pendingOrderType || 'limit',
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          comment: 'Sell Limit/Stop from Terminal (Fast)'
        });

        if (response.success) {
          // Confident Injection: Zero-latency confirmation UI for pending orders
          const apiData: any = response.data || {};
          const ticket = apiData.OrderId || apiData.Ticket || apiData.Id || 0;
          const pType = orderData.pendingOrderType || 'limit';

          if (ticket) {
            const confirmedTrade: any = {
              id: String(ticket),
              ticket: Number(ticket),
              symbol: chosenSymbol,
              type: `Sell ${pType.charAt(0).toUpperCase() + pType.slice(1)}`,
              volume: (orderData.volume || 0) * 100,
              openPrice: orderData.openPrice || 0,
              currentPrice: orderData.openPrice || 0,
              takeProfit: orderData.takeProfit || 0,
              stopLoss: orderData.stopLoss || 0,
              openTime: new Date().toISOString(),
              swap: 0,
              profit: 0,
              commission: 0,
              isPosition: false
            };
            setConfirmedInjections(prev => [...prev, confirmedTrade]);
          }

          // Immediately refresh UI
          refetchPositions();

          // Show toast notification
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: orderData.openPrice || apiData.PriceOrder || apiData.priceOrder || null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null, // Pending orders don't have profit yet
          });
        } else {
          // If API call failed, show error toast
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: null,
            orderType: orderData.pendingOrderType || 'limit',
            profit: null,
            error: response.message || 'Not enough money',
          });
        }
      }
    } catch (error: any) {
      // If API call fails, show error toast
      const chosenSymbol = symbol || 'BTCUSD';
      setOrderToast({
        side: 'sell',
        symbol: chosenSymbol,
        volume: orderData.volume || 0,
        price: null,
        orderType: orderData.orderType || 'market',
        profit: null,
        error: error?.message || 'Not enough money',
      });
    }
  };

  // Handle modify position/order requests
  const lastModificationRef = useRef<any | null>(null);
  const isProcessingModification = useRef(false);

  /* 
   * CRITICAL: Disabled to prevent double API calls. 
   * Modification is now handled by TVChartContainer -> ZuperiorBroker -> metaapi.ts
   * This logic was causing 500 errors by calling localhost API without auth.
   */
  useEffect(() => {
    // Disabled
    return;

    if (!lastModification || !currentAccountId) return;

    // Prevent duplicate processing
    if (isProcessingModification.current) return;
    if (lastModificationRef.current?.id === lastModification.id &&
      lastModificationRef.current?.tp === lastModification.tp &&
      lastModificationRef.current?.sl === lastModification.sl) {
      return; // Already processed this exact modification
    }

    isProcessingModification.current = true;
    lastModificationRef.current = lastModification;

    const handleModify = async () => {
      try {
        const { id, tp, sl } = lastModification;

        // Check if this is a pending order by checking if it exists in pendingOrders
        const pendingOrder = rawPendingOrders.find((order: Position) =>
          order.ticket.toString() === id.toString() || order.id === id
        );

        if (pendingOrder) {
          // Modify pending order
          const params: ModifyPendingOrderParams = {
            accountId: currentAccountId || '',
            orderId: id.toString(),
            stopLoss: sl && sl !== '' && sl !== 'Not Set' && sl !== 'Add' ? parseFloat(sl) : undefined,
            takeProfit: tp && tp !== '' && tp !== 'Not Set' && tp !== 'Add' ? parseFloat(tp) : undefined,
          };

          const response = await ordersApi.modifyPendingOrder(params);

          if (response.success) {
            // Refresh pending orders to show updated TP/SL
            refetchPositions();

            // Show success toast for modification
            setOrderToast({
              side: pendingOrder.type?.includes('Buy') ? 'buy' : 'sell',
              symbol: pendingOrder.symbol || symbol || 'BTCUSD',
              volume: (pendingOrder.volume / 100).toFixed(2),
              price: null,
              orderType: pendingOrder.type?.includes('Limit') ? 'limit' : 'stop',
              profit: null,
              isModified: true, // Flag to indicate this is a modification
            });
          } else {
            // Show error toast
            setOrderToast({
              side: pendingOrder.type?.includes('Buy') ? 'buy' : 'sell',
              symbol: pendingOrder.symbol || symbol || 'BTCUSD',
              volume: (pendingOrder.volume / 100).toFixed(2),
              price: null,
              orderType: pendingOrder.type?.includes('Limit') ? 'limit' : 'stop',
              profit: null,
              error: response.message || 'Failed to modify pending order',
            });
          }
        } else {
          // Modify open position
          const openPosition = rawPositions.find((pos: Position) =>
            pos.ticket.toString() === id.toString() || pos.id === id
          );

          if (openPosition) {
            // Clean and parse TP/SL values, removing commas
            let stopLoss: number | undefined = undefined;
            let takeProfit: number | undefined = undefined;

            if (sl && sl !== '' && sl !== 'Not Set' && sl !== 'Add') {
              const slClean = String(sl).replace(/,/g, '');
              const slParsed = parseFloat(slClean);
              if (!isNaN(slParsed) && slParsed > 0) {
                stopLoss = slParsed;
              }
            }

            if (tp && tp !== '' && tp !== 'Not Set' && tp !== 'Add') {
              const tpClean = String(tp).replace(/,/g, '');
              const tpParsed = parseFloat(tpClean);
              if (!isNaN(tpParsed) && tpParsed > 0) {
                takeProfit = tpParsed;
              }
            }

            const params: ModifyPositionParams = {
              accountId: currentAccountId || '',
              positionId: id.toString(),
              stopLoss: stopLoss,
              takeProfit: takeProfit,
              comment: `Modify TP/SL via actions for ${openPosition.symbol || symbol || 'BTCUSD'}`,
            };

            const response = await positionsApi.modifyPosition(params);

            if (response.success) {
              // Refresh positions to show updated TP/SL
              refetchPositions();

              // Show success toast for modification
              setOrderToast({
                side: openPosition.type?.includes('Buy') || openPosition.type === 'Buy' ? 'buy' : 'sell',
                symbol: openPosition.symbol || symbol || 'BTCUSD',
                volume: (openPosition.volume / 10000).toFixed(2),
                price: null,
                orderType: 'market',
                profit: null,
                isModified: true, // Flag to indicate this is a modification
              });
            } else {
              // Show error toast
              setOrderToast({
                side: openPosition.type?.includes('Buy') || openPosition.type === 'Buy' ? 'buy' : 'sell',
                symbol: openPosition.symbol || symbol || 'BTCUSD',
                volume: (openPosition.volume / 10000).toFixed(2),
                price: null,
                orderType: 'market',
                profit: null,
                error: response.message || 'Failed to modify position',
              });
            }
          }
        }
      } catch (error: any) {
        setOrderToast({
          side: 'buy',
          symbol: symbol || 'BTCUSD',
          volume: 0,
          price: null,
          orderType: 'market',
          profit: null,
          error: error?.message || 'Failed to modify order',
        });
      } finally {
        // Clear processing flag and reset after a delay to allow for new modifications
        setTimeout(() => {
          isProcessingModification.current = false;
          // Clear lastModification to prevent re-triggering
          if (lastModificationRef.current?.id === lastModification?.id) {
            lastModificationRef.current = null;
            clearLastModification(); // Clear from context to prevent re-triggering
          }
        }, 500); // Reduced delay to 500ms for faster response
      }
    };

    handleModify();
  }, [lastModification, currentAccountId, symbol]); // Removed rawPendingOrders from dependencies to prevent re-triggering

  // Resize the left panel when it expands or collapses
  useEffect(() => {
    if (leftPanelRef.current) {
      if (isSidebarExpanded) {
        leftPanelRef.current.resize(23) // 15% ≈ 290px on 1920px screen
      } else {
        leftPanelRef.current.resize(0)
      }
    }
  }, [isSidebarExpanded])

  // Listen for trade triggers from the chart (ZuperiorBroker)
  useEffect(() => {
    const handleTradeTrigger = (e: any) => {
      const { orderData, side } = e.detail;
      if (side === 'buy') {
        handleBuyOrder(orderData).catch(console.error);
      } else {
        handleSellOrder(orderData).catch(console.error);
      }
    };

    window.addEventListener('zuperior-trigger-trade', handleTradeTrigger);
    return () => window.removeEventListener('zuperior-trigger-trade', handleTradeTrigger);
  }, [handleBuyOrder, handleSellOrder]);

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
        {/* Left sidebar with panels */}
        <ResizablePanel
          ref={leftPanelRef}
          defaultSize={20}
          minSize={8}
          maxSize={40}
          className={`min-h-0 h-full ${!isSidebarExpanded ? "!min-w-[48px] !max-w-[48px] !flex-none" : ""}`}
          collapsedSize={0}
          collapsible={true}
          onCollapse={() => setIsSidebarExpanded(false)}
          onExpand={() => setIsSidebarExpanded(true)}
        >
          <LeftSidebar
            onPanelStateChange={setIsSidebarExpanded}
            isExpanded={isSidebarExpanded}
          />
        </ResizablePanel>

        {/* Horizontal resize handle */}
        <ResizableHandle withHandle={false} disabled={!isSidebarExpanded} className={!isSidebarExpanded ? "pointer-events-none w-0" : ""} />

        {/* Main content area with status bar */}
        <ResizablePanel defaultSize={97} className="flex flex-col h-full gap-1">
          {/* Top content area */}
          <div className="relative flex flex-1 overflow-hidden gap-1">
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <ResizablePanelGroup direction="vertical" className="flex-1">
                {/* Chart section */}
                <ResizablePanel defaultSize={70} minSize={40} maxSize={85} className="min-h-0 overflow-hidden">
                  <ChartSection />
                </ResizablePanel>

                {isBottomPanelVisible && (
                  <>
                    {/* Vertical resize handle */}
                    <ResizableHandle withHandle={false} className="" />

                    {/* Bottom panel */}
                    <ResizablePanel defaultSize={30} minSize={15} maxSize={60} className="min-h-0 overflow-hidden">
                      <BottomPanel
                        openPositions={openPositions}
                        pendingPositions={pendingPositions}
                        closedPositions={closedPositions}
                        onClosePosition={handleClosePosition}
                        onCloseGroup={handleCloseGroup}
                        closedToast={closedToast}
                        setClosedToast={setClosedToast}
                        onCloseAll={handleCloseAll}
                        onHide={() => setIsBottomPanelVisible(false)}
                      />
                    </ResizablePanel>
                  </>
                )}

                {/* Minimized Bottom Panel */}
                {!isBottomPanelVisible && (
                  <div className="flex-none h-[40px] border-t border-gray-800 bg-black">
                    <BottomPanel
                      openPositions={openPositions}
                      pendingPositions={pendingPositions}
                      closedPositions={closedPositions}
                      onClosePosition={handleClosePosition}
                      onCloseGroup={handleCloseGroup}
                      closedToast={closedToast}
                      setClosedToast={setClosedToast}
                      onCloseAll={handleCloseAll}
                      isMinimized={true}
                      onHide={() => setIsBottomPanelVisible(true)}
                    />
                  </div>
                )}
              </ResizablePanelGroup>
            </div>

            {/* Order Panel */}
            {isRightSidebarOpen && (
              <div className="w-[280px] border-l border-[#2a2f36] bg-background flex-shrink-0">
                <OrderPanel
                  onClose={() => setIsRightSidebarOpen(false)}
                  onBuy={handleBuyOrder}
                  onSell={handleSellOrder}
                />
              </div>
            )}

            {/* Floating Open Button */}
            {!isRightSidebarOpen && (
              <button
                onClick={() => setIsRightSidebarOpen(true)}
                className="absolute right-0 top-2 z-50 bg-background border border-[#2a2f36] border-r-0 text-gray-400 hover:text-white transition-colors p-1.5 rounded-l-md shadow-lg cursor-pointer"
                title="Open Order Panel"
              >
                <ChevronLeft size={20} />
              </button>
            )}
          </div>

          {/* Status bar only for center and right areas */}
          <StatusBar
            openPositions={openPositions}
            onCloseAll={handleCloseAll}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <ModifyPositionModal />
      <OrderPlacedToast
        order={orderToast}
        onClose={handleOrderToastClose}
      />
      <MarketClosedToast
        info={marketClosedToast}
        onClose={() => setMarketClosedToast(null)}
      />
    </>
  )
}
