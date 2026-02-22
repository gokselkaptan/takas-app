'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export default function UpdateManager() {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [updating, setUpdating] = useState(false)
  const [showPullRefresh, setShowPullRefresh] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const isPullingRef = useRef(false)
  const startYRef = useRef(0)

  // Site güncelleme fonksiyonu
  const updateSite = useCallback(async () => {
    setUpdating(true)
    try {
      // 1. Service Worker cache'ini temizle
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.update()
          // Cache storage temizle
          if ('caches' in window) {
            const cacheNames = await caches.keys()
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            )
          }
        }
      }
      
      // 2. Browser cache'ini bypass ederek sayfayı yenile
      window.location.reload()
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      // Fallback: normal reload
      window.location.reload()
    }
  }, [])

  // Desktop: Sağ tık menüsü
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Sadece boş alanlarda (input, textarea, link hariç)
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'A', 'BUTTON'].includes(target.tagName)) return
      
      e.preventDefault()
      setMenuPosition({ x: e.clientX, y: e.clientY })
      setShowContextMenu(true)
    }

    const handleClick = () => setShowContextMenu(false)
    const handleScroll = () => setShowContextMenu(false)

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', handleClick)
    document.addEventListener('scroll', handleScroll)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Mobil: Pull-to-refresh
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Sadece sayfanın en üstündeyken çalışsın
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY
        isPullingRef.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current) return
      const currentY = e.touches[0].clientY
      const distance = currentY - startYRef.current

      if (distance > 0 && distance < 150) {
        setPullDistance(distance)
        setShowPullRefresh(true)
        if (distance > 50) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = () => {
      if (pullDistance > 80) {
        // Yeterli çekildi — güncelle
        updateSite()
      }
      setPullDistance(0)
      setShowPullRefresh(false)
      isPullingRef.current = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, updateSite])

  return (
    <>
      {/* Desktop Sağ Tık Menüsü */}
      {showContextMenu && (
        <div
          className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 py-2 min-w-[200px] animate-in fade-in duration-150"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <button
            onClick={updateSite}
            disabled={updating}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">🔄</span>
            {updating ? 'Güncelleniyor...' : 'Siteyi Güncelle'}
          </button>
          <button
            onClick={() => {
              setShowContextMenu(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">⬆️</span>
            Sayfanın Başına Git
          </button>
          <button
            onClick={() => {
              setShowContextMenu(false)
              window.history.back()
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">⬅️</span>
            Geri Git
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-600" />
          <button
            onClick={() => setShowContextMenu(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">✕</span>
            Kapat
          </button>
        </div>
      )}

      {/* Mobil Pull-to-Refresh Göstergesi */}
      {showPullRefresh && (
        <div
          className="fixed top-0 left-0 right-0 z-[9998] flex justify-center transition-transform duration-200"
          style={{ transform: `translateY(${Math.min(pullDistance - 20, 60)}px)` }}
        >
          <div className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 ${
            pullDistance > 80 
              ? 'bg-green-500 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}>
            <span 
              className="text-lg transition-transform duration-200"
              style={{ transform: `rotate(${Math.min(pullDistance * 3, 360)}deg)` }}
            >
              🔄
            </span>
            <span className="text-sm font-medium">
              {pullDistance > 80 ? 'Bırakın — Güncelleniyor!' : 'Güncellemek için çekin...'}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
