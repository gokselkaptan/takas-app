'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TakaslarimPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/takas-firsatlari')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Takas Merkezi'ne yönlendiriliyorsunuz...</p>
    </div>
  )
}
