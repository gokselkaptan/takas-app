'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================
// PULL TO REFRESH HOOK
// ============================================
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number // Minimum pull distance to trigger refresh
  resistance?: number // Pull resistance factor
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only enable pull-to-refresh when at top of page
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return
    
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    
    if (diff > 0 && window.scrollY === 0) {
      // Apply resistance to make pull feel natural
      const distance = Math.min(diff / resistance, 150)
      setPullDistance(distance)
      
      // Prevent default scroll when pulling
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }, [isPulling, isRefreshing, resistance])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return
    
    setIsPulling(false)
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold) // Keep indicator visible
      
      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const progress = Math.min(pullDistance / threshold, 1)

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    progress,
    shouldTrigger: pullDistance >= threshold
  }
}

// ============================================
// INFINITE SCROLL HOOK
// ============================================
interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>
  hasMore: boolean
  threshold?: number // Distance from bottom to trigger load
  enabled?: boolean
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  threshold = 200,
  enabled = true
}: UseInfiniteScrollOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const setLoadMoreElement = useCallback((element: HTMLDivElement | null) => {
    loadMoreRef.current = element
  }, [])

  useEffect(() => {
    if (!enabled || !hasMore || isLoading) return

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoading) {
          setIsLoading(true)
          try {
            await onLoadMore()
          } finally {
            setIsLoading(false)
          }
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    )

    observerRef.current = observer

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [enabled, hasMore, isLoading, onLoadMore, threshold])

  return {
    isLoading,
    setLoadMoreElement,
    loadMoreRef
  }
}

// ============================================
// HAPTIC FEEDBACK HOOK
// ============================================
type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

const hapticPatterns: Record<HapticType, number[]> = {
  light: [10],
  medium: [30],
  heavy: [50],
  success: [30, 50, 30],
  warning: [50, 30, 50],
  error: [100, 50, 100]
}

export function useHapticFeedback() {
  const trigger = useCallback((type: HapticType = 'light') => {
    if ('vibrate' in navigator) {
      navigator.vibrate(hapticPatterns[type])
    }
  }, [])

  const onTouchStart = useCallback((type: HapticType = 'light') => {
    return () => trigger(type)
  }, [trigger])

  return { trigger, onTouchStart }
}

// ============================================
// SWIPE ACTIONS HOOK
// ============================================
interface UseSwipeActionsOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipeActions({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50
}: UseSwipeActionsOptions) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isHorizontal.current = null
    setIsSwiping(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return

    const diffX = e.touches[0].clientX - startX.current
    const diffY = e.touches[0].clientY - startY.current

    // Determine direction on first significant move
    if (isHorizontal.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontal.current = Math.abs(diffX) > Math.abs(diffY)
      }
    }

    if (isHorizontal.current) {
      // Limit swipe distance
      const maxSwipe = 100
      const offset = Math.max(-maxSwipe, Math.min(maxSwipe, diffX))
      setSwipeOffset(offset)
    }
  }, [isSwiping])

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false)
    
    if (Math.abs(swipeOffset) >= threshold) {
      if (swipeOffset > 0 && onSwipeRight) {
        onSwipeRight()
        if ('vibrate' in navigator) navigator.vibrate(30)
      } else if (swipeOffset < 0 && onSwipeLeft) {
        onSwipeLeft()
        if ('vibrate' in navigator) navigator.vibrate(30)
      }
    }
    
    setSwipeOffset(0)
    isHorizontal.current = null
  }, [swipeOffset, threshold, onSwipeLeft, onSwipeRight])

  return {
    swipeOffset,
    isSwiping,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  }
}
