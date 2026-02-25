/**
 * WebSocket Connection Status Indicator
 */

import React from 'react'
import { cn } from '@/lib/utils'

interface WebSocketStatusProps {
  className?: string
  showDetails?: boolean
  positionsConnected?: boolean // SignalR positions connection status
}

export function WebSocketStatus({ className, showDetails = false, positionsConnected = false }: WebSocketStatusProps) {
  // For now, we'll assume connected if positionsConnected is true
  // In the future, this can be connected to actual WebSocket hooks
  const isUserOnline = positionsConnected === true

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Simple indicator */}
      {!showDetails && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-[10px] font-medium',
              isUserOnline
                ? 'text-green-500'
                : 'text-red-500'
            )}
          >
            {isUserOnline ? '●' : '○'}
          </span>
          <span className="text-[10px] text-foreground/60">
            {isUserOnline ? 'Live' : 'Offline'}
          </span>
        </div>
      )}

      {/* Detailed status - can be implemented later */}
      {showDetails && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', isUserOnline ? 'text-green-500' : 'text-red-500')}>
              {isUserOnline ? '●' : '○'}
            </span>
            <span className="text-xs text-foreground/60">Prices</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', isUserOnline ? 'text-green-500' : 'text-red-500')}>
              {isUserOnline ? '●' : '○'}
            </span>
            <span className="text-xs text-foreground/60">Charts</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs', isUserOnline ? 'text-green-500' : 'text-red-500')}>
              {isUserOnline ? '●' : '○'}
            </span>
            <span className="text-xs text-foreground/60">Trading</span>
          </div>
        </div>
      )}
    </div>
  )
}
