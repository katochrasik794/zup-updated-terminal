import { useState } from 'react'
import './App.css'
import Navbar from './components/layout/Navbar'
// import LeftSidebar from './components/layout/LeftSidebar'
import TradingTerminal from './pages/TradingTerminal'

function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-[#3f474b] overflow-hidden gap-1">
      <Navbar 
        isSidebarExpanded={isSidebarExpanded} 
        logoLarge="/new-logo.png" 
        logoSmall="/new-small-logo-dark.png" 
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* <LeftSidebar /> */}
        <TradingTerminal 
          isSidebarExpanded={isSidebarExpanded} 
          onSidebarStateChange={setIsSidebarExpanded}
        />
      </div>
    </div>
  )
}

export default App
