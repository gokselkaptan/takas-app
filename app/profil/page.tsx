'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { 
  User, Package, ClipboardList, Settings, Edit2, Save, X, 
  MapPin, Phone, Mail, Calendar, Star, CheckCircle, ChevronRight,
  Eye, EyeOff, Heart, TrendingUp, Award, Bell, Tag, Gift, ShoppingBag,
  MessageSquare, Filter, SlidersHorizontal, Search, Sparkles,
  ArrowUpDown, Clock, CheckCheck, Send, AlertTriangle, ArrowLeft, Shield,
  Coins, Trophy, Target, Zap, Camera, Upload, Loader2, MoreVertical,
  Users, Plus, UserPlus, RefreshCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SwapManagement } from '@/components/swap-management'
import { FavoriteButton } from '@/components/favorite-button'
import { UserRatingSummary, ReviewList, TrustBadge } from '@/components/user-rating'
import { ReviewModal } from '@/components/review-modal'
import { usePushNotifications } from '@/components/pwa-provider'
import { useLanguage } from '@/lib/language-context'

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

type TabType = 'foryou' | 'messages' | 'products' | 'survey' | 'favorites' | 'reviews' | 'valor'
type ProductFilter = 'all' | 'active' | 'inactive' | 'pending'
type ProductSort = 'newest' | 'oldest' | 'valor-high' | 'valor-low' | 'views'

export default function ProfilPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const initialTab = (searchParams?.get('tab') as TabType) || 'foryou'
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  
  // URL tab parametresi değiştiğinde sekmeyi güncelle
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab') as TabType
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])
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
  
  // Sub-tab for "Sana Özel" (offers, swaps) - Bildirimler artık header dropdown'da
  const [foryouSubTab, setForyouSubTab] = useState<'offers' | 'swaps'>('offers')
  
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
  
  // Valor Bonus state
  const [bonusStatus, setBonusStatus] = useState<any>(null)
  const [achievements, setAchievements] = useState<{ completed: any[], available: any[], claimable: any[] } | null>(null)
  const [claimingBonus, setClaimingBonus] = useState<string | null>(null)
  const [bonusMessage, setBonusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Dynamic notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  
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
        const receivedRequests = await receivedRes.json()
        
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
        const sentRequests = await sentRes.json()
        
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
      
      // Welcome bonus notification (one-time display)
      if (profile && profile.valorBalance >= 50) {
        const welcomeShown = typeof window !== 'undefined' ? localStorage.getItem('welcomeBonusShown') : null
        if (!welcomeShown) {
          allNotifs.push({
            id: 'welcome-bonus',
            type: 'campaign',
            title: '🎉 Hoş Geldin Bonusu',
            message: '50 Valor hoş geldin bonusunuz hesabınıza eklendi!',
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.email) {
      fetchProfile()
      fetchProducts()
      fetchNotifications()
    }
  }, [session])
  
  // Re-fetch notifications when profile changes
  useEffect(() => {
    if (profile) {
      fetchNotifications()
    }
  }, [profile?.trustScore])

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

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
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
        // Show nickname prompt for users without a nickname
        // Only show once per session
        if (!data.nickname && !sessionStorage.getItem('nicknamePromptDismissed')) {
          setShowNicknamePrompt(true)
        }
      }
    } catch (error) {
      console.error('Profil yüklenemedi:', error)
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
        setBonusMessage({ type: 'success', text: `🎉 +${data.bonus} Valor kazandınız!` })
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
    try {
      const res = await fetch('/api/messages')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
        setMessageStats(data.stats || { totalMessages: 0, readMessages: 0, unreadMessages: 0 })
      }
    } catch (error) {
      console.error('Konuşmalar yüklenemedi:', error)
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
    if (!newGroupMessage.trim() || !selectedGroupConversation || sendingGroupMessage) return
    
    setSendingGroupMessage(true)
    try {
      const res = await fetch(`/api/messages/groups/${selectedGroupConversation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newGroupMessage.trim() })
      })
      
      if (res.ok) {
        const newMsg = await res.json()
        setGroupMessages(prev => [...prev, newMsg])
        setNewGroupMessage('')
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
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return
    
    setSendingMessage(true)
    setMessageWarning(null)
    
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          content: newMessage.trim(),
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
    if (activeTab === 'messages' && session?.user?.email) {
      fetchConversations()
      fetchGroupConversations()
    }
  }, [activeTab, session])

  // Valor sekmesi açıldığında bonus ve başarıları yükle
  useEffect(() => {
    if (activeTab === 'valor' && session?.user?.email) {
      fetchBonusStatus()
      fetchAchievements()
    }
  }, [activeTab, session])

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
        
        setActiveTab('foryou')
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

  if (!profile) return null

  const totalUnreadMessages = messageStats.unreadMessages

  // Bekleyen teklif sayısını hesapla
  const pendingOffersCount = 0 // SwapManagement'tan gelecek

  const mainTabs = [
    { id: 'foryou', label: 'Sana Özel', icon: Sparkles, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'messages', label: 'Mesajlar', icon: MessageSquare, badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined },
  ]

  const settingsTabs = [
    { id: 'products', label: 'Ürünlerim', icon: Package },
    { id: 'favorites', label: 'Favorilerim', icon: Heart },
    { id: 'reviews', label: 'Değerlendirmeler', icon: Star },
    { id: 'valor', label: 'Valor', icon: Coins },
    { id: 'survey', label: 'Anket', icon: ClipboardList, showBadge: !profile.surveyCompleted },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-12">
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
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {profile.image ? (
                  <Image src={profile.image} alt={profile.name || ''} width={80} height={80} className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-frozen-100">
                    <User className="w-10 h-10 text-frozen-400" />
                  </div>
                )}
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
                <div className="text-center px-3 py-1.5 bg-frozen-50 rounded-xl">
                  <div className="text-lg font-bold text-frozen-600">{profile.valorBalance - (profile.lockedValor || 0)}</div>
                  <div className="text-[10px] text-gray-500">Valor</div>
                  {profile.lockedValor > 0 && (
                    <div className="text-[9px] text-amber-600">({profile.lockedValor} kilitli)</div>
                  )}
                </div>
                <div className="text-center px-3 py-1.5 bg-green-50 rounded-xl">
                  <div className="text-lg font-bold text-green-600">{profile.trustScore}</div>
                  <div className="text-[10px] text-gray-500">Güven</div>
                </div>
              </div>
            </div>
            
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
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveProfile} size="sm" disabled={saving} className="bg-frozen-500 hover:bg-frozen-600">
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                      </Button>
                      <Button onClick={() => setEditing(false)} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                        <X className="w-4 h-4 mr-1" />
                        İptal
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
                    
                    {/* Bildirim Ayarları */}
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        Bildirim Ayarları
                      </h3>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl border border-blue-200 dark:border-blue-700 space-y-4">
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
                        
                        {/* Test Notification Button */}
                        <Button
                          onClick={async () => {
                            setNotificationTestStatus('testing')
                            try {
                              // First check if notifications are supported
                              if (!('Notification' in window)) {
                                setNotificationTestStatus('error')
                                alert('Bu tarayıcı bildirimleri desteklemiyor.')
                                return
                              }
                              
                              // Request permission if not granted
                              if (Notification.permission === 'denied') {
                                setNotificationTestStatus('error')
                                alert('Bildirim izni reddedilmiş. Tarayıcı ayarlarından izin verin.')
                                return
                              }
                              
                              if (Notification.permission !== 'granted') {
                                const permission = await Notification.requestPermission()
                                if (permission !== 'granted') {
                                  setNotificationTestStatus('error')
                                  alert('Bildirim izni verilmedi.')
                                  return
                                }
                              }
                              
                              // Send test notification
                              const notification = new Notification('🔔 TAKAS-A Test Bildirimi', {
                                body: 'Tebrikler! Bildirimler başarıyla çalışıyor. Artık takas ve mesaj bildirimlerini alacaksınız.',
                                icon: '/icons/icon-192x192.png',
                                badge: '/icons/badge-96x96.png',
                                tag: 'test-notification',
                                requireInteraction: false
                              })
                              
                              notification.onclick = () => {
                                window.focus()
                                notification.close()
                              }
                              
                              setNotificationTestStatus('success')
                              setTimeout(() => setNotificationTestStatus('idle'), 3000)
                              
                            } catch (error) {
                              console.error('Bildirim test hatası:', error)
                              setNotificationTestStatus('error')
                              alert('Bildirim gönderilemedi. Lütfen tekrar deneyin.')
                            }
                          }}
                          size="sm"
                          disabled={notificationTestStatus === 'testing'}
                          className={`w-full font-semibold transition-all ${
                            notificationTestStatus === 'success' 
                              ? 'bg-green-500 hover:bg-green-600 text-white' 
                              : notificationTestStatus === 'error'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {notificationTestStatus === 'testing' ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Test Ediliyor...
                            </>
                          ) : notificationTestStatus === 'success' ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Bildirim Gönderildi!
                            </>
                          ) : notificationTestStatus === 'error' ? (
                            <>
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Hata Oluştu
                            </>
                          ) : (
                            <>
                              <Bell className="w-4 h-4 mr-2" />
                              Bildirimleri Test Et
                            </>
                          )}
                        </Button>
                        
                        <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                          💡 Test butonuna tıkladığınızda bir bildirim alacaksınız
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

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
          {/* Sana Özel - For You (Simplified) */}
          {activeTab === 'foryou' && (
            <motion.div
              key="foryou"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Sub-tabs for Sana Özel - Bildirimler header dropdown'a taşındı */}
              <div className="bg-white rounded-xl shadow-sm mb-4 p-1 flex gap-1">
                <button
                  onClick={() => setForyouSubTab('offers')}
                  className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                    foryouSubTab === 'offers'
                      ? 'gradient-frozen text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  Teklifler
                </button>
                <button
                  onClick={() => setForyouSubTab('swaps')}
                  className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                    foryouSubTab === 'swaps'
                      ? 'gradient-frozen text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Takaslarım
                </button>
              </div>

              {/* Sub-tab Content for Sana Özel */}
              <AnimatePresence mode="wait">
                {/* Offers Sub-tab */}
                {foryouSubTab === 'offers' && profile && (
                  <motion.div
                    key="offers-sub"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <SwapManagement userId={profile.id} type="offers" highlightedSwapId={highlightedSwapId} />
                  </motion.div>
                )}

                {/* Swaps Sub-tab */}
                {foryouSubTab === 'swaps' && profile && (
                  <motion.div
                    key="swaps-sub"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <SwapManagement userId={profile.id} type="swaps" highlightedSwapId={highlightedSwapId} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

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
                        {conversations.length === 0 ? (
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
                                    <Image src={conv.otherUser.image} alt="" width={48} height={48} className="object-cover" />
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
                              <Image src={selectedConversation.otherUser.image} alt="" width={40} height={40} className="object-cover" />
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
                              return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                                    <div className={`px-4 py-2 rounded-2xl ${
                                      isMe 
                                        ? 'bg-frozen-500 text-white rounded-br-md' 
                                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                                    }`}>
                                      <p className="text-sm">{msg.content}</p>
                                    </div>
                                    <p className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right' : ''}`}>
                                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                              placeholder="Mesajınızı yazın..."
                              className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-frozen-500 focus:border-frozen-500"
                            />
                            <Button
                              onClick={handleSendMessage}
                              disabled={sendingMessage || !newMessage.trim()}
                              className="rounded-full w-10 h-10 p-0 bg-gradient-to-r from-frozen-500 to-frozen-600 hover:from-frozen-600 hover:to-frozen-700"
                            >
                              <Send className="w-4 h-4 text-white" />
                            </Button>
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
                                      {msg.content}
                                    </div>
                                    <p className={`text-[10px] text-gray-400 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              )
                            })
                          )}
                          <div ref={groupMessagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <div className="flex gap-2">
                            <Input
                              value={newGroupMessage}
                              onChange={(e) => setNewGroupMessage(e.target.value)}
                              placeholder="Gruba mesaj yaz..."
                              className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border-gray-300 dark:border-gray-600"
                              onKeyPress={(e) => e.key === 'Enter' && handleSendGroupMessage()}
                            />
                            <Button
                              onClick={handleSendGroupMessage}
                              disabled={!newGroupMessage.trim() || sendingGroupMessage}
                              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                            >
                              {sendingGroupMessage ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
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

              {/* Mevcut Valor */}
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-white/80">Mevcut Bakiye</p>
                    <p className="text-3xl font-bold">{profile?.valorBalance || 0} Valor</p>
                  </div>
                  <Coins className="w-12 h-12 text-white/80" />
                </div>
                {bonusStatus?.totalEarned > 0 && (
                  <p className="text-sm text-white/80">Toplam kazanılan: {bonusStatus.totalEarned} Valor</p>
                )}
              </div>

              {/* Günlük Bonus */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Günlük Giriş Bonusu</h3>
                    <p className="text-sm text-gray-500">Her gün +5 Valor kazan!</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-frozen-600">+5</p>
                    <p className="text-xs text-gray-500">Valor</p>
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
                  <div className="text-center py-2 text-gray-500 text-sm">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {bonusStatus?.dailyBonus?.hoursUntilNext || 24} saat sonra tekrar alabilirsiniz
                  </div>
                )}
              </div>

              {/* Diğer Bonus Fırsatları */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-frozen-500" />
                  Bonus Fırsatları
                </h3>
                <div className="space-y-3">
                  {/* Ürün Ekleme Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Package className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-medium">Ürün Ekle</p>
                        <p className="text-xs text-gray-500">
                          İlk 3 ürün için +30 Valor ({bonusStatus?.productBonus?.claimed || 0}/{bonusStatus?.productBonus?.max || 3})
                        </p>
                      </div>
                    </div>
                    {(bonusStatus?.productBonus?.remaining || 0) > 0 ? (
                      <Link href="/urun-ekle">
                        <Button size="sm" variant="outline">Ekle</Button>
                      </Link>
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>

                  {/* Değerlendirme Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Star className="w-8 h-8 text-yellow-500" />
                      <div>
                        <p className="font-medium">Değerlendirme Yap</p>
                        <p className="text-xs text-gray-500">
                          Her değerlendirme +10 Valor (ayda max 10)
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{bonusStatus?.reviewBonus?.claimed || 0}/10</span>
                  </div>

                  {/* Anket Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-8 h-8 text-purple-500" />
                      <div>
                        <p className="font-medium">Anket Tamamla</p>
                        <p className="text-xs text-gray-500">+25 Valor (bir kez)</p>
                      </div>
                    </div>
                    {!bonusStatus?.surveyBonus?.claimed ? (
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('survey')}>Başla</Button>
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>

                  {/* Davet Bonusu */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <User className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-medium">Arkadaş Davet Et</p>
                        <p className="text-xs text-gray-500">Her davet +100 Valor</p>
                      </div>
                    </div>
                    <Link href="/davet">
                      <Button size="sm" variant="outline">Davet Et</Button>
                    </Link>
                  </div>
                </div>
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
                <h2 className="text-lg font-bold text-gray-800">Ürünlerim ({products.length})</h2>
                <Link href="/urun-ekle">
                  <Button size="sm">
                    <Package className="w-4 h-4 mr-2" />
                    Yeni Ürün
                  </Button>
                </Link>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Ürün ara..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                
                {/* Filter Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-9 ${showFilters ? 'bg-frozen-50 border-frozen-300' : ''}`}
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
                  <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-600 mb-2">
                    {products.length === 0 ? 'Henüz ürününüz yok' : 'Filtrelerle eşleşen ürün yok'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {products.length === 0 ? 'Takas yapmak için ilk ürününüzü ekleyin' : 'Farklı filtreler deneyin'}
                  </p>
                  {products.length === 0 && (
                    <Link href="/urun-ekle">
                      <Button>
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
                          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            product.status === 'active' ? 'bg-green-100 text-green-700' : 
                            product.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {product.status === 'active' ? 'Aktif' : product.status === 'pending' ? 'Beklemede' : 'Pasif'}
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
                          <div className="absolute top-8 left-0 bg-white rounded-lg shadow-lg border py-1 min-w-[140px] z-10">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleProductStatus(product.id, product.status)
                              }}
                              disabled={productActionLoading === product.id}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                            >
                              {productActionLoading === product.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : product.status === 'active' ? (
                                <EyeOff className="w-4 h-4 text-orange-500" />
                              ) : (
                                <Eye className="w-4 h-4 text-green-500" />
                              )}
                              <span>
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
                    <p className="text-gray-600 text-sm mt-1">Tercihlerinizi öğrenmemize yardımcı olun</p>
                    <div className="mt-4 bg-gray-200 rounded-full h-2">
                      <div 
                        className="gradient-frozen h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / surveyQuestions.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
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
                                    ? 'border-frozen-500 bg-frozen-50 text-frozen-700'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-${isMultiple ? 'md' : 'full'} border-2 flex items-center justify-center ${
                                    isSelected ? 'border-frozen-500 bg-frozen-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  {option}
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