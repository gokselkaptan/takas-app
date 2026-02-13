import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Nargile ürününü bul
  const nargile = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: 'nargile', mode: 'insensitive' } },
        { title: { contains: 'Nargile', mode: 'insensitive' } },
      ]
    },
    select: { id: true, title: true, userId: true }
  })
  console.log('Nargile ürünleri:', JSON.stringify(nargile, null, 2))
  
  // Mesajları test et - son 10 mesaj
  const messages = await prisma.message.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      senderId: true,
      receiverId: true,
      productId: true,
      isRead: true,
      isModerated: true,
      moderationResult: true
    }
  })
  console.log('\nSon 10 mesaj:')
  messages.forEach(m => {
    console.log(`  [${m.createdAt.toISOString()}] sender=${m.senderId} -> receiver=${m.receiverId} | productId=${m.productId}`)
    console.log(`    İçerik: ${m.content?.substring(0, 60)}`)
    console.log(`    Okundu: ${m.isRead}, Moderasyon: ${m.moderationResult}`)
  })
  
  // Swap request'leri test et
  const swaps = await prisma.swapRequest.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      requesterId: true,
      ownerId: true,
      productId: true,
      product: { select: { title: true } }
    }
  })
  console.log('\nSon 5 swap talebi:')
  swaps.forEach(s => {
    console.log(`  [${s.createdAt.toISOString()}] ${s.status} | requester=${s.requesterId} -> owner=${s.ownerId}`)
    console.log(`    Ürün: ${s.product?.title}`)
    if (s.message) console.log(`    Mesaj: ${s.message}`)
  })
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
