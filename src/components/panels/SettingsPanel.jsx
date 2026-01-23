import { useState } from 'react'
import Toggle from '../ui/Toggle'
import IconButton from '../ui/IconButton'

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({
    signals: false,
    hmrPeriods: true,
    priceAlerts: true,
    openPositions: true,
    tpsl: false,
    economicCalendar: true,
    highImpact: true,
    middleImpact: false,
    lowImpact: false,
    lowestImpact: false,
    soundPriceAlerts: false,
    soundClosing: false,
    autoTPSL: false,
    orderMode: 'regular',
    priceSource: 'bid',
    theme: 'dark',
    timezone: 'Etc/UTC'
  })

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelect = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="w-full min-w-[240px] flex flex-col h-full overflow-hidden bg-[#141d22]">
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
              <span className="text-gray-200 text-sm lg:text-base">Signals</span>
              <Toggle checked={settings.signals} onChange={() => handleToggle('signals')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">HMR periods</span>
              <Toggle checked={settings.hmrPeriods} onChange={() => handleToggle('hmrPeriods')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">Price alerts</span>
              <Toggle checked={settings.priceAlerts} onChange={() => handleToggle('priceAlerts')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">Open positions</span>
              <Toggle checked={settings.openPositions} onChange={() => handleToggle('openPositions')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">TP / SL / Stop / Limit</span>
              <Toggle checked={settings.tpsl} onChange={() => handleToggle('tpsl')} />
            </div>
            
            {/* Economic Calendar */}
            <div>
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <span className="text-gray-200 text-sm lg:text-base">Economic calendar</span>
                <Toggle checked={settings.economicCalendar} onChange={() => handleToggle('economicCalendar')} />
              </div>
              {settings.economicCalendar && (
                <div className="ml-4 lg:ml-6 space-y-2 lg:space-y-3">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <input
                      type="checkbox"
                      checked={settings.highImpact}
                      onChange={() => handleToggle('highImpact')}
                      className="w-4 h-4 text-gray-500 bg-gray-700 border-gray-600 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <span className="text-gray-200 text-sm lg:text-base">High impact</span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <input
                      type="checkbox"
                      checked={settings.middleImpact}
                      onChange={() => handleToggle('middleImpact')}
                      className="w-4 h-4 text-gray-500 bg-gray-700 border-gray-600 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <span className="text-gray-200 text-sm lg:text-base">Middle impact</span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <input
                      type="checkbox"
                      checked={settings.lowImpact}
                      onChange={() => handleToggle('lowImpact')}
                      className="w-4 h-4 text-gray-500 bg-gray-700 border-gray-600 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <span className="text-gray-200 text-sm lg:text-base">Low impact</span>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <input
                      type="checkbox"
                      checked={settings.lowestImpact}
                      onChange={() => handleToggle('lowestImpact')}
                      className="w-4 h-4 text-gray-500 bg-gray-700 border-gray-600 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <span className="text-gray-200 text-sm lg:text-base">Lowest impact</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sound effects */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Sound effects</h3>
          <div className="space-y-3 lg:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">Price alerts</span>
              <Toggle checked={settings.soundPriceAlerts} onChange={() => handleToggle('soundPriceAlerts')} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-200 text-sm lg:text-base">Closing by TP / SL / SO</span>
              <Toggle checked={settings.soundClosing} onChange={() => handleToggle('soundClosing')} />
            </div>
          </div>
        </div>

        {/* Trading settings */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Trading settings</h3>
          <div className="flex items-center justify-between">
            <span className="text-gray-200 text-sm lg:text-base">Set TP/SL automatically</span>
            <Toggle checked={settings.autoTPSL} onChange={() => handleToggle('autoTPSL')} />
          </div>
        </div>

        {/* Open order mode */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Open order mode</h3>
          <select
            value={settings.orderMode}
            onChange={(e) => handleSelect('orderMode', e.target.value)}
            className="w-full bg-[#2a3441] border border-gray-600 rounded px-3 py-2 text-sm lg:text-base text-gray-200 cursor-pointer"
          >
            <option value="regular">Regular form</option>
            <option value="quick">Quick form</option>
          </select>
        </div>

        {/* Price source */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Price source</h3>
          <select
            value={settings.priceSource}
            onChange={(e) => handleSelect('priceSource', e.target.value)}
            className="w-full bg-[#2a3441] border border-gray-600 rounded px-3 py-2 text-sm lg:text-base text-gray-200 cursor-pointer"
          >
            <option value="bid">Bid</option>
            <option value="ask">Ask</option>
            <option value="mid">Mid</option>
          </select>
        </div>

        {/* Appearance */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Appearance</h3>
          <select
            value={settings.theme}
            onChange={(e) => handleSelect('theme', e.target.value)}
            className="w-full bg-[#2a3441] border border-gray-600 rounded px-3 py-2 text-sm lg:text-base text-gray-200 cursor-pointer"
          >
            <option value="dark">Always dark</option>
            <option value="light">Always light</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {/* Time zone */}
        <div>
          <h3 className="text-gray-300 text-xs lg:text-sm font-bold mb-3 lg:mb-4">Time zone</h3>
          <select
            value={settings.timezone}
            onChange={(e) => handleSelect('timezone', e.target.value)}
            className="w-full bg-[#2a3441] border border-gray-600 rounded px-3 py-2 text-sm lg:text-base text-gray-200 cursor-pointer"
          >
            <option value="Etc/UTC">UTC</option>
            <option value="America/New_York">New York</option>
            <option value="Europe/London">London</option>
            <option value="Asia/Tokyo">Tokyo</option>
          </select>
        </div>
      </div>
    </div>
  )
}