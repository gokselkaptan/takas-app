/**
 * Safe Fetch Wrapper - Tüm API çağrıları için otomatik koruma
 * - Timeout (varsayılan 10sn)
 * - Retry (varsayılan 2 deneme)
 * - Offline detection
 * - Anlaşılır hata mesajları
 * - Otomatik hata raporlama (500+ hatalar)
 */

import { reportError } from './error-reporter'

export interface SafeFetchOptions extends RequestInit {
  timeout?: number       // ms cinsinden, varsayılan 10000
  retries?: number       // deneme sayısı, varsayılan 2
  retryDelay?: number    // ms cinsinden, varsayılan 1000
  showOfflineToast?: boolean
}

export interface SafeFetchResult<T = any> {
  data: T | null
  error: string | null
  status: number
  ok: boolean
  isOffline: boolean
  isTimeout: boolean
}

// Offline durumunu kontrol et
export function isOffline(): boolean {
  if (typeof window === 'undefined') return false
  return !navigator.onLine
}

// Türkçe hata mesajları
const ERROR_MESSAGES = {
  OFFLINE: 'İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin.',
  TIMEOUT: 'Sunucu yanıt vermedi. Lütfen tekrar deneyin.',
  SERVER_ERROR: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.',
  NETWORK_ERROR: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
  UNAUTHORIZED: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
  FORBIDDEN: 'Bu işlem için yetkiniz yok.',
  NOT_FOUND: 'İstenen kaynak bulunamadı.',
  RATE_LIMITED: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
  UNKNOWN: 'Beklenmeyen bir hata oluştu.'
}

// Status koduna göre hata mesajı
function getErrorMessage(status: number, fallback?: string): string {
  switch (status) {
    case 401: return ERROR_MESSAGES.UNAUTHORIZED
    case 403: return ERROR_MESSAGES.FORBIDDEN
    case 404: return ERROR_MESSAGES.NOT_FOUND
    case 429: return ERROR_MESSAGES.RATE_LIMITED
    case 500:
    case 502:
    case 503:
    case 504: return ERROR_MESSAGES.SERVER_ERROR
    default: return fallback || ERROR_MESSAGES.UNKNOWN
  }
}

// Tek bir fetch denemesi
async function attemptFetch<T>(
  url: string,
  options: SafeFetchOptions,
  timeout: number
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      }
    })
    
    clearTimeout(timeoutId)
    
    let data: T | null = null
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    }
    
    if (!response.ok) {
      const errorMsg = (data as any)?.error || (data as any)?.message || getErrorMessage(response.status)
      
      // 500+ hatalarını otomatik raporla
      if (response.status >= 500) {
        reportError({
          type: 'api_error',
          message: `API ${response.status}: ${url}`,
          severity: 'error',
          metadata: { url, status: response.status, errorMsg }
        })
      }
      
      return {
        data: null,
        error: errorMsg,
        status: response.status,
        ok: false,
        isOffline: false,
        isTimeout: false
      }
    }
    
    return {
      data,
      error: null,
      status: response.status,
      ok: true,
      isOffline: false,
      isTimeout: false
    }
    
  } catch (err: any) {
    clearTimeout(timeoutId)
    
    // Timeout kontrolü
    if (err.name === 'AbortError') {
      return {
        data: null,
        error: ERROR_MESSAGES.TIMEOUT,
        status: 0,
        ok: false,
        isOffline: false,
        isTimeout: true
      }
    }
    
    // Network hatası
    return {
      data: null,
      error: ERROR_MESSAGES.NETWORK_ERROR,
      status: 0,
      ok: false,
      isOffline: isOffline(),
      isTimeout: false
    }
  }
}

// Ana safeFetch fonksiyonu
export async function safeFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    ...fetchOptions
  } = options
  
  // Offline kontrolü
  if (isOffline()) {
    return {
      data: null,
      error: ERROR_MESSAGES.OFFLINE,
      status: 0,
      ok: false,
      isOffline: true,
      isTimeout: false
    }
  }
  
  let lastResult: SafeFetchResult<T> | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    // İlk denemeden sonra bekle
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      
      // Retry öncesi tekrar offline kontrolü
      if (isOffline()) {
        return {
          data: null,
          error: ERROR_MESSAGES.OFFLINE,
          status: 0,
          ok: false,
          isOffline: true,
          isTimeout: false
        }
      }
    }
    
    lastResult = await attemptFetch<T>(url, fetchOptions, timeout)
    
    // Başarılı veya retry yapılmaması gereken durumlar
    if (lastResult.ok) return lastResult
    if (lastResult.status === 401) return lastResult // Auth hatası retry yapma
    if (lastResult.status === 403) return lastResult // Yetki hatası retry yapma
    if (lastResult.status === 404) return lastResult // Not found retry yapma
    if (lastResult.status === 429) return lastResult // Rate limit retry yapma
  }
  
  return lastResult!
}

// Kısa yardımcı fonksiyonlar
export async function safeGet<T = any>(url: string, options?: SafeFetchOptions): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, { ...options, method: 'GET' })
}

export async function safePost<T = any>(url: string, body?: any, options?: SafeFetchOptions): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  })
}

export async function safePatch<T = any>(url: string, body?: any, options?: SafeFetchOptions): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined
  })
}

export async function safeDelete<T = any>(url: string, options?: SafeFetchOptions): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, { ...options, method: 'DELETE' })
}

// Hook için wrapper (client-side)
export function createSafeFetcher() {
  return {
    get: safeGet,
    post: safePost,
    patch: safePatch,
    delete: safeDelete,
    fetch: safeFetch,
    isOffline
  }
}

// Toast entegrasyonlu fetch (opsiyonel)
export async function safeFetchWithToast<T = any>(
  url: string,
  options: SafeFetchOptions & { 
    showErrorToast?: boolean
    toastFn?: (message: string, type: 'error' | 'success') => void 
  } = {}
): Promise<SafeFetchResult<T>> {
  const { showErrorToast = true, toastFn, ...fetchOptions } = options
  const result = await safeFetch<T>(url, fetchOptions)
  
  if (!result.ok && showErrorToast && toastFn) {
    toastFn(result.error || 'Bir hata oluştu', 'error')
  }
  
  return result
}

export default safeFetch
