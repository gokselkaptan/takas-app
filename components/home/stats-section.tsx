'use client'

import { Users, RefreshCw, MapPin, TrendingUp } from 'lucide-react'
import { motion, animate } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/language-context'

const statsTexts = {
  tr: {
    activeUsers: 'Aktif Kullanıcı',
    successfulSwaps: 'Başarılı Takas',
    deliveryPoints: 'Teslim Noktası',
    satisfaction: 'Memnuniyet'
  },
  en: {
    activeUsers: 'Active Users',
    successfulSwaps: 'Successful Swaps',
    deliveryPoints: 'Delivery Points',
    satisfaction: 'Satisfaction'
  },
  es: {
    activeUsers: 'Usuarios Activos',
    successfulSwaps: 'Intercambios Exitosos',
    deliveryPoints: 'Puntos de Entrega',
    satisfaction: 'Satisfacción'
  },
  ca: {
    activeUsers: 'Usuaris Actius',
    successfulSwaps: 'Intercanvis Exitosos',
    deliveryPoints: 'Punts de Lliurament',
    satisfaction: 'Satisfacció'
  }
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const [ref, inView] = useInView({ triggerOnce: true })

  useEffect(() => {
    if (inView) {
      const controls = animate(0, value, {
        duration: 2,
        onUpdate: (v) => setDisplayValue(Math.floor(v)),
      })
      return controls.stop
    }
  }, [inView, value])

  return (
    <span ref={ref}>
      {displayValue?.toLocaleString?.('tr-TR') ?? '0'}{suffix}
    </span>
  )
}

export function StatsSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const { language } = useLanguage()
  const texts = statsTexts[language]
  
  const [stats, setStats] = useState([
    { icon: Users, value: 197, suffix: '+', labelKey: 'activeUsers' as const },
    { icon: RefreshCw, value: 340, suffix: '+', labelKey: 'successfulSwaps' as const },
    { icon: MapPin, value: 12, suffix: '', labelKey: 'deliveryPoints' as const },
    { icon: TrendingUp, value: 95, suffix: '%', labelKey: 'satisfaction' as const },
  ])

  useEffect(() => {
    // Get or initialize visit count from sessionStorage
    const visitCountStr = sessionStorage.getItem('takas_visit_count')
    let visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0
    
    // Increment visit count
    visitCount += 1
    sessionStorage.setItem('takas_visit_count', visitCount.toString())
    
    // Calculate dynamic stats based on visit count
    const baseUsers = 197
    const userIncrement = 7
    const activeUsers = baseUsers + (visitCount * userIncrement)
    
    // Swap count starts at 340 and increases by 3-5 each visit
    const baseSwaps = 340
    const swapIncrement = 3 + (visitCount % 3) // varies between 3-5
    const totalSwaps = baseSwaps + (visitCount * swapIncrement)
    
    // Memnuniyet slightly varies between 94-97%
    const satisfaction = 94 + (visitCount % 4)
    
    setStats([
      { icon: Users, value: activeUsers, suffix: '+', labelKey: 'activeUsers' as const },
      { icon: RefreshCw, value: totalSwaps, suffix: '+', labelKey: 'successfulSwaps' as const },
      { icon: MapPin, value: 12, suffix: '', labelKey: 'deliveryPoints' as const },
      { icon: TrendingUp, value: satisfaction, suffix: '%', labelKey: 'satisfaction' as const },
    ])
  }, [])

  return (
    <section className="py-20 gradient-frozen">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1 }}
              className="text-center text-white"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/20 flex items-center justify-center">
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold mb-2">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-white/80">{texts[stat.labelKey]}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
