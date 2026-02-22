import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Type descriptions for display
const typeDescriptions: Record<string, string> = {
  // ValorTransaction types
  'signup_bonus': 'Kayıt Bonusu',
  'referral_bonus': 'Davet Bonusu',
  'daily_bonus': 'Günlük Bonus',
  'swap_complete': 'Takas Tamamlandı',
  'swap_fee': 'Takas Ücreti',
  'swap_bonus': 'Takas Bonusu',
  'product_bonus': 'Ürün Ekleme Bonusu',
  'survey_bonus': 'Anket Bonusu',
  'milestone_bonus': 'Kilometre Taşı Bonusu',
  'badge_bonus': 'Rozet Bonusu',
  'admin_adjustment': 'Admin Düzeltmesi',
  'phone_verify_bonus': 'Telefon Doğrulama Bonusu',
  // EscrowLedger types
  'LOCK': 'Valor Kilitlendi',
  'UNLOCK': 'Valor Serbest Bırakıldı',
  'DEBIT': 'Valor Düşüldü',
  'CREDIT': 'Valor Eklendi',
  'REFUND': 'İade',
  'TRANSFER_OUT': 'Transfer Gönderildi',
  'TRANSFER_IN': 'Transfer Alındı',
  'ESCROW_LOCK': 'Escrow Kilitlendi',
  'ESCROW_RELEASE': 'Escrow Serbest',
  'BONUS': 'Bonus',
  'REWARD': 'Ödül',
  'PAYMENT': 'Ödeme',
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, valorBalance: true, lockedValor: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // ValorTransaction'dan işlemleri çek (ana tablo)
    const valorTransactions = await prisma.valorTransaction.findMany({
      where: {
        OR: [
          { fromUserId: user.id },
          { toUserId: user.id }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        swapRequest: {
          select: { 
            id: true,
            product: { select: { title: true } }
          }
        }
      }
    })

    // EscrowLedger'dan hareketleri çek (yedek)
    const ledgerEntries = await prisma.escrowLedger.findMany({
      where: {
        userId: user.id
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        swapRequest: {
          select: { 
            id: true,
            product: { select: { title: true } }
          }
        }
      }
    })

    // ValorTransaction history
    const outTypes = ['swap_fee', 'LOCK', 'DEBIT', 'TRANSFER_OUT', 'ESCROW_LOCK', 'PAYMENT']
    const inTypes = ['signup_bonus', 'referral_bonus', 'daily_bonus', 'swap_complete', 'swap_bonus', 
                     'product_bonus', 'survey_bonus', 'milestone_bonus', 'badge_bonus', 'phone_verify_bonus',
                     'UNLOCK', 'CREDIT', 'REFUND', 'TRANSFER_IN', 'ESCROW_RELEASE', 'BONUS', 'REWARD']

    const valorHistory = valorTransactions.map(tx => {
      // Determine direction based on user's role in transaction
      let direction: 'in' | 'out' = 'in'
      let amount = tx.netAmount || tx.amount
      
      if (tx.fromUserId === user.id && tx.toUserId !== user.id) {
        // User is sender only
        direction = 'out'
      } else if (tx.toUserId === user.id && tx.fromUserId !== user.id) {
        // User is receiver only
        direction = 'in'
      } else if (tx.fromUserId === user.id && tx.toUserId === user.id) {
        // Self-transaction (bonus, fee, etc)
        direction = outTypes.includes(tx.type) ? 'out' : 'in'
      } else {
        // Fallback to type-based detection
        direction = outTypes.includes(tx.type) ? 'out' : 'in'
      }
      
      return {
        id: tx.id,
        date: tx.createdAt,
        type: tx.type,
        amount,
        direction,
        description: tx.description || typeDescriptions[tx.type] || tx.type,
        productTitle: tx.swapRequest?.product?.title || null,
        swapId: tx.swapRequestId,
        source: 'valor' as const,
      }
    })

    // EscrowLedger history
    const escrowHistory = ledgerEntries.map(entry => {
      const direction = outTypes.includes(entry.type) ? 'out' : 
                       inTypes.includes(entry.type) ? 'in' : 
                       (entry.balanceAfter >= entry.balanceBefore ? 'in' : 'out')
      return {
        id: entry.id,
        date: entry.createdAt,
        type: entry.type,
        amount: entry.amount,
        direction: direction as 'in' | 'out',
        description: entry.reason || typeDescriptions[entry.type] || entry.type,
        productTitle: entry.swapRequest?.product?.title || null,
        swapId: entry.swapRequestId,
        source: 'escrow' as const,
      }
    })

    // Combine and deduplicate (prefer valor transactions, filter escrow duplicates by swapId + type + amount)
    const valorSwapKeys = new Set(
      valorHistory
        .filter(v => v.swapId)
        .map(v => `${v.swapId}-${v.type}-${v.amount}`)
    )
    
    const filteredEscrow = escrowHistory.filter(e => {
      if (!e.swapId) return true
      return !valorSwapKeys.has(`${e.swapId}-${e.type}-${e.amount}`)
    })

    // Merge and sort by date
    const combinedHistory = [...valorHistory, ...filteredEscrow]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50)

    return NextResponse.json({
      balance: user.valorBalance,
      locked: user.lockedValor,
      available: user.valorBalance - user.lockedValor,
      history: combinedHistory
    })
  } catch (error) {
    console.error('Valor history error:', error)
    return NextResponse.json({ error: 'Geçmiş yüklenemedi' }, { status: 500 })
  }
}
