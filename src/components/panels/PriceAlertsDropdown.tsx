'use client';

import React, { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiTrendingUp, FiTrendingDown, FiBell, FiBellOff } from 'react-icons/fi';
import { useAccount } from '../../context/AccountContext';
import { usePriceAlerts, PriceAlert } from '../../hooks/usePriceAlerts';
import { usePriceAlertMonitor } from '../../hooks/usePriceAlertMonitor';
import { useWebSocket } from '../../context/WebSocketContext';
import CreatePriceAlertModal from '../modals/CreatePriceAlertModal';
import { cn } from '../../lib/utils';

interface PriceAlertsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceAlertsDropdown({ isOpen, onClose }: PriceAlertsDropdownProps) {
  const { currentAccountId } = useAccount();
  const { alerts, deleteAlert, updateAlert } = usePriceAlerts(currentAccountId || undefined);
  const { lastQuotes, normalizeSymbol } = useWebSocket();
  const [editingAlertId, setEditingAlertId] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Monitor alerts (triggers notifications)
  usePriceAlertMonitor(currentAccountId || undefined);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this alert?')) {
      await deleteAlert(id);
    }
  };

  const handleToggleActive = async (alert: PriceAlert) => {
    await updateAlert(alert.id, { isActive: !alert.isActive });
  };

  const getCurrentPrice = (symbol: string): number | null => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = lastQuotes[normalizedSymbol] || lastQuotes[symbol];
    return quote ? (quote.bid + quote.ask) / 2 : null;
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(5);
  };

  if (!isOpen) return null;

  const activeAlerts = alerts.filter(a => a.isActive && !a.notificationSent);
  const inactiveAlerts = alerts.filter(a => !a.isActive || a.notificationSent);

  return (
    <>
      {/* Transparent Backdrop for click-outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-[420px] bg-[#02040d] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden font-sans max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <span className="text-gray-200 text-base font-medium">Price alerts</span>
          <button
            onClick={() => {
              setEditingAlertId(undefined);
              setShowCreateModal(true);
            }}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Add alert"
          >
            <FiPlus size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            // Empty State
            <div className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <p className="text-gray-400 mb-6 text-sm">
                Get notified instantly about price movements
              </p>
              <button
                onClick={() => {
                  setEditingAlertId(undefined);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d3a45] hover:bg-[#384652] text-white rounded text-sm font-medium transition-colors cursor-pointer"
              >
                <FiPlus size={16} />
                New alert
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {/* Active Alerts */}
              {activeAlerts.length > 0 && (
                <div>
                  {activeAlerts.map((alert) => {
                    const currentPrice = getCurrentPrice(alert.symbol);
                    const isAbove = alert.condition === 'above';
                    const priceDiff = currentPrice !== null
                      ? isAbove
                        ? currentPrice - alert.targetPrice
                        : alert.targetPrice - currentPrice
                      : null;

                    return (
                      <div
                        key={alert.id}
                        className="px-4 py-3 hover:bg-[#1a1e25] transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium text-sm">{alert.symbol}</span>
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded',
                                  alert.condition === 'above'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                )}
                              >
                                {alert.condition === 'above' ? (
                                  <FiTrendingUp size={12} className="inline mr-1" />
                                ) : (
                                  <FiTrendingDown size={12} className="inline mr-1" />
                                )}
                                {alert.condition === 'above' ? 'Above' : 'Below'}
                              </span>
                            </div>
                            <div className="text-gray-400 text-xs">
                              Target: <span className="text-white">{formatPrice(alert.targetPrice)}</span>
                              {currentPrice !== null && (
                                <>
                                  {' • '}
                                  Current: <span className="text-white">{formatPrice(currentPrice)}</span>
                                  {priceDiff !== null && priceDiff > 0 && (
                                    <span className="text-green-400 ml-1">
                                      ({formatPrice(priceDiff)} away)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingAlertId(alert.id);
                                setShowCreateModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors"
                              title="Edit alert"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(alert)}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors"
                              title={alert.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {alert.isActive ? <FiBell size={14} /> : <FiBellOff size={14} />}
                            </button>
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete alert"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inactive/Triggered Alerts */}
              {inactiveAlerts.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#1a1e25] border-b border-gray-800">
                    <span className="text-xs text-gray-500 uppercase">Inactive / Triggered</span>
                  </div>
                  {inactiveAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="px-4 py-3 hover:bg-[#1a1e25] transition-colors group opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium text-sm">{alert.symbol}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                              {alert.condition === 'above' ? 'Above' : 'Below'} {formatPrice(alert.targetPrice)}
                            </span>
                            {alert.triggeredAt && (
                              <span className="text-xs text-green-400">Triggered</span>
                            )}
                          </div>
                          {alert.triggeredAt && (
                            <div className="text-gray-500 text-xs">
                              Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleActive(alert)}
                            className="p-1.5 text-gray-400 hover:text-white transition-colors"
                            title="Activate"
                          >
                            <FiBellOff size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete alert"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreatePriceAlertModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingAlertId(undefined);
          }}
          alertId={editingAlertId}
        />
      )}
    </>
  );
}
