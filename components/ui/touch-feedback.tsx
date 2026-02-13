'use client'

import { useState, useRef, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface RippleProps {
  x: number
  y: number
  size: number
}

interface TouchFeedbackProps {
  children: ReactNode
  className?: string
  disabled?: boolean
  hapticType?: 'light' | 'medium' | 'heavy'
  rippleColor?: string
  onClick?: () => void
  onTouchStart?: () => void
}

export function TouchFeedback({
  children,
  className = '',
  disabled = false,
  hapticType = 'light',
  rippleColor = 'rgba(139, 92, 246, 0.3)',
  onClick,
  onTouchStart
}: TouchFeedbackProps) {
  const [ripples, setRipples] = useState<RippleProps[]>([])
  const [isPressed, setIsPressed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rippleCount = useRef(0)

  const hapticPatterns = {
    light: [10],
    medium: [30],
    heavy: [50]
  }

  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator && !disabled) {
      navigator.vibrate(hapticPatterns[hapticType])
    }
  }, [hapticType, disabled])

  const addRipple = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    // Calculate ripple size to cover entire element
    const size = Math.max(rect.width, rect.height) * 2

    const newRipple = { x, y, size }
    rippleCount.current += 1
    
    setRipples(prev => [...prev, newRipple])
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.slice(1))
    }, 600)
  }, [disabled])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsPressed(true)
    addRipple(e)
    triggerHaptic()
    onTouchStart?.()
  }, [addRipple, triggerHaptic, onTouchStart])

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only for non-touch devices
    if ('ontouchstart' in window) return
    setIsPressed(true)
    addRipple(e)
  }, [addRipple])

  const handleMouseUp = useCallback(() => {
    setIsPressed(false)
  }, [])

  return (
    <motion.div
      ref={containerRef}
      className={`relative overflow-hidden touch-manipulation ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={onClick}
      animate={{
        scale: isPressed ? 0.98 : 1
      }}
      transition={{ duration: 0.1 }}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
      
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map((ripple, index) => (
          <motion.span
            key={`${rippleCount.current}-${index}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x - ripple.size / 2,
              top: ripple.y - ripple.size / 2,
              width: ripple.size,
              height: ripple.size,
              backgroundColor: rippleColor
            }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// Simpler press feedback without ripple
export function PressableFeedback({
  children,
  className = '',
  disabled = false,
  hapticType = 'light',
  onClick
}: Omit<TouchFeedbackProps, 'rippleColor'>) {
  const [isPressed, setIsPressed] = useState(false)

  const hapticPatterns = {
    light: [10],
    medium: [30],
    heavy: [50]
  }

  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator && !disabled) {
      navigator.vibrate(hapticPatterns[hapticType])
    }
  }, [hapticType, disabled])

  return (
    <motion.div
      className={`touch-manipulation ${className}`}
      onTouchStart={() => {
        if (!disabled) {
          setIsPressed(true)
          triggerHaptic()
        }
      }}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onClick={onClick}
      animate={{
        scale: isPressed ? 0.95 : 1,
        opacity: isPressed ? 0.8 : 1
      }}
      transition={{ duration: 0.1 }}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </motion.div>
  )
}
