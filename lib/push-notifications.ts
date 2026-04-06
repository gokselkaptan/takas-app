import webpush from 'web-push'
import prisma from '@/lib/db'
import { sendFCMNotification } from './firebase-admin'
import { translations } from '@/lib/translations'

// VAPID ayarları
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.NEXTAUTH_URL || 'https://takas-a.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  data?: Record<string, any>
}

// Bildirim tipleri
export const NotificationTypes = {
  NEW_MESSAGE: 'new_message',
  SWAP_REQUEST: 'swap_request',
  SWAP_ACCEPTED: 'swap_accepted',
  SWAP_REJECTED: 'swap_rejected',
  SWAP_DELIVERY_SETUP: 'swap_delivery_setup',
  SWAP_QR_SCANNED: 'swap_qr_scanned',
  SWAP_CONFIRMED: 'swap_confirmed',
  SWAP_COMPLETED: 'swap_completed',
  SWAP_DISPUTE: 'swap_dispute',
  SWAP_REFUNDED: 'swap_refunded',
  SWAP_CANCELLED: 'swap_cancelled',
  MULTI_SWAP: 'multi_swap',
  MULTI_SWAP_INVITE: 'multi_swap_invite',
  MULTI_SWAP_CONFIRMED: 'multi_swap_confirmed',
  MULTI_SWAP_PROGRESS: 'multi_swap_progress',
  MULTI_SWAP_REJECTED: 'multi_swap_rejected',
  VALOR_RECEIVED: 'valor_received',
  PRODUCT_INTEREST: 'product_interest',
  SYSTEM: 'system',
  // Hatırlatma Bildirimleri (Faz 2)
  SWAP_REMINDER_24H: 'swap_reminder_24h',
  SWAP_REMINDER_8H: 'swap_reminder_8h',
  SWAP_REMINDER_2H: 'swap_reminder_2h',
  MULTI_SWAP_REMINDER_24H: 'multi_swap_reminder_24h',
  MULTI_SWAP_REMINDER_8H: 'multi_swap_reminder_8h',
  MULTI_SWAP_REMINDER_2H: 'multi_swap_reminder_2h',
  DELIVERY_REMINDER_48H: 'delivery_reminder_48h',
  DELIVERY_REMINDER_24H: 'delivery_reminder_24h',
  DELIVERY_REMINDER_6H: 'delivery_reminder_6h',
  // Dispute Sistemi (Faz 2)
  DISPUTE_EVIDENCE_REQUEST: 'dispute_evidence_request',
  DISPUTE_EVIDENCE_SUBMITTED: 'dispute_evidence_submitted',
  DISPUTE_SETTLEMENT_OFFER: 'dispute_settlement_offer',
  DISPUTE_SETTLEMENT_ACCEPTED: 'dispute_settlement_accepted',
  DISPUTE_DEADLINE_WARNING: 'dispute_deadline_warning',
  // Pazarlık Bildirimleri
  COUNTER_OFFER: 'counter_offer',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_REJECTED: 'offer_rejected'
} as const

// SW için bildirim türü eşleştirmesi
export function mapNotificationTypeToSW(type: string): string {
  const mapping: Record<string, string> = {
    [NotificationTypes.NEW_MESSAGE]: 'new_message',
    [NotificationTypes.SWAP_REQUEST]: 'swap_request',
    [NotificationTypes.SWAP_ACCEPTED]: 'swap_accepted',
    [NotificationTypes.SWAP_REJECTED]: 'swap_rejected',
    [NotificationTypes.SWAP_COMPLETED]: 'swap_completed',
    [NotificationTypes.SWAP_CANCELLED]: 'swap_cancelled',
    [NotificationTypes.VALOR_RECEIVED]: 'valor_received',
    [NotificationTypes.PRODUCT_INTEREST]: 'product_interest',
    [NotificationTypes.MULTI_SWAP]: 'multi_swap',
    [NotificationTypes.MULTI_SWAP_INVITE]: 'multi_swap_invite',
    [NotificationTypes.SYSTEM]: 'system',
    [NotificationTypes.COUNTER_OFFER]: 'counter_offer',
    [NotificationTypes.OFFER_ACCEPTED]: 'offer_accepted',
    [NotificationTypes.OFFER_REJECTED]: 'offer_rejected'
  }
  return mapping[type] || 'general'
}

// Bildirim şablonları
export const notificationTemplates: Record<string, (data: any) => PushPayload> = {
  [NotificationTypes.NEW_MESSAGE]: (data) => ({
    title: 'Yeni Mesaj 💬',
    body: `${data.senderName}: ${data.preview}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=messages',
    tag: `message-${data.conversationId}`
  }),
  
  [NotificationTypes.SWAP_REQUEST]: (data) => ({
    title: 'Yeni Takas Teklifi 🔄',
    body: `${data.requesterName} "${data.productTitle}" için takas teklifi gönderdi`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=offers',
    tag: `swap-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_ACCEPTED]: (data) => ({
    title: 'Takas Kabul Edildi ✅',
    body: `"${data.productTitle}" için takas teklifiniz kabul edildi!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=swaps`,
    tag: `swap-accepted-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_REJECTED]: (data) => ({
    title: 'Takas Teklifi Reddedildi ❌',
    body: `"${data.productTitle}" için takas teklifiniz reddedildi. Teminatınız iade edildi.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=offers`,
    tag: `swap-rejected-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_DELIVERY_SETUP]: (data) => ({
    title: 'Teslimat Ayarlandı 📦',
    body: `"${data.productTitle}" için teslimat ayarlandı. QR kodunu kullanarak ürünü teslim alabilirsiniz.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=swaps`,
    tag: `swap-delivery-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_QR_SCANNED]: (data) => ({
    title: 'QR Kod Tarandı 📱',
    body: `"${data.productTitle}" için QR kod tarandı. Ürün teslim alındı olarak işaretlendi.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=swaps`,
    tag: `swap-qr-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_CONFIRMED]: (data) => ({
    title: 'Teslimat Onaylandı ✅',
    body: `"${data.productTitle}" teslimatı ${data.confirmerName} tarafından onaylandı.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=swaps`,
    tag: `swap-confirmed-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_COMPLETED]: (data) => ({
    title: 'Takas Tamamlandı 🎉',
    body: `Tebrikler! "${data.productTitle}" takası başarıyla tamamlandı.${data.valorAmount ? ` +${data.valorAmount} Valor kazandınız!` : ''}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `swap-complete-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_DISPUTE]: (data) => ({
    title: 'Sorun Bildirildi ⚠️',
    body: `"${data.productTitle}" takası için ${data.reporterName} sorun bildirdi: ${data.reason}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil?tab=swaps`,
    tag: `swap-dispute-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_REFUNDED]: (data) => ({
    title: 'Teminat İade Edildi 💰',
    body: `"${data.productTitle}" takası iptal edildi. Teminatınız hesabınıza iade edildi.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/profil`,
    tag: `swap-refunded-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_CANCELLED]: (data) => ({
    title: 'Takas İptal Edildi ❌',
    body: `"${data.productTitle}" takası iptal edildi. ${data.reason || ''}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/takaslarim`,
    tag: `swap-cancelled-${data.swapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP]: (data) => ({
    title: 'Çoklu Takas Fırsatı! 🔥',
    body: `${data.participantCount} kişilik bir takas zinciri sizi bekliyor!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_INVITE]: (data) => ({
    title: '🔄 Çoklu Takas Daveti!',
    body: `${data.initiatorName} sizi ${data.participantCount} kişilik bir takas zincirine davet etti. 48 saat içinde yanıt verin!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-invite-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_CONFIRMED]: (data) => ({
    title: '✅ Çoklu Takas Onaylandı!',
    body: `${data.participantCount} kişilik takas herkes tarafından onaylandı! Teslim detayları için uygulamayı kontrol edin.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-confirmed-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_PROGRESS]: (data) => ({
    title: '👍 Takas Onayı Alındı',
    body: `${data.confirmerName} takası onayladı. ${data.remainingCount} kişi daha bekleniyor.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-progress-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_REJECTED]: (data) => ({
    title: '❌ Çoklu Takas İptal Edildi',
    body: `${data.rejecterName} çoklu takas teklifini reddetti.${data.reason ? ` Sebep: ${data.reason}` : ''}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-rejected-${data.multiSwapId}`
  }),
  
  [NotificationTypes.VALOR_RECEIVED]: (data) => ({
    title: 'Valor Kazandınız! 💎',
    body: `+${data.amount} Valor hesabınıza eklendi. ${data.reason}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil',
    tag: `valor-${Date.now()}`
  }),
  
  [NotificationTypes.PRODUCT_INTEREST]: (data) => ({
    title: 'Ürününüz İlgi Görüyor! 👀',
    body: `"${data.productTitle}" ürününüz ${data.viewCount} kez görüntülendi`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/urun/${data.productId}`,
    tag: `interest-${data.productId}`
  }),
  
  [NotificationTypes.SYSTEM]: (data) => ({
    title: data.title || 'TAKAS-A',
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: data.url || '/',
    tag: `system-${Date.now()}`
  }),
  
  // Hatırlatma Bildirimleri (Faz 2)
  [NotificationTypes.SWAP_REMINDER_24H]: (data) => ({
    title: '⏰ Takas Hatırlatması - 24 Saat Kaldı',
    body: `"${data.productTitle}" için takas teklifinize ${data.hoursLeft} saat içinde yanıt verin!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=offers',
    tag: `swap-reminder-24h-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_REMINDER_8H]: (data) => ({
    title: '⚠️ Acil: Sadece 8 Saat Kaldı!',
    body: `"${data.productTitle}" takas teklifine yanıt vermeyi unutmayın. Aksi halde otomatik iptal olacak!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=offers',
    tag: `swap-reminder-8h-${data.swapId}`
  }),
  
  [NotificationTypes.SWAP_REMINDER_2H]: (data) => ({
    title: '🚨 Son 2 Saat! Kararınızı Verin',
    body: `"${data.productTitle}" takas teklifi 2 saat içinde sona erecek! Hemen değerlendirin.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=offers',
    tag: `swap-reminder-2h-${data.swapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_REMINDER_24H]: (data) => ({
    title: '⏰ Çoklu Takas - 24 Saat Kaldı',
    body: `${data.participantCount} kişilik takas zincirine katılım için ${data.hoursLeft} saat kaldı!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-reminder-24h-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_REMINDER_8H]: (data) => ({
    title: '⚠️ Çoklu Takas - 8 Saat Kaldı!',
    body: `Takas zinciri onayınızı bekleniyor. Onaylamazsanız ${data.participantCount} kişilik zincir iptal olacak!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-reminder-8h-${data.multiSwapId}`
  }),
  
  [NotificationTypes.MULTI_SWAP_REMINDER_2H]: (data) => ({
    title: '🚨 Son 2 Saat! Takas Zinciri Bekleniyor',
    body: `Onayınız olmadan ${data.participantCount} kişilik takas zinciri iptal olacak. Hemen onaylayın!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/takas-firsatlari',
    tag: `multi-swap-reminder-2h-${data.multiSwapId}`
  }),
  
  [NotificationTypes.DELIVERY_REMINDER_48H]: (data) => ({
    title: '📦 Teslimat Hatırlatması',
    body: `"${data.productTitle}" için teslimat ${data.hoursLeft} saat içinde yapılmalı. QR kodunuz hazır!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `delivery-reminder-48h-${data.swapId}`
  }),
  
  [NotificationTypes.DELIVERY_REMINDER_24H]: (data) => ({
    title: '⚠️ Teslimat İçin 24 Saat!',
    body: `"${data.productTitle}" teslimatı yarın sona eriyor. Teslimat noktasında buluşmayı unutmayın!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `delivery-reminder-24h-${data.swapId}`
  }),
  
  [NotificationTypes.DELIVERY_REMINDER_6H]: (data) => ({
    title: '🚨 Son 6 Saat! Teslimat Acil',
    body: `"${data.productTitle}" teslimatı 6 saat içinde yapılmazsa takas iptal edilecek!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `delivery-reminder-6h-${data.swapId}`
  }),
  
  // Dispute Bildirimleri (Faz 2)
  [NotificationTypes.DISPUTE_EVIDENCE_REQUEST]: (data) => ({
    title: '📸 Kanıt Yükleme Gerekli',
    body: `"${data.productTitle}" için açılan sorun kaydına 48 saat içinde kanıt yükleyin.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `dispute-evidence-${data.disputeId}`
  }),
  
  [NotificationTypes.DISPUTE_EVIDENCE_SUBMITTED]: (data) => ({
    title: '✅ Kanıt Yüklendi',
    body: `${data.submitterName} sorun kaydına kanıt yükledi. İnceleme başladı.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `dispute-evidence-submitted-${data.disputeId}`
  }),
  
  [NotificationTypes.DISPUTE_SETTLEMENT_OFFER]: (data) => ({
    title: '🤝 Uzlaşma Teklifi',
    body: `"${data.productTitle}" için uzlaşma teklifi: ${data.offerDescription}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `dispute-settlement-${data.disputeId}`
  }),
  
  [NotificationTypes.DISPUTE_SETTLEMENT_ACCEPTED]: (data) => ({
    title: '✅ Uzlaşma Kabul Edildi',
    body: `"${data.productTitle}" için uzlaşma sağlandı. ${data.resolution}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `dispute-settlement-accepted-${data.disputeId}`
  }),
  
  [NotificationTypes.DISPUTE_DEADLINE_WARNING]: (data) => ({
    title: '⚠️ Kanıt Süresi Doluyor',
    body: `"${data.productTitle}" için kanıt yükleme süreniz ${data.hoursLeft} saat içinde dolacak!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/profil?tab=swaps',
    tag: `dispute-deadline-${data.disputeId}`
  }),

  // Pazarlık Bildirimleri
  [NotificationTypes.COUNTER_OFFER]: (data) => ({
    title: '💰 Yeni Karşı Teklif',
    body: `${data.userName} size ${data.proposedPrice} V karşı teklif gönderdi`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/takas-firsatlari?swapId=${data.swapRequestId}`,
    tag: `counter-offer-${data.swapRequestId}`
  }),

  [NotificationTypes.OFFER_ACCEPTED]: (data) => ({
    title: '✅ Teklif Kabul Edildi',
    body: `${data.userName} ${data.proposedPrice} V teklifinizi kabul etti`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/takas-firsatlari?swapId=${data.swapRequestId}`,
    tag: `offer-accepted-${data.swapRequestId}`
  }),

  [NotificationTypes.OFFER_REJECTED]: (data) => ({
    title: '❌ Teklif Reddedildi',
    body: `${data.userName} teklifinizi reddetti`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: `/takas-firsatlari?swapId=${data.swapRequestId}`,
    tag: `offer-rejected-${data.swapRequestId}`
  })
}

// Notification type → translation key mapping
const notificationTypeToTranslationKey: Record<string, string> = {
  [NotificationTypes.NEW_MESSAGE]: 'newMessage',
  [NotificationTypes.SWAP_REQUEST]: 'swapRequest',
  [NotificationTypes.SWAP_ACCEPTED]: 'swapAccepted',
  [NotificationTypes.SWAP_REJECTED]: 'swapRejected',
  [NotificationTypes.SWAP_COMPLETED]: 'swapCompleted',
  [NotificationTypes.SWAP_CANCELLED]: 'swapCancelled',
  [NotificationTypes.COUNTER_OFFER]: 'counterOffer',
  [NotificationTypes.OFFER_ACCEPTED]: 'offerAccepted',
  [NotificationTypes.OFFER_REJECTED]: 'offerRejected',
  [NotificationTypes.SWAP_DELIVERY_SETUP]: 'deliverySetup',
  [NotificationTypes.SWAP_CONFIRMED]: 'deliveryConfirmed',
  [NotificationTypes.SWAP_QR_SCANNED]: 'qrScanned',
  [NotificationTypes.VALOR_RECEIVED]: 'valorReceived',
  [NotificationTypes.MULTI_SWAP_INVITE]: 'multiSwapInvite',
  [NotificationTypes.MULTI_SWAP_CONFIRMED]: 'multiSwapConfirmed',
  [NotificationTypes.MULTI_SWAP_REJECTED]: 'multiSwapRejected',
}

// Çok dilli bildirim metni oluştur
function getNotificationText(
  type: string,
  language: string,
  data: Record<string, any>
): { title: string; body: string } | null {
  const translationKey = notificationTypeToTranslationKey[type]
  if (!translationKey) return null

  const lang = (['tr', 'en', 'es', 'ca'].includes(language) ? language : 'tr') as keyof typeof translations
  const langTranslations = translations[lang] as any
  const template = langTranslations?.notification?.[translationKey]

  if (!template) return null

  let title = template.title || ''
  let body = template.body || ''

  // Replace placeholders with actual data
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      title = title.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
      body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
    })
  }

  return { title, body }
}

// Tek kullanıcıya bildirim gönder
export async function sendPushToUser(
  userId: string,
  type: string,
  data: Record<string, any>,
  language?: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    // Kullanıcının bilgilerini ve aktif subscription'larını al
    const [user, subscriptions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, language: true }
      }),
      prisma.pushSubscription.findMany({
        where: { userId, isActive: true }
      })
    ])
    
    // Okunmamış mesaj sayısını hesapla (badge için)
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    })
    
    // Bildirim içeriğini oluştur
    const template = notificationTemplates[type]
    if (!template) {
      console.error(`Unknown notification type: ${type}`)
      return { success: false, sent: 0, failed: 0 }
    }
    
    const basePayload = template(data)
    
    // Dil tercihi varsa ve Türkçe değilse, çeviri kullan
    const userLang = language || user?.language || 'tr'
    if (userLang !== 'tr') {
      const translatedText = getNotificationText(type, userLang, data)
      if (translatedText) {
        basePayload.title = translatedText.title
        basePayload.body = translatedText.body
      }
    }
    
    let sent = 0
    let failed = 0
    
    // FCM ile gönder (Android uygulama kapalıyken bile çalışır) - badge ile
    if (user?.fcmToken) {
      const fcmSent = await sendFCMNotification(
        user.fcmToken,
        basePayload.title,
        basePayload.body,
        basePayload.url || '/',
        unreadCount
      )
      if (fcmSent) {
        sent++
      } else {
        // Token geçersizse DB'den temizle
        await prisma.user.update({
          where: { id: userId },
          data: { fcmToken: null }
        }).catch(() => {})
      }
    }
    
    // Web Push subscription yoksa sadece FCM sonucunu döndür
    if (subscriptions.length === 0) {
      return { success: true, sent, failed }
    }
    
    // VAPID ile de gönder (fallback) - badge ile
    const payload = {
      ...basePayload,
      type: mapNotificationTypeToSW(type),
      badge: unreadCount,
      data: {
        ...data,
        notificationType: type,
        timestamp: Date.now(),
        badge: unreadCount
      }
    }
    const payloadString = JSON.stringify(payload)
    
    // Mobil için optimize edilmiş push seçenekleri
    const pushOptions = {
      TTL: 60, // 60 saniye içinde iletilmezse iptal
      urgency: 'high' as const, // Yüksek öncelik (mobilde hızlı iletim)
      topic: type // Aynı türde bildirimleri grupla
    }
    
    // Her subscription'a paralel gönder (hız için)
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payloadString,
          pushOptions
        )
        return { success: true, subId: sub.id }
      } catch (error: any) {
        // Subscription artık geçerli değilse deaktive et
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false }
          })
        }
        console.error(`Push notification failed for ${sub.id}:`, error.message)
        return { success: false, subId: sub.id }
      }
    })
    
    const results = await Promise.allSettled(sendPromises)
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++
      } else {
        failed++
      }
    }
    
    // Save notification to database
    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          payload: data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : {},
          language: language || user?.language || 'tr'
        }
      })
    } catch (e) {
      console.error('[Notification] DB save error:', e)
    }

    return { success: true, sent, failed }
  } catch (error) {
    console.error('sendPushToUser error:', error)
    return { success: false, sent: 0, failed: 0 }
  }
}

// Birden fazla kullanıcıya bildirim gönder
export async function sendPushToUsers(
  userIds: string[],
  type: string,
  data: Record<string, any>
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
  let totalSent = 0
  let totalFailed = 0
  
  for (const userId of userIds) {
    const result = await sendPushToUser(userId, type, data)
    totalSent += result.sent
    totalFailed += result.failed
  }
  
  return { success: true, totalSent, totalFailed }
}

// Tüm kullanıcılara bildirim gönder (broadcast)
export async function sendPushBroadcast(
  type: string,
  data: Record<string, any>
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
  try {
    // FCM token olan kullanıcıları al
    const fcmUsers = await prisma.user.findMany({
      where: { fcmToken: { not: null } },
      select: { id: true }
    })
    
    // PushSubscription (VAPID) olan kullanıcıları al
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { isActive: true },
      select: { userId: true }
    })
    
    // Tüm user ID'leri birleştir (unique)
    const fcmUserIds = fcmUsers.map(u => u.id)
    const vapidUserIds = subscriptions.map((s: { userId: string }) => s.userId)
    const uniqueUserIds = [...new Set([...fcmUserIds, ...vapidUserIds])] as string[]
    
    return sendPushToUsers(uniqueUserIds, type, data)
  } catch (error) {
    console.error('sendPushBroadcast error:', error)
    return { success: false, totalSent: 0, totalFailed: 0 }
  }
}
