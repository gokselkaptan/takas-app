import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'goksel035@gmail.com' },
    select: { id: true, name: true, valorBalance: true }
  })
  
  if (!user) {
    console.log('Kullanıcı bulunamadı!')
    return
  }
  
  console.log('Kullanıcı:', user.name, '- Valor:', user.valorBalance)
  
  const categories = await prisma.category.findMany({
    select: { id: true, name: true }
  })
  
  const products = [
    { title: 'iPhone 13 Pro Max 256GB', category: 'Elektronik', valorPrice: 450, condition: 'like_new', description: 'Az kullanılmış, kutulu iPhone 13 Pro Max. Şarj aleti ve kulaklık dahil.' },
    { title: 'Samsung Galaxy Tab S8', category: 'Elektronik', valorPrice: 300, condition: 'good', description: 'Çizikler var ama çalışıyor. Kalem dahil.' },
    { title: 'Vintage Deri Ceket', category: 'Giyim', valorPrice: 120, condition: 'good', description: 'Gerçek deri, beden M. 90lar stili.' },
    { title: 'Nike Air Max 90', category: 'Giyim', valorPrice: 80, condition: 'like_new', description: '42 numara, sadece 2 kez giyildi.' },
    { title: 'IKEA Billy Kitaplık', category: 'Ev & Yasam', valorPrice: 60, condition: 'good', description: 'Beyaz renk, demonte halde teslim.' },
    { title: 'PS5 DualSense Controller', category: 'Elektronik', valorPrice: 70, condition: 'new', description: 'Sıfır, kutusunda açılmamış.' },
  ]
  
  for (const p of products) {
    const cat = categories.find(c => c.name.includes(p.category) || p.category.includes(c.name))
    if (!cat) {
      console.log(`Kategori bulunamadı: ${p.category}`)
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
  
  console.log('\nToplam 6 ürün eklendi!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
