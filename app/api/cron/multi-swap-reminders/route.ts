import { NextRequest, NextResponse } from 'next/server'
import { sendMultiSwapReminders } from '@/lib/multi-swap-reminders'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // CRON_SECRET kontrolü
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    console.log('🔔 Multi-swap reminders cron başlatıldı...')
    
    const result = await sendMultiSwapReminders()
    
    console.log('✅ Multi-swap reminders cron tamamlandı:', result)
    
    return NextResponse.json({ 
      success: true, 
      ...result,
      timestamp: new Date().toISOString() 
    })
  } catch (error: any) {
    console.error('Multi-swap reminders cron error:', error)
    return NextResponse.json({ 
      error: 'Internal error',
      message: error.message 
    }, { status: 500 })
  }
}
