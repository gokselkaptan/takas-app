/**
 * Otomatik hata raporlama sistemi
 * Client-side hataları backend'e gönderir
 */

export async function reportError(error: {
  type: string
  message: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  userId?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: error.type,
        message: error.message,
        severity: error.severity || 'error',
        userId: error.userId,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        metadata: error.metadata ? JSON.stringify(error.metadata) : undefined,
      })
    })
  } catch {
    // Hata raporlama başarısız — sessiz geç
    console.error('Error reporter failed:', error.message)
  }
}

// Global error handler - uygulama başlatılırken çağrılabilir
export function setupGlobalErrorHandler() {
  if (typeof window === 'undefined') return
  
  window.onerror = (message, source, lineno, colno, error) => {
    reportError({
      type: 'uncaught_error',
      message: String(message),
      severity: 'error',
      metadata: { source, lineno, colno, stack: error?.stack }
    })
  }
  
  window.onunhandledrejection = (event) => {
    reportError({
      type: 'unhandled_rejection',
      message: String(event.reason),
      severity: 'error',
      metadata: { reason: event.reason }
    })
  }
}
