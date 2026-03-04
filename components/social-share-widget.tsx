'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  X,
  Gift,
  Coins,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  Award
} from 'lucide-react'

// Platform ikonları (inline SVG)
const TwitterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const InstagramIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

interface ShareStats {
  totalShares: number
  todayShares: number
  todayValorEarned: number
  totalValorEarned: number
  sharesUntilReward: number
  sharesForReward: number
  valorReward: number
  maxDailyShares: number
  maxDailyValor: number
  canEarnMoreToday: boolean
  userLevel: number
  levelName: string
  platformStats: Record<string, number>
}

interface SocialShareWidgetProps {
  shareType: 'profile' | 'product' | 'swap' | 'platform' | 'swap_history'
  contentId?: string
  title?: string
  description?: string
  url?: string
  compact?: boolean
}

export function SocialShareWidget({
  shareType,
  contentId,
  title = 'TAKAS-A - Ücretsiz Takas Platformu',
  description = 'Para ödemeden eşyalarını takas et!',
  url,
  compact = false
}: SocialShareWidgetProps) {
  const { data: session } = useSession()
  const [showModal, setShowModal] = useState(false)
  const [stats, setStats] = useState<ShareStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastReward, setLastReward] = useState<{ valor: number; message: string } | null>(null)

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://takas-a.com')

  // İstatistikleri yükle
  const fetchStats = async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/social-share')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Stats fetch error:', err)
    }
  }

  useEffect(() => {
    if (showModal && session?.user) {
      fetchStats()
    }
  }, [showModal, session])

  // Paylaşımı kaydet
  const recordShare = async (platform: string) => {
    if (!session?.user) return

    setLoading(true)
    try {
      const res = await fetch('/api/social-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          shareType,
          contentId,
          shareUrl
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.valorAwarded > 0) {
          setLastReward({ valor: data.valorAwarded, message: data.message })
          setTimeout(() => setLastReward(null), 5000)
        }
        fetchStats() // İstatistikleri güncelle
      }
    } catch (err) {
      console.error('Share record error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Platform bazlı paylaşım linkleri
  const getShareUrl = (platform: string): string => {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedTitle = encodeURIComponent(title)
    const encodedDesc = encodeURIComponent(description)

    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      case 'instagram':
        // Instagram doğrudan paylaşım desteklemiyor, story'ye yönlendir
        return `https://www.instagram.com/`
      case 'whatsapp':
        return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`
      default:
        return shareUrl
    }
  }

  // Paylaşım butonuna tıklandığında
  const handleShare = async (platform: string) => {
    const url = getShareUrl(platform)
    
    // Yeni pencerede aç
    if (platform !== 'instagram') {
      window.open(url, '_blank', 'width=600,height=400')
    } else {
      // Instagram için link kopyala ve bilgilendir
      await navigator.clipboard.writeText(shareUrl)
      alert('Link kopyalandı! Instagram\'da story veya post olarak paylaşabilirsiniz.')
    }

    // Paylaşımı kaydet
    await recordShare(platform)
  }

  const platforms = [
    { id: 'twitter', name: 'X (Twitter)', icon: TwitterIcon, color: 'bg-black hover:bg-gray-800' },
    { id: 'facebook', name: 'Facebook', icon: FacebookIcon, color: 'bg-[#1877F2] hover:bg-[#166FE5]' },
    { id: 'instagram', name: 'Instagram', icon: InstagramIcon, color: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90' },
    { id: 'whatsapp', name: 'WhatsApp', icon: WhatsAppIcon, color: 'bg-[#25D366] hover:bg-[#20BD5A]' },
  ]

  // Compact mod - sadece buton
  if (compact) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg transition-all"
      >
        <Share2 className="w-4 h-4" />
        Paylaş & Kazan
      </button>
    )
  }

  return (
    <>
      {/* Paylaş Butonu */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold hover:shadow-lg transition-all hover:scale-105"
      >
        <Share2 className="w-5 h-5" />
        <span>Paylaş & Valor Kazan</span>
        <Gift className="w-4 h-4" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Paylaş & Kazan! 🎉</h2>
                    <p className="text-white/80 text-sm">
                      {stats?.userLevel === 0 
                        ? 'İlk takasını tamamla, paylaşım bonusu açılsın! 🔓'
                        : `Her ${stats?.sharesForReward || 5} paylaşımda +${stats?.valorReward || 1} Valor kazan`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* İstatistikler */}
                {session?.user && stats && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold">{stats.totalShares}</div>
                      <div className="text-xs text-white/80">Paylaşım</div>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold">{stats.totalValorEarned}</div>
                      <div className="text-xs text-white/80">Kazanılan</div>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold">
                        {stats.userLevel === 0 ? '🔒' : stats.sharesUntilReward === 0 ? '✔' : stats.sharesUntilReward}
                      </div>
                      <div className="text-xs text-white/80">Ödüle Kalan</div>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold">
                        {['🌱','⭐','🔥','🏆','💎','👑'][stats.userLevel] || '🌱'}
                      </div>
                      <div className="text-xs text-white/80">Seviye {stats.userLevel}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ödül Bildirimi */}
              <AnimatePresence>
                {lastReward && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-green-100 border-b border-green-200"
                  >
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">
                          +{lastReward.valor} Valor Kazandın!
                        </p>
                        <p className="text-sm text-green-600">{lastReward.message}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Paylaşım Butonları */}
              <div className="p-6">
                {/* Seviye 0 için kilit göstergesi */}
                {stats?.userLevel === 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Paylaşım Bonusu Kilitli</p>
                      <p className="text-xs text-amber-600">İlk takasını tamamla, Seviye 1&apos;e çık ve paylaşarak kazan!</p>
                    </div>
                  </div>
                )}

                <p className="text-gray-600 mb-4 text-sm">
                  Aşağıdaki platformlardan birinde paylaşın:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => handleShare(platform.id)}
                      disabled={loading}
                      className={`${platform.color} text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50`}
                    >
                      <platform.icon />
                      <span className="font-medium">{platform.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </div>

                {/* Progress Bar */}
                {session?.user && stats && stats.userLevel > 0 && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Bir sonraki ödüle ilerleme</span>
                      <span>{(stats.sharesForReward || 5) - (stats.sharesUntilReward || 0)}/{stats.sharesForReward || 5} paylaşım</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(((stats.sharesForReward || 5) - (stats.sharesUntilReward || 0)) / (stats.sharesForReward || 5)) * 100}%` }}
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      />
                    </div>
                  </div>
                )}

                {/* Giriş Yapın Uyarısı */}
                {!session?.user && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Coins className="w-8 h-8 text-amber-500" />
                      <div>
                        <p className="font-semibold text-amber-800">Giriş yapın!</p>
                        <p className="text-sm text-amber-700">
                          Paylaşımlarınızdan Valor kazanmak için giriş yapın.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bilgi Kutusu */}
                <div className="mt-6 p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Award className="w-6 h-6 text-purple-500 mt-0.5" />
                    <div className="text-sm text-purple-700">
                      <p className="font-semibold mb-1">Nasıl Çalışır?</p>
                      <ul className="space-y-1 text-purple-600">
                        {stats?.userLevel === 0 ? (
                          <>
                            <li>• İlk takasını tamamla → paylaşım bonusu açılır!</li>
                            <li>• Seviyen arttıkça bonus da artar</li>
                            <li>• Paylaşımların sayılır, bonus geldiğinde geçerli olur</li>
                          </>
                        ) : (
                          <>
                            <li>• Seviye {stats?.userLevel}: Her {stats?.sharesForReward} paylaşımda +{stats?.valorReward} Valor</li>
                            <li>• Günde maksimum {stats?.maxDailyValor} Valor kazanabilirsin</li>
                            <li>• Seviyen arttıkça bonus artar! Takas yap, seviye atla!</li>
                            <li>• Tüm platformlar geçerli</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
