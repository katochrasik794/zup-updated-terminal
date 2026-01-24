'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  FiX,
  FiPlus,
  FiChevronDown,
  FiDollarSign
} from 'react-icons/fi'
import { MdOutlineAccessAlarms, MdApps } from "react-icons/md"
import { BiUserCircle } from "react-icons/bi"
import { Bell, User, ChevronDown } from 'lucide-react'
import SymbolSearchPopup from '../panels/SymbolSearchPopup'
import AccountDropdown from '../panels/AccountDropdown'
import PriceAlertsDropdown from '../panels/PriceAlertsDropdown'
import ApplicationsDropdown from '../panels/ApplicationsDropdown'
import ProfileDropdown from '../panels/ProfileDropdown'
import DepositPopup from '../panels/DepositPopup'
import FlagIcon from '../ui/FlagIcon'
import { WebSocketStatus } from '../data-display/websocket-status'
import { Button } from '../ui/button'
import IconButton from '../ui/IconButton'
import { useAuth } from '../../context/AuthContext'
import { usePrivacy } from '../../context/PrivacyContext'
import { useAccount } from '../../context/AccountContext'
import { formatCurrency, cn } from '../../lib/utils'

// InstrumentTab Component
interface Tab {
  id: string;
  symbol: string;
  flagType: string;
  isActive: boolean;
}

interface InstrumentTabProps {
  tab: Tab;
  isActive: boolean;
  onClick: (id: string) => void;
  onClose: (id: string) => void;
}

const InstrumentTab = ({ tab, isActive, onClick, onClose }: InstrumentTabProps) => {
  const tabClasses = `
    relative flex text-gray-400 font-semibold items-center h-10 px-3 cursor-pointer group hover:border-b-2 hover:border-white 
    ${isActive ? 'border-b-2 border-white text-white' : ''}
  `

  return (
    <div
      className={tabClasses}
      onClick={() => onClick(tab.id)}
      data-test={`instrument-tab-${tab.symbol}`}
    >
      {/* Close button in upper right corner */}
      <button
        className="cursor-pointer absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-yellow-400 hover:border hover:border-yellow-400 hover:bg-gray-800 z-1"
        data-test="instrument-tab-close"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose(tab.id)
        }}
      >
        <FiX size={14} className="stroke-current fill-none" />
      </button>

      {/* Tab content */}
      <div className="flex items-center justify-center gap-1.5 h-full">
        <div className="w-5 h-5">
          <FlagIcon symbol={tab.symbol} type={tab.flagType} />
        </div>
        <div className="text-sm font-medium" data-test="instrument-tab-symbol">
          {tab.symbol}
        </div>
      </div>
    </div>
  )
}

import { useSidebar } from '../../context/SidebarContext'

interface NavbarProps {
  logoLarge: string;
  logoSmall: string;
}

export default function Navbar({ logoLarge, logoSmall }: NavbarProps) {
  const { isSidebarExpanded } = useSidebar();
  const { hideBalance } = usePrivacy();
  const { user } = useAuth();
  const {
    currentAccountId,
    mt5Accounts,
    balances,
    isBalanceLoading
  } = useAccount();

  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', symbol: 'XAU/USD', flagType: 'xauusd', isActive: true },
    { id: '2', symbol: 'US500', flagType: 'us500', isActive: false },
    { id: '3', symbol: 'BTC', flagType: 'btc', isActive: false },
    { id: '4', symbol: 'USD/JPY', flagType: 'usdjpy', isActive: false }
  ])

  const [currentData, setCurrentData] = useState<any>(null);

  // Direct fetch for selected account
  const fetchCurrentBalance = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/accounts/${currentAccountId}/profile`, {
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setCurrentData(result.data);
      }
    } catch (err) {
      console.error('[Navbar] Fetch Current Error:', err);
    }
  }, [currentAccountId]);

  // Combined Polling Effect
  useEffect(() => {
    fetchCurrentBalance();
    const intervalId = setInterval(fetchCurrentBalance, 200);
    return () => clearInterval(intervalId);
  }, [fetchCurrentBalance]);

  // Get current account info
  const currentAccount = mt5Accounts.find(acc => acc.accountId === currentAccountId)
  const accountInfo = {
    type: (currentAccount?.accountType || 'Live') as 'Live' | 'Demo',
    identifier: currentAccount?.displayAccountId || 'Zero',
    currency: 'USD'
  }
  const balance = currentData?.Equity ?? 0
  const [positionsConnected] = useState(true) // TODO: Connect to actual WebSocket status

  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false)
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
  const [isPriceAlertsOpen, setIsPriceAlertsOpen] = useState(false)
  const [isAppsDropdownOpen, setIsAppsDropdownOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isDepositPopupOpen, setIsDepositPopupOpen] = useState(false)
  const addTabButtonRef = useRef<HTMLButtonElement>(null)

  const handleTabClick = (tabId: string) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
    )
  }

  const handleCloseTab = (tabId: string) => {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId)
    const isActiveTab = tabs[tabIndex]?.isActive

    const newTabs = tabs.filter(tab => tab.id !== tabId)

    // If we closed the active tab, make the first remaining tab active
    if (isActiveTab && newTabs.length > 0) {
      newTabs[0].isActive = true
    }

    setTabs(newTabs)
  }

  const handleAddTab = () => {
    setIsSymbolSearchOpen(true)
  }

  const handleSelectSymbol = (symbolData: { symbol: string }) => {
    const existingTab = tabs.find(tab => tab.symbol === symbolData.symbol)

    if (existingTab) {
      handleTabClick(existingTab.id)
      return
    }

    const newId = Date.now().toString()
    const newTab: Tab = {
      id: newId,
      symbol: symbolData.symbol,
      flagType: symbolData.symbol, // Use symbol as flagType for new logic
      isActive: true
    }

    setTabs(prevTabs =>
      prevTabs.map(tab => ({ ...tab, isActive: false })).concat([newTab])
    )
  }

  return (
    <nav className="bg-background flex-shrink-0 border border-gray-800">
      <div className="flex items-center h-10 px-2">
        {/* Logo */}
        <div className="px-2 flex-shrink-0">
          <div className='flex items-center'>
            <div className="text-yellow-300 font-semi-bold">
              <img
                src={isSidebarExpanded ? logoLarge : logoSmall}
                className='h-8'
                alt="Zuperior"
              />
            </div>
          </div>
        </div>

        {/* Instrument Tabs */}
        <div className="flex-1 ml-1 min-w-0 overflow-x-auto navbar-scrollbar">
          <div className="flex items-center min-w-max">
            <div className="flex items-center ">
              <div className="flex gap-0">
                {tabs.map((tab) => (
                  <InstrumentTab
                    key={tab.id}
                    tab={tab}
                    isActive={tab.isActive}
                    onClick={handleTabClick}
                    onClose={handleCloseTab}
                  />
                ))}
              </div>

              {/* Add Tab Button */}
              <div className="flex items-center h-full relative">
                <button
                  ref={addTabButtonRef}
                  className="cursor-pointer px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors mx-1 flex items-center justify-center h-8 border border-transparent hover:border-gray-400 "
                  data-test="add-tab-button"
                  type="button"
                  onClick={handleAddTab}
                >
                  <FiPlus size={18} className="stroke-current fill-white text-white cursor-pointer" />
                </button>

                {/* Symbol Search Popup */}
                <SymbolSearchPopup
                  isOpen={isSymbolSearchOpen}
                  onClose={() => setIsSymbolSearchOpen(false)}
                  onSelectSymbol={handleSelectSymbol}
                  triggerRef={addTabButtonRef}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 pr-2 flex-shrink-0">
          {/* WebSocket Status (Live indicator) */}
          <WebSocketStatus showDetails={false} positionsConnected={positionsConnected} />

          {/* Account Button */}
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 group"
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/60">
                    <span
                      className={cn(
                        "px-1 py-0.5 rounded text-[10px] font-medium",
                        accountInfo.type === "Live" ? "bg-warning/20 text-warning" : "bg-info/20 text-info",
                      )}
                    >
                      {accountInfo.type}
                    </span>
                    &nbsp;
                    <span className="text-[11px]">{user?.name || "Loading..."}</span>
                  </span>
                </div>
                <span className="text-xs font-semibold text-success leading-tight">
                  {hideBalance ? "......" : `${formatCurrency(balance, 2)} USD`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-white/40 group-hover:text-white/60 ml-0.5" />
            </button>

            {/* Account Dropdown */}
            <AccountDropdown
              isOpen={isAccountDropdownOpen}
              onClose={() => setIsAccountDropdownOpen(false)}
            />
          </div>

          {/* Bell Icon */}
          <div className="relative">
            <IconButton
              onClick={() => setIsPriceAlertsOpen(!isPriceAlertsOpen)}
              className="p-1.5"
              tooltip="Price Alerts"
            >
              <Bell className="h-3.5 w-3.5" />
            </IconButton>
            <PriceAlertsDropdown
              isOpen={isPriceAlertsOpen}
              onClose={() => setIsPriceAlertsOpen(false)}
            />
          </div>

          {/* User Icon */}
          <div className="relative">
            <IconButton
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="p-1.5"
              tooltip="Account Profile"
            >
              <User className="h-3.5 w-3.5" />
            </IconButton>
            <ProfileDropdown
              isOpen={isProfileDropdownOpen}
              onClose={() => setIsProfileDropdownOpen(false)}
            />
          </div>

          {/* Deposit Button */}
          <Button size="sm" className="ml-1 h-7 px-3 text-xs bg-primary" asChild>
            <a href="https://dashboard.zuperior.com/deposit" target="_blank" rel="noreferrer">
              Deposit
            </a>
          </Button>
        </div>
      </div>
    </nav>
  )
}
