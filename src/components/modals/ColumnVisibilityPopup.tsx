"use client";
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const ColumnVisibilityPopup = ({
  isOpen,
  onClose,
  visibleColumns,
  toggleColumn,
  anchorRef,
  columnOrder,
  setColumnOrder,
  columns, // Now passed as prop
  extraSection // Optional extra content (e.g. Appearance)
}: any) => {
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  if (!isOpen) return null;

  // Calculate position based on anchor
  const style: React.CSSProperties = {};
  if (anchorRef?.current) {
    const rect = anchorRef.current.getBoundingClientRect();
    // Default to opening below, but check if space is limited
    // For LeftSidebar (Instruments), we might want it to align differently
    // The previous logic was: bottom = window.innerHeight - rect.top + 8 (opens above)
    // Let's keep it consistent or make it smart. 
    // If we are in the LeftSidebar (top left), opening "above" might clip if it's at the very top.
    // However, the user asked for "like previous", which was opening above.
    // But for the sidebar menu button which is at the top, opening above is impossible.
    // Let's check where the anchor is.

    if (rect.top < window.innerHeight / 2) {
      // Top half of screen -> Open below
      style.top = `${rect.bottom + 8}px`;
      style.left = `${rect.left}px`;
    } else {
      // Bottom half -> Open above
      style.bottom = `${window.innerHeight - rect.top + 8}px`;
      // Align right edge if it's on the right side, else left
      if (rect.left > window.innerWidth / 2) {
        style.right = `${window.innerWidth - rect.right}px`;
      } else {
        style.left = `${rect.left}px`;
      }
    }
  } else {
    style.top = '50%';
    style.left = '50%';
    style.transform = 'translate(-50%, -50%)';
  }

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image or default
  };

  const handleDragEnter = (e, index) => {
    if (draggedItemIndex === null) return;
    if (draggedItemIndex === index) return;

    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setColumnOrder(newOrder);
    setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  return ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      <div
        className="fixed z-[9999] bg-background border border-gray-800 rounded-lg shadow-2xl w-[280px] overflow-hidden text-[#e1e1e1] font-sans text-[14px]"
        style={style}
      >
        <div className="px-4 py-3 border-b border-[#2a3038] flex justify-between items-center">
          <span className="font-medium text-gray-400 text-[12px] uppercase tracking-wide">Columns</span>
          {/* Only show actions if needed, or keep generic */}
        </div>
        <div className="py-2">
          {columnOrder.map((colId, index) => {
            const col = columns[colId];
            if (!col) return null;
            return (
              <div
                key={colId}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-center justify-between px-4 py-2 hover:bg-gray-700 transition-colors group ${draggedItemIndex === index ? 'opacity-50 bg-[#363c45]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-[#585c63] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 6a2 2 0 11-4 0 2 2 0 014 0zM8 12a2 2 0 11-4 0 2 2 0 014 0zM8 18a2 2 0 11-4 0 2 2 0 014 0zM16 6a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 11-4 0 2 2 0 014 0zM16 18a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span>{col.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={visibleColumns[colId]}
                    onChange={() => toggleColumn(colId)}
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-500"></div>
                </label>
              </div>
            );
          })}
        </div>

        {extraSection && (
          <div className="border-t border-[#2a3038]">
            {extraSection}
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default ColumnVisibilityPopup;
