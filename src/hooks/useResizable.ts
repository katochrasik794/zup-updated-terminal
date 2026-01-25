import { useState, useRef, useEffect, useCallback } from 'react'

// Throttle function for smooth performance
const throttle = (func, delay) => {
  let timeoutId
  let lastExecTime = 0
  return function (...args) {
    const currentTime = Date.now()

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args)
      lastExecTime = currentTime
    } else {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        func.apply(this, args)
        lastExecTime = Date.now()
      }, delay - (currentTime - lastExecTime))
    }
  }
}

export const useHorizontalResize = (initialWidth = 60, minWidth = 30, maxWidth = 80) => {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    throttle((e) => {
      if (!isResizing || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
      }
    }, 16), // ~60fps
    [isResizing, minWidth, maxWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
    document.body.style.pointerEvents = 'auto'
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.body.style.pointerEvents = 'none'
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const startResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }, [])

  return {
    width,
    isResizing,
    containerRef,
    startResize
  }
}

export const useVerticalResize = (initialHeight = 70, minHeight = 40, maxHeight = 85) => {
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    throttle((e) => {
      if (!isResizing || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setHeight(newHeight)
      }
    }, 16), // ~60fps
    [isResizing, minHeight, maxHeight]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
    document.body.style.pointerEvents = 'auto'
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      document.body.style.pointerEvents = 'none'
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const startResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }, [])

  return {
    height,
    isResizing,
    containerRef,
    startResize
  }
}

export const usePixelResize = (initialWidth = 230, minWidth = 200, maxWidth = 600) => {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    throttle((e) => {
      if (!isResizing || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
      }
    }, 16), // ~60fps
    [isResizing, minWidth, maxWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
    document.body.style.pointerEvents = 'auto'
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.body.style.pointerEvents = 'none'
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const startResize = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }, [])

  return {
    width,
    isResizing,
    containerRef,
    startResize
  }
}