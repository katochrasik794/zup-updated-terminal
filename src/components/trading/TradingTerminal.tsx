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
import { usePositions, Position } from '@/hooks/usePositions'
import { ordersApi, positionsApi, apiClient, PlaceMarketOrderParams, PlacePendingOrderParams, ClosePositionParams, CloseAllParams, ModifyPendingOrderParams, ModifyPositionParams } from '@/lib/api'
import { closePositionDirect, placeMarketOrderDirect, placePendingOrderDirect, cancelPendingOrderDirect } from '@/lib/metaapi'

import { ImperativePanelHandle } from 'react-resizable-panels'

import ModifyPositionModal from '@/components/modals/ModifyPositionModal'
import OrderPlacedToast from '@/components/ui/OrderPlacedToast'

export default function TradingTerminal() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebar();
  const { currentAccountId, currentBalance, getMetaApiToken } = useAccount();
  const { symbol, lastModification, clearLastModification } = useTrading();
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const [closedToast, setClosedToast] = useState<any>(null)
  const [orderToast, setOrderToast] = useState<any>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true)

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

  // CRITICAL: Expose live positions data to TradingView broker
  // This ensures Account Manager shows the same data as the open positions table
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__LIVE_POSITIONS_DATA__ = {
        openPositions: rawPositions || [],
        pendingOrders: rawPendingOrders || [],
        closedPositions: rawClosedPositions || [],
      };
    }
  }, [rawPositions, rawPendingOrders, rawClosedPositions]);


  // Format positions for BottomPanel display
  const openPositions = useMemo(() => {
    if (!rawPositions || rawPositions.length === 0) return [];

    return rawPositions.map((pos: Position) => {
      const profit = pos.profit || 0;
      const plFormatted = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
      const plColor = profit >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]';
      const symbol = pos.symbol || '';
      const flag = symbol.toLowerCase().replace('/', '');

      return {
        symbol,
        type: pos.type,
        volume: (pos.volume / 10000).toFixed(2), // Divide by 10000 to get lots
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
  }, [rawPositions]);

  // Format pending orders for BottomPanel display
  const pendingPositions = useMemo(() => {
    if (!rawPendingOrders || rawPendingOrders.length === 0) return [];

    return rawPendingOrders.map((pos: Position) => {
      const profit = pos.profit || 0;
      const plFormatted = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
      const plColor = profit >= 0 ? 'text-[#00ffaa]' : 'text-[#f6465d]';
      const symbol = pos.symbol || '';
      const flag = symbol.toLowerCase().replace('/', '');

      return {
        symbol,
        type: pos.type,
        volume: (pos.volume / 100).toFixed(2), // Divide by 100 for pending orders
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
  }, [rawPendingOrders]);

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
  }, [rawClosedPositions]);

  const handleClosePosition = async (position: any) => {
    if (!currentAccountId) {
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
        // Show toast ONLY after successful closing
        setClosedToast(position);
      }
    } catch (error) {
      console.error('[ClosePosition] Error:', error);
    }
  }

  const handleCloseGroup = async (symbol: string) => {
    if (!currentAccountId) {
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

      // Close all positions for this symbol in parallel
      const closePromises = symbolPositions.map((pos: any) => {
        const positionId = pos.ticket || pos.id || pos.positionId;
        if (!positionId) return Promise.resolve({ success: false });

        // Get position volume in MT5 format (convert from lots to MT5 format)
        const positionVolumeMT5 = pos.volume ? Math.round(Number(pos.volume) * 100) : undefined;

        return closePositionDirect({
          positionId: positionId,
          accountId: currentAccountId,
          accessToken: accessToken,
          volume: 0, // 0 = full close
          positionVolumeMT5: positionVolumeMT5, // Actual position volume in MT5 format
          comment: "Group Closed from Terminal (Fast)"
        });
      });

      const results = await Promise.allSettled(closePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successful > 0) {
        setClosedToast(symbolPositions[0]);
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

      if (positionsToClose.length === 0) {
        return;
      }

      // Show notification immediately for the first closed position
      // setClosedToast(positionsToClose[0]); // MOVED TO AFTER SUCCESS

      // Get MetaAPI access token
      const accessToken = await getMetaApiToken(currentAccountId);
      if (!accessToken) return;

      // Close each position individually in parallel
      const closePromises = positionsToClose.map((pos: any) => {
        const positionId = pos.ticket || pos.id || pos.positionId;
        if (!positionId) return Promise.resolve({ success: false });

        // Get position volume in MT5 format (convert from lots to MT5 format)
        const positionVolumeMT5 = pos.volume ? Math.round(Number(pos.volume) * 100) : undefined;

        return closePositionDirect({
          positionId: positionId,
          accountId: currentAccountId,
          accessToken: accessToken,
          volume: 0, // 0 = full close
          positionVolumeMT5: positionVolumeMT5, // Actual position volume in MT5 format
          comment: "Close All from Terminal (Fast)"
        });
      });

      const results = await Promise.allSettled(closePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successful > 0) {
        setClosedToast(positionsToClose[0]);
      }
    } catch (error) {
    }
  }

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

    // For pending orders, skip free margin validation - only check when API responds with failure
    const isPendingOrder = orderData.orderType === 'pending' || orderData.orderType === 'limit';

    // For market orders only: Fetch latest balance data and validate free margin BEFORE API calls
    if (!isPendingOrder) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setOrderToast({
            side: 'buy',
            symbol: symbol || 'BTCUSD',
            volume: orderData.volume || 0,
            price: null,
            orderType: orderData.orderType || 'market',
            profit: null,
            error: 'Not enough money',
          });
          return;
        }

        const baseURL = apiClient.getBaseURL();
        const balanceResponse = await fetch(`${baseURL}/api/accounts/${currentAccountId}/profile`, {
          cache: 'no-store',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const balanceResult = await balanceResponse.json();

        if (balanceResult.success && balanceResult.data) {
          const balanceData = balanceResult.data;
          const equity = Number(balanceData.Equity ?? balanceData.equity ?? 0);
          const margin = Number(balanceData.Margin ?? balanceData.margin ?? balanceData.MarginUsed ?? balanceData.marginUsed ?? 0);
          const freeMargin = parseFloat((equity - margin).toFixed(2));

          // CRITICAL: Block if free margin is negative or zero (only for market orders)
          if (freeMargin <= 0) {
            setOrderToast({
              side: 'buy',
              symbol: symbol || 'BTCUSD',
              volume: orderData.volume || 0,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: 'Not enough money',
            });
            return;
          }
        } else {
          // If we can't get balance data, block the order to be safe
          setOrderToast({
            side: 'buy',
            symbol: symbol || 'BTCUSD',
            volume: orderData.volume || 0,
            price: null,
            orderType: orderData.orderType || 'market',
            profit: null,
            error: 'Not enough money',
          });
          return;
        }
      } catch (error) {
        // If balance fetch fails, block the order to be safe
        setOrderToast({
          side: 'buy',
          symbol: symbol || 'BTCUSD',
          volume: orderData.volume || 0,
          price: null,
          orderType: orderData.orderType || 'market',
          profit: null,
          error: 'Not enough money',
        });
        return;
      }

      // Additional margin validation for market orders only
      if (currentBalance) {
        const equity = currentBalance.Equity ?? currentBalance.equity ?? 0;
        const margin = currentBalance.Margin ?? currentBalance.margin ?? 0;
        const freeMargin = currentBalance.MarginFree ?? currentBalance.marginFree ?? currentBalance.FreeMargin ?? currentBalance.freeMargin ?? 0;
        const leverageStr = String(currentBalance.leverage || "1:400");
        const leverageMatch = leverageStr.match(/:?(\d+)/);
        const leverage = leverageMatch ? parseInt(leverageMatch[1], 10) : 400;

        const chosenSymbol = symbol || 'BTCUSD';
        const tradePrice = orderData.openPrice || 0;

        if (tradePrice > 0) {
          const requiredMargin = calculateRequiredMargin(orderData.volume, tradePrice, chosenSymbol, leverage);
          const newMargin = margin + requiredMargin;
          const newFreeMargin = equity - newMargin;

          if (newMargin > equity) {
            setOrderToast({
              side: 'buy',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. This trade would require ${requiredMargin.toFixed(2)} USD margin. Total margin would be ${newMargin.toFixed(2)} USD, exceeding equity of ${equity.toFixed(2)} USD.`,
            });
            return;
          }

          if (requiredMargin > freeMargin) {
            setOrderToast({
              side: 'buy',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient margin. Required: ${requiredMargin.toFixed(2)} USD. Available: ${freeMargin.toFixed(2)} USD`,
            });
            return;
          }

          const newMarginLevel = equity > 0 ? (equity / newMargin) * 100 : 0;
          if (newMarginLevel < 50 && newMarginLevel > 0) {
            setOrderToast({
              side: 'buy',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. Margin level would be ${newMarginLevel.toFixed(2)}%. Minimum required: 50%`,
            });
            return;
          }

          if (newFreeMargin < 0) {
            setOrderToast({
              side: 'buy',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. This trade would result in negative free margin.`,
            });
            return;
          }
        }
      }
    }

    try {
      const chosenSymbol = symbol || 'BTCUSD';

      if (orderData.orderType === 'market') {
        // Get MetaAPI access token
        const accessToken = await getMetaApiToken(currentAccountId);
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
          // Show toast notification
          const apiData: any = response.data || {};
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

        // Get MetaAPI access token
        const accessToken = await getMetaApiToken(currentAccountId);
        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place pending order directly
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
          // Show toast notification
          const apiData: any = response.data || {};
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

    // For pending orders, skip free margin validation - only check when API responds with failure
    const isPendingOrder = orderData.orderType === 'pending' || orderData.orderType === 'limit';

    // For market orders only: Fetch latest balance data and validate free margin BEFORE API calls
    if (!isPendingOrder) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setOrderToast({
            side: 'sell',
            symbol: symbol || 'BTCUSD',
            volume: orderData.volume || 0,
            price: null,
            orderType: orderData.orderType || 'market',
            profit: null,
            error: 'Not enough money',
          });
          return;
        }

        const baseURL = apiClient.getBaseURL();
        const balanceResponse = await fetch(`${baseURL}/api/accounts/${currentAccountId}/profile`, {
          cache: 'no-store',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const balanceResult = await balanceResponse.json();

        if (balanceResult.success && balanceResult.data) {
          const balanceData = balanceResult.data;
          const equity = Number(balanceData.Equity ?? balanceData.equity ?? 0);
          const margin = Number(balanceData.Margin ?? balanceData.margin ?? balanceData.MarginUsed ?? balanceData.marginUsed ?? 0);
          const freeMargin = parseFloat((equity - margin).toFixed(2));

          // CRITICAL: Block if free margin is negative or zero (only for market orders)
          if (freeMargin <= 0) {
            setOrderToast({
              side: 'sell',
              symbol: symbol || 'BTCUSD',
              volume: orderData.volume || 0,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: 'Not enough money',
            });
            return;
          }
        } else {
          // If we can't get balance data, block the order to be safe
          setOrderToast({
            side: 'sell',
            symbol: symbol || 'BTCUSD',
            volume: orderData.volume || 0,
            price: null,
            orderType: orderData.orderType || 'market',
            profit: null,
            error: 'Not enough money',
          });
          return;
        }
      } catch (error) {
        // If balance fetch fails, block the order to be safe
        setOrderToast({
          side: 'sell',
          symbol: symbol || 'BTCUSD',
          volume: orderData.volume || 0,
          price: null,
          orderType: orderData.orderType || 'market',
          profit: null,
          error: 'Not enough money',
        });
        return;
      }

      // Additional margin validation for market orders only
      if (currentBalance) {
        const equity = currentBalance.Equity ?? currentBalance.equity ?? 0;
        const margin = currentBalance.Margin ?? currentBalance.margin ?? 0;
        const freeMargin = currentBalance.MarginFree ?? currentBalance.marginFree ?? currentBalance.FreeMargin ?? currentBalance.freeMargin ?? 0;
        const leverageStr = String(currentBalance.leverage || "1:400");
        const leverageMatch = leverageStr.match(/:?(\d+)/);
        const leverage = leverageMatch ? parseInt(leverageMatch[1], 10) : 400;

        const chosenSymbol = symbol || 'BTCUSD';
        const tradePrice = orderData.openPrice || 0;

        if (tradePrice > 0) {
          const requiredMargin = calculateRequiredMargin(orderData.volume, tradePrice, chosenSymbol, leverage);
          const newMargin = margin + requiredMargin;
          const newFreeMargin = equity - newMargin;

          if (newMargin > equity) {
            setOrderToast({
              side: 'sell',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. This trade would require ${requiredMargin.toFixed(2)} USD margin. Total margin would be ${newMargin.toFixed(2)} USD, exceeding equity of ${equity.toFixed(2)} USD.`,
            });
            return;
          }

          if (requiredMargin > freeMargin) {
            setOrderToast({
              side: 'sell',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient margin. Required: ${requiredMargin.toFixed(2)} USD. Available: ${freeMargin.toFixed(2)} USD`,
            });
            return;
          }

          const newMarginLevel = equity > 0 ? (equity / newMargin) * 100 : 0;
          if (newMarginLevel < 50 && newMarginLevel > 0) {
            setOrderToast({
              side: 'sell',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. Margin level would be ${newMarginLevel.toFixed(2)}%. Minimum required: 50%`,
            });
            return;
          }

          if (newFreeMargin < 0) {
            setOrderToast({
              side: 'sell',
              symbol: chosenSymbol,
              volume: orderData.volume,
              price: null,
              orderType: orderData.orderType || 'market',
              profit: null,
              error: `Insufficient funds. This trade would result in negative free margin.`,
            });
            return;
          }
        }
      }
    }

    try {
      const chosenSymbol = symbol || 'BTCUSD';

      if (orderData.orderType === 'market') {
        // Get MetaAPI access token
        const accessToken = await getMetaApiToken(currentAccountId);
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
          // Show toast notification
          const apiData: any = response.data || {};
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

        // Get MetaAPI access token
        const accessToken = await getMetaApiToken(currentAccountId);
        if (!accessToken) {
          throw new Error('Failed to get MetaAPI access token');
        }

        // Place pending order directly
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
          // Show toast notification
          const apiData: any = response.data || {};
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

  useEffect(() => {
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
            accountId: currentAccountId,
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
              accountId: currentAccountId,
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
    </>
  )
}
