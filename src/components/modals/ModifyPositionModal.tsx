"use client";
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import FlagIcon from '../ui/FlagIcon';
import Tooltip from '../ui/Tooltip';

import { useTrading } from '../../context/TradingContext';
import { useAccount } from '../../context/AccountContext';
import { cn } from '../../lib/utils';

const ModifyPositionModal = () => {
  const { modifyModalState, setModifyModalState, requestModifyPosition } = useTrading();
  const { currentBalance } = useAccount();
  const { isOpen, position } = modifyModalState;

  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [priceValue, setPriceValue] = useState('');
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
      let tpValueStr = '';
      if (position?.tp && position?.tp !== 'Add' && position?.tp !== 'Not Set') {
        tpValueStr = String(position.tp).replace(/,/g, '');
      }

      let slValueStr = '';
      if (position?.sl && position?.sl !== 'Add' && position?.sl !== 'Not Set') {
        slValueStr = String(position.sl).replace(/,/g, '');
      }

      let priceValueStr = '';
      if (position.isOrder) {
        priceValueStr = String(position.openPrice || position.price || '').replace(/,/g, '');
      }

      setTpValue(tpValueStr);
      setSlValue(slValueStr);
      setPriceValue(priceValueStr);
    }
  }, [isOpen, position]);

  // Calculate estimated P/L when TP/SL changes (only for open positions, not pending orders)
  useEffect(() => {
    if (!position) return;

    const isPendingOrder = position.isOrder || position.type === 'Buy Limit' || position.type === 'Sell Limit' ||
      position.type === 'Buy Stop' || position.type === 'Sell Stop';

    if (isPendingOrder) {
      setEstimatedPL(null);
      return;
    }

    const currentPriceStr = String(position.currentPrice || position.price || '0').replace(/,/g, '');
    const openPriceStr = String(position.openPrice || position.avg_price || position.price || '0').replace(/,/g, '');
    const currentPrice = parseFloat(currentPriceStr) || 0;
    const openPrice = parseFloat(openPriceStr) || 0;
    const volume = parseFloat(position.volume || position.qty || 0);
    const isBuy = position.type === 'Buy' || position.side === 1;
    const symbol = (position.symbol || '').toUpperCase();

    let contractSize: number;
    if (symbol.includes('XAU') || symbol.includes('XAG')) {
      contractSize = 100;
    } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
      contractSize = 1;
    } else {
      contractSize = 100000;
    }

    let priceDiff = isBuy ? (currentPrice - openPrice) : (openPrice - currentPrice);
    let currentPL = priceDiff * volume * contractSize;

    const tpValueClean = String(tpValue || '').replace(/,/g, '');
    const tp = parseFloat(tpValueClean);
    if (tp && !isNaN(tp) && tp > 0) {
      const tpDiff = isBuy ? (tp - openPrice) : (openPrice - tp);
      const tpPL = tpDiff * volume * contractSize;
      setEstimatedPL(tpPL);
      return;
    }

    const slValueClean = String(slValue || '').replace(/,/g, '');
    const sl = parseFloat(slValueClean);
    if (sl && !isNaN(sl) && sl > 0) {
      const slDiff = isBuy ? (sl - openPrice) : (openPrice - sl);
      const slPL = slDiff * volume * contractSize;
      setEstimatedPL(slPL);
      return;
    }

    setEstimatedPL(currentPL);
  }, [tpValue, slValue, position]);

  if (!isOpen || !position) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const adjustValue = (setter: (val: string) => void, currentValue: string, delta: number, decimals = 2) => {
    const currentPriceStr = String(position.currentPrice || position.price || '0').replace(/,/g, '');
    const currentPrice = parseFloat(currentPriceStr) || 0;

    const isEmpty = !currentValue || currentValue === '' || currentValue === 'Not set' || currentValue === 'Add' || currentValue === '0';
    const currentValueClean = String(currentValue || '').replace(/,/g, '');
    const baseVal = isEmpty ? currentPrice : (parseFloat(currentValueClean) || currentPrice);

    let adjustedDelta: number;
    if (baseVal >= 10000) {
      adjustedDelta = 100;
    } else if (baseVal >= 1000) {
      adjustedDelta = 10;
    } else if (baseVal >= 100) {
      adjustedDelta = 1;
    } else if (baseVal >= 10) {
      adjustedDelta = 0.1;
    } else {
      adjustedDelta = 0.01;
    }

    adjustedDelta = adjustedDelta * (delta > 0 ? 1 : -1);
    const newVal = (baseVal + adjustedDelta).toFixed(decimals);
    setter(newVal);
  };

  const handleAction = async () => {
    try {
      const orderId = position.ticket || position.id;
      if (!orderId) {
        console.error('[ModifyPositionModal] No orderId found');
        return;
      }

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

      if (tp === undefined && sl === undefined && price === undefined) {
        onClose();
        return;
      }

      // Validation logic
      const isBuy = position.type === 'Buy' || position.type === 'Buy Limit' || position.type === 'Buy Stop' || position.side === 1;
      const currentPrice = parseFloat(String(position.currentPrice || position.price || '0').replace(/,/g, ''));
      const entryPrice = price || parseFloat(String(position.openPrice || position.price || '0').replace(/,/g, ''));

      if (sl && sl > 0) {
        if (isBuy) {
          if (sl >= currentPrice) {
            alert("Buy Stop Loss must be below the current price.");
            return;
          }
          if (position.isOrder && sl >= entryPrice) {
            alert("Buy Stop Loss must be below the entry price.");
            return;
          }
        } else {
          if (sl <= currentPrice) {
            alert("Sell Stop Loss must be above the current price.");
            return;
          }
          if (position.isOrder && sl <= entryPrice) {
            alert("Sell Stop Loss must be above the entry price.");
            return;
          }
        }
      }

      if (tp && tp > 0) {
        if (isBuy) {
          if (tp <= currentPrice) {
            alert("Buy Take Profit must be above the current price.");
            return;
          }
          if (position.isOrder && tp <= entryPrice) {
            alert("Buy Take Profit must be above the entry price.");
            return;
          }
        } else {
          if (tp >= currentPrice) {
            alert("Sell Take Profit must be below the current price.");
            return;
          }
          if (position.isOrder && tp >= entryPrice) {
            alert("Sell Take Profit must be below the entry price.");
            return;
          }
        }
      }

      requestModifyPosition({
        id: orderId,
        tp: tp,
        sl: sl,
        price: price
      });
    } catch (error) {
    }
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/10"
      onClick={handleBackdropClick}
    >
      <div className="bg-background border border-gray-800 rounded-lg w-[400px] shadow-2xl overflow-hidden font-sans text-foreground">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-6 h-6 relative">
                <FlagIcon type={position.flag || 'xauusd'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-bold text-gray-100 tracking-wide">{position.symbol}</span>
                <span className="text-[13px] text-gray-400 font-normal">{position.volume} lots</span>
              </div>
            </div>
            <div className="flex gap-1 pl-9 text-[13px]">
              <span className={`font-medium ${position.type === 'Buy' || position.side === 1 ? 'text-[#0099ff]' : 'text-danger'}`}>
                {position.type || (position.side === 1 ? 'Buy' : 'Sell')}
              </span>
              <span className="text-gray-400">at {position.openPrice || position.price}</span>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className={`flex items-baseline justify-end gap-1 ${parseFloat(position.pl) >= 0 ? 'text-success' : 'text-[#ff444f]'}`}>
                <span className="text-[15px] font-medium">{position.pl || '0.00'}</span>
                <span className="text-[11px] text-gray-400">USD</span>
              </div>
              <div className="text-gray-100 font-medium text-[13px]">
                {position.currentPrice || position.price}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-foreground transition-colors cursor-pointer mt-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-4 pt-4">
          {/* Entry Price (for Orders) */}
          {position.isOrder && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] text-gray-400 font-medium">Entry Price</label>
              </div>
              <div className="flex h-[38px] border border-gray-800 rounded hover:border-gray-700 transition-colors group focus-within:border-primary bg-gray-900">
                <input
                  type="text"
                  placeholder="Price"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  className="flex-1 bg-transparent px-3 text-[14px] text-foreground placeholder-gray-500 outline-none"
                />
                <div className="flex items-center border-l border-gray-800">
                  <div className="flex h-full">
                    <button
                      onClick={() => adjustValue(setPriceValue, priceValue, -0.1)}
                      className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <div className="w-[1px] h-full bg-gray-800"></div>
                    <button
                      onClick={() => adjustValue(setPriceValue, priceValue, 0.1)}
                      className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
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
              <label className="text-[12px] text-gray-400 font-medium">Take Profit</label>
              <Tooltip text="Set a Take Profit if you want your order to close automatically at the price level you have specified. Setting a Take Profit allows you to lock in profits." placement="top">
                <div className="text-gray-400 cursor-help hover:text-foreground transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </Tooltip>
            </div>
            <div className="flex h-[38px] border border-gray-800 rounded hover:border-gray-700 transition-colors group focus-within:border-primary bg-gray-900">
              <input
                type="text"
                placeholder="Not set"
                value={tpValue}
                onChange={(e) => setTpValue(e.target.value)}
                className="flex-1 bg-transparent px-3 text-[14px] text-foreground placeholder-gray-500 outline-none"
              />
              <div className="flex items-center border-l border-gray-800">
                <button className="px-3 h-full text-[12px] text-gray-400 hover:text-foreground flex items-center gap-1 transition-colors hover:bg-gray-800">
                  Price
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <div className="flex h-full border-l border-gray-800">
                  <button
                    onClick={() => adjustValue(setTpValue, tpValue, -0.1)}
                    className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <div className="w-[1px] h-full bg-gray-800"></div>
                  <button
                    onClick={() => adjustValue(setTpValue, tpValue, 0.1)}
                    className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {(() => {
              const stats = calculateStats(parseFloat(String(tpValue).replace(/,/g, '')));
              if (!stats) return null;
              return (
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                  <span>{stats.pips} pips</span>
                  <span className="text-gray-800">|</span>
                  <span className={stats.isProfit ? 'text-success' : 'text-[#ff444f]'}>
                    {stats.isProfit ? '+' : ''}{stats.usd} USD
                  </span>
                  <span className="text-gray-800">|</span>
                  <span className={stats.isProfit ? 'text-success' : 'text-[#ff444f]'}>
                    {stats.isProfit ? '+' : ''}{stats.percent}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Stop Loss */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] text-gray-400 font-medium">Stop Loss</label>
              <Tooltip text="Set a Stop Loss if you want your order to close automatically at the price level you have specified. Setting a Stop Loss enables you to limit losses." placement="top">
                <div className="text-gray-400 cursor-help hover:text-foreground transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </Tooltip>
            </div>
            <div className="flex h-[38px] border border-gray-800 rounded hover:border-gray-700 transition-colors group focus-within:border-primary bg-gray-900">
              <input
                type="text"
                placeholder="Not set"
                value={slValue}
                onChange={(e) => setSlValue(e.target.value)}
                className="flex-1 bg-transparent px-3 text-[14px] text-foreground placeholder-gray-500 outline-none"
              />
              <div className="flex items-center border-l border-gray-800">
                <button className="px-3 h-full text-[12px] text-gray-400 hover:text-foreground flex items-center gap-1 transition-colors hover:bg-gray-800">
                  Price
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <div className="flex h-full border-l border-gray-800">
                  <button
                    onClick={() => adjustValue(setSlValue, slValue, -0.1)}
                    className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <div className="w-[1px] h-full bg-gray-800"></div>
                  <button
                    onClick={() => adjustValue(setSlValue, slValue, 0.1)}
                    className="w-[32px] h-full flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-foreground transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {(() => {
              const stats = calculateStats(parseFloat(String(slValue).replace(/,/g, '')));
              if (!stats) return null;
              return (
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                  <span>{stats.pips} pips</span>
                  <span className="text-gray-800">|</span>
                  <span className={stats.isProfit ? 'text-success' : 'text-[#ff444f]'}>
                    {stats.isProfit ? '+' : ''}{stats.usd} USD
                  </span>
                  <span className="text-gray-800">|</span>
                  <span className={stats.isProfit ? 'text-success' : 'text-[#ff444f]'}>
                    {stats.isProfit ? '+' : ''}{stats.percent}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Action Button */}
          <button
            onClick={handleAction}
            className="w-full h-[40px] bg-primary hover:opacity-90 text-white text-[14px] font-medium rounded transition-colors mt-2"
          >
            {position.isOrder ? 'Modify order' : 'Modify position'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModifyPositionModal;
