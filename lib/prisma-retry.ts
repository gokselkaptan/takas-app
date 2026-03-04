import prisma from '@/lib/db'

// Prisma sorguları için retry wrapper
// idle-session timeout hatalarında otomatik yeniden deneme
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      // Connection/timeout hatalarında retry
      const isRetryable = 
        error?.code === 'P1017' || // Connection closed
        error?.code === 'P2024' || // Timed out
        error?.message?.includes('idle-session timeout') ||
        error?.message?.includes('Connection') ||
        error?.message?.includes('terminating')
      
      if (!isRetryable || attempt === maxRetries) {
        throw error
      }
      
      // Bekleme süresi exponential backoff
      const waitTime = delayMs * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      // Prisma bağlantısını yeniden kur
      try {
        await prisma.$disconnect()
        await prisma.$connect()
      } catch {
        // Bağlantı hatası sessizce geç
      }
    }
  }
  
  throw lastError
}
