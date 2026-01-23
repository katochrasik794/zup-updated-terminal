import React, { useState, useRef } from 'react'
import { 
  FiX, 
  FiPlus, 
  FiChevronDown,
  FiDollarSign
} from 'react-icons/fi'
import { MdOutlineAccessAlarms, MdApps } from "react-icons/md"
import { BiUserCircle } from "react-icons/bi"
import SymbolSearchPopup from '../panels/SymbolSearchPopup'
import AccountDropdown from '../panels/AccountDropdown'
import PriceAlertsDropdown from '../panels/PriceAlertsDropdown'
import ApplicationsDropdown from '../panels/ApplicationsDropdown'
import ProfileDropdown from '../panels/ProfileDropdown'
import DepositPopup from '../panels/DepositPopup'
import FlagIcon from '../ui/FlagIcon'

// InstrumentTab Component
const InstrumentTab = ({ tab, isActive, onClick, onClose }) => {
  const tabClasses = `
    relative flex text-gray-400 font-semibold items-center h-16 px-5 cursor-pointer group hover:border-b-2 hover:border-white 
    ${isActive ? 'border-b-4 border-white text-white' : ''}
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
      <div className="flex items-center justify-center gap-2 h-full">
        <div className="w-8 h-8">
          <FlagIcon type={tab.flagType} />
        </div>
        <div className="text-md font-medium" data-test="instrument-tab-symbol">
          {tab.symbol}
        </div>
      </div>
    </div>
  )
}

export default function Navbar({ isSidebarExpanded, logoLarge, logoSmall }) {
  const [tabs, setTabs] = useState([
    { id: '1', symbol: 'XAU/USD', flagType: 'xauusd', isActive: true },
    { id: '2', symbol: 'US500', flagType: 'us500', isActive: false },
    { id: '3', symbol: 'BTC', flagType: 'btc', isActive: false },
    { id: '4', symbol: 'USD/JPY', flagType: 'usdjpy', isActive: false }
  ])

  const [balance] = useState('997.67')
  const [accountInfo] = useState({
    type: 'Demo',
    identifier: 'Zero',
    currency: 'USD'
  })

  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false)
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
  const [isPriceAlertsOpen, setIsPriceAlertsOpen] = useState(false)
  const [isAppsDropdownOpen, setIsAppsDropdownOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isDepositPopupOpen, setIsDepositPopupOpen] = useState(false)
  const addTabButtonRef = useRef(null)

  const handleTabClick = (tabId) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
    )
  }

  const handleCloseTab = (tabId) => {
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

  const handleSelectSymbol = (symbolData) => {
    const existingTab = tabs.find(tab => tab.symbol === symbolData.symbol)
    
    if (existingTab) {
      handleTabClick(existingTab.id)
      return
    }

    const newId = Date.now().toString()
    const newTab = {
      id: newId,
      symbol: symbolData.symbol,
      flagType: symbolData.symbol.toLowerCase().replace('/', ''),
      isActive: true
    }
    
    setTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, isActive: false })).concat([newTab])
    )
  }

  return (
    <nav className="bg-[#141d22] flex-shrink-0">
      <div className="flex items-center h-16 py-2 ">
        {/* Logo */}
        <div className="px-4 flex-shrink-0">
          <div className='flex items-center'>
            <div className="text-yellow-300 font-semi-bold">
              <img 
                src={isSidebarExpanded ? logoLarge : logoSmall} 
                className='h-10' 
                alt="FINCRM" 
              />
            </div>
          </div>
        </div>

        {/* Instrument Tabs */}
        <div className="flex-1 ml-2 min-w-0 overflow-x-auto navbar-scrollbar">
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
                  className="cursor-pointer px-[10px] py-[20px] text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors mx-2 flex items-center justify-center h-8 border border-transparent hover:border-gray-400 "
                  data-test="add-tab-button"
                  type="button"
                  onClick={handleAddTab}
                >
                  <FiPlus size={22} className="stroke-current fill-white text-white cursor-pointer" />
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
        <div className="flex items-center gap-2 pr-4 flex-shrink-0">
          {/* Account Button */}
          <div className="relative">
            <button 
              className="cursor-pointer flex h-12 gap-0 items-center p-[13px] hover:bg-gray-800 border border-transparent hover:border-gray-400 rounded"
              data-test="account-button-83067517"
              type="button"
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            >
              <div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block">
                      <span 
                        className="px-2 bg-[#1c3931] text-green-300 py-1 rounded text-[12px]"
                        data-test="account-info-trading-mode"
                      >
                        {accountInfo.type}
                      </span>
                    </span>
                    <span 
                      className="text-gray-400 text-[13px]"
                      data-test="account-info-identifier"
                    >
                      {accountInfo.identifier}
                    </span>
                  </div>
                  <div className="flex items-center gap-0">
                    <span className="flex items-center">
                      <div>
                        <span className="text-white text-[15px] font-semi-bold">{balance}</span>
                      </div>
                      <div>
                        <span 
                          className="text-gray-300 text-[14px] ml-1"
                          data-test="account-info-currency"
                        >
                          {accountInfo.currency}
                        </span>
                      </div>
                    </span>
                    <FiChevronDown size={12} className="text-gray-300 ml-2" />
                  </div>
                </div>
              </div>
            </button>

            {/* Account Dropdown */}
            <AccountDropdown 
              isOpen={isAccountDropdownOpen}
              onClose={() => setIsAccountDropdownOpen(false)}
            />
          </div>

          {/* Alert Button */}
          <div data-test="alerts-header-button" className="relative">
            <button 
              className="cursor-pointer p-[13px] text-white border border-transparent hover:border-gray-400 hover:bg-gray-800 rounded-md transition-colors"
              type="button"
              onClick={() => setIsPriceAlertsOpen(!isPriceAlertsOpen)}
            >
              <MdOutlineAccessAlarms size={22} />
            </button>
            
            {/* Price Alerts Dropdown */}
            <PriceAlertsDropdown 
              isOpen={isPriceAlertsOpen}
              onClose={() => setIsPriceAlertsOpen(false)}
            />
          </div>

          {/* Apps Button */}
          <div data-test="apps-header-button" className="relative ">
            <button 
              className="cursor-pointer p-[13px] text-white border border-transparent hover:border-gray-400 hover:bg-gray-800 rounded-md transition-colors"
              type="button"
              onClick={() => setIsAppsDropdownOpen(!isAppsDropdownOpen)}
            >
              <MdApps size={22} />
            </button>

            {/* Applications Dropdown */}
            <ApplicationsDropdown 
              isOpen={isAppsDropdownOpen}
              onClose={() => setIsAppsDropdownOpen(false)}
            />
          </div>

          {/* User Button */}
          <div data-test="apps-menu-button" className="relative">
            <button 
              className="cursor-pointer p-[13px] text-white border border-transparent hover:border-gray-400 hover:bg-gray-800 rounded-md transition-colors"
              type="button"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <BiUserCircle size={22} />
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown 
              isOpen={isProfileDropdownOpen}
              onClose={() => setIsProfileDropdownOpen(false)}
            />
          </div>

          {/* Deposit Button */}
          <div>
            <button 
              className="cursor-pointer flex items-center gap-2 px-17 py-2 text-white border border-transparent hover:border-gray-400 bg-[#222d35] rounded transition-colors"
              data-test="deposit-button"
              type="button"
              onClick={() => setIsDepositPopupOpen(true)}
            >
              {/* <FiDollarSign size={16} /> */}
              Deposit
            </button>

            {/* Deposit Popup */}
            <DepositPopup 
              isOpen={isDepositPopupOpen}
              onClose={() => setIsDepositPopupOpen(false)}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}
