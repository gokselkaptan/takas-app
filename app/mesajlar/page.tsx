'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, ArrowLeft, Loader2, User, Package, Trash2, AlertTriangle } from 'lucide-react'
import { getDisplayName } from '@/lib/display-name'
import { safeGet, safePost, isOffline } from '@/lib/safe-fetch'
import { playMessageSound } from '@/lib/notification-sounds'
import { useLanguage } from '@/lib/language-context'

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
}

const ADMIN_EMAIL = 'join@takas-a.com'

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
  const [authReady, setAuthReady] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'message' | 'conversation', id?: string, conv?: Conversation } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevUnreadCountRef = useRef<number>(0)
  
  const isAdmin = session?.user?.email === ADMIN_EMAIL

  // Tek useEffect ile auth ve veri çekme
  useEffect(() => {
    // 1. next-auth henüz yükleniyorsa bekle
    if (status === 'loading') return

    // 2. Giriş yapılmamışsa yönlendir
    if (status === 'unauthenticated') {
      router.replace('/giris')
      return
    }

    // 3. Giriş yapılmış → veri çek (API kendi session kontrolünü yapıyor)
    if (status === 'authenticated') {
      setAuthReady(true)
      fetchConversations()
    }
  }, [status])

  // Mesaj scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // URL'den gelen userId parametresiyle direkt konuşma aç
  useEffect(() => {
    const targetUserId = searchParams.get('userId')
    const targetProductId = searchParams.get('productId')
    const targetProductTitle = searchParams.get('productTitle')
    
    if (!targetUserId || !session?.user) return
    
    // Mevcut konuşmalarda bu kullanıcı var mı?
    const existingConv = conversations.find(
      c => c.otherUser.id === targetUserId && 
        (!targetProductId || c.product?.id === targetProductId)
    )
    
    if (existingConv) {
      // Mevcut konuşmayı aç
      handleSelectConversation(existingConv)
    } else if (!loading && conversations.length >= 0) {
      // Yeni konuşma oluştur — geçici conversation objesi
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
      // Mesaj geçmişi yoksa boş bırak
      setMessages([])
      setLoadingMessages(false)
    }
  }, [searchParams, conversations, session, loading])

  const fetchConversations = async () => {
    // Offline kontrolü
    if (isOffline()) {
      setError('İnternet bağlantınız yok')
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, ok, error, status } = await safeGet('/api/messages', { timeout: 15000 })
      
      if (ok && data) {
        const convList = data.conversations || data || []
        const conversationList = Array.isArray(convList) ? convList : []
        // Toplam okunmamış mesaj sayısını hesapla
        const totalUnread = conversationList.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0)
        // Yeni mesaj geldiğinde ses çal
        if (totalUnread > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
          playMessageSound()
        }
        prevUnreadCountRef.current = totalUnread
        setConversations(conversationList)
      } else if (status === 401) {
        router.replace('/giris')
      } else {
        setError(error || 'Konuşmalar yüklenemedi')
      }
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (otherUserId: string, productId?: string) => {
    if (isOffline()) return
    
    setLoadingMessages(true)
    try {
      const params = new URLSearchParams({ otherUserId })
      if (productId) params.append('productId', productId)
      
      const { data, ok } = await safeGet(`/api/messages?${params}`, { timeout: 12000 })
      if (ok && data) {
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    fetchMessages(conv.otherUser.id, conv.product?.id)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return
    
    if (isOffline()) {
      setError('İnternet bağlantınız yok')
      return
    }

    setSending(true)
    try {
      const { data, ok, error } = await safePost('/api/messages', {
        receiverId: selectedConversation.otherUser.id,
        productId: selectedConversation.product?.id,
        content: newMessage.trim()
      }, { timeout: 10000, retries: 1 })

      if (ok && data) {
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
      } else {
        console.error('Mesaj gönderilemedi:', error)
      }
    } catch (err) {
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

  // Session kontrol - auth loading iken skeleton göster
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
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className="flex-1 flex items-center gap-4 text-left"
                    >
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                          {conv.otherUser.image ? (
                            <Image
                              src={conv.otherUser.image}
                              alt={conv.otherUser.name || ''}
                              width={56}
                              height={56}
                              className="object-cover"
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
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                          {conv.lastMessage.content}
                        </p>
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
                  onClick={() => setSelectedConversation(null)}
                  className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                  {selectedConversation.otherUser.image ? (
                    <Image
                      src={selectedConversation.otherUser.image}
                      alt={selectedConversation.otherUser.name || ''}
                      width={40}
                      height={40}
                      className="object-cover"
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
                      className={`flex items-end gap-2 group ${msg.senderId === (session?.user as any)?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Karşı tarafın avatarı — sol taraf */}
                      {msg.senderId !== (session?.user as any)?.id && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1">
                          {selectedConversation?.otherUser?.image ? (
                            <Image 
                              src={selectedConversation.otherUser.image} 
                              alt="" 
                              width={28} 
                              height={28} 
                              className="object-cover w-full h-full" 
                            />
                          ) : (
                            <User className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      )}
                      {/* Kendi mesajlarım için silme butonu solda */}
                      {isAdmin && msg.senderId === (session?.user as any)?.id && (
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
                          msg.senderId === (session?.user as any)?.id
                            ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-br-md'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <span className={`text-xs mt-1 block ${
                          msg.senderId === (session?.user as any)?.id ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      {/* Gelen mesajlar için silme butonu sağda */}
                      {isAdmin && msg.senderId !== (session?.user as any)?.id && (
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('typeMessage')}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
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
