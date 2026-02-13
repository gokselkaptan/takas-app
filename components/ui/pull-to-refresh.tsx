'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ArrowDown } from 'lucide-react'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  progress: number
  threshold?: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  threshold = 80
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <motion.div
          className="mt-2 flex flex-col items-center justify-center bg-white rounded-full shadow-lg border border-gray-100"
          style={{
            width: 56,
            height: 56,
            transform: `translateY(${Math.min(pullDistance, threshold)}px)`
          }}
        >
          {isRefreshing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-6 h-6 text-purple-500" />
            </motion.div>
          ) : (
            <>
              <motion.div
                style={{ rotate: progress * 180 }}
                className="relative"
              >
                <ArrowDown 
                  className={`w-6 h-6 transition-colors duration-200 ${
                    progress >= 1 ? 'text-purple-500' : 'text-gray-400'
                  }`} 
                />
              </motion.div>
              {/* Progress ring */}
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 56 56"
              >
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 151} 151`}
                />
              </svg>
            </>
          )}
        </motion.div>
        
        {/* Pull text */}
        {!isRefreshing && pullDistance > 20 && (
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-20 text-xs font-medium text-gray-500"
          >
            {progress >= 1 ? 'Bırak ve yenile' : 'Yenilemek için çek'}
          </motion.span>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
