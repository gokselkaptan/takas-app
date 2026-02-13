import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
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
  const connectionLimit = isBuildPhase ? 1 : 3
  const poolTimeout = isBuildPhase ? 60 : 30
  
  // Pooling parametrelerini ekle
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=30`
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrlWithPooling()
      }
    }
  })
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

export default prisma
