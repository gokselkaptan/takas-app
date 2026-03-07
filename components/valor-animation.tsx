'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Coins } from 'lucide-react'

interface ValorAnimationProps {
  amount: number
  show: boolean
  onComplete?: () => void
}

export function ValorAnimation({ amount, show, onComplete }: ValorAnimationProps) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 2000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-20 left-1/2 z-[9999] pointer-events-none"
          initial={{ opacity: 0, y: 0, x: '-50%', scale: 0.5 }}
          animate={{ opacity: 1, y: -60, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -100, x: '-50%', scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-full shadow-2xl shadow-amber-500/40 border border-amber-400">
            <motion.div
              animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Coins className="w-5 h-5" />
            </motion.div>
            <span className="font-bold text-lg">+{amount} Valor</span>
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              ⭐
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook olarak kullanım kolaylığı
export function useValorAnimation() {
  const [state, setState] = useState<{ show: boolean; amount: number }>({ show: false, amount: 0 })

  const showValor = (amount: number) => {
    setState({ show: true, amount })
  }

  const hideValor = () => {
    setState({ show: false, amount: 0 })
  }

  return { ...state, showValor, hideValor }
}
