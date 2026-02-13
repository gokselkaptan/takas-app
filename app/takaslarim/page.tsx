'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, Loader2, Package, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, ArrowLeft, MessageCircle, Calendar, User } from 'lucide-react'
import { getDisplayName } from '@/lib/display-name'

interface SwapRequest {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  agreedPrice?: number
  negotiationStatus?: string
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  }
  requester: {
    id: string
    name: string
    nickname?: string
    image?: string
  }
  owner: {
    id: string
    name: string
    nickname?: string
    image?: string
  }
}

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pending: { label: 'Beklemede', color: 'text-yellow-600', icon: Clock, bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
  accepted: { label: 'Kabul Edildi', color: 'text-green-600', icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/20' },
  rejected: { label: 'Reddedildi', color: 'text-red-600', icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/20' },
  completed: { label: 'Tamamlandı', color: 'text-blue-600', icon: CheckCircle, bg: 'bg-blue-100 dark:bg-blue-900/20' },
  cancelled: { label: 'İptal Edildi', color: 'text-gray-600', icon: XCircle, bg: 'bg-gray-100 dark:bg-gray-900/20' },
  in_delivery: { label: 'Teslimatta', color: 'text-purple-600', icon: Package, bg: 'bg-purple-100 dark:bg-purple-900/20' },
  delivered: { label: 'Teslim Edildi', color: 'text-emerald-600', icon: CheckCircle, bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
  disputed: { label: 'İtiraz Var', color: 'text-orange-600', icon: AlertCircle, bg: 'bg-orange-100 dark:bg-orange-900/20' },
}

export default function TakaslarimPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      fetchSwaps()
    }
  }, [session])

  const fetchSwaps = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/swap-requests')
      if (res.ok) {
        const data = await res.json()
        setSwaps(data.requests || [])
      }
    } catch (error) {
      console.error('Takaslar yüklenemedi:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSwaps = swaps.filter(swap => {
    if (filter === 'all') return true
    const userId = (session?.user as any)?.id
    if (filter === 'sent') return swap.requester.id === userId
    if (filter === 'received') return swap.owner.id === userId
    return true
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOtherUser = (swap: SwapRequest) => {
    const userId = (session?.user as any)?.id
    return swap.requester.id === userId ? swap.owner : swap.requester
  }

  const isRequester = (swap: SwapRequest) => {
    return swap.requester.id === (session?.user as any)?.id
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      {!selectedSwap && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-6 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Takaslarım</h1>
                <p className="text-white/80 text-sm">{swaps.length} takas işlemi</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedSwap ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Filters */}
              <div className="p-4 flex gap-2 overflow-x-auto">
                {(['all', 'sent', 'received'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      filter === f
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'Tümü' : f === 'sent' ? 'Gönderdiğim' : 'Aldığım'}
                  </button>
                ))}
              </div>

              {/* Swap List */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredSwaps.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <ArrowLeftRight className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Henüz takas yok
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Bir ürüne ilgi göstererek takas başlat!
                    </p>
                    <Link
                      href="/urunler"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      <Package className="w-5 h-5" />
                      Ürünleri Keşfet
                    </Link>
                  </div>
                ) : (
                  filteredSwaps.map((swap) => {
                    const config = statusConfig[swap.status] || statusConfig.pending
                    const StatusIcon = config.icon
                    const otherUser = getOtherUser(swap)

                    return (
                      <button
                        key={swap.id}
                        onClick={() => setSelectedSwap(swap)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={swap.product.images?.[0] || '/images/placeholder.jpg'}
                            alt={swap.product.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {swap.product.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isRequester(swap) ? 'Talep ettin' : 'Talep aldın'} · {getDisplayName(otherUser)}
                          </p>
                          <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          ) : (
            // Swap Detail View
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="min-h-screen"
            >
              {/* Detail Header */}
              <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center gap-3 sticky top-16">
                <button
                  onClick={() => setSelectedSwap(null)}
                  className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h2 className="font-semibold text-gray-900 dark:text-white">Takas Detayı</h2>
              </div>

              <div className="p-4 space-y-4">
                {/* Product Card */}
                <Link 
                  href={`/urun/${selectedSwap.product.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex gap-4">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={selectedSwap.product.images?.[0] || '/images/placeholder.jpg'}
                        alt={selectedSwap.product.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {selectedSwap.product.title}
                      </h3>
                      <p className="text-purple-600 dark:text-purple-400 font-bold">
                        {selectedSwap.agreedPrice || selectedSwap.product.valorPrice} Valor
                      </p>
                    </div>
                  </div>
                </Link>

                {/* Status */}
                {(() => {
                  const config = statusConfig[selectedSwap.status] || statusConfig.pending
                  const StatusIcon = config.icon
                  return (
                    <div className={`flex items-center gap-3 p-4 rounded-xl ${config.bg}`}>
                      <StatusIcon className={`w-6 h-6 ${config.color}`} />
                      <div>
                        <p className={`font-semibold ${config.color}`}>{config.label}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedSwap.status === 'pending' && 'Yanıt bekleniyor...'}
                          {selectedSwap.status === 'accepted' && 'Takas onaylandı!'}
                          {selectedSwap.status === 'rejected' && 'Takas reddedildi'}
                          {selectedSwap.status === 'completed' && 'Takas başarıyla tamamlandı'}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Users */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Takas Tarafları</h4>
                  
                  {/* Requester */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                      {selectedSwap.requester.image ? (
                        <Image
                          src={selectedSwap.requester.image}
                          alt={selectedSwap.requester.name || ''}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getDisplayName(selectedSwap.requester)}
                        {isRequester(selectedSwap) && <span className="text-xs text-blue-600 ml-2">(Sen)</span>}
                      </p>
                      <p className="text-xs text-gray-500">Talep Eden</p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowLeftRight className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Owner */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                      {selectedSwap.owner.image ? (
                        <Image
                          src={selectedSwap.owner.image}
                          alt={selectedSwap.owner.name || ''}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getDisplayName(selectedSwap.owner)}
                        {!isRequester(selectedSwap) && <span className="text-xs text-purple-600 ml-2">(Sen)</span>}
                      </p>
                      <p className="text-xs text-gray-500">Ürün Sahibi</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Takas Geçmişi</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-600 mt-2" />
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">Takas talebi oluşturuldu</p>
                        <p className="text-xs text-gray-500">{formatDate(selectedSwap.createdAt)}</p>
                      </div>
                    </div>
                    {selectedSwap.status !== 'pending' && (
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          selectedSwap.status === 'accepted' || selectedSwap.status === 'completed' ? 'bg-green-600' :
                          selectedSwap.status === 'rejected' ? 'bg-red-600' : 'bg-gray-400'
                        }`} />
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {statusConfig[selectedSwap.status]?.label || 'Güncellendi'}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(selectedSwap.updatedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Link
                    href={`/mesajlar`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Mesaj Gönder
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
