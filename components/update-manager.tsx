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
  
  // Kopyala/Yapıştır state'leri
  const [selectedText, setSelectedText] = useState('')
  const [isInputTarget, setIsInputTarget] = useState(false)
  const [activeInputRef, setActiveInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Kopyala fonksiyonu
  const handleCopy = useCallback(async () => {
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (err) {
        console.error('Kopyalama hatası:', err)
      }
    }
    setShowContextMenu(false)
  }, [selectedText])

  // Yapıştır fonksiyonu
  const handlePaste = useCallback(async () => {
    if (activeInputRef) {
      try {
        const text = await navigator.clipboard.readText()
        const input = activeInputRef
        const start = input.selectionStart || 0
        const end = input.selectionEnd || 0
        const currentValue = input.value
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end)
        
        // React ile uyumlu değer güncelleme
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
          'value'
        )?.set
        nativeInputValueSetter?.call(input, newValue)
        
        // Input event tetikle (React'in onChange'ini tetiklemek için)
        const event = new Event('input', { bubbles: true })
        input.dispatchEvent(event)
        
        // Cursor pozisyonunu ayarla
        const newCursorPos = start + text.length
        input.setSelectionRange(newCursorPos, newCursorPos)
        input.focus()
      } catch (err) {
        console.error('Yapıştırma hatası:', err)
      }
    }
    setShowContextMenu(false)
  }, [activeInputRef])

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
      const target = e.target as HTMLElement
      
      // Seçili metni kontrol et
      const selection = window.getSelection()
      const selText = selection?.toString().trim() || ''
      setSelectedText(selText)
      
      // Input veya textarea mı kontrol et
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName)
      setIsInputTarget(isInput)
      
      if (isInput) {
        setActiveInputRef(target as HTMLInputElement | HTMLTextAreaElement)
      } else {
        setActiveInputRef(null)
      }
      
      // Link ve butonlarda varsayılan davranışı engelleme (tıklanabilir olmalı)
      if (['A', 'BUTTON'].includes(target.tagName) && !selText && !isInput) return
      
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
          {/* Kopyala - Seçili metin varsa göster */}
          {selectedText && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-lg">📋</span>
              Kopyala
            </button>
          )}
          
          {/* Yapıştır - Input/Textarea alanında göster */}
          {isInputTarget && (
            <button
              onClick={handlePaste}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-lg">📌</span>
              Yapıştır
            </button>
          )}
          
          {/* Ayırıcı - Kopyala/Yapıştır varsa */}
          {(selectedText || isInputTarget) && (
            <hr className="my-1 border-gray-200 dark:border-gray-600" />
          )}
          
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
      
      {/* Kopyalama Başarılı Bildirimi */}
      {copySuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
          ✅ Kopyalandı!
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
