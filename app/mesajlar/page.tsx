'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, ArrowLeft, Loader2, User, Package } from 'lucide-react'
import { getDisplayName } from '@/lib/display-name'

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

export default function MesajlarPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Client-side mount check
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && status === 'unauthenticated') {
      router.push('/giris')
    }
  }, [status, router, mounted])

  useEffect(() => {
    if (session?.user) {
      fetchConversations()
    } else if (mounted && status === 'authenticated') {
      // Session user yoksa ama authenticated ise hızlı empty state göster
      setLoading(false)
    }
  }, [session, mounted, status])

  // Session yoksa 1.5 saniye sonra yüklemeyi bitir (empty state göster)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && mounted) {
        setLoading(false)
      }
    }, 1500)
    return () => clearTimeout(timeout)
  }, [loading, mounted])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      // AbortController ile timeout ekle
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000) // 5 saniye timeout
      
      const res = await fetch('/api/messages', { 
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      })
      clearTimeout(timeout)
      
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request timed out')
      } else {
        console.error('Konuşmalar yüklenemedi:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (otherUserId: string, productId?: string) => {
    try {
      setLoadingMessages(true)
      const params = new URLSearchParams({ otherUserId })
      if (productId) params.append('productId', productId)
      
      const res = await fetch(`/api/messages?${params}`)
      if (res.ok) {
        const data = await res.json()
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

    try {
      setSending(true)
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          productId: selectedConversation.product?.id,
          content: newMessage.trim()
        })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error)
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

  // Daha hızlı yükleme - sadece gerçek loading durumunda skeleton göster
  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen pt-16 pb-24 bg-gray-50 dark:bg-gray-900">
        {/* Skeleton Loading - Hızlı görsel feedback */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-6 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Mesajlarım</h1>
                <p className="text-white/80 text-sm">Yükleniyor...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl animate-pulse">
              <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Loading state - Çok kısa göster ve hemen empty state'e geç
  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Mesajlar yükleniyor...</span>
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
                <h1 className="text-2xl font-bold">Mesajlarım</h1>
                <p className="text-white/80 text-sm">{conversations.length} konuşma</p>
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
                    Henüz mesaj yok
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Bir ürüne ilgi gösterdiğinde mesajlaşma başlar!
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
                conversations.map((conv) => (
                  <button
                    key={`${conv.otherUser.id}-${conv.product?.id || 'general'}`}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
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
                      className={`flex ${msg.senderId === (session?.user as any)?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
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
                    placeholder="Mesajınızı yazın..."
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
    </div>
  )
}
