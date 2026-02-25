"use client";
import { useEffect } from 'react'
import ReactDOM from 'react-dom'

export default function OrderPlacedToast({ order, onClose }) {
  useEffect(() => {
    if (!order) return;

    const timer = setTimeout(() => {
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [order]) // Remove onClose from dependencies to prevent timer reset

  if (!order) return null

  // Format the order type display
  const getOrderTypeLabel = () => {
    if (order.orderType === 'market') {
      return order.side === 'buy' ? 'Buy' : 'Sell';
    } else if (order.orderType === 'limit') {
      return order.side === 'buy' ? 'Buy Limit' : 'Sell Limit';
    } else if (order.orderType === 'stop') {
      return order.side === 'buy' ? 'Buy Stop' : 'Sell Stop';
    }
    return order.side === 'buy' ? 'Buy' : 'Sell';
  };

  // Format price display
  const priceDisplay = order.price && !isNaN(parseFloat(order.price))
    ? parseFloat(order.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : null;

  // Format volume display
  const volumeDisplay = parseFloat(order.volume).toFixed(2);

  // If status is sending, show loading toast
  if (order.status === 'sending') {
    return ReactDOM.createPortal(
      <div className="fixed bottom-4 left-4 z-[99999] bg-background text-gray-300 rounded-md shadow-lg border border-blue-500/50 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 relative">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-blue-500">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-foreground font-medium text-[14px] leading-tight mb-1">
                Sending Order...
              </h3>
              <p className="text-[13px] text-gray-300">
                {getOrderTypeLabel()} {volumeDisplay} lot {order.symbol}
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // If there's an error, show error toast
  if (order.error) {
    return ReactDOM.createPortal(
      <div className="fixed bottom-4 left-4 z-[99999] bg-background text-gray-300 rounded-md shadow-lg border border-red-500/50 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-[#6e757c] hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-danger">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-foreground font-medium text-[14px] leading-tight mb-1">
                {order.error.includes('Cooling period') || order.error.includes('restricted')
                  ? 'Trading Restricted'
                  : order.error.includes('money')
                    ? 'Not enough money'
                    : order.error.includes('visible')
                      ? 'Confirmation Issue'
                      : 'Order Failed'}
              </h3>
              <p className="text-[13px] text-gray-300">
                {order.error}
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <div className="fixed bottom-4 left-4 z-[99999] bg-background text-gray-300 rounded-md shadow-lg border border-gray-800 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-[#6e757c] hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 11 12 14 22 4" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-foreground font-medium text-[14px] leading-tight mb-1">
              {order.isModified ? 'Order Modified' : 'Order placed'}
            </h3>
            <p className="text-[13px] text-gray-300 mb-3">
              {getOrderTypeLabel()} {volumeDisplay} lot {order.symbol} {priceDisplay ? `at ${priceDisplay}` : ''}
            </p>

            {order.profit !== undefined && order.profit !== null && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-300">Profit</span>
                <span className={`font-medium font-mono ${order.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {order.profit >= 0 ? '+' : ''}{order.profit.toFixed(2)} USD
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
