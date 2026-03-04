import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
}

// Singleton pattern - tüm ortamlarda tek instance
const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// Bağlantı hatası durumunda yeniden bağlan
prisma.$connect().catch((e) => {
  console.error('Prisma bağlantı hatası:', e)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
