import { useVerticalResize } from '../../hooks/useResizable'

export default function VerticalResizableLayout({ topComponent, bottomComponent }) {
  const { height: topHeight, containerRef, startResize } = useVerticalResize(70, 40, 85)

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 relative h-full">
      <div style={{ height: `${topHeight}%` }} className="min-h-0 flex">
        {topComponent}
      </div>
      
      {/* Resize handle */}
      <div
        className="h-1 bg-gray-600 cursor-row-resize flex-shrink-0 z-10 resize-handle resize-handle-vertical"
        onMouseDown={startResize}
      />
      
      <div style={{ height: `${100 - topHeight}%` }} className="min-h-0 overflow-hidden">
        {bottomComponent}
      </div>
    </div>
  )
}