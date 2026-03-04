import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Admin kontrolü
    const admin = await prisma.user.findFirst({
      where: { email: session.user.email },
      select: { role: true }
    })
    
    if (admin?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
    
    // Query parameter'dan email al
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }
    
    // Kullanıcıyı bul
    const user = await prisma.user.findFirst({
      where: { 
        email: { 
          equals: email, 
          mode: 'insensitive' // Case-insensitive arama
        } 
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        role: true,
        valorBalance: true,
        trustScore: true
      }
    })
    
    if (!user) {
      return NextResponse.json({ 
        found: false, 
        message: `Kullanıcı bulunamadı: ${email}` 
      })
    }
    
    return NextResponse.json({
      found: true,
      user: {
        ...user,
        emailVerifiedStatus: user.emailVerified ? 'Doğrulanmış ✅' : 'Doğrulanmamış ❌',
        newsletterEligible: user.emailVerified !== null
      }
    })
    
  } catch (error: any) {
    console.error('Check user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Email doğrulama (admin tarafından manuel)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Admin kontrolü
    const admin = await prisma.user.findFirst({
      where: { email: session.user.email },
      select: { role: true }
    })
    
    if (admin?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
    
    const body = await req.json()
    const { email, action } = body
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }
    
    if (action === 'verify') {
      // Email'i doğrula
      const updated = await prisma.user.updateMany({
        where: { 
          email: { equals: email, mode: 'insensitive' } 
        },
        data: { emailVerified: new Date() }
      })
      
      if (updated.count === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `${email} için email doğrulandı ✅` 
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error: any) {
    console.error('Verify user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
