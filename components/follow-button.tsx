'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/language-context'

interface FollowButtonProps {
  userId: string
  initialFollowing?: boolean
  onFollowChange?: (isFollowing: boolean) => void
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'outline'
}

export function FollowButton({ 
  userId, 
  initialFollowing = false,
  onFollowChange,
  size = 'default',
  variant = 'default'
}: FollowButtonProps) {
  const { data: session } = useSession()
  const sessionUserId = (session?.user as any)?.id
  const router = useRouter()
  const { language } = useLanguage()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  
  useEffect(() => {
    if (sessionUserId && userId !== sessionUserId) {
      checkFollowStatus()
    } else {
      setChecking(false)
    }
  }, [sessionUserId, userId])
  
  const checkFollowStatus = async () => {
    try {
      const res = await fetch(`/api/follow?userId=${userId}&type=check`)
      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.isFollowing)
      }
    } catch (error) {
      console.error('Failed to check follow status:', error)
    } finally {
      setChecking(false)
    }
  }
  
  const handleFollow = async () => {
    if (!session) {
      router.push('/giris')
      return
    }
    
    setLoading(true)
    try {
      if (isFollowing) {
        // Takipten çık
        const res = await fetch(`/api/follow?userId=${userId}`, { method: 'DELETE' })
        if (res.ok) {
          setIsFollowing(false)
          onFollowChange?.(false)
        }
      } else {
        // Takip et
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        if (res.ok) {
          setIsFollowing(true)
          onFollowChange?.(true)
        }
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Kendi profilinde gösterme
  if (sessionUserId === userId) return null
  
  if (checking) {
    return (
      <Button variant="outline" size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    )
  }
  
  return (
    <Button
      onClick={handleFollow}
      disabled={loading}
      variant={isFollowing ? 'outline' : variant}
      size={size}
      className={`gap-1.5 ${isFollowing ? 'text-gray-600 hover:text-red-500 hover:border-red-300' : 'bg-frozen-500 hover:bg-frozen-600 text-white'}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="w-4 h-4" />
          <span>{language === 'en' ? 'Following' : 'Takip Ediliyor'}</span>
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          <span>{language === 'en' ? 'Follow' : 'Takip Et'}</span>
        </>
      )}
    </Button>
  )
}

// Takipçi/Takip sayıları komponenti
export function FollowStats({ userId }: { userId: string }) {
  const { language } = useLanguage()
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 })
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
  }, [userId])
  
  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/follow?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch follow stats:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex gap-4 animate-pulse">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
      </div>
    )
  }
  
  return (
    <div className="flex gap-4 text-sm">
      <div className="flex items-center gap-1">
        <span className="font-bold text-gray-800">{stats.followerCount}</span>
        <span className="text-gray-500">
          {language === 'en' ? 'Followers' : 'Takipçi'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-gray-800">{stats.followingCount}</span>
        <span className="text-gray-500">
          {language === 'en' ? 'Following' : 'Takip'}
        </span>
      </div>
    </div>
  )
}
