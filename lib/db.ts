import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Build sırasında mı çalışıyoruz?
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                     process.env.__NEXT_TEST_MODE === '1'

// Serverless için optimize edilmiş DATABASE_URL
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  
  // Zaten parametreler varsa olduğu gibi kullan
  if (baseUrl.includes('connection_limit')) return baseUrl
  
  // Serverless için minimal connection - her request yeni connection
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=1&connect_timeout=10`
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl()
      }
    }
  })
}

// Development'ta global singleton, production'da her import yeni instance
const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
