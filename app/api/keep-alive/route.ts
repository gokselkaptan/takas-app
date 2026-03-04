import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

// Disable caching for this endpoint to ensure DB is always pinged
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Ping database to keep connection warm
    await prisma.$queryRaw`SELECT 1`
    
    const response = NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    })
    
    // Ensure no caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    
    return response
  } catch (error) {
    console.error('[keep-alive] DB ping failed:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
