import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { USER_LEVELS } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Admin kontrolü
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const checks: Array<{ test: string; status: string; detail: string }> = []
    
    // 1. Seviye sistemi kontrol
    checks.push({
      test: 'Seviye sistemi',
      status: USER_LEVELS.length === 6 ? 'PASS' : 'FAIL',
      detail: `${USER_LEVELS.length} seviye tanımlı`
    })
    
    // 2. Toplam kullanıcı sayısı
    const totalUsers = await prisma.user.count()
    checks.push({
      test: 'Toplam kullanıcı',
      status: 'INFO',
      detail: `${totalUsers} kullanıcı`
    })
    
    // 3. Trust score anomalileri
    const overTrust = await prisma.user.count({ where: { trustScore: { gt: 100 } } })
    const negativeTrust = await prisma.user.count({ where: { trustScore: { lt: 0 } } })
    checks.push({
      test: 'Trust score anomali',
      status: overTrust === 0 && negativeTrust === 0 ? 'PASS' : 'FAIL',
      detail: `100+ üstü: ${overTrust}, Negatif: ${negativeTrust}`
    })
    
    // 4. Negatif bakiye
    const negativeBalance = await prisma.user.count({ where: { valorBalance: { lt: 0 } } })
    checks.push({
      test: 'Negatif bakiye',
      status: negativeBalance === 0 ? 'PASS' : 'WARN',
      detail: `${negativeBalance} kullanıcı negatif bakiyede`
    })
    
    // 5. Toplam Valor dolaşımı
    const totalValor = await prisma.user.aggregate({ _sum: { valorBalance: true } })
    checks.push({
      test: 'Toplam Valor dolaşımı',
      status: 'INFO',
      detail: `${(totalValor._sum.valorBalance ?? 0).toLocaleString()} Valor`
    })
    
    // 6. Aktif ürün sayısı
    const activeProducts = await prisma.product.count({ where: { status: 'active' } })
    checks.push({
      test: 'Aktif ürünler',
      status: 'INFO',
      detail: `${activeProducts} aktif ürün`
    })
    
    // 7. Tamamlanan takas sayısı
    const completedSwaps = await prisma.swapRequest.count({ where: { status: 'completed' } })
    checks.push({
      test: 'Tamamlanan takaslar',
      status: 'INFO',
      detail: `${completedSwaps} takas`
    })
    
    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        pass: checks.filter(c => c.status === 'PASS').length,
        fail: checks.filter(c => c.status === 'FAIL').length,
        warn: checks.filter(c => c.status === 'WARN').length,
        info: checks.filter(c => c.status === 'INFO').length,
      }
    })
  } catch (error) {
    console.error('Test economy error:', error)
    return NextResponse.json({ error: 'Test başarısız' }, { status: 500 })
  }
}
