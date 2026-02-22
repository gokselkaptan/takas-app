import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // "isil" içeren kullanıcıyı bul
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'isil', mode: 'insensitive' } },
        { name: { contains: 'ışıl', mode: 'insensitive' } },
        { email: { contains: 'isil', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, email: true, valorBalance: true }
  })
  
  console.log('Bulunan kullanıcılar:', JSON.stringify(users, null, 2))
  
  if (users.length === 0) {
    console.log('Kullanıcı bulunamadı!')
    return
  }
  
  const user = users[0]
  console.log(`\nSeçilen: ${user.name} (${user.email}) - Mevcut Valor: ${user.valorBalance}`)
  
  // Kategorileri al
  const categories = await prisma.category.findMany({
    select: { id: true, name: true }
  })
  console.log('Kategoriler:', categories.map(c => c.name).join(', '))
  
  // 2000 Valor tanımla
  await prisma.user.update({
    where: { id: user.id },
    data: { valorBalance: 2000 }
  })
  console.log('✓ Valor 2000 olarak güncellendi!')
  
  // Ürünler ekle
  const products = [
    { title: 'MacBook Air M2 13"', category: 'Elektronik', valorPrice: 600, condition: 'like_new', description: '2023 model, 256GB SSD, kutulu, garantili.' },
    { title: 'Canon EOS R50 Fotoğraf Makinesi', category: 'Elektronik', valorPrice: 400, condition: 'good', description: 'Aynasız, lens dahil, çanta hediye.' },
    { title: 'Zara Kaşmir Palto', category: 'Giyim', valorPrice: 150, condition: 'like_new', description: 'Bej renk, M beden, sadece 3 kez giyildi.' },
    { title: 'Converse Chuck Taylor', category: 'Giyim', valorPrice: 50, condition: 'good', description: '38 numara, siyah, klasik model.' },
    { title: 'Philips Airfryer XXL', category: 'Mutfak', valorPrice: 180, condition: 'new', description: 'Sıfır, kutusunda. Hediye geldi kullanmıyorum.' },
    { title: 'Dyson V15 Süpürge', category: 'Ev', valorPrice: 350, condition: 'like_new', description: 'Lazer sensörlü, tüm aparatlar mevcut.' },
  ]
  
  for (const p of products) {
    const cat = categories.find(c => c.name.toLowerCase().includes(p.category.toLowerCase()) || p.category.toLowerCase().includes(c.name.toLowerCase()))
    if (!cat) {
      console.log(`⚠ Kategori bulunamadı: ${p.category}`)
      continue
    }
    
    await prisma.product.create({
      data: {
        title: p.title,
        description: p.description,
        valorPrice: p.valorPrice,
        condition: p.condition,
        status: 'active',
        city: 'İstanbul',
        images: [],
        userId: user.id,
        categoryId: cat.id,
      }
    })
    console.log(`✓ ${p.title} - ${p.valorPrice} Valor`)
  }
  
  console.log('\n✅ İşlem tamamlandı!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
