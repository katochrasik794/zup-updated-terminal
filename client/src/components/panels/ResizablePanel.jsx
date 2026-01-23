import { usePixelResize } from '../../hooks/useResizable'

export default function ResizablePanel({ children, minWidth = 200, maxWidth = 1200, defaultWidth = 245 }) {
  const { width, containerRef: panelRef } = usePixelResize(defaultWidth, minWidth, maxWidth)

  return (
    <div 
      ref={panelRef}
      className="relative bg-[#1a1f26] border-r border-gray-700 flex flex-col h-full min-h-0 overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize handle */}
      {/* <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize resize-handle resize-handle-horizontal"
        onMouseDown={startResize}
      >
        <div className="w-full h-full bg-transparent" />
      </div> */}
    </div>
  )
}