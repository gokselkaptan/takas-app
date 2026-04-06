'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

interface Notification {
  id: string
  userId: string
  type: string
  payload: Record<string, any>
  language: string
  read: boolean
  readAt: string | null
  createdAt: string
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

// Type'a göre icon mapping
const getNotificationIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    NEW_MESSAGE: '💬',
    SWAP_REQUEST: '🔄',
    SWAP_ACCEPTED: '✅',
    SWAP_REJECTED: '❌',
    SWAP_COMPLETED: '🎉',
    SWAP_CANCELLED: '🚫',
    COUNTER_OFFER: '💰',
    OFFER_ACCEPTED: '🤝',
    OFFER_REJECTED: '❌',
    DELIVERY_DATE_PROPOSED: '📅',
    DELIVERY_DATE_ACCEPTED: '📦',
    QR_GENERATED: '🔐',
    QR_SCANNED: '🔐',
    VALOR_RECEIVED: '💎',
    MULTI_SWAP_INVITE: '🔥',
    QUESTION_ASKED: '❓',
    QUESTION_ANSWERED: '💡',
    FOLLOW: '👤',
    WISHBOARD_MATCH: '🎯',
  }
  return iconMap[type] || '🔔'
}

// Relative time formatter
const getRelativeTime = (dateString: string, lang: string): string => {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (lang === 'tr') {
    if (diffSec < 60) return 'Az önce'
    if (diffMin < 60) return `${diffMin} dk önce`
    if (diffHour < 24) return `${diffHour} sa önce`
    if (diffDay < 7) return `${diffDay} gün önce`
    return date.toLocaleDateString('tr-TR')
  }
  if (lang === 'es') {
    if (diffSec < 60) return 'Ahora mismo'
    if (diffMin < 60) return `hace ${diffMin} min`
    if (diffHour < 24) return `hace ${diffHour} h`
    if (diffDay < 7) return `hace ${diffDay} días`
    return date.toLocaleDateString('es-ES')
  }
  if (lang === 'ca') {
    if (diffSec < 60) return 'Ara mateix'
    if (diffMin < 60) return `fa ${diffMin} min`
    if (diffHour < 24) return `fa ${diffHour} h`
    if (diffDay < 7) return `fa ${diffDay} dies`
    return date.toLocaleDateString('ca-ES')
  }
  // en default
  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US')
}

// Notification text generator from payload
const getNotificationText = (notification: Notification, lang: string): string => {
  const { type, payload } = notification

  // payload'dan metin çıkar
  if (payload?.title) return payload.title as string
  if (payload?.message) return payload.message as string

  if (payload?.userName && payload?.proposedPrice) {
    return lang === 'tr'
      ? `${payload.userName} size ${payload.proposedPrice} V karşı teklif gönderdi`
      : `${payload.userName} sent you a counter offer of ${payload.proposedPrice} V`
  }
  if (payload?.userName && payload?.productTitle) {
    return `${payload.userName} — ${payload.productTitle}`
  }
  if (payload?.userName) {
    return payload.userName as string
  }

  // Type bazlı fallback
  const fallbackMap: Record<string, Record<string, string>> = {
    NEW_MESSAGE: { tr: 'Yeni mesajınız var', en: 'You have a new message', es: 'Tienes un nuevo mensaje', ca: 'Tens un missatge nou' },
    SWAP_REQUEST: { tr: 'Yeni takas teklifi aldınız', en: 'New swap request', es: 'Nueva solicitud de intercambio', ca: 'Nova sol·licitud d\'intercanvi' },
    SWAP_ACCEPTED: { tr: 'Takasınız kabul edildi', en: 'Your swap was accepted', es: 'Tu intercambio fue aceptado', ca: 'El teu intercanvi ha estat acceptat' },
    SWAP_REJECTED: { tr: 'Takasınız reddedildi', en: 'Your swap was rejected', es: 'Tu intercambio fue rechazado', ca: 'El teu intercanvi ha estat rebutjat' },
    SWAP_COMPLETED: { tr: 'Takasınız tamamlandı', en: 'Swap completed', es: 'Intercambio completado', ca: 'Intercanvi completat' },
    SWAP_CANCELLED: { tr: 'Takas iptal edildi', en: 'Swap cancelled', es: 'Intercambio cancelado', ca: 'Intercanvi cancel·lat' },
    COUNTER_OFFER: { tr: 'Yeni karşı teklif aldınız', en: 'New counter offer', es: 'Nueva contraoferta', ca: 'Nova contraoferta' },
    OFFER_ACCEPTED: { tr: 'Teklifiniz kabul edildi', en: 'Your offer was accepted', es: 'Tu oferta fue aceptada', ca: 'La teva oferta ha estat acceptada' },
    OFFER_REJECTED: { tr: 'Teklifiniz reddedildi', en: 'Your offer was rejected', es: 'Tu oferta fue rechazada', ca: 'La teva oferta ha estat rebutjada' },
    DELIVERY_DATE_PROPOSED: { tr: 'Teslimat tarihi önerildi', en: 'Delivery date proposed', es: 'Fecha de entrega propuesta', ca: 'Data de lliurament proposada' },
    DELIVERY_DATE_ACCEPTED: { tr: 'Teslimat tarihi onaylandı', en: 'Delivery date confirmed', es: 'Fecha de entrega confirmada', ca: 'Data de lliurament confirmada' },
    QR_GENERATED: { tr: 'QR kodunuz hazır', en: 'Your QR code is ready', es: 'Tu código QR está listo', ca: 'El teu codi QR està llest' },
    QR_SCANNED: { tr: 'QR kod tarandı', en: 'QR code scanned', es: 'Código QR escaneado', ca: 'Codi QR escanejat' },
    VALOR_RECEIVED: { tr: 'Valor kazandınız', en: 'You earned Valor', es: 'Has ganado Valor', ca: 'Has guanyat Valor' },
    MULTI_SWAP_INVITE: { tr: 'Çoklu takas davetiniz var', en: 'Multi-swap invitation', es: 'Invitación a intercambio múltiple', ca: 'Invitació a intercanvi múltiple' },
  }

  const fb = fallbackMap[type]
  if (fb) return fb[lang] || fb.en || fb.tr
  return lang === 'tr' ? 'Yeni bildiriminiz var' : 'New notification'
}

// Get deep link URL from notification payload
const getNotificationUrl = (notification: Notification): string | null => {
  const p = notification.payload
  if (p?.url) return p.url as string
  if (p?.swapRequestId) return `/takas-firsatlari?swapId=${p.swapRequestId}`
  if (p?.swapId) return `/takas-firsatlari?swapId=${p.swapId}`
  if (p?.productId) return `/urun/${p.productId}`
  if (p?.messageThreadId) return `/mesajlar?thread=${p.messageThreadId}`
  return null
}

const uiTexts: Record<string, Record<string, string>> = {
  title: { tr: 'Bildirimler', en: 'Notifications', es: 'Notificaciones', ca: 'Notificacions' },
  markAllRead: { tr: 'Tümünü okundu yap', en: 'Mark all as read', es: 'Marcar todo como leído', ca: 'Marca-ho tot com a llegit' },
  processing: { tr: 'İşleniyor...', en: 'Processing...', es: 'Procesando...', ca: 'Processant...' },
  loadError: { tr: 'Bildirimler yüklenemedi', en: 'Failed to load notifications', es: 'No se pudieron cargar las notificaciones', ca: 'No s\'han pogut carregar les notificacions' },
  retry: { tr: 'Tekrar dene', en: 'Try again', es: 'Intentar de nuevo', ca: 'Torna-ho a provar' },
  empty: { tr: 'Henüz bildirimin yok', en: 'No notifications yet', es: 'Sin notificaciones aún', ca: 'Encara no tens notificacions' },
}

export function NotificationCenter({ isOpen, onClose, onUnreadCountChange }: NotificationCenterProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { language } = useLanguage()

  const txt = (key: string) => uiTexts[key]?.[language] || uiTexts[key]?.en || ''

  // Fetch notifications
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(false)
      const response = await fetch('/api/notifications')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setNotifications(data.notifications || [])
      const count = data.unreadCount || 0
      setUnreadCount(count)
      onUnreadCountChange?.(count)
    } catch (err) {
      console.error('Notification fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      setMarkingRead(true)
      const response = await fetch('/api/notifications/read', {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to mark as read')

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
      onUnreadCountChange?.(0)
    } catch (err) {
      console.error('Mark as read error:', err)
    } finally {
      setMarkingRead(false)
    }
  }

  // Handle notification click — mark as read + deep link
  const handleNotificationClick = useCallback(async (notification: Notification) => {
    // Mark single notification as read
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'PATCH'
        })
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true, readAt: new Date().toISOString() } : n)
        )
        const newCount = Math.max(0, unreadCount - 1)
        setUnreadCount(newCount)
        onUnreadCountChange?.(newCount)
      } catch (e) {
        console.error('Mark single read error:', e)
      }
    }

    // Deep link navigation
    const url = getNotificationUrl(notification)
    if (url) {
      onClose()
      router.push(url)
    }
  }, [unreadCount, onClose, onUnreadCountChange, router])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      // Delay to avoid immediate close from the bell click itself
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] md:relative md:inset-auto">
      {/* Mobile backdrop */}
      <div className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed md:absolute top-0 right-0 md:top-full md:right-0 md:mt-2 w-full md:w-96 h-full md:h-auto md:max-h-[600px] bg-white dark:bg-slate-800 md:rounded-xl md:shadow-2xl border-l md:border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{txt('title')}</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Mark all as read button */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
            <button
              onClick={markAllAsRead}
              disabled={markingRead}
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {markingRead ? txt('processing') : txt('markAllRead')}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <p className="text-sm">{txt('loadError')}</p>
              <button
                onClick={fetchNotifications}
                className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
              >
                {txt('retry')}
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">🔔</span>
              <p className="text-sm">{txt('empty')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                        {getNotificationText(notification, language)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {getRelativeTime(notification.createdAt, language)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
