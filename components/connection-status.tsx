'use client'

import { useState, useEffect } from 'react'

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const goOnline = () => {
      setIsOnline(true)
      setShowBack(true)
      setTimeout(() => setShowBack(false), 3000)
    }
    const goOffline = () => {
      setIsOnline(false)
      setShowBack(false)
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (isOnline && !showBack) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
      {!isOnline && (
        <div className="mt-2 px-4 py-2 bg-red-500 text-white rounded-full shadow-lg text-sm font-medium">
          📴 İnternet bağlantısı yok
        </div>
      )}
      {isOnline && showBack && (
        <div className="mt-2 px-4 py-2 bg-green-500 text-white rounded-full shadow-lg text-sm font-medium">
          ✅ Bağlantı geri geldi
        </div>
      )}
    </div>
  )
}
