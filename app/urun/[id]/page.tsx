'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, ArrowLeftRight, Heart, MessageCircle, Share2, MapPin, Calendar, Eye, Tag, 
  User, ChevronLeft, ChevronRight, Send, X, AlertCircle, CheckCircle,
  Package, Star, Clock, Info, Users, Sparkles, Upload, Home, Loader2, Phone
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { addToRecentViews } from '@/components/home/recent-views'
import { FavoriteButton, FavoriteCount } from '@/components/favorite-button'
import { TrustBadge, StarRating, UserRatingSummary } from '@/components/user-rating'
import { getDisplayName } from '@/lib/display-name'
import { useBodyScrollLock } from '@/components/mobile-navigation'

interface Product {
  id: string
  title: string
  description: string
  translatedTitle?: string
  translatedDescription?: string
  translatedCondition?: string
  translatedCategory?: string
  valorPrice: number
  aiValorPrice: number | null
  userValorPrice: number | null
  aiValorReason: string | null
  condition: string
  images: string[]
  usageInfo: string | null
  city: string
  district: string | null
  views: number
  createdAt: string
  isFreeAvailable?: boolean
  acceptsNegotiation?: boolean
  category: {
    id: string
    name: string
    nameEn: string | null
    nameEs: string | null
    nameCa: string | null
    translatedName?: string
  }
  user: {
    id: string
    name: string | null
    nickname: string | null
    image: string | null
    createdAt: string
    trustScore?: number
    _count: {
      products: number
    }
  }
  _count?: {
    favorites: number
  }
}

// Hazır mesajlar - type: 'swap' direkt takas talebi, 'question' önce sohbet başlatır
const QUICK_MESSAGES = [
  { id: 'interest', text: 'Ürününüzü Takas-A ile edinmek istemekteyim.', icon: '💜', type: 'swap' as const },
  { id: 'negotiate', text: 'Pazarlık şansı var mı?', icon: '🤝', type: 'question' as const },
  { id: 'discount', text: 'Bir miktar daha indirim alabilir miyim?', icon: '💰', type: 'question' as const },
  { id: 'free', text: 'Ürününüzü bedelsiz vermeyi düşünür müsünüz?', icon: '🎁', type: 'question' as const },
]

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
  sender: {
    id: string
    name: string | null
    image: string | null
  }
}

const conditionLabels: Record<string, Record<string, string>> = {
  new: { tr: 'Sıfır', en: 'New', es: 'Nuevo', ca: 'Nou' },
  like_new: { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como nuevo', ca: 'Com nou' },
  good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  fair: { tr: 'Orta', en: 'Fair', es: 'Regular', ca: 'Regular' },
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession() || {}
  const { t, language } = useLanguage()
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showInterestModal, setShowInterestModal] = useState(false)
  const [interestMessage, setInterestMessage] = useState('')
  const [selectedMessageType, setSelectedMessageType] = useState<'swap' | 'question'>('swap')
  const [sendingInterest, setSendingInterest] = useState(false)
  const [interestSent, setInterestSent] = useState(false)
  const [questionSent, setQuestionSent] = useState(false)
  const [myProducts, setMyProducts] = useState<{id: string; title: string; images: string[]; valorPrice: number}[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [loadingMyProducts, setLoadingMyProducts] = useState(false)
  const [offeredValor, setOfferedValor] = useState<number | ''>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Depozito/Teminat state'leri
  const [depositPreview, setDepositPreview] = useState<{
    depositRequired: number
    availableBalance: number
    canAfford: boolean
    trustLevel: string
    trustBadge: string
    depositRate: string
  } | null>(null)
  const [loadingDepositPreview, setLoadingDepositPreview] = useState(false)
  
  // AI Görselleştirme state'leri
  const [showVisualizationModal, setShowVisualizationModal] = useState(false)
  const [visualizationCredits, setVisualizationCredits] = useState(3)
  const [isAdmin, setIsAdmin] = useState(false)
  const [environmentImage, setEnvironmentImage] = useState<File | null>(null)
  const [environmentPreview, setEnvironmentPreview] = useState<string>('')
  const [roomDescription, setRoomDescription] = useState('')
  const [generatingVisualization, setGeneratingVisualization] = useState(false)
  const [visualizationResult, setVisualizationResult] = useState<string>('')
  const [visualizationError, setVisualizationError] = useState('')
  const environmentInputRef = useRef<HTMLInputElement>(null)

  // Lock body scroll when modals are open
  useBodyScrollLock(showInterestModal || showChat || showVisualizationModal)

  // Modal/chat açıkken bottom nav'ı gizle
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (showInterestModal || showChat || showVisualizationModal) {
      window.dispatchEvent(new CustomEvent('hideBottomNav'))
    } else {
      window.dispatchEvent(new CustomEvent('showBottomNav'))
    }
    
    return () => {
      window.dispatchEvent(new CustomEvent('showBottomNav'))
    }
  }, [showInterestModal, showChat, showVisualizationModal])

  useEffect(() => {
    if (params.id) {
      fetchProduct()
    }
  }, [params.id, language])

  useEffect(() => {
    if (showChat && product) {
      fetchMessages()
      const interval = setInterval(fetchMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [showChat, product])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showInterestModal && session?.user?.email) {
      fetchMyProducts()
      fetchDepositPreview()
    }
  }, [showInterestModal, session])

  const fetchDepositPreview = async () => {
    if (!product) return
    setLoadingDepositPreview(true)
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          previewOnly: true
        })
      })
      const data = await res.json()
      if (res.ok) {
        setDepositPreview(data)
      } else if (data.requiresPhoneVerification) {
        setError('Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor. Profil sayfasından doğrulama yapabilirsiniz.')
      }
    } catch (err) {
      console.error('Deposit preview error:', err)
    } finally {
      setLoadingDepositPreview(false)
    }
  }

  // AI görselleştirme kredisini kontrol et
  useEffect(() => {
    if (session?.user?.email) {
      checkVisualizationCredits()
    }
  }, [session])

  const checkVisualizationCredits = async () => {
    try {
      const res = await fetch('/api/ai-visualize')
      if (res.ok) {
        const data = await res.json()
        setVisualizationCredits(data.remainingCredits)
        setIsAdmin(data.isAdmin)
      }
    } catch (err) {
      console.error('Credits check error:', err)
    }
  }

  const handleEnvironmentImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEnvironmentImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setEnvironmentPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerateVisualization = async () => {
    if (!product) return
    if (!environmentImage && !roomDescription.trim()) {
      setVisualizationError('Lütfen oda fotoğrafı yükleyin veya oda açıklaması girin')
      return
    }
    
    setGeneratingVisualization(true)
    setVisualizationError('')
    setVisualizationResult('')

    try {
      const formData = new FormData()
      if (environmentImage) {
        formData.append('environmentImage', environmentImage)
      }
      formData.append('productImage', product.images[0])
      formData.append('productTitle', product.title)
      formData.append('category', product.category.name.toLowerCase())
      if (roomDescription) {
        formData.append('roomDescription', roomDescription)
      }

      const res = await fetch('/api/ai-visualize', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        setVisualizationError(data.error || 'Görselleştirme oluşturulamadı')
        return
      }

      setVisualizationResult(data.imageUrl)
      setVisualizationCredits(data.remainingCredits)
    } catch (err) {
      setVisualizationError('Bir hata oluştu, lütfen tekrar deneyin')
    } finally {
      setGeneratingVisualization(false)
    }
  }

  const resetVisualization = () => {
    setEnvironmentImage(null)
    setEnvironmentPreview('')
    setRoomDescription('')
    setVisualizationResult('')
    setVisualizationError('')
  }

  const fetchMyProducts = async () => {
    setLoadingMyProducts(true)
    try {
      const res = await fetch('/api/products?mine=true')
      if (res.ok) {
        const data = await res.json()
        setMyProducts(data.products || [])
      }
    } catch (err) {
      console.error('My products fetch error:', err)
    } finally {
      setLoadingMyProducts(false)
    }
  }

  const fetchProduct = async () => {
    if (!params.id) {
      setError('Ürün ID bulunamadı')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      setError('')
      
      const res = await fetch(`/api/products/${params.id}?lang=${language}`)
      if (!res.ok) {
        throw new Error('Ürün bulunamadı')
      }
      const data = await res.json()
      
      if (!data || !data.id) {
        throw new Error('Ürün verisi alınamadı')
      }
      
      setProduct(data)
      
      // Son görüntülenenlere ekle
      addToRecentViews({
        id: data.id,
        title: data.translatedTitle || data.title,
        valorPrice: data.valorPrice,
        images: data.images
      })
    } catch (err: any) {
      console.error('Product fetch error:', err)
      setError(err?.message || 'Ürün yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (!product) return
    try {
      const res = await fetch(`/api/messages?userId=${product.user.id}&productId=${product.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Messages fetch error:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !product || sendingMessage) return
    
    setSendingMessage(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: product.user.id,
          content: newMessage,
          productId: product.id,
        }),
      })

      if (res.ok) {
        const message = await res.json()
        setMessages((prev) => [...prev, message])
        setNewMessage('')
      }
    } catch (err) {
      console.error('Send message error:', err)
    } finally {
      setSendingMessage(false)
    }
  }

  const handleSendInterest = async () => {
    if (!product || sendingInterest) return
    
    // Soru tipi mesaj için sadece mesaj gönder (takas talebi değil)
    if (selectedMessageType === 'question') {
      setSendingInterest(true)
      setError('')
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiverId: product.user.id,
            content: interestMessage,
            productId: product.id,
          }),
        })

        if (res.ok) {
          setQuestionSent(true)
          // 3 saniye sonra chat panelini aç
          setTimeout(() => {
            setShowInterestModal(false)
            setQuestionSent(false)
            setInterestMessage('')
            setShowChat(true)
            fetchMessages()
            // Bottom nav'ı yönet (chat açılacağı için hala gizli kalabilir)
          }, 2000)
        } else {
          const data = await res.json()
          setError(data.error || 'Mesaj gönderilemedi')
        }
      } catch (err) {
        console.error('Send question error:', err)
        setError('Bir hata oluştu')
      } finally {
        setSendingInterest(false)
      }
      return
    }
    
    // Swap tipi mesaj için takas talebi oluştur
    // Depozito yeterliliği kontrolü
    if (depositPreview && !depositPreview.canAfford) {
      setError(`Yetersiz bakiye. Teminat için ${depositPreview.depositRequired} Valor gerekli.`)
      return
    }
    
    setSendingInterest(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          message: interestMessage,
          offeredProductId: selectedProductId,
          offeredValor: offeredValor === '' ? product.valorPrice : Number(offeredValor),
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        setInterestSent(true)
        setTimeout(() => {
          setShowInterestModal(false)
          setInterestSent(false)
          setInterestMessage('')
          setSelectedProductId(null)
          setDepositPreview(null)
          // Bottom nav'ı geri göster
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('showBottomNav'))
          }
        }, 2000)
      } else if (data.requiresPhoneVerification) {
        setError('Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor. Profil sayfasından doğrulama yapabilirsiniz.')
      } else {
        setError(data.error || 'Bir hata oluştu')
      }
    } catch (err) {
      setError('Talep gönderilirken hata oluştu')
    } finally {
      setSendingInterest(false)
    }
  }

  // Direkt/Hızlı Takas Teklifi - Tek tıkla tam fiyat teklifi
  const handleQuickSwapOffer = async () => {
    if (!product || sendingInterest) return
    
    setSendingInterest(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          message: 'Direkt takas teklifi - tam fiyat ile',
          offeredProductId: null, // Ürün opsiyonel
          offeredValor: product.valorPrice, // Tam fiyat teklifi
          quickOffer: true // Hızlı teklif flag'i
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        setInterestSent(true)
        // Başarı bildirimi göster ve yönlendir
        setTimeout(() => {
          setInterestSent(false)
          router.push('/takaslarim')
        }, 2000)
      } else if (data.requiresPhoneVerification) {
        setError('Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor.')
        // Detaylı modal'a yönlendir
        setShowInterestModal(true)
      } else if (data.insufficientBalance) {
        setError(`Yetersiz bakiye. ${data.required} Valor gerekli.`)
        setShowInterestModal(true)
      } else {
        setError(data.error || 'Teklif gönderilemedi')
        // Hata durumunda detaylı modal'ı aç
        setShowInterestModal(true)
      }
    } catch (err) {
      console.error('Quick swap error:', err)
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setShowInterestModal(true)
    } finally {
      setSendingInterest(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return language === 'tr' ? 'Bugün' : 'Today'
    if (diffDays === 1) return language === 'tr' ? 'Dün' : 'Yesterday'
    if (diffDays < 7) return language === 'tr' ? `${diffDays} gün önce` : `${diffDays} days ago`
    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-frozen-500 mx-auto mb-4" />
          <p className="text-gray-600">Ürün yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">Ürün Bulunamadı</h2>
          <p className="text-gray-600 mb-4">{error || 'Bu ürün mevcut değil veya kaldırılmış olabilir.'}</p>
          <Link 
            href="/urunler" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-frozen-500 text-white rounded-lg font-semibold hover:bg-frozen-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ürünlere Dön
          </Link>
        </div>
      </div>
    )
  }

  const isOwner = session?.user?.email && product.user.id === (session as any).user?.id

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Back Button - Desktop only, mobile has MobileTopNavigation */}
        <button
          onClick={() => router.back()}
          className="hidden md:flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Geri Dön</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-lg">
              {product.images.length > 0 ? (
                <Image
                  src={product.images[currentImageIndex]}
                  alt={product.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Package className="w-24 h-24 text-gray-300" />
                </div>
              )}
              
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === 0 ? product.images.length - 1 : prev - 1
                    )}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-800/80 shadow-lg flex items-center justify-center hover:bg-gray-900/90 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === product.images.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-800/80 shadow-lg flex items-center justify-center hover:bg-gray-900/90 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {product.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-sm">
                  {currentImageIndex + 1} / {product.images.length}
                </div>
              )}

              {/* Favorite Button */}
              <div className="absolute top-4 right-4">
                <FavoriteButton 
                  productId={product.id} 
                  initialCount={product._count?.favorites || 0}
                  size="lg"
                  showCount
                />
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      idx === currentImageIndex ? 'border-frozen-500' : 'border-transparent'
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title and Price */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">{product.translatedTitle || product.title}</h1>
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <Share2 className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="mt-4 space-y-3">
                {/* Kullanıcının Talep Ettiği Değer */}
                <div className="flex items-center flex-wrap gap-3">
                  {product.isFreeAvailable ? (
                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <span className="text-2xl font-bold">🎁 Bedelsiz</span>
                    </div>
                  ) : (
                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                      <span className="text-2xl font-bold">{product.valorPrice}</span>
                      <span className="ml-1 text-sm">Valor</span>
                    </div>
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    product.condition === 'new' ? 'bg-green-100 text-green-700' :
                    product.condition === 'like_new' ? 'bg-blue-100 text-blue-700' :
                    product.condition === 'good' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {product.translatedCondition || conditionLabels[product.condition]?.[language] || product.condition}
                  </span>
                  {product.acceptsNegotiation && !product.isFreeAvailable && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                      🤝 Pazarlığa Açık
                    </span>
                  )}
                </div>
                
                {/* AI Değerlendirmesi */}
                {product.aiValorPrice && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">
                        {language === 'tr' ? 'AI Değerlendirmesi' : 'AI Valuation'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-purple-700">{product.aiValorPrice} Valor</span>
                      {product.valorPrice !== product.aiValorPrice && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          product.valorPrice > product.aiValorPrice 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {product.valorPrice > product.aiValorPrice ? '+' : ''}
                          {Math.round(((product.valorPrice - product.aiValorPrice) / product.aiValorPrice) * 100)}%
                        </span>
                      )}
                    </div>
                    {product.aiValorReason && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{product.aiValorReason}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{product.district ? `${product.district}, ` : ''}{product.city}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(product.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{product.views} {language === 'tr' ? 'görüntülenme' : language === 'es' ? 'vistas' : language === 'ca' ? 'visualitzacions' : 'views'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                <span>{product.translatedCategory || product.category.translatedName || product.category.name}</span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-frozen-500" />
                {language === 'tr' ? 'Ürün Açıklaması' : language === 'es' ? 'Descripción del Producto' : language === 'ca' ? 'Descripció del Producte' : 'Product Description'}
              </h3>
              <p className="text-gray-600 whitespace-pre-line">{product.translatedDescription || product.description}</p>
            </div>

            {/* AI Görselleştirme Butonu */}
            {session?.user && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  resetVisualization()
                  setShowVisualizationModal(true)
                }}
                className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-center justify-center gap-3">
                  <Sparkles className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-bold text-lg">
                      {language === 'tr' ? 'TAKAS-A Aldığım Ürün Nasıl Görünür?' : 'How Will This Product Look?'}
                    </p>
                    <p className="text-sm opacity-90">
                      {isAdmin 
                        ? '✨ Admin: Sınırsız kullanım' 
                        : visualizationCredits > 0 
                          ? `🎁 ${visualizationCredits} ücretsiz hak kaldı`
                          : '💳 Yakında TL ile satın alma!'}
                    </p>
                  </div>
                  <Home className="w-6 h-6" />
                </div>
              </motion.button>
            )}

            {/* Usage Info */}
            {product.usageInfo && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-frozen-500" />
                  {language === 'tr' ? 'Kullanım Bilgisi' : language === 'es' ? 'Información de Uso' : language === 'ca' ? 'Informació d\'Ús' : 'Usage Info'}
                </h3>
                <p className="text-gray-600 whitespace-pre-line">{product.usageInfo}</p>
              </div>
            )}

            {/* Seller Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Satıcı Bilgileri</h3>
                {product.user.trustScore !== undefined && (
                  <TrustBadge trustScore={product.user.trustScore} size="sm" />
                )}
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xl font-bold">
                  {getDisplayName(product.user).charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{getDisplayName(product.user)}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {product.user._count.products} ürün
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(product.user.createdAt)} üye
                    </span>
                  </div>
                </div>
              </div>
              {/* Satıcı Değerlendirmeleri */}
              <div className="border-t pt-4">
                <UserRatingSummary userId={product.user.id} />
              </div>
            </div>
            
            {/* Favori Sayısı */}
            {product._count && product._count.favorites > 0 && (
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <Heart className="w-4 h-4 fill-red-100 text-red-400" />
                <span>{product._count.favorites} kişi bu ürünü favoriledi</span>
              </div>
            )}

            {/* Action Buttons - Basit ve Detaylı Takas */}
            {!isOwner && (
              <div className="space-y-3">
                {/* Ana Buton - Direkt Takas (Basit Flow) */}
                <button
                  onClick={() => {
                    if (!session) {
                      router.push('/giris')
                      return
                    }
                    // Direkt takas - tam fiyat ile hemen teklif
                    setInterestMessage('')
                    setSelectedMessageType('swap')
                    setQuestionSent(false)
                    setInterestSent(false)
                    setOfferedValor(product?.valorPrice || 0) // Tam fiyat
                    setSelectedProductId(null) // Ürün seçimi opsiyonel
                    handleQuickSwapOffer() // Hızlı teklif fonksiyonu
                  }}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  <ArrowLeftRight className="w-6 h-6" />
                  Direkt Takas Teklif Et
                  <span className="text-sm font-normal opacity-90">({product.valorPrice} V)</span>
                </button>
                
                {/* İkincil Buton - Pazarlıklı Takas */}
                {product.acceptsNegotiation && (
                  <button
                    onClick={() => {
                      if (!session) {
                        router.push('/giris')
                        return
                      }
                      // Pazarlık akışını başlat
                      setInterestMessage('')
                      setSelectedMessageType('swap')
                      setQuestionSent(false)
                      setInterestSent(false)
                      setOfferedValor(product?.valorPrice || 0)
                      setShowInterestModal(true)
                    }}
                    className="w-full py-3 rounded-xl border-2 border-orange-400 bg-orange-50 text-orange-700 font-semibold hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Tag className="w-5 h-5" />
                    Pazarlıklı Teklif Ver
                  </button>
                )}
                
                {/* Soru Sor Butonu */}
                <button
                  onClick={() => {
                    if (!session) {
                      router.push('/giris')
                      return
                    }
                    setSelectedMessageType('question')
                    setInterestMessage('')
                    setShowInterestModal(true)
                  }}
                  className="w-full py-3 rounded-xl border-2 border-blue-400 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Satıcıya Soru Sor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interest Modal */}
      <AnimatePresence>
        {showInterestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[70] modal-backdrop"
            style={{ overscrollBehavior: 'contain' }}
            onClick={() => setShowInterestModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto modal-content safe-area-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile handle */}
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
              
              {interestSent ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Teklifiniz Gönderildi! 🎉</h3>
                  <p className="text-gray-600 mb-2">Ürün sahibi en kısa sürede değerlendirecektir.</p>
                  <p className="text-sm text-gray-500">Takaslarım sayfasından takip edebilirsiniz.</p>
                  <button
                    onClick={() => router.push('/takaslarim')}
                    className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    Takaslarıma Git
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="w-5 h-5 text-purple-500" />
                      <h3 className="text-xl font-bold text-gray-900">Takas Teklif Et</h3>
                    </div>
                    <button
                      onClick={() => setShowInterestModal(false)}
                      className="p-2 rounded-full hover:bg-gray-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 1. ADIM: Valor Teklifi */}
                  {product && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl border-2 border-purple-300 shadow-sm">
                      <label className="block text-sm font-bold text-purple-800 mb-2">
                        💰 Valor Teklifiniz
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max={product.valorPrice * 2}
                          value={offeredValor}
                          onChange={(e) => setOfferedValor(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder={`${product.valorPrice}`}
                          className="w-full px-4 py-3 pr-24 rounded-xl border-2 border-purple-400 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-xl font-black text-purple-900 bg-white placeholder:text-purple-400"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-700 font-black text-base">Valor</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-purple-700 font-medium">İstenen: <strong className="text-purple-900">{product.valorPrice} Valor</strong></span>
                        {offeredValor !== '' && offeredValor < product.valorPrice && (
                          <span className="text-orange-700 font-bold bg-orange-100 px-2 py-0.5 rounded-full">
                            %{Math.round(((product.valorPrice - offeredValor) / product.valorPrice) * 100)} pazarlık
                          </span>
                        )}
                        {offeredValor !== '' && offeredValor > product.valorPrice && (
                          <span className="text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                            %{Math.round(((offeredValor - product.valorPrice) / product.valorPrice) * 100)} üstü teklif ⭐
                          </span>
                        )}
                        {offeredValor !== '' && offeredValor === product.valorPrice && (
                          <span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                            Tam fiyat ✓
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Teminat Bilgisi */}
                  {(
                    <>
                      {loadingDepositPreview ? (
                        <div className="mb-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ) : depositPreview && (
                        <div className={`mb-4 p-4 rounded-xl border ${
                          depositPreview.canAfford 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Gerekli Teminat</span>
                            <span className={`text-lg font-bold ${
                              depositPreview.canAfford ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {depositPreview.depositRequired} Valor
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Mevcut Bakiye</span>
                            <span className="font-medium text-gray-800">{depositPreview.availableBalance} Valor</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-500">Teminat Oranı</span>
                            <span className="font-medium text-purple-600">
                              {depositPreview.depositRate}
                              {depositPreview.trustLevel !== 'unverified' && (
                                <span className="text-xs ml-1">
                                  ({depositPreview.trustBadge})
                                </span>
                              )}
                            </span>
                          </div>
                          {!depositPreview.canAfford && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              <span>Yetersiz bakiye! {depositPreview.depositRequired - depositPreview.availableBalance} Valor daha gerekli.</span>
                            </div>
                          )}
                          {depositPreview.canAfford && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span>Teminat için yeterli bakiyeniz var!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* 2. ADIM: Karşılık Ürün Seçimi (Opsiyonel) */}
                  {loadingMyProducts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
                    </div>
                  ) : myProducts.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📦 Karşılığında Ürün Teklif Et <span className="text-gray-400 font-normal">(opsiyonel)</span>
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Kendi ürününüzü ekleyerek Valor kazanabilirsiniz</p>
                      <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1">
                        {myProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedProductId(selectedProductId === p.id ? null : p.id)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedProductId === p.id
                                ? 'border-purple-500 ring-2 ring-purple-300'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {p.images?.[0] ? (
                              <Image src={p.images[0]} alt={p.title} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-300" />
                              </div>
                            )}
                            {selectedProductId === p.id && (
                              <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-0.5">
                              <p className="text-[10px] text-white font-medium">{p.valorPrice}V</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {selectedProductId && (
                        <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Ürün karşılığı takas teklifi
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bilgi Kartları */}
                  <div className="space-y-2 mb-4">
                    {product?.isFreeAvailable && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                        <span>🎁</span>
                        <p className="text-xs font-medium">Bu ürün bedelsiz de verilebilir!</p>
                      </div>
                    )}
                    {product?.acceptsNegotiation && !product?.isFreeAvailable && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
                        <span>🤝</span>
                        <p className="text-xs font-medium">Satıcı pazarlığa açık</p>
                      </div>
                    )}
                  </div>

                  {/* 3. ADIM: Mesaj (Opsiyonel - Pazarlık için) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💬 Satıcıya Not <span className="text-gray-400 font-normal">(opsiyonel)</span>
                    </label>
                    <textarea
                      value={interestMessage}
                      onChange={(e) => setInterestMessage(e.target.value)}
                      placeholder="Örn: Merhaba, ürününüzle ilgileniyorum. Pazarlık yapabilir miyiz?"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                      rows={2}
                    />
                  </div>

                  {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-red-700">{error}</p>
                          {error.includes('telefon') && (
                            <a 
                              href="/profil" 
                              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                              Profil Sayfasına Git
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSendInterest}
                    disabled={sendingInterest || (selectedMessageType === 'swap' && depositPreview !== null && depositPreview.canAfford === false)}
                    className={`w-full mt-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      selectedMessageType === 'swap' && depositPreview && depositPreview.canAfford === false
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : selectedMessageType === 'question'
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 disabled:opacity-50'
                          : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-50'
                    }`}
                  >
                    {sendingInterest ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : selectedMessageType === 'swap' && depositPreview && depositPreview.canAfford === false ? (
                      'Yetersiz Bakiye'
                    ) : selectedMessageType === 'question' ? (
                      <>
                        <MessageCircle className="w-5 h-5" />
                        Soru Gönder
                      </>
                    ) : (
                      <>
                        <Heart className="w-5 h-5" />
                        Takas Talebi Gönder
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col safe-area-top safe-area-bottom"
            style={{ overscrollBehavior: 'contain' }}
          >
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center gap-4">
              <button
                onClick={() => setShowChat(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold">
                  {getDisplayName(product.user).charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{getDisplayName(product.user)}</p>
                  <p className="text-sm text-gray-500">{product.title}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Henüz mesaj yok</p>
                  <p className="text-sm text-gray-400 mt-1">Ürün hakkında soru sormaya başlayın</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender.id !== product.user.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          isMe
                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white disabled:opacity-50 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Görselleştirme Modal */}
        {showVisualizationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 flex items-end md:items-center justify-center modal-backdrop"
            style={{ overscrollBehavior: 'contain' }}
            onClick={() => !generatingVisualization && setShowVisualizationModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl modal-content safe-area-bottom"
            >
              {/* Header */}
              <div className="p-6 border-b bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-7 h-7" />
                    <div>
                      <h2 className="text-xl font-bold">AI Görselleştirme</h2>
                      <p className="text-sm opacity-90">
                        {isAdmin ? 'Sınırsız kullanım' : `${visualizationCredits} hak kaldı`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !generatingVisualization && setShowVisualizationModal(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    disabled={generatingVisualization}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {!visualizationResult ? (
                  <>
                    {/* Ürün Bilgisi */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      {product && product.images[0] && (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={product.images[0]}
                            alt={product.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{product?.translatedTitle || product?.title}</p>
                        <p className="text-sm text-gray-500">{product?.translatedCategory || product?.category?.name}</p>
                      </div>
                    </div>

                    {/* Oda Fotoğrafı Yükle */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📸 Oda/Ortam Fotoğrafı Yükle
                      </label>
                      <input
                        ref={environmentInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEnvironmentImageChange}
                        className="hidden"
                      />
                      <div
                        onClick={() => environmentInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
                      >
                        {environmentPreview ? (
                          <div className="relative">
                            <img
                              src={environmentPreview}
                              alt="Environment"
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEnvironmentImage(null)
                                setEnvironmentPreview('')
                              }}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-10 h-10 mx-auto text-gray-400" />
                            <p className="text-gray-600">Oda fotoğrafı yüklemek için tıklayın</p>
                            <p className="text-xs text-gray-400">JPG, PNG - Max 10MB</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* VEYA Ayırıcı */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-sm text-gray-400 font-medium">VEYA</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Oda Açıklaması */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ✍️ Odanı Tanımla (AI hayal etsin)
                      </label>
                      <textarea
                        value={roomDescription}
                        onChange={(e) => setRoomDescription(e.target.value)}
                        placeholder="Örn: Modern bir salon, beyaz duvarlar, ahşap zemin, büyük pencere, minimalist dekorasyon..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Hata Mesajı */}
                    {visualizationError && (
                      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{visualizationError}</p>
                      </div>
                    )}

                    {/* Oluştur Butonu */}
                    <button
                      onClick={handleGenerateVisualization}
                      disabled={generatingVisualization || (!environmentImage && !roomDescription.trim()) || (!isAdmin && visualizationCredits <= 0)}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg"
                    >
                      {generatingVisualization ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Oluşturuluyor... (10-30 sn)
                        </span>
                      ) : visualizationCredits <= 0 && !isAdmin ? (
                        'Hakkınız Kalmadı 😢'
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Görselleştir!
                        </span>
                      )}
                    </button>

                    {/* Bilgi Notu */}
                    <p className="text-xs text-gray-400 text-center">
                      🤖 AI tarafından oluşturulan görsel tamamen hayal ürünüdür ve gerçek ürünün görünümünü garanti etmez.
                    </p>
                  </>
                ) : (
                  /* Sonuç Ekranı */
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                      <img
                        src={visualizationResult}
                        alt="AI Visualization"
                        className="w-full"
                      />
                    </div>
                    
                    <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">
                        Görselleştirme başarıyla oluşturuldu! 
                        {!isAdmin && ` (Kalan hak: ${visualizationCredits})`}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <a
                        href={visualizationResult}
                        download="takas-a-visualization.png"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-center hover:bg-gray-200 transition-colors"
                      >
                        📥 İndir
                      </a>
                      <button
                        onClick={resetVisualization}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg transition-all"
                      >
                        🔄 Yeni Görsel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
