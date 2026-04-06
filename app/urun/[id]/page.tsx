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
import { safeFetch } from '@/lib/safe-fetch'
import { useToast } from '@/lib/toast-context'
import { MultiSwapOnboarding } from '@/components/MultiSwapOnboarding'
import { triggerMiniConfetti } from '@/components/confetti-celebration'
import { playSwapOfferSound } from '@/lib/notification-sounds'
import { Analytics } from '@/lib/analytics'

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
  status?: string
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
  const { data: session } = useSession()
  const { t, language } = useLanguage()
  const { showError, showSuccess, showWarning } = useToast()
  
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
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [loadingMyProducts, setLoadingMyProducts] = useState(false)
  const [offeredValor, setOfferedValor] = useState<number | ''>(0)
  const [swapNegotiationMode, setSwapNegotiationMode] = useState<'valor_diff' | 'request_product' | 'direct_swap'>('valor_diff')
  const [requestedValor, setRequestedValor] = useState(0)
  
  // Çoklu ürün seçimi toggle
  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      const newIds = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
      
      // Ürün seçildiğinde müzakere modunu ve Valor'u hesapla
      if (product) {
        const selectedValue = myProducts
          .filter(p => newIds.includes(p.id))
          .reduce((sum, p) => sum + p.valorPrice, 0)
        
        const diff = selectedValue - product.valorPrice
        // diff > 0 → benim ürünüm daha değerli
        // diff < 0 → onun ürünü daha değerli
        
        setSwapNegotiationMode('valor_diff')
        if (diff > 0) {
          // Ben fark isteyebilirim
          setOfferedValor(0)
          setRequestedValor(diff)
        } else if (diff < 0) {
          // Ben fark ödemeliyim
          setOfferedValor(Math.abs(diff))
          setRequestedValor(0)
        } else {
          // Eşit - fark yok
          setOfferedValor(0)
          setRequestedValor(0)
        }
      }
      
      return newIds
    })
  }

  // Seçili ürünlerin toplam değeri
  const selectedProductsTotal = myProducts
    .filter(p => selectedProductIds.includes(p.id))
    .reduce((sum, p) => sum + p.valorPrice, 0)

  // Takas değer farkı hesaplama
  const getSwapSummary = () => {
    if (!product) return null
    
    const targetPrice = product.valorPrice
    const myProductsValue = selectedProductsTotal
    const myValorOffer = offeredValor === '' ? 0 : Number(offeredValor)
    const totalOffer = myProductsValue + myValorOffer
    const difference = targetPrice - totalOffer
    const estimatedFee = Math.round(totalOffer * 0.04)
    
    return {
      targetPrice,
      myProductsValue,
      myValorOffer,
      totalOffer,
      difference, // Pozitif = eksik, Negatif = fazla
      estimatedFee,
      netToSeller: totalOffer - estimatedFee,
      isBalanced: Math.abs(difference) <= targetPrice * 0.05,
      isExceeding: difference < 0,
      isShort: difference > 0,
    }
  }
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Yeni takas akışı state'leri
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapType, setSwapType] = useState<'product' | 'valor' | 'success' | null>(null)
  const [selectedMyProduct, setSelectedMyProduct] = useState<any>(null)
  const [valorDifference, setValorDifference] = useState(0)
  
  // Valor fiyat popup state'leri
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false)
  const [priceData, setPriceData] = useState<any>(null)
  
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
  
  // Çoklu Takas Onboarding Modal
  const [showMultiSwapOnboarding, setShowMultiSwapOnboarding] = useState(false)
  
  // ═══ ÜRÜN DÜZENLEME STATE'LERİ ═══
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', condition: '', editReason: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editSuccess, setEditSuccess] = useState('')
  const [environmentImage, setEnvironmentImage] = useState<File | null>(null)
  const [environmentPreview, setEnvironmentPreview] = useState<string>('')
  const [roomDescription, setRoomDescription] = useState('')
  const [generatingVisualization, setGeneratingVisualization] = useState(false)
  const [visualizationResult, setVisualizationResult] = useState<string>('')
  const [visualizationError, setVisualizationError] = useState('')
  
  // Swap capacity - ilk takas limiti bilgisi
  const [swapCapacity, setSwapCapacity] = useState<{
    completedSwaps: number
    currentNetGain: number
    remainingAllowance: number
    maxAllowedGain: number
    lockedBonus: number
    usableBalance: number
  } | null>(null)
  
  // Günlük takas teklifi limiti bilgisi
  const [dailyLimit, setDailyLimit] = useState<{
    used: number
    limit: number
    remaining: number
    isVip: boolean
  } | null>(null)
  const environmentInputRef = useRef<HTMLInputElement>(null)

  // Lock body scroll when modals are open
  useBodyScrollLock(showInterestModal || showChat || showVisualizationModal || showSwapModal)

  // Modal/chat açıkken bottom nav'ı gizle
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (showInterestModal || showChat || showVisualizationModal || showSwapModal) {
      window.dispatchEvent(new CustomEvent('hideBottomNav'))
    } else {
      window.dispatchEvent(new CustomEvent('showBottomNav'))
    }
    
    return () => {
      window.dispatchEvent(new CustomEvent('showBottomNav'))
    }
  }, [showInterestModal, showChat, showVisualizationModal, showSwapModal])

  // Modal açıkken pull-to-refresh'i engelle
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (showInterestModal || showSwapModal) {
      // Body scroll'u kapat ve touch-action ayarla
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      
      // Pull-to-refresh engelleme
      const preventPullRefresh = (e: TouchEvent) => {
        // Çoklu dokunuş veya modal içindeki scrollable alandan geliyorsa engelleme
        if (e.touches.length > 1) return
        const target = e.target as HTMLElement
        const scrollable = target.closest('[data-scrollable]')
        if (scrollable && (scrollable as HTMLElement).scrollTop > 0) return
        
        // Sayfanın en üstündeyken aşağı kaydırmayı engelle
        if (window.scrollY === 0) {
          const touch = e.touches[0]
          const startY = touch.clientY
          
          const handleTouchMove = (moveEvent: TouchEvent) => {
            const currentY = moveEvent.touches[0].clientY
            if (currentY > startY) {
              moveEvent.preventDefault()
            }
          }
          
          document.addEventListener('touchmove', handleTouchMove, { passive: false })
          document.addEventListener('touchend', () => {
            document.removeEventListener('touchmove', handleTouchMove)
          }, { once: true })
        }
      }
      
      document.addEventListener('touchstart', preventPullRefresh, { passive: true })
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.touchAction = ''
        document.removeEventListener('touchstart', preventPullRefresh)
      }
    }
  }, [showInterestModal, showSwapModal])

  useEffect(() => {
    if (params.id) {
      fetchProduct()
    }
  }, [params.id, language])

  // Analytics: Ürün görüntüleme event'i
  useEffect(() => {
    if (product?.id) {
      Analytics.productViewed(product.id, product.category?.name)
    }
  }, [product?.id])

  useEffect(() => {
    if (showChat && product) {
      fetchMessages()
      const interval = setInterval(fetchMessages, 30000) // 30 saniye - performans için
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
      fetchSwapCapacity()
    }
  }, [showInterestModal, session])

  // Valor fiyat detayı yükle
  useEffect(() => {
    if (showPriceBreakdown && product) {
      fetch(`/api/valor/price-breakdown?valor=${product.valorPrice}&city=${encodeURIComponent(product.city || 'İzmir')}`)
        .then(r => r.json())
        .then(setPriceData)
        .catch(() => {})
    }
  }, [showPriceBreakdown, product])

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

  // Kullanıcının takas kapasitesini çek (ilk takas limiti dahil)
  const fetchSwapCapacity = async () => {
    if (!product || !session?.user) return
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          previewOnly: true,
          offeredValor: product.valorPrice,
        })
      })
      const data = await res.json()
      if (data.preview) {
        setSwapCapacity({
          completedSwaps: data.completedSwaps || 0,
          currentNetGain: data.currentNetGain || 0,
          remainingAllowance: data.remainingAllowance ?? 400,
          maxAllowedGain: data.maxAllowedGain || 400,
          lockedBonus: data.lockedBonus || 0,
          usableBalance: data.availableBalance || 0,
        })
      }
    } catch (err) {
      console.error('Swap capacity check error:', err)
    }
  }

  // AI görselleştirme kredisini kontrol et
  useEffect(() => {
    if (session?.user?.email) {
      checkVisualizationCredits()
    }
  }, [session])

  // Günlük takas teklifi limitini kontrol et
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/swap-requests/daily-limit')
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setDailyLimit(data)
          }
        })
        .catch(err => console.error('Daily limit check error:', err))
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
        // Sadece aktif ürünleri göster (swapped olanları filtrele)
        setMyProducts((data.products || []).filter((p: any) => p.status === 'active'))
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
      
      // Edit form'u doldur
      setEditForm({
        title: data.title || '',
        description: data.description || '',
        condition: data.condition || 'good',
        editReason: ''
      })
      
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
    
    // Soru tipi mesaj için ProductQuestion oluştur + mesaj gönder
    if (selectedMessageType === 'question') {
      setSendingInterest(true)
      setError('')
      try {
        // Önce ProductQuestion oluştur (bildirim gönderir)
        const questionRes = await fetch(`/api/products/${product.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: interestMessage }),
        })

        if (questionRes.ok) {
          // Mesaj olarak da gönder (takas merkezi mesajlarında görünsün)
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiverId: product.user.id,
              content: `📨 ${interestMessage}`,
              productId: product.id,
            }),
          })

          setQuestionSent(true)
          // 2 saniye sonra modal kapat, sayfa dönmesin - kullanıcı ürün sayfasında kalsın
          setTimeout(() => {
            setShowInterestModal(false)
            setQuestionSent(false)
            setInterestMessage('')
            // Başarı mesajı için toast göster
            showSuccess('✅ Mesajınız iletildi! Satıcı mesajınızı Takas Merkezi > Mesajlar bölümünden görebilir.')
          }, 2000)
        } else {
          const data = await questionRes.json()
          setError(data.error || 'Soru gönderilemedi')
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
      // Mesaj oluşturma - müzakere modu bilgisini ekle
      const buildMessage = () => {
        let msg = interestMessage || ''
        
        // Çoklu ürün bilgisi
        if (selectedProductIds && selectedProductIds.length > 0) {
          const myTotal = myProducts
            .filter(p => selectedProductIds.includes(p.id))
            .reduce((sum, p) => sum + p.valorPrice, 0)
          const diff = myTotal - product.valorPrice
          
          msg += `\n\n---\n📦 Teklif edilen ürünler (${selectedProductIds.length} adet, toplam ${myTotal}V):\n`
          msg += myProducts
            .filter(p => selectedProductIds.includes(p.id))
            .map(p => `• ${p.title} (${p.valorPrice}V)`)
            .join('\n')
          
          if (swapNegotiationMode === 'direct_swap') {
            msg += `\n\n🤝 Birebir takas teklifi — değer farkı gözetilmeden ürünlerin değişimi isteniyor.`
          } else if (swapNegotiationMode === 'valor_diff' && diff > 0) {
            msg += `\n\n💰 Benim ürünlerim ${diff}V daha değerli. Bu farkın Valor olarak ödenmesini talep ediyorum.`
          } else if (swapNegotiationMode === 'valor_diff' && diff < 0) {
            const valorToOffer = offeredValor === '' ? Math.abs(diff) : Number(offeredValor)
            msg += `\n\n💰 Ek ${valorToOffer}V Valor ödemeyi teklif ediyorum (fark kapatma).`
          } else if (swapNegotiationMode === 'request_product') {
            // FARKA GÖRE DOĞRU MESAJ
            if (diff > 0) {
              msg += `\n\n📦 Ürünlerim ${diff}V daha değerli. Fark için ek ürün sunmanızı rica ediyorum.`
            } else if (diff < 0) {
              msg += `\n\n📦 Farkı kapatmak için ek ürün eklemeyi düşünüyorum. Detayları konuşalım.`
            } else {
              msg += `\n\n📦 Teklifi zenginleştirmek için ek ürün öneriyorum.`
            }
          }
        }
        
        return msg.trim()
      }
      
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          message: buildMessage(),
          offeredProductId: selectedProductIds[0] || null,
          offeredValor: swapNegotiationMode === 'direct_swap' 
            ? 0 
            : (offeredValor === '' ? product.valorPrice : Number(offeredValor)),
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        setInterestSent(true)
        
        // Teklif gönderildi - mini kutlama!
        triggerMiniConfetti()
        playSwapOfferSound()
        
        setTimeout(() => {
          setShowInterestModal(false)
          setInterestSent(false)
          setInterestMessage('')
          setSelectedProductIds([])
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

  // Direkt/Hızlı Takas Teklifi - Tek tıkla tam fiyat teklifi (eski)
  const handleQuickSwapOffer = async () => {
    if (!product || sendingInterest) return
    
    setSendingInterest(true)
    setError('')
    
    try {
      const { data, error: fetchError } = await safeFetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          message: 'Direkt takas teklifi - tam fiyat ile',
          offeredProductId: null, // Ürün opsiyonel
          offeredValor: product.valorPrice, // Tam fiyat teklifi
          quickOffer: true // Hızlı teklif flag'i
        }),
        timeout: 15000,
      })

      if (fetchError) {
        setError(fetchError)
        setShowInterestModal(true)
        setSendingInterest(false)
        return
      }
      
      if (data) {
        if (data.requiresPhoneVerification) {
          setError('Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor.')
          setShowInterestModal(true)
        } else if (data.insufficientBalance) {
          setError(`Yetersiz bakiye. ${data.required} Valor gerekli.`)
          setShowInterestModal(true)
        } else if (data.swapEligibility?.activeProducts === 0) {
          setError('Takas teklifi verebilmek için önce en az 1 ürün eklemeniz gerekiyor.')
          setShowInterestModal(true)
        } else {
          setInterestSent(true)
          // Başarı bildirimi göster ve yönlendir
          setTimeout(() => {
            setInterestSent(false)
            router.push('/takaslarim')
          }, 2000)
        }
      }
    } catch (err) {
      console.error('Quick swap error:', err)
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
      setShowInterestModal(true)
    } finally {
      setSendingInterest(false)
    }
  }

  // Yeni takas akışı - Ürün veya Valor ile teklif
  const handleQuickSwap = async (offeredProductId: string | null, valorAmount: number) => {
    if (!product) return
    setSendingInterest(true)
    setError('')
    
    try {
      console.log('[handleQuickSwap] Sending swap request:', { productId: product.id, offeredProductId, valorAmount })
      
      const { data, error: fetchError, status } = await safeFetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          offeredProductId,
          message: offeredProductId 
            ? `Ürünümle takas teklifi (Valor fark: ${valorAmount})` 
            : `${valorAmount} Valor ile takas teklifi`,
          offeredValor: valorAmount > 0 ? valorAmount : product.valorPrice, // pendingValorAmount -> offeredValor
          quickOffer: true
        }),
        timeout: 15000,
      })

      console.log('[handleQuickSwap] API Response:', { data, fetchError, status })

      // Network/timeout hatası veya API hatası
      if (fetchError) {
        console.error('[handleQuickSwap] Fetch error:', fetchError)
        alert(fetchError)  // En basit çözüm - kesin çalışır
        setSendingInterest(false)
        
        // Zaten aktif teklif varsa yönlendir
        if (fetchError.includes('zaten aktif bir teklifiniz var')) {
          setTimeout(() => {
            router.push('/takas-firsatlari')
          }, 500)
        }
        return
      }
      
      // API hatası döndü (data içinde error var)
      if (data?.error) {
        console.warn('[handleQuickSwap] API error:', data.error)
        alert(data.error)  // En basit çözüm - kesin çalışır
        setSendingInterest(false)
        
        // Zaten aktif teklif varsa yönlendir
        if (data.error.includes('zaten aktif bir teklifiniz var')) {
          setTimeout(() => {
            router.push('/takas-firsatlari')
          }, 500)
        }
        return
      }
      
      // Özel hata durumları
      if (data?.requiresPhoneVerification) {
        alert('Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor.')
        setSendingInterest(false)
        return
      }
      
      if (data?.insufficientBalance || data?.depositRequired) {
        alert(`Yetersiz bakiye. ${data.depositRequired || data.required || 0} Valor gerekli.`)
        setSendingInterest(false)
        return
      }
      
      if (data?.swapEligibility?.activeProducts === 0) {
        alert('Takas teklifi verebilmek için önce en az 1 ürün eklemeniz gerekiyor.')
        setSendingInterest(false)
        return
      }
      
      if (data?.requiresReview) {
        alert('Önce son takasınızı değerlendirmeniz gerekiyor!')
        setSendingInterest(false)
        return
      }
      
      // Data yoksa veya id yoksa hata
      if (!data || !data.id) {
        console.error('[handleQuickSwap] Invalid response - no data or id:', data)
        alert('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
        setSendingInterest(false)
        return
      }
      
      // Başarılı!
      console.log('[handleQuickSwap] Success! SwapRequest created:', data.id)
      setInterestSent(true)
      setSwapType('success')
      
    } catch (err) {
      console.error('[handleQuickSwap] Unexpected error:', err)
      alert('Bağlantı hatası. Lütfen tekrar deneyin.')
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
          <p className="text-gray-400">Ürün yükleniyor...</p>
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
          <p className="text-gray-400 mb-4">{error || 'Bu ürün mevcut değil veya kaldırılmış olabilir.'}</p>
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
    <main className="min-h-screen bg-gray-50 pb-20 md:pb-12" role="main" aria-label="Ürün detay sayfası">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb Navigation - SEO GÖREV 53 */}
        <nav aria-label="Breadcrumb" className="py-4 hidden md:block">
          <ol className="flex items-center gap-2 text-sm" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/" className="text-gray-500 hover:text-violet-600 transition-colors flex items-center gap-1" itemProp="item">
                <Home className="w-4 h-4" />
                <span itemProp="name">Ana Sayfa</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <span className="text-gray-300">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/urunler" className="text-gray-500 hover:text-violet-600 transition-colors" itemProp="item">
                <span itemProp="name">Ürünler</span>
              </Link>
              <meta itemProp="position" content="2" />
            </li>
            <span className="text-gray-300">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href={`/urunler?category=${product.category?.id}`} className="text-gray-500 hover:text-violet-600 transition-colors" itemProp="item">
                <span itemProp="name">{product.category?.translatedName || product.category?.name}</span>
              </Link>
              <meta itemProp="position" content="3" />
            </li>
            <span className="text-gray-300">/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="text-gray-900 font-medium truncate max-w-[200px]">
              <span itemProp="name">{product.translatedTitle || product.title}</span>
              <meta itemProp="position" content="4" />
            </li>
          </ol>
        </nav>

        {/* Back Button - Desktop only, mobile has MobileTopNavigation */}
        <button
          onClick={() => router.back()}
          className="hidden md:flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-6 transition-colors"
          aria-label="Önceki sayfaya dön"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          <span>Geri Dön</span>
        </button>

        {/* Swapped Product Banner - GÖREV 11 */}
        {product.status === 'swapped' && (
          <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">✅ Bu ürünün takası tamamlanmıştır.</p>
              <p className="text-sm opacity-80">Bu ürün artık takas için mevcut değildir.</p>
            </div>
          </div>
        )}

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
                    <Image src={img} alt={`${product.title} - Görsel ${idx + 1}`} fill className="object-cover" />
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
                <div className="flex items-center gap-2">
                  {/* Düzenle Butonu — Sadece ürün sahibine göster */}
                  {session?.user && (product.user?.id === (session.user as any).id || isAdmin) && (
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Düzenle
                    </button>
                  )}
                  <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <Share2 className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 space-y-3">
                {/* Kullanıcının Talep Ettiği Değer */}
                <div className="flex items-center flex-wrap gap-3">
                  {product.isFreeAvailable ? (
                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <span className="text-2xl font-bold">🎁 Bedelsiz</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowPriceBreakdown(!showPriceBreakdown)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 transition-colors"
                    >
                      <span className="text-2xl font-bold">⭐ {product.valorPrice}</span>
                      <span className="ml-1 text-sm">Valor</span>
                      <span className="text-xs ml-2 opacity-80">ⓘ</span>
                    </button>
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
                
                {/* Valor Fiyat Detayı - Açılır Panel */}
                {showPriceBreakdown && priceData && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700 text-sm animate-in slide-in-from-top-2">
                    <p className="text-xs text-gray-400 mb-2">📍 {priceData.city} bölge fiyatları</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <span className="text-xs">🇹🇷</span>
                        <span className="font-bold text-xs text-red-700 dark:text-red-300">≈ {priceData.localPrices.TRY.toLocaleString('tr-TR')} ₺</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="text-xs">🇪🇺</span>
                        <span className="font-bold text-xs text-blue-700 dark:text-blue-300">≈ {priceData.localPrices.EUR} €</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-xs">🇺🇸</span>
                        <span className="font-bold text-xs text-green-700 dark:text-green-300">≈ {priceData.localPrices.USD} $</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <span className="text-xs">🇬🇧</span>
                        <span className="font-bold text-xs text-yellow-700 dark:text-yellow-300">≈ {priceData.localPrices.GBP} £</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">{priceData.explanation}</p>
                  </div>
                )}
                
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
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{product.aiValorReason}</p>
                    )}
                  </div>
                )}

                {/* ═══ DÜZENLEME GEÇMİŞİ ═══ */}
                {(product as any).editCount > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      ✏️ Bu ilan {(product as any).editCount} kez düzenlendi
                      {(product as any).lastEditedAt && (
                        <span>• Son: {new Date((product as any).lastEditedAt).toLocaleDateString('tr-TR')}</span>
                      )}
                    </p>
                    {(product as any).lastEditReason && (
                      <p className="text-xs text-gray-400 mt-1">
                        📝 "{(product as any).lastEditReason}"
                      </p>
                    )}
                    {(product as any).editHistory && (product as any).editHistory.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-blue-500 cursor-pointer">Düzenleme geçmişi</summary>
                        <div className="mt-1 space-y-1">
                          {(product as any).editHistory.map((edit: any, i: number) => (
                            <div key={i} className="text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
                              <span>{new Date(edit.createdAt).toLocaleDateString('tr-TR')}</span>
                              {edit.reason && <span>— "{edit.reason}"</span>}
                              {edit.oldValor !== edit.newValor && (
                                <span className={edit.newValor > edit.oldValor ? 'text-green-600' : 'text-red-600'}>
                                  {edit.oldValor}V → {edit.newValor}V
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ DÜZENLEME FORMU ═══ */}
            {editMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-blue-800">📝 İlanı Düzenle</h3>
                  <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-400 text-xl">✕</button>
                </div>

                {/* Başlık */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Başlık</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-sm"
                    maxLength={100}
                  />
                </div>

                {/* Açıklama */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Açıklama</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-sm h-24 resize-none"
                    maxLength={2000}
                  />
                </div>

                {/* Durum */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Durum</label>
                  <select
                    value={editForm.condition}
                    onChange={(e) => setEditForm(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-sm"
                  >
                    <option value="new">Sıfır/Yeni</option>
                    <option value="likeNew">Yeni Gibi</option>
                    <option value="good">İyi</option>
                    <option value="fair">Orta</option>
                    <option value="poor">Kötü</option>
                  </select>
                </div>

                {/* Düzenleme Nedeni */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">
                    Düzenleme Nedeni <span className="text-gray-400">(opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.editReason}
                    onChange={(e) => setEditForm(prev => ({ ...prev, editReason: e.target.value }))}
                    placeholder="Ör: Açıklama güncellendi, fotoğraf eklendi..."
                    className="w-full p-2 border rounded-lg text-sm"
                    maxLength={200}
                  />
                </div>

                {/* Uyarı: Durum değişirse Valor değişebilir */}
                {editForm.condition !== product.condition && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700">
                      ⚠️ Ürün durumunu değiştirdiğiniz için Valor değeri yeniden hesaplanacaktır.
                    </p>
                  </div>
                )}

                {/* Kaydet */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setEditSaving(true)
                      setEditSuccess('')
                      try {
                        const res = await fetch(`/api/products/${product.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'edit',
                            title: editForm.title,
                            description: editForm.description,
                            condition: editForm.condition,
                            editReason: editForm.editReason,
                          })
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setEditSuccess(data.valorChanged 
                            ? `✅ Güncellendi! Valor: ${data.oldValor} → ${data.newValor}`
                            : '✅ Güncellendi!')
                          setEditMode(false)
                          window.location.reload()
                        } else {
                          alert(data.error || 'Hata oluştu')
                        }
                      } catch { alert('Bağlantı hatası') }
                      setEditSaving(false)
                    }}
                    disabled={editSaving}
                    className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
                  >
                    {editSaving ? '⏳ Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm hover:bg-gray-200">
                    İptal
                  </button>
                </div>

                {editSuccess && <p className="text-sm text-green-600 font-medium">{editSuccess}</p>}
              </div>
            )}

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
              <p className="text-gray-400 whitespace-pre-line">{product.translatedDescription || product.description}</p>
            </div>

            {/* Güvenli Teslimat Bilgisi */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 my-4">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">🛡️</span>
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-200 mb-1.5">
                    Güvenli Teslimat Garantisi
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-green-700 dark:text-green-300">
                    <span className="flex items-center gap-1">
                      🔲 QR Kod Doğrulama
                    </span>
                    <span className="flex items-center gap-1">
                      🔐 6 Haneli Onay Kodu
                    </span>
                    <span className="flex items-center gap-1">
                      💰 Valor Teminat Kilidi
                    </span>
                    <span className="flex items-center gap-1">
                      📸 Fotoğraflı Kanıt
                    </span>
                  </div>
                </div>
              </div>
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
                <p className="text-gray-400 whitespace-pre-line">{product.usageInfo}</p>
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
              <>
              {product.status === 'swapped' ? (
                <div className="w-full rounded-xl bg-violet-50 border border-violet-200 p-4 text-center">
                  <p className="text-violet-700 font-semibold text-sm">
                    ✅ Bu ürün takas edilmiştir
                  </p>
                  <p className="text-violet-500 text-xs mt-1">
                    Bu ürün artık takas için müsait değildir.
                  </p>
                </div>
              ) : (
              <>
              {/* Yeni kullanıcı bilgilendirmesi - 400V limiti */}
              {swapCapacity && swapCapacity.completedSwaps < 3 && session?.user && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                        İlk Takas Koruma Kuralı
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        İlk {3 - swapCapacity.completedSwaps} takasınızda toplam{' '}
                        <strong>{swapCapacity.maxAllowedGain}V</strong>&apos;den fazla net kazanç elde edemezsiniz.
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-600">📊</span>
                          <span className="text-amber-700 dark:text-amber-300">
                            Mevcut: <strong>{swapCapacity.currentNetGain}V</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">✅</span>
                          <span className="text-green-700 dark:text-green-300">
                            Kalan: <strong>{swapCapacity.remainingAllowance}V</strong>
                          </span>
                        </div>
                      </div>
                      {/* İlerleme çubuğu */}
                      <div className="mt-2 h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (swapCapacity.currentNetGain / swapCapacity.maxAllowedGain) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {swapCapacity.lockedBonus > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 ml-7">
                      🔒 {swapCapacity.lockedBonus}V bonus kilitli — ilk takasınızı tamamlayınca açılır
                    </p>
                  )}
                </div>
              )}

              {/* Günlük Teklif Limiti Bilgisi */}
              {dailyLimit && session && (
                <div className={`p-3 rounded-xl text-sm flex items-center justify-between ${
                  dailyLimit.isVip 
                    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-300 dark:border-amber-700'
                    : dailyLimit.remaining === 0
                      ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                      : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                }`}>
                  {dailyLimit.isVip ? (
                    <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                      <Star className="w-4 h-4 fill-current" />
                      ♾️ VIP — Sınırsız teklif hakkı
                    </span>
                  ) : (
                    <>
                      <span className={`font-medium ${dailyLimit.remaining === 0 ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>
                        Bugün kalan: {dailyLimit.remaining}/{dailyLimit.limit} teklif hakkı
                      </span>
                      {dailyLimit.remaining === 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400">Yarın yenilenir</span>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {/* Ana Buton - Direkt Takas (Basit Flow) */}
                <button
                  onClick={() => {
                    if (!session) {
                      router.push('/giris')
                      return
                    }
                    // Günlük limit kontrolü
                    if (dailyLimit && !dailyLimit.isVip && dailyLimit.remaining === 0) {
                      showWarning('Günlük takas teklifi limitinize ulaştınız. Yarın tekrar deneyebilirsiniz.')
                      return
                    }
                    // Takas seçim modalını aç
                    setShowSwapModal(true)
                    setSwapType(null)
                    setSelectedMyProduct(null)
                    setValorDifference(0)
                    fetchMyProducts()
                  }}
                  disabled={!!(dailyLimit && !dailyLimit.isVip && dailyLimit.remaining === 0)}
                  className={`w-full py-4 rounded-xl text-white font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
                    dailyLimit && !dailyLimit.isVip && dailyLimit.remaining === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 hover:shadow-xl'
                  }`}
                >
                  <ArrowLeftRight className="w-6 h-6" />
                  Takas Teklif Et
                  <span className="text-sm font-normal opacity-90">({product.valorPrice} V)</span>
                </button>
                
                {/* Çoklu Takas Butonu */}
                <button
                  onClick={() => {
                    if (!session) {
                      router.push('/giris')
                      return
                    }
                    setShowMultiSwapOnboarding(true)
                  }}
                  className="w-full p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🔄</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-purple-800 dark:text-purple-300">Çoklu Takas Fırsatı</p>
                        <ChevronRight className="w-4 h-4 text-purple-500" />
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        3+ kişilik takas döngüleri ile bu ürüne sahip olun!
                      </p>
                    </div>
                  </div>
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
                  Satıcıya Mesaj Gönder
                </button>
              </div>
              </>
              )}
              </>
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
              className="bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto modal-content safe-area-bottom"
              style={{ overscrollBehavior: 'none', touchAction: 'pan-y' }}
              data-scrollable="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile handle */}
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
              
              {questionSent ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Sorunuz İletildi! 💬</h3>
                  <p className="text-gray-400 mb-2">Satıcı en kısa sürede cevap verecektir.</p>
                  <p className="text-sm text-gray-500 mb-3">Takas Merkezi {">"} Sorular sekmesinden takip edebilirsiniz.</p>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-left mb-4 max-w-sm mx-auto">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">🔔</span>
                      <p className="text-xs text-blue-700">
                        <span className="font-bold">Bildirim:</span> Satıcı cevap verdiğinde size bildirim göndereceğiz!
                      </p>
                    </div>
                  </div>
                </div>
              ) : interestSent ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Teklifiniz Gönderildi! 🎉</h3>
                  <p className="text-gray-400 mb-2">Ürün sahibi en kısa sürede değerlendirecektir.</p>
                  <p className="text-sm text-gray-500 mb-3">Takaslarım sayfasından takip edebilirsiniz.</p>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-left mb-4 max-w-sm mx-auto">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">🔄</span>
                      <p className="text-xs text-purple-700">
                        <span className="font-bold">Bonus:</span> Çoklu takas algoritmamız da sizin için uygun döngüler arayacak!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/takaslarim')}
                    className="px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    Takaslarıma Git
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {/* BUG #3 FIX: Modal başlığını mesaj tipine göre değiştir */}
                      {selectedMessageType === 'question' ? (
                        <>
                          <MessageCircle className="w-5 h-5 text-blue-500" />
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Satıcıya Mesaj Gönder</h3>
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="w-5 h-5 text-purple-500" />
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Takas Teklif Et</h3>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setShowInterestModal(false)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* VALOR TEKLİFİ / FARK HESABI - sadece swap modu için göster */}
                  {product && selectedMessageType === 'swap' && (
                    <div className="mb-4">
                      {selectedProductIds && selectedProductIds.length > 0 ? (
                        /* ═══ ÜRÜNE KARŞI ÜRÜN MODU ═══ */
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 rounded-xl border-2 border-indigo-200 dark:border-indigo-800">
                          <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center gap-2">
                            📊 Ürüne Karşı Ürün — Değer Karşılaştırması
                          </h4>
                          
                          {(() => {
                            const myTotal = myProducts
                              .filter(p => selectedProductIds.includes(p.id))
                              .reduce((sum, p) => sum + p.valorPrice, 0)
                            const theirPrice = product.valorPrice
                            const diff = myTotal - theirPrice
                            
                            return (
                              <div className="space-y-2">
                                {/* İki tarafın ürünleri */}
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Benim ürünlerim */}
                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                    <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">
                                      🧑 Senin teklifin
                                    </p>
                                    <p className="text-lg font-black text-blue-800 dark:text-blue-200">
                                      {myTotal} V
                                    </p>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                                      {selectedProductIds.length} ürün
                                    </p>
                                  </div>
                                  
                                  {/* Onun ürünü */}
                                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                                    <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 mb-1">
                                      👤 {product.user?.name || 'Karşı taraf'}
                                    </p>
                                    <p className="text-lg font-black text-orange-800 dark:text-orange-200">
                                      {theirPrice} V
                                    </p>
                                    <p className="text-[10px] text-orange-600 dark:text-orange-400 truncate">
                                      {product.title}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Fark */}
                                <div className={`p-3 rounded-lg border-2 text-center ${
                                  Math.abs(diff) <= theirPrice * 0.05
                                    ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                                    : diff > 0
                                    ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
                                    : 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700'
                                }`}>
                                  {Math.abs(diff) <= theirPrice * 0.05 ? (
                                    <p className="font-bold text-green-700 dark:text-green-300">
                                      ✅ Değerler yaklaşık eşit — birebir takas yapılabilir
                                    </p>
                                  ) : diff > 0 ? (
                                    <div>
                                      <p className="font-bold text-blue-700 dark:text-blue-300">
                                        💰 Senin ürünlerin {diff} Valor daha değerli
                                      </p>
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        Bu farkı karşı taraftan Valor olarak talep edebilirsin
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="font-bold text-orange-700 dark:text-orange-300">
                                        ⚠️ Karşı tarafın ürünü {Math.abs(diff)} Valor daha değerli
                                      </p>
                                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                        Farkı kapatmak için ek Valor ödeyebilir veya ek ürün ekleyebilirsin
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                {/* 3 Seçenek — farka göre dinamik */}
                                {(() => {
                                  // diff > 0 → benim ürünlerim daha değerli
                                  // diff < 0 → onun ürünü daha değerli (ben eksik tarafım)
                                  // diff ≈ 0 → yaklaşık eşit
                                  const isMyProductMoreValuable = diff > 0
                                  const isTheirProductMoreValuable = diff < 0
                                  const isApproxEqual = Math.abs(diff) <= selectedProductsTotal * 0.05

                                  return (
                                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1.5">
                                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                        Nasıl devam etmek istersin?
                                      </p>
                                      
                                      {/* SEÇENEK 1: Valor farkı */}
                                      <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer text-xs">
                                        <input 
                                          type="radio" 
                                          name="swapMode" 
                                          checked={swapNegotiationMode === 'valor_diff'} 
                                          onChange={() => {
                                            setSwapNegotiationMode('valor_diff')
                                            if (isTheirProductMoreValuable) {
                                              setOfferedValor(Math.abs(diff))
                                            } else {
                                              setOfferedValor(0)
                                            }
                                          }} 
                                          className="mt-0.5 text-purple-600" 
                                        />
                                        <div>
                                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                                            {isMyProductMoreValuable
                                              ? `💰 Farkı karşı taraftan Valor olarak talep et (+${diff}V)`
                                              : isTheirProductMoreValuable
                                              ? `💰 Farkı Valor olarak öde (${Math.abs(diff)}V)`
                                              : '💰 Valor farkı yok — tam denk'
                                            }
                                          </p>
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            {isMyProductMoreValuable
                                              ? 'Karşı taraf sana eksik kalan Valor\'u ödesin'
                                              : isTheirProductMoreValuable
                                              ? 'Eksik kalan değeri Valor ile tamamla'
                                              : 'Ek ödeme gerekmez'
                                            }
                                          </p>
                                        </div>
                                      </label>
                                      
                                      {/* SEÇENEK 2: Ek ürün — KİME GÖRE DEĞİŞİR */}
                                      <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer text-xs">
                                        <input 
                                          type="radio" 
                                          name="swapMode" 
                                          checked={swapNegotiationMode === 'request_product'} 
                                          onChange={() => {
                                            setSwapNegotiationMode('request_product')
                                            setOfferedValor(0)
                                          }} 
                                          className="mt-0.5 text-purple-600" 
                                        />
                                        <div>
                                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                                            {isMyProductMoreValuable
                                              ? '📦 Karşı taraftan ek ürün iste'
                                              : isTheirProductMoreValuable
                                              ? '📦 Farkı kapatmak için ek ürün ekle'
                                              : '📦 Ek ürün ekle veya iste'
                                            }
                                          </p>
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            {isMyProductMoreValuable
                                              ? `Karşı taraf ~${diff}V değerinde ek ürün sunsun`
                                              : isTheirProductMoreValuable
                                              ? `~${Math.abs(diff)}V değerinde ek ürün seçerek farkı kapat`
                                              : 'Teklifi zenginleştirmek için ek ürün ekleyebilirsin'
                                            }
                                          </p>
                                        </div>
                                      </label>
                                      
                                      {/* SEÇENEK 3: Birebir takas — her zaman aynı */}
                                      <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer text-xs">
                                        <input 
                                          type="radio" 
                                          name="swapMode" 
                                          checked={swapNegotiationMode === 'direct_swap'} 
                                          onChange={() => {
                                            setSwapNegotiationMode('direct_swap')
                                            setOfferedValor(0)
                                          }} 
                                          className="mt-0.5 text-purple-600" 
                                        />
                                        <div>
                                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                                            🤝 Birebir takas — fark önemli değil
                                          </p>
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            Anlaştık, ürünleri olduğu gibi değiştirelim, ek ödeme yok
                                          </p>
                                        </div>
                                      </label>
                                      
                                      {/* Seçenek 2 seçiliyse ve ben eksik tarafımsam → ek ürün seç uyarısı */}
                                      {swapNegotiationMode === 'request_product' && isTheirProductMoreValuable && (
                                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                          <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                                            💡 Yukarıdaki ürün listesinden ~{Math.abs(diff)}V değerinde 
                                            ek ürün seçerek farkı kapatabilirsin. 
                                            Veya mesaj alanına detay yazabilirsin.
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Seçenek 2 seçiliyse ve ben daha değerliysem → bilgi */}
                                      {swapNegotiationMode === 'request_product' && isMyProductMoreValuable && (
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                          <p className="text-[11px] text-blue-700 dark:text-blue-400">
                                            💡 Mesaj alanına hangi tür ürün istediğini yazabilirsin. 
                                            Karşı taraf ~{diff}V değerinde ek ürün sunmalı.
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Valor farkı modu seçiliyse ve ben ödeme yapacaksam ek input */}
                                      {swapNegotiationMode === 'valor_diff' && isTheirProductMoreValuable && (
                                        <div className="mt-2">
                                          <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">
                                            Ödeyeceğin ek Valor:
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={Math.abs(diff) * 2}
                                            value={offeredValor}
                                            onChange={(e) => setOfferedValor(e.target.value === '' ? '' : parseInt(e.target.value))}
                                            placeholder={`${Math.abs(diff)}`}
                                            className="w-full px-4 py-2 rounded-xl border-2 border-purple-300 dark:border-purple-700 text-lg font-bold text-purple-900 dark:text-purple-100 bg-white dark:bg-gray-800"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        /* ═══ SADECE VALOR MODU (ürün seçilmemişse) ═══ */
                        <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-sm">
                          <label className="block text-sm font-bold text-purple-800 dark:text-purple-300 mb-2">
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
                              className="w-full px-4 py-3 pr-24 rounded-xl border-2 border-purple-400 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-xl font-black text-purple-900 dark:text-purple-100 bg-white dark:bg-gray-800 placeholder:text-purple-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-700 dark:text-purple-300 font-black text-base">Valor</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-purple-700 dark:text-purple-300 font-medium">İstenen: <strong className="text-purple-900 dark:text-white">{product.valorPrice} Valor</strong></span>
                            {offeredValor !== '' && offeredValor < product.valorPrice && (
                              <span className="text-orange-700 font-bold bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                                %{Math.round(((product.valorPrice - (typeof offeredValor === 'number' ? offeredValor : 0)) / product.valorPrice) * 100)} pazarlık
                              </span>
                            )}
                            {offeredValor !== '' && typeof offeredValor === 'number' && offeredValor > product.valorPrice && (
                              <span className="text-green-700 font-bold bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                %{Math.round(((offeredValor - product.valorPrice) / product.valorPrice) * 100)} üstü teklif ⭐
                              </span>
                            )}
                            {offeredValor !== '' && offeredValor === product.valorPrice && (
                              <span className="text-blue-700 font-bold bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                Tam fiyat ✓
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ KESİNTİ ÖNİZLEMESİ (Valor input'un hemen altında) ═══ */}
                  {product && (offeredValor !== '' || selectedProductIds?.length > 0) && (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                        💸 TAHMİNİ KESİNTİ DETAYI
                      </p>
                      {(() => {
                        // Hesaplama GİRİLEN Valor değeri üzerinden yapılır
                        const valorAmount = selectedProductIds?.length > 0
                          ? (offeredValor === '' ? selectedProductsTotal : Number(offeredValor) + selectedProductsTotal)
                          : (offeredValor === '' ? 0 : Number(offeredValor))
                        
                        if (valorAmount <= 0) {
                          return (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                              💡 Yukarıdan Valor miktarı belirleyin veya ürün seçin
                            </p>
                          )
                        }
                        
                        let remaining = valorAmount
                        let totalFee = 0
                        const brackets = [
                          { min: 0, limit: 200, rate: 0.005 },
                          { min: 200, limit: 500, rate: 0.01 },
                          { min: 500, limit: 1000, rate: 0.015 },
                          { min: 1000, limit: 2500, rate: 0.02 },
                          { min: 2500, limit: 5000, rate: 0.025 },
                          { min: 5000, limit: Infinity, rate: 0.03 },
                        ]
                        let usedSoFar = 0
                        const details: { start: number; end: number; rate: string; fee: number }[] = []
                        
                        for (const b of brackets) {
                          const bracketSize = b.limit === Infinity ? remaining : b.limit - b.min
                          const taxable = Math.min(remaining, bracketSize)
                          if (taxable <= 0) break
                          const fee = Math.round(taxable * b.rate * 100) / 100
                          const start = usedSoFar
                          const end = usedSoFar + taxable
                          details.push({ start, end, rate: `%${b.rate * 100}`, fee })
                          totalFee += fee
                          remaining -= taxable
                          usedSoFar += taxable
                        }
                        totalFee = Math.max(1, Math.round(totalFee))
                        const effectiveRate = valorAmount > 0 ? ((totalFee / valorAmount) * 100).toFixed(1) : '0'
                        
                        return (
                          <div className="space-y-1">
                            {details.filter(d => d.fee > 0).map((d, i) => (
                              <div key={i} className="flex justify-between text-[10px] text-gray-400 dark:text-gray-400">
                                <span>{d.start === 0 ? '0' : d.start.toLocaleString()}-{d.end.toLocaleString()}V ({d.rate})</span>
                                <span>{d.fee.toFixed(1)}V</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs font-bold text-gray-800 dark:text-gray-200 pt-1 border-t border-gray-200 dark:border-gray-600">
                              <span>Toplam kesinti (efektif %{effectiveRate})</span>
                              <span>{totalFee}V</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-green-700 dark:text-green-400">
                              <span>Satıcıya gidecek (net)</span>
                              <span>{valorAmount - totalFee}V</span>
                            </div>
                          </div>
                        )
                      })()}
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

                  {/* 2. ADIM: Karşılık Ürün Seçimi (Opsiyonel - Çoklu Seçim) */}
                  {loadingMyProducts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
                    </div>
                  ) : myProducts.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        📦 Karşılığında Ürün Teklif Et <span className="text-gray-400 font-normal">(birden fazla seçebilirsiniz)</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ürün seçerek Valor ödemesini azaltabilirsiniz</p>
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {myProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProductSelection(p.id)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedProductIds.includes(p.id)
                                ? 'border-purple-500 ring-2 ring-purple-300'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {p.images?.[0] ? (
                              <Image src={p.images[0]} alt={p.title} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-300" />
                              </div>
                            )}
                            {selectedProductIds.includes(p.id) && (
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
                      {selectedProductIds.length > 0 && (
                        <div className="mt-2 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                          <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                            ✅ {selectedProductIds.length} ürün seçildi — Toplam: {selectedProductsTotal} Valor
                          </p>
                          {selectedProductsTotal < (product?.valorPrice || 0) && (
                            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-1">
                              ⚠️ {(product?.valorPrice || 0) - selectedProductsTotal} Valor fark kaldı (Valor alanına yazılabilir)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ TAKAS ÖZETİ ═══ */}
                  {product && (offeredValor !== '' || selectedProductIds.length > 0) && (() => {
                    const summary = getSwapSummary()
                    if (!summary) return null
                    
                    // DOĞRU DEĞER FARKI HESABI
                    const productValueDiff = summary.myProductsValue - summary.targetPrice
                    // productValueDiff > 0 → benim ürünlerim DAHA DEĞERLİ
                    // productValueDiff < 0 → onun ürünü DAHA DEĞERLİ
                    
                    return (
                      <div className="mb-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 rounded-xl border-2 border-indigo-200 dark:border-indigo-800">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                          📊 {selectedProductIds.length > 0 ? 'Ürüne Karşı Ürün — Değer Karşılaştırması' : 'Takas Özeti'}
                        </h4>
                        
                        {selectedProductIds.length > 0 ? (
                          /* ═══ ÜRÜNE KARŞI ÜRÜN MODU ═══ */
                          <div className="space-y-2">
                            {/* İki tarafın karşılaştırması */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-0.5">🧑 Senin ürünlerin</p>
                                <p className="text-lg font-black text-blue-800 dark:text-blue-200">{summary.myProductsValue} V</p>
                                <p className="text-[10px] text-blue-500">{selectedProductIds.length} ürün</p>
                              </div>
                              <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                                <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 mb-0.5">👤 {product.user?.name || 'Karşı taraf'}</p>
                                <p className="text-lg font-black text-orange-800 dark:text-orange-200">{summary.targetPrice} V</p>
                                <p className="text-[10px] text-orange-500 truncate">{product.title}</p>
                              </div>
                            </div>
                            
                            {/* Fark kutusu */}
                            <div className={`p-3 rounded-lg border-2 text-center ${
                              Math.abs(productValueDiff) <= summary.targetPrice * 0.05
                                ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                                : productValueDiff > 0
                                ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
                                : 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700'
                            }`}>
                              {Math.abs(productValueDiff) <= summary.targetPrice * 0.05 ? (
                                <p className="font-bold text-green-700 dark:text-green-300">
                                  ✅ Değerler yaklaşık eşit — birebir takas yapılabilir
                                </p>
                              ) : productValueDiff > 0 ? (
                                <div>
                                  <p className="font-bold text-blue-700 dark:text-blue-300">
                                    💰 Senin ürünlerin {productValueDiff} Valor daha değerli
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Bu farkı karşı taraftan Valor olarak talep edebilirsin
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-bold text-orange-700 dark:text-orange-300">
                                    ⚠️ Karşı tarafın ürünü {Math.abs(productValueDiff)} Valor daha değerli
                                  </p>
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    Farkı kapatmak için ek Valor ödeyebilir veya ek ürün ekleyebilirsin
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {/* Ek Valor ödemesi varsa */}
                            {summary.myValorOffer > 0 && (
                              <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <span className="text-purple-700 dark:text-purple-300 text-sm">💰 Ek Valor ödemen</span>
                                <span className="font-bold text-purple-700 dark:text-purple-300">{summary.myValorOffer} V</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* ═══ SADECE VALOR MODU ═══ */
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-400 dark:text-gray-400">🎯 İstediğin ürün</span>
                              <span className="font-bold text-gray-900 dark:text-white">{summary.targetPrice} V</span>
                            </div>
                            
                            <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <span className="text-purple-700 dark:text-purple-300">💰 Valor teklifin</span>
                              <span className="font-bold text-purple-700 dark:text-purple-300">{summary.myValorOffer || summary.targetPrice} V</span>
                            </div>
                            
                            {summary.myValorOffer > 0 && summary.myValorOffer < summary.targetPrice && (
                              <div className="p-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                                <p className="text-xs text-orange-700 dark:text-orange-400">
                                  ⚠️ %{Math.round((1 - summary.myValorOffer / summary.targetPrice) * 100)} pazarlık teklifi
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Takas sonrası - sadece Valor modunda göster */}
                        {selectedProductIds.length === 0 && (
                          <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700 space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Takas Sonrası Tahmini:</p>
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">👤 {product.user?.name || 'Satıcı'} alacak:</span>
                              <span className="font-bold text-green-600">+{summary.netToSeller} V</span>
                            </div>
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">🏦 Topluluk katkısı:</span>
                              <span className="font-bold text-yellow-600">~{summary.estimatedFee} V</span>
                            </div>
                            
                            <p className="text-[9px] text-gray-400 text-center mt-1">
                              * Tahmini. Gerçek kesinti progresif sisteme göre belirlenir.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Bilgi Kartları */}
                  <div className="space-y-2 mb-4">
                    {product?.isFreeAvailable && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                        <span>🎁</span>
                        <p className="text-xs font-medium">Bu ürün bedelsiz de verilebilir!</p>
                      </div>
                    )}
                    {product?.acceptsNegotiation && !product?.isFreeAvailable && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
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
                        Mesaj Gönder
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

      {/* Yeni Takas Seçim Modalı */}
      <AnimatePresence>
        {showSwapModal && product && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[70]"
            onClick={() => {
              setShowSwapModal(false)
              setSwapType(null)
              setSelectedMyProduct(null)
              setValorDifference(0)
            }}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] overflow-y-auto safe-area-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile handle */}
              <div className="md:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* ADIM 1: Takas Türü Seçimi */}
              {!swapType && (
                <div className="p-5 space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-4">
                    Nasıl takas yapmak istersiniz?
                  </h3>
                  
                  <button
                    onClick={() => {
                      setSwapType('product')
                    }}
                    className="w-full p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-xl text-left hover:border-purple-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🔄</span>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">Ürünümle Takas Et</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Kendi ürününüzü karşılık olarak teklif edin</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setSwapType('valor')}
                    className="w-full p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-xl text-left hover:border-amber-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">💰</span>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">Valor ile Al</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{product.valorPrice} Valor ödeyerek direkt alın</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* ADIM 2A: Ürün Seçimi */}
              {swapType === 'product' && !selectedMyProduct && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hangi ürününüzü teklif edeceksiniz?</h3>
                    <button onClick={() => setSwapType(null)} className="text-sm text-gray-400 hover:text-gray-700">← Geri</button>
                  </div>
                  
                  {loadingMyProducts ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                      <p className="text-gray-400">Ürünleriniz yükleniyor...</p>
                    </div>
                  ) : myProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-400 mb-3">Aktif ürününüz yok</p>
                      <button 
                        onClick={() => router.push('/urun-ekle')}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold"
                      >
                        + Ürün Ekle
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {myProducts.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedMyProduct(p)
                            const diff = product.valorPrice - p.valorPrice
                            setValorDifference(diff)
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-xl hover:border-purple-400 transition-colors text-left"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={`${p.title} ürün görseli`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                            <p className="text-xs text-purple-600">⭐ {p.valorPrice} Valor</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ADIM 2B: Valor Fark Özeti ve Onay */}
              {swapType === 'product' && selectedMyProduct && (
                <div className="p-5 space-y-4">
                  <button onClick={() => setSelectedMyProduct(null)} className="text-sm text-gray-400 hover:text-gray-700">← Ürün Değiştir</button>
                  
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">Takas Özeti</h3>
                  
                  {/* Karşılaştırma */}
                  <div className="flex items-center gap-3 justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 mx-auto mb-1">
                        {selectedMyProduct.images?.[0] ? (
                          <img src={selectedMyProduct.images[0]} alt={`${selectedMyProduct.title} - senin ürünün`} className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center">📦</div>}
                      </div>
                      <p className="text-xs font-medium truncate max-w-[100px] text-gray-700 dark:text-gray-300">{selectedMyProduct.title}</p>
                      <p className="text-xs text-purple-600 font-bold">⭐ {selectedMyProduct.valorPrice}</p>
                    </div>
                    
                    <div className="text-2xl" aria-hidden="true">🔄</div>
                    
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 mx-auto mb-1">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={`${product.title} - takas edilecek ürün`} className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center">📦</div>}
                      </div>
                      <p className="text-xs font-medium truncate max-w-[100px] text-gray-700 dark:text-gray-300">{product.title}</p>
                      <p className="text-xs text-purple-600 font-bold">⭐ {product.valorPrice}</p>
                    </div>
                  </div>
                  
                  {/* Valor Farkı */}
                  {valorDifference !== 0 && (
                    <div className={`p-3 rounded-xl text-center ${
                      valorDifference > 0 
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200' 
                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200'
                    }`}>
                      {valorDifference > 0 ? (
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                          💰 {valorDifference} Valor fark ödemeniz gerekecek
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-green-800 dark:text-green-200">
                          💰 {Math.abs(valorDifference)} Valor fark size ödenecek
                        </p>
                      )}
                    </div>
                  )}
                  
                  {valorDifference === 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center border border-green-200">
                      <p className="text-sm font-bold text-green-800 dark:text-green-200">
                        ✅ Değerler eşit — doğrudan takas!
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      ⚠️ {error}
                    </div>
                  )}
                  
                  {/* Onay Butonu */}
                  <button
                    onClick={() => {
                      handleQuickSwap(selectedMyProduct.id, valorDifference > 0 ? valorDifference : 0)
                    }}
                    disabled={sendingInterest}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50"
                  >
                    {sendingInterest ? '⏳ Gönderiliyor...' : '🔄 Takas Teklifi Gönder'}
                  </button>
                </div>
              )}

              {/* ADIM 2C: Valor ile Satın Al Onayı */}
              {swapType === 'valor' && (
                <div className="p-5 space-y-4">
                  <button onClick={() => setSwapType(null)} className="text-sm text-gray-400 hover:text-gray-700">← Geri</button>
                  
                  <div className="text-center">
                    <span className="text-4xl">💰</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                      {product.valorPrice} Valor ödeyeceksiniz
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{product.title}</p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      ⚠️ {error}
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      handleQuickSwap(null, product.valorPrice)
                    }}
                    disabled={sendingInterest}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg disabled:opacity-50"
                  >
                    {sendingInterest ? '⏳ Gönderiliyor...' : '💰 Valor ile Teklif Gönder'}
                  </button>
                </div>
              )}

              {/* BAŞARI EKRANI */}
              {swapType === 'success' && (
                <div className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="mb-4"
                  >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                  </motion.div>
                  
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    🎉 Takas Teklifi Gönderildi!
                  </h3>
                  <p className="text-gray-400 dark:text-gray-400 mb-6">
                    {product?.user?.name || 'Ürün sahibi'} en kısa sürede değerlendirecektir.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setShowSwapModal(false)
                        setSwapType(null)
                        setInterestSent(false)
                        router.push('/takaslarim')
                      }}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold"
                    >
                      📋 Tekliflerimi Görüntüle
                    </button>
                    <button
                      onClick={() => {
                        setShowSwapModal(false)
                        setSwapType(null)
                        setInterestSent(false)
                        setSelectedMyProduct(null)
                      }}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                    >
                      Ürüne Geri Dön
                    </button>
                  </div>
                </div>
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
                            <p className="text-gray-400">Oda fotoğrafı yüklemek için tıklayın</p>
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

      {/* Çoklu Takas Onboarding Modal */}
      {showMultiSwapOnboarding && (
        <MultiSwapOnboarding
          productId={product?.id}
          onClose={() => setShowMultiSwapOnboarding(false)}
          onStartSwap={(chainId) => {
            router.push(`/takas-firsatlari?tab=multiSwap&multiSwapId=${chainId}`)
          }}
        />
      )}
      
      {/* Mobil Sticky CTA */}
      {product && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t dark:border-gray-700 p-3 safe-area-bottom shadow-lg">
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-purple-500 fill-current" />
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {product.valorPrice} Valor
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {product.title}
              </p>
            </div>
            
            {session ? (
              !isOwner ? (
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  🔄 Takas Yap
                </button>
              ) : (
                <span className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-medium">
                  Sizin ürününüz
                </span>
              )
            ) : (
              <Link
                href="/giris"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap"
              >
                Giriş Yap
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
