import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Rate limit kontrolü
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const rateLimitResult = await checkRateLimit(ip, 'api/messages')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla mesaj gönderdiniz. Lütfen biraz bekleyin.' },
        { status: 429 }
      )
    }
    
    const body = await request.json()
    const { name, email, phone, subject, message } = body ?? {}

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Ad, email ve mesaj alanları gerekli' },
        { status: 400 }
      )
    }

    const contact = await prisma.contact.create({
      data: {
        name: sanitizeText(name),
        email: email.toLowerCase().trim(),
        phone: phone ?? null,
        subject: subject ? sanitizeText(subject) : null,
        message: sanitizeText(message),
      },
    })

    return NextResponse.json({
      success: true,
      id: contact.id,
      message: 'Mesajınız başarıyla gönderildi',
    })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderilirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
