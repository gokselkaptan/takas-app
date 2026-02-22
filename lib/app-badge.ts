/**
 * App Badge API - PWA ana ekran ikonunda bildirim sayısı gösterir
 * https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
 * 
 * Desteklenen platformlar:
 * - Android (Chrome 81+)
 * - iOS (Safari 16.4+ PWA modunda)
 * - Windows (Edge, Chrome)
 * - macOS (Safari 17+, Chrome)
 */

const APP_BADGE_ENABLED_KEY = 'app-badge-enabled'

/**
 * Badge API'nin desteklenip desteklenmediğini kontrol eder
 */
export function isAppBadgeSupported(): boolean {
  return 'setAppBadge' in navigator && 'clearAppBadge' in navigator
}

/**
 * Kullanıcının badge ayarını alır (localStorage'dan)
 */
export function isAppBadgeEnabled(): boolean {
  if (typeof window === 'undefined') return true // SSR'da varsayılan açık
  const stored = localStorage.getItem(APP_BADGE_ENABLED_KEY)
  // Varsayılan olarak açık
  return stored === null ? true : stored === 'true'
}

/**
 * Badge ayarını kaydeder
 */
export function setAppBadgeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(APP_BADGE_ENABLED_KEY, String(enabled))
  
  // Kapatıldığında badge'i temizle
  if (!enabled) {
    clearAppBadge()
  }
}

/**
 * Ana ekran ikonunda badge sayısını ayarlar
 */
export async function setAppBadge(count: number): Promise<boolean> {
  if (typeof window === 'undefined') return false
  
  // Badge devre dışıysa işlem yapma
  if (!isAppBadgeEnabled()) {
    return false
  }
  
  // API desteklenmiyor
  if (!isAppBadgeSupported()) {
    console.log('[AppBadge] API desteklenmiyor')
    return false
  }
  
  try {
    if (count > 0) {
      // @ts-ignore - Navigator type doesn't include setAppBadge yet
      await navigator.setAppBadge(count)
      console.log('[AppBadge] Badge ayarlandı:', count)
    } else {
      // 0 veya negatif sayıda badge'i temizle
      // @ts-ignore
      await navigator.clearAppBadge()
      console.log('[AppBadge] Badge temizlendi')
    }
    return true
  } catch (error) {
    console.error('[AppBadge] Hata:', error)
    return false
  }
}

/**
 * Badge'i temizler
 */
export async function clearAppBadge(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  
  if (!isAppBadgeSupported()) {
    return false
  }
  
  try {
    // @ts-ignore
    await navigator.clearAppBadge()
    console.log('[AppBadge] Badge temizlendi')
    return true
  } catch (error) {
    console.error('[AppBadge] Temizleme hatası:', error)
    return false
  }
}

/**
 * Badge sayısını günceller - okunmamış mesaj + bekleyen takas sayısı
 */
export async function updateAppBadgeCount(unreadMessages: number, pendingSwaps: number): Promise<void> {
  const total = unreadMessages + pendingSwaps
  await setAppBadge(total)
}
