import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Aktif swap request'leri listele
  const activeSwaps = await prisma.swapRequest.findMany({
    where: {
      status: {
        notIn: ['completed', 'rejected', 'cancelled']
      }
    },
    include: {
      product: { select: { title: true, id: true } },
      requester: { select: { name: true, email: true } },
      owner: { select: { name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })
  
  console.log('=== AKTIF TAKAS TALEPLERİ ===')
  console.log('Toplam:', activeSwaps.length)
  activeSwaps.forEach(swap => {
    console.log(`\nID: ${swap.id}`)
    console.log(`  Status: ${swap.status}`)
    console.log(`  Ürün: ${swap.product.title} (${swap.product.id})`)
    console.log(`  Talep Eden: ${swap.requester.name} (${swap.requester.email})`)
    console.log(`  Ürün Sahibi: ${swap.owner.name} (${swap.owner.email})`)
    console.log(`  Tarih: ${swap.createdAt}`)
  })
}

main().finally(() => prisma.$disconnect())
