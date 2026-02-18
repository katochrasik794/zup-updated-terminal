"use client";
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import FlagIcon from '../ui/FlagIcon';
import Tooltip from '../ui/Tooltip';

import { useTrading } from '../../context/TradingContext';
import { useAccount } from '../../context/AccountContext';

const ModifyPositionModal = () => {
  const { modifyModalState, setModifyModalState, requestModifyPosition } = useTrading();
  const { currentBalance } = useAccount();
  const { isOpen, position } = modifyModalState;

  const [activeTab, setActiveTab] = useState('modify');
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [partialVolume, setPartialVolume] = useState('');
  const [estimatedPL, setEstimatedPL] = useState<number | null>(null);

  // Helper to calculate P/L stats (Pips, USD, %)
  const calculateStats = (targetPrice: number) => {
    if (!position || !targetPrice || isNaN(targetPrice) || targetPrice <= 0) return null;

    // Remove commas from price strings before parsing
    const openPriceStr = String(position.openPrice || position.avg_price || position.price || '0').replace(/,/g, '');
    const openPrice = parseFloat(openPriceStr) || 0;
    const volume = parseFloat(position.volume || position.qty || 0);
    // Fix: Include Buy Limit and Buy Stop in isBuy check
    const isBuy = position.type === 'Buy' || position.type === 'Buy Limit' || position.type === 'Buy Stop' || position.side === 1;
    const symbol = (position.symbol || '').toUpperCase();
    const balance = currentBalance?.balance || 1; // Avoid division by zero

    let contractSize: number;
    let pointSize: number; // For pip calculation

    if (symbol.includes('XAU') || symbol.includes('XAG')) {
      contractSize = 100;
      pointSize = 0.01; // 2 decimals
    } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
      contractSize = 1;
      pointSize = 0.01; // Usually 2 decimals
    } else if (symbol.includes('JPY')) {
      contractSize = 100000;
      pointSize = 0.01; // 3 decimals, standard pip is 0.01
    } else {
      contractSize = 100000;
      pointSize = 0.0001; // 5 decimals, standard pip is 0.0001
    }

    // Adjust pointSize based on actual price decimals if possible
    // Default assumption above covers most standard cases

    const priceDiff = isBuy ? (targetPrice - openPrice) : (openPrice - targetPrice);
    const usd = priceDiff * volume * contractSize;
    const pips = Math.abs(targetPrice - openPrice) / (pointSize * 10); // 1 pip = 10 points usually
    const percent = (usd / balance) * 100;
    const isProfit = usd >= 0;

    return {
      usd: usd.toFixed(2),
      pips: pips.toFixed(1),
      percent: percent.toFixed(2),
      isProfit
    };
  };

  const onClose = () => {
    setModifyModalState({ ...modifyModalState, isOpen: false });
  };

  // Reset state when position changes or modal opens
  useEffect(() => {
    if (isOpen && position) {
      // Parse TP value, removing commas if present
      // Only set value if it's already set, otherwise leave empty
      let tpValueStr = '';
      if (position?.tp && position?.tp !== 'Add' && position?.tp !== 'Not Set') {
        // Remove commas from existing TP value
        tpValueStr = String(position.tp).replace(/,/g, '');
      }

      // Parse SL value, removing commas if present
      // Only set value if it's already set, otherwise leave empty
      let slValueStr = '';
      if (position?.sl && position?.sl !== 'Add' && position?.sl !== 'Not Set') {
        // Remove commas from existing SL value
        slValueStr = String(position.sl).replace(/,/g, '');
      }

      // Parse current price for orders
      let priceValueStr = '';
      if (position.isOrder) {
        priceValueStr = String(position.openPrice || position.price || '').replace(/,/g, '');
      }

      setTpValue(tpValueStr);
      setSlValue(slValueStr);
      setPriceValue(priceValueStr);
      setPartialVolume(position?.volume || '');
    }
  }, [isOpen, position]);

  // Calculate estimated P/L when TP/SL changes (only for open positions, not pending orders)
  useEffect(() => {
    if (!position) return;

    // Check if this is a pending order
    const isPendingOrder = position.isOrder || position.type === 'Buy Limit' || position.type === 'Sell Limit' ||
      position.type === 'Buy Stop' || position.type === 'Sell Stop';

    // Don't calculate P/L for pending orders
    if (isPendingOrder) {
      setEstimatedPL(null);
      return;
    }

    // Parse prices, removing commas and formatting
    const currentPriceStr = String(position.currentPrice || position.price || '0').replace(/,/g, '');
    const openPriceStr = String(position.openPrice || position.avg_price || position.price || '0').replace(/,/g, '');
    const currentPrice = parseFloat(currentPriceStr) || 0;
    const openPrice = parseFloat(openPriceStr) || 0;
    const volume = parseFloat(position.volume || position.qty || 0);
    const isBuy = position.type === 'Buy' || position.side === 1;
    const symbol = (position.symbol || '').toUpperCase();

    // Get contract size based on symbol type
    let contractSize: number;
    if (symbol.includes('XAU') || symbol.includes('XAG')) {
      contractSize = 100; // Metals: 1 lot = 100 oz
    } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
      contractSize = 1; // Crypto: 1 lot = 1 unit
    } else {
      contractSize = 100000; // Forex: 1 lot = 100,000 units
    }

    // Calculate current P/L
    let priceDiff = isBuy ? (currentPrice - openPrice) : (openPrice - currentPrice);
    let currentPL = priceDiff * volume * contractSize;

    // If TP is set and would be hit, calculate P/L at TP
    // Remove commas from tpValue before parsing
    const tpValueClean = String(tpValue || '').replace(/,/g, '');
    const tp = parseFloat(tpValueClean);
    if (tp && !isNaN(tp) && tp > 0) {
      const tpDiff = isBuy ? (tp - openPrice) : (openPrice - tp);
      const tpPL = tpDiff * volume * contractSize;
      setEstimatedPL(tpPL);
      return;
    }

    // If SL is set and would be hit, calculate P/L at SL
    // Remove commas from slValue before parsing
    const slValueClean = String(slValue || '').replace(/,/g, '');
    const sl = parseFloat(slValueClean);
    if (sl && !isNaN(sl) && sl > 0) {
      const slDiff = isBuy ? (sl - openPrice) : (openPrice - sl);
      const slPL = slDiff * volume * contractSize;
      setEstimatedPL(slPL);
      return;
    }

    // Otherwise show current P/L
    setEstimatedPL(currentPL);
  }, [tpValue, slValue, position]);

  if (!isOpen || !position) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const adjustValue = (setter, currentValue, delta, decimals = 2) => {
    // Get current price from position, removing commas
    const currentPriceStr = String(position.currentPrice || position.price || '0').replace(/,/g, '');
    const currentPrice = parseFloat(currentPriceStr) || 0;

    // If currentValue is empty, "Not set", "Add", or 0, use current price as base
    // Also remove commas from currentValue before parsing
    const isEmpty = !currentValue || currentValue === '' || currentValue === 'Not set' || currentValue === 'Add' || currentValue === '0';
    const currentValueClean = String(currentValue || '').replace(/,/g, '');
    const baseVal = isEmpty ? currentPrice : (parseFloat(currentValueClean) || currentPrice);

    // Calculate appropriate delta based on price magnitude
    // For prices around 88,000, we need a delta of 100, not 0.1
    let adjustedDelta: number;
    if (baseVal >= 10000) {
      adjustedDelta = 100; // For prices >= 10,000 (e.g., BTCUSD)
    } else if (baseVal >= 1000) {
      adjustedDelta = 10; // For prices >= 1,000
    } else if (baseVal >= 100) {
      adjustedDelta = 1; // For prices >= 100
    } else if (baseVal >= 10) {
      adjustedDelta = 0.1; // For prices >= 10
    } else {
      adjustedDelta = 0.01; // For prices < 10
    }

    // Apply the sign from the original delta
    adjustedDelta = adjustedDelta * (delta > 0 ? 1 : -1);

    // Apply delta and format
    const newVal = (baseVal + adjustedDelta).toFixed(decimals);
    setter(newVal);
  };

  const handleAction = async () => {
    if (activeTab === 'modify') {
      try {
        // Use ticket for pending orders, id for open positions
        const orderId = position.ticket || position.id;

        console.log('[ModifyPositionModal] handleAction', { position, orderId, tpValue, slValue, priceValue });

        if (!orderId) {
          console.error('[ModifyPositionModal] No orderId found');
          return;
        }

        // Clean and parse TP/SL values, removing commas
        let tp: number | undefined = undefined;
        let sl: number | undefined = undefined;
        let price: number | undefined = undefined;

        if (tpValue && tpValue !== '' && tpValue !== 'Not set' && tpValue !== 'Add') {
          const tpClean = String(tpValue).replace(/,/g, '').trim();
          const tpParsed = parseFloat(tpClean);
          if (!isNaN(tpParsed) && tpParsed > 0 && isFinite(tpParsed)) {
            tp = tpParsed;
          }
        }

        if (slValue && slValue !== '' && slValue !== 'Not set' && slValue !== 'Add') {
          const slClean = String(slValue).replace(/,/g, '').trim();
          const slParsed = parseFloat(slClean);
          if (!isNaN(slParsed) && slParsed > 0 && isFinite(slParsed)) {
            sl = slParsed;
          }
        }

        if (priceValue && priceValue !== '' && position.isOrder) {
          const priceClean = String(priceValue).replace(/,/g, '').trim();
          const priceParsed = parseFloat(priceClean);
          if (!isNaN(priceParsed) && priceParsed > 0 && isFinite(priceParsed)) {
            price = priceParsed;
          }
        }

        // Only proceed if at least one value is being modified
        if (tp === undefined && sl === undefined && price === undefined) {
          console.log('[ModifyPositionModal] No changes detected');
          onClose();
          return;
        }

        console.log('[ModifyPositionModal] Requesting modify:', { id: orderId, tp, sl, price });
        requestModifyPosition({
          id: orderId,
          tp: tp,
          sl: sl,
          price: price
        });
      } catch (error) {
      }
    }
    // Add logic for partial close / close by if needed
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#02040d] border border-gray-800 rounded-lg w-[400px] shadow-2xl overflow-hidden font-sans text-gray-200">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex justify-between items-start">
          {/* Left Column: Symbol info */}
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-6 h-6 relative">
                <FlagIcon type={position.flag || 'xauusd'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-bold text-gray-100 tracking-wide">{position.symbol}</span>
                <span className="text-[13px] text-[#8b9096] font-normal">{position.volume} lots</span>
              </div>
            </div>
            <div className="flex gap-1 pl-9 text-[13px]">
              <span className={`font-medium ${position.type === 'Buy' || position.side === 1 ? 'text-[#0099ff]' : 'text-[#f6465d]'}`}>
                {position.type || (position.side === 1 ? 'Buy' : 'Sell')}
              </span>
              <span className="text-[#8b9096]">at {position.openPrice || position.price}</span>
            </div>
          </div>

          {/* Right Column: P/L, Price, Close */}
          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className={`flex items-baseline justify-end gap-1 ${parseFloat(position.pl) >= 0 ? 'text-[#00ffaa]' : 'text-[#ff444f]'}`}>
                <span className="text-[15px] font-medium">{position.pl || '0.00'}</span>
                <span className="text-[11px] text-[#8b9096]">USD</span>
              </div>
              <div className="text-[#e1e1e1] font-medium text-[13px]">
                {position.currentPrice || position.price}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#8b9096] hover:text-white transition-colors cursor-pointer mt-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 py-3">
          <div className="flex bg-[#02040d] p-[3px] rounded border border-[#2a3038]">
            {['Modify', 'Partial close']
              .filter(tab => !position.isOrder || tab === 'Modify')
              .map((tab) => {
                const id = tab.toLowerCase().replace(' ', '');
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 py-1.5 text-[13px] font-medium rounded-[4px] transition-all ${isActive
                      ? 'bg-[#8b5cf6] text-black shadow-sm'
                      : 'text-[#8b9096] hover:text-white'
                      }`}
                  >
                    {tab}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-4">
          {activeTab === 'modify' ? (
            <>
              {/* Entry Price (for Orders) */}
              {position.isOrder && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] text-[#8b9096] font-medium">Entry Price</label>
                  </div>
                  <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                    <input
                      type="text"
                      placeholder="Price"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      className="flex-1 bg-transparent px-3 text-[14px] text-white placeholder-[#585c63] outline-none"
                    />
                    <div className="flex items-center border-l border-[#2a3038]">
                      <div className="flex h-full">
                        <button
                          onClick={() => adjustValue(setPriceValue, priceValue, -0.1)}
                          className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <div className="w-[1px] h-full bg-[#2a3038]"></div>
                        <button
                          onClick={() => adjustValue(setPriceValue, priceValue, 0.1)}
                          className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Take Profit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#8b9096] font-medium">Take Profit</label>
                  <Tooltip text="Set a Take Profit if you want your order to close automatically at the price level you have specified. Setting a Take Profit allows you to lock in profits." placement="top">
                    <div className="text-[#8b9096] cursor-help hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <input
                    type="text"
                    placeholder="Not set"
                    value={tpValue}
                    onChange={(e) => setTpValue(e.target.value)}
                    className="flex-1 bg-transparent px-3 text-[14px] text-white placeholder-[#585c63] outline-none"
                  />
                  <div className="flex items-center border-l border-[#2a3038]">
                    <button className="px-3 h-full text-[12px] text-[#8b9096] hover:text-white flex items-center gap-1 transition-colors hover:bg-[#2a3038]">
                      Price
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    <div className="flex h-full border-l border-[#2a3038]">
                      <button
                        onClick={() => adjustValue(setTpValue, tpValue, -0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <div className="w-[1px] h-full bg-[#2a3038]"></div>
                      <button
                        onClick={() => adjustValue(setTpValue, tpValue, 0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* TP Stats */}
                {(() => {
                  const stats = calculateStats(parseFloat(String(tpValue).replace(/,/g, '')));
                  if (!stats) return null;
                  return (
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#8b9096]">
                      <span>{stats.pips} pips</span>
                      <span className="text-[#2a3038]">|</span>
                      <span className={stats.isProfit ? 'text-[#00ffaa]' : 'text-[#ff444f]'}>
                        {stats.isProfit ? '+' : ''}{stats.usd} USD
                      </span>
                      <span className="text-[#2a3038]">|</span>
                      <span className={stats.isProfit ? 'text-[#00ffaa]' : 'text-[#ff444f]'}>
                        {stats.isProfit ? '+' : ''}{stats.percent}%
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Stop Loss */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#8b9096] font-medium">Stop Loss</label>
                  <Tooltip text="Set a Stop Loss if you want your order to close automatically at the price level you have specified. Setting a Stop Loss enables you to limit losses." placement="top">
                    <div className="text-[#8b9096] cursor-help hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <input
                    type="text"
                    placeholder="Not set"
                    value={slValue}
                    onChange={(e) => setSlValue(e.target.value)}
                    className="flex-1 bg-transparent px-3 text-[14px] text-white placeholder-[#585c63] outline-none"
                  />
                  <div className="flex items-center border-l border-[#2a3038]">
                    <button className="px-3 h-full text-[12px] text-[#8b9096] hover:text-white flex items-center gap-1 transition-colors hover:bg-[#2a3038]">
                      Price
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    <div className="flex h-full border-l border-[#2a3038]">
                      <button
                        onClick={() => adjustValue(setSlValue, slValue, -0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <div className="w-[1px] h-full bg-[#2a3038]"></div>
                      <button
                        onClick={() => adjustValue(setSlValue, slValue, 0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* SL Stats */}
                {(() => {
                  const stats = calculateStats(parseFloat(String(slValue).replace(/,/g, '')));
                  if (!stats) return null;
                  return (
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#8b9096]">
                      <span>{stats.pips} pips</span>
                      <span className="text-[#2a3038]">|</span>
                      <span className={stats.isProfit ? 'text-[#00ffaa]' : 'text-[#ff444f]'}>
                        {stats.isProfit ? '+' : ''}{stats.usd} USD
                      </span>
                      <span className="text-[#2a3038]">|</span>
                      <span className={stats.isProfit ? 'text-[#00ffaa]' : 'text-[#ff444f]'}>
                        {stats.isProfit ? '+' : ''}{stats.percent}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : activeTab === 'partialclose' ? (
            <>
              {/* Volume to close */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#e1e1e1] font-medium">Volume to close</label>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <div className="flex-1 flex items-center px-3">
                    <input
                      type="text"
                      value={partialVolume}
                      onChange={(e) => setPartialVolume(e.target.value)}
                      className="w-full bg-transparent text-[14px] text-white placeholder-[#585c63] outline-none"
                    />
                    <span className="text-[14px] text-[#8b9096] ml-2">Lots</span>
                  </div>
                  <div className="flex h-full border-l border-[#2a3038]">
                    <button
                      onClick={() => adjustValue(setPartialVolume, partialVolume, -0.01)}
                      className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <div className="w-[1px] h-full bg-[#2a3038]"></div>
                    <button
                      onClick={() => adjustValue(setPartialVolume, partialVolume, 0.01)}
                      className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-[#8b9096]">
                  0.01 - {position.volume}
                </div>
              </div>
            </>
          ) : null}

          {/* Action Button */}
          <button
            onClick={handleAction}
            className="w-full h-[40px] bg-[#8b5cf6] hover:bg-[#8b5cf6] text-black text-[14px] font-medium rounded transition-colors mt-2"
          >
            {activeTab === 'modify' ? (position.isOrder ? 'Modify order' : 'Modify position') : 'Close position'}
          </button>

          {activeTab === 'partialclose' && (
            <div className="text-center text-[13px] text-[#8b9096]">
              Estimated profit: <span className={position.plColor}>{position.pl} USD</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModifyPositionModal;
