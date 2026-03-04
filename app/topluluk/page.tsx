'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Users, Heart, MessageCircle, Share2, Award, Package, Repeat,
  TrendingUp, Filter, Search, Clock, UserPlus, Loader2, Send,
  ChevronDown, Star, Sparkles, MoreVertical, X, RefreshCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/lib/language-context'
import { FollowButton, FollowStats } from '@/components/follow-button'
import { BadgeSummary } from '@/components/badge-display'
import { safeFetch } from '@/lib/safe-fetch'
import { toast } from 'sonner'

interface Activity {
  id: string
  type: string
  userId: string
  userName: string
  productId?: string
  productTitle?: string
  productData?: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  }
  badgeData?: {
    badgeSlug: string
    badgeName: string
    badgeIcon: string
    badgeTier: string
    valorReward: number
  }
  targetUserId?: string
  targetUserName?: string
  city?: string
  metadata?: string
  visibility: string
  likeCount: number
  commentCount: number
  isLiked: boolean
  createdAt: string
  user?: {
    id: string
    name: string
    nickname?: string
    image?: string
  }
}

interface Comment {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    nickname?: string
    image?: string
  }
}

export default function CommunityFeedPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { language } = useLanguage()
  
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [feedType, setFeedType] = useState<'public' | 'following'>('public')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  // Comments state
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentInput, setCommentInput] = useState('')
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [sendingComment, setSendingComment] = useState(false)
  
  useEffect(() => {
    fetchActivities(true)
  }, [feedType])
  
  const fetchActivities = async (reset = false) => {
    if (reset) {
      setLoading(true)
      setPage(1)
    } else {
      setLoadingMore(true)
    }
    
    try {
      const currentPage = reset ? 1 : page
      const { data, error } = await safeFetch(`/api/activity/feed?type=${feedType}&page=${currentPage}&limit=20`)
      
      if (error) {
        console.error('Feed error:', error)
        return
      }
      
      if (data) {
        if (reset) {
          setActivities(data.activities || [])
        } else {
          setActivities(prev => [...prev, ...(data.activities || [])])
        }
        setHasMore(currentPage < (data.pagination?.totalPages || 1))
        if (!reset) setPage(p => p + 1)
      }
    } catch (error) {
      console.error('Activity fetch error:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }
  
  const handleLike = async (activityId: string, isLiked: boolean) => {
    if (!session) {
      router.push('/giris')
      return
    }
    
    try {
      if (isLiked) {
        const { error } = await safeFetch(`/api/activity/like?activityId=${activityId}`, { method: 'DELETE' })
        if (error) { toast.error(error); return }
      } else {
        const { error } = await safeFetch('/api/activity/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId })
        })
        if (error) { toast.error(error); return }
      }
      
      setActivities(prev => prev.map(a => 
        a.id === activityId 
          ? { ...a, isLiked: !isLiked, likeCount: a.likeCount + (isLiked ? -1 : 1) }
          : a
      ))
    } catch (error) {
      console.error('Like error:', error)
    }
  }
  
  const loadComments = async (activityId: string) => {
    if (comments[activityId]) return
    
    setLoadingComments(activityId)
    try {
      const { data, error } = await safeFetch(`/api/activity/comment?activityId=${activityId}`)
      if (error) { console.error(error); return }
      if (data) {
        setComments(prev => ({ ...prev, [activityId]: data }))
      }
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoadingComments(null)
    }
  }
  
  const handleComment = async (activityId: string) => {
    if (!session || !commentInput.trim()) return
    
    setSendingComment(true)
    try {
      const { data, error } = await safeFetch('/api/activity/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, content: commentInput })
      })
      
      if (error) { toast.error(error); return }
      
      if (data) {
        setComments(prev => ({
          ...prev,
          [activityId]: [...(prev[activityId] || []), data]
        }))
        setActivities(prev => prev.map(a => 
          a.id === activityId ? { ...a, commentCount: a.commentCount + 1 } : a
        ))
        setCommentInput('')
      }
    } catch (error) {
      console.error('Comment error:', error)
    } finally {
      setSendingComment(false)
    }
  }
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'swap_completed': return <Repeat className="w-4 h-4 text-green-500" />
      case 'badge_earned': return <Award className="w-4 h-4 text-yellow-500" />
      case 'product_listed': return <Package className="w-4 h-4 text-blue-500" />
      case 'followed_user': return <UserPlus className="w-4 h-4 text-purple-500" />
      case 'review_given': return <Star className="w-4 h-4 text-orange-500" />
      default: return <Sparkles className="w-4 h-4 text-gray-500" />
    }
  }
  
  const getActivityText = (activity: Activity) => {
    const name = activity.user?.name || activity.user?.nickname || activity.userName || 'Kullanıcı'
    
    switch (activity.type) {
      case 'swap_completed':
        return language === 'en'
          ? `${name} completed a swap`
          : `${name} bir takas tamamladı`
      case 'badge_earned':
        return language === 'en'
          ? `${name} earned a badge`
          : `${name} yeni bir rozet kazandı`
      case 'product_listed':
        return language === 'en'
          ? `${name} listed a new product`
          : `${name} yeni bir ürün listeledi`
      case 'followed_user':
        return language === 'en'
          ? `${name} started following ${activity.targetUserName}`
          : `${name}, ${activity.targetUserName} kullanıcısını takip etmeye başladı`
      case 'review_given':
        return language === 'en'
          ? `${name} gave a review`
          : `${name} bir değerlendirme yaptı`
      default:
        return language === 'en'
          ? `${name} shared an activity`
          : `${name} bir aktivite paylaştı`
    }
  }
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return language === 'en' ? 'Just now' : 'Az önce'
    if (minutes < 60) return `${minutes}${language === 'en' ? 'm' : 'dk'}`
    if (hours < 24) return `${hours}${language === 'en' ? 'h' : 'sa'}`
    if (days < 7) return `${days}${language === 'en' ? 'd' : 'g'}`
    return date.toLocaleDateString('tr-TR')
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-20 pb-24">
      <div className="max-w-2xl mx-auto px-4">
        {/* Başlık */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-frozen-500" />
            {language === 'en' ? 'Community Feed' : 'Topluluk'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {language === 'en' 
              ? 'See what the community is up to'
              : 'Toplulukta neler oluyor gör'
            }
          </p>
        </div>

        {/* Sosyal Medya Toplulukları */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            🌐 {language === 'en' ? 'Our Social Communities' : 'Sosyal Medya Topluluklarımız'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'instagram', name: 'Instagram', icon: '📸', url: 'https://instagram.com/takasa' },
              { id: 'twitter', name: 'X (Twitter)', icon: '🐦', url: 'https://x.com/takasa' },
              { id: 'tiktok', name: 'TikTok', icon: '🎵', url: 'https://tiktok.com/@takasa' },
              { id: 'facebook', name: 'Facebook', icon: '📘', url: 'https://facebook.com/takasa' },
            ].map(link => (
              <a 
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                <span className="text-xl">{link.icon}</span>
                <span>{link.name}</span>
              </a>
            ))}
          </div>
        </div>
        
        {/* Feed Türü Seçimi */}
        <div className="flex gap-2 mb-4 sticky top-16 z-10 bg-white/80 backdrop-blur-sm py-2 -mx-4 px-4">
          <Button
            variant={feedType === 'public' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFeedType('public')}
            className={feedType === 'public' ? 'bg-frozen-500' : ''}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            {language === 'en' ? 'Explore' : 'Keşfet'}
          </Button>
          <Button
            variant={feedType === 'following' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFeedType('following')}
            disabled={!session}
            className={feedType === 'following' ? 'bg-frozen-500' : ''}
          >
            <Users className="w-4 h-4 mr-1" />
            {language === 'en' ? 'Following' : 'Takip'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchActivities(true)}
            className="ml-auto"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Aktivite Listesi */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">
              {feedType === 'following'
                ? (language === 'en' ? 'No activities from people you follow' : 'Takip ettiklerinizden aktivite yok')
                : (language === 'en' ? 'No activities yet' : 'Henüz aktivite yok')
              }
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              {language === 'en' 
                ? 'Start swapping to see activities here!'
                : 'Takas yapmaya başlayın, aktiviteler burada görünsün!'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <Link href={`/profil?userId=${activity.userId}`}>
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {activity.user?.image ? (
                            <Image
                              src={activity.user.image}
                              alt={activity.user?.name || ''}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-frozen-100 text-frozen-600 font-bold">
                              {(activity.user?.name || activity.userName || 'K')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                      </Link>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getActivityIcon(activity.type)}
                          <p className="text-sm text-gray-800">
                            {getActivityText(activity)}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatTime(activity.createdAt)}
                          {activity.city && ` • ${activity.city}`}
                        </p>
                      </div>
                      
                      {/* Follow Button */}
                      {activity.userId !== (session?.user as any)?.id && (
                        <FollowButton userId={activity.userId} size="sm" />
                      )}
                    </div>
                    
                    {/* Badge Content */}
                    {activity.type === 'badge_earned' && activity.badgeData && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{activity.badgeData.badgeIcon}</span>
                          <div>
                            <p className="font-semibold text-gray-800">{activity.badgeData.badgeName}</p>
                            {activity.badgeData.valorReward > 0 && (
                              <p className="text-xs text-green-600">+{activity.badgeData.valorReward} Valor</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Product Content */}
                    {activity.productData && (
                      <Link href={`/urun/${activity.productData.id}`}>
                        <div className="mt-3 flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                            {activity.productData.images?.[0] && (
                              <Image
                                src={activity.productData.images[0]}
                                alt={activity.productData.title}
                                fill
                                className="object-cover"
                              />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm line-clamp-1">
                              {activity.productData.title}
                            </p>
                            <p className="text-frozen-600 font-bold text-sm">
                              {activity.productData.valorPrice} Valor
                            </p>
                          </div>
                        </div>
                      </Link>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4">
                    <button
                      onClick={() => handleLike(activity.id, activity.isLiked)}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        activity.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${activity.isLiked ? 'fill-current' : ''}`} />
                      <span>{activity.likeCount}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        if (openComments === activity.id) {
                          setOpenComments(null)
                        } else {
                          setOpenComments(activity.id)
                          loadComments(activity.id)
                        }
                      }}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-frozen-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{activity.commentCount}</span>
                    </button>
                    
                    <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-500 transition-colors ml-auto">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Comments Section */}
                  <AnimatePresence>
                    {openComments === activity.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100"
                      >
                        <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                          {loadingComments === activity.id ? (
                            <div className="flex justify-center py-2">
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                          ) : comments[activity.id]?.length === 0 ? (
                            <p className="text-center text-sm text-gray-600 py-2">
                              {language === 'en' ? 'No comments yet' : 'Henüz yorum yok'}
                            </p>
                          ) : (
                            comments[activity.id]?.map(comment => (
                              <div key={comment.id} className="flex gap-2">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                  {comment.user.image ? (
                                    <Image
                                      src={comment.user.image}
                                      alt={comment.user.name || ''}
                                      width={28}
                                      height={28}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-frozen-100 text-frozen-600 text-xs font-bold">
                                      {(comment.user.name || 'K')[0].toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                                  <p className="text-xs font-medium text-gray-700">
                                    {comment.user.nickname || comment.user.name}
                                  </p>
                                  <p className="text-sm text-gray-600">{comment.content}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        
                        {/* Comment Input */}
                        {session && (
                          <div className="px-4 pb-4">
                            <div className="flex gap-2">
                              <Input
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                placeholder={language === 'en' ? 'Write a comment...' : 'Yorum yaz...'}
                                className="text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleComment(activity.id)
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleComment(activity.id)}
                                disabled={!commentInput.trim() || sendingComment}
                                className="bg-frozen-500"
                              >
                                {sendingComment ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={() => fetchActivities(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  )}
                  {language === 'en' ? 'Load More' : 'Daha Fazla'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
