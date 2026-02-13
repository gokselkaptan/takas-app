'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, RefreshCw, Users, Package, CheckCircle, Clock,
  AlertCircle, Sparkles, ArrowLeftRight, ChevronRight, Bell,
  X, Check, Loader2, MapPin, Scale, TrendingUp, Filter, Info
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

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

interface SwapStats {
  totalFound: number
  balanced: number
  unbalanced: number
  averageScore: number
}

interface MultiSwap {
  id: string
  status: string
  createdAt: string
  participants: {
    id: string
    userId: string
    confirmed: boolean
    user: { id: string; name: string | null; image: string | null }
    givesProduct: { id: string; title: string; images: string[]; valorPrice: number }
  }[]
}

interface PendingSwapRequest {
  id: string
  productId: string
  message: string | null
  status: string
  createdAt: string
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
    user: { id: string; name: string | null }
  }
  requester: { id: string; name: string | null; email: string }
  offeredProduct?: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  } | null
}

export default function TakasFirsatlariPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const { t, language } = useLanguage()
  
  const [opportunities, setOpportunities] = useState<SwapChain[]>([])
  const [swapStats, setSwapStats] = useState<SwapStats | null>(null)
  const [activeSwaps, setActiveSwaps] = useState<MultiSwap[]>([])
  const [sentRequests, setSentRequests] = useState<PendingSwapRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<PendingSwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmingSwap, setConfirmingSwap] = useState<string | null>(null)
  const [rejectingSwap, setRejectingSwap] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [creatingSwap, setCreatingSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<'opportunities' | 'active' | 'requests'>('requests')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showOnlyBalanced, setShowOnlyBalanced] = useState(false)
  const [minScoreFilter, setMinScoreFilter] = useState(0)

  // Rejection reasons
  const rejectionReasons = [
    { id: 'value_difference', label: 'Değer farkı çok fazla' },
    { id: 'not_interested', label: 'Artık ilgilenmiyorum' },
    { id: 'location_far', label: 'Konum çok uzak' },
    { id: 'changed_mind', label: 'Fikrimi değiştirdim' },
    { id: 'other', label: 'Diğer' },
  ]

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    } else if (status === 'authenticated') {
      fetchData()
    }
  }, [status])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Build opportunity query with filters
      const opportunityParams = new URLSearchParams()
      if (showOnlyBalanced) opportunityParams.set('balanced', 'true')
      if (minScoreFilter > 0) opportunityParams.set('minScore', minScoreFilter.toString())
      
      // Fetch all data in parallel
      const [opportunitiesRes, activeRes, sentRes, receivedRes] = await Promise.all([
        fetch(`/api/multi-swap?${opportunityParams.toString()}`),
        fetch('/api/multi-swap?type=active'),
        fetch('/api/swap-requests?type=sent'),
        fetch('/api/swap-requests?type=received'),
      ])

      if (opportunitiesRes.ok) {
        const data = await opportunitiesRes.json()
        setOpportunities(data.opportunities || [])
        setSwapStats(data.stats || null)
      }

      if (activeRes.ok) {
        const data = await activeRes.json()
        setActiveSwaps(data || [])
      }

      if (sentRes.ok) {
        const data = await sentRes.json()
        setSentRequests(data || [])
      }

      if (receivedRes.ok) {
        const data = await receivedRes.json()
        setReceivedRequests(data || [])
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    showNotification('success', 'Veriler güncellendi!')
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleCreateMultiSwap = async (participants: SwapParticipant[]) => {
    setCreatingSwap(true)
    try {
      const res = await fetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', participants }),
      })

      if (res.ok) {
        showNotification('success', 'Çoklu takas oluşturuldu! Katılımcıların onayı bekleniyor.')
        await fetchData()
      } else {
        const data = await res.json()
        showNotification('error', data.error || 'Bir hata oluştu')
      }
    } catch (error) {
      showNotification('error', 'Takas oluşturulurken hata oluştu')
    } finally {
      setCreatingSwap(false)
    }
  }

  const handleConfirmSwap = async (multiSwapId: string) => {
    setConfirmingSwap(multiSwapId)
    try {
      const res = await fetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', multiSwapId }),
      })

      if (res.ok) {
        const data = await res.json()
        showNotification('success', data.message)
        await fetchData()
      } else {
        const data = await res.json()
        showNotification('error', data.error || 'Bir hata oluştu')
      }
    } catch (error) {
      showNotification('error', 'Onay gönderilirken hata oluştu')
    } finally {
      setConfirmingSwap(null)
    }
  }

  const handleRejectSwap = (multiSwapId: string) => {
    setShowRejectModal(multiSwapId)
    setRejectReason('')
  }

  const confirmRejectSwap = async () => {
    if (!showRejectModal) return
    
    setRejectingSwap(showRejectModal)
    try {
      const res = await fetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject', 
          multiSwapId: showRejectModal,
          reason: rejectReason || undefined
        }),
      })

      if (res.ok) {
        const data = await res.json()
        showNotification('success', data.message || 'Takas reddedildi')
        await fetchData()
        setShowRejectModal(null)
        setRejectReason('')
      } else {
        const data = await res.json()
        showNotification('error', data.error || 'Bir hata oluştu')
      }
    } catch (error) {
      showNotification('error', 'Red işlemi sırasında hata oluştu')
    } finally {
      setRejectingSwap(null)
    }
  }

  // Status badge helper function
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
      accepted: { label: 'Kabul Edildi', color: 'bg-green-100 text-green-700' },
      awaiting_delivery: { label: 'Teslimat Bekliyor', color: 'bg-blue-100 text-blue-700' },
      delivered: { label: 'Teslim Edildi', color: 'bg-purple-100 text-purple-700' },
      completed: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' },
      disputed: { label: 'Sorun Bildirildi', color: 'bg-red-100 text-red-700' },
      rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-700' },
      refunded: { label: 'İade Edildi', color: 'bg-gray-100 text-gray-700' },
    }
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  const handleUpdateRequest = async (requestId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, status: newStatus }),
      })

      if (res.ok) {
        showNotification('success', newStatus === 'accepted' ? 'Talep kabul edildi!' : 'Talep reddedildi.')
        await fetchData()
      } else {
        const data = await res.json()
        showNotification('error', data.error || 'Bir hata oluştu')
      }
    } catch (error) {
      showNotification('error', 'İşlem sırasında hata oluştu')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-frozen-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  const pendingReceivedCount = receivedRequests.filter(r => r.status === 'pending').length

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-purple-50/30 pt-20 pb-12">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Takası Reddet</h3>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">
                Bu takası reddettiğinizde tüm zincir iptal edilecek ve diğer katılımcılara bildirim gönderilecektir.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Red Nedeni (İsteğe Bağlı)
                </label>
                <div className="space-y-2">
                  {rejectionReasons.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        rejectReason === reason.label
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        value={reason.label}
                        checked={rejectReason === reason.label}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmRejectSwap}
                  disabled={rejectingSwap === showRejectModal}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {rejectingSwap === showRejectModal ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Reddediliyor...</>
                  ) : (
                    <><X className="w-5 h-5" /> Reddet</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6 text-white" />
              </div>
              Takas Fırsatları
            </h1>
            <p className="text-gray-600 mt-2">Takas taleplerinizi ve çoklu takas fırsatlarını yönetin</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white rounded-2xl p-2 shadow-sm">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>Talepler</span>
            {pendingReceivedCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'requests' ? 'bg-white/20' : 'bg-red-500 text-white'
              }`}>
                {pendingReceivedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Aktif Takaslar</span>
            {activeSwaps.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'active' ? 'bg-white/20' : 'bg-purple-500 text-white'
              }`}>
                {activeSwaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'opportunities'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Çoklu Takas</span>
            {opportunities.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'opportunities' ? 'bg-white/20' : 'bg-green-500 text-white'
              }`}>
                {opportunities.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Received Requests */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  Gelen Talepler
                </h2>
                {receivedRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Henüz gelen talep yok</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {receivedRequests.map((request: any) => (
                      <motion.div
                        key={request.id}
                        layout
                        className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${
                          request.status === 'pending' ? 'border-purple-200' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {request.product.images?.[0] ? (
                              <Image src={request.product.images[0]} alt="" fill className="object-cover" />
                            ) : (
                              <Package className="w-8 h-8 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm text-gray-500">Ürününüz için talep:</p>
                                <Link href={`/urun/${request.product.id}`} className="font-semibold text-gray-900 hover:text-purple-600">
                                  {request.product.title}
                                </Link>
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">{request.requester.name || 'Kullanıcı'}</span> ilgi bildirdi
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(request.status).color}`}>
                                {getStatusInfo(request.status).label}
                              </span>
                            </div>
                            {request.offeredProduct && (
                              <div className="mt-3 p-3 bg-purple-50 rounded-xl">
                                <p className="text-xs text-purple-600 font-medium mb-1">Teklif edilen ürün:</p>
                                <Link href={`/urun/${request.offeredProduct.id}`} className="text-sm font-medium text-gray-900 hover:text-purple-600">
                                  {request.offeredProduct.title} ({request.offeredProduct.valorPrice} Valor)
                                </Link>
                              </div>
                            )}
                            {request.message && (
                              <p className="text-sm text-gray-600 mt-2 italic">"{request.message}"</p>
                            )}
                            {request.status === 'pending' && (
                              <div className="flex gap-2 mt-4">
                                <button
                                  onClick={() => handleUpdateRequest(request.id, 'accepted')}
                                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                                >
                                  <Check className="w-4 h-4" /> Kabul Et
                                </button>
                                <button
                                  onClick={() => handleUpdateRequest(request.id, 'rejected')}
                                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 transition-colors"
                                >
                                  <X className="w-4 h-4" /> Reddet
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  Gönderilen Talepler
                </h2>
                {sentRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Henüz gönderilen talep yok</p>
                    <Link href="/urunler" className="inline-flex items-center gap-2 mt-4 text-purple-600 font-medium hover:underline">
                      Ürünlere Göz At <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sentRequests.map((request: any) => (
                      <div key={request.id} className="bg-white rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {request.product.images?.[0] ? (
                              <Image src={request.product.images[0]} alt="" fill className="object-cover" />
                            ) : (
                              <Package className="w-8 h-8 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm text-gray-500">İlgilendiğiniz ürün:</p>
                                <Link href={`/urun/${request.product.id}`} className="font-semibold text-gray-900 hover:text-purple-600">
                                  {request.product.title}
                                </Link>
                                <p className="text-sm text-purple-600 font-medium">{request.product.valorPrice} Valor</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(request.status).color}`}>
                                {getStatusInfo(request.status).label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {activeSwaps.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Aktif Takas Yok</h3>
                  <p className="text-gray-500 mb-4">
                    Şu anda katıldığınız aktif bir çoklu takas bulunmuyor.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeSwaps.map((swap: any) => {
                    const myParticipation = swap.participants.find((p: any) => p.user?.email === session?.user?.email)
                    const alreadyConfirmed = myParticipation?.confirmed
                    const confirmedCount = swap.participants.filter((p: any) => p.confirmed).length
                    const remainingCount = swap.participants.length - confirmedCount

                    return (
                      <div key={swap.id} className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${
                        swap.status === 'confirmed' ? 'border-green-200' : 'border-yellow-100'
                      }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">
                              {swap.participants.length} Kişilik Takas
                            </h3>
                            {swap.isInitiator && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                Başlatan
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Time Remaining */}
                            {swap.status === 'pending' && swap.timeRemaining !== null && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                                swap.timeRemaining < 120 ? 'bg-red-100 text-red-700' : 
                                swap.timeRemaining < 480 ? 'bg-orange-100 text-orange-700' : 
                                'bg-blue-100 text-blue-700'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {swap.timeRemaining < 60 
                                  ? `${swap.timeRemaining} dk` 
                                  : `${Math.floor(swap.timeRemaining / 60)} sa ${swap.timeRemaining % 60} dk`}
                              </span>
                            )}
                            {/* Status Badge */}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              swap.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              swap.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {swap.status === 'pending' ? `${confirmedCount}/${swap.participants.length} Onay` :
                               swap.status === 'confirmed' ? '✓ Onaylandı' : swap.status}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {swap.status === 'pending' && (
                          <div className="mb-4">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                style={{ width: `${(confirmedCount / swap.participants.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Participants */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-4">
                          {swap.participants.map((p: any, idx: number) => (
                            <div key={p.id} className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-center">
                                <div className={`relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 mb-2 border-2 ${
                                  p.confirmed ? 'border-green-300' : 'border-gray-200'
                                }`}>
                                  {p.givesProduct.images?.[0] ? (
                                    <Image src={p.givesProduct.images[0]} alt="" fill className="object-cover" />
                                  ) : (
                                    <Package className="w-6 h-6 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                  )}
                                  {/* Valor badge */}
                                  <div className="absolute bottom-0.5 right-0.5 bg-white/90 px-1 py-0.5 rounded text-xs font-bold text-purple-700">
                                    {p.givesProduct.valorPrice}V
                                  </div>
                                </div>
                                <p className="text-xs font-medium text-gray-900 truncate max-w-[80px]">
                                  {p.user.name || 'Kullanıcı'}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-[80px]">
                                  {p.givesProduct.title}
                                </p>
                                {p.confirmed ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                    <CheckCircle className="w-3 h-3" /> Onayladı
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-yellow-600 mt-1">
                                    <Clock className="w-3 h-3" /> Bekliyor
                                  </span>
                                )}
                              </div>
                              {idx < swap.participants.length - 1 && (
                                <ArrowRight className="w-5 h-5 text-gray-300" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        {swap.status === 'pending' && (
                          <div className="flex gap-3 mt-4">
                            {!alreadyConfirmed ? (
                              <>
                                <button
                                  onClick={() => handleConfirmSwap(swap.id)}
                                  disabled={confirmingSwap === swap.id}
                                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                  {confirmingSwap === swap.id ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Onaylanıyor...</>
                                  ) : (
                                    <><Check className="w-5 h-5" /> Onayla</>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectSwap(swap.id)}
                                  disabled={rejectingSwap === swap.id}
                                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                  {rejectingSwap === swap.id ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <X className="w-5 h-5" />
                                  )}
                                  Reddet
                                </button>
                              </>
                            ) : (
                              <div className="flex-1 py-3 rounded-xl bg-green-50 text-green-700 font-medium text-center flex items-center justify-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                Onayınız alındı. {remainingCount > 0 ? `${remainingCount} kişi bekleniyor.` : ''}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Confirmed Status */}
                        {swap.status === 'confirmed' && (
                          <div className="mt-4 p-4 bg-green-50 rounded-xl">
                            <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                              <CheckCircle className="w-5 h-5" />
                              Takas Onaylandı!
                            </div>
                            <p className="text-sm text-green-600">
                              Tüm katılımcılar onayladı. Teslim detayları için diğer kullanıcılarla iletişime geçin.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'opportunities' && (
            <motion.div
              key="opportunities"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Filters & Stats */}
              <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Filters */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Filtreler:</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyBalanced}
                        onChange={(e) => {
                          setShowOnlyBalanced(e.target.checked)
                          setTimeout(fetchData, 100)
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-600">Sadece Dengeli</span>
                    </label>
                    <select
                      value={minScoreFilter}
                      onChange={(e) => {
                        setMinScoreFilter(parseInt(e.target.value))
                        setTimeout(fetchData, 100)
                      }}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="0">Tüm Skorlar</option>
                      <option value="30">Min. 30 Puan</option>
                      <option value="50">Min. 50 Puan</option>
                      <option value="70">Min. 70 Puan</option>
                    </select>
                  </div>
                  
                  {/* Stats */}
                  {swapStats && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        <span className="font-semibold text-gray-900">{swapStats.totalFound}</span> fırsat
                      </span>
                      <span className="text-green-600">
                        <span className="font-semibold">{swapStats.balanced}</span> dengeli
                      </span>
                      <span className="text-orange-600">
                        <span className="font-semibold">{swapStats.unbalanced}</span> dengesiz
                      </span>
                      {swapStats.averageScore > 0 && (
                        <span className="text-purple-600">
                          Ort. <span className="font-semibold">{swapStats.averageScore}</span> puan
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {opportunities.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                  <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Çoklu Takas Fırsatı Bulunamadı</h3>
                  <p className="text-gray-500 mb-4">
                    {showOnlyBalanced || minScoreFilter > 0 
                      ? 'Seçili filtrelere uygun takas bulunamadı. Filtreleri değiştirmeyi deneyin.'
                      : 'Şu anda size uygun çoklu takas döngüsü bulunmuyor. Daha fazla ürüne ilgi bildirerek şansınızı artırabilirsiniz.'}
                  </p>
                  <Link
                    href="/urunler"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-all"
                  >
                    Ürünlere Göz At <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Banner */}
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">Akıllı Takas Algoritması</h3>
                        <p className="text-sm text-gray-600">
                          Algoritmamız değer dengesi (±%20 tolerans) ve konum yakınlığını analiz ederek en adil ve pratik takas döngülerini önceliklendirir. 
                          Yeşil badge = dengeli değerler, yüksek skor = daha iyi eşleşme!
                        </p>
                      </div>
                    </div>
                  </div>

                  {opportunities.map((opportunity, idx) => (
                    <div 
                      key={idx} 
                      className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                        opportunity.isValueBalanced 
                          ? 'border-green-200 hover:border-green-300' 
                          : 'border-orange-200 hover:border-orange-300'
                      }`}
                    >
                      {/* Header with badges */}
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Users className="w-5 h-5 text-purple-500" />
                          {opportunity.chainLength} Kişilik Takas Fırsatı
                        </h3>
                        <div className="flex items-center gap-2">
                          {/* Balance Badge */}
                          {opportunity.isValueBalanced ? (
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center gap-1">
                              <Scale className="w-3 h-3" /> Dengeli
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> %{opportunity.valueDifference} Fark
                            </span>
                          )}
                          {/* Total Score Badge */}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            opportunity.totalScore >= 70 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                              : opportunity.totalScore >= 50 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}>
                            {opportunity.totalScore} Puan
                          </span>
                        </div>
                      </div>

                      {/* Score Details */}
                      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                            <Scale className="w-3 h-3" /> Değer Dengesi
                          </div>
                          <div className={`text-lg font-bold ${
                            opportunity.valueBalanceScore >= 70 ? 'text-green-600' :
                            opportunity.valueBalanceScore >= 40 ? 'text-orange-500' : 'text-red-500'
                          }`}>
                            {opportunity.valueBalanceScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                            <MapPin className="w-3 h-3" /> Konum Skoru
                          </div>
                          <div className={`text-lg font-bold ${
                            opportunity.locationScore >= 70 ? 'text-green-600' :
                            opportunity.locationScore >= 40 ? 'text-orange-500' : 'text-red-500'
                          }`}>
                            {opportunity.locationScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                            <TrendingUp className="w-3 h-3" /> Ort. Değer
                          </div>
                          <div className="text-lg font-bold text-purple-600">
                            {opportunity.averageValorPrice} V
                          </div>
                        </div>
                      </div>
                      
                      {/* Participants */}
                      <div className="flex items-center gap-4 overflow-x-auto pb-4">
                        {opportunity.participants.map((p, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-center">
                              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 mb-2 border-2 border-purple-200">
                                {p.productImage ? (
                                  <Image src={p.productImage} alt="" fill className="object-cover" />
                                ) : (
                                  <Package className="w-8 h-8 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                                {/* Valor Price Badge */}
                                <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs font-bold text-purple-700">
                                  {p.productValorPrice}V
                                </div>
                              </div>
                              <p className="text-sm font-medium text-gray-900">{p.userName}</p>
                              <p className="text-xs text-gray-500 truncate max-w-[100px]">{p.productTitle}</p>
                              {p.productLocation && (
                                <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[80px]">{p.productLocation}</span>
                                </p>
                              )}
                            </div>
                            {pIdx < opportunity.participants.length - 1 && (
                              <ArrowRight className="w-6 h-6 text-purple-400" />
                            )}
                          </div>
                        ))}
                        <ArrowRight className="w-6 h-6 text-purple-400 rotate-180 flex-shrink-0" />
                      </div>

                      {/* Warning for unbalanced swaps */}
                      {!opportunity.isValueBalanced && (
                        <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl mb-4">
                          <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-700">
                            Bu takas zincirinde ürün değerleri arasında %{opportunity.valueDifference} farklılık var. 
                            Yine de katılmak isterseniz, tüm tarafların onayı gerekecektir.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => handleCreateMultiSwap(opportunity.participants)}
                        disabled={creatingSwap}
                        className={`w-full py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${
                          opportunity.isValueBalanced
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                        }`}
                      >
                        {creatingSwap ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Oluşturuluyor...</>
                        ) : (
                          <><ArrowLeftRight className="w-5 h-5" /> Bu Takası Başlat</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
