import prisma from '@/lib/db'

interface SuspiciousActivity {
  userId: string
  type: string
  details: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Valor manipülasyonu tespiti
export async function checkValorManipulation(userId: string): Promise<SuspiciousActivity | null> {
  const last24h = new Date(Date.now() - 86400000)
  
  try {
    // Son 24 saatte çok fazla Valor kazanmış mı?
    const valorGained = await prisma.valorTransaction.aggregate({
      where: {
        toUserId: userId,
        amount: { gt: 0 },
        createdAt: { gte: last24h }
      },
      _sum: { amount: true }
    })
    
    const totalGained = valorGained._sum?.amount || 0
    if (totalGained > 5000) {
      return {
        userId,
        type: 'valor_manipulation',
        details: `24 saatte ${totalGained} Valor kazanıldı (limit: 5000)`,
        severity: 'high'
      }
    }
  } catch (error) {
    console.error('Valor manipulation check failed:', error)
  }
  
  return null
}

// Çoklu hesap tespiti (aynı IP'den çok fazla kayıt)
export async function checkMultipleAccounts(ip: string): Promise<SuspiciousActivity | null> {
  const last24h = new Date(Date.now() - 86400000)
  
  try {
    const recentSignups = await prisma.securityLog.count({
      where: {
        ip,
        eventType: 'signup',
        createdAt: { gte: last24h }
      }
    })
    
    if (recentSignups > 3) {
      return {
        userId: ip,
        type: 'multiple_accounts',
        details: `Aynı IP'den 24 saatte ${recentSignups} kayıt`,
        severity: 'medium'
      }
    }
  } catch (error) {
    console.error('Multiple accounts check failed:', error)
  }
  
  return null
}

// Spam takas tespiti
export async function checkSpamSwaps(userId: string): Promise<SuspiciousActivity | null> {
  const lastHour = new Date(Date.now() - 3600000)
  
  try {
    const recentSwaps = await prisma.swapRequest.count({
      where: {
        requesterId: userId,
        createdAt: { gte: lastHour }
      }
    })
    
    if (recentSwaps > 20) {
      return {
        userId,
        type: 'spam_swaps',
        details: `1 saatte ${recentSwaps} takas teklifi (limit: 20)`,
        severity: 'medium'
      }
    }
  } catch (error) {
    console.error('Spam swaps check failed:', error)
  }
  
  return null
}

// Şüpheli mesaj tespiti (çok fazla mesaj)
export async function checkSpamMessages(userId: string): Promise<SuspiciousActivity | null> {
  const lastHour = new Date(Date.now() - 3600000)
  
  try {
    const recentMessages = await prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: lastHour }
      }
    })
    
    if (recentMessages > 100) {
      return {
        userId,
        type: 'spam_messages',
        details: `1 saatte ${recentMessages} mesaj gönderildi (limit: 100)`,
        severity: 'medium'
      }
    }
  } catch (error) {
    console.error('Spam messages check failed:', error)
  }
  
  return null
}

// Hızlı ürün ekleme tespiti
export async function checkRapidProductCreation(userId: string): Promise<SuspiciousActivity | null> {
  const lastHour = new Date(Date.now() - 3600000)
  
  try {
    const recentProducts = await prisma.product.count({
      where: {
        userId,
        createdAt: { gte: lastHour }
      }
    })
    
    if (recentProducts > 10) {
      return {
        userId,
        type: 'rapid_product_creation',
        details: `1 saatte ${recentProducts} ürün eklendi (limit: 10)`,
        severity: 'low'
      }
    }
  } catch (error) {
    console.error('Rapid product creation check failed:', error)
  }
  
  return null
}

// Şüpheli aktiviteyi logla
export async function logSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
  try {
    // Aynı aktivite son 1 saat içinde zaten loglanmış mı kontrol et
    const lastHour = new Date(Date.now() - 3600000)
    const existing = await prisma.errorLog.findFirst({
      where: {
        type: `suspicious_${activity.type}`,
        userId: activity.userId,
        createdAt: { gte: lastHour }
      }
    })
    
    // Duplicate log oluşturma
    if (existing) return
    
    await prisma.errorLog.create({
      data: {
        type: `suspicious_${activity.type}`,
        message: activity.details,
        severity: activity.severity === 'critical' ? 'critical' : 'warning',
        userId: activity.userId,
        metadata: JSON.stringify(activity)
      }
    })
  } catch (error) {
    console.error('Failed to log suspicious activity:', error)
  }
}

// Tüm kontrolleri çalıştır (kullanıcı bazlı)
export async function runAllUserChecks(userId: string): Promise<void> {
  const checks = [
    checkValorManipulation(userId),
    checkSpamSwaps(userId),
    checkSpamMessages(userId),
    checkRapidProductCreation(userId)
  ]
  
  const results = await Promise.allSettled(checks)
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      await logSuspiciousActivity(result.value)
    }
  }
}
