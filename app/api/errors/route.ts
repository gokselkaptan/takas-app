import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Admin için hataları listele
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Admin kontrolü
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    });
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved !== null && resolved !== '') {
      where.resolved = resolved === 'true';
    }
    
    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.errorLog.count({ where })
    ]);
    
    // İstatistikler
    const stats = await prisma.errorLog.groupBy({
      by: ['type', 'severity', 'resolved'],
      _count: true
    });
    
    return NextResponse.json({
      errors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Yeni hata kaydet (client-side hatalar için)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, message, stack, componentStack, url, metadata, severity } = body;
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    // Session varsa user ID'yi al
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true }
        });
        userId = user?.id || null;
      }
    } catch {
      // Session yoksa devam et
    }
    
    // User agent'ı request header'dan al
    const userAgent = request.headers.get('user-agent') || null;
    
    const errorLog = await prisma.errorLog.create({
      data: {
        type: type || 'client',
        message,
        stack,
        componentStack,
        url,
        userAgent,
        userId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        severity: severity || 'error'
      }
    });
    
    return NextResponse.json({ success: true, id: errorLog.id });
  } catch (error) {
    console.error('Error logging error:', error);
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}

// PATCH - Hata durumunu güncelle (çözüldü olarak işaretle)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { id, resolved } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Error ID is required' }, { status: 400 });
    }
    
    const errorLog = await prisma.errorLog.update({
      where: { id },
      data: {
        resolved: resolved !== false,
        resolvedAt: resolved !== false ? new Date() : null,
        resolvedBy: resolved !== false ? user.id : null
      }
    });
    
    return NextResponse.json({ success: true, error: errorLog });
  } catch (error) {
    console.error('Error updating error:', error);
    return NextResponse.json({ error: 'Failed to update error' }, { status: 500 });
  }
}

// DELETE - Eski hataları temizle
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    });
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThan') || '30');
    const onlyResolved = searchParams.get('onlyResolved') === 'true';
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      createdAt: { lt: cutoffDate }
    };
    
    if (onlyResolved) {
      where.resolved = true;
    }
    
    const result = await prisma.errorLog.deleteMany({ where });
    
    return NextResponse.json({ 
      success: true, 
      deleted: result.count,
      message: `${result.count} hata kaydı silindi`
    });
  } catch (error) {
    console.error('Error deleting errors:', error);
    return NextResponse.json({ error: 'Failed to delete errors' }, { status: 500 });
  }
}
