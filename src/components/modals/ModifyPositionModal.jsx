import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import FlagIcon from '../ui/FlagIcon';
import Tooltip from '../ui/Tooltip';

const ModifyPositionModal = ({ isOpen, onClose, position }) => {
  const [activeTab, setActiveTab] = useState('modify');
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [partialVolume, setPartialVolume] = useState('');

  // Reset state when position changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTpValue(position?.tp === 'Add' ? '' : position?.tp || '');
      setSlValue(position?.sl === 'Add' ? '' : position?.sl || '');
      setPartialVolume(position?.volume || '');
    }
  }, [isOpen, position]);

  if (!isOpen || !position) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const adjustValue = (setter, currentValue, delta, decimals = 2) => {
    const baseVal = parseFloat(currentValue) || 0;
    const newVal = (baseVal + delta).toFixed(decimals);
    setter(newVal);
  };

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#2c3438] rounded-lg w-[400px] shadow-2xl overflow-hidden font-sans text-gray-200">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex justify-between items-start">
          {/* Left Column: Symbol info */}
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-6 h-6 relative">
                <FlagIcon type={position.flag || 'xauusd'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-bold text-gray-100 tracking-wide">{position.symbol}</span>
                <span className="text-[13px] text-[#8b9096] font-normal">{position.volume} lots</span>
              </div>
            </div>
            <div className="flex gap-1 pl-9 text-[13px]">
              <span className={`font-medium ${position.type === 'Buy' ? 'text-[#0099ff]' : 'text-[#f6465d]'}`}>
                {position.type}
              </span>
              <span className="text-[#8b9096]">at {position.openPrice}</span>
            </div>
          </div>

          {/* Right Column: P/L, Price, Close */}
          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className={`flex items-baseline justify-end gap-1 ${position.plColor}`}>
                <span className="text-[15px] font-medium">{position.pl}</span>
                <span className="text-[11px] text-[#8b9096]">USD</span>
              </div>
              <div className="text-[#e1e1e1] font-medium text-[13px]">
                {position.currentPrice || position.openPrice}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-[#8b9096] hover:text-white transition-colors cursor-pointer mt-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 py-3">
          <div className="flex bg-[#141d22] p-[3px] rounded border border-[#2a3038]">
            {['Modify', 'Partial close', 'Close by'].map((tab) => {
              const id = tab.toLowerCase().replace(' ', '');
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-[4px] transition-all ${
                    isActive 
                      ? 'bg-[#2a353e] text-white shadow-sm' 
                      : 'text-[#8b9096] hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-4">
          {activeTab === 'modify' ? (
            <>
              {/* Take Profit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#8b9096] font-medium">Take Profit</label>
                  <Tooltip text="Set a Take Profit if you want your order to close automatically at the price level you have specified. Setting a Take Profit allows you to lock in profits." placement="top">
                    <div className="text-[#8b9096] cursor-help hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <input 
                    type="text" 
                    placeholder="Not set"
                    value={tpValue}
                    onChange={(e) => setTpValue(e.target.value)}
                    className="flex-1 bg-transparent px-3 text-[14px] text-white placeholder-[#585c63] outline-none"
                  />
                  <div className="flex items-center border-l border-[#2a3038]">
                    <button className="px-3 h-full text-[12px] text-[#8b9096] hover:text-white flex items-center gap-1 transition-colors hover:bg-[#2a3038]">
                      Price
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    <div className="flex h-full border-l border-[#2a3038]">
                      <button 
                        onClick={() => adjustValue(setTpValue, tpValue, -0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <div className="w-[1px] h-full bg-[#2a3038]"></div>
                      <button 
                        onClick={() => adjustValue(setTpValue, tpValue, 0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop Loss */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#8b9096] font-medium">Stop Loss</label>
                  <Tooltip text="Set a Stop Loss if you want your order to close automatically at the price level you have specified. Setting a Stop Loss enables you to limit losses." placement="top">
                    <div className="text-[#8b9096] cursor-help hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <input 
                    type="text" 
                    placeholder="Not set"
                    value={slValue}
                    onChange={(e) => setSlValue(e.target.value)}
                    className="flex-1 bg-transparent px-3 text-[14px] text-white placeholder-[#585c63] outline-none"
                  />
                  <div className="flex items-center border-l border-[#2a3038]">
                    <button className="px-3 h-full text-[12px] text-[#8b9096] hover:text-white flex items-center gap-1 transition-colors hover:bg-[#2a3038]">
                      Price
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                    <div className="flex h-full border-l border-[#2a3038]">
                      <button 
                        onClick={() => adjustValue(setSlValue, slValue, -0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <div className="w-[1px] h-full bg-[#2a3038]"></div>
                      <button 
                        onClick={() => adjustValue(setSlValue, slValue, 0.1)}
                        className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'partialclose' ? (
            <>
              {/* Volume to close */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] text-[#e1e1e1] font-medium">Volume to close</label>
                </div>
                <div className="flex h-[38px] border border-[#2a3038] rounded hover:border-[#8b9096] transition-colors group focus-within:border-[#0099ff] bg-[#1e222d]">
                  <div className="flex-1 flex items-center px-3">
                    <input 
                      type="text" 
                      value={partialVolume}
                      onChange={(e) => setPartialVolume(e.target.value)}
                      className="w-full bg-transparent text-[14px] text-white placeholder-[#585c63] outline-none"
                    />
                    <span className="text-[14px] text-[#8b9096] ml-2">Lots</span>
                  </div>
                  <div className="flex h-full border-l border-[#2a3038]">
                    <button 
                      onClick={() => adjustValue(setPartialVolume, partialVolume, -0.01)}
                      className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <div className="w-[1px] h-full bg-[#2a3038]"></div>
                    <button 
                      onClick={() => adjustValue(setPartialVolume, partialVolume, 0.01)}
                      className="w-[32px] h-full flex items-center justify-center text-[#8b9096] hover:bg-[#2a3038] hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-[#8b9096]">
                  0.01 - {position.volume}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[160px] text-[#8b9096] text-[14px]">
              Close by functionality
            </div>
          )}

          {/* Action Button */}
          <button 
            onClick={onClose}
            className="w-full h-[40px] bg-[#eec802] hover:bg-[#ffdd2d] text-black text-[14px] font-medium rounded transition-colors mt-2"
          >
            {activeTab === 'modify' ? 'Modify position' : 'Close position'}
          </button>
          
          {activeTab === 'partialclose' && (
            <div className="text-center text-[13px] text-[#8b9096]">
              Estimated profit: <span className={position.plColor}>{position.pl} USD</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModifyPositionModal;
