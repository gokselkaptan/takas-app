/**
 * Tek seferlik script: 100'ü aşan trust score'ları düzelt
 * Çalıştırmak için: npx tsx scripts/fix-trust-scores.ts
 */

import prisma from '../lib/db'

async function fixTrustScores() {
  console.log('🔧 100+ trust score düzeltme başlatılıyor...\n')
  
  // Önce kaç kullanıcı etkilenecek kontrol et
  const usersAbove100 = await prisma.user.findMany({
    where: { trustScore: { gt: 100 } },
    select: { id: true, email: true, trustScore: true }
  })
  
  console.log(`📊 ${usersAbove100.length} kullanıcı 100+ trust score'a sahip:\n`)
  
  for (const user of usersAbove100) {
    console.log(`  - ${user.email}: ${user.trustScore}`)
  }
  
  if (usersAbove100.length === 0) {
    console.log('\n✅ Düzeltilecek kullanıcı yok!')
    return
  }
  
  // Trust score'ları 100'e düşür
  const result = await prisma.user.updateMany({
    where: { trustScore: { gt: 100 } },
    data: { trustScore: 100 }
  })
  
  console.log(`\n✅ ${result.count} kullanıcının trust score'u 100'e düzeltildi`)
}

fixTrustScores()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Hata:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
