import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Legacy QR/scan endpoint.
 * Canonical teslim doğrulama akışı artık shape-code endpointleri üzerindedir.
 * Bu endpoint aktif akışla çakışmayı önlemek için güvenli no-op davranışına çekildi.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      legacy: true,
      error: 'QR tabanlı teslim doğrulama artık aktif değil. Lütfen Shape Code akışını kullanın.',
      next: {
        generate: '/api/swap-requests/shape-code/generate',
        verify: '/api/swap-requests/shape-code/verify',
      },
    },
    { status: 410 }
  )
}
