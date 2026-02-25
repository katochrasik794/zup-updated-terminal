"use client";
import { useState, useEffect } from 'react'
import WatchlistPanel from '../panels/WatchlistPanel'
import EconomicCalendarPanel from '../panels/EconomicCalendarPanel'
import SettingsPanel from '../panels/SettingsPanel'
import ResizablePanel from '../panels/ResizablePanel'
import { LuList, LuCalendar, LuSettings } from 'react-icons/lu'
import Tooltip from '../ui/Tooltip'

interface LeftSidebarProps {
  onPanelStateChange?: (hasActivePanel: boolean) => void;
  isExpanded?: boolean;
}

export default function LeftSidebar({ onPanelStateChange, isExpanded }: LeftSidebarProps) {
  const [activePanel, setActivePanel] = useState<string | null>('instruments')

  const togglePanel = (panel: string) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  const hasActivePanel = activePanel !== null

  // Reset active panel when sidebar is collapsed externally
  useEffect(() => {
    if (!isExpanded) {
      setActivePanel(null)
    }
  }, [isExpanded])

  // Notify parent component about panel state changes
  useEffect(() => {
    if (onPanelStateChange) {
      onPanelStateChange(hasActivePanel)
    }
  }, [hasActivePanel, onPanelStateChange])

  return (
    <div className={`flex h-full overflow-hidden min-h-0 gap-1`}>
      {/* ${!hasActivePanel ? 'border-r-4 border-gray-600' : ''} */}
      <aside className={`w-[48px] flex flex-col items-center py-3 gap-4 flex-shrink-0 h-full bg-background rounded-tr-lg border border-gray-800`}>
        {/* Instruments Button */}
        <div>
          <Tooltip text="Instruments" placement="right">
            <button
              className={`cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded-sm transition-all duration-200 ${activePanel === 'instruments' ? 'bg-gray-800 border border-gray-400 text-gray-200' : 'hover:bg-gray-800 hover:border hover:border-gray-400 border-2 border-transparent'
                }`}
              type="button"
              data-test="aside-panel-watchlist-button"
              aria-label="Instruments"
              onClick={() => togglePanel('instruments')}
            >
              <LuList size={20} className={activePanel === 'instruments' ? 'text-gray-200' : 'text-gray-300'} />
            </button>
          </Tooltip>
        </div>

        {/* Economic Calendar Button - HIDDEN */}
        {false && (
          <div>
            <Tooltip text="Economic calendar" placement="right">
              <button
                className={`cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-200 rounded-sm transition-all duration-200 ${activePanel === 'calendar' ? 'bg-gray-800 border border-gray-400 text-gray-200' : 'hover:bg-gray-800 hover:border hover:border-gray-400 border-2 border-transparent'
                  }`}
                type="button"
                data-test="aside-panel-calendar-events-button"
                aria-label="Economic calendar"
                onClick={() => togglePanel('calendar')}
              >
                <LuCalendar size={20} className={activePanel === 'calendar' ? 'text-foreground' : 'text-gray-300'} />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Settings Button */}
        <div>
          <Tooltip text="Settings" placement="right">
            <button
              className={`cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-foreground rounded-sm transition-all duration-200 ${activePanel === 'settings' ? 'bg-gray-800 border border-gray-400 text-gray-200' : 'hover:bg-gray-800 hover:border hover:border-gray-400 border-2 border-transparent'
                }`}
              type="button"
              data-test="aside-panel-settings-button"
              aria-label="Settings"
              onClick={() => togglePanel('settings')}
            >
              <LuSettings size={20} className={activePanel === 'settings' ? 'text-foreground' : 'text-gray-300'} />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Panel Content - only show when panel is active */}
      {hasActivePanel && (
        <>
          {activePanel === 'instruments' && (
            <div className="bg-background border-r border-gray-700 flex flex-col h-full min-h-0 overflow-hidden flex-1 rounded-t-md">
              <WatchlistPanel onClose={closePanel} />
            </div>
          )}
          {false && activePanel === 'calendar' && (
            <div className="bg-background border-r border-gray-700 flex flex-col h-full min-h-0 overflow-hidden flex-1 rounded-t-md">
              <EconomicCalendarPanel onClose={closePanel} />
            </div>
          )}
          {activePanel === 'settings' && (
            <div className="bg-background border-r border-gray-700 flex flex-col h-full min-h-0 overflow-hidden flex-1 rounded-t-md">
              <SettingsPanel onClose={closePanel} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
