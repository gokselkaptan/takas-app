import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Oto & Moto category and products...')

  // Get admin user
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!adminUser) {
    console.error('Admin user not found')
    return
  }

  // Create or update the category
  const otoMoto = await prisma.category.upsert({
    where: { slug: 'oto-moto' },
    update: { name: 'Oto & Moto', nameEn: 'Auto & Moto', nameEs: 'Auto y Moto', nameCa: 'Auto i Moto', icon: '🚗' },
    create: { name: 'Oto & Moto', nameEn: 'Auto & Moto', nameEs: 'Auto y Moto', nameCa: 'Auto i Moto', slug: 'oto-moto', icon: '🚗' }
  })
  console.log('Category created/updated:', otoMoto.name)

  const unsplashBase = 'https://images.unsplash.com/photo-'

  const products = [
    // Telefon Kilifi
    { title: 'iPhone 14 Pro Kilif Seti', description: '3 adet, silikon + deri + seffaf', valorPrice: 180, condition: 'new', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1601593346740-925612772716?w=500'] },
    { title: 'Samsung Galaxy S23 Kilif', description: 'Darbeye dayanikli, siyah', valorPrice: 120, condition: 'likeNew', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1609081219090-a6d81d3085bf?w=500'] },
    
    // Termos
    { title: 'Paslanmaz Celik Termos 1L', description: '24 saat sicak/soguk tutar', valorPrice: 280, condition: 'likeNew', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1602143407151-7111542de6e8?w=500'], isPopular: true },
    { title: 'Stanley Termos 750ml', description: 'Vakumlu, yesil', valorPrice: 350, condition: 'good', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1570281539254-6d4d1e7a1f21?w=500'] },
    
    // Navigasyon Cihazi
    { title: 'Garmin Drive 52 Navigasyon', description: '5 inch ekran, Turkiye haritali', valorPrice: 1800, condition: 'likeNew', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1544620347-c4fd4a3d5957?w=500'], isPopular: true },
    { title: 'TomTom GO 620 Navigasyon', description: 'Wi-Fi, omur boyu guncelleme', valorPrice: 2200, condition: 'good', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1558618666-fcd25c85cd64?w=500'] },
    
    // Oto Paspas
    { title: 'Universal Oto Paspas Seti', description: '4 parca, kaucuk, siyah', valorPrice: 350, condition: 'likeNew', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1489824904134-891ab64532f1?w=500'] },
    { title: 'Havuzlu Oto Paspas 3D', description: 'Tam kaplama, su gecirmez', valorPrice: 480, condition: 'new', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1503376780353-7e6692767b70?w=500'] },
    
    // Kriko Seti
    { title: 'Hidrolik Kriko 2 Ton', description: 'Celik govde, tasinabilir', valorPrice: 420, condition: 'good', district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1558618047-3c8c76ca7d13?w=500'] },
    { title: 'Oto Tamir Seti + Kriko', description: 'Komple set, canta ile', valorPrice: 650, condition: 'likeNew', district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1504222490345-c075b6008014?w=500'] },
    
    // Silecek
    { title: 'Bosch Aerotwin Silecek Seti', description: '60+45cm, universal', valorPrice: 280, condition: 'new', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1616788494672-ec7ca25fdda9?w=500'] },
    { title: 'Valeo Silecek Seti', description: 'Arka cam dahil, 3 adet', valorPrice: 320, condition: 'likeNew', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1486262715619-67b85e0b08d3?w=500'] },
    
    // Oto Parfum / Koku
    { title: 'Oto Parfum Seti', description: '5 farkli koku, asilan tip', valorPrice: 120, condition: 'new', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1608571423902-eed4a5ad8108?w=500'] },
    { title: 'California Scents Araba Kokusu', description: 'Konsol tipi, 3 adet', valorPrice: 150, condition: 'likeNew', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1585232351009-aa56e1ded78c?w=500'] },
    
    // Motor Kaski
    { title: 'LS2 Motosiklet Kaski', description: 'Full face, L beden, siyah mat', valorPrice: 950, condition: 'likeNew', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1558980663-3685c1d673c4?w=500'], isPopular: true },
    { title: 'HJC Acik Kask', description: 'Jet kask, M beden, beyaz', valorPrice: 650, condition: 'good', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1569770218135-bea267ed7e84?w=500'] },
    { title: 'AGV Pista GP R Kask', description: 'Yaris kaski, S beden, karbon', valorPrice: 2800, condition: 'likeNew', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1580310614729-ccd69652491d?w=500'] },
    
    // Moto Aksesuar
    { title: 'Motosiklet Eldiveni', description: 'Deri, L beden, korunmali', valorPrice: 280, condition: 'good', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1595341888016-5c54c62e932c?w=500'] },
    { title: 'Motosiklet Ceketi', description: 'Korumali, M beden, siyah', valorPrice: 850, condition: 'likeNew', district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1591047139829-d91aecb6caea?w=500'] },
    { title: 'Motosiklet Bagaj Cantasi', description: '45L, su gecirmez', valorPrice: 420, condition: 'good', district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1528164344705-47542687000d?w=500'] },
    
    // Oto Aksesuar
    { title: 'Arac Ici Telefon Tutucu', description: 'Manyetik, havalandirma tipi', valorPrice: 80, condition: 'new', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1600880292203-757bb62b4baf?w=500'] },
    { title: 'Oto Koltuk Kilifi Seti', description: 'Universal, deri gorunumlu', valorPrice: 650, condition: 'likeNew', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1489824904134-891ab64532f1?w=500'] },
    { title: 'Akilli Arac Sarj Cihazi', description: 'QC 3.0, cift USB', valorPrice: 120, condition: 'new', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1583121274602-3e2820c69888?w=500'] },
    { title: 'Oto Bagaj Organizeri', description: 'Katlanir, cok gozlu', valorPrice: 180, condition: 'likeNew', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1503376780353-7e6692767b70?w=500'] }
  ]

  let created = 0
  for (const product of products) {
    // Check if product already exists
    const existing = await prisma.product.findFirst({ where: { title: product.title } })
    if (!existing) {
      await prisma.product.create({
        data: {
          title: product.title,
          description: product.description,
          valorPrice: product.valorPrice,
          condition: product.condition,
          categoryId: otoMoto.id,
          district: product.district,
          latitude: product.latitude,
          longitude: product.longitude,
          aiValorReason: 'AI tarafindan hesaplandi',
          userId: adminUser.id,
          images: product.images,
          isPopular: (product as any).isPopular || false
        }
      })
      created++
    }
  }

  console.log(`Created ${created} new Oto & Moto products`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
