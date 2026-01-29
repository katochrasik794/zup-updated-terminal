'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FiX, FiTrendingUp, FiTrendingDown, FiCheckCircle } from 'react-icons/fi';
import { useAccount } from '../../context/AccountContext';
import { useTrading } from '../../context/TradingContext';
import { usePriceAlerts, CreatePriceAlertInput } from '../../hooks/usePriceAlerts';
import { useWebSocket } from '../../context/WebSocketContext';
import SymbolSearchPopup from '../panels/SymbolSearchPopup';

interface CreatePriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertId?: string; // If provided, edit mode
}

export default function CreatePriceAlertModal({ isOpen, onClose, alertId }: CreatePriceAlertModalProps) {
  const { currentAccountId } = useAccount();
  const { symbol: currentSymbol } = useTrading();
  const { createAlert, updateAlert, alerts } = usePriceAlerts(currentAccountId || undefined);
  const { lastQuotes, normalizeSymbol } = useWebSocket();
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  
  const [formData, setFormData] = useState<CreatePriceAlertInput>({
    accountId: currentAccountId || '',
    symbol: currentSymbol || '',
    targetPrice: 0,
    condition: 'above',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load existing alert if editing
  useEffect(() => {
    if (alertId && isOpen) {
      const existingAlert = alerts.find(a => a.id === alertId);
      if (existingAlert) {
        setFormData({
          accountId: existingAlert.accountId,
          symbol: existingAlert.symbol,
          targetPrice: existingAlert.targetPrice,
          condition: existingAlert.condition,
        });
      }
    } else if (isOpen) {
      // Reset form for new alert
      setFormData({
        accountId: currentAccountId || '',
        symbol: currentSymbol || '',
        targetPrice: 0,
        condition: 'above',
      });
    }
  }, [alertId, isOpen, alerts, currentAccountId, currentSymbol]);

  // Get current price for selected symbol
  const normalizedSymbol = normalizeSymbol(formData.symbol);
  const quote = lastQuotes[normalizedSymbol] || lastQuotes[formData.symbol];
  const currentPrice = quote ? (quote.bid + quote.ask) / 2 : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.accountId || !formData.symbol || !formData.targetPrice) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.targetPrice <= 0) {
      setError('Target price must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (alertId) {
        // Update existing alert
        const result = await updateAlert(alertId, {
          targetPrice: formData.targetPrice,
          condition: formData.condition,
        });
        if (result) {
          setIsSubmitting(false);
          setSuccessMessage('Alert updated successfully');
          setShowSuccessToast(true);
          setTimeout(() => {
            setShowSuccessToast(false);
            onClose();
          }, 1500);
        } else {
          setIsSubmitting(false);
          throw new Error('Failed to update alert');
        }
      } else {
        // Create new alert - ensure all required fields are present
        const alertData: CreatePriceAlertInput = {
          accountId: formData.accountId,
          symbol: formData.symbol.toUpperCase().trim(),
          targetPrice: formData.targetPrice,
          condition: formData.condition,
        };
        
        console.log('[CreatePriceAlertModal] Creating alert with data:', alertData);
        const result = await createAlert(alertData);
        console.log('[CreatePriceAlertModal] Create alert result:', result);
        
        if (result) {
          setIsSubmitting(false);
          setSuccessMessage('Alert created successfully');
          setShowSuccessToast(true);
          setTimeout(() => {
            setShowSuccessToast(false);
            onClose();
          }, 1500);
        } else {
          setIsSubmitting(false);
          throw new Error('Failed to create alert - no data returned');
        }
      }
    } catch (err: any) {
      console.error('[CreatePriceAlertModal] Error saving alert:', err);
      setError(err.message || 'Failed to save alert');
      setIsSubmitting(false);
    }
  };

  // Success Toast Component
  const SuccessToast = () => {
    if (!showSuccessToast) return null;

    return ReactDOM.createPortal(
      <div className="fixed bottom-4 left-4 z-[99999] bg-[#02040d] text-[#b2b5be] rounded-md shadow-lg border border-green-500/30 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 relative">
          <button
            onClick={() => {
              setShowSuccessToast(false);
              onClose();
            }}
            className="absolute top-2 right-2 text-[#6e757c] hover:text-white transition-colors"
          >
            <FiX size={16} />
          </button>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-green-400">
              <FiCheckCircle size={20} />
            </div>

            <div className="flex-1">
              <h3 className="text-white font-medium text-[14px] leading-tight mb-1">Success</h3>
              <p className="text-[13px] text-[#b2b5be]">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <SuccessToast />
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-[#02040d] border border-gray-700 rounded-lg shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              {alertId ? 'Edit Price Alert' : 'New Price Alert'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            {/* Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Symbol
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  onFocus={() => setShowSymbolSearch(true)}
                  className="w-full px-4 py-2 bg-[#1a1e25] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="Enter symbol (e.g., XAUUSD)"
                />
                {showSymbolSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10">
                    <SymbolSearchPopup
                      isOpen={showSymbolSearch}
                      onClose={() => setShowSymbolSearch(false)}
                      onSelectSymbol={(selectedSymbol) => {
                        setFormData({ ...formData, symbol: selectedSymbol.symbol });
                        setShowSymbolSearch(false);
                      }}
                      triggerRef={null}
                    />
                  </div>
                )}
              </div>
              {currentPrice !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  Current price: {currentPrice.toFixed(5)}
                </p>
              )}
            </div>

            {/* Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Alert when price goes
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, condition: 'above' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
                    formData.condition === 'above'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1a1e25] text-gray-400 hover:bg-[#2d3a45]'
                  }`}
                >
                  <FiTrendingUp size={18} />
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, condition: 'below' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ${
                    formData.condition === 'below'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1a1e25] text-gray-400 hover:bg-[#2d3a45]'
                  }`}
                >
                  <FiTrendingDown size={18} />
                  Below
                </button>
              </div>
            </div>

            {/* Target Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Price
              </label>
              <input
                type="number"
                step="any"
                value={formData.targetPrice || ''}
                onChange={(e) => setFormData({ ...formData, targetPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-[#1a1e25] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Enter target price"
                required
              />
              {currentPrice !== null && formData.targetPrice > 0 && (
                <p className="text-xs mt-1">
                  {formData.condition === 'above' ? (
                    <span className={formData.targetPrice <= currentPrice ? 'text-green-400' : 'text-gray-400'}>
                      {formData.targetPrice <= currentPrice
                        ? '✓ Price is already above target'
                        : `Price needs to rise ${(formData.targetPrice - currentPrice).toFixed(5)}`}
                    </span>
                  ) : (
                    <span className={formData.targetPrice >= currentPrice ? 'text-green-400' : 'text-gray-400'}>
                      {formData.targetPrice >= currentPrice
                        ? '✓ Price is already below target'
                        : `Price needs to fall ${(currentPrice - formData.targetPrice).toFixed(5)}`}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-[#1a1e25] hover:bg-[#2d3a45] text-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : alertId ? 'Update Alert' : 'Create Alert'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

