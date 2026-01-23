import { useHorizontalResize } from '../../hooks/useResizable'

export default function ResizableLayout({ leftComponent, rightComponent }) {
  const { width: leftWidth, containerRef, startResize } = useHorizontalResize(60, 30, 80)

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative h-full">
      <div style={{ width: `${leftWidth}%` }} className="min-h-0 h-full">
        {leftComponent}
      </div>
      
      {/* Resize handle */}
      <div
        className="w-1 bg-gray-700 cursor-col-resize flex-shrink-0 resize-handle resize-handle-horizontal"
        onMouseDown={startResize}
      />
      
      <div style={{ width: `${100 - leftWidth}%` }} className="min-h-0 h-full">
        {rightComponent}
      </div>
    </div>
  )
}