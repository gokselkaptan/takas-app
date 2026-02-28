'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { RefreshCw, Package, Clock, CheckCircle, Users, Filter, Loader2 } from 'lucide-react'
import { 
  PendingSwapRequest, 
  MultiSwap, 
  SwapFilter, 
  getStatusBadge,
  ACTIVE_STATUSES 
} from '@/lib/takas-merkezi-types'

interface SwapListProps {
  selectedSwapId: string | null
  onSelectSwap: (swapId: string, swapData: PendingSwapRequest | MultiSwap, isMulti: boolean) => void
  refreshTrigger?: number
}

interface SwapCardData {
  id: string
  type: 'direct' | 'multi'
  status: string
  productTitle: string
  productImage: string | null
  otherUserName: string | null
  otherUserId: string
  otherUserImage?: string | null
  lastMessage?: string
  unreadCount: number
  createdAt: string
  data: PendingSwapRequest | MultiSwap
}

export function SwapList({ selectedSwapId, onSelectSwap, refreshTrigger }: SwapListProps) {
  const { data: session } = useSession()
  const [filter, setFilter] = useState<SwapFilter>('offers')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Takas verileri
  const [sentRequests, setSentRequests] = useState<PendingSwapRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<PendingSwapRequest[]>([])
  const [activeSwaps, setActiveSwaps] = useState<PendingSwapRequest[]>([])
  const [completedSwaps, setCompletedSwaps] = useState<PendingSwapRequest[]>([])
  const [multiSwaps, setMultiSwaps] = useState<MultiSwap[]>([])
  
  // Okunmamış mesaj sayıları
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({})
  
  const currentUserId = (session?.user as any)?.id

  // Takasları yükle
  const fetchSwaps = useCallback(async (showRefresh = false) => {
    if (!session?.user) return
    
    if (showRefresh) setRefreshing(true)
    
    try {
      // Paralel istekler
      const [pendingRes, activeRes, multiRes] = await Promise.all([
        fetch('/api/swap-requests?status=pending'),
        fetch('/api/swap-requests?status=active'),
        fetch('/api/multi-swap')
      ])
      
      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setSentRequests(data.sent || [])
        setReceivedRequests(data.received || [])
      }
      
      if (activeRes.ok) {
        const data = await activeRes.json()
        const active: PendingSwapRequest[] = []
        const completed: PendingSwapRequest[] = []
        
        ;[...(data.asRequester || []), ...(data.asOwner || [])].forEach((swap: PendingSwapRequest) => {
          if (swap.status === 'completed') {
            completed.push(swap)
          } else if (ACTIVE_STATUSES.includes(swap.status)) {
            active.push(swap)
          }
        })
        
        // Tekrar eden takasları kaldır
        const uniqueActive = active.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)
        const uniqueCompleted = completed.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)
        
        setActiveSwaps(uniqueActive)
        setCompletedSwaps(uniqueCompleted)
      }
      
      if (multiRes.ok) {
        const data = await multiRes.json()
        setMultiSwaps(data.swaps || [])
      }
      
    } catch (err) {
      console.error('[SwapList] Takas yükleme hatası:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session?.user])

  // Okunmamış mesajları yükle
  const fetchUnreadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?unreadOnly=true')
      if (res.ok) {
        const data = await res.json()
        const counts: Record<string, number> = {}
        const messages: Record<string, string> = {}
        
        // Her konuşma için okunmamış sayısı ve son mesaj
        data.conversations?.forEach((conv: any) => {
          if (conv.swapRequestId) {
            counts[conv.swapRequestId] = conv.unreadCount || 0
            messages[conv.swapRequestId] = conv.lastMessage || ''
          }
        })
        
        setUnreadCounts(counts)
        setLastMessages(messages)
      }
    } catch (err) {
      console.error('[SwapList] Mesaj yükleme hatası:', err)
    }
  }, [])

  // İlk yükleme
  useEffect(() => {
    fetchSwaps()
    fetchUnreadMessages()
    
    // 30 saniyede bir güncelle
    const interval = setInterval(() => {
      fetchSwaps()
      fetchUnreadMessages()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchSwaps, fetchUnreadMessages])

  // Refresh trigger değiştiğinde yenile
  useEffect(() => {
    if (refreshTrigger) {
      fetchSwaps(true)
      fetchUnreadMessages()
    }
  }, [refreshTrigger, fetchSwaps, fetchUnreadMessages])

  // Filtrele ve kart verisi oluştur
  const getFilteredSwaps = (): SwapCardData[] => {
    const cards: SwapCardData[] = []
    
    if (filter === 'offers') {
      // Gönderilen ve alınan teklifler
      sentRequests.forEach(swap => {
        cards.push({
          id: swap.id,
          type: 'direct',
          status: swap.status,
          productTitle: swap.product.title,
          productImage: swap.product.images?.[0] || null,
          otherUserName: swap.product.user.name,
          otherUserId: swap.ownerId,
          unreadCount: unreadCounts[swap.id] || 0,
          lastMessage: lastMessages[swap.id],
          createdAt: swap.createdAt,
          data: swap
        })
      })
      
      receivedRequests.forEach(swap => {
        cards.push({
          id: swap.id,
          type: 'direct',
          status: swap.status,
          productTitle: swap.product.title,
          productImage: swap.product.images?.[0] || null,
          otherUserName: swap.requester.name,
          otherUserId: swap.requesterId,
          otherUserImage: swap.requester.image,
          unreadCount: unreadCounts[swap.id] || 0,
          lastMessage: lastMessages[swap.id],
          createdAt: swap.createdAt,
          data: swap
        })
      })
    } else if (filter === 'active') {
      activeSwaps.forEach(swap => {
        const isOwner = swap.ownerId === currentUserId
        cards.push({
          id: swap.id,
          type: 'direct',
          status: swap.status,
          productTitle: swap.product.title,
          productImage: swap.product.images?.[0] || null,
          otherUserName: isOwner ? swap.requester.name : swap.product.user.name,
          otherUserId: isOwner ? swap.requesterId : swap.ownerId,
          otherUserImage: isOwner ? swap.requester.image : undefined,
          unreadCount: unreadCounts[swap.id] || 0,
          lastMessage: lastMessages[swap.id],
          createdAt: swap.createdAt,
          data: swap
        })
      })
    } else if (filter === 'multi') {
      multiSwaps.forEach(swap => {
        const myParticipant = swap.participants.find(p => p.userId === currentUserId)
        const otherParticipant = swap.participants.find(p => p.userId !== currentUserId)
        
        cards.push({
          id: swap.id,
          type: 'multi',
          status: swap.status,
          productTitle: myParticipant?.givesProduct.title || 'Çoklu Takas',
          productImage: myParticipant?.givesProduct.images?.[0] || null,
          otherUserName: otherParticipant?.user.name || null,
          otherUserId: otherParticipant?.userId || '',
          otherUserImage: otherParticipant?.user.image,
          unreadCount: 0,
          createdAt: swap.createdAt,
          data: swap
        })
      })
    } else if (filter === 'completed') {
      completedSwaps.forEach(swap => {
        const isOwner = swap.ownerId === currentUserId
        cards.push({
          id: swap.id,
          type: 'direct',
          status: swap.status,
          productTitle: swap.product.title,
          productImage: swap.product.images?.[0] || null,
          otherUserName: isOwner ? swap.requester.name : swap.product.user.name,
          otherUserId: isOwner ? swap.requesterId : swap.ownerId,
          unreadCount: 0,
          createdAt: swap.createdAt,
          data: swap
        })
      })
    }
    
    // Tarihe göre sırala (yeni önce)
    return cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const filteredSwaps = getFilteredSwaps()

  // Filtre butonları
  const filterButtons: { key: SwapFilter; label: string; icon: React.ReactNode; count: number }[] = [
    { 
      key: 'offers', 
      label: 'Teklifler', 
      icon: <Clock className="w-4 h-4" />,
      count: sentRequests.length + receivedRequests.length
    },
    { 
      key: 'active', 
      label: 'Aktif', 
      icon: <Package className="w-4 h-4" />,
      count: activeSwaps.length
    },
    { 
      key: 'multi', 
      label: 'Çoklu', 
      icon: <Users className="w-4 h-4" />,
      count: multiSwaps.length
    },
    { 
      key: 'completed', 
      label: 'Tamamlanan', 
      icon: <CheckCircle className="w-4 h-4" />,
      count: completedSwaps.length
    },
  ]

  // Tarih formatı
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Bugün'
    if (days === 1) return 'Dün'
    if (days < 7) return `${days} gün önce`
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-frozen-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">📦 Takaslarım</h2>
          <button
            onClick={() => fetchSwaps(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === btn.key
                  ? 'bg-frozen-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {btn.icon}
              {btn.label}
              {btn.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === btn.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {btn.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Swap list */}
      <div className="flex-1 overflow-y-auto">
        {filteredSwaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Package className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Bu kategoride takas bulunamadı</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredSwaps.map((swap) => {
              const badge = getStatusBadge(swap.status)
              const isSelected = selectedSwapId === swap.id
              
              return (
                <motion.button
                  key={swap.id}
                  onClick={() => onSelectSwap(swap.id, swap.data, swap.type === 'multi')}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    isSelected ? 'bg-frozen-50 dark:bg-frozen-900/20 border-l-4 border-frozen-500' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Product image */}
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {swap.productImage ? (
                        <Image
                          src={swap.productImage}
                          alt={swap.productTitle}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      
                      {/* Unread badge */}
                      {swap.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {swap.unreadCount > 9 ? '9+' : swap.unreadCount}
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm truncate">{swap.productTitle}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {swap.type === 'multi' ? '🔄 Çoklu Takas' : swap.otherUserName || 'Kullanıcı'}
                      </p>
                      
                      {swap.lastMessage && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          💬 {swap.lastMessage}
                        </p>
                      )}
                      
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDate(swap.createdAt)}
                      </p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
