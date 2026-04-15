'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Send, ImagePlus, Loader2, X, ChevronDown, Check, CheckCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Message } from '@/lib/takas-merkezi-types'
import { safeFetch } from '@/lib/safe-fetch'
import { useLanguage } from '@/lib/language-context'
import { SwapCommunicationHeader } from './SwapCommunicationHeader'
import { SwapSystemCard } from './SwapSystemCard'
import { Analytics } from '@/lib/analytics'
import { SHAPES } from '@/lib/utils'

// Sistem mesajı prefix listesi (legacy fallback için)
const SYSTEM_PREFIXES = ['💜', '💰', '🤝', '✅', '🟢', '🔵', '🎉', '❌', '🔴', '📅', '📦', '🔑', '⚙️', '🔄']

// Content'ten type inferring (backward compatibility)
const inferTypeFromContent = (content: string): string | undefined => {
  if (content.startsWith('💜')) return 'swap_request'
  if (content.startsWith('💰')) return 'price_proposal'
  if (content.startsWith('🤝')) return 'price_agreed'
  if (content.startsWith('✅')) return 'swap_accepted'
  if (content.startsWith('🟢')) return 'swap_accepted'
  if (content.startsWith('🔵')) return 'swap_confirmed'
  if (content.startsWith('🎉')) return 'swap_completed'
  if (content.startsWith('❌')) return 'swap_rejected'
  if (content.startsWith('🔴')) return 'swap_cancelled'
  if (content.startsWith('📅')) return 'delivery_date_proposal'
  if (content.startsWith('📦')) return 'delivery_date_accepted'
  if (content.startsWith('🔑')) return 'verification_code'
  // Text-based fallbacks (negotiate sistem mesajları)
  if (content.includes('karşı teklif')) return 'price_proposal'
  if (content.includes('kabul etti')) return 'price_agreed'
  if (content.includes('reddetti')) return 'swap_rejected'
  return undefined
}

interface SwapChatProps {
  swapRequestId: string
  otherUserId: string
  otherUserName: string | null
  otherUserImage?: string | null
  productTitle?: string | null
  status?: string | null
  className?: string
}

export function SwapChat({ 
  swapRequestId, 
  otherUserId, 
  otherUserName,
  otherUserImage,
  productTitle,
  status,
  className = '' 
}: SwapChatProps) {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [selectedShapes, setSelectedShapes] = useState<string[]>([])
  const [generatedShapeCode, setGeneratedShapeCode] = useState('')
  const [shapeCodeExpiry, setShapeCodeExpiry] = useState('')
  const [shapeCodeLoading, setShapeCodeLoading] = useState(false)
  const [shapeCodeVerifying, setShapeCodeVerifying] = useState(false)
  const [shapeCodeAttemptsLeft, setShapeCodeAttemptsLeft] = useState<number | null>(null)
  const [shapeCodeMessage, setShapeCodeMessage] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  
  const currentUserId = (session?.user as any)?.id

  // Mesajları yükle - swapRequestId ile filtreleme
  const fetchMessages = useCallback(async (silent = false) => {
    if (!otherUserId || !swapRequestId) return
    
    try {
      const res = await fetch(`/api/messages?userId=${otherUserId}&swapRequestId=${swapRequestId}`)
      const data = await res.json()
      
      if (res.ok) {
        const messagesArray = Array.isArray(data) ? data : (data.messages || [])
        
        if (silent) {
          // Sessiz güncelleme - sadece değişiklik varsa state güncelle
          setMessages(prev => {
            if (messagesArray.length !== prev.length || 
                (messagesArray.length > 0 && prev.length > 0 && 
                 messagesArray[messagesArray.length - 1]?.id !== prev[prev.length - 1]?.id) ||
                messagesArray.some((m: any, i: number) => prev[i] && m.isRead !== prev[i].isRead)) {
              return messagesArray
            }
            return prev
          })
        } else {
          setMessages(messagesArray)
        }
        setError('')
      }
    } catch (err) {
      if (!silent) console.error('[SwapChat] fetchMessages error:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [otherUserId, swapRequestId])

  // Chat açıldığında analytics event
  useEffect(() => {
    if (swapRequestId) {
      Analytics.chatOpened(swapRequestId)
    }
  }, [swapRequestId])

  // İlk yükleme ve polling (5 saniye - daha hızlı güncelleme)
  useEffect(() => {
    fetchMessages()
    
    pollInterval.current = setInterval(() => fetchMessages(true), 5000)
    
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [fetchMessages])

  // Yeni mesaj gelince en alta scroll
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setShowScrollButton(false)
  }

  // ═══ OPTİMİSTİK MESAJ GÖNDERME ═══
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    const trimmed = newMessage.trim()
    if (!trimmed || sending || !otherUserId) return
    
    const tempId = 'temp-' + Date.now()
    
    // 🚀 Optimistic update - mesajı ANINDA göster
    const tempMessage: Message = {
      id: tempId,
      content: trimmed,
      senderId: currentUserId,
      receiverId: otherUserId,
      createdAt: new Date().toISOString(),
      isRead: false,
      read: false,
    } as any
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')
    scrollToBottom()
    
    setSending(true)
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
        // Temp mesajı gerçek mesajla değiştir
        const realMessage = res.data?.message || res.data
        if (realMessage) {
          setMessages(prev => 
            prev.map(msg => msg.id === tempId ? { ...realMessage } : msg)
          )
        } else {
          // Fallback: tüm mesajları yeniden çek
          await fetchMessages(true)
        }
      } else {
        // Hata: temp mesajı kaldır, içeriği geri koy
        setMessages(prev => prev.filter(msg => msg.id !== tempId))
        setNewMessage(trimmed)
        setError(res.data?.error || res.error || 'Mesaj gönderilemedi')
      }
    } catch (err) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      setNewMessage(trimmed)
      setError('Bağlantı hatası')
    } finally {
      setSending(false)
    }
  }

  // Fotoğraf yükle ve gönder
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu 5MB\'dan küçük olmalı')
      return
    }
    
    setUploadingImage(true)
    
    try {
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
      
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })
      
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
        await fetchMessages(true)
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

  const handleSelectShape = (shape: string) => {
    setShapeCodeMessage('')
    setSelectedShapes(prev => {
      if (prev.length >= 5) return prev
      return [...prev, shape]
    })
  }

  const clearSelectedShapes = () => {
    setSelectedShapes([])
    setShapeCodeMessage('')
  }

  const handleGenerateShapeCode = async () => {
    setShapeCodeLoading(true)
    setShapeCodeMessage('')

    try {
      const response = await safeFetch('/api/swap-requests/shape-code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId })
      })

      if (!response.ok) {
        setShapeCodeMessage(response.data?.error || t('shapeCodeGenerateError'))
        return
      }

      setGeneratedShapeCode(response.data?.shapeCode || '')
      setShapeCodeExpiry(response.data?.shapeCodeExpiry || '')
      setShapeCodeAttemptsLeft(response.data?.maxAttempts || 3)
      setShapeCodeMessage(t('shapeCodeGeneratedSuccess'))
      setSelectedShapes([])
    } catch (err) {
      setShapeCodeMessage(t('shapeCodeGenerateError'))
    } finally {
      setShapeCodeLoading(false)
    }
  }

  const handleVerifyShapeCode = async () => {
    if (selectedShapes.length !== 5 || shapeCodeVerifying) return

    setShapeCodeVerifying(true)
    setShapeCodeMessage('')

    try {
      const code = selectedShapes.join('')
      const response = await safeFetch('/api/swap-requests/shape-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId,
          code,
        })
      })

      if (!response.ok) {
        setShapeCodeAttemptsLeft(response.data?.attemptsLeft ?? null)
        setShapeCodeMessage(response.data?.error || t('shapeCodeVerifyError'))
        return
      }

      setShapeCodeMessage(t('shapeCodeVerifiedSuccess'))
      setSelectedShapes([])
      setGeneratedShapeCode('')
      setShapeCodeExpiry('')
      setShapeCodeAttemptsLeft(null)
      await fetchMessages(true)
    } catch (err) {
      setShapeCodeMessage(t('shapeCodeVerifyError'))
    } finally {
      setShapeCodeVerifying(false)
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

  // ═══ OKUNDU TİKİ KOMPONENTİ ═══
  const ReadReceipt = ({ msg }: { msg: any }) => {
    if (msg.senderId !== currentUserId) return null
    
    // Temp mesaj
    if (msg.id?.startsWith?.('temp-')) {
      return <Loader2 className="w-3 h-3 animate-spin text-violet-200 ml-1 inline" />
    }
    
    if (msg.isRead || msg.read) {
      return <CheckCheck className="w-4 h-4 text-blue-300 ml-1 inline" />
    }
    
    return <Check className="w-3.5 h-3.5 text-violet-300 ml-1 inline" />
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
      {/* Takas İletişimi Başlığı */}
      <div className="px-4 pt-3">
        <SwapCommunicationHeader
          productTitle={productTitle}
          otherUserName={otherUserName}
          otherUserImage={otherUserImage}
          status={status}
        />
      </div>

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
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 md:pb-0 min-h-[350px] max-h-[500px] md:min-h-[400px] md:max-h-[550px] bg-white dark:bg-gray-900"
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

            // Tek seferinde parse et
            let parsedMeta: any = null
            if (msg.metadata) {
              try {
                parsedMeta = JSON.parse(msg.metadata as string)
              } catch {}
            }

            // Legacy fallback: metadata yoksa prefix'e bak
            const isLegacySystemMsg =
              !parsedMeta && SYSTEM_PREFIXES.some(prefix => msg.content?.startsWith(prefix))

            // metaType mapping: negotiate action → SwapSystemCard type
            const metaType =
              parsedMeta?.type === 'system'
                ? (
                    parsedMeta?.action === 'counter_offer' ? 'price_proposal'
                    : parsedMeta?.action === 'offer_accepted' ? 'price_agreed'
                    : parsedMeta?.action === 'offer_rejected' ? 'swap_rejected'
                    : parsedMeta?.action
                  )
                : parsedMeta?.type

            const systemMsg =
              (parsedMeta?.type && parsedMeta.type !== 'location') ||
              isLegacySystemMsg

            if (systemMsg) {
              return (
                <SwapSystemCard
                  key={msg.id}
                  content={msg.content}
                  type={metaType || inferTypeFromContent(msg.content)}
                  createdAt={msg.createdAt}
                />
              )
            }

            // Normal kullanıcı mesajı
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
                      <img
                        src={msg.imageUrl}
                        alt=""
                        className="object-cover"
                        style={{ width: 200, height: 150 }}
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center justify-end gap-0.5 mt-1 ${
                    isMe ? 'text-violet-200' : 'text-violet-500 dark:text-violet-400'
                  }`}>
                    <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                    {/* ═══ OKUNDU TİKİ ═══ */}
                    <ReadReceipt msg={msg} />
                  </div>
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
            className="absolute bottom-24 right-4 p-2 bg-violet-600 text-white rounded-full shadow-lg hover:bg-violet-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Shape Code */}
      <div className="px-4 py-3 border-t border-violet-200 dark:border-gray-700 bg-violet-50/70 dark:bg-gray-800/70 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-100">{t('shapeCodeTitle')}</p>
            <p className="text-xs text-violet-600 dark:text-violet-300">{t('shapeCodeDescription')}</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateShapeCode}
            disabled={shapeCodeLoading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {shapeCodeLoading ? t('loading') : t('shapeCodeGenerate')}
          </button>
        </div>

        {generatedShapeCode && (
          <div className="rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-gray-900 px-3 py-2">
            <p className="text-xs text-violet-600 dark:text-violet-300">{t('shapeCodeShareHint')}</p>
            <p className="text-lg tracking-wide mt-1">{generatedShapeCode}</p>
            {shapeCodeExpiry && (
              <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-1">
                {t('shapeCodeExpiryInfo')} {new Date(shapeCodeExpiry).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-6 gap-2">
          {SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => handleSelectShape(shape)}
              disabled={selectedShapes.length >= 5}
              className="h-10 rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-gray-900 text-xl hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50"
            >
              {shape}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-violet-300 dark:border-violet-700 px-3 py-2 min-h-10 text-center text-xl">
          {selectedShapes.length > 0 ? selectedShapes.join('') : '• • • • •'}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearSelectedShapes}
            className="px-3 py-2 text-xs rounded-lg border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-200"
          >
            {t('shapeCodeClear')}
          </button>
          <button
            type="button"
            onClick={handleVerifyShapeCode}
            disabled={selectedShapes.length !== 5 || shapeCodeVerifying}
            className="px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {shapeCodeVerifying ? t('sending') : t('shapeCodeVerify')}
          </button>
        </div>

        {shapeCodeAttemptsLeft !== null && (
          <p className="text-xs text-violet-600 dark:text-violet-300">{t('shapeCodeAttemptsLeft')}: {shapeCodeAttemptsLeft}</p>
        )}
        {shapeCodeMessage && (
          <p className="text-xs text-violet-700 dark:text-violet-200">{shapeCodeMessage}</p>
        )}
      </div>
      
      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:bg-red-100 dark:hover:bg-red-800/30 rounded-full p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      
      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-violet-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[72px]">
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
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
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesajınızı yazın..."
            className="flex-1 min-w-0 px-5 py-4 min-h-[48px] bg-violet-50 dark:bg-gray-800 border border-violet-300 dark:border-gray-600 rounded-full text-lg text-violet-900 dark:text-white placeholder-violet-400 dark:placeholder-gray-500 placeholder:text-base focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
            disabled={sending}
          />
          
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