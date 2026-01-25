'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import LeftSidebar from '../components/layout/LeftSidebar'
import ChartSection from '../components/layout/ChartSection'
import OrderPanel from '../components/trading/OrderPanel'
import BottomPanel from '../components/panels/BottomPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable'
import StatusBar from '../components/layout/StatusBar'

import { useSidebar } from '../context/SidebarContext'
import { useAccount } from '../context/AccountContext'
import { useTrading } from '../context/TradingContext'
import { usePositions, Position } from '../hooks/usePositions'
import { ordersApi, positionsApi, PlaceMarketOrderParams, PlacePendingOrderParams, ClosePositionParams, CloseAllParams } from '../lib/api'

import { ImperativePanelHandle } from 'react-resizable-panels'

import ModifyPositionModal from '../components/modals/ModifyPositionModal'
import OrderPlacedToast from '../components/ui/OrderPlacedToast'

export default function TradingTerminal() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebar();
  const { currentAccountId, currentBalance } = useAccount();
  const { symbol } = useTrading();
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const [closedToast, setClosedToast] = useState(null)
  const [orderToast, setOrderToast] = useState(null)
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
    error: positionsError 
  } = usePositions({
    accountId: currentAccountId,
    enabled: !!currentAccountId,
  });

  // Debug logging
  useEffect(() => {
    if (currentAccountId) {
      console.log('[TradingTerminal] Positions state:', {
        accountId: currentAccountId,
        positionsCount: rawPositions.length,
        isLoading: isPositionsLoading,
        error: positionsError,
      });
    }
  }, [currentAccountId, rawPositions, isPositionsLoading, positionsError]);

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
        volume: (pos.volume / 10000).toFixed(2), // Divide by 1000 and format to 2 decimal places
        openPrice: pos.openPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
        currentPrice: pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
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
      
      // For closed trades, volume is already processed in formatPosition (in lots)
      // Log to see what volume we're getting
      console.log(`[TradingTerminal] Closed position volume:`, {
        ticket: pos.ticket,
        symbol: pos.symbol,
        rawVolume: pos.volume,
        volumeType: typeof pos.volume
      });
      
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
      console.error('[TradingTerminal] No account selected');
      return;
    }

    try {
      // Extract position ID from the position object
      const positionId = position.ticket || position.id || position.positionId;
      if (!positionId) {
        console.error('[TradingTerminal] No position ID found');
        return;
      }

      const params: ClosePositionParams = {
        accountId: currentAccountId,
        positionId: positionId,
        symbol: position.symbol,
      };

      const response = await positionsApi.closePosition(params);
      if (response.success) {
        console.log('[TradingTerminal] Position closed successfully:', positionId);
        // Show toast notification
        setClosedToast(position);
      } else {
        console.error('[TradingTerminal] Failed to close position:', response.message);
      }
    } catch (error) {
      console.error('[TradingTerminal] Error closing position:', error);
    }
  }

  const handleCloseGroup = async (symbol: string) => {
    if (!currentAccountId) {
      console.error('[TradingTerminal] No account selected');
      return;
    }

    try {
      // Get all positions for this symbol
      const symbolPositions = openPositions.filter((pos: any) => pos.symbol === symbol);
      
      if (symbolPositions.length === 0) {
        console.log('[TradingTerminal] No positions found for symbol:', symbol);
        return;
      }

      // Close all positions for this symbol
      const closePromises = symbolPositions.map((pos: any) => {
        const positionId = pos.ticket || pos.id || pos.positionId;
        if (!positionId) return Promise.resolve({ success: false });
        
        return positionsApi.closePosition({
          accountId: currentAccountId,
          positionId: positionId,
          symbol: pos.symbol,
        });
      });

      const results = await Promise.allSettled(closePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log('[TradingTerminal] Close group completed:', { symbol, successful, failed });
    } catch (error) {
      console.error('[TradingTerminal] Error closing group:', error);
    }
  }

  const handleCloseAll = async (option: string) => {
    if (!currentAccountId) {
      console.error('[TradingTerminal] No account selected');
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
      // 'all' option uses all positions (no filtering)

      if (positionsToClose.length === 0) {
        console.log('[TradingTerminal] No positions to close for option:', option);
        return;
      }

      // Close each position individually
      const closePromises = positionsToClose.map((pos: any) => {
        const positionId = pos.ticket || pos.id || pos.positionId;
        if (!positionId) return Promise.resolve({ success: false });
        
        return positionsApi.closePosition({
          accountId: currentAccountId,
          positionId: positionId,
          symbol: pos.symbol,
        });
      });

      const results = await Promise.allSettled(closePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log('[TradingTerminal] Close all completed:', { option, successful, failed, total: positionsToClose.length });

      if (successful > 0) {
        // Show notification for the first closed position
        setClosedToast(positionsToClose[0]);
      }
    } catch (error) {
      console.error('[TradingTerminal] Error closing all positions:', error);
    }
  }

  // Order placement handlers
  const handleBuyOrder = async (orderData: any) => {
    if (!currentAccountId) {
      console.error('[TradingTerminal] No account selected');
      return;
    }

    try {
      const chosenSymbol = symbol || 'BTCUSD';
      
      if (orderData.orderType === 'market') {
        // Place market order
        const params: PlaceMarketOrderParams = {
          accountId: currentAccountId,
          symbol: chosenSymbol,
          side: 'buy',
          volume: orderData.volume,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
        };
        
        const response = await ordersApi.placeMarketOrder(params);
        if (response.success) {
          console.log('[TradingTerminal] Buy market order placed:', response.data);
          // Show toast notification
          const apiData = response.data || {};
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: apiData.PriceOpen || apiData.priceOpen || apiData.Price || apiData.price || null,
            orderType: 'market',
            profit: apiData.Profit || apiData.profit || null,
          });
        } else {
          console.error('[TradingTerminal] Failed to place buy market order:', response.message);
        }
      } else if (orderData.orderType === 'pending' || orderData.orderType === 'limit') {
        // Place pending order
        const params: PlacePendingOrderParams = {
          accountId: currentAccountId,
          symbol: chosenSymbol,
          side: 'buy',
          volume: orderData.volume,
          price: orderData.openPrice || 0,
          orderType: orderData.orderType === 'stop' ? 'stop' : 'limit', // Use orderType from orderData, default to limit
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
        };
        
        const response = await ordersApi.placePendingOrder(params);
        if (response.success) {
          console.log('[TradingTerminal] Buy pending order placed:', response.data);
          // Show toast notification
          const apiData = response.data || {};
          setOrderToast({
            side: 'buy',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: orderData.openPrice || apiData.PriceOrder || apiData.priceOrder || null,
            orderType: orderData.orderType === 'stop' ? 'stop' : 'limit',
            profit: null, // Pending orders don't have profit yet
          });
        } else {
          console.error('[TradingTerminal] Failed to place buy pending order:', response.message);
        }
      }
    } catch (error) {
      console.error('[TradingTerminal] Error placing buy order:', error);
    }
  };

  const handleSellOrder = async (orderData: any) => {
    if (!currentAccountId) {
      console.error('[TradingTerminal] No account selected');
      return;
    }

    try {
      const chosenSymbol = symbol || 'BTCUSD';
      
      if (orderData.orderType === 'market') {
        // Place market order
        const params: PlaceMarketOrderParams = {
          accountId: currentAccountId,
          symbol: chosenSymbol,
          side: 'sell',
          volume: orderData.volume,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
        };
        
        const response = await ordersApi.placeMarketOrder(params);
        if (response.success) {
          console.log('[TradingTerminal] Sell market order placed:', response.data);
          // Show toast notification
          const apiData = response.data || {};
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: apiData.PriceOpen || apiData.priceOpen || apiData.Price || apiData.price || null,
            orderType: 'market',
            profit: apiData.Profit || apiData.profit || null,
          });
        } else {
          console.error('[TradingTerminal] Failed to place sell market order:', response.message);
        }
      } else if (orderData.orderType === 'pending' || orderData.orderType === 'limit') {
        // Place pending order
        const params: PlacePendingOrderParams = {
          accountId: currentAccountId,
          symbol: chosenSymbol,
          side: 'sell',
          volume: orderData.volume,
          price: orderData.openPrice || 0,
          orderType: orderData.orderType === 'stop' ? 'stop' : 'limit', // Use orderType from orderData, default to limit
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
        };
        
        const response = await ordersApi.placePendingOrder(params);
        if (response.success) {
          console.log('[TradingTerminal] Sell pending order placed:', response.data);
          // Show toast notification
          const apiData = response.data || {};
          setOrderToast({
            side: 'sell',
            symbol: chosenSymbol,
            volume: orderData.volume,
            price: orderData.openPrice || apiData.PriceOrder || apiData.priceOrder || null,
            orderType: orderData.orderType === 'stop' ? 'stop' : 'limit',
            profit: null, // Pending orders don't have profit yet
          });
        } else {
          console.error('[TradingTerminal] Failed to place sell pending order:', response.message);
        }
      }
    } catch (error) {
      console.error('[TradingTerminal] Error placing sell order:', error);
    }
  };

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