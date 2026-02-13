import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const productId = "cmlh4d6o90008ql08448orlrw"
  
  // Önce ilgili swap requestleri sil
  const deletedSwaps = await prisma.swapRequest.deleteMany({
    where: {
      OR: [
        { productId },
        { offeredProductId: productId }
      ]
    }
  })
  console.log(`${deletedSwaps.count} swap talebi silindi`)
  
  // Mesajları sil
  const deletedMessages = await prisma.message.deleteMany({
    where: { productId }
  })
  console.log(`${deletedMessages.count} mesaj silindi`)
  
  // Favorileri sil
  const deletedFavs = await prisma.favorite.deleteMany({
    where: { productId }
  })
  console.log(`${deletedFavs.count} favori silindi`)
  
  // Ürünü sil
  const deleted = await prisma.product.delete({
    where: { id: productId }
  })
  console.log(`Ürün silindi: ${deleted.title}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
