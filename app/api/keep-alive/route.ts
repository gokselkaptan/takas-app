import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[keep-alive] DB ping failed:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
