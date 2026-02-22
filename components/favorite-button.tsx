'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  productId: string
  initialCount?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

export function FavoriteButton({ 
  productId, 
  initialCount = 0, 
  size = 'md',
  showCount = false,
  className 
}: FavoriteButtonProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  
  // İlk yükleme - favori durumunu kontrol et
  useEffect(() => {
    if (session?.user) {
      checkFavoriteStatus()
    }
  }, [session, productId])
  
  const checkFavoriteStatus = async () => {
    try {
      const res = await fetch(`/api/favorites?productId=${productId}`)
      if (res.ok) {
        const data = await res.json()
        setIsFavorite(data.isFavorite)
      }
    } catch (error) {
      console.error('Favorite check error:', error)
    }
  }
  
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!session?.user) {
      router.push('/giris')
      return
    }
    
    if (isLoading) return
    
    setIsLoading(true)
    setIsAnimating(true)
    
    // Optimistic update
    const wasActive = isFavorite
    setIsFavorite(!wasActive)
    setCount(prev => wasActive ? prev - 1 : prev + 1)
    
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })
      
      if (res.ok) {
        const data = await res.json()
        setIsFavorite(data.isFavorite)
        setCount(data.favoriteCount)
      } else {
        // Rollback on error
        setIsFavorite(wasActive)
        setCount(prev => wasActive ? prev + 1 : prev - 1)
      }
    } catch (error) {
      console.error('Favorite toggle error:', error)
      // Rollback
      setIsFavorite(wasActive)
      setCount(prev => wasActive ? prev + 1 : prev - 1)
    } finally {
      setIsLoading(false)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }
  
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  }
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={toggleFavorite}
        disabled={isLoading}
        className={cn(
          'rounded-full flex items-center justify-center transition-all duration-200',
          'hover:scale-110 active:scale-95',
          'bg-white/90 backdrop-blur-sm shadow-md hover:shadow-lg',
          sizeClasses[size],
          isAnimating && 'animate-pulse'
        )}
        title={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      >
        <Heart
          className={cn(
            iconSizes[size],
            'transition-all duration-200',
            isFavorite 
              ? 'fill-red-500 text-red-500' 
              : 'text-gray-500 hover:text-red-400'
          )}
        />
      </button>
      
      {showCount && count > 0 && (
        <span className="text-xs text-gray-500 font-medium">
          {count}
        </span>
      )}
    </div>
  )
}

// Sadece count gösteren versiyon (ürün detayı için)
export function FavoriteCount({ count }: { count: number }) {
  if (count === 0) return null
  
  return (
    <div className="flex items-center gap-1 text-gray-500">
      <Heart className="w-4 h-4 fill-red-100 text-red-400" />
      <span className="text-sm">{count} kişi favoriledi</span>
    </div>
  )
}
