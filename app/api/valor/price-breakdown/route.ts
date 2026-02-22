import { NextRequest, NextResponse } from 'next/server'
import { getValorPriceBreakdown } from '@/lib/valor-economics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const valorPrice = parseInt(searchParams.get('valor') || '0')
    const city = searchParams.get('city') || 'İzmir'

    if (valorPrice <= 0) {
      return NextResponse.json({ error: 'Geçerli valor değeri gerekli' }, { status: 400 })
    }

    const breakdown = await getValorPriceBreakdown(valorPrice, city)
    return NextResponse.json(breakdown)

  } catch (error) {
    console.error('Price breakdown error:', error)
    return NextResponse.json({ error: 'Fiyat hesaplanamadı' }, { status: 500 })
  }
}
