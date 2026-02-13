import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding sports equipment products...')

  const spor = await prisma.category.findUnique({ where: { slug: 'spor-outdoor' } })
  const adminUser = await prisma.user.findUnique({ where: { email: 'join@takas-a.com' } })

  if (!spor || !adminUser) {
    console.error('Category or admin user not found!')
    return
  }

  const sportsProducts = [
    { title: 'Wilson Tenis Raketi Pro Staff', description: 'Profesyonel seviye tenis raketi, 105 kafa boyutu, ideal agirlik dengesi', valorPrice: 1200, condition: 'likeNew', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['https://img.myshopline.com/image/store/1724897924038/WR171310U-1-PRO-STAFF-PRECISION-RXT-105-TNS-RKT-White-Black-Red.png?w=2000&h=2000'], isPopular: true },
    { title: 'Tenis Topu 3lu Paket', description: 'Turnuva kalitesinde tenis toplari, ITF onayli', valorPrice: 85, condition: 'new', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['https://cdn11.bigcommerce.com/s-ye1wjo4ckm/images/stencil/1280x1280/products/43401/11808/TB3-alt1-XL2x__52203.1727880856.jpg?c=1'] },
    { title: 'Tenis Canta Seti', description: 'Raket tasima cantasi, 3 bolmeli, omuz askili', valorPrice: 450, condition: 'good', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: ['https://vesselgolf.com/cdn/shop/products/Product-BaselineLite-Black-01.jpg?v=1757520545&width=2048'] },
    { title: 'Futbol Topu 5 Numara', description: 'Resmi mac topu, el dikisi, dayanikli yapi', valorPrice: 280, condition: 'likeNew', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['https://www.joissu.com/media/catalog/product/cache/3cada5fb898338a4a9454d25fe325af0/8/5/85-500-b_1.jpg'], isPopular: true },
    { title: 'Futbol Krampon Nike', description: '42 numara, cimli saha icin, mavi-beyaz', valorPrice: 750, condition: 'good', district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: ['https://midwaysports.com/cdn/shop/files/2025-QuantumSpeed2.0-QS2-ProductShot-Royal1.png?v=1741594547'] },
    { title: 'Kaleci Eldiveni Adidas', description: 'Profesyonel kaleci eldiveni, latex kavrama, 9 numara', valorPrice: 380, condition: 'likeNew', district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: ['https://aztecasoccer.com/cdn/shop/products/adidas-mens-predator-pro-goalkeeper-gloves-white-hi-res-blue-front.jpg?v=1740828929&width=640'] },
    { title: 'Futbol Formasi Takim Seti', description: 'Forma + sort, nefes alan kumas, M beden', valorPrice: 320, condition: 'good', district: 'Alsancak', latitude: 38.4337, longitude: 27.1425, images: ['https://www.athleticknit.com/media/catalog/product/cache/f4a2ced806c9f7fc4c11297966504a34/f/8/f810-000-f.png'] },
    { title: 'Masa Tenisi Raket Seti 4lu', description: 'JOOLA marka, 4 raket + 6 top, aile seti', valorPrice: 420, condition: 'likeNew', district: 'Bornova', latitude: 38.4627, longitude: 27.2156, images: ['https://joola.com/cdn/shop/files/JOOLA-Quatro-Ping-Pong-Paddle-Set-of-4-Black-Handle.jpg?v=1768590576'], isPopular: true },
    { title: 'Pinpon Topu 12li Paket', description: '40mm standart boyut, 3 yildiz kalite', valorPrice: 65, condition: 'new', district: 'Konak', latitude: 38.4189, longitude: 27.1287, images: ['https://cdn11.bigcommerce.com/s-1d7v646c9d/images/stencil/1024x1024/products/258/701/ping-pong-ball-white__57949.1499971969.jpg?c=2'] },
    { title: 'Masa Tenisi Masasi Katlanir', description: 'Profesyonel boyut, ic mekan, tekerlekli, kolay depolama', valorPrice: 2800, condition: 'good', district: 'Karsiyaka', latitude: 38.4558, longitude: 27.1089, images: ['https://m.media-amazon.com/images/I/51qrtc-kFaL.jpg'] },
    { title: 'Voleybol Topu Mikasa', description: 'Resmi mac topu, sentetik deri, MVA serisi', valorPrice: 350, condition: 'likeNew', district: 'Balcova', latitude: 38.3897, longitude: 27.0456, images: ['https://cdn11.bigcommerce.com/s-2sxhiat0li/images/stencil/1280x1280/products/250/1491/IV58L-U-HS_Side-AD__51229.1745108069.jpg?c=2'], isPopular: true },
    { title: 'Voleybol File Seti', description: 'Portatif voleybol filesi, direk dahil, plaj/bahce icin', valorPrice: 580, condition: 'good', district: 'Buca', latitude: 38.3856, longitude: 27.1789, images: ['https://contents.mediadecathlon.com/p2942735/k$f1e7b0e6729b7793b0e3905cbed1e9a6/-bv-500-.jpg'] }
  ]

  let created = 0
  for (const product of sportsProducts) {
    const existing = await prisma.product.findFirst({ where: { title: product.title } })
    if (!existing) {
      const newProduct = await prisma.product.create({
        data: {
          title: product.title,
          description: product.description,
          valorPrice: product.valorPrice,
          condition: product.condition,
          categoryId: spor.id,
          district: product.district,
          latitude: product.latitude,
          longitude: product.longitude,
          city: 'Izmir',
          aiValorReason: 'AI tarafindan hesaplandi',
          userId: adminUser.id,
          images: product.images,
          isPopular: product.isPopular || false
        }
      })
      
      await prisma.activityFeed.create({
        data: {
          type: 'product_added',
          userId: adminUser.id,
          userName: adminUser.name || 'TAKAS-A Admin',
          productId: newProduct.id,
          productTitle: newProduct.title,
          city: 'Izmir'
        }
      })
      
      created++
      console.log('Created:', product.title)
    } else {
      console.log('Already exists:', product.title)
    }
  }

  console.log('\n' + created + ' new sports products added!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
