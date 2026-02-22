import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function main() {
  console.log('Seeding database...')

  const hashedPassword = await bcrypt.hash('test123456', 10)
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@takas-a.com' },
    update: { password: hashedPassword },
    create: {
      email: 'test@takas-a.com',
      name: 'Test Kullanici',
      password: hashedPassword,
      valorBalance: 500,
      referralCode: generateReferralCode()
    }
  })

  console.log('Test user created:', testUser.email)

  const adminPassword = await bcrypt.hash('admin123Sgg123-', 10)
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'join@takas-a.com' },
    update: { role: 'admin' },
    create: {
      email: 'join@takas-a.com',
      name: 'TAKAS-A Admin',
      password: adminPassword,
      valorBalance: 10000,
      role: 'admin',
      referralCode: generateReferralCode()
    }
  })

  console.log('Admin user created:', adminUser.email)

  const categories = [
    { name: 'Elektronik', nameEn: 'Electronics', nameEs: 'Electrónica', nameCa: 'Electrònica', slug: 'elektronik', icon: '📱' },
    { name: 'Giyim', nameEn: 'Clothing', nameEs: 'Ropa', nameCa: 'Roba', slug: 'giyim', icon: '👕' },
    { name: 'Ev & Yasam', nameEn: 'Home & Living', nameEs: 'Hogar y Vida', nameCa: 'Llar i Vida', slug: 'ev-yasam', icon: '🏠' },
    { name: 'Spor & Outdoor', nameEn: 'Sports & Outdoor', nameEs: 'Deportes', nameCa: 'Esports', slug: 'spor-outdoor', icon: '⚽' },
    { name: 'Kitap & Hobi', nameEn: 'Books & Hobbies', nameEs: 'Libros y Hobbies', nameCa: 'Llibres i Hobbies', slug: 'kitap-hobi', icon: '📚' },
    { name: 'Cocuk & Bebek', nameEn: 'Kids & Baby', nameEs: 'Niños y Bebés', nameCa: 'Nens i Nadons', slug: 'cocuk-bebek', icon: '🧸' },
    { name: 'Oyuncak', nameEn: 'Toys', nameEs: 'Juguetes', nameCa: 'Joguines', slug: 'oyuncak', icon: '🎮' },
    { name: 'Mutfak', nameEn: 'Kitchen', nameEs: 'Cocina', nameCa: 'Cuina', slug: 'mutfak', icon: '🍳' },
    { name: 'Bahce', nameEn: 'Garden', nameEs: 'Jardín', nameCa: 'Jardí', slug: 'bahce', icon: '🌱' },
    { name: 'Taki & Aksesuar', nameEn: 'Jewelry & Accessories', nameEs: 'Joyería y Accesorios', nameCa: 'Joieria i Accessoris', slug: 'taki-aksesuar', icon: '💍' },
    { name: 'Beyaz Esya', nameEn: 'White Goods', nameEs: 'Electrodomésticos', nameCa: 'Electrodomèstics', slug: 'beyaz-esya', icon: '🧊' },
    { name: 'Oto & Moto', nameEn: 'Auto & Moto', nameEs: 'Auto y Moto', nameCa: 'Auto i Moto', slug: 'oto-moto', icon: '🚗' },
    { name: 'Diger', nameEn: 'Other', nameEs: 'Otros', nameCa: 'Altres', slug: 'diger', icon: '📦' }
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, nameEn: cat.nameEn, nameEs: cat.nameEs, nameCa: cat.nameCa, icon: cat.icon },
      create: cat
    })
  }

  console.log('Categories created:', categories.length)

  const deliveryPoints = [
    // Merkez İlçeler
    { name: 'Alsancak Kahve Dukkani', address: 'Kibris Sehitleri Caddesi No:45, Alsancak', district: 'Konak', latitude: 38.4337, longitude: 27.1425, hours: 'Hafta ici 09:00-20:00, Hafta sonu 10:00-18:00', image: '/images/clock_tower.jpg' },
    { name: 'Konak Meydani Cafe', address: 'Konak Meydani, Konak', district: 'Konak', latitude: 38.4189, longitude: 27.1287, hours: 'Her gun 08:00-22:00', image: '/images/clock_tower.jpg' },
    { name: 'Kemeraltı Esnaf Cafe', address: 'Anafartalar Caddesi No:78, Kemeraltı', district: 'Konak', latitude: 38.4205, longitude: 27.1342, hours: 'Hafta ici 09:00-19:00, Hafta sonu 10:00-17:00' },
    
    // Karşıyaka
    { name: 'Karsiyaka Sahil Kafe', address: 'Cemal Gursel Caddesi No:123, Karsiyaka', district: 'Karşıyaka', latitude: 38.4558, longitude: 27.1089, hours: 'Her gun 08:00-22:00', image: '/images/karsiyaka.jpg' },
    { name: 'Karsiyaka Carsi Meydani', address: 'Girne Bulvari No:50, Karsiyaka', district: 'Karşıyaka', latitude: 38.4612, longitude: 27.1156, hours: 'Her gun 09:00-21:00' },
    { name: 'Mavişehir Park Cafe', address: 'Caher Dudayev Bulvari, Mavisehir', district: 'Karşıyaka', latitude: 38.4721, longitude: 27.0912, hours: 'Her gun 10:00-22:00' },
    
    // Bornova
    { name: 'Bornova Forum AVM', address: 'Kazim Dirik Mah., Bornova', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, hours: 'Her gun 10:00-22:00', image: '/images/forum_bornova.jpg' },
    { name: 'Ege Universitesi Giris Cafe', address: 'Ege Universitesi Kampusu, Bornova', district: 'Bornova', latitude: 38.4589, longitude: 27.2234, hours: 'Hafta ici 08:00-18:00' },
    { name: 'Bornova Köy Meydani', address: 'Bornova Koy Meydani No:12', district: 'Bornova', latitude: 38.4567, longitude: 27.2089, hours: 'Her gun 09:00-20:00' },
    
    // Buca
    { name: 'Buca Park Cafe', address: 'Buca Gol Parki Yani, Buca', district: 'Buca', latitude: 38.3856, longitude: 27.1789, hours: 'Her gun 09:00-21:00', image: '/images/buca_park.jpg' },
    { name: 'DEU Kampüs Kafe', address: 'Dokuz Eylul Uni. Tinaztepe Kampusu', district: 'Buca', latitude: 38.3712, longitude: 27.2045, hours: 'Hafta ici 08:00-18:00' },
    
    // Balçova
    { name: 'Balcova Teleferik Cafe', address: 'Teleferik Istasyonu Yani, Balcova', district: 'Balçova', latitude: 38.3897, longitude: 27.0456, hours: 'Her gun 10:00-20:00', image: '/images/teleferik.jpg' },
    { name: 'Balcova AVM Giris', address: 'Balcova AVM, Ana Giris', district: 'Balçova', latitude: 38.3845, longitude: 27.0512, hours: 'Her gun 10:00-22:00' },
    
    // Gaziemir
    { name: 'Optimum AVM Izmir', address: 'Soyak Mah., Havaalanı Yolu, Gaziemir', district: 'Gaziemir', latitude: 38.3234, longitude: 27.1156, hours: 'Her gun 10:00-22:00' },
    { name: 'IKEA Izmir', address: 'IKEA Magazasi, Gaziemir', district: 'Gaziemir', latitude: 38.3189, longitude: 27.1234, hours: 'Her gun 10:00-21:00' },
    
    // Çiğli
    { name: 'Kipa AVM Cigli', address: 'Ataturk Caddesi, Cigli', district: 'Çiğli', latitude: 38.4956, longitude: 27.0534, hours: 'Her gun 10:00-22:00' },
    
    // Narlıdere
    { name: 'Narlidere Sahil', address: 'Sahil Yolu, Narlidere', district: 'Narlıdere', latitude: 38.4023, longitude: 26.9789, hours: 'Her gun 09:00-20:00' },
    
    // Bayraklı  
    { name: 'Folkart Towers Lobby', address: 'Folkart Towers, Bayrakli', district: 'Bayraklı', latitude: 38.4456, longitude: 27.1567, hours: 'Her gun 08:00-22:00' },
    { name: 'Bayrakli Belediye Meydani', address: 'Bayrakli Meydani', district: 'Bayraklı', latitude: 38.4512, longitude: 27.1623, hours: 'Her gun 09:00-19:00' },
    
    // Menemen
    { name: 'Menemen Carsi', address: 'Menemen Carsi Meydani', district: 'Menemen', latitude: 38.6089, longitude: 27.0678, hours: 'Hafta ici 09:00-18:00, Hafta sonu 10:00-16:00' },
    
    // Torbalı
    { name: 'Torbali Pazar Yeri', address: 'Cumhuriyet Meydani, Torbali', district: 'Torbalı', latitude: 38.1589, longitude: 27.3612, hours: 'Hafta ici 09:00-18:00' }
  ]

  for (const point of deliveryPoints) {
    const existing = await prisma.deliveryPoint.findFirst({ where: { name: point.name } })
    if (!existing) {
      await prisma.deliveryPoint.create({ data: point })
    }
  }

  const elektronik = await prisma.category.findUnique({ where: { slug: 'elektronik' } })
  const giyim = await prisma.category.findUnique({ where: { slug: 'giyim' } })
  const oyuncak = await prisma.category.findUnique({ where: { slug: 'oyuncak' } })
  const kitap = await prisma.category.findUnique({ where: { slug: 'kitap-hobi' } })
  const evYasam = await prisma.category.findUnique({ where: { slug: 'ev-yasam' } })
  const spor = await prisma.category.findUnique({ where: { slug: 'spor-outdoor' } })
  const takiAksesuar = await prisma.category.findUnique({ where: { slug: 'taki-aksesuar' } })
  const beyazEsya = await prisma.category.findUnique({ where: { slug: 'beyaz-esya' } })
  const cocukBebek = await prisma.category.findUnique({ where: { slug: 'cocuk-bebek' } })
  const otoMoto = await prisma.category.findUnique({ where: { slug: 'oto-moto' } })

  // Delete related data first, then products
  await prisma.review.deleteMany({})
  await prisma.disputeReport.deleteMany({})
  await prisma.valorTransaction.deleteMany({})
  await prisma.message.deleteMany({})
  await prisma.swapRequest.deleteMany({})
  await prisma.multiSwapParticipant.deleteMany({})
  await prisma.exchange.deleteMany({})
  await prisma.product.deleteMany({})
  console.log('Existing products deleted')

  const unsplashBase = 'https://images.unsplash.com/photo-'
  
  const products = [
    // ELEKTRONIK
    { title: 'iPhone 12 - 64GB Siyah', description: '1 yillik kullanilmis', valorPrice: 8500, condition: 'likeNew', categoryId: elektronik?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1592750475338-74b7b21085ab?w=500'], isPopular: true },
    { title: 'Samsung Galaxy Tab S7', description: '11 inc ekran', valorPrice: 6500, condition: 'likeNew', categoryId: elektronik?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1544244015-0df4b3ffc6b0?w=500'], isPopular: true },
    { title: 'Sony Kulaklik WH-1000XM4', description: 'Aktif gurultu engelleyici', valorPrice: 2800, condition: 'good', categoryId: elektronik?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1505740420928-5e560c06d30e?w=500'], isPopular: true },
    { title: 'Samsung 55" 4K Smart TV', description: 'Crystal UHD, 2022 model', valorPrice: 7500, condition: 'likeNew', categoryId: elektronik?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1593359677879-a4bb92f829d1?w=500'], isPopular: true },
    { title: 'LG 43" LED TV', description: 'Full HD, uzaktan kumandali', valorPrice: 3200, condition: 'good', categoryId: elektronik?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1461151304267-38535e780c79?w=500'] },
    { title: 'Philips 32" Monitor', description: 'Gaming monitor, 144Hz', valorPrice: 2800, condition: 'likeNew', categoryId: elektronik?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['/images/gaming_monitor.jpg'] },
    { title: 'MacBook Air M1', description: '8GB RAM, 256GB SSD', valorPrice: 15000, condition: 'likeNew', categoryId: elektronik?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['/images/macbook_air.jpg'], isPopular: true },
    { title: 'iPad 9. Nesil', description: '64GB, Wi-Fi', valorPrice: 5500, condition: 'good', categoryId: elektronik?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1544244015-0df4b3ffc6b0?w=500'] },

    // BEBEK & COCUK (Naif cerceve)
    { title: 'Chicco Trio Bebek Arabasi', description: 'Travel sistem, 0-3 yas', valorPrice: 4500, condition: 'good', categoryId: cocukBebek?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: ['/images/baby/chicco_trio_stroller.jpg'], isPopular: true },
    { title: 'Maxi-Cosi Puset', description: 'Hafif, katlanir', valorPrice: 2800, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['/images/baby/maxi_cosi_stroller.jpg'] },
    { title: 'Bebek Karyolasi + Yatak', description: 'Beyaz, sallanir', valorPrice: 1800, condition: 'good', categoryId: cocukBebek?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['/images/baby/baby_crib_mattress.jpg'] },
    { title: 'Bebek Mama Sandalyesi', description: 'Katlanir, yukseklik ayarli', valorPrice: 850, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1596461404969-9ae70f2830c1?w=500'] },
    { title: 'Bebek Kiyafet Seti 0-6 Ay', description: '20 parca, unisex', valorPrice: 450, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['/images/baby/baby_clothes_0_6_months.jpg'] },
    { title: 'Bebek Kiyafet Seti 6-12 Ay', description: 'Kiz bebek, 15 parca', valorPrice: 380, condition: 'good', categoryId: cocukBebek?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: ['/images/baby/baby_clothes_6_12_months.jpg'] },
    { title: 'Bebek Banyo Seti', description: 'Kuve, termometre, havlu', valorPrice: 280, condition: 'new', categoryId: cocukBebek?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1515488042361-ee00e0ddd4e4?w=500'] },
    { title: 'Bebek Oyun Hali', description: 'Yumusak, 150x200cm', valorPrice: 420, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['/images/baby/baby_play_mat.jpg'] },
    { title: 'Bebek Besik + Yorgan Seti', description: 'Pamuklu, organik', valorPrice: 650, condition: 'good', categoryId: cocukBebek?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['/images/baby/baby_crib_blanket_set.jpg'] },
    { title: 'Bebek Tasima Kanguru', description: 'Ergobaby, 0-36 ay', valorPrice: 950, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: ['/images/baby/baby_carrier.jpg'] },
    { title: 'Bebek Oto Koltugu', description: 'Cybex, 0-13kg', valorPrice: 1200, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['/images/baby/baby_car_seat.jpg'], isPopular: true },
    { title: 'Bebek Aktivite Jimnastik', description: 'Oyun yataği, muzikli', valorPrice: 350, condition: 'good', categoryId: cocukBebek?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1545558014-8692077e9b5c?w=500'] },
    { title: 'Bebek Emzirme Minderi', description: 'Boppy, yikaniir kilif', valorPrice: 220, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['/images/baby/baby_nursing_pillow.jpg'] },
    { title: 'Bebek Bez Cantasi', description: 'Skip Hop, cok gozlu', valorPrice: 380, condition: 'likeNew', categoryId: cocukBebek?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['/images/baby/baby_diaper_bag.jpg'] },
    { title: 'Bebek Biberon Seti', description: 'Philips Avent, 6 adet', valorPrice: 180, condition: 'new', categoryId: cocukBebek?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: ['/images/baby/baby_bottle_set.jpg'] },
    { title: 'Bebek Park Yatagi', description: 'Hauck, katlanir', valorPrice: 650, condition: 'good', categoryId: cocukBebek?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: ['/images/baby/baby_park_bed.jpg'] },

    // GIYIM - Kadin
    { title: 'Zara Trench Coat', description: 'M beden, bej renk', valorPrice: 650, condition: 'likeNew', categoryId: giyim?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1591047139829-d91aecb6caea?w=500'], isPopular: true },
    { title: 'Kadin Blazer Ceket', description: 'S beden, siyah', valorPrice: 380, condition: 'good', categoryId: giyim?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1594938298603-c8148c4dae35?w=500'] },
    { title: 'Floral Yazlik Elbise', description: 'M beden, cicekli', valorPrice: 280, condition: 'likeNew', categoryId: giyim?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1572804013309-59a88b7e92f1?w=500'] },
    { title: 'Denim Ceket Kadin', description: 'M beden, acik mavi', valorPrice: 320, condition: 'good', categoryId: giyim?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['/images/denim_jacket_women.jpg'] },

    // GIYIM - Erkek
    { title: 'Erkek Deri Ceket', description: 'L beden, gercek deri', valorPrice: 1200, condition: 'good', categoryId: giyim?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1551028719-00167b16eac5?w=500'] },
    { title: 'Nike Air Max', description: '42 numara, beyaz', valorPrice: 850, condition: 'good', categoryId: giyim?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1542291026-7eec264c27ff?w=500'] },
    { title: 'Erkek Takim Elbise', description: '50 beden, lacivert', valorPrice: 1800, condition: 'likeNew', categoryId: giyim?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1507679799987-c73779587ccf?w=500'] },
    { title: 'Polo Gomlek Seti', description: 'M beden, 3 adet', valorPrice: 350, condition: 'good', categoryId: giyim?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1620799140188-3b2a02fd9a77?w=500'] },

    // GIYIM - Genc Kiz Ayakkabi
    { title: 'Converse All Star', description: '37 numara, siyah', valorPrice: 450, condition: 'likeNew', categoryId: giyim?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1463100099107-aa0980c362e6?w=500'], isPopular: true },
    { title: 'Adidas Superstar', description: '38 numara, beyaz', valorPrice: 520, condition: 'good', categoryId: giyim?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1549298916-b41d501d3772?w=500'] },
    { title: 'Vans Old Skool', description: '36 numara, siyah-beyaz', valorPrice: 380, condition: 'likeNew', categoryId: giyim?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1525966222134-fcfa99b8ae77?w=500'] },
    { title: 'New Balance 574', description: '37 numara, gri', valorPrice: 480, condition: 'good', categoryId: giyim?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1539185441755-769473a23570?w=500'] },
    { title: 'Puma Platform Sneaker', description: '38 numara, beyaz', valorPrice: 420, condition: 'likeNew', categoryId: giyim?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1560769629-975ec94e6a86?w=500'] },
    { title: 'Skechers Spor Ayakkabi', description: '36 numara, pembe', valorPrice: 350, condition: 'good', categoryId: giyim?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1595950653106-6c9ebd614d3a?w=500'] },

    // OYUNCAK (Naif cerceve)
    { title: 'Lego Duplo Set', description: '100+ parca', valorPrice: 450, condition: 'likeNew', categoryId: oyuncak?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1587654780291-39c9404d746b?w=500'] },
    { title: 'Barbie Ruya Evi', description: '3 katli', valorPrice: 680, condition: 'good', categoryId: oyuncak?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1558060370-d644479cb6f7?w=500'], isPopular: true },
    { title: 'Hot Wheels Pist', description: 'Cift looping', valorPrice: 320, condition: 'good', categoryId: oyuncak?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1594787318286-3d835c1d207f?w=500'] },
    { title: 'Pelus Unicorn', description: '60cm boyunda', valorPrice: 180, condition: 'new', categoryId: oyuncak?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1563396983906-b3795482a59a?w=500'] },
    { title: 'Disney Puzzle 500 Parca', description: 'Frozen temali', valorPrice: 95, condition: 'likeNew', categoryId: oyuncak?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1494059980473-813e73ee784b?w=500'] },
    { title: 'Play-Doh Oyun Hamuru Seti', description: '24 renk', valorPrice: 180, condition: 'new', categoryId: oyuncak?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: ['/images/playdoh_set.jpg'] },

    // EV & YASAM - Dekoratif
    { title: 'Seramik Vazo Seti', description: '3 adet, minimal', valorPrice: 420, condition: 'likeNew', categoryId: evYasam?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1578500494198-246f612d3b3d?w=500'] },
    { title: 'Vintage Duvar Aynasi', description: 'Altin cerceve', valorPrice: 550, condition: 'good', categoryId: evYasam?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1618220179428-22790b461013?w=500'], isPopular: true },
    { title: 'Dekoratif Mum Seti', description: 'Kokulu, 6 adet', valorPrice: 180, condition: 'new', categoryId: evYasam?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1603006905003-be475563bc59?w=500'] },
    { title: 'Makrome Duvar Susu', description: 'El yapimi, bohem', valorPrice: 280, condition: 'likeNew', categoryId: evYasam?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1522758971460-1d21eed7dc1d?w=500'] },
    { title: 'Kahve Fincan Seti', description: '6 kisilik, porselen', valorPrice: 350, condition: 'likeNew', categoryId: evYasam?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1495474472287-4d71bcdd2085?w=500'] },
    { title: 'Yastik Kilifi Seti', description: '4 adet, kadife', valorPrice: 220, condition: 'good', categoryId: evYasam?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1584100936595-c0654b55a2e2?w=500'] },
    { title: 'Dekoratif Yer Lambasi', description: 'Tripod, ahsap', valorPrice: 480, condition: 'likeNew', categoryId: evYasam?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1513506003901-1e6a229e2d15?w=500'] },
    { title: 'Cicek Saksisi Seti', description: '5 adet, seramik', valorPrice: 320, condition: 'new', categoryId: evYasam?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1485955900006-10f4d324d411?w=500'] },

    // TAKI & AKSESUAR
    { title: 'Vintage Kolye Seti', description: '3 adet altin kaplama', valorPrice: 180, condition: 'likeNew', categoryId: takiAksesuar?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1599643478518-a784e5dc4c8f?w=500'] },
    { title: 'Inci Kupe ve Kolye', description: 'Imitasyon inci', valorPrice: 250, condition: 'new', categoryId: takiAksesuar?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1535632066927-ab7c9ab60908?w=500'] },
    { title: 'Bohem Bileklik Set', description: '8 adet', valorPrice: 120, condition: 'good', categoryId: takiAksesuar?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1573408301185-9146fe634ad0?w=500'] },
    { title: 'Gumus Yuzuk Seti', description: '5 adet', valorPrice: 150, condition: 'likeNew', categoryId: takiAksesuar?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1605100804763-247f67b3557e?w=500'] },
    { title: 'Saat Bileklik Kombin', description: 'Rose gold', valorPrice: 320, condition: 'good', categoryId: takiAksesuar?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1524592094714-0f0654e20314?w=500'] },

    // BEYAZ ESYA
    { title: 'Mini Buzdolabi', description: '90L, ogrenci icin', valorPrice: 1200, condition: 'good', categoryId: beyazEsya?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1571175443880-49e1d25b2bc5?w=500'] },
    { title: 'Camasir Makinesi', description: '7kg, Arcelik', valorPrice: 2500, condition: 'good', categoryId: beyazEsya?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1626806787461-102c1bfaaea1?w=500'] },
    { title: 'Mikrodalga Firin', description: '23L, Samsung', valorPrice: 850, condition: 'likeNew', categoryId: beyazEsya?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1574269909862-7e1d70bb8078?w=500'] },
    { title: 'Elektrikli Supurge', description: 'Philips, 2000W', valorPrice: 650, condition: 'good', categoryId: beyazEsya?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1558317374-067fb5f30001?w=500'] },
    { title: 'Buharli Utu', description: 'Tefal, seramik taban', valorPrice: 280, condition: 'good', categoryId: beyazEsya?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1585771724684-38269d6639fd?w=500'] },

    // UNIVERSITE OGRENCILERI ICIN
    { title: 'Calisma Masasi + Sandalye', description: 'IKEA, beyaz', valorPrice: 850, condition: 'good', categoryId: evYasam?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1518455027359-f3f8164ba6bd?w=500'], isPopular: true },
    { title: 'Kitaplik Raf Sistemi', description: '5 katli, ahsap', valorPrice: 420, condition: 'likeNew', categoryId: evYasam?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['/images/bookshelf.jpg'] },
    { title: 'Tek Kisilik Yatak + Baza', description: '90x190, beyaz', valorPrice: 1200, condition: 'good', categoryId: evYasam?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1505693416388-ac5ce068fe85?w=500'] },
    { title: 'Ders Kitaplari - Muhendislik', description: '15 adet, cesitli', valorPrice: 650, condition: 'good', categoryId: kitap?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1568667256549-094345857637?w=500'] },
    { title: 'Ogrenci Laptop Cantasi', description: '15.6 inc, suya dayanikli', valorPrice: 180, condition: 'likeNew', categoryId: giyim?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1553062407-98eeb64c6a62?w=500'] },
    { title: 'Mutfak Baslangic Seti', description: 'Tava, tencere, bicak', valorPrice: 450, condition: 'good', categoryId: evYasam?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1556909114-f6e7ad7d3136?w=500'] },
    { title: 'Battaniye + Nevresim Seti', description: 'Tek kisilik', valorPrice: 280, condition: 'likeNew', categoryId: evYasam?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1540518614846-7eded433c457?w=500'] },
    { title: 'Masa Lambasi LED', description: 'USB sarzli, katlanir', valorPrice: 150, condition: 'new', categoryId: evYasam?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1507473885765-e6ed057f782c?w=500'] },
    { title: 'Elektrikli Isitici', description: '2000W, termostatli', valorPrice: 350, condition: 'good', categoryId: beyazEsya?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['/images/electric_heater.jpg'] },
    { title: 'Su Isitici Kettle', description: 'Philips, 1.7L', valorPrice: 220, condition: 'likeNew', categoryId: beyazEsya?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['/images/electric_kettle.jpg'] },

    // KITAP & HOBI
    { title: 'Harry Potter Seti', description: '7 kitap, Turkce', valorPrice: 450, condition: 'good', categoryId: kitap?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1551269901-5c5e14c25df7?w=500'] },
    { title: 'Kisisel Gelisim Kitaplari', description: '10 adet bestseller', valorPrice: 380, condition: 'good', categoryId: kitap?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1512820790803-83ca734da794?w=500'] },
    { title: 'Roman Koleksiyonu', description: '20 adet, karisik', valorPrice: 320, condition: 'good', categoryId: kitap?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1495446815901-a7297e633e8d?w=500'] },

    // SPOR & OUTDOOR
    { title: 'Yoga Mati Seti', description: 'Mat, blok, kemer', valorPrice: 320, condition: 'likeNew', categoryId: spor?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1601925260368-ae2f83cf8b7f?w=500'] },
    { title: 'Dambil Seti 20kg', description: '2x10kg, kaucuk', valorPrice: 650, condition: 'good', categoryId: spor?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1534438327276-14e5300c3a48?w=500'] },
    { title: 'Bisiklet 26 Jant', description: '21 vites, dagli', valorPrice: 1800, condition: 'good', categoryId: spor?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1485965120184-e220f721d03e?w=500'], isPopular: true },
    { title: 'Kamp Cadiri 4 Kisilik', description: 'Su gecirmez', valorPrice: 950, condition: 'likeNew', categoryId: spor?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1504280390367-361c6d9f38f4?w=500'] },

    // OTO & MOTO AKSESUARLARI
    // Telefon Kilifi
    { title: 'iPhone 14 Pro Kilif Seti', description: '3 adet, silikon + deri + seffaf', valorPrice: 180, condition: 'new', categoryId: otoMoto?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1601593346740-925612772716?w=500'] },
    { title: 'Samsung Galaxy S23 Kilif', description: 'Darbeye dayanikli, siyah', valorPrice: 120, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1609081219090-a6d81d3085bf?w=500'] },
    
    // Termos
    { title: 'Paslanmaz Celik Termos 1L', description: '24 saat sicak/soguk tutar', valorPrice: 280, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1602143407151-7111542de6e8?w=500'], isPopular: true },
    { title: 'Stanley Termos 750ml', description: 'Vakumlu, yesil', valorPrice: 350, condition: 'good', categoryId: otoMoto?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1570281539254-6d4d1e7a1f21?w=500'] },
    
    // Navigasyon Cihazi
    { title: 'Garmin Drive 52 Navigasyon', description: '5 inch ekran, Turkiye haritali', valorPrice: 1800, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1544620347-c4fd4a3d5957?w=500'], isPopular: true },
    { title: 'TomTom GO 620 Navigasyon', description: 'Wi-Fi, omur boyu guncelleme', valorPrice: 2200, condition: 'good', categoryId: otoMoto?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1558618666-fcd25c85cd64?w=500'] },
    
    // Oto Paspas
    { title: 'Universal Oto Paspas Seti', description: '4 parca, kaucuk, siyah', valorPrice: 350, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1494976388531-d1058494cdd8?w=500'] },
    { title: 'Havuzlu Oto Paspas 3D', description: 'Tam kaplama, su gecirmez', valorPrice: 480, condition: 'new', categoryId: otoMoto?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1552519507-da3b142c6e3d?w=500'] },
    
    // Kriko Seti
    { title: 'Hidrolik Kriko 2 Ton', description: 'Celik govde, tasinabilir', valorPrice: 420, condition: 'good', categoryId: otoMoto?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1558618047-3c8c76ca7d13?w=500'] },
    { title: 'Oto Tamir Seti + Kriko', description: 'Komple set, canta ile', valorPrice: 650, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: [unsplashBase + '1504222490345-c075b6008014?w=500'] },
    
    // Silecek
    { title: 'Bosch Aerotwin Silecek Seti', description: '60+45cm, universal', valorPrice: 280, condition: 'new', categoryId: otoMoto?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1616788494672-ec7ca25fdda9?w=500'] },
    { title: 'Valeo Silecek Seti', description: 'Arka cam dahil, 3 adet', valorPrice: 320, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1486262715619-67b85e0b08d3?w=500'] },
    
    // Oto Parfum / Koku
    { title: 'Oto Parfum Seti', description: '5 farkli koku, asilan tip', valorPrice: 120, condition: 'new', categoryId: otoMoto?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1608571423902-eed4a5ad8108?w=500'] },
    { title: 'California Scents Araba Kokusu', description: 'Konsol tipi, 3 adet', valorPrice: 150, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: [unsplashBase + '1585232351009-aa56e1ded78c?w=500'] },
    
    // Motor Kaski
    { title: 'LS2 Motosiklet Kaski', description: 'Full face, L beden, siyah mat', valorPrice: 950, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: [unsplashBase + '1558980663-3685c1d673c4?w=500'], isPopular: true },
    { title: 'HJC Acik Kask', description: 'Jet kask, M beden, beyaz', valorPrice: 650, condition: 'good', categoryId: otoMoto?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: [unsplashBase + '1569770218135-bea267ed7e84?w=500'] },
    { title: 'AGV Pista GP R Kask', description: 'Yaris kaski, S beden, karbon', valorPrice: 2800, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: ['https://www.revzilla.com/product_images/2194/7242/agv_pista_gprr_carbon_helmet_carbon_750x750.jpg'] },
    
    // Moto Aksesuar
    { title: 'Motosiklet Eldiveni', description: 'Deri, L beden, korunmali', valorPrice: 280, condition: 'good', categoryId: otoMoto?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['https://thumbs.dreamstime.com/z/brown-leather-motorcycle-gloves-isolated-white-background-brown-leather-motorcycle-gloves-isolated-white-background-180761676.jpg'] },
    { title: 'Motosiklet Ceketi', description: 'Korumali, M beden, siyah', valorPrice: 850, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: [unsplashBase + '1558618047-3c8c76ca7d13?w=500'] },
    { title: 'Motosiklet Bagaj Cantasi', description: '45L, su gecirmez', valorPrice: 420, condition: 'good', categoryId: otoMoto?.id, district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: ['https://i.ebayimg.com/images/g/5P4AAOSwOwJnIJgY/s-l1200.jpg'] },
    
    // Oto Aksesuar
    { title: 'Arac Ici Telefon Tutucu', description: 'Manyetik, havalandirma tipi', valorPrice: 80, condition: 'new', categoryId: otoMoto?.id, district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['https://flolab.io/cdn/shop/products/magnetic-car-phone-holder_5000x.jpg?v=1637748036'] },
    { title: 'Oto Koltuk Kilifi Seti', description: 'Universal, deri gorunumlu', valorPrice: 650, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['https://freesoo-auto.com/cdn/shop/files/seatcoversforcars.jpg?v=1698217056&width=1946'] },
    { title: 'Akilli Arac Sarj Cihazi', description: 'QC 3.0, cift USB', valorPrice: 120, condition: 'new', categoryId: otoMoto?.id, district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: [unsplashBase + '1558618666-fcd25c85cd64?w=500'] },
    { title: 'Oto Bagaj Organizeri', description: 'Katlanir, cok gozlu', valorPrice: 180, condition: 'likeNew', categoryId: otoMoto?.id, district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['http://www.welkins.com/cdn/shop/files/welkin-a4101-car-trunk-organizer-main-collapsible-black-white-background.jpg?v=1760412397&width=2048'] }
  ]

  for (const product of products) {
    if (product.categoryId) {
      await prisma.product.create({
        data: {
          title: product.title,
          description: product.description,
          valorPrice: product.valorPrice,
          condition: product.condition,
          categoryId: product.categoryId,
          district: product.district,
          latitude: product.latitude,
          longitude: product.longitude,
          aiValorReason: 'AI tarafindan hesaplandi',
          userId: adminUser.id,
          images: product.images || [],
          isPopular: (product as any).isPopular || false
        }
      })
    }
  }

  console.log('Sample products created:', products.length)

  // === ÖRNEK TOPLULUKLAR ===
  console.log('Creating sample communities...')
  
  const sampleCommunities = [
    {
      name: 'Karşıyaka Takasçıları',
      slug: 'karsiyaka-takascilari',
      description: 'Karşıyaka ve çevresinde yaşayan takas tutkunlarının buluşma noktası. Yerel ürünler, ikinci el eşyalar ve daha fazlası!',
      city: 'İzmir',
      district: 'Karşıyaka',
      type: 'district',
      isOfficial: true,
      tags: ['yerel', 'ikinci-el', 'izmir']
    },
    {
      name: 'Bornova Takas Topluluğu',
      slug: 'bornova-takas-toplulugu',
      description: 'Bornova\'da takas yapmak isteyenler için güvenli ve aktif bir topluluk.',
      city: 'İzmir',
      district: 'Bornova',
      type: 'district',
      isOfficial: true,
      tags: ['üniversite', 'öğrenci', 'kitap']
    },
    {
      name: 'Alsancak Değiş Tokuş',
      slug: 'alsancak-degis-tokus',
      description: 'Alsancak\'ın kalbinde takas! Moda, aksesuar ve vintage ürünler.',
      city: 'İzmir',
      district: 'Konak',
      neighborhood: 'Alsancak',
      type: 'neighborhood',
      isOfficial: false,
      tags: ['moda', 'vintage', 'aksesuar']
    },
    {
      name: 'İzmir Kitap Takası',
      slug: 'izmir-kitap-takasi',
      description: 'Kitap severler için özel bir takas topluluğu. Romanlar, akademik kitaplar, çocuk kitapları...',
      city: 'İzmir',
      district: null,
      type: 'interest',
      isOfficial: true,
      tags: ['kitap', 'roman', 'edebiyat', 'akademik']
    },
    {
      name: 'Bebek Eşyaları Takası',
      slug: 'bebek-esyalari-takasi',
      description: 'Bebek ve çocuk eşyalarını takas edin. Kıyafet, oyuncak, bebek arabası ve daha fazlası.',
      city: 'İzmir',
      district: null,
      type: 'interest',
      isOfficial: false,
      tags: ['bebek', 'çocuk', 'oyuncak', 'aile']
    },
    {
      name: 'Barcelona Intercanvi',
      slug: 'barcelona-intercanvi',
      description: 'Comunitat de intercanvi a Barcelona. Productes locals, segona mà i més!',
      city: 'Barcelona',
      district: 'Eixample',
      type: 'city',
      isOfficial: true,
      tags: ['barcelona', 'local', 'sostenible']
    }
  ]

  for (const communityData of sampleCommunities) {
    const existingCommunity = await prisma.community.findUnique({
      where: { slug: communityData.slug }
    })
    
    if (!existingCommunity) {
      const community = await prisma.community.create({
        data: {
          ...communityData,
          memberCount: 1,
          members: {
            create: {
              userId: adminUser.id,
              role: 'admin',
              badges: ['founder']
            }
          }
        }
      })
      console.log('Community created:', community.name)
    }
  }

  console.log('Sample communities created!')
  console.log('')
  console.log('=== ADMIN GIRIS BILGILERI ===')
  console.log('Email: join@takas-a.com')
  console.log('Sifre: admin123Sgg123-')
  console.log('=============================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
