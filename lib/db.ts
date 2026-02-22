import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  lastConnectTime: number | undefined
}

// Build sırasında mı çalışıyoruz? (SSG paralel worker'ları için)
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                     process.env.__NEXT_TEST_MODE === '1'

// Connection pool ayarlarını DATABASE_URL'e ekle
function getDatabaseUrlWithPooling(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  
  // Eğer zaten pooling parametreleri varsa, olduğu gibi kullan
  if (baseUrl.includes('connection_limit') || baseUrl.includes('pool_timeout')) {
    return baseUrl
  }
  
  // Build sırasında daha agresif limitler kullan
  // Normal çalışmada biraz daha rahat limitler
  const connectionLimit = isBuildPhase ? 1 : 10
  const poolTimeout = isBuildPhase ? 60 : 20
  
  // Pooling parametrelerini ekle - idle timeout sorununu çözmek için
  // pgbouncer=true ile serverless ortamlar için optimize et
  // statement_cache_size=0 - prepared statement hatalarını önler
  // idle_in_transaction_session_timeout=10000 - 10 sn idle transaction timeout
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=10&socket_timeout=20&pgbouncer=true&statement_cache_size=0`
}

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrlWithPooling()
      }
    }
  })
  
  // Middleware ile bağlantı hatalarını handle et
  client.$use(async (params, next) => {
    const MAX_RETRIES = 5
    let retries = 0
    
    while (retries <= MAX_RETRIES) {
      try {
        const result = await next(params)
        // Başarılı sorgu - bağlantı zamanını güncelle
        globalForPrisma.lastConnectTime = Date.now()
        return result
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // idle-session timeout veya connection hatası ise retry yap
        const isConnectionError = 
          errorMessage.includes('idle-session timeout') ||
          errorMessage.includes('terminating connection') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('Connection refused') ||
          errorMessage.includes('connection closed') ||
          errorMessage.includes('socket') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('connection timed out') ||
          errorMessage.includes('prepared statement')
        
        if (isConnectionError && retries < MAX_RETRIES) {
          retries++
          console.log(`[Prisma] Connection error, retry ${retries}/${MAX_RETRIES}: ${errorMessage.substring(0, 100)}`)
          
          // 2. retry'dan itibaren bağlantıyı yeniden kur
          if (retries >= 2) {
            try {
              await client.$disconnect()
              await client.$connect()
              console.log('[Prisma] Reconnected successfully')
            } catch { /* devam et */ }
          }
          
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries - 1)))
          continue
        }
        throw error
      }
    }
  })
  
  return client
}

const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// Her ortamda global'e kaydet (singleton pattern)
globalForPrisma.prisma = prisma

// Graceful shutdown için bağlantı kapama
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

// ═══ KEEPALIVE — DB bağlantısını canlı tut ═══
// Her 4 dakikada bir basit sorgu atarak idle timeout'u önle
// (PostgreSQL varsayılan idle timeout genelde 5-10 dk)

let keepAliveInterval: NodeJS.Timeout | null = null

function startKeepAlive() {
  // Zaten çalışıyorsa tekrar başlatma
  if (keepAliveInterval) return
  
  // Build sırasında keepalive başlatma
  if (isBuildPhase) return
  
  keepAliveInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      // Sessiz başarı — log spam yapma
    } catch (error: any) {
      console.warn('[Prisma KeepAlive] Bağlantı hatası, yeniden bağlanılıyor:', 
        error.message?.substring(0, 80))
      // Prisma middleware otomatik retry yapacak
      try {
        await prisma.$connect()
        console.log('[Prisma KeepAlive] Yeniden bağlantı başarılı')
      } catch (reconnectError) {
        console.error('[Prisma KeepAlive] Yeniden bağlantı başarısız!')
      }
    }
  }, 2 * 60 * 1000) // 2 dakika - idle timeout'u önlemek için daha sık

  // Interval'ı unref et — process kapanmasını engellemsin
  keepAliveInterval.unref()
}

// Sunucu başladığında keepalive'ı başlat
if (typeof process !== 'undefined' && !isBuildPhase) {
  startKeepAlive()
}

export default prisma
