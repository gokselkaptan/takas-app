'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check, Sparkles, Users, Clock, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import { safeFetch } from '@/lib/safe-fetch'

interface MultiSwapOnboardingProps {
  productId?: string
  onClose: () => void
  onStartSwap?: (chainId: string) => void
}

interface SwapParticipant {
  userId: string
  userName: string
  productId: string
  productTitle: string
  productImage: string | null
  productValorPrice: number
  productLocation: string | null
  wantsProductId: string
  wantsProductOwnerId: string
  wantsProductValorPrice: number
}

interface SwapChain {
  participants: SwapParticipant[]
  chainLength: number
  isValueBalanced: boolean
  valueBalanceScore: number
  locationScore: number
  totalScore: number
  averageValorPrice: number
  valueDifference: number
}

export function MultiSwapOnboarding({ productId, onClose, onStartSwap }: MultiSwapOnboardingProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [chains, setChains] = useState<SwapChain[]>([])
  
  // Fırsatları yükle (3. adımda gösterilecek)
  useEffect(() => {
    const fetchOpportunities = async () => {
      if (step === 3) {
        setLoading(true)
        try {
          const response = await safeFetch('/api/multi-swap?action=find')
          if (response?.ok && response.data?.chains) {
            setChains(response.data.chains.slice(0, 5)) // En fazla 5 fırsat göster
          }
        } catch (err) {
          console.error('Multi-swap opportunities fetch error:', err)
        } finally {
          setLoading(false)
        }
      }
    }
    fetchOpportunities()
  }, [step])

  const handleStartSwap = async (chain: SwapChain) => {
    try {
      setLoading(true)
      const participantIds = chain.participants.map(p => p.userId)
      const productIds = chain.participants.map(p => p.productId)
      
      const response = await safeFetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          participantIds,
          productIds
        })
      })
      
      if (response?.ok && response.data?.multiSwap?.id) {
        onStartSwap?.(response.data.multiSwap.id)
        onClose()
      }
    } catch (err) {
      console.error('Multi-swap create error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getQualityLabel = (score: number): { text: string; color: string } => {
    if (score >= 80) return { text: 'Mükemmel', color: 'text-green-600 bg-green-100' }
    if (score >= 60) return { text: 'İyi', color: 'text-blue-600 bg-blue-100' }
    return { text: 'Orta', color: 'text-yellow-600 bg-yellow-100' }
  }

  // Döngü Animasyonu Bileşeni
  const CycleAnimation = () => {
    const [activeIndex, setActiveIndex] = useState(0)
    const participants = [
      { name: 'Ali', emoji: '📱', item: 'Telefon' },
      { name: 'Ayşe', emoji: '👟', item: 'Ayakkabı' },
      { name: 'Mehmet', emoji: '🎸', item: 'Gitar' }
    ]
    
    useEffect(() => {
      const interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % 3)
      }, 1500)
      return () => clearInterval(interval)
    }, [])
    
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center">
            <motion.div
              animate={{
                scale: activeIndex === i ? 1.2 : 1,
                opacity: activeIndex === i ? 1 : 0.7
              }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col items-center p-3 rounded-xl ${
                activeIndex === i 
                  ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-xs font-medium mt-1 dark:text-gray-200">{p.name}</span>
            </motion.div>
            {i < participants.length - 1 && (
              <motion.div
                animate={{
                  x: activeIndex === i ? [0, 5, 0] : 0,
                  opacity: activeIndex === i ? 1 : 0.5
                }}
                className="mx-1"
              >
                <ArrowRight className={`w-5 h-5 ${activeIndex === i ? 'text-purple-600' : 'text-gray-400'}`} />
              </motion.div>
            )}
          </div>
        ))}
        {/* Döngüyü tamamlayan ok */}
        <motion.div
          animate={{ x: activeIndex === 2 ? [0, 5, 0] : 0 }}
          className="ml-1"
        >
          <ArrowRight className={`w-5 h-5 ${activeIndex === 2 ? 'text-purple-600' : 'text-gray-400'}`} />
        </motion.div>
        <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">→ Ali</span>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              <h2 className="font-bold text-lg dark:text-white">Çoklu Takas</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{step}/3</span>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600"
            />
          </div>

          {/* Content */}
          <div className="p-6 min-h-[300px]">
            <AnimatePresence mode="wait">
              {/* STEP 1: Çoklu Takas Nedir? */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-purple-700 dark:text-purple-400 mb-2">
                      Çoklu Takas Nedir?
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      3 veya daha fazla kişinin ürünlerini döngüsel olarak takas etmesi
                    </p>
                  </div>

                  <CycleAnimation />

                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-4 rounded-xl">
                    <p className="text-center text-purple-800 dark:text-purple-200 font-medium">
                      ✨ Herkes istediğini alır, kimse para ödemez!
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Ali telefonunu Ayşe'ye verir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Ayşe ayakkabısını Mehmet'e verir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Mehmet gitarını Ali'ye verir</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Nasıl Çalışır? */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-purple-700 dark:text-purple-400 mb-2">
                      Nasıl Çalışır?
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      5 kolay adımda çoklu takas tamamlanır
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: '✅', title: 'Otomatik Eşleşme', desc: 'Sistem sizin için uygun döngüler bulur' },
                      { icon: '🔔', title: 'Bildirim', desc: 'Tüm katılımcılara bildirim gönderilir' },
                      { icon: '⏰', title: '48 Saat Süre', desc: 'Herkes 48 saat içinde onaylar' },
                      { icon: '📍', title: 'Buluşma Noktası', desc: 'Teslimat noktası belirlenir' },
                      { icon: '🎉', title: 'Takas Tamamlanır', desc: 'Herkes ürününü alır!' }
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{item.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Fırsatlar */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-purple-700 dark:text-purple-400 mb-2">
                      Senin İçin Bulunan Fırsatlar
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Algoritmamız sizin için şu döngüleri buldu
                    </p>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Fırsatlar aranıyor...</p>
                    </div>
                  ) : chains.length > 0 ? (
                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                      {chains.map((chain, i) => {
                        const quality = getQualityLabel(chain.totalScore)
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium dark:text-white">
                                  {chain.chainLength} Kişi
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${quality.color}`}>
                                {quality.text}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                              {chain.participants.map((p, j) => (
                                <div key={j} className="flex items-center">
                                  <div className="flex-shrink-0 text-center">
                                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center text-xs">
                                      {p.userName.charAt(0)}
                                    </div>
                                  </div>
                                  {j < chain.participants.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-gray-400 mx-0.5 flex-shrink-0" />
                                  )}
                                </div>
                              ))}
                              <ArrowRight className="w-3 h-3 text-purple-500 mx-0.5 flex-shrink-0" />
                              <span className="text-xs text-purple-600 dark:text-purple-400">döngü</span>
                            </div>

                            <button
                              onClick={() => handleStartSwap(chain)}
                              disabled={loading}
                              className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Takası Başlat
                                </>
                              )}
                            </button>
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">🔍</div>
                      <p className="text-gray-600 dark:text-gray-300 font-medium">
                        Şu anda uygun döngü bulunamadı
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Takas Merkezi'nden fırsatları takip edebilirsiniz
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                step === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Geri
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                İleri
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Kapat
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
