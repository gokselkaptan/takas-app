import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'goksel035@gmail.com' },
    select: { id: true }
  })
  
  if (!user) {
    console.log('Kullanıcı bulunamadı!')
    return
  }
  
  const imageMap: Record<string, string> = {
    'iPhone 13 Pro Max 256GB': 'https://cdn.abacus.ai/images/d212934a-9d05-492d-adde-ab3f7ee4031a.png',
    'Samsung Galaxy Tab S8': 'https://cdn.abacus.ai/images/db6c3b3f-ddfc-404d-a9cd-38af75d828ac.png',
    'Vintage Deri Ceket': 'https://cdn.abacus.ai/images/bf575b18-7095-468e-9775-015f36a5894a.png',
    'Nike Air Max 90': 'https://cdn.abacus.ai/images/7f3de7ea-ee62-4edc-ab31-2e8131acf805.png',
    'IKEA Billy Kitaplık': 'https://cdn.abacus.ai/images/878543b5-8a51-488e-90c7-963861c38a0b.png',
    'PS5 DualSense Controller': 'https://cdn.abacus.ai/images/51b968ed-7748-4bd4-8aeb-be548090e9b2.png',
  }
  
  const products = await prisma.product.findMany({
    where: { userId: user.id },
    select: { id: true, title: true }
  })
  
  for (const product of products) {
    const imageUrl = imageMap[product.title]
    if (imageUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: [imageUrl] }
      })
      console.log(`✓ ${product.title} - fotoğraf eklendi`)
    }
  }
  
  console.log('\nTüm ürün fotoğrafları güncellendi!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
