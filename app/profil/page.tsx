'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { 
  User, Package, ClipboardList, Settings, Edit2, Save, X, 
  MapPin, Phone, Mail, Calendar, Star, CheckCircle, ChevronRight,
  Eye, EyeOff, Heart, TrendingUp, Award, Bell, Tag, Gift, ShoppingBag,
  MessageSquare, Filter, SlidersHorizontal, Search, Sparkles,
  ArrowUpDown, Clock, CheckCheck, Check, Send, AlertTriangle, ArrowLeft, Shield,
  Coins, Trophy, Target, Zap, Camera, Upload, Loader2, MoreVertical,
  Users, Plus, UserPlus, RefreshCcw, Smile, Paperclip, Image as ImageIcon,
  ArrowLeftRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FavoriteButton } from '@/components/favorite-button'
import { usePushNotifications } from '@/components/pwa-provider'
import { useLanguage } from '@/lib/language-context'
import { FollowButton, FollowStats } from '@/components/follow-button'
import { isAppBadgeSupported, isAppBadgeEnabled, setAppBadgeEnabled } from '@/lib/app-badge'
import { safeFetch, safeGet, isOffline } from '@/lib/safe-fetch'
import { SocialShareWidget } from '@/components/social-share-widget'
import { SoundSettingsPanel } from '@/components/sound-settings'
import { playMessageSound, playSuccessSound, playCoinSound } from '@/lib/notification-sounds'

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY LOADED COMPONENTS - Reduces initial bundle by ~80KB
// ═══════════════════════════════════════════════════════════════════════════════
const SwapManagement = dynamic(() => import('@/components/swap-management').then(mod => ({ default: mod.SwapManagement })), {
  loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>,
  ssr: false
})

const BadgeDisplay = dynamic(() => import('@/components/badge-display').then(mod => ({ default: mod.BadgeDisplay })), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-32" />,
  ssr: false
})

const UserRatingSummary = dynamic(() => import('@/components/user-rating').then(mod => ({ default: mod.UserRatingSummary })), {
  ssr: false
})

const ReviewList = dynamic(() => import('@/components/user-rating').then(mod => ({ default: mod.ReviewList })), {
  ssr: false
})

const TrustBadge = dynamic(() => import('@/components/user-rating').then(mod => ({ default: mod.TrustBadge })), {
  ssr: false
})

const ReviewModal = dynamic(() => import('@/components/review-modal').then(mod => ({ default: mod.ReviewModal })), {
  ssr: false
})

interface UserProfile {
  id: string
  name: string
  nickname: string | null
  email: string
  image: string | null
  bio: string | null
  phone: string | null
  location: string | null
  trustScore: number
  valorBalance: number
  lockedValor: number
  isPremium: boolean
  surveyCompleted: boolean
  surveyData: Record<string, any> | null
  createdAt: string
  isPhoneVerified: boolean
  isIdentityVerified: boolean
  notificationsEnabled?: boolean
  swapNotificationsEnabled?: boolean
  _count: {
    products: number
  }
}

interface Product {
  id: string
  title: string
  images: string[]
  valorPrice: number
  status: string
  views: number
  createdAt: string
  category?: { name: string }
  isBoosted?: boolean
  boostExpiresAt?: string
}

interface Notification {
  id: string
  type: 'offer' | 'campaign' | 'swap' | 'comment' | 'system'
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
  action?: () => void
  swapId?: string
}

interface Conversation {
  otherUser: { id: string; name: string; image: string | null }
  product: { id: string; title: string; images: string[] } | null
  lastMessage: { content: string; createdAt: string; senderId: string }
  unreadCount: number
}

interface EconomicStatus {
  valorBalance: number
  usableBalance: number
  lockedBonus: number
  totalBonus: number
  hasCompletedFirstSwap: boolean
  completedSwapCount: number
  netGainFromSwaps: number
  remainingGainAllowance: number
  isInFirstSwapsPeriod: boolean
  productValueStatus: {
    hasQualifiedProduct: boolean
    maxProductValue: number
    minRequiredValue: number
    shortfall: number
    recommendation: string
  }
}

interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  createdAt: string
  isRead: boolean
  sender: { id: string; name: string; image: string | null }
  warning?: string
  moderation?: { result: string; reason?: string }
}

const surveyQuestions = [
  {
    id: 'interests',
    question: 'Hangi kategorilerle ilgileniyorsunuz?',
    type: 'multiple',
    options: ['Elektronik', 'Giyim', 'Kitap', 'Spor', 'Ev & Yaşam', 'Oyuncak', 'Bebek Ürünleri', 'Koleksiyon', 'Müzik Aletleri', 'Bahçe']
  },
  {
    id: 'frequency',
    question: 'Ne sıklıkla takas yapmayı planlıyorsunuz?',
    type: 'single',
    options: ['Haftada birkaç kez', 'Haftada bir', 'Ayda birkaç kez', 'Ayda bir', 'Nadiren']
  },
  {
    id: 'preference',
    question: 'Takas için en çok hangi tür ürünleri tercih edersiniz?',
    type: 'single',
    options: ['Yeni veya az kullanılmış ürünler', 'İyi durumda ikinci el', 'Fiyatı uygun olan herhangi biri', 'Nadir/koleksiyon ürünleri']
  },
  {
    id: 'distance',
    question: 'Takas için ne kadar mesafe gitmeyi kabul edersiniz?',
    type: 'single',
    options: ['Sadece mahallemde', 'İlçem içinde', 'Şehir genelinde', 'Farklı şehirlere bile giderim']
  },
  {
    id: 'motivation',
    question: 'TAKAS-A\'yı kullanma motivasyonunuz nedir?',
    type: 'multiple',
    options: ['Tasarruf etmek', 'Sürdürülebilir yaşam', 'Kullanmadığım eşyaları değerlendirmek', 'Yeni insanlarla tanışmak', 'Nadir ürünler bulmak']
  },
  {
    id: 'communication',
    question: 'Nasıl iletişim kurmayı tercih edersiniz?',
    type: 'single',
    options: ['Uygulama içi mesajlaşma', 'Telefon', 'Video görüşme', 'Yüz yüze görüşme']
  },
  {
    id: 'improvement',
    question: 'TAKAS-A\'da en çok görmek istediğiniz özellik?',
    type: 'single',
    options: ['Daha fazla ürün çeşitliliği', 'Daha fazla teslim noktası', 'Mobil uygulama', 'Topluluk etkinlikleri', 'Puan/ödül sistemi']
  }
]

type TabType = 'products' | 'messages' | 'favorites' | 'reviews' | 'valor' | 'badges' | 'survey'
type ProductFilter = 'all' | 'active' | 'inactive' | 'pending'
type ProductSort = 'newest' | 'oldest' | 'valor-high' | 'valor-low' | 'views'

export default function ProfilPage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const initialTab = (searchParams?.get('tab') as TabType) || 'products'
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  
  // URL tab parametresi değiştiğinde sekmeyi güncelle + eski tab redirect
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab')
    // Eski tab'lar Takas Merkezi'ne yönlendir
    if (tabFromUrl === 'foryou' || tabFromUrl === 'swaps') {
      router.replace('/takas-firsatlari')
      return
    }
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl as TabType)
    }
  }, [searchParams, router])
  
  // App Badge desteğini kontrol et
  useEffect(() => {
    setAppBadgeSupported(isAppBadgeSupported())
    setAppBadgeEnabledState(isAppBadgeEnabled())
  }, [])
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [products, setProducts] = useState<Product[]>([])  
  const [loading, setLoading] = useState(true)
  const [highlightedSwapId, setHighlightedSwapId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', nickname: '', bio: '', phone: '', location: '' })
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [productActionLoading, setProductActionLoading] = useState<string | null>(null)
  const [openProductMenu, setOpenProductMenu] = useState<string | null>(null)
  // Telefon Doğrulama
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<'idle' | 'sent' | 'verifying'>('idle')
  const [verifyPhone, setVerifyPhone] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifySuccess, setVerifySuccess] = useState('')
  const [demoVerificationCode, setDemoVerificationCode] = useState('')
  
  // Kimlik Doğrulama
  const [identityVerifyStep, setIdentityVerifyStep] = useState<'idle' | 'camera' | 'preview' | 'verifying'>('idle')
  
  // Push Notifications
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribeToPush, unsubscribe: unsubscribeFromPush } = usePushNotifications()
  const [testingPush, setTestingPush] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [notificationTestStatus, setNotificationTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  
  // App Badge state (ana ekran ikonu üzerinde bildirim sayısı)
  const [appBadgeSupported, setAppBadgeSupported] = useState(false)
  const [appBadgeEnabledState, setAppBadgeEnabledState] = useState(true)
  
  // Economic status state (spekülasyon önleme kuralları için)
  const [economicStatus, setEconomicStatus] = useState<EconomicStatus | null>(null)
  const [showProductValueWarning, setShowProductValueWarning] = useState(false)
  
  const [identityError, setIdentityError] = useState('')
  const [identitySuccess, setIdentitySuccess] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  
  // Products filter & sort
  const [productFilter, setProductFilter] = useState<ProductFilter>('all')
  const [productSort, setProductSort] = useState<ProductSort>('newest')
  const [productSearch, setProductSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Survey state
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string | string[]>>({})
  const [surveySubmitting, setSurveySubmitting] = useState(false)
  
  // Messages state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageWarning, setMessageWarning] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageStats, setMessageStats] = useState({ totalMessages: 0, readMessages: 0, unreadMessages: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevUnreadCountRef = useRef<number>(0)
  
  // Sub-tab for messages (direct vs group)
  const [messagesSubTab, setMessagesSubTab] = useState<'direct' | 'group'>('direct')
  
  // Group conversations state
  const [groupConversations, setGroupConversations] = useState<any[]>([])
  const [selectedGroupConversation, setSelectedGroupConversation] = useState<any | null>(null)
  const [groupMessages, setGroupMessages] = useState<any[]>([])
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [groupInviteResults, setGroupInviteResults] = useState<any[]>([])
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupMessage, setNewGroupMessage] = useState('')
  const [loadingGroupMessages, setLoadingGroupMessages] = useState(false)
  const [sendingGroupMessage, setSendingGroupMessage] = useState(false)
  const groupMessagesEndRef = useRef<HTMLDivElement>(null)
  
  // Emoji ve Dosya ekleme state'leri
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedGroupImage, setSelectedGroupImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingGroupImage, setUploadingGroupImage] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const groupEmojiPickerRef = useRef<HTMLDivElement>(null)
  const messageFileInputRef = useRef<HTMLInputElement>(null)
  const groupFileInputRef = useRef<HTMLInputElement>(null)

  // Boost (Öne Çıkar) state'leri
  const [boostingProduct, setBoostingProduct] = useState<string | null>(null)
  const [boostInfo, setBoostInfo] = useState<{
    level: number
    cost: number
    durationHours: number
    available: boolean
    balance: number
    canAfford: boolean
    activeBoostedProducts: number
    maxActiveBoosts: number
    isPremium: boolean
    freeBoostsRemaining: number
  } | null>(null)
  
  // Emoji listesi
  const emojis = {
    yüzler: ['😀', '😊', '😄', '😁', '😆', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '😏'],
    eller: ['👍', '👎', '👏', '🙌', '🤝', '🤲', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👋', '🖐️', '✋', '👊'],
    kalpler: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    nesneler: ['📦', '🎁', '🏷️', '💰', '💵', '🛒', '🛍️', '📱', '💻', '⌚', '📷', '🎮', '🚗', '🏠', '🔑', '✨'],
    semboller: ['✅', '❌', '⚠️', '❓', '❗', '💯', '🆗', '🆕', '🆓', '📍', '🔔', '💬', '📝', '📌', '🔗', '⏰']
  }
  
  // Valor Bonus state
  const [bonusStatus, setBonusStatus] = useState<any>(null)
  const [achievements, setAchievements] = useState<{ completed: any[], available: any[], claimable: any[] } | null>(null)
  const [claimingBonus, setClaimingBonus] = useState<string | null>(null)
  const [bonusMessage, setBonusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [userLevel, setUserLevel] = useState<any>(null)
  
  // Dynamic notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // Profil Fotoğrafı State'leri
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  
  // Kamera ile Fotoğraf Çekme State'leri
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)
  const [showProfileCamera, setShowProfileCamera] = useState(false)
  const [profileCameraStream, setProfileCameraStream] = useState<MediaStream | null>(null)
  const profileVideoRef = useRef<HTMLVideoElement>(null)
  const profileCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Şifre Değiştirme State'leri
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  
  // Valor History State'leri
  const [showValorHistory, setShowValorHistory] = useState(false)
  const [valorHistory, setValorHistory] = useState<any>(null)
  const [valorLoading, setValorLoading] = useState(false)

  // NEMOS Oyun State'leri
  const [showNemosPopup, setShowNemosPopup] = useState(false)
  const [showNemosGame, setShowNemosGame] = useState(false)
  const [nemosProgress, setNemosProgress] = useState({ 
    playCount: 0, 
    firstPlayDate: '', 
    daysLeft: 30, 
    rewarded: false 
  })
  const [isIOS, setIsIOS] = useState(false)

  // iOS tespiti
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
  }, [])

  // NEMOS ilerleme yükleyici
  useEffect(() => {
    const stored = localStorage.getItem('nemos_30day_progress')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        const firstPlay = new Date(data.firstPlayDate)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - firstPlay.getTime()) / (1000 * 60 * 60 * 24))
        const daysLeft = Math.max(0, 30 - diffDays)

        // 30 gün geçti ama 10 oyun tamamlanmadı → sıfırla
        if (diffDays >= 30 && data.playCount < 10 && !data.rewarded) {
          localStorage.removeItem('nemos_30day_progress')
          setNemosProgress({ playCount: 0, firstPlayDate: '', daysLeft: 30, rewarded: false })
        } else {
          setNemosProgress({
            playCount: data.playCount || 0,
            firstPlayDate: data.firstPlayDate || '',
            daysLeft,
            rewarded: data.rewarded || false
          })
        }
      } catch {
        localStorage.removeItem('nemos_30day_progress')
      }
    }
  }, [])
  
  // Valor History Fetch Fonksiyonu
  const fetchValorHistory = async () => {
    setValorLoading(true)
    try {
      const res = await fetch('/api/profile/valor-history')
      if (res.ok) setValorHistory(await res.json())
    } catch {}
    setValorLoading(false)
  }
  
  // Fetch comprehensive notifications from swap requests
  const fetchNotifications = async () => {
    try {
      // Fetch both received and sent swap requests
      const [receivedRes, sentRes] = await Promise.all([
        fetch('/api/swap-requests?type=received'),
        fetch('/api/swap-requests?type=sent')
      ])
      
      const allNotifs: Notification[] = []
      
      if (receivedRes.ok) {
        const receivedData = await receivedRes.json()
        const receivedRequests = Array.isArray(receivedData) ? receivedData : (receivedData.requests || [])
        
        // Fiyat anlaşması sağlanan (owner tarafı - pazarlık tamamlanmış)
        receivedRequests
          .filter((req: any) => req.negotiationStatus === 'price_agreed' && req.status === 'pending')
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `price-agreed-owner-${req.id}`,
              type: 'swap',
              title: 'Fiyat Anlaşıldı! 🤝',
              message: `${req.product?.title} için ${req.agreedPriceRequester || req.agreedPriceOwner} Valor'da anlaştınız. Takası onaylayabilirsiniz.`,
              read: false,
              createdAt: req.priceAgreedAt || req.updatedAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Fiyat teklifi bekleyen (karşı taraftan fiyat teklifi geldi - owner tarafı)
        receivedRequests
          .filter((req: any) => req.negotiationStatus === 'price_proposed' && req.agreedPriceRequester && !req.agreedPriceOwner)
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `price-proposed-owner-${req.id}`,
              type: 'offer',
              title: 'Fiyat Teklifi Geldi 💰',
              message: `${req.product?.title} için alıcı ${req.agreedPriceRequester} Valor teklif etti.`,
              read: false,
              createdAt: req.updatedAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Gelen yeni bekleyen teklifler (henüz pazarlık başlamamış)
        receivedRequests
          .filter((req: any) => req.status === 'pending' && !req.negotiationStatus)
          .slice(0, 5)
          .forEach((req: any) => {
            allNotifs.push({
              id: `offer-${req.id}`,
              type: 'offer',
              title: 'Yeni Teklif!',
              message: `${req.product?.title || 'Ürün'} ürününüz için yeni bir teklif aldınız.`,
              read: false,
              createdAt: req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Teslimat bekleyen takaslar (owner olarak)
        receivedRequests
          .filter((req: any) => req.status === 'awaiting_delivery')
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `delivery-${req.id}`,
              type: 'swap',
              title: 'Teslimat Bekliyor 📦',
              message: `${req.product?.title} için alıcı teslimatı bekliyor.`,
              read: false,
              createdAt: req.updatedAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Teslim edilmiş (onay bekleyen)
        receivedRequests
          .filter((req: any) => req.status === 'delivered')
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `confirm-${req.id}`,
              type: 'swap',
              title: 'Onay Bekliyor ✅',
              message: `${req.product?.title} teslim edildi. Alıcının onayı bekleniyor.`,
              read: false,
              createdAt: req.deliveredAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
      }
      
      if (sentRes.ok) {
        const sentData = await sentRes.json()
        const sentRequests = Array.isArray(sentData) ? sentData : (sentData.requests || [])
        
        // Fiyat anlaşması sağlanan (pazarlık tamamlanmış ama takas başlamamış)
        sentRequests
          .filter((req: any) => req.negotiationStatus === 'price_agreed' && req.status === 'pending')
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `price-agreed-${req.id}`,
              type: 'swap',
              title: 'Fiyat Anlaşıldı! 🤝',
              message: `${req.product?.title} için ${req.agreedPriceRequester || req.agreedPriceOwner} Valor'da anlaştınız. Takası başlatabilirsiniz.`,
              read: false,
              createdAt: req.priceAgreedAt || req.updatedAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Fiyat teklifi bekleyen (karşı taraf teklif verdi)
        sentRequests
          .filter((req: any) => req.negotiationStatus === 'price_proposed' && req.agreedPriceOwner && !req.agreedPriceRequester)
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `price-proposed-${req.id}`,
              type: 'offer',
              title: 'Fiyat Teklifi Geldi 💰',
              message: `${req.product?.title} için satıcı ${req.agreedPriceOwner} Valor teklif etti.`,
              read: false,
              createdAt: req.updatedAt || req.createdAt,
              swapId: req.id,
              link: '/profil?tab=swaps'
            })
          })
        
        // Kabul edilen tekliflerim
        sentRequests
          .filter((req: any) => req.status === 'accepted')
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `accepted-${req.id}`,
              type: 'swap',
              title: 'Teklif Kabul Edildi! ✅',
              message: `${req.product?.title} için teklifiniz kabul edildi.`,
              read: false,
              createdAt: req.updatedAt || req.createdAt,
              link: '/profil?tab=swaps'
            })
          })
        
        // Teslimat hazır (QR kod oluşturulmuş)
        sentRequests
          .filter((req: any) => req.status === 'awaiting_delivery' && req.qrCode)
          .slice(0, 3)
          .forEach((req: any) => {
            allNotifs.push({
              id: `qr-ready-${req.id}`,
              type: 'swap',
              title: 'QR Kod Hazır 📱',
              message: `${req.product?.title} için QR kodu hazır. Ürünü teslim almak için tarayın.`,
              read: false,
              createdAt: req.qrCodeGeneratedAt || req.createdAt,
              link: '/profil?tab=swaps'
            })
          })
        
        // Tamamlanan takaslarım
        sentRequests
          .filter((req: any) => req.status === 'completed')
          .slice(0, 2)
          .forEach((req: any) => {
            allNotifs.push({
              id: `complete-${req.id}`,
              type: 'swap',
              title: 'Takas Tamamlandı 🎉',
              message: `${req.product?.title} takası başarıyla tamamlandı.`,
              read: true,
              createdAt: req.updatedAt || req.createdAt,
              link: '/profil?tab=swaps'
            })
          })
        
        // Reddedilen tekliflerim
        sentRequests
          .filter((req: any) => req.status === 'rejected')
          .slice(0, 2)
          .forEach((req: any) => {
            allNotifs.push({
              id: `rejected-${req.id}`,
              type: 'system',
              title: 'Teklif Reddedildi ❌',
              message: `${req.product?.title} için teklifiniz reddedildi.`,
              read: true,
              createdAt: req.updatedAt || req.createdAt,
              link: '/profil?tab=offers'
            })
          })
      }
      
      // Profile completion notification
      if (profile && profile.trustScore < 100) {
        allNotifs.push({
          id: 'profile-complete',
          type: 'system',
          title: 'Profil Tamamlama',
          message: 'Profilinizi tamamlayarak güven puanınızı artırın.',
          read: false,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          action: () => {
            const profilTab = document.querySelector('[data-tab="profile"]')
            if (profilTab) (profilTab as HTMLElement).click()
          }
        })
      }
      
      // Welcome notification (one-time display - progressive level system)
      if (profile) {
        const welcomeShown = typeof window !== 'undefined' ? localStorage.getItem('welcomeBonusShown') : null
        if (!welcomeShown) {
          allNotifs.push({
            id: 'welcome-bonus',
            type: 'campaign',
            title: '👋 Hoş Geldiniz!',
            message: 'İlk Valor\'unuz hesabınıza eklendi! Takas yaptıkça daha çok bonus kazanacaksınız. Seviyeniz arttıkça bonuslarınız da artar!',
            read: true,
            createdAt: profile.createdAt || new Date(Date.now() - 86400000).toISOString()
          })
          if (typeof window !== 'undefined') {
            localStorage.setItem('welcomeBonusShown', 'true')
          }
        }
      }
      
      // Sort by date (newest first) and limit
      allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setNotifications(allNotifs.slice(0, 15))
      
    } catch (err) {
      console.error('Notifications fetch error:', err)
    }
  }

  // Data fetch kontrolü
  const dataFetchedRef = useRef(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // 1. next-auth yükleniyorsa bekle
    if (status === 'loading') return

    // 2. Giriş yapılmamışsa yönlendir
    if (status === 'unauthenticated') {
      router.replace('/giris')
      return
    }

    // 3. Giriş yapılmış VE session.user hazır → veri yükle
    if (status === 'authenticated' && session?.user && !dataFetchedRef.current) {
      dataFetchedRef.current = true
      // setLoading(false) KALDIRILDI - fetchProfile içinde loading kontrol ediliyor
      fetchProfile()
      fetchProducts()
      fetchNotifications()
      fetchBoostInfo()
    }
  }, [status, session?.user])
  
  // Re-fetch notifications when profile changes
  useEffect(() => {
    if (profile) {
      fetchNotifications()
    }
  }, [profile?.trustScore])
  
  // Emoji picker dışına tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
      if (groupEmojiPickerRef.current && !groupEmojiPickerRef.current.contains(event.target as Node)) {
        setShowGroupEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Emoji seçme fonksiyonu (bireysel mesaj)
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
  }
  
  // Emoji seçme fonksiyonu (grup mesaj)
  const handleGroupEmojiSelect = (emoji: string) => {
    setNewGroupMessage(prev => prev + emoji)
  }
  
  // Dosya seçme fonksiyonu (bireysel mesaj)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Dosya boyutu 5MB\'dan küçük olmalıdır', type: 'error' })
      return
    }
    
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Sadece resim dosyaları yüklenebilir', type: 'error' })
      return
    }
    
    setUploadingImage(true)
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      setUploadingImage(false)
    }
    reader.readAsDataURL(file)
  }
  
  // Dosya seçme fonksiyonu (grup mesaj)
  const handleGroupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Dosya boyutu 5MB\'dan küçük olmalıdır', type: 'error' })
      return
    }
    
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Sadece resim dosyaları yüklenebilir', type: 'error' })
      return
    }
    
    setUploadingGroupImage(true)
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedGroupImage(reader.result as string)
      setUploadingGroupImage(false)
    }
    reader.readAsDataURL(file)
  }
  
  // Seçili resmi kaldır (bireysel)
  const removeSelectedImage = () => {
    setSelectedImage(null)
    if (messageFileInputRef.current) {
      messageFileInputRef.current.value = ''
    }
  }
  
  // Seçili resmi kaldır (grup)
  const removeSelectedGroupImage = () => {
    setSelectedGroupImage(null)
    if (groupFileInputRef.current) {
      groupFileInputRef.current.value = ''
    }
  }

  // Telefon doğrulama kodu gönder
  const sendPhoneVerification = async () => {
    setVerifyError('')
    setVerifySuccess('')
    setDemoVerificationCode('')
    try {
      const res = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: verifyPhone })
      })
      const data = await res.json()
      if (res.ok) {
        setPhoneVerifyStep('sent')
        // Demo modunda kodu doğrudan göster
        if (data.demoCode) {
          setDemoVerificationCode(data.demoCode)
          setVerifySuccess('Doğrulama kodu aşağıda gösterildi')
        } else {
          setVerifySuccess('Doğrulama kodu gönderildi!')
        }
      } else {
        setVerifyError(data.error || 'Kod gönderilemedi')
      }
    } catch {
      setVerifyError('Bağlantı hatası')
    }
  }

  // Telefon doğrulama kodunu kontrol et
  const verifyPhoneCode = async () => {
    setVerifyError('')
    setPhoneVerifyStep('verifying')
    try {
      const res = await fetch('/api/verify-phone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode })
      })
      const data = await res.json()
      if (res.ok) {
        setVerifySuccess(data.message)
        setPhoneVerifyStep('idle')
        setVerifyCode('')
        setVerifyPhone('')
        fetchProfile() // Profili yenile
      } else {
        setVerifyError(data.error || 'Doğrulama başarısız')
        setPhoneVerifyStep('sent')
      }
    } catch {
      setVerifyError('Bağlantı hatası')
      setPhoneVerifyStep('sent')
    }
  }

  // Kimlik Doğrulama Fonksiyonları
  const startCamera = async () => {
    setIdentityError('')
    setIdentitySuccess('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIdentityVerifyStep('camera')
    } catch (err) {
      console.error('Kamera erişim hatası:', err)
      setIdentityError('Kameraya erişilemedi. Lütfen kamera izni verin veya dosya yükleyin.')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setIdentityVerifyStep('idle')
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.9)
        setCapturedImage(imageData)
        stopCamera()
        setIdentityVerifyStep('preview')
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setIdentityError('Dosya boyutu 10MB\'ı aşamaz')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setCapturedImage(reader.result as string)
        setIdentityVerifyStep('preview')
      }
      reader.readAsDataURL(file)
    }
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setIdentityError('')
    setIdentityVerifyStep('idle')
  }

  const submitIdentityVerification = async () => {
    if (!capturedImage) return
    
    setIdentityVerifyStep('verifying')
    setIdentityError('')
    
    try {
      // Base64'ü blob'a çevir
      const response = await fetch(capturedImage)
      const blob = await response.blob()
      
      const formData = new FormData()
      formData.append('image', blob, 'identity.jpg')
      
      const res = await fetch('/api/verify-identity', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setIdentitySuccess(data.message)
        setCapturedImage(null)
        setIdentityVerifyStep('idle')
        fetchProfile() // Profili yenile
      } else {
        setIdentityError(data.error || 'Doğrulama başarısız')
        setIdentityVerifyStep('preview')
      }
    } catch {
      setIdentityError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setIdentityVerifyStep('preview')
    }
  }

  // Kamera stream temizliği
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  // NEMOS İlk görüntüleme popup kontrolü
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOSDevice) return  // iOS'ta popup gösterme
    if (status === 'authenticated') {
      const seen = localStorage.getItem('nemos_popup_seen')
      if (!seen) {
        setShowNemosPopup(true)
        localStorage.setItem('nemos_popup_seen', 'true')
      }
    }
  }, [status])

  // NEMOS postMessage dinleyici (30 günde 10 oyun sistemi)
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type === 'NEMOS_GAME_OVER' && e.data?.won) {
        // Mevcut ilerlemeyi oku
        let progress = { playCount: 0, firstPlayDate: '', rewarded: false }
        const stored = localStorage.getItem('nemos_30day_progress')
        if (stored) {
          try { progress = JSON.parse(stored) } catch { /* ignore */ }
        }

        // İlk oyunsa tarihi kaydet
        if (!progress.firstPlayDate) {
          progress.firstPlayDate = new Date().toISOString()
        }

        // 30 gün kontrolü
        const firstPlay = new Date(progress.firstPlayDate)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - firstPlay.getTime()) / (1000 * 60 * 60 * 24))

        // 30 gün geçti ama 10 oyun tamamlanmadı → sıfırla
        if (diffDays >= 30 && progress.playCount < 10 && !progress.rewarded) {
          progress = { playCount: 0, firstPlayDate: new Date().toISOString(), rewarded: false }
        }

        // Zaten ödül alındıysa yeni dönem başlat
        if (progress.rewarded) {
          progress = { playCount: 0, firstPlayDate: new Date().toISOString(), rewarded: false }
        }

        // Oyun sayısını artır
        progress.playCount += 1
        const daysLeft = Math.max(0, 30 - diffDays)

        // 10 oyun tamamlandı mı?
        if (progress.playCount >= 10) {
          if (diffDays >= 30) {
            // 30 gün geçti VE 10 oyun tamamlandı → ödül ver
            try {
              const res = await fetch('/api/game/nemos-reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: e.data.score })
              })
              const data = await res.json()
              if (data.success) {
                progress.rewarded = true
                alert(`🎉 Tebrikler! 30 günde 10 oyun tamamladın! +${data.valorReward} VALOR kazandın!`)
                setShowNemosGame(false)
              }
            } catch {
              console.error('NEMOS reward error')
            }
          } else {
            // 10 oyun tamam ama 30 gün dolmadı → bekle
            alert(`🚁 10 oyun tamamlandı! ${daysLeft} gün sonra +5 VALOR alacaksın. Beklemeye devam! ⏳`)
            setShowNemosGame(false)
          }
        } else {
          alert(`🚁 Görev tamamlandı! (${progress.playCount}/10) — ${daysLeft} gün kaldı`)
          setShowNemosGame(false)
        }

        // localStorage'a kaydet
        localStorage.setItem('nemos_30day_progress', JSON.stringify(progress))

        // State'i güncelle
        setNemosProgress({
          playCount: progress.playCount,
          firstPlayDate: progress.firstPlayDate,
          daysLeft,
          rewarded: progress.rewarded
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Profil Kamera Açma
  const openProfileCamera = async () => {
    console.log('[ProfileCamera] Kamera açılıyor...')
    setShowPhotoOptions(false)
    setShowProfileCamera(true)
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      })
      console.log('[ProfileCamera] Kamera stream alındı')
      setProfileCameraStream(stream)
      
      // Video elementine bağla
      setTimeout(() => {
        if (profileVideoRef.current) {
          profileVideoRef.current.srcObject = stream
          profileVideoRef.current.play().catch(console.error)
          console.log('[ProfileCamera] Video başlatıldı')
        }
      }, 100)
    } catch (error) {
      console.error('[ProfileCamera] Kamera hatası:', error)
      setToast({ message: 'Kamera açılamadı. İzin verildiğinden emin olun.', type: 'error' })
      setShowProfileCamera(false)
    }
  }
  
  // Profil Kamera Kapatma
  const closeProfileCamera = () => {
    console.log('[ProfileCamera] Kamera kapatılıyor...')
    if (profileCameraStream) {
      profileCameraStream.getTracks().forEach(track => track.stop())
      setProfileCameraStream(null)
    }
    setShowProfileCamera(false)
    setPhotoPreview(null)
  }
  
  // Profil Fotoğrafı Çekme
  const captureProfilePhoto = () => {
    console.log('[ProfileCamera] Fotoğraf çekiliyor...')
    if (!profileVideoRef.current || !profileCanvasRef.current) return
    
    const video = profileVideoRef.current
    const canvas = profileCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Kare fotoğraf için boyutları ayarla
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = size
    canvas.height = size
    
    // Ortadan kare kes ve aynala (selfie için)
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    
    const offsetX = (video.videoWidth - size) / 2
    const offsetY = (video.videoHeight - size) / 2
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size)
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    console.log('[ProfileCamera] Fotoğraf çekildi')
    setPhotoPreview(dataUrl)
    
    // Kamerayı durdur
    if (profileCameraStream) {
      profileCameraStream.getTracks().forEach(track => track.stop())
      setProfileCameraStream(null)
    }
  }
  
  // Çekilen Fotoğrafı Yükle
  const uploadCapturedPhoto = async () => {
    if (!photoPreview) return
    setUploadingPhoto(true)
    
    try {
      // Direkt base64 olarak server'a gönder — S3 CORS sorununu bypass et
      const updateRes = await fetch('/api/profile/photo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base64Image: photoPreview,
          fileName: `profile-camera-${Date.now()}.jpg`,
          contentType: 'image/jpeg'
        })
      })
      
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        throw new Error(err.error || 'Fotoğraf yüklenemedi')
      }
      
      const { imageUrl } = await updateRes.json()
      setProfile((prev: any) => prev ? { ...prev, image: imageUrl } : null)
      // Session'ı güncelle (header vb. için)
      await updateSession()
      setToast({ message: 'Profil fotoğrafı güncellendi!', type: 'success' })
      closeProfileCamera()
      
    } catch (error: any) {
      setToast({ message: error.message || 'Fotoğraf yüklenemedi', type: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }
  
  // Profil Fotoğrafı Yükleme (Galeriden)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Fotoğraf 5MB\'dan küçük olmalı', type: 'error' })
      return
    }
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Sadece resim dosyaları yüklenebilir', type: 'error' })
      return
    }
    
    setUploadingPhoto(true)
    setShowPhotoOptions(false)
    
    try {
      // Dosyayı base64'e çevir
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Dosya okunamadı'))
        reader.readAsDataURL(file)
      })
      
      // Direkt server'a base64 olarak gönder
      const updateRes = await fetch('/api/profile/photo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base64Image: base64,
          fileName: file.name,
          contentType: file.type
        })
      })
      
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        throw new Error(err.error || 'Fotoğraf yüklenemedi')
      }
      
      const { imageUrl } = await updateRes.json()
      setProfile((prev: any) => prev ? { ...prev, image: imageUrl } : null)
      setPhotoPreview(null)
      // Session'ı güncelle (header vb. için)
      await updateSession()
      setToast({ message: 'Profil fotoğrafı güncellendi!', type: 'success' })
      
    } catch (error: any) {
      setToast({ message: error.message || 'Fotoğraf yüklenemedi', type: 'error' })
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }
  
  // Profil Fotoğrafını Kaldır (safeFetch ile)
  const handleRemovePhoto = async () => {
    try {
      setUploadingPhoto(true)
      const { data, error } = await safeFetch('/api/profile/photo', { 
        method: 'DELETE',
        timeout: 10000 
      })
      
      if (error) {
        setToast({ message: error, type: 'error' })
        return
      }
      
      setProfile(prev => prev ? { ...prev, image: null } : null)
      // Session'ı güncelle (header vb. için)
      await updateSession()
      setToast({ message: 'Profil fotoğrafı kaldırıldı', type: 'success' })
    } catch (error) {
      setToast({ message: 'Fotoğraf kaldırılamadı', type: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }
  
  // Şifre Değiştirme
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    
    // Validasyon
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Tüm alanları doldurun')
      return
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor')
      return
    }
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Şifre en az 8 karakter olmalıdır')
      return
    }
    
    try {
      setChangingPassword(true)
      
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm)
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setPasswordError(data.error || 'Şifre değiştirilemedi')
        return
      }
      
      setPasswordSuccess('Şifreniz başarıyla güncellendi')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      
      // 2 saniye sonra modal'ı kapat
      setTimeout(() => {
        setShowPasswordModal(false)
        setPasswordSuccess('')
      }, 2000)
      
    } catch (error) {
      setPasswordError('Bir hata oluştu')
    } finally {
      setChangingPassword(false)
    }
  }

  const fetchProfile = async (retryAttempt = 0): Promise<void> => {
    // Offline kontrolü
    if (isOffline()) {
      setProfileError('İnternet bağlantınız yok')
      setLoading(false)
      return
    }
    
    try {
      setProfileError(null)
      const { data, ok, error, status: httpStatus } = await safeGet('/api/profile', { timeout: 15000 })
      
      // 401 hatası ve retry mekanizması - session henüz hazır değilse bekle
      if (httpStatus === 401 && retryAttempt < 3) {
        console.log(`[Profil] Session bekliyor, retry ${retryAttempt + 1}/3`)
        await new Promise(r => setTimeout(r, 1000))
        return fetchProfile(retryAttempt + 1)
      }
      
      if (ok && data) {
        setProfile(data)
        setProfileError(null)
        setRetryCount(0)
        setEditForm({
          name: data.name || '',
          nickname: data.nickname || '',
          bio: data.bio || '',
          phone: data.phone || '',
          location: data.location || ''
        })
        if (data.surveyData) {
          setSurveyAnswers(data.surveyData)
        }
        if (!data.nickname && !sessionStorage.getItem('nicknamePromptDismissed')) {
          setShowNicknamePrompt(true)
        }
      } else if (error) {
        console.error('Profil yüklenemedi:', error)
        // Retry mekanizması - network hatası durumunda
        if (retryAttempt < 3) {
          console.log(`[Profil] Retry ${retryAttempt + 1}/3`)
          await new Promise(r => setTimeout(r, 1000 * (retryAttempt + 1)))
          return fetchProfile(retryAttempt + 1)
        }
        setProfileError(error || 'Profil yüklenemedi')
      }
      
      // Ekonomik durumu da fetch et (profil başarılı ise)
      if (ok && data) {
        const statusResult = await safeGet('/api/valor/status', { timeout: 10000 })
        if (statusResult.ok && statusResult.data) {
          setEconomicStatus(statusResult.data)
          
          if (!statusResult.data.productValueStatus?.hasQualifiedProduct && 
              !sessionStorage.getItem('productValueWarningDismissed')) {
            setShowProductValueWarning(true)
          }
        }
      }
    } catch (error) {
      console.error('Profil yüklenemedi:', error)
      if (retryAttempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * (retryAttempt + 1)))
        return fetchProfile(retryAttempt + 1)
      }
      setProfileError('Bağlantı hatası oluştu')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?mine=true&all=true')
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Ürünler yüklenemedi:', error)
    }
  }

  // Fetch boost info
  const fetchBoostInfo = async () => {
    try {
      const res = await fetch('/api/products/boost')
      if (res.ok) {
        const data = await res.json()
        setBoostInfo(data)
      }
    } catch (error) {
      console.error('Boost info yüklenemedi:', error)
    }
  }

  // Boost product
  const boostProduct = async (productId: string) => {
    if (!boostInfo) return
    setBoostingProduct(productId)
    try {
      const res = await fetch('/api/products/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ message: data.message, type: 'success' })
        fetchProducts() // Ürünleri güncelle
        fetchProfile() // Bakiyeyi güncelle
        fetchBoostInfo() // Boost info'yu güncelle
      } else {
        setToast({ message: data.error, type: 'error' })
      }
    } catch (error) {
      setToast({ message: 'Bir hata oluştu', type: 'error' })
    }
    setBoostingProduct(null)
  }

  // Toggle product publish/unpublish status
  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    setProductActionLoading(productId)
    setOpenProductMenu(null)
    
    try {
      const action = currentStatus === 'active' ? 'unpublish' : 'publish'
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        // Update local state
        setProducts(prev => prev.map(p => 
          p.id === productId 
            ? { ...p, status: action === 'publish' ? 'active' : 'inactive' }
            : p
        ))
        setToast({ message: data.message, type: 'success' })
      } else {
        setToast({ message: data.error || 'Bir hata oluştu', type: 'error' })
      }
    } catch (error) {
      console.error('Product status update error:', error)
      setToast({ message: 'Bir hata oluştu', type: 'error' })
    } finally {
      setProductActionLoading(null)
      // Auto-hide toast after 3 seconds
      setTimeout(() => setToast(null), 3000)
    }
  }

  const fetchBonusStatus = async () => {
    try {
      const res = await fetch('/api/valor?action=bonus_status')
      if (res.ok) {
        const data = await res.json()
        setBonusStatus(data)
      }
      // Kullanıcı seviyesini de çek
      const levelRes = await fetch('/api/valor?action=user_level')
      if (levelRes.ok) {
        const levelData = await levelRes.json()
        setUserLevel(levelData)
      }
    } catch (error) {
      console.error('Bonus durumu yüklenemedi:', error)
    }
  }

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/valor?action=achievements')
      if (res.ok) {
        const data = await res.json()
        setAchievements(data)
      }
    } catch (error) {
      console.error('Başarılar yüklenemedi:', error)
    }
  }

  const claimDailyBonus = async () => {
    setClaimingBonus('daily')
    setBonusMessage(null)
    try {
      const res = await fetch('/api/valor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_daily_bonus' })
      })
      const data = await res.json()
      if (res.ok) {
        setBonusMessage({ type: 'success', text: `🎉 +${data.bonus} Valor! ${data.nextLevelInfo || ''}` })
        fetchBonusStatus()
        fetchProfile()
      } else {
        setBonusMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setBonusMessage({ type: 'error', text: 'Bir hata oluştu' })
    } finally {
      setClaimingBonus(null)
    }
  }

  const claimAchievementBonus = async (achievementId: string) => {
    setClaimingBonus(achievementId)
    setBonusMessage(null)
    try {
      const res = await fetch('/api/valor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_achievement', achievementId })
      })
      const data = await res.json()
      if (res.ok) {
        setBonusMessage({ type: 'success', text: `🏆 ${data.message} +${data.bonus} Valor!` })
        fetchAchievements()
        fetchProfile()
      } else {
        setBonusMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setBonusMessage({ type: 'error', text: 'Bir hata oluştu' })
    } finally {
      setClaimingBonus(null)
    }
  }

  const fetchConversations = async () => {
    if (isOffline()) return
    
    setLoadingMessages(true)
    try {
      const { data, ok, error } = await safeGet('/api/messages', { timeout: 12000 })
      
      if (ok && data) {
        const convList = data.conversations || data || []
        setConversations(Array.isArray(convList) ? convList : [])
        const newStats = data.stats || { totalMessages: 0, readMessages: 0, unreadMessages: 0 }
        // Yeni mesaj geldiğinde ses çal
        if (newStats.unreadMessages > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
          playMessageSound()
        }
        prevUnreadCountRef.current = newStats.unreadMessages
        setMessageStats(newStats)
      } else if (error) {
        console.error('Konuşmalar yüklenemedi:', error)
      }
    } catch (error) {
      console.error('Konuşmalar yüklenemedi:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const fetchGroupConversations = async () => {
    try {
      const res = await fetch('/api/messages/groups')
      if (res.ok) {
        const data = await res.json()
        setGroupConversations(data || [])
      }
    } catch (error) {
      console.error('Grup konuşmaları yüklenemedi:', error)
    }
  }

  const fetchGroupMessages = async (groupId: string) => {
    setLoadingGroupMessages(true)
    try {
      const res = await fetch(`/api/messages/groups/${groupId}`)
      if (res.ok) {
        const data = await res.json()
        setGroupMessages(data.messages || [])
        setSelectedGroupConversation((prev: any) => ({
          ...prev,
          members: data.group?.members || prev?.members
        }))
        setTimeout(() => {
          groupMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch (error) {
      console.error('Grup mesajları yüklenemedi:', error)
    } finally {
      setLoadingGroupMessages(false)
    }
  }

  const handleSendGroupMessage = async () => {
    if ((!newGroupMessage.trim() && !selectedGroupImage) || !selectedGroupConversation || sendingGroupMessage) return
    
    setSendingGroupMessage(true)
    try {
      // Mesaj içeriğini hazırla (fotoğraf varsa ekle)
      let messageContent = newGroupMessage.trim()
      if (selectedGroupImage) {
        messageContent = `[IMAGE]${selectedGroupImage}[/IMAGE]${messageContent ? '\n' + messageContent : ''}`
      }
      
      const res = await fetch(`/api/messages/groups/${selectedGroupConversation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      })
      
      if (res.ok) {
        const newMsg = await res.json()
        setGroupMessages(prev => [...prev, newMsg])
        setNewGroupMessage('')
        setSelectedGroupImage(null)
        if (groupFileInputRef.current) groupFileInputRef.current.value = ''
        
        // Bottom nav badge'ini güncelle
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('messageSent'))
        }
        
        setTimeout(() => {
          groupMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch (error) {
      console.error('Grup mesajı gönderilemedi:', error)
    } finally {
      setSendingGroupMessage(false)
    }
  }

  const handleSelectGroupConversation = (group: any) => {
    setSelectedGroupConversation(group)
    fetchGroupMessages(group.id)
  }

  const fetchMessages = async (otherUserId: string, productId: string | null) => {
    setLoadingMessages(true)
    try {
      const url = productId 
        ? `/api/messages?userId=${otherUserId}&productId=${productId}`
        : `/api/messages?userId=${otherUserId}&productId=general`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !selectedConversation || sendingMessage) return
    
    setSendingMessage(true)
    setMessageWarning(null)
    
    try {
      // Mesaj içeriğini hazırla (fotoğraf varsa ekle)
      let messageContent = newMessage.trim()
      if (selectedImage) {
        messageContent = `[IMAGE]${selectedImage}[/IMAGE]${messageContent ? '\n' + messageContent : ''}`
      }
      
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          content: messageContent,
          productId: selectedConversation.product?.id
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (data.blocked) {
          setMessageWarning(data.error)
          return
        }
        if (data.suspended) {
          setMessageWarning(data.error)
          return
        }
        throw new Error(data.error)
      }
      
      // Uyarı varsa göster ama mesajı ekle
      if (data.warning) {
        setMessageWarning(data.warning)
      }
      
      // Mesajı listeye ekle
      setMessages(prev => [...prev, data])
      setNewMessage('')
      setSelectedImage(null)
      if (messageFileInputRef.current) messageFileInputRef.current.value = ''
      
      // Bottom nav badge'ini güncelle
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('messageSent'))
      }
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error)
      setMessageWarning('Mesaj gönderilirken bir hata oluştu.')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    setMessageWarning(null)
    fetchMessages(conv.otherUser.id, conv.product?.id || null)
  }

  // Mesajlar sekmesi açıldığında konuşmaları yükle
  useEffect(() => {
    if (activeTab === 'messages' && status === 'authenticated' && profile) {
      fetchConversations()
      fetchGroupConversations()
    }
  }, [activeTab, status, profile])

  // Valor sekmesi açıldığında bonus, başarılar ve geçmişi yükle
  useEffect(() => {
    if (activeTab === 'valor' && status === 'authenticated') {
      fetchBonusStatus()
      fetchAchievements()
      fetchValorHistory()
    }
  }, [activeTab, status])

  // Close product menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openProductMenu) {
        setOpenProductMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openProductMenu])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(prev => prev ? { ...prev, ...updated } : prev)
        setEditing(false)
      }
    } catch (error) {
      console.error('Profil güncellenemedi:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSurveyAnswer = (questionId: string, answer: string, isMultiple: boolean) => {
    setSurveyAnswers(prev => {
      if (isMultiple) {
        const current = (prev[questionId] as string[]) || []
        if (current.includes(answer)) {
          return { ...prev, [questionId]: current.filter(a => a !== answer) }
        } else {
          return { ...prev, [questionId]: [...current, answer] }
        }
      } else {
        return { ...prev, [questionId]: answer }
      }
    })
  }

  const handleSubmitSurvey = async () => {
    setSurveySubmitting(true)
    try {
      const res = await fetch('/api/profile/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyData: surveyAnswers })
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(prev => prev ? { 
          ...prev, 
          surveyCompleted: true, 
          surveyData: surveyAnswers,
          valorBalance: prev.valorBalance + (data.bonus || 0)
        } : prev)
        
        if (data.bonus > 0) {
          alert(data.message || `🎉 ${data.bonus} Valor anket bonusu kazandınız!`)
        }
        
        setActiveTab('products')
      }
    } catch (error) {
      console.error('Anket gönderilemedi:', error)
    } finally {
      setSurveySubmitting(false)
    }
  }

  // Filter and sort products
  const filteredProducts = products
    .filter(p => {
      if (productFilter === 'active') return p.status === 'active'
      if (productFilter === 'inactive') return p.status === 'inactive'
      if (productFilter === 'pending') return p.status === 'pending'
      return true
    })
    .filter(p => {
      if (!productSearch) return true
      return p.title.toLowerCase().includes(productSearch.toLowerCase())
    })
    .sort((a, b) => {
      switch (productSort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'valor-high':
          return b.valorPrice - a.valorPrice
        case 'valor-low':
          return a.valorPrice - b.valorPrice
        case 'views':
          return b.views - a.views
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  const unreadCount = notifications.filter(n => !n.read).length

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-frozen-500" />
      </div>
    )
  }

  if (!profile) {
    // Session var ama profil yüklenemedi - tekrar dene butonu göster
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            {profileError || 'Profil yüklenemedi'}
          </p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500">
              Otomatik yeniden deneme: {retryCount}/3
            </p>
          )}
        </div>
        <Button 
          onClick={() => {
            setLoading(true)
            setProfileError(null)
            dataFetchedRef.current = false
            if (session?.user?.email) {
              fetchProfile()
            } else {
              router.push('/giris')
            }
          }}
          className="bg-violet-600 hover:bg-violet-700"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Tekrar Dene
        </Button>
      </div>
    )
  }

  const totalUnreadMessages = messageStats.unreadMessages

  // Bekleyen teklif sayısını hesapla
  const pendingOffersCount = 0 // SwapManagement'tan gelecek

  // Sana Özel ve Mesajlar kaldırıldı - Ana navigasyonda mevcut
  const mainTabs: any[] = []

  const settingsTabs = [
    { id: 'products', label: 'Ürünlerim', icon: Package },
    { id: 'favorites', label: 'Favorilerim', icon: Heart },
    { id: 'badges', label: 'Rozetlerim', icon: Award },
    { id: 'reviews', label: 'Değerlendirmeler', icon: Star },
    { id: 'valor', label: 'Valor', icon: Coins },
    { id: 'survey', label: 'Anket', icon: ClipboardList, showBadge: !profile.surveyCompleted },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-12">
      {/* NEMOS İlk Giriş Popup */}
      {showNemosPopup && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="text-5xl mb-3">🚁</div>
            <h2 className="text-xl font-bold text-orange-400 font-mono mb-2">OYUN VAKTİ!</h2>
            <p className="text-gray-300 text-sm mb-4">
              Project NEMOS — Yangın söndürme drone simülasyonu!
              Oyna, yangınları söndür ve <span className="text-yellow-400 font-bold">VALOR kazan</span>!
            </p>
            <div className="bg-gray-800 rounded-xl p-3 mb-4 text-sm text-gray-400">
              🎯 30 günde 10 oyun tamamla → <span className="text-yellow-400">+5 VALOR kazan</span><br/>
              📅 İlk oyundan itibaren <span className="text-blue-400">30 gün sayacı</span> başlar
            </div>
            <button
              onClick={() => { setShowNemosPopup(false); setShowNemosGame(true) }}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl mb-2"
            >
              ▶ Şimdi Oyna!
            </button>
            <button
              onClick={() => setShowNemosPopup(false)}
              className="text-gray-500 text-sm"
            >
              Sonra hatırlat
            </button>
          </div>
        </div>
      )}

      {/* NEMOS Oyun iframe Modal */}
      {showNemosGame && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
            <span className="text-orange-400 font-mono font-bold">🚁 PROJECT NEMOS</span>
            <button
              onClick={() => setShowNemosGame(false)}
              className="text-gray-400 hover:text-white text-2xl"
            >✕</button>
          </div>
          <iframe
            src="/nemos/game.html"
            className="flex-1 w-full border-0"
            allow="autoplay"
          />
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
              toast.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Nickname Prompt Banner for existing users */}
        {showNicknamePrompt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-gradient-to-r from-frozen-50 to-blue-50 rounded-2xl border border-frozen-200 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-frozen-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-frozen-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">🎭 Takma Ad Kullanmak İster misiniz?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Gizliliğinizi korumak için platformda gerçek adınız yerine bir takma ad gösterebilirsiniz.
                  Şu anda adınız &quot;{profile?.name}&quot; olarak görünüyor.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setEditing(true)
                      setShowNicknamePrompt(false)
                      sessionStorage.setItem('nicknamePromptDismissed', 'true')
                    }}
                    className="bg-frozen-500 hover:bg-frozen-600"
                  >
                    Takma Ad Ekle
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowNicknamePrompt(false)
                      sessionStorage.setItem('nicknamePromptDismissed', 'true')
                    }}
                  >
                    Daha Sonra
                  </Button>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowNicknamePrompt(false)
                  sessionStorage.setItem('nicknamePromptDismissed', 'true')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Profile Header - Compact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4"
        >
          <div className="h-20 gradient-frozen" />
          <div className="px-4 pb-4 -mt-10">
            <div className="flex items-end gap-4">
              {/* Profil Fotoğrafı - Tıklanabilir */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => !uploadingPhoto && setShowPhotoOptions(true)}
                  disabled={uploadingPhoto}
                  className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {uploadingPhoto ? (
                    <div className="w-full h-full flex items-center justify-center bg-frozen-100">
                      <Loader2 className="w-8 h-8 text-frozen-600 animate-spin" />
                    </div>
                  ) : photoPreview ? (
                    <img src={photoPreview} alt="Önizleme" className="w-full h-full object-cover" />
                  ) : profile.image ? (
                    <img src={profile.image} alt={profile.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-frozen-100">
                      <User className="w-10 h-10 text-frozen-400" />
                    </div>
                  )}
                </button>
                {/* Gizli File Input */}
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-lg font-bold text-gray-800 truncate">
                  {profile.nickname || profile.name}
                </h1>
                {profile.nickname && (
                  <p className="text-xs text-gray-400 truncate">{profile.name}</p>
                )}
                <p className="text-sm text-gray-500 truncate">{profile.email}</p>
              </div>
              <div className="flex gap-2 pb-1">
                <button 
                  onClick={() => { setShowValorHistory(true); fetchValorHistory() }}
                  className="text-center px-3 py-1.5 bg-frozen-50 rounded-xl hover:bg-frozen-100 transition-colors cursor-pointer"
                >
                  <div className="text-lg font-bold text-frozen-600">{profile.valorBalance - (profile.lockedValor || 0)}</div>
                  <div className="text-[10px] text-gray-500">Valor</div>
                  {profile.lockedValor > 0 && (
                    <div className="text-[9px] text-amber-600">({profile.lockedValor} kilitli)</div>
                  )}
                </button>
                <div className={`text-center px-3 py-1.5 rounded-xl ${
                  profile.trustScore < 30 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : profile.trustScore < 60 
                      ? 'bg-orange-50 dark:bg-orange-900/20'
                      : profile.trustScore < 80 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20'
                        : 'bg-green-50 dark:bg-green-900/20'
                }`}>
                  <div className={`text-lg font-bold ${
                    profile.trustScore < 30 
                      ? 'text-red-600' 
                      : profile.trustScore < 60 
                        ? 'text-orange-600'
                        : profile.trustScore < 80 
                          ? 'text-yellow-600'
                          : 'text-green-600'
                  }`}>{profile.trustScore}</div>
                  <div className="text-[10px] text-gray-500">Güven</div>
                </div>
              </div>
            </div>
            
            {/* Güven Skoru Uyarısı (80 altı) */}
            {profile.trustScore < 80 && (
              <div className={`p-3 rounded-xl border mt-3 ${
                profile.trustScore < 30 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  : profile.trustScore < 60 
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{profile.trustScore < 30 ? '🚫' : profile.trustScore < 60 ? '🔴' : '⚠️'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Güven Puanı: {profile.trustScore}/100
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                      {profile.trustScore < 30 
                        ? 'Hesabınız askıda. Destek ile iletişime geçin.'
                        : profile.trustScore < 60
                          ? 'Güven puanınız kritik. Günlük takas limitiniz kısıtlandı.'
                          : 'Güven puanınız düşük. Başarılı takaslarla geri kazanabilirsiniz.'
                      }
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          profile.trustScore < 30 ? 'bg-red-500' 
                          : profile.trustScore < 60 ? 'bg-orange-500' 
                          : 'bg-yellow-500'
                        }`}
                        style={{ width: `${profile.trustScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Doğrulama Durumu */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                profile.isPhoneVerified 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                <Phone className="w-3.5 h-3.5" />
                {profile.isPhoneVerified ? 'Telefon ✓' : 'Telefon'}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                profile.isIdentityVerified 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                <Shield className="w-3.5 h-3.5" />
                {profile.isIdentityVerified ? 'Kimlik ✓' : 'Kimlik'}
              </div>
              <button 
                onClick={() => setEditing(!editing)}
                className="ml-auto flex items-center gap-1 text-xs text-frozen-600 hover:text-frozen-700 font-medium"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {editing ? 'Kapat' : 'Düzenle'}
              </button>
            </div>
            
            {/* Sosyal Paylaşım */}
            <div className="mt-3 pt-3 border-t">
              <SocialShareWidget 
                shareType="profile"
                title={`${profile.nickname || profile.name} TAKAS-A'da!`}
                description="Benimle takas yapmak ister misin? TAKAS-A'da binlerce ürün seni bekliyor!"
                url={`https://takas-a.com/profil?user=${profile.id}`}
              />
            </div>
            
            {/* Inline Profile Edit Form */}
            <AnimatePresence>
              {editing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Adınız Soyadınız"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Takma Ad</label>
                        <Input
                          value={editForm.nickname}
                          onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                          placeholder="Örn: SwapMaster"
                          maxLength={20}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Hakkımda</label>
                      <Textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Kendinizi kısaca tanıtın..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="05XX XXX XX XX"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Konum</label>
                        <Input
                          value={editForm.location}
                          onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Şehir, İlçe"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button onClick={handleSaveProfile} size="sm" disabled={saving} className="bg-frozen-500 hover:bg-frozen-600">
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                      </Button>
                      <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                        <X className="w-4 h-4 mr-1" />
                        İptal
                      </Button>
                      <Button 
                        onClick={() => setShowPasswordModal(true)} 
                        variant="outline" 
                        size="sm" 
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Şifre Değiştir
                      </Button>
                    </div>
                    
                    {/* Kimlik Doğrulama Bölümü */}
                    {!profile.isIdentityVerified && (
                      <div className="mt-4 pt-4 border-t">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-600" />
                          Kimlik Doğrulama
                        </h3>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                            {language === 'tr' 
                              ? 'Kimlik belgenizin ön yüzünün net bir fotoğrafını yükleyin. AI ile otomatik doğrulama yapılacaktır.'
                              : 'Upload a clear photo of the front of your ID document. AI will automatically verify it.'}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                            ✓ {language === 'tr' ? 'Kabul edilen belgeler' : 'Accepted documents'}: 
                            {language === 'tr' 
                              ? ' Kimlik kartı, Pasaport, Ehliyet, Oturma izni'
                              : ' ID Card, Passport, Driver\'s License, Residence Permit'}
                          </p>
                          
                          {identityError && (
                            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs">
                              {identityError}
                            </div>
                          )}
                          
                          {identitySuccess && (
                            <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs">
                              {identitySuccess}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              onClick={() => alert('Kamera doğrulama özelliği yakında aktif olacak!')}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Camera className="w-4 h-4 mr-1" />
                              Kamera Aç
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-400 text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={loading}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {loading ? 'Yükleniyor...' : 'Dosya Yükle'}
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                
                                setIdentityError('')
                                setIdentitySuccess('')
                                setLoading(true)
                                
                                try {
                                  const formData = new FormData()
                                  formData.append('image', file)
                                  
                                  const res = await fetch('/api/verify-identity', {
                                    method: 'POST',
                                    body: formData
                                  })
                                  
                                  const data = await res.json()
                                  
                                  if (res.ok && data.success) {
                                    setIdentitySuccess(data.message || 'Kimliğiniz başarıyla doğrulandı!')
                                    // Profile'ı güncelle
                                    setProfile(prev => prev ? {
                                      ...prev,
                                      isIdentityVerified: true,
                                      trustScore: Math.min(100, prev.trustScore + 15)
                                    } : prev)
                                  } else {
                                    setIdentityError(data.error || 'Doğrulama başarısız')
                                  }
                                } catch (error) {
                                  console.error('Identity verification error:', error)
                                  setIdentityError('Bir hata oluştu. Lütfen tekrar deneyin.')
                                } finally {
                                  setLoading(false)
                                  e.target.value = ''
                                }
                              }}
                            />
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            📋 Kimlik bilgileriniz güvenli sunucularda şifreli olarak saklanır ve sadece doğrulama amacıyla kullanılır.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Ses Ayarları */}
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                      <SoundSettingsPanel />
                    </div>

                    {/* Bildirim Ayarları */}
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        Bildirim Ayarları
                      </h3>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl border border-blue-200 dark:border-blue-700 space-y-4">
                        
                        {/* Push Notification Durumu */}
                        <div className="p-3 bg-white/80 dark:bg-gray-800/80 rounded-xl border border-blue-100 dark:border-blue-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${pushSubscribed ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                Push Bildirim Durumu
                              </span>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              pushSubscribed 
                                ? 'bg-green-500 text-white' 
                                : pushSupported 
                                  ? 'bg-yellow-500 text-white' 
                                  : 'bg-gray-400 text-white'
                            }`}>
                              {pushSubscribed ? '✓ Aktif' : pushSupported ? 'Devre Dışı' : 'Desteklenmiyor'}
                            </span>
                          </div>
                          
                          {!pushSupported && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                              ⚠️ Push bildirimleri için uygulamayı ana ekrana ekleyin (iOS 16.4+ veya Android)
                            </p>
                          )}
                          
                          {pushSupported && !pushSubscribed && (
                            <Button
                              onClick={async () => {
                                try {
                                  await subscribeToPush()
                                  setToast({ message: 'Push bildirimleri aktifleştirildi!', type: 'success' })
                                } catch (error) {
                                  console.error('Push subscription hatası:', error)
                                  setToast({ message: 'Bildirim izni verilemedi', type: 'error' })
                                }
                              }}
                              disabled={pushLoading}
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                            >
                              {pushLoading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aktifleştiriliyor...</>
                              ) : (
                                <><Bell className="w-4 h-4 mr-2" /> Push Bildirimlerini Aç</>
                              )}
                            </Button>
                          )}
                          
                          {pushSubscribed && (
                            <div className="flex gap-2">
                              <Button
                                onClick={async () => {
                                  setNotificationTestStatus('testing')
                                  try {
                                    const res = await fetch('/api/push/send', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        type: 'SYSTEM',
                                        data: {
                                          title: '🔔 TAKAS-A Test',
                                          body: 'Tebrikler! Push bildirimleri başarıyla çalışıyor.',
                                          url: '/profil'
                                        }
                                      })
                                    })
                                    if (res.ok) {
                                      setNotificationTestStatus('success')
                                      setToast({ message: 'Test bildirimi gönderildi!', type: 'success' })
                                    } else {
                                      throw new Error('Sunucu hatası')
                                    }
                                  } catch (error) {
                                    console.error('Push test hatası:', error)
                                    setNotificationTestStatus('error')
                                    setToast({ message: 'Bildirim gönderilemedi', type: 'error' })
                                  }
                                  setTimeout(() => setNotificationTestStatus('idle'), 3000)
                                }}
                                disabled={notificationTestStatus === 'testing'}
                                size="sm"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                              >
                                {notificationTestStatus === 'testing' ? (
                                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Test...</>
                                ) : notificationTestStatus === 'success' ? (
                                  <><CheckCircle className="w-4 h-4 mr-2" /> Gönderildi!</>
                                ) : (
                                  <><Bell className="w-4 h-4 mr-2" /> Test Et</>
                                )}
                              </Button>
                              <Button
                                onClick={async () => {
                                  try {
                                    await unsubscribeFromPush()
                                    setToast({ message: 'Push bildirimleri kapatıldı', type: 'success' })
                                  } catch (error) {
                                    console.error('Unsubscribe hatası:', error)
                                  }
                                }}
                                disabled={pushLoading}
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                Kapat
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Mesaj Bildirimleri</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.notificationsEnabled !== false ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                              {profile.notificationsEnabled !== false ? 'Açık' : 'Kapalı'}
                            </span>
                            <Switch
                              checked={profile.notificationsEnabled !== false}
                              onCheckedChange={async (checked: boolean) => {
                                try {
                                  await fetch('/api/profile', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ notificationsEnabled: checked })
                                  })
                                  setProfile(prev => prev ? { ...prev, notificationsEnabled: checked } : prev)
                                } catch (error) {
                                  console.error('Bildirim ayarı güncellenemedi:', error)
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Takas Bildirimleri</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.swapNotificationsEnabled !== false ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                              {profile.swapNotificationsEnabled !== false ? 'Açık' : 'Kapalı'}
                            </span>
                            <Switch
                              checked={profile.swapNotificationsEnabled !== false}
                              onCheckedChange={async (checked: boolean) => {
                                try {
                                  await fetch('/api/profile', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ swapNotificationsEnabled: checked })
                                  })
                                  setProfile(prev => prev ? { ...prev, swapNotificationsEnabled: checked } : prev)
                                } catch (error) {
                                  console.error('Bildirim ayarı güncellenemedi:', error)
                                }
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* App Badge Toggle - Ana ekran ikonu üzerinde bildirim sayısı */}
                        {appBadgeSupported && (
                          <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                                  <span className="text-xs font-bold text-white">3</span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Uygulama İkonu Rozeti</span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-9">
                                Ana ekrandaki uygulama ikonunun üzerinde okunmamış bildirim sayısını gösterir
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${appBadgeEnabledState ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                                {appBadgeEnabledState ? 'Açık' : 'Kapalı'}
                              </span>
                              <Switch
                                checked={appBadgeEnabledState}
                                onCheckedChange={(checked: boolean) => {
                                  setAppBadgeEnabled(checked)
                                  setAppBadgeEnabledState(checked)
                                }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                          💡 Push bildirimlerini aktifleştirerek mesaj ve takas güncellemelerinden anında haberdar olun
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* PROJECT NEMOS Kartı */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-orange-500/20 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🚁</span>
            <div>
              <h3 className="font-bold text-orange-400 font-mono">PROJECT NEMOS</h3>
              <p className="text-xs text-gray-400">Yangın söndür, VALOR kazan!</p>
            </div>
            <span className="ml-auto text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
              📅 30 günde 10 oyun → +5 VALOR
            </span>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>🎯 İlerleme: {nemosProgress.playCount}/10 oyun</span>
              <span>⏳ {nemosProgress.firstPlayDate ? `${nemosProgress.daysLeft} gün kaldı` : 'Başlamadı'}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-orange-500 to-yellow-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (nemosProgress.playCount / 10) * 100)}%` }}
              />
            </div>
          </div>

          {/* Ödül durumu */}
          {nemosProgress.rewarded ? (
            <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-2 mb-3 text-center">
              <span className="text-green-400 text-sm font-bold">✅ Bu dönem ödülün alındı! Yeni dönem başlayacak.</span>
            </div>
          ) : nemosProgress.playCount >= 10 && nemosProgress.daysLeft > 0 ? (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-2 mb-3 text-center">
              <span className="text-blue-400 text-sm">⏳ 10 oyun tamam! {nemosProgress.daysLeft} gün sonra +5 VALOR</span>
            </div>
          ) : (
            <p className="text-sm text-gray-300 mb-3">
              30 gün içinde 10 oyun tamamla ve
              <span className="text-yellow-400 font-bold"> +5 VALOR</span> kazan!
            </p>
          )}

          {isIOS ? (
            <div className="w-full py-2 bg-gray-800 text-gray-500 text-sm text-center rounded-xl border border-gray-700">
              🍎 Bu oyun iOS&apos;ta desteklenmemektedir
              <br/>
              <span className="text-xs">Android veya masaüstü tarayıcıdan oynayabilirsiniz</span>
            </div>
          ) : (
            <button
              onClick={() => setShowNemosGame(true)}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:opacity-90 transition"
            >
              ▶ Oyna ve VALOR Kazan
            </button>
          )}
        </div>

        {/* Main Notification Tabs - Dolap Style */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide gap-0.5">
            {mainTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const isHighlight = (tab as any).highlight
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`min-w-[72px] w-[72px] sm:min-w-[85px] sm:w-auto sm:flex-1 flex flex-col items-center gap-1 py-3 px-1 border-b-2 transition-all relative ${
                    isActive
                      ? 'border-frozen-500 text-frozen-600 bg-frozen-50/50'
                      : isHighlight 
                        ? 'border-transparent text-purple-600 hover:text-purple-700 hover:bg-purple-50 bg-purple-50/30'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className={`relative ${isHighlight && !isActive ? 'animate-pulse' : ''}`}>
                    <Icon className={`w-5 h-5 ${isHighlight && !isActive ? 'text-purple-500' : ''}`} />
                  </div>
                  <span className={`text-[9px] sm:text-xs font-medium text-center leading-tight ${isHighlight && !isActive ? 'font-bold' : ''}`}>{tab.label}</span>
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Settings Tabs - Scrollable on mobile */}
        <div className="flex gap-2 mb-4 bg-white rounded-xl p-1.5 shadow-sm overflow-x-auto scrollbar-hide">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-medium transition-all relative text-xs sm:text-sm whitespace-nowrap min-w-fit ${
                  isActive
                    ? 'gradient-frozen text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
                {tab.showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Mesajlar - Messages (New Combined Tab) */}
          {activeTab === 'messages' && profile && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Sub-tabs for Messages */}
              <div className="bg-white rounded-xl shadow-sm mb-4 p-1 flex gap-1">
                <button
                  onClick={() => setMessagesSubTab('direct')}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    messagesSubTab === 'direct'
                      ? 'gradient-frozen text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Mesajlar
                  {messageStats.unreadMessages > 0 && (
                    <span className="ml-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                      {messageStats.unreadMessages}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setMessagesSubTab('group')}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 relative ${
                    messagesSubTab === 'group'
                      ? 'gradient-frozen text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Çoklu Mesaj
                </button>
                {/* Create Group Button */}
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-center hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
                  title="Çoklu Mesaj Grubu Oluştur"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Sub-tab Content */}
              <AnimatePresence mode="wait">
                {/* Direct Messages */}
                {messagesSubTab === 'direct' && (
                  <motion.div
                    key="direct-messages"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    {!selectedConversation ? (
                      <div>
                        <div className="p-4 border-b">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gradient-to-br from-frozen-50 to-frozen-100 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-frozen-600">{messageStats.totalMessages}</div>
                              <div className="text-xs text-gray-600">Toplam</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-green-600">{messageStats.readMessages}</div>
                              <div className="text-xs text-gray-600">Okunmuş</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-amber-600">{messageStats.unreadMessages}</div>
                              <div className="text-xs text-gray-600">Okunmamış</div>
                            </div>
                          </div>
                        </div>
                        {loadingMessages ? (
                          <div className="p-8 text-center">
                            <Loader2 className="w-8 h-8 text-frozen-500 mx-auto mb-3 animate-spin" />
                            <p className="text-sm text-gray-500">Mesajlar yükleniyor...</p>
                          </div>
                        ) : conversations.length === 0 ? (
                          <div className="p-8 text-center">
                            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="font-semibold text-gray-800 mb-1">Henüz Mesajınız Yok</h3>
                            <p className="text-sm text-gray-500">Ürünlerle ilgilendiğinizde burada görüşmeler başlayacak.</p>
                          </div>
                        ) : (
                          <div className="divide-y max-h-[400px] overflow-y-auto">
                            {conversations.map((conv, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelectConversation(conv)}
                                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                              >
                                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                  {conv.otherUser.image ? (
                                    <img src={conv.otherUser.image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-frozen-100">
                                      <User className="w-6 h-6 text-frozen-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-800 truncate">{conv.otherUser.name}</h4>
                                    <span className="text-xs text-gray-400">
                                      {new Date(conv.lastMessage.createdAt).toLocaleDateString('tr-TR')}
                                    </span>
                                  </div>
                                  {conv.product && (
                                    <p className="text-xs text-frozen-600 truncate">{conv.product.title}</p>
                                  )}
                                  <p className="text-sm text-gray-500 truncate">{conv.lastMessage.content}</p>
                                </div>
                                {conv.unreadCount > 0 && (
                                  <span className="w-5 h-5 bg-frozen-500 text-white text-xs rounded-full flex items-center justify-center">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col h-[500px]">
                        <div className="p-4 border-b flex items-center gap-3">
                          <button
                            onClick={() => {
                              setSelectedConversation(null)
                              setMessages([])
                              setMessageWarning(null)
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                            {selectedConversation.otherUser.image ? (
                              <img src={selectedConversation.otherUser.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-frozen-100">
                                <User className="w-5 h-5 text-frozen-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800">{selectedConversation.otherUser.name}</h4>
                            {selectedConversation.product && (
                              <Link href={`/urun/${selectedConversation.product.id}`} className="text-xs text-frozen-600 hover:underline">
                                {selectedConversation.product.title}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {loadingMessages ? (
                            <div className="flex justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-frozen-500" />
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>Henüz mesaj yok. İlk mesajı siz gönderin!</p>
                            </div>
                          ) : (
                            messages.map((msg) => {
                              const isMe = msg.sender.id === profile?.id
                              // Fotoğraf kontrolü
                              const imageMatch = msg.content.match(/\[IMAGE\](.*?)\[\/IMAGE\]/s)
                              const imageUrl = imageMatch ? imageMatch[1] : null
                              const textContent = msg.content.replace(/\[IMAGE\].*?\[\/IMAGE\]/s, '').trim()
                              
                              return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                                    <div className={`px-4 py-2 rounded-2xl ${
                                      isMe 
                                        ? 'bg-frozen-500 text-white rounded-br-md' 
                                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                                    }`}>
                                      {/* Fotoğraf varsa göster */}
                                      {imageUrl && (
                                        <div className="mb-2">
                                          <img 
                                            src={imageUrl} 
                                            alt="Paylaşılan fotoğraf" 
                                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(imageUrl, '_blank')}
                                          />
                                        </div>
                                      )}
                                      {/* Metin içeriği varsa göster */}
                                      {textContent && <p className="text-sm">{textContent}</p>}
                                      {/* Sadece fotoğraf varsa ve metin yoksa, fotoğraf ikonu göster */}
                                      {imageUrl && !textContent && (
                                        <p className="text-xs opacity-70 flex items-center gap-1">
                                          <ImageIcon className="w-3 h-3" /> Fotoğraf
                                        </p>
                                      )}
                                    </div>
                                    <p className={`text-[10px] text-gray-400 mt-1 flex items-center gap-1 ${isMe ? 'justify-end' : ''}`}>
                                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                      {/* Tik sistemi - sadece gönderen için göster */}
                                      {isMe && (
                                        msg.isRead ? (
                                          <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                        ) : (
                                          <Check className="w-3.5 h-3.5 text-gray-400" />
                                        )
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                        {messageWarning && (
                          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 whitespace-pre-line">{messageWarning}</p>
                              <button onClick={() => setMessageWarning(null)} className="ml-auto">
                                <X className="w-4 h-4 text-amber-600" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          {/* Seçili Fotoğraf Önizleme */}
                          {selectedImage && (
                            <div className="mb-3 relative inline-block">
                              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 border-frozen-500">
                                <img src={selectedImage} alt="Seçili fotoğraf" className="w-full h-full object-cover" />
                              </div>
                              <button
                                type="button"
                                onClick={removeSelectedImage}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          
                          {/* Gizli Dosya Input */}
                          <input
                            type="file"
                            ref={messageFileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            className="hidden"
                          />
                          
                          {/* Mesaj Input ve Gönder Butonu - Üst Satır */}
                          <div className="flex gap-2 items-center mb-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                              placeholder="Mesajınızı yazın..."
                              className="flex-1 px-3 md:px-4 py-2.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-frozen-500 focus:border-frozen-500 text-sm md:text-base"
                            />
                            <Button
                              onClick={handleSendMessage}
                              disabled={sendingMessage || (!newMessage.trim() && !selectedImage)}
                              className="rounded-full w-10 h-10 md:w-11 md:h-11 p-0 bg-gradient-to-r from-frozen-500 to-frozen-600 hover:from-frozen-600 hover:to-frozen-700 flex-shrink-0 shadow-md"
                            >
                              {sendingMessage ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-white animate-spin" /> : <Send className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                            </Button>
                          </div>
                          
                          {/* Emoji ve Dosya Butonları - Alt Satır */}
                          <div className="flex items-center gap-2">
                            {/* Dosya Ekleme Butonu */}
                            <button
                              type="button"
                              onClick={() => messageFileInputRef.current?.click()}
                              disabled={sendingMessage || uploadingImage}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 text-xs md:text-sm"
                              title="Fotoğraf ekle"
                            >
                              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                              <span className="hidden xs:inline">Fotoğraf</span>
                            </button>
                            
                            {/* Emoji Picker Butonu */}
                            <div className="relative" ref={emojiPickerRef}>
                              <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                disabled={sendingMessage}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 text-xs md:text-sm"
                                title="Emoji ekle"
                              >
                                <Smile className="w-4 h-4" />
                                <span className="hidden xs:inline">Emoji</span>
                              </button>
                              {/* Emoji Picker Dropdown */}
                              <AnimatePresence>
                                {showEmojiPicker && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-full left-0 mb-2 w-56 md:w-64 max-h-48 md:max-h-56 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 md:p-3 z-50"
                                  >
                                    {Object.entries(emojis).map(([category, emojiList]) => (
                                      <div key={category} className="mb-2">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize font-medium">
                                          {category}
                                        </p>
                                        <div className="flex flex-wrap gap-0.5 md:gap-1">
                                          {emojiList.map((emoji, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => handleEmojiSelect(emoji)}
                                              className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-base md:text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Group Messages */}
                {messagesSubTab === 'group' && (
                  <motion.div
                    key="group-messages"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* Group Chat View - When a group is selected */}
                    {selectedGroupConversation ? (
                      <div className="flex flex-col h-[500px]">
                        {/* Group Header */}
                        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setSelectedGroupConversation(null)
                                setGroupMessages([])
                              }}
                              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                            >
                              <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-800 truncate">
                                {selectedGroupConversation.name || 'Çoklu Takas Grubu'}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {selectedGroupConversation.members?.length || 0} üye
                              </p>
                            </div>
                            <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">
                              Multi-Swap
                            </div>
                          </div>
                          {/* Members Preview */}
                          <div className="flex items-center gap-1 mt-2 overflow-x-auto">
                            {selectedGroupConversation.members?.slice(0, 5).map((member: any, idx: number) => (
                              <div key={member.id || idx} className="flex items-center gap-1 bg-white/70 px-2 py-1 rounded-full text-xs">
                                {member.image ? (
                                  <Image src={member.image} alt={member.name || ''} width={16} height={16} className="rounded-full" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px]">
                                    {(member.nickname || member.name)?.charAt(0)}
                                  </div>
                                )}
                                <span className="text-gray-700">{member.nickname || member.name?.split(' ')[0]}</span>
                              </div>
                            ))}
                            {(selectedGroupConversation.members?.length || 0) > 5 && (
                              <span className="text-xs text-gray-500">+{(selectedGroupConversation.members?.length || 0) - 5}</span>
                            )}
                          </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {loadingGroupMessages ? (
                            <div className="flex justify-center items-center h-full">
                              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                            </div>
                          ) : groupMessages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p>Henüz mesaj yok</p>
                              <p className="text-xs">İlk mesajı siz gönderin!</p>
                            </div>
                          ) : (
                            groupMessages.map((msg) => {
                              const isOwn = msg.senderId === profile?.id
                              // Fotoğraf kontrolü
                              const imageMatch = msg.content.match(/\[IMAGE\](.*?)\[\/IMAGE\]/s)
                              const imageUrl = imageMatch ? imageMatch[1] : null
                              const textContent = msg.content.replace(/\[IMAGE\].*?\[\/IMAGE\]/s, '').trim()
                              
                              return (
                                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                    {!isOwn && (
                                      <div className="flex items-center gap-1 mb-1">
                                        {msg.sender?.image ? (
                                          <Image src={msg.sender.image} alt="" width={16} height={16} className="rounded-full" />
                                        ) : (
                                          <div className="w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center text-[10px]">
                                            {(msg.sender?.nickname || msg.sender?.name)?.charAt(0)}
                                          </div>
                                        )}
                                        <span className="text-xs text-gray-500">{msg.sender?.nickname || msg.sender?.name?.split(' ')[0]}</span>
                                      </div>
                                    )}
                                    <div className={`p-3 rounded-2xl ${
                                      msg.isSystem 
                                        ? 'bg-orange-100 text-orange-800 text-center mx-auto text-sm'
                                        : isOwn 
                                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-md' 
                                          : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                                    }`}>
                                      {/* Fotoğraf varsa göster */}
                                      {imageUrl && (
                                        <div className="mb-2">
                                          <img 
                                            src={imageUrl} 
                                            alt="Paylaşılan fotoğraf" 
                                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(imageUrl, '_blank')}
                                          />
                                        </div>
                                      )}
                                      {/* Metin içeriği varsa göster */}
                                      {textContent && <span className="text-sm">{textContent}</span>}
                                      {/* Sadece fotoğraf varsa ve metin yoksa, fotoğraf ikonu göster */}
                                      {imageUrl && !textContent && (
                                        <p className="text-xs opacity-70 flex items-center gap-1">
                                          <ImageIcon className="w-3 h-3" /> Fotoğraf
                                        </p>
                                      )}
                                    </div>
                                    <p className={`text-[10px] text-gray-400 mt-1 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                      {/* Tik sistemi - sadece gönderen için göster */}
                                      {isOwn && (
                                        msg.isRead ? (
                                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                        ) : (
                                          <Check className="w-3.5 h-3.5 text-white/70" />
                                        )
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )
                            })
                          )}
                          <div ref={groupMessagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          {/* Seçili Fotoğraf Önizleme */}
                          {selectedGroupImage && (
                            <div className="mb-3 relative inline-block">
                              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 border-orange-500">
                                <img src={selectedGroupImage} alt="Seçili fotoğraf" className="w-full h-full object-cover" />
                              </div>
                              <button
                                type="button"
                                onClick={removeSelectedGroupImage}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          
                          {/* Gizli Dosya Input */}
                          <input
                            type="file"
                            ref={groupFileInputRef}
                            onChange={handleGroupFileSelect}
                            accept="image/*"
                            className="hidden"
                          />
                          
                          {/* Mesaj Input ve Gönder Butonu - Üst Satır */}
                          <div className="flex gap-2 items-center mb-2">
                            <Input
                              value={newGroupMessage}
                              onChange={(e) => setNewGroupMessage(e.target.value)}
                              placeholder="Gruba mesaj yaz..."
                              className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border-gray-300 dark:border-gray-600 text-sm md:text-base"
                              onKeyPress={(e) => e.key === 'Enter' && handleSendGroupMessage()}
                            />
                            <Button
                              onClick={handleSendGroupMessage}
                              disabled={(!newGroupMessage.trim() && !selectedGroupImage) || sendingGroupMessage}
                              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full w-10 h-10 md:w-11 md:h-11 p-0 flex-shrink-0 shadow-md"
                            >
                              {sendingGroupMessage ? (
                                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 md:w-5 md:h-5" />
                              )}
                            </Button>
                          </div>
                          
                          {/* Emoji ve Dosya Butonları - Alt Satır */}
                          <div className="flex items-center gap-2">
                            {/* Dosya Ekleme Butonu */}
                            <button
                              type="button"
                              onClick={() => groupFileInputRef.current?.click()}
                              disabled={sendingGroupMessage || uploadingGroupImage}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 text-xs md:text-sm"
                              title="Fotoğraf ekle"
                            >
                              {uploadingGroupImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                              <span className="hidden xs:inline">Fotoğraf</span>
                            </button>
                            
                            {/* Emoji Picker Butonu */}
                            <div className="relative" ref={groupEmojiPickerRef}>
                              <button
                                type="button"
                                onClick={() => setShowGroupEmojiPicker(!showGroupEmojiPicker)}
                                disabled={sendingGroupMessage}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 text-xs md:text-sm"
                                title="Emoji ekle"
                              >
                                <Smile className="w-4 h-4" />
                                <span className="hidden xs:inline">Emoji</span>
                              </button>
                              {/* Emoji Picker Dropdown */}
                              <AnimatePresence>
                                {showGroupEmojiPicker && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-full left-0 mb-2 w-56 md:w-64 max-h-48 md:max-h-56 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 md:p-3 z-50"
                                  >
                                    {Object.entries(emojis).map(([category, emojiList]) => (
                                      <div key={category} className="mb-2">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize font-medium">
                                          {category}
                                        </p>
                                        <div className="flex flex-wrap gap-0.5 md:gap-1">
                                          {emojiList.map((emoji, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => handleGroupEmojiSelect(emoji)}
                                              className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-base md:text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Group List Header */}
                        <div className="p-4 border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-800">Çoklu Takas Mesajları</h3>
                              <p className="text-xs text-gray-500">Çoklu takasa uygun kullanıcılarla grup sohbeti</p>
                            </div>
                            <Button 
                              onClick={() => setShowCreateGroupModal(true)}
                              size="sm"
                              className="bg-gradient-to-r from-orange-500 to-amber-500"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Yeni
                            </Button>
                          </div>
                        </div>
                        
                        {groupConversations.length === 0 ? (
                          <div className="p-8 text-center">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="font-semibold text-gray-800 mb-1">Henüz Grup Mesajınız Yok</h3>
                            <p className="text-sm text-gray-500 mb-4">
                              Çoklu takas için grup oluşturabilir veya davet alabilirsiniz
                            </p>
                            <Button 
                              onClick={() => setShowCreateGroupModal(true)}
                              className="bg-gradient-to-r from-orange-500 to-amber-500"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Grup Oluştur
                            </Button>
                          </div>
                        ) : (
                          <div className="divide-y max-h-[400px] overflow-y-auto">
                            {groupConversations.map((group) => (
                              <button
                                key={group.id}
                                onClick={() => handleSelectGroupConversation(group)}
                                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                              >
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-6 h-6 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-800 truncate">{group.name || 'Çoklu Takas Grubu'}</h4>
                                    <span className="text-xs text-gray-400">
                                      {group.members?.length || 0} üye
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500 truncate">
                                    {group.lastMessage?.content || 'Henüz mesaj yok'}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Valor Kazan */}
          {activeTab === 'valor' && (
            <motion.div
              key="valor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Bonus Mesajı */}
              {bonusMessage && (
                <div className={`p-4 rounded-xl ${bonusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {bonusMessage.text}
                </div>
              )}

              {/* Mevcut Valor - BUG #2 FIX: Profil kartıyla tutarlı gösterim */}
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-white/80">Mevcut Bakiye</p>
                    <p className="text-3xl font-bold">{(profile?.valorBalance || 0) - (profile?.lockedValor || 0)} Valor</p>
                    {(profile?.lockedValor || 0) > 0 && (
                      <p className="text-xs text-white/70 mt-1">({profile?.lockedValor} kilitli • Toplam: {profile?.valorBalance})</p>
                    )}
                  </div>
                  <Coins className="w-12 h-12 text-white/80" />
                </div>
                {bonusStatus?.totalEarned > 0 && (
                  <p className="text-sm text-white/80">Toplam kazanılan: {bonusStatus.totalEarned} Valor</p>
                )}
                
                {/* Ekonomik Durum Bilgileri */}
                {economicStatus && (
                  <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
                    {/* Kilitli Bonus Uyarısı */}
                    {economicStatus.lockedBonus > 0 && (
                      <div className="flex items-center gap-2 text-sm bg-white/10 rounded-lg p-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          <strong>{economicStatus.lockedBonus}V</strong> bonus kilitli 
                          (ilk takas sonrası açılır)
                        </span>
                      </div>
                    )}
                    
                    {/* İlk Takas Kazanç Limiti */}
                    {economicStatus.isInFirstSwapsPeriod && (
                      <div className="flex items-center gap-2 text-sm bg-white/10 rounded-lg p-2">
                        <Target className="w-4 h-4 flex-shrink-0" />
                        <span>
                          İlk 3 takasta max kazanç: <strong>{economicStatus.remainingGainAllowance}V</strong> kaldı
                        </span>
                      </div>
                    )}
                    
                    {/* Kullanılabilir Bakiye */}
                    <div className="flex justify-between text-sm">
                      <span className="text-white">Kullanılabilir:</span>
                      <span className="font-semibold text-white">{economicStatus.usableBalance} Valor</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 60V Altı Ürün Uyarısı */}
              {economicStatus && !economicStatus.productValueStatus.hasQualifiedProduct && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-800 mb-1">Ürün Değeri Yetersiz</h3>
                      <p className="text-sm text-amber-700 mb-3">
                        {economicStatus.productValueStatus.recommendation}
                      </p>
                      <Link href="/urun-ekle">
                        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                          <Plus className="w-4 h-4 mr-1" />
                          Ürün Ekle
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Seviye Göstergesi */}
              {userLevel && (
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Mevcut Seviyen</p>
                      <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                        {userLevel.emoji} Seviye {userLevel.level}: {userLevel.name}
                      </p>
                    </div>
                  </div>
                  
                  {/* Sonraki seviye progress */}
                  {userLevel.nextLevel && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Sonraki: {userLevel.nextLevel.emoji} {userLevel.nextLevel.name}</span>
                        <span>{userLevel.swapsToNext} takas kaldı</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${userLevel.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Mevcut bonus oranları - Mobilde 2 sütun, masaüstünde 3 */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Günlük</p>
                      <p className="text-sm font-bold text-green-600">+{userLevel.dailyBonus}V</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Takas</p>
                      <p className="text-sm font-bold text-blue-600">
                        {userLevel.swapBonusMax > 0 ? `+${userLevel.swapBonusMin}-${userLevel.swapBonusMax}V` : '🔒'}
                      </p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg col-span-2 sm:col-span-1">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Aylık Kalan</p>
                      <p className="text-sm font-bold text-purple-600">{userLevel.monthlyRemaining}V</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Günlük Bonus */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold dark:text-white">Günlük Giriş Bonusu</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {userLevel ? `Her gün +${userLevel.dailyBonus} Valor kazan!` : 'Her gün bonus kazan!'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-frozen-600 dark:text-frozen-400">+{userLevel?.dailyBonus || 1}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Valor</p>
                  </div>
                </div>
                {bonusStatus?.dailyBonus?.canClaim ? (
                  <Button 
                    onClick={claimDailyBonus} 
                    disabled={claimingBonus === 'daily'}
                    className="w-full gradient-frozen"
                  >
                    {claimingBonus === 'daily' ? 'Alınıyor...' : '🎁 Günlük Bonusu Al'}
                  </Button>
                ) : (
                  <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {bonusStatus?.dailyBonus?.hoursUntilNext || 24} saat sonra tekrar alabilirsiniz
                  </div>
                )}
              </div>

              {/* Diğer Bonus Fırsatları */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border dark:border-gray-700">
                <h3 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
                  <Target className="w-5 h-5 text-frozen-500" />
                  Bonus Fırsatları
                </h3>
                <div className="space-y-3">
                  {/* Ürün Ekleme Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Package className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-medium dark:text-white">Ürün Ekle</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userLevel?.productBonus && userLevel.productBonus > 0 
                            ? `Her ürün için +${userLevel.productBonus} Valor (max 5 ürün)`
                            : '🔒 İlk takasını tamamla, ürün bonusu açılsın!'
                          }
                        </p>
                      </div>
                    </div>
                    {userLevel?.productBonus && userLevel.productBonus > 0 ? (
                      <Link href="/urun-ekle">
                        <Button size="sm" variant="outline">Ekle</Button>
                      </Link>
                    ) : (
                      <span className="text-xl">🔒</span>
                    )}
                  </div>

                  {/* Değerlendirme Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Star className="w-8 h-8 text-yellow-500" />
                      <div>
                        <p className="font-medium dark:text-white">Değerlendirme Yap</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userLevel?.reviewBonus && userLevel.reviewBonus > 0 
                            ? `Her değerlendirme +${userLevel.reviewBonus} Valor (ayda max 10)`
                            : '🔒 İlk takasını tamamla, review bonusu açılsın!'
                          }
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{bonusStatus?.reviewBonus?.claimed || 0}/10</span>
                  </div>

                  {/* Anket Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-8 h-8 text-purple-500" />
                      <div>
                        <p className="font-medium dark:text-white">Anket Tamamla</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">+5 Valor (bir kez)</p>
                      </div>
                    </div>
                    {!bonusStatus?.surveyBonus?.claimed ? (
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('survey')}>Başla</Button>
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>

                  {/* Davet Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <User className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-medium dark:text-white">Arkadaş Davet Et</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userLevel?.referralBonus && userLevel.referralBonus > 0 
                            ? `Her davet +${userLevel.referralBonus} Valor`
                            : '🔒 İlk takasını tamamla, davet bonusu açılsın!'
                          }
                        </p>
                      </div>
                    </div>
                    <Link href="/davet">
                      <Button size="sm" variant="outline">Davet Et</Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Valor İşlem Geçmişi */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border dark:border-gray-700">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Clock className="w-5 h-5 text-frozen-500" />
                  Valor İşlem Geçmişi
                </h3>
                
                {valorLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-frozen-500" />
                  </div>
                ) : !valorHistory?.history || valorHistory.history.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Henüz işlem geçmişi yok
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {valorHistory.history.map((tx: any) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.direction === 'in' 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            <span className="text-sm">
                              {tx.direction === 'in' ? '↓' : '↑'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">
                              {tx.description}
                            </p>
                            {tx.productTitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                📦 {tx.productTitle}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(tx.date).toLocaleDateString('tr-TR', { 
                                day: 'numeric', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${
                          tx.direction === 'in' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {tx.direction === 'in' ? '+' : '-'}{tx.amount}V
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Başarılar */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Başarılar & Görevler
                </h3>

                {/* Talep Edilebilir Başarılar */}
                {achievements?.claimable && achievements.claimable.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-600 mb-2">🎉 Ödül Bekliyor!</p>
                    <div className="space-y-2">
                      {achievements.claimable.map((ach: any) => (
                        <div key={ach.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{ach.icon}</span>
                            <div>
                              <p className="font-medium">{ach.title}</p>
                              <p className="text-xs text-gray-600">{ach.description}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="gradient-frozen"
                            onClick={() => claimAchievementBonus(ach.id)}
                            disabled={claimingBonus === ach.id}
                          >
                            {claimingBonus === ach.id ? '...' : `+${ach.reward}`}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Devam Eden Görevler */}
                {achievements?.available && achievements.available.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Devam Eden</p>
                    <div className="grid grid-cols-2 gap-2">
                      {achievements.available.slice(0, 6).map((ach: any) => (
                        <div key={ach.id} className="p-3 bg-gray-50 rounded-xl text-center">
                          <span className="text-xl">{ach.icon}</span>
                          <p className="text-xs font-medium mt-1">{ach.title}</p>
                          <p className="text-xs text-gray-500">+{ach.reward} V</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tamamlanan Başarılar */}
                {achievements?.completed && achievements.completed.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Tamamlanan ({achievements.completed.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {achievements.completed.map((ach: any) => (
                        <div key={ach.id} className="px-3 py-1.5 bg-frozen-50 text-frozen-700 rounded-full text-xs flex items-center gap-1">
                          <span>{ach.icon}</span>
                          <span>{ach.title}</span>
                          <CheckCircle className="w-3 h-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Products Tab with Filters */}
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Ürünlerim ({products.length})</h2>
                <Link href="/urun-ekle">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                    <Package className="w-4 h-4 mr-2" />
                    Yeni Ürün
                  </Button>
                </Link>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Ürün ara..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600"
                  />
                </div>
                
                {/* Filter Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-9 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-medium ${showFilters ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filtreler
                </Button>
              </div>

              {/* Expanded Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                      {/* Status Filter */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Durum</label>
                        <div className="flex gap-1">
                          {[
                            { value: 'all', label: 'Tümü' },
                            { value: 'active', label: 'Aktif' },
                            { value: 'inactive', label: 'Pasif' },
                            { value: 'pending', label: 'Beklemede' },
                          ].map((f) => (
                            <button
                              key={f.value}
                              onClick={() => setProductFilter(f.value as ProductFilter)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                productFilter === f.value
                                  ? 'bg-frozen-500 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sort */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Sıralama</label>
                        <div className="flex gap-1 flex-wrap">
                          {[
                            { value: 'newest', label: 'En Yeni', icon: Clock },
                            { value: 'oldest', label: 'En Eski', icon: Clock },
                            { value: 'valor-high', label: 'Valor ↓', icon: ArrowUpDown },
                            { value: 'valor-low', label: 'Valor ↑', icon: ArrowUpDown },
                            { value: 'views', label: 'Görüntülenme', icon: Eye },
                          ].map((s) => (
                            <button
                              key={s.value}
                              onClick={() => setProductSort(s.value as ProductSort)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                productSort === s.value
                                  ? 'bg-frozen-500 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results Count */}
              {(productFilter !== 'all' || productSearch) && (
                <p className="text-sm text-gray-500 mb-3">
                  {filteredProducts.length} ürün bulundu
                </p>
              )}

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-14 h-14 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    {products.length === 0 ? 'Henüz ürününüz yok' : 'Filtrelerle eşleşen ürün yok'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {products.length === 0 ? 'Takas yapmak için ilk ürününüzü ekleyin' : 'Farklı filtreler deneyin'}
                  </p>
                  {products.length === 0 && (
                    <Link href="/urun-ekle">
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                        Ürün Ekle
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all relative">
                      <Link href={`/urun/${product.id}`}>
                        <div className="aspect-square relative bg-gray-100">
                          {product.images?.[0] && (
                            <Image
                              src={product.images[0]}
                              alt={product.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                            {/* Boost Badge */}
                            {product.isBoosted && product.boostExpiresAt && new Date(product.boostExpiresAt) > new Date() && (
                              <div className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm">
                                🚀 Öne Çıkmış
                              </div>
                            )}
                            {/* Status Badge */}
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              product.status === 'active' ? 'bg-green-100 text-green-700' : 
                              product.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {product.status === 'active' ? 'Aktif' : product.status === 'pending' ? 'Beklemede' : 'Pasif'}
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5">
                          <h3 className="font-medium text-gray-800 text-sm truncate">{product.title}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-frozen-600 font-bold text-sm">{product.valorPrice} V</span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              <Eye className="w-3 h-3" />
                              {product.views}
                            </span>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Action Button */}
                      <div className="absolute top-2 left-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenProductMenu(openProductMenu === product.id ? null : product.id)
                          }}
                          className="p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm transition-all"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                        
                        {/* Dropdown Menu */}
                        {openProductMenu === product.id && (
                          <div className="absolute top-8 left-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-10">
                            {/* Öne Çıkar Butonu */}
                            {product.status === 'active' && boostInfo?.available && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const isBoosted = product.isBoosted && product.boostExpiresAt && new Date(product.boostExpiresAt) > new Date()
                                  if (isBoosted) return
                                  const costText = boostInfo.freeBoostsRemaining > 0 ? 'Bedava' : `${boostInfo.cost}V`
                                  if (confirm(`${costText} harcayarak ürünü ${boostInfo.durationHours} saat öne çıkarmak ister misiniz?`)) {
                                    boostProduct(product.id)
                                    setOpenProductMenu(null)
                                  }
                                }}
                                disabled={boostingProduct === product.id || !!(product.isBoosted && product.boostExpiresAt && new Date(product.boostExpiresAt) > new Date())}
                                className="w-full px-3 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2 disabled:opacity-50 text-gray-800 font-medium border-b border-gray-100"
                              >
                                {boostingProduct === product.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                ) : (
                                  <span className="text-base">🚀</span>
                                )}
                                <span className="text-gray-800">
                                  {product.isBoosted && product.boostExpiresAt && new Date(product.boostExpiresAt) > new Date()
                                    ? '⭐ Öne Çıkmış'
                                    : `Öne Çıkar ${boostInfo.freeBoostsRemaining > 0 ? '(Bedava)' : `(${boostInfo.cost}V)`}`
                                  }
                                </span>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleProductStatus(product.id, product.status)
                              }}
                              disabled={productActionLoading === product.id}
                              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 text-gray-800 font-medium"
                            >
                              {productActionLoading === product.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                              ) : product.status === 'active' ? (
                                <EyeOff className="w-4 h-4 text-orange-600" />
                              ) : (
                                <Eye className="w-4 h-4 text-green-600" />
                              )}
                              <span className="text-gray-800">
                                {product.status === 'active' ? 'Yayından Kaldır' : 'Yayına Al'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Favorilerim Tab */}
          {activeTab === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Favorilerim</h2>
                  <p className="text-sm text-gray-500">Beğendiğiniz ürünler</p>
                </div>
              </div>
              <FavoritesTab />
            </motion.div>
          )}

          {/* Değerlendirmeler Tab */}
          {activeTab === 'reviews' && profile && (
            <motion.div
              key="reviews"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Değerlendirme Özeti */}
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Değerlendirmelerim</h2>
                    <p className="text-sm text-gray-500">Diğer kullanıcıların sizin hakkınızdaki yorumları</p>
                  </div>
                  <TrustBadge trustScore={profile.trustScore} size="lg" />
                </div>
                <UserRatingSummary userId={profile.id} />
              </div>

              {/* Bekleyen Değerlendirmeler */}
              <PendingReviewsSection />

              {/* Yorum Listesi */}
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Tüm Yorumlar</h3>
                <ReviewList userId={profile.id} />
              </div>
            </motion.div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && profile && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm p-4 sm:p-6"
            >
              <BadgeDisplay 
                userId={profile.id} 
                showAll={true}
                onBadgeToggle={(badgeId, isDisplayed) => {
                  console.log('Badge toggled:', badgeId, isDisplayed)
                }}
              />
            </motion.div>
          )}

          {/* Survey Tab */}
          {activeTab === 'survey' && (
            <motion.div
              key="survey"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-sm p-6"
            >
              {profile.surveyCompleted ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                  <h2 className="text-lg font-bold text-gray-800 mb-2">Anket Tamamlandı!</h2>
                  <p className="text-gray-600 text-sm mb-6">Katılımınız için teşekkür ederiz.</p>
                  
                  <div className="max-w-lg mx-auto text-left">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">Cevaplarınız:</h3>
                    <div className="space-y-2">
                      {surveyQuestions.map((q) => {
                        const answer = surveyAnswers[q.id]
                        if (!answer) return null
                        return (
                          <div key={q.id} className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-500">{q.question}</p>
                            <p className="text-gray-800 font-medium text-sm">
                              {Array.isArray(answer) ? answer.join(', ') : answer}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800">Anketimize Katılın</h2>
                    <p className="text-gray-700 text-sm mt-1">Tercihlerinizi öğrenmemize yardımcı olun</p>
                    <div className="mt-4 bg-gray-300 rounded-full h-2">
                      <div 
                        className="gradient-frozen h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / surveyQuestions.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-700 mt-2 font-medium">
                      {currentQuestion + 1} / {surveyQuestions.length} soru
                    </p>
                  </div>

                  <div className="min-h-[280px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentQuestion}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className="text-base font-semibold text-gray-800 mb-4">
                          {surveyQuestions[currentQuestion].question}
                        </h3>
                        <div className="space-y-2">
                          {surveyQuestions[currentQuestion].options.map((option) => {
                            const isMultiple = surveyQuestions[currentQuestion].type === 'multiple'
                            const questionId = surveyQuestions[currentQuestion].id
                            const isSelected = isMultiple
                              ? ((surveyAnswers[questionId] as string[]) || []).includes(option)
                              : surveyAnswers[questionId] === option

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleSurveyAnswer(questionId, option, isMultiple)}
                                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                                  isSelected
                                    ? 'border-frozen-500 bg-frozen-50 text-frozen-700 font-medium'
                                    : 'border-gray-400 hover:border-gray-500 hover:bg-gray-50 text-gray-800'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-${isMultiple ? 'md' : 'full'} border-2 flex items-center justify-center ${
                                    isSelected ? 'border-frozen-500 bg-frozen-500' : 'border-gray-500'
                                  }`}>
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="font-medium">{option}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        {surveyQuestions[currentQuestion].type === 'multiple' && (
                          <p className="text-xs text-gray-500 mt-2">* Birden fazla seçebilirsiniz</p>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentQuestion(prev => prev - 1)}
                      disabled={currentQuestion === 0}
                      size="sm"
                    >
                      Önceki
                    </Button>
                    {currentQuestion < surveyQuestions.length - 1 ? (
                      <Button
                        onClick={() => setCurrentQuestion(prev => prev + 1)}
                        disabled={!surveyAnswers[surveyQuestions[currentQuestion].id]}
                        size="sm"
                      >
                        Sonraki
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmitSurvey}
                        disabled={surveySubmitting || !surveyAnswers[surveyQuestions[currentQuestion].id]}
                        className="gradient-frozen"
                        size="sm"
                      >
                        {surveySubmitting ? 'Gönderiliyor...' : 'Anketi Tamamla'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b bg-gradient-to-r from-orange-500 to-amber-500">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold">Çoklu Mesaj Grubu Oluştur</h3>
                  </div>
                  <button
                    onClick={() => setShowCreateGroupModal(false)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grup Adı (İsteğe Bağlı)</label>
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Örn: Elektronik Takası"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Davet Et</label>
                  <div className="flex gap-2">
                    <Input
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="Kullanıcı adı veya takma ad..."
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && inviteUsername.trim()) {
                          setSearchingUsers(true)
                          try {
                            const res = await fetch(`/api/messages/search-users?q=${encodeURIComponent(inviteUsername)}`)
                            if (res.ok) {
                              const users = await res.json()
                              setGroupInviteResults(users)
                            }
                          } catch (err) {
                            console.error(err)
                          }
                          setSearchingUsers(false)
                        }
                      }}
                    />
                    <Button
                      onClick={async () => {
                        if (!inviteUsername.trim()) return
                        setSearchingUsers(true)
                        try {
                          const res = await fetch(`/api/messages/search-users?q=${encodeURIComponent(inviteUsername)}`)
                          if (res.ok) {
                            const users = await res.json()
                            setGroupInviteResults(users)
                          }
                        } catch (err) {
                          console.error(err)
                        }
                        setSearchingUsers(false)
                      }}
                      disabled={searchingUsers || !inviteUsername.trim()}
                      size="icon"
                    >
                      {searchingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {groupInviteResults.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-500">Arama Sonuçları:</p>
                    {groupInviteResults.map((user: any) => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          selectedGroupMembers.find((m: any) => m.id === user.id)
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {user.image ? (
                              <Image src={user.image} alt="" width={32} height={32} className="object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.nickname || user.name}</p>
                            <p className="text-xs text-gray-500">{user.name}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={selectedGroupMembers.find((m: any) => m.id === user.id) ? "default" : "outline"}
                          onClick={() => {
                            if (selectedGroupMembers.find((m: any) => m.id === user.id)) {
                              setSelectedGroupMembers((prev: any[]) => prev.filter((m: any) => m.id !== user.id))
                            } else {
                              setSelectedGroupMembers((prev: any[]) => [...prev, user])
                            }
                          }}
                        >
                          {selectedGroupMembers.find((m: any) => m.id === user.id) ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedGroupMembers.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Seçili Üyeler ({selectedGroupMembers.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedGroupMembers.map((user: any) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs"
                        >
                          <span>{user.nickname || user.name}</span>
                          <button
                            onClick={() => setSelectedGroupMembers((prev: any[]) => prev.filter((m: any) => m.id !== user.id))}
                            className="hover:bg-orange-200 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <p className="font-medium mb-1">💡 Çoklu Takas Grubu Hakkında</p>
                  <p>Bu grup, çoklu takas yapmak isteyen kullanıcıları bir araya getirir. Grup üyeleri birlikte takas fırsatlarını görüşebilir.</p>
                </div>
              </div>

              <div className="p-4 border-t flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateGroupModal(false)
                    setNewGroupName('')
                    setInviteUsername('')
                    setGroupInviteResults([])
                    setSelectedGroupMembers([])
                  }}
                >
                  İptal
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500"
                  disabled={selectedGroupMembers.length === 0 || creatingGroup}
                  onClick={async () => {
                    if (selectedGroupMembers.length === 0) return
                    setCreatingGroup(true)
                    try {
                      const res = await fetch('/api/messages/groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: newGroupName || undefined,
                          memberIds: selectedGroupMembers.map((m: any) => m.id)
                        })
                      })
                      if (res.ok) {
                        const newGroup = await res.json()
                        setGroupConversations((prev: any[]) => [newGroup, ...prev])
                        setShowCreateGroupModal(false)
                        setNewGroupName('')
                        setInviteUsername('')
                        setGroupInviteResults([])
                        setSelectedGroupMembers([])
                        setMessagesSubTab('group')
                        setToast({ message: 'Grup başarıyla oluşturuldu!', type: 'success' })
                      } else {
                        const err = await res.json()
                        setToast({ message: err.error || 'Grup oluşturulamadı', type: 'error' })
                      }
                    } catch (err) {
                      setToast({ message: 'Bir hata oluştu', type: 'error' })
                    }
                    setCreatingGroup(false)
                  }}
                >
                  {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                  Grup Oluştur
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Şifre Değiştirme Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Şifre Değiştir
                  </h2>
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    className="text-white/80 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {passwordSuccess}
                  </div>
                )}

                {/* Mevcut Şifre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mevcut Şifre
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Mevcut şifrenizi girin"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Yeni Şifre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yeni Şifre
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="En az 8 karakter"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    En az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 rakam içermeli
                  </p>
                </div>

                {/* Şifre Tekrar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yeni Şifre (Tekrar)
                  </label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Yeni şifrenizi tekrar girin"
                  />
                </div>

                {/* Butonlar */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="flex-1 bg-amber-500 hover:bg-amber-600"
                  >
                    {changingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Değiştiriliyor...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Şifreyi Değiştir
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordModal(false)
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      setPasswordError('')
                      setPasswordSuccess('')
                    }}
                    className="border-gray-300"
                  >
                    İptal
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Valor Geçmişi Modal */}
      {showValorHistory && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50"
          onClick={() => setShowValorHistory(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">💰 Valor Geçmişi</h3>
                <button onClick={() => setShowValorHistory(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              {valorHistory && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg text-center">
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{valorHistory.balance}</p>
                    <p className="text-[10px] text-purple-500">Toplam</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-center">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{valorHistory.locked}</p>
                    <p className="text-[10px] text-amber-500">Kilitli</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-center">
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">{valorHistory.available}</p>
                    <p className="text-[10px] text-green-500">Kullanılabilir</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {valorLoading ? (
                <p className="text-center text-gray-500 py-8">Yükleniyor...</p>
              ) : valorHistory?.history?.length > 0 ? (
                <div className="space-y-2">
                  {valorHistory.history.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className={`text-lg ${item.direction === 'in' ? 'text-green-500' : 'text-red-500'}`}>
                        {item.direction === 'in' ? '📥' : '📤'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.productTitle || item.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${
                        item.direction === 'in' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.direction === 'in' ? '+' : '-'}{item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Henüz hareket yok</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fotoğraf Seçenekleri Modal */}
      {showPhotoOptions && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowPhotoOptions(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 pb-8 sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Profil Fotoğrafı</h3>
            
            <div className="space-y-3">
              {/* Kamera ile Çek */}
              <button
                onClick={openProfileCamera}
                className="w-full flex items-center gap-4 p-4 bg-frozen-50 hover:bg-frozen-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-frozen-500 rounded-full flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Fotoğraf Çek</p>
                  <p className="text-sm text-gray-500">Ön kamera ile selfie çek</p>
                </div>
              </button>
              
              {/* Galeriden Seç */}
              <button
                onClick={() => {
                  setShowPhotoOptions(false)
                  photoInputRef.current?.click()
                }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Galeriden Seç</p>
                  <p className="text-sm text-gray-500">Mevcut fotoğraflardan seç</p>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowPhotoOptions(false)}
              className="w-full mt-4 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              İptal
            </button>
          </motion.div>
        </div>
      )}

      {/* Kamera Modal */}
      {showProfileCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            <button
              onClick={closeProfileCamera}
              className="p-2 text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <span className="text-white font-medium">Profil Fotoğrafı</span>
            <div className="w-10" />
          </div>
          
          {/* Kamera/Önizleme Alanı */}
          <div className="flex-1 flex items-center justify-center bg-black relative">
            {photoPreview ? (
              /* Çekilen Fotoğraf Önizleme */
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Önizleme" 
                  className="max-w-[300px] max-h-[300px] rounded-full object-cover"
                />
              </div>
            ) : (
              /* Canlı Kamera */
              <>
                <video
                  ref={profileVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-w-full max-h-full object-contain"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Yuvarlak Kılavuz */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 sm:w-80 sm:h-80 border-4 border-white/50 rounded-full" />
                </div>
                {!profileCameraStream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                  </div>
                )}
              </>
            )}
            {/* Gizli Canvas */}
            <canvas ref={profileCanvasRef} className="hidden" />
          </div>
          
          {/* Alt Butonlar */}
          <div className="p-6 bg-black/50">
            {photoPreview ? (
              /* Önizleme Butonları */
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setPhotoPreview(null)
                    openProfileCamera()
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-full font-medium hover:bg-gray-700 transition-colors"
                >
                  Tekrar Çek
                </button>
                <button
                  onClick={uploadCapturedPhoto}
                  disabled={uploadingPhoto}
                  className="px-6 py-3 bg-frozen-500 text-white rounded-full font-medium hover:bg-frozen-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Yükleniyor...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Kullan
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Çekim Butonu */
              <div className="flex justify-center">
                <button
                  onClick={captureProfilePhoto}
                  disabled={!profileCameraStream}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-16 h-16 bg-frozen-500 rounded-full" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

// Favoriler Alt Bileşeni
function FavoritesTab() {
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavorites(data.favorites || [])
      }
    } catch (error) {
      console.error('Favorites fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 h-48 rounded-xl" />
        ))}
      </div>
    )
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Henüz Favoriniz Yok</h3>
        <p className="text-gray-500 mb-4">Beğendiğiniz ürünleri favorilere ekleyin</p>
        <Link href="/urunler">
          <Button>Ürünleri Keşfet</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {favorites.map((product) => (
        <Link key={product.id} href={`/urun/${product.id}`}>
          <div className="group bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all">
            <div className="relative aspect-square bg-gray-100">
              {product.images?.[0] && (
                <Image
                  src={product.images[0]}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              )}
              <div className="absolute top-2 right-2">
                <FavoriteButton productId={product.id} initialCount={product.favoriteCount} size="sm" />
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-medium text-gray-800 text-sm truncate">{product.title}</h3>
              <div className="flex items-center justify-between mt-1">
                <span className="text-frozen-600 font-bold text-sm">{product.valorPrice} V</span>
                <span className="text-xs text-gray-400">
                  {product.favoriteCount} ❤️
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// Bekleyen Değerlendirmeler Alt Bileşeni
function PendingReviewsSection() {
  const [pendingReviews, setPendingReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSwap, setSelectedSwap] = useState<any>(null)

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const fetchPendingReviews = async () => {
    try {
      const res = await fetch('/api/reviews?checkPending=true')
      if (res.ok) {
        const data = await res.json()
        setPendingReviews(data.pendingReviews || [])
      }
    } catch (error) {
      console.error('Pending reviews fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || pendingReviews.length === 0) return null

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-sm p-4 sm:p-6 border border-amber-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Değerlendirme Bekliyor</h3>
            <p className="text-sm text-gray-600">{pendingReviews.length} takas değerlendirmenizi bekliyor</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {pendingReviews.map((swap) => (
            <div key={swap.swapId} className="flex items-center justify-between bg-white rounded-xl p-3 border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                  {swap.product?.images?.[0] && (
                    <Image src={swap.product.images[0]} alt="" width={48} height={48} className="object-cover" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{swap.product?.title}</p>
                  <p className="text-xs text-gray-500">
                    {swap.otherUser?.name} ile takas
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => setSelectedSwap(swap)}
                className="bg-amber-500 hover:bg-amber-600"
              >
                Değerlendir
              </Button>
            </div>
          ))}
        </div>
      </div>

      {selectedSwap && (
        <ReviewModal
          isOpen={!!selectedSwap}
          onClose={() => setSelectedSwap(null)}
          swapId={selectedSwap.swapId}
          otherUser={selectedSwap.otherUser}
          productTitle={selectedSwap.product?.title || 'Ürün'}
          onSuccess={() => {
            fetchPendingReviews()
            setSelectedSwap(null)
          }}
        />
      )}
    </>
  )
}