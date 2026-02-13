import prisma from '../lib/db'
import { config } from 'dotenv'
config()

// Test timeout simülasyonu için script
// Kullanım: npx tsx scripts/test_timeout.ts [create|check|run|cleanup]

async function createTestSwaps() {
  console.log('\n🧪 Test takasları oluşturuluyor...\n')
  
  // İlk kullanıcıyı bul (test kullanıcısı)
  const users = await prisma.user.findMany({ take: 2 })
  if (users.length < 2) {
    console.log('❌ En az 2 kullanıcı gerekli!')
    return
  }
  
  // Aktif ürünler bul
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    take: 3
  })
  
  if (products.length < 3) {
    console.log('❌ En az 3 aktif ürün gerekli!')
    return
  }
  
  const now = new Date()
  
  // 1. PENDING - 25 saat önce (süresi dolmuş)
  const pending25h = new Date(now.getTime() - 25 * 60 * 60 * 1000)
  const testPending = await prisma.swapRequest.create({
    data: {
      requesterId: users[0].id,
      ownerId: products[0].userId,
      productId: products[0].id,
      offeredProductId: products[1].id,
      status: 'pending',
      message: '[TEST] Timeout testi - pending 25h',
      pendingValorAmount: 50,
      createdAt: pending25h,
      updatedAt: pending25h
    }
  })
  console.log(`✅ PENDING (25h) oluşturuldu: ${testPending.id}`)
  
  // 2. ACCEPTED - 26 saat önce (süresi dolmuş)
  const accepted26h = new Date(now.getTime() - 26 * 60 * 60 * 1000)
  const testAccepted = await prisma.swapRequest.create({
    data: {
      requesterId: users[1].id,
      ownerId: products[1].userId,
      productId: products[1].id,
      offeredProductId: products[2].id,
      status: 'accepted',
      message: '[TEST] Timeout testi - accepted 26h',
      pendingValorAmount: 75,
      createdAt: accepted26h,
      updatedAt: accepted26h
    }
  })
  console.log(`✅ ACCEPTED (26h) oluşturuldu: ${testAccepted.id}`)
  
  // 3. AWAITING_DELIVERY - 30 saat önce (süresi dolmuş)
  const awaiting30h = new Date(now.getTime() - 30 * 60 * 60 * 1000)
  const testAwaiting = await prisma.swapRequest.create({
    data: {
      requesterId: users[0].id,
      ownerId: products[2].userId,
      productId: products[2].id,
      offeredProductId: products[0].id,
      status: 'awaiting_delivery',
      message: '[TEST] Timeout testi - awaiting_delivery 30h',
      pendingValorAmount: 100,
      createdAt: awaiting30h,
      updatedAt: awaiting30h
    }
  })
  console.log(`✅ AWAITING_DELIVERY (30h) oluşturuldu: ${testAwaiting.id}`)
  
  // 4. PENDING - 19 saat önce (hatırlatma almalı, 5 saat kaldı)
  const pending19h = new Date(now.getTime() - 19 * 60 * 60 * 1000)
  const testReminder = await prisma.swapRequest.create({
    data: {
      requesterId: users[1].id,
      ownerId: products[0].userId,
      productId: products[0].id,
      offeredProductId: products[2].id,
      status: 'pending',
      message: '[TEST] Hatırlatma testi - 5 saat kaldı',
      pendingValorAmount: 30,
      createdAt: pending19h,
      updatedAt: pending19h
    }
  })
  console.log(`✅ PENDING (19h - hatırlatma) oluşturuldu: ${testReminder.id}`)
  
  console.log('\n📋 Toplam 4 test takası oluşturuldu!')
  console.log('   - 3 tanesi süresi dolmuş (iptal edilecek)')
  console.log('   - 1 tanesi hatırlatma alacak (5 saat kaldı)')
  console.log('\n💡 Test etmek için: npx tsx scripts/test_timeout.ts run')
}

async function checkSwaps() {
  console.log('\n📊 Mevcut Takas Durumu:\n')
  
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const statusesToCheck = ['pending', 'accepted', 'awaiting_delivery']
  
  // Tüm aktif takasları getir
  const swaps = await prisma.swapRequest.findMany({
    where: { status: { in: statusesToCheck } },
    include: { product: { select: { title: true } } },
    orderBy: { updatedAt: 'asc' }
  })
  
  console.log(`Toplam aktif takas: ${swaps.length}\n`)
  
  let expiredCount = 0
  let reminderCount = 0
  
  for (const swap of swaps) {
    const age = now.getTime() - swap.updatedAt.getTime()
    const hours = Math.round(age / (60 * 60 * 1000))
    const hoursRemaining = 24 - hours
    
    let status = '🟢 Aktif'
    if (hoursRemaining <= 0) {
      status = '🔴 SÜRESİ DOLMUŞ'
      expiredCount++
    } else if (hoursRemaining <= 6) {
      status = '🟡 YAKIN (hatırlatma)'
      reminderCount++
    }
    
    console.log(`${status} | ${swap.status.padEnd(18)} | ${hours}h | ${hoursRemaining}h kaldı | ${swap.product.title.substring(0, 30)}`)
  }
  
  console.log(`\n📈 Özet:`)
  console.log(`   Süresi dolmuş: ${expiredCount}`)
  console.log(`   Hatırlatma alacak (≤6h): ${reminderCount}`)
  console.log(`   Normal: ${swaps.length - expiredCount - reminderCount}`)
}

async function runAutoCancelTest() {
  console.log('\n🚀 Auto-cancel API çağrılıyor...\n')
  
  try {
    const response = await fetch('http://localhost:3000/api/swap-requests/auto-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    const data = await response.json()
    
    console.log('📋 API Yanıtı:')
    console.log(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('❌ API hatası:', error)
    console.log('\n💡 Not: Dev server çalışıyor olmalı (yarn dev)')
  }
}

async function cleanupTestSwaps() {
  console.log('\n🧹 Test takasları temizleniyor...\n')
  
  const deleted = await prisma.swapRequest.deleteMany({
    where: {
      message: { startsWith: '[TEST]' }
    }
  })
  
  console.log(`✅ ${deleted.count} test takası silindi`)
}

async function main() {
  const command = process.argv[2] || 'check'
  
  console.log('═══════════════════════════════════════════════════')
  console.log('🔧 TAKAS TIMEOUT TEST ARACI')
  console.log('═══════════════════════════════════════════════════')
  
  switch (command) {
    case 'create':
      await createTestSwaps()
      break
    case 'check':
      await checkSwaps()
      break
    case 'run':
      await runAutoCancelTest()
      break
    case 'cleanup':
      await cleanupTestSwaps()
      break
    default:
      console.log('\nKullanım:')
      console.log('  npx tsx scripts/test_timeout.ts create   - Test takasları oluştur')
      console.log('  npx tsx scripts/test_timeout.ts check    - Mevcut takasları kontrol et')
      console.log('  npx tsx scripts/test_timeout.ts run      - Auto-cancel API çağır')
      console.log('  npx tsx scripts/test_timeout.ts cleanup  - Test takaslarını sil')
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)
