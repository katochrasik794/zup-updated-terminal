"use client";
import { useEffect } from 'react'
import ReactDOM from 'react-dom'

interface MarketClosedToastProps {
    info: {
        symbol?: string;
        message?: string;
        nextOpen?: string;
    } | string | null;
    onClose: () => void;
}

export default function MarketClosedToast({ info, onClose }: MarketClosedToastProps) {
    useEffect(() => {
        if (!info) return;

        // Auto-dismiss after 5 seconds for market alerts
        const timer = setTimeout(() => {
            onClose()
        }, 5000)
        return () => clearTimeout(timer)
    }, [info]) // Remove onClose from dependencies to prevent timer reset

    if (!info) return null

    return ReactDOM.createPortal(
        <div className="fixed bottom-4 left-4 z-[99999] bg-background text-[#d1d5db] rounded-md shadow-lg border border-amber-500/60 w-[320px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-400 hover:text-foreground transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-amber-400">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-foreground font-medium text-[14px] leading-tight mb-1">
                            Market Closed {typeof info === 'object' && info?.symbol ? ` - ${info.symbol}` : ''}
                        </h3>
                        <p className="text-[13px] text-[#d1d5db]">
                            {typeof info === 'string' ? info : (info?.message || 'Trading is currently unavailable for this instrument.')}
                        </p>
                        {typeof info === 'object' && info?.nextOpen && (
                            <p className="text-[11px] text-amber-500/80 mt-2 font-medium">
                                Resumes: {info.nextOpen}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="h-1 bg-amber-500/30 w-full overflow-hidden">
                <div className="h-full bg-amber-500 animate-[progress_5s_linear_forwards]" />
            </div>
        </div>,
        document.body
    )
}
