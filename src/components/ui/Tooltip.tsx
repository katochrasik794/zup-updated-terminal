'use client';

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Tooltip({ children, text, className = '', placement = 'bottom' }: { children: React.ReactNode, text: string, className?: string, placement?: 'bottom' | 'top' | 'right' | 'left' }) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollX = window.scrollX
      const scrollY = window.scrollY

      let top = 0
      let left = 0

      switch (placement) {
        case 'bottom':
          top = rect.bottom + scrollY + 8
          left = rect.left + scrollX + rect.width / 2
          break
        case 'top':
          top = rect.top + scrollY - 8
          left = rect.left + scrollX + rect.width / 2
          break
        case 'right':
          top = rect.top + scrollY + rect.height / 2
          left = rect.right + scrollX + 8
          break
        case 'left':
          top = rect.top + scrollY + rect.height / 2
          left = rect.left + scrollX - 8
          break
        default:
          top = rect.bottom + scrollY + 8
          left = rect.left + scrollX + rect.width / 2
      }

      setCoords({ top, left })
    }
  }

  const handleMouseEnter = () => {
    updatePosition()
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  const arrowClasses = {
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-800',
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-800'
  }

  const tooltipContent = (
    <div
      className="absolute px-2 py-1 bg-gray-800 text-foreground text-xs rounded shadow-lg whitespace-nowrap z-[9999] border border-[#4a5568] pointer-events-none transition-opacity duration-75"
      style={{
        top: coords.top,
        left: coords.left,
        transform: placement === 'left' || placement === 'right' ? 'translateY(-50%)' : 'translateX(-50%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      {text}
      {/* Arrow */}
      <div className={`absolute border-4 border-transparent ${arrowClasses[placement]}`}></div>
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative flex items-center justify-center ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isVisible && createPortal(tooltipContent, document.body)}
    </>
  )
}
