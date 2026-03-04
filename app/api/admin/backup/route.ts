import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Admin kontrolü
async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ 
    where: { email: session.user.email },
    select: { id: true, role: true, email: true }
  })
  if (!user || (user.role !== 'admin' && user.email !== 'join@takas-a.com')) return null
  return user
}

// GET - Veritabanı snapshot'ı al (JSON export)
export async function GET(request: Request) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'full'
    
    const backup: Record<string, unknown> = {
      meta: {
        version: '1.0',
        date: new Date().toISOString(),
        type,
        platform: 'TAKAS-A'
      }
    }
    
    if (type === 'full' || type === 'users') {
      backup.users = await prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true,
          valorBalance: true, trustScore: true,
          createdAt: true,
        }
      })
    }
    
    if (type === 'full' || type === 'products') {
      backup.products = await prisma.product.findMany({
        select: {
          id: true, title: true, description: true, valorPrice: true,
          condition: true, images: true, categoryId: true, userId: true,
          city: true, status: true, views: true, createdAt: true,
        }
      })
    }
    
    if (type === 'full' || type === 'swaps') {
      backup.swapRequests = await prisma.swapRequest.findMany({
        select: {
          id: true, requesterId: true, ownerId: true, productId: true,
          offeredProductId: true, pendingValorAmount: true, status: true,
          createdAt: true, updatedAt: true,
        }
      })
    }
    
    if (type === 'full' || type === 'messages') {
      backup.messages = await prisma.message.findMany({
        select: {
          id: true, senderId: true, receiverId: true, content: true,
          productId: true, isRead: true, createdAt: true,
        },
        take: 10000,
        orderBy: { createdAt: 'desc' }
      })
    }
    
    if (type === 'full' || type === 'valor') {
      backup.valorTransactions = await prisma.valorTransaction.findMany({
        select: {
          id: true, fromUserId: true, toUserId: true, amount: true, type: true,
          description: true, createdAt: true,
        },
        take: 10000,
        orderBy: { createdAt: 'desc' }
      })
    }
    
    // Yedekleme kaydını logla
    await prisma.errorLog.create({
      data: {
        type: 'backup',
        message: `DB backup taken: ${type}`,
        severity: 'info',
        userId: admin.id,
        metadata: JSON.stringify({
          type,
          userCount: Array.isArray(backup.users) ? backup.users.length : 0,
          productCount: Array.isArray(backup.products) ? backup.products.length : 0,
          swapCount: Array.isArray(backup.swapRequests) ? backup.swapRequests.length : 0,
        })
      }
    })
    
    return NextResponse.json(backup)
  } catch (error: unknown) {
    console.error('Backup error:', error)
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
