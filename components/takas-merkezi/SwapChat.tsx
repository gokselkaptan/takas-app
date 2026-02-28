'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Send, ImagePlus, Loader2, X, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Message } from '@/lib/takas-merkezi-types'
import { safeFetch } from '@/lib/safe-fetch'

interface SwapChatProps {
  swapRequestId: string
  otherUserId: string
  otherUserName: string | null
  otherUserImage?: string | null
  className?: string
}

export function SwapChat({ 
  swapRequestId, 
  otherUserId, 
  otherUserName,
  otherUserImage,
  className = '' 
}: SwapChatProps) {
  // DEBUG: Props'ları logla
  console.log('[SwapChat] Props:', { swapRequestId, otherUserId, otherUserName })
  
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  
  const currentUserId = (session?.user as any)?.id

  // Mesajları yükle
  const fetchMessages = useCallback(async () => {
    console.log('[SwapChat] fetchMessages called')
    if (!otherUserId) {
      console.log('[SwapChat] fetchMessages skipped - no otherUserId')
      return
    }
    
    try {
      const res = await fetch(`/api/messages?userId=${otherUserId}`)
      console.log('[SwapChat] fetchMessages response status:', res.status)
      const data = await res.json()
      console.log('[SwapChat] fetchMessages data:', data)
      
      if (res.ok) {
        // API doğrudan array döndürüyor, data.messages değil
        const messagesArray = Array.isArray(data) ? data : (data.messages || [])
        console.log('[SwapChat] Setting messages:', messagesArray.length)
        setMessages(messagesArray)
        setError('')
      }
    } catch (err) {
      console.error('[SwapChat] fetchMessages error:', err)
    } finally {
      setLoading(false)
    }
  }, [otherUserId])

  // İlk yükleme ve polling
  useEffect(() => {
    fetchMessages()
    
    // 10 saniyede bir yeni mesajları kontrol et
    pollInterval.current = setInterval(fetchMessages, 10000)
    
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [fetchMessages])

  // Yeni mesaj gelince en alta scroll
  useEffect(() => {
    if (messagesEndRef.current && !showScrollButton) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showScrollButton])

  // Scroll pozisyonunu takip et
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  // En alta scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollButton(false)
  }

  // Mesaj gönder
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    console.log('[SwapChat] sendMessage called:', { otherUserId, content: newMessage })
    
    const trimmed = newMessage.trim()
    if (!trimmed || sending || !otherUserId) {
      console.log('[SwapChat] Skipping - empty/sending/no userId:', { trimmed: !!trimmed, sending, otherUserId })
      return
    }
    
    setSending(true)
    setNewMessage('')
    
    try {
      console.log('[SwapChat] Sending API request to /api/messages...')
      const res = await safeFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: otherUserId,
          content: trimmed,
          swapRequestId: swapRequestId
        })
      })
      
      console.log('[SwapChat] API response:', { ok: res.ok, status: res.status, data: res.data, error: res.error })
      
      if (res.ok) {
        // Hemen yeni mesajları çek
        console.log('[SwapChat] Calling fetchMessages after send...')
        await fetchMessages()
        console.log('[SwapChat] fetchMessages completed after send')
        scrollToBottom()
      } else {
        setError(res.data?.error || res.error || 'Mesaj gönderilemedi')
        setNewMessage(trimmed) // Mesajı geri koy
      }
    } catch (err) {
      console.error('[SwapChat] Send error:', err)
      setError('Bağlantı hatası')
      setNewMessage(trimmed)
    } finally {
      setSending(false)
    }
  }

  // Fotoğraf yükle ve gönder
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu 5MB\'dan küçük olmalı')
      return
    }
    
    setUploadingImage(true)
    
    try {
      // Presigned URL al
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          folder: 'messages'
        })
      })
      
      if (!presignRes.ok) throw new Error('Upload hazırlama hatası')
      
      const { uploadUrl, fileUrl } = await presignRes.json()
      
      // S3'e yükle
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })
      
      // Mesaj olarak gönder
      const res = await safeFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: otherUserId,
          content: '🖼️ Fotoğraf',
          imageUrl: fileUrl,
          swapRequestId: swapRequestId
        })
      })
      
      if (res.ok) {
        await fetchMessages()
        scrollToBottom()
      }
    } catch (err) {
      console.error('[SwapChat] Fotoğraf yükleme hatası:', err)
      setError('Fotoğraf yüklenemedi')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Zaman formatı
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    
    if (mins < 1) return 'Az önce'
    if (mins < 60) return `${mins}dk`
    
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}s`
    
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-frozen-500" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
          {otherUserImage ? (
            <Image src={otherUserImage} alt={otherUserName || ''} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-medium">
              {otherUserName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{otherUserName || 'Kullanıcı'}</p>
          <p className="text-xs text-gray-500">Takas mesajları</p>
        </div>
      </div>
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">💬 Henüz mesaj yok</p>
            <p className="text-xs mt-1">Takas hakkında konuşmaya başlayın!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isMe 
                    ? 'bg-frozen-500 text-white rounded-br-md' 
                    : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md'
                }`}>
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <Image 
                        src={msg.imageUrl} 
                        alt="" 
                        width={200} 
                        height={150}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${
                    isMe ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.createdAt)}
                    {isMe && msg.read && ' ✓✓'}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 right-4 p-2 bg-frozen-500 text-white rounded-full shadow-lg"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-3 h-3" /></button>
        </div>
      )}
      
      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* Image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2 text-gray-500 hover:text-frozen-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            {uploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>
          
          {/* Text input */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesaj yazın..."
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-frozen-500"
            disabled={sending}
          />
          
          {/* Send button */}
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2 bg-frozen-500 text-white rounded-full hover:bg-frozen-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
