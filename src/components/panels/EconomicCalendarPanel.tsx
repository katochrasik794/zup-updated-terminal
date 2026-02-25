"use client";
import { useState } from 'react'
import IconButton from '../ui/IconButton'

export default function EconomicCalendarPanel({ onClose }) {
  const [selectedImpact, setSelectedImpact] = useState('All impacts')
  const [selectedCountry, setSelectedCountry] = useState('All countries')

  const economicEvents = [
    {
      time: '12:00',
      ampm: 'AM',
      event: 'ANZ Business Confidence',
      country: 'NZ',
      impact: 2, // Medium
      actual: '67',
      forecast: '58',
      previous: '58'
    },
    {
      time: '12:00',
      ampm: 'AM',
      event: 'Thanksgiving Day',
      country: 'US',
      impact: 1, // Low
      actual: '-',
      forecast: '-',
      previous: '-'
    },
    {
      time: '12:30',
      ampm: 'AM',
      event: 'Building Capital Expenditure QoQ',
      country: 'NZ',
      impact: 1,
      actual: '2.1%',
      forecast: '0.4%',
      previous: '0.3%'
    },
    {
      time: '12:30',
      ampm: 'AM',
      event: 'Plant Machinery Capital Expenditure QoQ',
      country: 'NZ',
      impact: 1,
      actual: '12%',
      forecast: '0.4%',
      previous: '0.7%'
    }
  ]

  const getCountryFlag = (country) => {
    const flags = {
      'NZ': '🇳🇿',
      'US': '🇺🇸',
      'CN': '🇨🇳',
      'JP': '🇯🇵',
      'AU': '🇦🇺',
      'DE': '🇩🇪',
    }
    return flags[country] || '🏳️'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-gray-300 border border-gray-800 rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 px-4 flex-shrink-0">
        <h2 className="text-gray-300 text-[13px] font-medium uppercase tracking-wider">ECONOMIC CALENDAR</h2>
        <IconButton onClick={onClose} tooltip="Hide panel">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </IconButton>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-4 flex-shrink-0 border-b border-gray-800">
        <div className="relative">
          <select
            value={selectedImpact}
            onChange={(e) => setSelectedImpact(e.target.value)}
            className="w-full bg-background border border-gray-800 rounded px-3 py-2.5 text-sm text-[#e1e2e5] appearance-none cursor-pointer focus:outline-none focus:border-[#4a5568]"
          >
            <option>All impacts</option>
            <option>High impact</option>
            <option>Medium impact</option>
            <option>Low impact</option>
          </select>
          <svg className="absolute right-3 top-3 w-4 h-4 text-[#6f7682] pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="relative">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full bg-background border border-gray-800 rounded px-3 py-2.5 text-sm text-[#e1e2e5] appearance-none cursor-pointer focus:outline-none focus:border-[#4a5568]"
          >
            <option>All countries</option>
            <option>United States</option>
            <option>China</option>
            <option>Japan</option>
            <option>Australia</option>
            <option>Germany</option>
            <option>New Zealand</option>
          </select>
          <svg className="absolute right-3 top-3 w-4 h-4 text-[#6f7682] pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-gray-900 px-4 py-2.5 text-[13px] font-bold text-[#e1e2e5] sticky top-0 z-10 border-b border-gray-800">
          November 27
        </div>
        <div>
          {economicEvents.map((item, index) => (
            <div key={index} className="flex border-b border-gray-800 py-3 px-4 hover:bg-gray-900 transition-colors cursor-pointer group">
              {/* Left Column: Time & Flag/Impact */}
              <div className="w-[70px] flex flex-col gap-2.5 flex-shrink-0">
                <div className="flex flex-col leading-none">
                  <span className="text-[13px] text-gray-300 font-medium">{item.time}</span>
                  <span className="text-[11px] text-[#6f7682] mt-0.5">{item.ampm}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{getCountryFlag(item.country)}</span>
                  <div className="flex gap-[2px] items-end h-3">
                    {[1, 2, 3].map(bar => (
                      <div
                        key={bar}
                        className={`w-[3px] rounded-[1px] ${bar <= item.impact ? 'bg-[#eab308]' : 'bg-gray-800'} ${bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2.5' : 'h-3.5'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Event & Values */}
              <div className="flex-1 min-w-0 pl-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#e1e2e5] text-[13px] font-normal leading-tight pr-2">{item.event}</span>
                  <svg className="w-4 h-4 text-[#6f7682] group-hover:text-gray-300 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="flex justify-between text-[13px] pr-6">
                  <span className={`font-medium w-1/3 text-left ${item.actual !== '-' ? 'text-[#e1e2e5]' : 'text-[#6f7682]'}`}>{item.actual}</span>
                  <span className="text-[#6f7682] w-1/3 text-center">{item.forecast}</span>
                  <span className="text-[#6f7682] w-1/3 text-right">{item.previous}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}