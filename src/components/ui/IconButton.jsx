import React from 'react'
import Tooltip from './Tooltip'

export default function IconButton({ children, onClick, tooltip, className = '', ...props }) {
  const button = (
    <button 
      className={`p-1 text-[#b2b5be] hover:text-white transition-colors cursor-pointer hover:bg-[#2a353e] hover:border hover:border-[#4a5568] rounded-sm border border-transparent ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )

  if (tooltip) {
    return <Tooltip text={tooltip}>{button}</Tooltip>
  }

  return button
}
