'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Users, MapPin, Calendar, MessageCircle, Crown, Shield,
  Plus, Heart, Share2, Settings, Bell, TrendingUp, Award,
  Send, Image as ImageIcon, Sparkles, Clock, ChevronRight,
  ArrowLeft, MoreHorizontal, Star, Zap
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { toast } from 'sonner'
import { getDisplayName } from '@/lib/display-name'

interface CommunityDetail {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  district: string | null
  neighborhood: string | null
  coverImage: string | null
  icon: string | null
  type: string
  isOfficial: boolean
  isPrivate: boolean
  rules: string | null
  tags: string[]
  members: any[]
  posts: any[]
  events: any[]
  announcements: any[]
  membership: {
    role: string
    joinedAt: string
    swapsInCommunity: number
    reputation: number
    badges: string[]
  } | null
  stats: {
    memberCount: number
    postCount: number
    eventCount: number
    weeklyActivity: number
    swapCount: number
  }
}

const translations = {
  tr: {
    members: 'Üyeler',
    posts: 'Gönderiler',
    events: 'Etkinlikler',
    about: 'Hakkında',
    rules: 'Kurallar',
    swapsHere: 'Topluluk Takası',
    weeklyActive: 'Haftalık Aktif',
    join: 'Topluluğa Katıl',
    leave: 'Ayrıl',
    share: 'Paylaş',
    settings: 'Ayarlar',
    writePost: 'Bir şeyler paylaş...',
    post: 'Paylaş',
    noPostsYet: 'Henüz gönderi yok',
    beFirstToPost: 'İlk gönderiyi siz paylaşın!',
    upcomingEvents: 'Yakın Etkinlikler',
    noEvents: 'Henüz etkinlik yok',
    createEvent: 'Etkinlik Oluştur',
    topMembers: 'En Aktif Üyeler',
    admin: 'Yönetici',
    moderator: 'Moderatör',
    ambassador: 'Elçi',
    member: 'Üye',
    loginRequired: 'Katılmak için giriş yapın',
    joinSuccess: 'Topluluğa katıldınız!',
    leaveSuccess: 'Topluluktan ayrıldınız',
    postSuccess: 'Gönderiniz paylaşıldı!',
    notFound: 'Topluluk bulunamadı',
    lookingFor: 'Arıyorum',
    swapSuccess: 'Başarılı Takas',
    giveaway: 'Hediye',
    tip: 'İpucu',
    general: 'Genel',
    back: 'Geri',
  },
  en: {
    members: 'Members',
    posts: 'Posts',
    events: 'Events',
    about: 'About',
    rules: 'Rules',
    swapsHere: 'Community Swaps',
    weeklyActive: 'Weekly Active',
    join: 'Join Community',
    leave: 'Leave',
    share: 'Share',
    settings: 'Settings',
    writePost: 'Share something...',
    post: 'Post',
    noPostsYet: 'No posts yet',
    beFirstToPost: 'Be the first to post!',
    upcomingEvents: 'Upcoming Events',
    noEvents: 'No events yet',
    createEvent: 'Create Event',
    topMembers: 'Top Members',
    admin: 'Admin',
    moderator: 'Moderator',
    ambassador: 'Ambassador',
    member: 'Member',
    loginRequired: 'Login to join',
    joinSuccess: 'You joined the community!',
    leaveSuccess: 'You left the community',
    postSuccess: 'Your post was shared!',
    notFound: 'Community not found',
    lookingFor: 'Looking For',
    swapSuccess: 'Successful Swap',
    giveaway: 'Giveaway',
    tip: 'Tip',
    general: 'General',
    back: 'Back',
  },
  es: {
    members: 'Miembros',
    posts: 'Publicaciones',
    events: 'Eventos',
    about: 'Acerca de',
    rules: 'Reglas',
    swapsHere: 'Intercambios Comunitarios',
    weeklyActive: 'Activos Semanales',
    join: 'Unirse',
    leave: 'Salir',
    share: 'Compartir',
    settings: 'Ajustes',
    writePost: 'Comparte algo...',
    post: 'Publicar',
    noPostsYet: 'Aún no hay publicaciones',
    beFirstToPost: '¡Sé el primero en publicar!',
    upcomingEvents: 'Próximos Eventos',
    noEvents: 'Aún no hay eventos',
    createEvent: 'Crear Evento',
    topMembers: 'Mejores Miembros',
    admin: 'Admin',
    moderator: 'Moderador',
    ambassador: 'Embajador',
    member: 'Miembro',
    loginRequired: 'Inicia sesión para unirte',
    joinSuccess: '¡Te uniste a la comunidad!',
    leaveSuccess: 'Saliste de la comunidad',
    postSuccess: '¡Tu publicación fue compartida!',
    notFound: 'Comunidad no encontrada',
    lookingFor: 'Buscando',
    swapSuccess: 'Intercambio Exitoso',
    giveaway: 'Regalo',
    tip: 'Consejo',
    general: 'General',
    back: 'Atrás',
  },
  ca: {
    members: 'Membres',
    posts: 'Publicacions',
    events: 'Esdeveniments',
    about: 'Sobre',
    rules: 'Regles',
    swapsHere: 'Intercanvis Comunitaris',
    weeklyActive: 'Actius Setmanals',
    join: 'Unir-se',
    leave: 'Sortir',
    share: 'Compartir',
    settings: 'Ajustos',
    writePost: 'Comparteix quelcom...',
    post: 'Publicar',
    noPostsYet: 'Encara no hi ha publicacions',
    beFirstToPost: 'Sigues el primer en publicar!',
    upcomingEvents: 'Propers Esdeveniments',
    noEvents: 'Encara no hi ha esdeveniments',
    createEvent: 'Crear Esdeveniment',
    topMembers: 'Millors Membres',
    admin: 'Admin',
    moderator: 'Moderador',
    ambassador: 'Ambaixador',
    member: 'Membre',
    loginRequired: 'Inicia sessió per unir-te',
    joinSuccess: 'T\'has unit a la comunitat!',
    leaveSuccess: 'Has sortit de la comunitat',
    postSuccess: 'La teva publicació s\'ha compartit!',
    notFound: 'Comunitat no trobada',
    lookingFor: 'Cercant',
    swapSuccess: 'Intercanvi Exitós',
    giveaway: 'Regal',
    tip: 'Consell',
    general: 'General',
    back: 'Enrere',
  }
}

const postTypeIcons: Record<string, any> = {
  general: MessageCircle,
  looking_for: Zap,
  swap_success: Star,
  giveaway: Heart,
  tip: Sparkles
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  moderator: 'bg-blue-100 text-blue-700',
  ambassador: 'bg-orange-100 text-orange-700',
  member: 'bg-gray-100 text-gray-700'
}

export default function CommunityDetailPage() {
  const { data: session } = useSession()
  const { language } = useLanguage()
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const t = translations[language] || translations.tr

  const [community, setCommunity] = useState<CommunityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posts')
  const [newPost, setNewPost] = useState('')
  const [postType, setPostType] = useState('general')
  const [posting, setPosting] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const res = await fetch(`/api/communities/${slug}`)
        if (!res.ok) {
          if (res.status === 404) {
            toast.error(t.notFound)
            router.push('/topluluklar')
            return
          }
          throw new Error('Fetch failed')
        }
        const data = await res.json()
        setCommunity(data)
      } catch (error) {
        console.error('Community fetch error:', error)
        toast.error('Hata oluştu')
      } finally {
        setLoading(false)
      }
    }
    fetchCommunity()
  }, [slug])

  const handleJoin = async () => {
    if (!session) {
      toast.error(t.loginRequired)
      router.push('/giris')
      return
    }
    if (!community) return

    setJoining(true)
    try {
      const res = await fetch(`/api/communities/${community.id}/join`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t.joinSuccess)
        setCommunity(prev => prev ? {
          ...prev,
          membership: { role: 'member', joinedAt: new Date().toISOString(), swapsInCommunity: 0, reputation: 0, badges: [] },
          stats: { ...prev.stats, memberCount: prev.stats.memberCount + 1 }
        } : null)
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Hata oluştu')
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    if (!community) return
    
    setJoining(true)
    try {
      const res = await fetch(`/api/communities/${community.id}/join`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t.leaveSuccess)
        setCommunity(prev => prev ? {
          ...prev,
          membership: null,
          stats: { ...prev.stats, memberCount: prev.stats.memberCount - 1 }
        } : null)
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Hata oluştu')
    } finally {
      setJoining(false)
    }
  }

  const handlePost = async () => {
    if (!newPost.trim() || !community?.membership) return

    setPosting(true)
    try {
      const res = await fetch(`/api/communities/${community.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: postType,
          content: newPost
        })
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t.postSuccess)
        setNewPost('')
        // Add post to list
        setCommunity(prev => prev ? {
          ...prev,
          posts: [{ ...data.post, author: { name: session?.user?.name, image: session?.user?.image } }, ...prev.posts]
        } : null)
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Hata oluştu')
    } finally {
      setPosting(false)
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: t.admin,
      moderator: t.moderator,
      ambassador: t.ambassador,
      member: t.member
    }
    return labels[role] || role
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8 px-4">
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-48 bg-gray-200 rounded-2xl mb-4" />
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t.notFound}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-orange-50">
      {/* Cover */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-purple-500 to-orange-500">
        {community.coverImage && (
          <Image
            src={community.coverImage}
            alt={community.name}
            fill
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex gap-2">
          {community.isOfficial && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full">
              <Crown size={14} /> {language === 'tr' ? 'Resmi' : 'Official'}
            </span>
          )}
        </div>

        {/* Community Info */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{community.name}</h1>
          <div className="flex items-center gap-2 text-white/90 text-sm">
            <MapPin size={14} />
            <span>{community.district || community.city}</span>
            <span className="mx-2">•</span>
            <Users size={14} />
            <span>{community.stats.memberCount} {t.members}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          {community.membership ? (
            <>
              <button
                onClick={handleLeave}
                disabled={joining}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-gray-700 rounded-xl font-medium shadow-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {t.leave}
              </button>
              {['admin', 'moderator'].includes(community.membership.role) && (
                <button className="p-3 bg-white text-gray-700 rounded-xl shadow-lg hover:bg-gray-50">
                  <Settings size={20} />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {joining ? '⏳' : <Plus size={20} />}
              {t.join}
            </button>
          )}
          <button className="p-3 bg-white text-gray-700 rounded-xl shadow-lg hover:bg-gray-50">
            <Share2 size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: t.members, value: community.stats.memberCount, icon: Users },
            { label: t.posts, value: community.stats.postCount, icon: MessageCircle },
            { label: t.swapsHere, value: community.stats.swapCount, icon: TrendingUp },
            { label: t.weeklyActive, value: community.stats.weeklyActivity, icon: Zap }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-3 text-center shadow-lg">
              <stat.icon className="mx-auto text-purple-600 mb-1" size={20} />
              <div className="font-bold text-lg">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['posts', 'members', 'events', 'about'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t[tab as keyof typeof t] || tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pb-20">
          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {/* New Post */}
              {community.membership && (
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <div className="flex gap-2 mb-3">
                    {['general', 'looking_for', 'swap_success', 'tip'].map(type => {
                      const Icon = postTypeIcons[type] || MessageCircle
                      return (
                        <button
                          key={type}
                          onClick={() => setPostType(type)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                            postType === type
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon size={14} />
                          {t[type as keyof typeof t] || type}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder={t.writePost}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handlePost}
                      disabled={!newPost.trim() || posting}
                      className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {posting ? '⏳' : <Send size={18} />}
                      {t.post}
                    </button>
                  </div>
                </div>
              )}

              {/* Posts List */}
              {community.posts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                  <MessageCircle className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">{t.noPostsYet}</p>
                  <p className="text-sm text-gray-400 mt-1">{t.beFirstToPost}</p>
                </div>
              ) : (
                community.posts.map((post: any) => {
                  const Icon = postTypeIcons[post.type] || MessageCircle
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl p-4 shadow-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-orange-400 flex items-center justify-center text-white font-bold">
                          {post.author?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {getDisplayName(post.author)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${roleColors[post.type] || 'bg-gray-100 text-gray-700'}`}>
                              <Icon size={12} />
                              {t[post.type as keyof typeof t] || post.type}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">{post.content}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {new Date(post.createdAt).toLocaleDateString(language)}
                            </span>
                            <button className="flex items-center gap-1 hover:text-red-500">
                              <Heart size={14} />
                              {post.likes}
                            </button>
                            <button className="flex items-center gap-1 hover:text-purple-500">
                              <MessageCircle size={14} />
                              {post.commentCount || post.comments}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-lg mb-4">{t.topMembers}</h3>
              <div className="space-y-3">
                {community.members.map((member: any, i: number) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-8 h-8 flex items-center justify-center font-bold text-gray-400">
                      #{i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-orange-400 flex items-center justify-center text-white font-bold overflow-hidden">
                      {member.user?.image ? (
                        <Image src={member.user.image} alt="" width={40} height={40} className="object-cover" />
                      ) : (
                        member.user?.name?.[0] || '?'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {getDisplayName(member.user)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.swapsInCommunity} {t.swapsHere.toLowerCase()}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                      {getRoleLabel(member.role)}
                    </span>
                    {member.badges?.includes('founder') && (
                      <Award className="text-yellow-500" size={18} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {community.membership && ['admin', 'moderator', 'ambassador'].includes(community.membership.role) && (
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700">
                  <Plus size={20} />
                  {t.createEvent}
                </button>
              )}
              
              {community.events.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                  <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">{t.noEvents}</p>
                </div>
              ) : (
                community.events.map((event: any) => (
                  <div key={event.id} className="bg-white rounded-2xl p-4 shadow-lg">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-purple-600">
                          {new Date(event.startDate).getDate()}
                        </span>
                        <span className="text-xs text-purple-500">
                          {new Date(event.startDate).toLocaleString(language, { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold mb-1">{event.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {event.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {event.attendeeCount} kişi
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              {community.description && (
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <h3 className="font-bold text-lg mb-3">{t.about}</h3>
                  <p className="text-gray-700">{community.description}</p>
                </div>
              )}
              
              {community.rules && (
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <h3 className="font-bold text-lg mb-3">{t.rules}</h3>
                  <div className="prose prose-sm max-w-none">
                    {community.rules}
                  </div>
                </div>
              )}

              {community.tags?.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <h3 className="font-bold text-lg mb-3">Etiketler</h3>
                  <div className="flex flex-wrap gap-2">
                    {community.tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
