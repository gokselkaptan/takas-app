'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Teklifler sayfası artık Takaslarım sayfasına yönlendiriliyor
// Tüm takas işlemleri tek bir yerden yönetiliyor

export default function TekliflerPage() {
  const router = useRouter()

  useEffect(() => {
    // /takaslarim sayfasına yönlendir
    router.replace('/takaslarim')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
        <p className="text-gray-600">Yönlendiriliyor...</p>
      </div>
    </div>
  )
}
