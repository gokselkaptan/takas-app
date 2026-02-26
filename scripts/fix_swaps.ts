import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // dropped_off durumundaki eski swap'ı iptal et
  const oldSwapId = 'cmly2chfq000bmp085zrsxhqr'
  
  const result = await prisma.swapRequest.update({
    where: { id: oldSwapId },
    data: { status: 'cancelled' }
  })
  
  console.log('Eski swap iptal edildi:', result.id, result.status)
  
  // Güncel durumu kontrol et
  const küllükSwaps = await prisma.swapRequest.findMany({
    where: {
      productId: 'cmly2bo120007mp0893ggl0wj'
    },
    select: { id: true, status: true, createdAt: true }
  })
  
  console.log('\nKüllük için güncel swap durumları:')
  küllükSwaps.forEach(s => console.log(`  ${s.id}: ${s.status}`))
}

main().finally(() => prisma.$disconnect())
