// lib/analytics.ts
declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void
  }
}

// Ana event tracking fonksiyonu
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return
  if (window.clarity) {
    window.clarity('event', eventName)
    // Properties varsa set ile ekle
    if (properties) {
      Object.entries(properties).forEach(([key, value]) => {
        window.clarity?.('set', key, String(value))
      })
    }
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', eventName, properties)
  }
}

// Kullanıcı tanımlama
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (typeof window === 'undefined') return
  if (window.clarity) {
    window.clarity('identify', userId)
    if (traits) {
      Object.entries(traits).forEach(([key, value]) => {
        window.clarity?.('set', key, String(value))
      })
    }
  }
}

// Önceden tanımlı event'ler
export const Analytics = {
  // Ürün
  productViewed: (productId: string, category?: string) =>
    trackEvent('product_viewed', { productId, category }),

  productAdded: (productId: string, category?: string, valorPrice?: number) =>
    trackEvent('product_added', { productId, category, valorPrice }),

  // Takas akışı
  swapInitiated: (productId: string, valorAmount?: number) =>
    trackEvent('swap_initiated', { productId, valorAmount }),

  offerAccepted: (swapRequestId: string) =>
    trackEvent('offer_accepted', { swapRequestId }),

  offerRejected: (swapRequestId: string) =>
    trackEvent('offer_rejected', { swapRequestId }),

  counterOfferSent: (swapRequestId: string, counterPrice?: number) =>
    trackEvent('counter_offer_sent', { swapRequestId, counterPrice }),

  swapCompleted: (swapRequestId: string) =>
    trackEvent('swap_completed', { swapRequestId }),

  swapCancelled: (swapRequestId: string) =>
    trackEvent('swap_cancelled', { swapRequestId }),

  // Chat
  chatOpened: (swapRequestId: string) =>
    trackEvent('chat_opened', { swapRequestId }),

  messageSent: (swapRequestId: string) =>
    trackEvent('message_sent', { swapRequestId }),

  // Deep link
  deepLinkOpened: (swapId: string) =>
    trackEvent('deep_link_opened', { swapId }),

  // Teslimat
  deliveryDateProposed: (swapRequestId: string) =>
    trackEvent('delivery_date_proposed', { swapRequestId }),

  deliveryDateAccepted: (swapRequestId: string) =>
    trackEvent('delivery_date_accepted', { swapRequestId }),

  qrGenerated: (swapRequestId: string) =>
    trackEvent('qr_generated', { swapRequestId }),

  qrScanned: (swapRequestId: string) =>
    trackEvent('qr_scanned', { swapRequestId }),

  // Kullanıcı
  userRegistered: () => trackEvent('user_registered'),
  userLoggedIn: () => trackEvent('user_logged_in'),
}
