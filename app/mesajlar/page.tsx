'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, ArrowLeft, Loader2, User, Package, Trash2, AlertTriangle, Check, CheckCheck } from 'lucide-react'
import { getDisplayName } from '@/lib/display-name'
import { safeGet, safePost, isOffline } from '@/lib/safe-fetch'
import { playMessageSound } from '@/lib/notification-sounds'
import { useLanguage } from '@/lib/language-context'
import { BlockReportActions } from '@/components/block-report-actions'

interface Conversation {
  otherUser: {
    id: string
    name: string
    nickname?: string
    image?: string
  }
  product?: {
    id: string
    title: string
    images: string[]
  }
  lastMessage: {
    content: string
    createdAt: string
    senderId: string
  }
  unreadCount: number
}

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
  isRead: boolean
  readAt?: string | null
  swapRequestId?: string
  swapRequest?: {
    id: string
    status: string
    product?: {
      id: string
      title: string
    }
  }
  metadata?: string | null
}

const ADMIN_EMAIL = 'join@takas-a.com'
// Polling intervalleri
const CONVERSATION_LIST_POLL_MS = 10000 // 10 saniye
const ACTIVE_CHAT_POLL_MS = 3000 // 3 saniye

export default function MesajlarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'message' | 'conversation', id?: string, conv?: Conversation } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isCurrentUserBlocked, setIsCurrentUserBlocked] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevUnreadCountRef = useRef<number>(0)
  const conversationPollRef = useRef<NodeJS.Timeout | null>(null)
  const chatPollRef = useRef<NodeJS.Timeout | null>(null)
  const selectedConvRef = useRef<Conversation | null>(null)
  
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const currentUserId = (session?.user as any)?.id

  // selectedConversation ref'ini güncel tut (polling callback'leri için)
  useEffect(() => {
    selectedConvRef.current = selectedConversation
  }, [selectedConversation])

  // selectedConversation değiştiğinde block durumunu fetch et
  useEffect(() => {
    if (!selectedConversation?.otherUser?.id) {
      setIsCurrentUserBlocked(false)
      return
    }
    fetch(`/api/users/${selectedConversation.otherUser.id}/block`)
      .then(r => r.json())
      .then(data => setIsCurrentUserBlocked(data.isBlocked))
      .catch(() => setIsCurrentUserBlocked(false))
  }, [selectedConversation?.otherUser?.id])

  // Tek useEffect ile auth ve veri çekme
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/giris')
      return
    }
    if (status === 'authenticated') {
      fetchConversations()
    }
  }, [status])

  // Mesaj scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ═══ POLLING: Konuşma listesi (her 10 sn) ═══
  useEffect(() => {
    // Auth guard
    if (status !== 'authenticated') return

    conversationPollRef.current = setInterval(() => {
      if (!selectedConvRef.current) {
        // Sadece konuşma listesindeyken güncelle
        fetchConversationsSilent()
      }
    }, CONVERSATION_LIST_POLL_MS)

    return () => {
      if (conversationPollRef.current) clearInterval(conversationPollRef.current)
    }
  }, [status])

  // ═══ POLLING: Aktif sohbet (her 3 sn) ═══
  useEffect(() => {
    // Auth guard
    if (status !== 'authenticated') {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
      return
    }

    if (!selectedConversation) {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
      return
    }

    chatPollRef.current = setInterval(() => {
      const conv = selectedConvRef.current
      if (conv) {
        fetchMessagesSilent(conv.otherUser.id, conv.product?.id)
      }
    }, ACTIVE_CHAT_POLL_MS)

    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
    }
  }, [status, selectedConversation?.otherUser.id, selectedConversation?.product?.id])

  // URL'den gelen userId parametresiyle direkt konuşma aç
  useEffect(() => {
    const targetUserId = searchParams.get('userId')
    const targetProductId = searchParams.get('productId')
    const targetProductTitle = searchParams.get('productTitle')
    
    if (!targetUserId || !session?.user) return
    
    const existingConv = conversations.find(
      c => c.otherUser.id === targetUserId && 
        (!targetProductId || c.product?.id === targetProductId)
    )
    
    if (existingConv) {
      handleSelectConversation(existingConv)
    } else if (!loading && conversations.length >= 0) {
      const newConv: Conversation = {
        otherUser: {
          id: targetUserId,
          name: targetProductTitle ? decodeURIComponent(targetProductTitle) : 'Kullanıcı',
          image: undefined,
        },
        product: targetProductId ? {
          id: targetProductId,
          title: targetProductTitle ? decodeURIComponent(targetProductTitle) : '',
          images: [],
        } : undefined,
        lastMessage: {
          content: '',
          createdAt: new Date().toISOString(),
          senderId: '',
        },
        unreadCount: 0,
      }
      setSelectedConversation(newConv)
      setMessages([])
      setLoadingMessages(false)
    }
  }, [searchParams, conversations, session, loading])

  const fetchConversations = async () => {
    if (isOffline()) {
      setError('İnternet bağlantınız yok')
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, ok, error, status, isTimeout } = await safeGet('/api/messages', { 
        timeout: 20000,
        retries: 2
      })
      
      if (ok && data) {
        const convList = data.conversations || data || []
        const conversationList = Array.isArray(convList) ? convList : []
        const totalUnread = conversationList.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0)
        if (totalUnread > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
          playMessageSound()
        }
        prevUnreadCountRef.current = totalUnread
        setConversations(conversationList)
        setError(null)
      } else if (status === 401) {
        router.replace('/giris')
      } else if (isTimeout) {
        setError('Bağlantı zaman aşımına uğradı. Sayfayı yenileyin.')
      } else {
        setError(error || 'Konuşmalar yüklenemedi')
      }
    } catch (err: any) {
      console.error('[fetchConversations] Exception:', err)
      setError(err.message || 'Beklenmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  // Sessiz konuşma listesi güncelleme (polling için - loading/error göstermez)
  const fetchConversationsSilent = async () => {
    if (isOffline()) return
    try {
      const { data, ok } = await safeGet('/api/messages', { timeout: 15000, retries: 0 })
      if (ok && data) {
        const convList = data.conversations || data || []
        const conversationList = Array.isArray(convList) ? convList : []
        const totalUnread = conversationList.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0)
        if (totalUnread > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
          playMessageSound()
        }
        prevUnreadCountRef.current = totalUnread
        setConversations(conversationList)
      }
    } catch {} // Sessizce başarısız ol
  }

  const fetchMessages = async (otherUserId: string, productId?: string) => {
    if (isOffline()) return
    
    setLoadingMessages(true)
    try {
      const params = new URLSearchParams({ userId: otherUserId })
      if (productId) params.append('productId', productId)
      
      const { data, ok, error, isTimeout } = await safeGet(`/api/messages?${params}`, { 
        timeout: 15000,
        retries: 2
      })
      
      if (ok && data) {
        const messageList = Array.isArray(data) ? data : (data.messages || [])
        setMessages(messageList)
      } else if (isTimeout) {
        console.warn('[fetchMessages] Timeout')
      }
    } catch (error) {
      console.error('[fetchMessages] Error:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Sessiz mesaj güncelleme (polling için - loading göstermez)
  const fetchMessagesSilent = async (otherUserId: string, productId?: string) => {
    if (isOffline()) return
    try {
      const params = new URLSearchParams({ userId: otherUserId })
      if (productId) params.append('productId', productId)
      
      const { data, ok } = await safeGet(`/api/messages?${params}`, { timeout: 10000, retries: 0 })
      
      if (ok && data) {
        const messageList = Array.isArray(data) ? data : (data.messages || [])
        setMessages(prev => {
          // Sadece yeni mesaj varsa güncelle (gereksiz render'ı önle)
          if (messageList.length !== prev.length || 
              (messageList.length > 0 && prev.length > 0 && 
               messageList[messageList.length - 1]?.id !== prev[prev.length - 1]?.id) ||
              // isRead değişikliğini de kontrol et
              messageList.some((m: Message, i: number) => prev[i] && m.isRead !== prev[i].isRead)) {
            return messageList
          }
          return prev
        })
      }
    } catch {} // Sessizce başarısız ol
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    fetchMessages(conv.otherUser.id, conv.product?.id)
    
    // Mesajları okundu olarak işaretle
    markConversationAsRead(conv)
  }

  // Konuşmadaki mesajları okundu olarak işaretle
  const markConversationAsRead = async (conv: Conversation) => {
    if (!conv.otherUser.id) return
    try {
      await fetch('/api/messages/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otherUserId: conv.otherUser.id,
          productId: conv.product?.id,
        })
      })
      // Konuşma listesindeki unreadCount'u güncelle
      setConversations(prev => prev.map(c => 
        c.otherUser.id === conv.otherUser.id && c.product?.id === conv.product?.id
          ? { ...c, unreadCount: 0 }
          : c
      ))
    } catch {} // Sessizce başarısız ol
  }

  // ═══ OPTİMİSTİK MESAJ GÖNDERME ═══
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return
    
    if (isOffline()) {
      setError('İnternet bağlantınız yok')
      return
    }

    const messageContent = newMessage.trim()
    const tempId = 'temp-' + Date.now()

    // 🚀 Optimistic update - mesajı ANINDA göster
    const tempMessage: Message = {
      id: tempId,
      content: messageContent,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      isRead: false,
      readAt: null,
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')

    // Konuşma listesinde son mesajı güncelle
    setConversations(prev => prev.map(c => 
      c.otherUser.id === selectedConversation.otherUser.id && c.product?.id === selectedConversation.product?.id
        ? { ...c, lastMessage: { content: messageContent, createdAt: new Date().toISOString(), senderId: currentUserId } }
        : c
    ))

    setSending(true)
    try {
      const { data, ok, error } = await safePost('/api/messages', {
        receiverId: selectedConversation.otherUser.id,
        productId: selectedConversation.product?.id,
        content: messageContent
      }, { timeout: 10000, retries: 1 })

      if (ok && data) {
        // Temp mesajı gerçek mesajla değiştir
        const realMessage = data.message || data
        setMessages(prev => 
          prev.map(msg => msg.id === tempId ? { ...realMessage } : msg)
        )
      } else {
        // Hata durumunda temp mesajı kaldır, mesajı input'a geri koy
        setMessages(prev => prev.filter(msg => msg.id !== tempId))
        setNewMessage(messageContent)
        console.error('Mesaj gönderilemedi:', error)
      }
    } catch (err) {
      // Hata durumunda temp mesajı kaldır
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      setNewMessage(messageContent)
      console.error('Mesaj gönderilemedi:', err)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Dün'
    if (days < 7) return `${days} gün önce`
    return date.toLocaleDateString('tr-TR')
  }

  // Admin mesaj silme
  const handleDeleteMessage = async (messageId: string) => {
    if (!isAdmin) return
    setDeleting(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId))
        setDeleteConfirm(null)
      }
    } catch (err) {
      console.error('Mesaj silinemedi:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Admin konuşma silme
  const handleDeleteConversation = async (conv: Conversation) => {
    if (!isAdmin) return
    setDeleting(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conversationUserId: conv.otherUser.id,
          productId: conv.product?.id
        })
      })
      if (res.ok) {
        setConversations(prev => prev.filter(c => 
          !(c.otherUser.id === conv.otherUser.id && c.product?.id === conv.product?.id)
        ))
        setDeleteConfirm(null)
        if (selectedConversation?.otherUser.id === conv.otherUser.id) {
          setSelectedConversation(null)
        }
      }
    } catch (err) {
      console.error('Konuşma silinemedi:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ═══ OKUNDU TİKİ KOMPONENTI ═══
  const ReadReceipt = ({ message }: { message: Message }) => {
    if (message.senderId !== currentUserId) return null
    
    // Temp mesaj (henüz gönderilmedi)
    if (message.id.startsWith('temp-')) {
      return (
        <span className="inline-flex items-center ml-1">
          <Loader2 className="w-3 h-3 animate-spin text-white/50" />
        </span>
      )
    }
    
    if (message.isRead) {
      // Çift tik - okundu (mavi)
      return (
        <span className="inline-flex items-center ml-1" title="Okundu">
          <CheckCheck className="w-4 h-4 text-blue-300" />
        </span>
      )
    }
    
    // Tek tik - iletildi
    return (
      <span className="inline-flex items-center ml-1" title="İletildi">
        <Check className="w-3.5 h-3.5 text-white/60" />
      </span>
    )
  }

  // Session kontrol
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('loadingMessages')}</span>
        </div>
      </div>
    )
  }

  // Hata durumu
  if (error) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => {
              setError(null)
              fetchConversations()
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      {!selectedConversation && (
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-6 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">{t('myMessages')}</h1>
                <p className="text-white/80 text-sm">{conversations.length} {t('conversationCount')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedConversation ? (
            // Conversation List
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-gray-100 dark:divide-gray-800"
            >
              {conversations.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('noMessages')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {t('startConversationHint')}
                  </p>
                  <Link
                    href="/urunler"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    <Package className="w-5 h-5" />
                    {t('exploreProducts')}
                  </Link>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={`${conv.otherUser.id}-${conv.product?.id || 'general'}`}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                  >
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className="flex-1 flex items-center gap-4 text-left"
                    >
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                          {conv.otherUser.image ? (
                            <img
                              src={conv.otherUser.image}
                              alt={conv.otherUser.name || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-white" />
                          )}
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white truncate">
                            {getDisplayName(conv.otherUser)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        </div>
                        {conv.product && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 truncate">
                            📦 {conv.product.title}
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          {/* Konuşma listesinde son mesaj okundu tiki */}
                          {conv.lastMessage.senderId === currentUserId && (
                            <span className="flex-shrink-0">
                              {conv.unreadCount === 0 ? (
                                <CheckCheck className="w-4 h-4 text-blue-500" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </span>
                          )}
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {conv.lastMessage.content}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Admin silme butonu */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm({ type: 'conversation', conv })
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title={t('deleteConversation')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            // Chat View
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-[calc(100vh-8rem)]"
            >
              {/* Chat Header */}
              <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedConversation(null)
                    // Konuşma listesini güncel çek
                    fetchConversationsSilent()
                  }}
                  className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                  {selectedConversation.otherUser.image ? (
                    <img
                      src={selectedConversation.otherUser.image}
                      alt={selectedConversation.otherUser.name || ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {getDisplayName(selectedConversation.otherUser)}
                  </h3>
                  {selectedConversation.product && (
                    <Link 
                      href={`/urun/${selectedConversation.product.id}`}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline truncate block"
                    >
                      📦 {selectedConversation.product.title}
                    </Link>
                  )}
                </div>
                {/* Engelle / Şikayet Et */}
                <BlockReportActions
                  targetUserId={selectedConversation.otherUser.id}
                  targetUserName={selectedConversation.otherUser.name || undefined}
                />
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 group ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Karşı tarafın avatarı — sol taraf */}
                      {msg.senderId !== currentUserId && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1">
                          {selectedConversation?.otherUser?.image ? (
                            <img 
                              src={selectedConversation.otherUser.image} 
                              alt="" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <User className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      )}
                      {/* Kendi mesajlarım için silme butonu solda */}
                      {isAdmin && msg.senderId === currentUserId && (
                        <button
                          onClick={() => setDeleteConfirm({ type: 'message', id: msg.id })}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                          title={t('deleteMessage')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                          msg.senderId === currentUserId
                            ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-br-md'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                        }`}
                      >
                        {/* GÖREV 29: Takas bilgisi badge'i — metadata bazlı kart */}
                        {(() => {
                          // Metadata parse et — güvenli yaklaşım
                          let parsedMeta: any = null
                          if (msg.metadata) {
                            try {
                              parsedMeta = JSON.parse(msg.metadata as string)
                            } catch {
                              parsedMeta = null
                            }
                          }

                          // Sadece gerçek takas sistem mesajlarını kart olarak göster
                          // metadata varsa type'a bak, yoksa 💜 ile başlayan içeriği kabul et
                          const isSwapSystemMsg =
                            parsedMeta?.type === 'swap_request' ||
                            (!parsedMeta && msg.content?.startsWith('💜'))

                          if (!isSwapSystemMsg || !msg.swapRequest?.product) return null

                          const statusMap: Record<string, string> = {
                            pending: '🟡 Beklemede',
                            negotiating: '🔄 Pazarlık',
                            accepted: '🟢 Kabul Edildi',
                            completed: '✅ Tamamlandı',
                            cancelled: '🔴 İptal',
                            rejected: '❌ Reddedildi',
                            in_transit: '📦 Yolda',
                            delivered: '📬 Teslim Edildi'
                          }

                          // Status fallback — boş görünmemesi için ⏳
                          const statusText = statusMap[msg.swapRequest?.status || ''] || '⏳'

                          return (
                            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 mb-2">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1">
                                  <span>💜</span>
                                  <span className="text-purple-300 text-xs font-semibold">Takas Talebi</span>
                                </div>
                                <span className="text-xs text-gray-400">{statusText}</span>
                              </div>
                              <p className="text-sm text-white font-medium mb-2">
                                {msg.swapRequest.product.title}
                              </p>
                              <Link
                                href="/takas-firsatlari"
                                className="block w-full bg-purple-600/50 hover:bg-purple-600 text-white text-center py-1.5 rounded-lg transition text-xs"
                              >
                                Takas Merkezine Git →
                              </Link>
                            </div>
                          )
                        })()}
                        <p className="text-sm">{msg.content}</p>
                        <div className={`flex items-center justify-end gap-0.5 mt-1 ${
                          msg.senderId === currentUserId ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          <span className="text-xs">
                            {formatTime(msg.createdAt)}
                          </span>
                          {/* ═══ OKUNDU TİKİ ═══ */}
                          <ReadReceipt message={msg} />
                        </div>
                      </div>
                      {/* Gelen mesajlar için silme butonu sağda */}
                      {isAdmin && msg.senderId !== currentUserId && (
                        <button
                          onClick={() => setDeleteConfirm({ type: 'message', id: msg.id })}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                          title={t('deleteMessage')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                {isCurrentUserBlocked && (
                  <p className="text-sm text-red-500 px-4 pb-2">
                    Bu kullanıcıyı engellediğiniz için mesaj gönderemezsiniz.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isCurrentUserBlocked
                      ? "Bu kullanıcıyı engellediğiniz için mesaj gönderemezsiniz"
                      : t('typeMessage')}
                    className={`flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isCurrentUserBlocked ? 'opacity-40 cursor-not-allowed resize-none' : ''}`}
                    disabled={sending || isCurrentUserBlocked}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending || isCurrentUserBlocked}
                    className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Silme Onay Modalı */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {deleteConfirm.type === 'message' ? t('deleteMessage') : t('deleteConversation')}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {deleteConfirm.type === 'message' 
                  ? t('deleteMessageConfirm')
                  : `${t('deleteConversationConfirmPrefix')}${deleteConfirm.conv?.otherUser.name}${t('deleteConversationConfirmSuffix')}`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirm.type === 'message' && deleteConfirm.id) {
                      handleDeleteMessage(deleteConfirm.id)
                    } else if (deleteConfirm.type === 'conversation' && deleteConfirm.conv) {
                      handleDeleteConversation(deleteConfirm.conv)
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
