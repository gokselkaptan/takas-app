/**
 * Çoklu Takas VALOR Transfer Otomasyonu
 * 
 * Çoklu takas tamamlandığında VALOR farklarını otomatik transfer eder
 * 
 * Örnek: A(150V) → B(120V) → C(100V) → A
 * - A: 150V veriyor, 100V alıyor → -50V (öder)
 * - B: 120V veriyor, 150V alıyor → +30V (alır)
 * - C: 100V veriyor, 120V alıyor → +20V (alır)
 * 
 * Toplam: -50 + 30 + 20 = 0 (Denge korunur)
 */

import prisma from '@/lib/db'

interface MultiSwapParticipant {
  userId: string
  productId: string
  receivedProductId: string
}

interface ValorTransferResult {
  success: boolean
  transfers: Array<{
    userId: string
    amount: number
    type: 'multi_swap_gain' | 'multi_swap_payment'
  }>
  totalDifference: number
  error?: string
}

/**
 * Çoklu takas tamamlandığında VALOR farklarını otomatik transfer eder
 */
export async function processMultiSwapValorTransfer(
  multiSwapId: string,
  participants: MultiSwapParticipant[]
): Promise<ValorTransferResult> {
  const transfers: ValorTransferResult['transfers'] = []
  
  try {
    // 1. Her katılımcı için verdiği ve aldığı ürünün VALOR değerini al
    for (const participant of participants) {
      const givenProduct = await prisma.product.findUnique({
        where: { id: participant.productId },
        select: { valorPrice: true, title: true }
      })
      
      const receivedProduct = await prisma.product.findUnique({
        where: { id: participant.receivedProductId },
        select: { valorPrice: true, title: true }
      })
      
      if (!givenProduct || !receivedProduct) {
        console.error(`Product not found for participant ${participant.userId}`)
        continue
      }
      
      // 2. Farkı hesapla (aldığı - verdiği)
      const valorDifference = receivedProduct.valorPrice - givenProduct.valorPrice
      
      if (valorDifference !== 0) {
        const type = valorDifference > 0 ? 'multi_swap_gain' : 'multi_swap_payment'
        
        // 3. VALOR transferi yap - ValorTransaction kaydı oluştur
        await prisma.valorTransaction.create({
          data: {
            fromUserId: valorDifference < 0 ? participant.userId : null,
            toUserId: valorDifference > 0 ? participant.userId : null,
            amount: Math.abs(valorDifference),
            netAmount: Math.abs(valorDifference),
            fee: 0,
            type: type,
            multiSwapId: multiSwapId,
            description: valorDifference > 0 
              ? `Çoklu takas VALOR kazancı: ${givenProduct.title} → ${receivedProduct.title}`
              : `Çoklu takas VALOR ödemesi: ${givenProduct.title} → ${receivedProduct.title}`
          }
        })
        
        // 4. Kullanıcı bakiyesini güncelle
        await prisma.user.update({
          where: { id: participant.userId },
          data: {
            valorBalance: {
              increment: valorDifference
            }
          }
        })
        
        transfers.push({
          userId: participant.userId,
          amount: valorDifference,
          type: type
        })
        
        console.log(`[VALOR Transfer] User ${participant.userId}: ${valorDifference > 0 ? '+' : ''}${valorDifference} VALOR (${type})`)
      }
    }
    
    // 5. Denge kontrolü - toplam fark 0 olmalı
    const totalDifference = transfers.reduce((sum, t) => sum + t.amount, 0)
    
    if (Math.abs(totalDifference) > 1) { // Küçük yuvarlama hatalarını tolere et
      console.warn(`[VALOR Transfer] Balance check failed: total difference = ${totalDifference}`)
    }
    
    return {
      success: true,
      transfers,
      totalDifference
    }
    
  } catch (error) {
    console.error('[VALOR Transfer] Error:', error)
    return {
      success: false,
      transfers,
      totalDifference: 0,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }
  }
}

/**
 * Çoklu takas için VALOR fark özetini hesaplar (önizleme için)
 */
export async function calculateMultiSwapValorSummary(
  participants: MultiSwapParticipant[]
): Promise<Array<{
  userId: string
  givenValor: number
  receivedValor: number
  difference: number
}>> {
  const summary: Array<{
    userId: string
    givenValor: number
    receivedValor: number
    difference: number
  }> = []
  
  for (const participant of participants) {
    const givenProduct = await prisma.product.findUnique({
      where: { id: participant.productId },
      select: { valorPrice: true }
    })
    
    const receivedProduct = await prisma.product.findUnique({
      where: { id: participant.receivedProductId },
      select: { valorPrice: true }
    })
    
    if (givenProduct && receivedProduct) {
      summary.push({
        userId: participant.userId,
        givenValor: givenProduct.valorPrice,
        receivedValor: receivedProduct.valorPrice,
        difference: receivedProduct.valorPrice - givenProduct.valorPrice
      })
    }
  }
  
  return summary
}

/**
 * Kullanıcının VALOR bakiyesinin çoklu takas için yeterli olup olmadığını kontrol eder
 */
export async function checkUserValorBalance(
  userId: string,
  requiredAmount: number
): Promise<{ sufficient: boolean; balance: number; deficit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { valorBalance: true, lockedValor: true }
  })
  
  if (!user) {
    return { sufficient: false, balance: 0, deficit: requiredAmount }
  }
  
  const availableBalance = user.valorBalance - (user.lockedValor || 0)
  const deficit = requiredAmount - availableBalance
  
  return {
    sufficient: availableBalance >= requiredAmount,
    balance: availableBalance,
    deficit: deficit > 0 ? deficit : 0
  }
}
