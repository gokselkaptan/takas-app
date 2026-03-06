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

  // Mesajları yükle - swapRequestId ile filtreleme (GÖREV 28)
  const fetchMessages = useCallback(async () => {
    if (!otherUserId || !swapRequestId) {
      return
    }
    
    try {
      // GÖREV 28: swapRequestId ile sadece bu takasın mesajlarını çek
      const res = await fetch(`/api/messages?userId=${otherUserId}&swapRequestId=${swapRequestId}`)
      const data = await res.json()
      
      if (res.ok) {
        // API doğrudan array döndürüyor, data.messages değil
        const messagesArray = Array.isArray(data) ? data : (data.messages || [])
        setMessages(messagesArray)
        setError('')
      }
    } catch (err) {
      console.error('[SwapChat] fetchMessages error:', err)
    } finally {
      setLoading(false)
    }
  }, [swapRequestId])

  // İlk yükleme ve polling
  useEffect(() => {
    fetchMessages()
    
    // 30 saniyede bir yeni mesajları kontrol et - performans için
    pollInterval.current = setInterval(fetchMessages, 30000)
    
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [swapRequestId, fetchMessages])

  // Yeni mesaj gelince en alta scroll (block: 'nearest' sayfa zıplamasını önler)
  useEffect(() => {
    if (messagesEndRef.current && !showScrollButton) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [messages, showScrollButton])

  // Scroll pozisyonunu takip et
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  // En alta scroll (block: 'nearest' sayfa zıplamasını önler)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setShowScrollButton(false)
  }

  // Mesaj gönder
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    const trimmed = newMessage.trim()
    if (!trimmed || sending || !otherUserId) {
      return
    }
    
    setSending(true)
    setNewMessage('')
    
    try {
      const res = await safeFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: otherUserId,
          content: trimmed,
          swapRequestId: swapRequestId
        })
      })
      
      if (res.ok) {
        // Hemen yeni mesajları çek
        await fetchMessages()
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
      <div className={`flex items-center justify-center h-[350px] ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-violet-50 dark:bg-gray-900 rounded-xl border border-violet-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header - Mor tema */}
      <div className="flex items-center gap-3 px-4 py-3 bg-violet-600 text-white">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-violet-400 flex-shrink-0">
          {otherUserImage ? (
            <img src={otherUserImage} alt={otherUserName || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
              {otherUserName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{otherUserName || 'Kullanıcı'}</p>
          <p className="text-xs text-violet-200">Takas Mesajları</p>
        </div>
      </div>
      
      {/* Messages - Genişletilmiş alan */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[350px] max-h-[500px] md:min-h-[400px] md:max-h-[550px] bg-white dark:bg-gray-900"
      >
        {messages.length === 0 ? (
          <div className="text-center text-violet-600 dark:text-violet-400 py-12">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm font-medium">Henüz mesaj yok</p>
            <p className="text-xs mt-1 text-violet-500 dark:text-violet-500">Takas hakkında konuşmaya başlayın!</p>
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
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMe 
                    ? 'bg-violet-600 text-white rounded-br-sm' 
                    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100 rounded-bl-sm'
                }`}>
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <Image 
                        src={msg.imageUrl} 
                        alt="Mesajda paylaşılan görsel" 
                        width={200} 
                        height={150}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${
                    isMe ? 'text-violet-200' : 'text-violet-500 dark:text-violet-400'
                  }`}>
                    {formatTime(msg.createdAt)}
                    {isMe && (
                      <span className={`ml-1 text-xs ${msg.isRead ? 'text-blue-400' : 'text-gray-400'}`}>
                        {msg.isRead ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button - Mor tema */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 p-2 bg-violet-600 text-white rounded-full shadow-lg hover:bg-violet-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:bg-red-100 dark:hover:bg-red-800/30 rounded-full p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      
      {/* Input - Genişletilmiş ve mor tema */}
      <form onSubmit={sendMessage} className="p-3 border-t border-violet-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[72px]">
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
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
            className="flex-shrink-0 p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-violet-500 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-full transition-colors disabled:opacity-50"
          >
            {uploadingImage ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ImagePlus className="w-6 h-6" />
            )}
          </button>
          
          {/* Text input - Genişletilmiş */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesajınızı yazın..."
            className="flex-1 min-w-0 px-5 py-4 min-h-[48px] bg-violet-50 dark:bg-gray-800 border border-violet-300 dark:border-gray-600 rounded-full text-lg text-violet-900 dark:text-white placeholder-violet-400 dark:placeholder-gray-500 placeholder:text-base focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
            disabled={sending}
          />
          
          {/* Send button - Mor tema */}
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 p-3 min-h-[48px] min-w-[48px] flex items-center justify-center bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {sending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
