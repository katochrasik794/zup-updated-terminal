"use client";
import { useState } from 'react'
import Toggle from '../ui/Toggle'
import IconButton from '../ui/IconButton'
import { useTrading, ChartSettings } from '../../context/TradingContext'

export default function SettingsPanel({ onClose }) {
  const { chartSettings, setChartSettings } = useTrading();

  const handleToggle = (key: keyof ChartSettings) => {
    setChartSettings({ [key]: !chartSettings[key] });
  };

  return (
    <div className="w-full min-w-[240px] flex flex-col h-full overflow-hidden bg-background border border-gray-800 rounded-md">
      {/* Header */}
      <div className="pt-4 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-400 font-medium uppercase text-[13px]">Settings</h2>
          <IconButton onClick={onClose} tooltip="Hide panel">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 lg:p-4 space-y-4 lg:space-y-6">
        {/* Show on chart */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Show on chart</h3>
          <div className="space-y-3 lg:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">Open positions</span>
              <Toggle checked={chartSettings.openPositions} onChange={() => handleToggle('openPositions')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">TP / SL / Stop / Limit</span>
              <Toggle checked={chartSettings.tpsl} onChange={() => handleToggle('tpsl')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}