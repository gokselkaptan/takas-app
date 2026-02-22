import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'isiluslu@gmail.com' },
    select: { id: true }
  })
  
  if (!user) {
    console.log('Kullanıcı bulunamadı!')
    return
  }
  
  const imageMap: Record<string, string> = {
    'MacBook Air M2 13"': 'https://cdn.abacus.ai/images/5531c2a7-02a8-4efa-bd61-c3f359b4b84e.png',
    'Canon EOS R50 Fotoğraf Makinesi': 'https://cdn.abacus.ai/images/c618626d-7593-49cc-af66-67202b64746f.png',
    'Zara Kaşmir Palto': 'https://cdn.abacus.ai/images/d620024f-4d9d-421f-8e45-b013386b1d5b.png',
    'Converse Chuck Taylor': 'https://cdn.abacus.ai/images/2d7066d4-876b-44f0-81aa-f675b5199914.png',
    'Philips Airfryer XXL': 'https://cdn.abacus.ai/images/af75a5b2-db4b-4e93-954c-96b9cb0fc53a.png',
    'Dyson V15 Süpürge': 'https://cdn.abacus.ai/images/be04db52-682a-4995-aeed-f84d118d2a37.png',
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
  
  console.log('\n✅ Tüm fotoğraflar güncellendi!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
