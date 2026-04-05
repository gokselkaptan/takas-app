'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

// Lazy load html5-qrcode (100KB+ savings from initial bundle)
let Html5Qrcode: any = null
let Html5QrcodeScannerState: any = null

async function loadQrScanner() {
  if (!Html5Qrcode) {
    const module = await import('html5-qrcode')
    Html5Qrcode = module.Html5Qrcode
    Html5QrcodeScannerState = module.Html5QrcodeScannerState
  }
  return { Html5Qrcode, Html5QrcodeScannerState }
}
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, RefreshCw, Users, Package, CheckCircle, Clock,
  AlertCircle, Sparkles, ArrowLeftRight, ChevronRight, Bell,
  X, Check, Loader2, MapPin, Scale, TrendingUp, Filter, Info, AlertTriangle,
  MessageCircle, ArrowLeft
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { QRCodeSVG } from 'qrcode.react'
import { safeFetch } from '@/lib/safe-fetch'
import { playSwapSound, playSuccessSound } from '@/lib/notification-sounds'
import { SwapChat } from '@/components/takas-merkezi/SwapChat'
import { MultiSwapChat } from '@/components/takas-merkezi/MultiSwapChat'
import { MobileSwapActionBar } from '@/components/takas-merkezi/MobileSwapActionBar'

interface SwapParticipant {
  userId: string
  userName: string
  productId: string
  productTitle: string
  productImage: string | null
  productValorPrice: number
  productLocation: string | null
  wantsProductId: string
  wantsProductOwnerId: string
  wantsProductValorPrice: number
}

interface SwapChain {
  participants: SwapParticipant[]
  chainLength: number
  isValueBalanced: boolean
  valueBalanceScore: number
  locationScore: number
  totalScore: number
  averageValorPrice: number
  valueDifference: number
}

interface SwapStats {
  totalFound: number
  balanced: number
  unbalanced: number
  averageScore: number
}

interface MultiSwap {
  id: string
  status: string
  createdAt: string
  participants: {
    id: string
    userId: string
    confirmed: boolean
    user: { id: string; name: string | null; image: string | null }
    givesProduct: { id: string; title: string; images: string[]; valorPrice: number }
  }[]
}

interface PendingSwapRequest {
  id: string
  productId: string
  message: string | null
  status: string
  createdAt: string
  qrCode?: string | null
  qrCodeB?: string | null  // Ürüne karşı ürün için ikinci QR
  customLocation?: string | null
  deliveryMethod?: string | null
  deliveryPointId?: string | null
  deliveryPoint?: { id: string; name: string; address: string } | null
  requesterId: string
  ownerId: string
  lastProposedBy?: string | null  // Son teslimat önerisini yapan kullanıcı
  // Valor teklifi
  pendingValorAmount?: number | null  // Teklif edilen Valor miktarı
  agreedPriceRequester?: number | null  // Pazarlık sonucu anlaşılan fiyat
  // Varış durumu — çift taraflı "Geldim" sistemi
  ownerArrived?: boolean
  requesterArrived?: boolean
  // Ürüne karşı ürün takası için çift taraflı teslimat durumu
  ownerReceivedProduct?: boolean   // Owner karşı ürünü aldı mı
  requesterReceivedProduct?: boolean  // Requester ürünü aldı mı
  // Teslimat yöntemi
  deliveryType?: string | null       // 'face_to_face' | 'drop_off'
  dropOffDeadline?: string | null    // Alıcının teslim noktasından alma son tarihi
  droppedOffAt?: string | null       // Satıcının ürünü bıraktığı zaman
  pickedUpAt?: string | null         // Alıcının ürünü aldığı zaman
  // Fotoğraf alanları
  packagingPhotos?: string[]     // Satıcı paketleme fotoları
  deliveryPhotos?: string[]      // Satıcı teslim fotoları  
  receivingPhotos?: string[]     // Alıcı alım fotoları
  // Dispute window
  disputeWindowEndsAt?: string | null  // Anlaşmazlık bildirimi son tarihi
  // Teslim tarihi takibi (GÖREV 8)
  scheduledDeliveryDate?: string | null  // Belirlenen teslim tarihi
  deliveryDateProposedBy?: string | null  // Teslim tarihini öneren kullanıcı ID
  deliveryDateAcceptedBy?: string | null  // Teslim tarihini kabul eden kullanıcı ID
  lastOverdueNotificationAt?: string | null  // Son gecikme bildirimi zamanı
  completedAt?: string | null  // Takas tamamlanma tarihi
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
    user: { id: string; name: string | null; image?: string | null }
  }
  requester: { id: string; name: string | null; email: string; image?: string | null }
  owner?: { id: string; name: string | null; email?: string; image?: string | null }
  offeredProduct?: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  } | null
}

// ═══ YENİ SADELEŞTİRİLMİŞ TAKAS AKIŞI (4 ADIM) ═══
// pending → accepted → awaiting_delivery → completed

const SWAP_STEPS = [
  { key: 'pending',           label: 'Teklif Gönderildi',           icon: '📩', shortLabel: 'Teklif' },
  { key: 'accepted',          label: 'Anlaşma Sağlandı',            icon: '🤝', shortLabel: 'Anlaşma' },
  { key: 'awaiting_delivery', label: 'Teslimat Bekleniyor',         icon: '📦', shortLabel: 'Teslimat' },
  { key: 'completed',         label: 'Takas Tamamlandı',            icon: '🎉', shortLabel: 'Tamam' },
]

// Eski uyumluluk için
const SWAP_STEPS_FACE_TO_FACE = SWAP_STEPS
const SWAP_STEPS_DROP_OFF = SWAP_STEPS

// Teslimat yöntemine göre adımları getir (artık tek akış var)
function getSwapSteps(deliveryType?: string | null) {
  return SWAP_STEPS
}

function getStepIndex(status: string, deliveryType?: string | null): number {
  const steps = getSwapSteps(deliveryType)
  const idx = steps.findIndex(s => s.key === status)
  return idx >= 0 ? idx : -1
}

export default function TakasFirsatlariPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useLanguage()
  
  const [opportunities, setOpportunities] = useState<SwapChain[]>([])
  const [swapStats, setSwapStats] = useState<SwapStats | null>(null)
  const [activeSwaps, setActiveSwaps] = useState<MultiSwap[]>([])
  const [sentRequests, setSentRequests] = useState<PendingSwapRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<PendingSwapRequest[]>([])
  const [activeDirectSwaps, setActiveDirectSwaps] = useState<PendingSwapRequest[]>([])
  const [completedSwaps, setCompletedSwaps] = useState<PendingSwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // ═══ GÖREV 38: Sekme bazlı loading ve cache state'leri ═══
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({
    requests: false,
    active: false,
    opportunities: false,
    completed: false
  })
  const tabDataFetchedRef = useRef<Record<string, boolean>>({
    requests: false,
    active: false,
    opportunities: false,
    completed: false
  })
  const [confirmingSwap, setConfirmingSwap] = useState<string | null>(null)
  const [rejectingSwap, setRejectingSwap] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [creatingSwap, setCreatingSwap] = useState(false)
  const [activeTab, setActiveTab] = useState<'opportunities' | 'active' | 'requests' | 'completed'>('requests')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [openChatId, setOpenChatId] = useState<string | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}) // swapId -> unread count
  const [showOnlyBalanced, setShowOnlyBalanced] = useState(false)
  const [minScoreFilter, setMinScoreFilter] = useState(0)
  const prevPendingCountRef = useRef<number>(0)
  
  // Teslimat noktası belirleme state'leri
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [deliverySwapId, setDeliverySwapId] = useState<string | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery_point' | 'custom_location'>('custom_location')
  const [deliveryPointId, setDeliveryPointId] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryAction, setDeliveryAction] = useState<'propose' | 'counter'>('propose')
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliveryPoints, setDeliveryPoints] = useState<Array<{id: string, name: string, address: string}>>([])
  
  // Yeni takas adımları için state'ler
  const [readyForPickup, setReadyForPickup] = useState<Record<string, string>>({})
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [verificationInput, setVerificationInput] = useState<Record<string, string>>({})
  const [scanInput, setScanInput] = useState<Record<string, string>>({}) // Manuel QR giriş
  
  // Fotoğraf yükleme state'leri
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, string[]>>({})
  // key: swapId_photoType, value: uploaded URLs
  
  // ═══ ANLAŞMAZLIK (DISPUTE) STATE'LERİ ═══
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeSwapId, setDisputeSwapId] = useState<string | null>(null)
  const [disputeType, setDisputeType] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputePhotos, setDisputePhotos] = useState<string[]>([])
  const [uploadingDisputePhoto, setUploadingDisputePhoto] = useState(false)
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const disputePhotoInputRef = useRef<HTMLInputElement>(null)
  // GÖREV 46: Yeni alanlar
  const [disputeContactEmail, setDisputeContactEmail] = useState('')
  const [disputeExpectedResolution, setDisputeExpectedResolution] = useState('')
  
  // ═══ QR KAMERA TARAMA ═══
  const [showQrScanModal, setShowQrScanModal] = useState(false)
  const [qrScanSwapId, setQrScanSwapId] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const selectedSwapRef = useRef<HTMLDivElement>(null)
  const qrScannerContainerId = 'qr-reader-container-takas'
  
  // ═══ MESAJ GÖNDERME STATE ═══
  const [sendingMessage, setSendingMessage] = useState<string | null>(null)
  
  // ═══ YENİ TAKAS MERKEZİ STATE'LERİ ═══
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null)
  const [selectedSwapData, setSelectedSwapData] = useState<PendingSwapRequest | null>(null)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)
  
  // ═══ TESLİM TARİHİ YÖNETİMİ STATE'LERİ (GÖREV 8) ═══
  const [showDeliveryDateModal, setShowDeliveryDateModal] = useState(false)
  const [deliveryDateSwapId, setDeliveryDateSwapId] = useState<string | null>(null)
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState('')
  const [deliveryDateLoading, setDeliveryDateLoading] = useState(false)
  
  // ═══ TAKAS İPTAL MODAL STATE'LERİ (GÖREV 14) ═══
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelSwapId, setCancelSwapId] = useState<string | null>(null)
  const [cancelSwapStatus, setCancelSwapStatus] = useState<string | null>(null)
  const [selectedCancelReason, setSelectedCancelReason] = useState('')
  const [customCancelReason, setCustomCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  
  // ═══ GÜNLÜK TAKİS TEKLİFİ LİMİTİ (GÖREV 15) ═══
  const [dailyLimit, setDailyLimit] = useState<{
    used: number
    limit: number
    remaining: number
    isVip: boolean
  } | null>(null)
  
  // ═══ GELEN/GİDEN TALEPLER FİLTRESİ (GÖREV 19) ═══
  const [offerFilter, setOfferFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  
  const currentUserId = (session?.user as any)?.id
  
  // ═══ İPTAL NEDENLERİ (GÖREV 14) ═══
  const CANCEL_REASONS = [
    { key: 'other_party_no_communication', label: 'Karşı taraf iletişime geçmiyor', penaltyTarget: 'other_party' },
    { key: 'product_not_as_described', label: 'Ürün tanıma uymuyor', penaltyTarget: 'other_party' },
    { key: 'schedule_conflict', label: 'Teslim tarihi konusunda anlaşamadık', penaltyTarget: 'canceller' },
    { key: 'personal_reasons', label: 'Kişisel nedenler', penaltyTarget: 'canceller' },
    { key: 'changed_mind', label: 'Fikrim değişti', penaltyTarget: 'canceller' },
    { key: 'found_better_deal', label: 'Daha iyi bir teklif buldum', penaltyTarget: 'canceller' },
    { key: 'other', label: 'Diğer (Açıklama yazın)', penaltyTarget: 'canceller' },
  ]

  // ═══ TAKAS SEÇİMİ FONKSİYONU ═══
  const handleSelectSwap = useCallback((swap: PendingSwapRequest) => {
    setSelectedSwapId(swap.id)
    setSelectedSwapData(swap)
    setShowMobileDetail(true)
    setShowChatPanel(false)
  }, [])

  // ═══ MOBİL GERİ DÖNÜŞ ═══
  const handleBackToList = useCallback(() => {
    setShowMobileDetail(false)
    setSelectedSwapId(null)
    setSelectedSwapData(null)
  }, [])

  // ═══ MESAJLAŞMAYI AÇ/KAPA ═══
  const toggleChatPanel = useCallback(() => {
    setShowChatPanel(prev => !prev)
  }, [])

  // ═══ TAKAS-A MESAJ SERVİSİ İLE GÖNDERİM ═══
  const sendSwapMessage = async (receiverId: string, content: string, swapId: string) => {
    setSendingMessage(swapId)
    try {
      const res = await safeFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, content, swapRequestId: swapId })
      })
      if (res.ok) {
        showNotification('success', '✅ Mesaj karşı tarafa iletildi!')
        return true
      } else {
        showNotification('error', 'Mesaj gönderilemedi')
        return false
      }
    } catch (error) {
      showNotification('error', 'Mesaj gönderme hatası')
      return false
    } finally {
      setSendingMessage(null)
    }
  }

  // Rejection reasons
  const rejectionReasons = [
    { id: 'value_difference', label: 'Değer farkı çok fazla' },
    { id: 'not_interested', label: 'Artık ilgilenmiyorum' },
    { id: 'location_far', label: 'Konum çok uzak' },
    { id: 'changed_mind', label: 'Fikrimi değiştirdim' },
    { id: 'other', label: 'Diğer' },
  ]

  // URL'den tab parametresini oku ve aktif tab'ı ayarla
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'active') {
      setActiveTab('active')
    } else if (tabParam === 'opportunities') {
      setActiveTab('opportunities')
    } else if (tabParam === 'completed') {
      setActiveTab('completed')
    }
  }, [searchParams])

  // Tab mapping fonksiyonu — status'e göre doğru tab'ı döndür
  const getTabByStatus = useCallback((status: string): 'requests' | 'active' | 'completed' | 'opportunities' => {
    if (status === 'pending') return 'requests'
    if (['accepted', 'negotiating', 'in_transit'].includes(status)) return 'active'
    if (status === 'completed') return 'completed'
    return 'requests' // fallback
  }, [])

  // Deep link swapId — component seviyesinde çek
  const deepLinkSwapId = searchParams.get('swapId')

  // URL'den swapId parametresini oku ve otomatik seçim yap (Deep Link — Production-Ready)
  useEffect(() => {
    if (!deepLinkSwapId) return

    // Race condition fix: listeler henüz yüklenmediyse bekle
    const hasData = (
      (sentRequests?.length ?? 0) > 0 ||
      (receivedRequests?.length ?? 0) > 0 ||
      (activeDirectSwaps?.length ?? 0) > 0 ||
      (completedSwaps?.length ?? 0) > 0
    )
    if (!hasData) return

    // Duplicate fix: tüm listeleri birleştir, ID bazlı tekil yap
    const allSwaps: PendingSwapRequest[] = [
      ...(sentRequests || []),
      ...(receivedRequests || []),
      ...(activeDirectSwaps || []),
      ...(completedSwaps || [])
    ].filter((s, index, self) =>
      self.findIndex(x => x.id === s.id) === index
    )

    const found = allSwaps.find(s => s.id === deepLinkSwapId)
    if (found) {
      setSelectedSwapId(found.id)
      setSelectedSwapData(found)
      setActiveTab(getTabByStatus(found.status))
    }
  }, [deepLinkSwapId, sentRequests, receivedRequests, activeDirectSwaps, completedSwaps, getTabByStatus])

  // Seçilen swap'a otomatik scroll (Deep Link)
  useEffect(() => {
    if (selectedSwapData && selectedSwapRef.current) {
      // Küçük bir gecikme ile scroll yap (tab geçişinin tamamlanmasını bekle)
      const timer = setTimeout(() => {
        selectedSwapRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [selectedSwapData])


  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/giris')
      return
    }
    if (status === 'authenticated' && session?.user) {
      // İlk yüklemede sadece aktif sekmenin (requests) verisini çek
      fetchTabData('requests')
      
      // ═══ GÖREV 15: Günlük takas teklifi limitini al ═══
      fetch('/api/swap-requests/daily-limit')
        .then(r => r.json())
        .then(data => {
          if (!data.error) setDailyLimit(data)
        })
        .catch(() => {})
      
      // ═══ GÖREV 7: 48 saati geçen pending teklifleri otomatik iptal et ═══
      safeFetch('/api/swap-requests/auto-cancel', { 
        method: 'POST',
        timeout: 10000 
      }).catch(() => {})
      
      // ═══ GÖREV 38: Polling - 30 saniye interval, sadece aktif sekme için ═══
      const pollInterval = setInterval(() => {
        fetchTabData(activeTab, true) // isPolling=true
      }, 30000)
      
      return () => clearInterval(pollInterval)
    }
  }, [status, session?.user])
  
  // ═══ GÖREV 38: Sekme değişikliğinde lazy loading ═══
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Sekme değiştiğinde sadece o sekmenin verisini çek (cache yoksa)
      if (!tabDataFetchedRef.current[activeTab]) {
        fetchTabData(activeTab)
      }
    }
  }, [activeTab, status, session?.user])

  // ═══ GÖREV 38: Sekme bazlı veri çekme fonksiyonu ═══
  const fetchTabData = useCallback(async (tab: string, isPolling = false) => {
    // Polling'de sadece mevcut sekmeyi güncelle, loading gösterme
    if (!isPolling) {
      setTabLoading(prev => ({ ...prev, [tab]: true }))
      if (!tabDataFetchedRef.current[tab]) {
        setLoading(true)
      }
    }
    
    try {
      switch (tab) {
        case 'requests':
          // Teklifler sekmesi - sent ve received birlikte
          const [sentResult, receivedResult] = await Promise.all([
            safeFetch('/api/swap-requests?type=sent', { timeout: 8000 }),
            safeFetch('/api/swap-requests?type=received', { timeout: 8000 }),
          ])
          
          if (!sentResult.error && sentResult.data) {
            const data = sentResult.data
            const requests = Array.isArray(data) ? data 
              : data.requests ? data.requests 
              : data.swapRequests ? data.swapRequests 
              : []
            setSentRequests(requests)
          }
          
          if (!receivedResult.error && receivedResult.data) {
            const data = receivedResult.data
            const requests = Array.isArray(data) ? data 
              : data.requests ? data.requests 
              : data.swapRequests ? data.swapRequests 
              : []
            const newPendingCount = requests.filter((r: any) => r.status === 'pending').length
            if (newPendingCount > prevPendingCountRef.current && prevPendingCountRef.current > 0) {
              playSwapSound()
            }
            prevPendingCountRef.current = newPendingCount
            setReceivedRequests(requests)
          }
          
          // Aktif takasları da hesapla (requests sekmesi için gerekli)
          const sentReqs = sentResult.data?.requests || sentResult.data || []
          const receivedReqs = receivedResult.data?.requests || receivedResult.data || []
          const allReqs = [...(Array.isArray(sentReqs) ? sentReqs : []), ...(Array.isArray(receivedReqs) ? receivedReqs : [])]
          
          const activeStatuses = ['accepted', 'awaiting_delivery']
          const uniqueActive = allReqs
            .filter((r: any) => activeStatuses.includes(r.status))
            .filter((r: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === r.id) === i)
          setActiveDirectSwaps(uniqueActive)
          
          // Unread counts
          fetchUnreadCounts(allReqs)
          break
          
        case 'active':
          // Aktif takaslar sekmesi
          const activeResult = await safeFetch('/api/multi-swap?type=active', { timeout: 8000 })
          if (!activeResult.error && activeResult.data) {
            setActiveSwaps(Array.isArray(activeResult.data) ? activeResult.data : [])
          }
          break
          
        case 'opportunities':
          // Fırsatlar sekmesi
          const opportunityParams = new URLSearchParams()
          opportunityParams.set('limit', '10')
          if (showOnlyBalanced) opportunityParams.set('balanced', 'true')
          if (minScoreFilter > 0) opportunityParams.set('minScore', minScoreFilter.toString())
          
          const opportunitiesResult = await safeFetch(`/api/multi-swap?${opportunityParams.toString()}`, { timeout: 8000 })
          if (!opportunitiesResult.error && opportunitiesResult.data) {
            const data = opportunitiesResult.data
            setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : [])
            setSwapStats(data.stats || null)
          }
          break
          
        case 'completed':
          // Tamamlanan takaslar sekmesi
          const [completedSent, completedReceived] = await Promise.all([
            safeFetch('/api/swap-requests?type=sent&status=completed', { timeout: 8000 }),
            safeFetch('/api/swap-requests?type=received&status=completed', { timeout: 8000 }),
          ])
          
          const completedSentReqs = completedSent.data?.requests || completedSent.data || []
          const completedReceivedReqs = completedReceived.data?.requests || completedReceived.data || []
          const allCompletedReqs = [
            ...(Array.isArray(completedSentReqs) ? completedSentReqs : []), 
            ...(Array.isArray(completedReceivedReqs) ? completedReceivedReqs : [])
          ]
          const uniqueCompleted = allCompletedReqs
            .filter((r: any) => r.status === 'completed')
            .filter((r: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === r.id) === i)
          setCompletedSwaps(uniqueCompleted)
          break
      }
      
      tabDataFetchedRef.current[tab] = true
    } catch (error) {
      console.error(`Fetch error for tab ${tab}:`, error)
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }))
      setLoading(false)
    }
  }, [showOnlyBalanced, minScoreFilter])
  
  // ═══ GÖREV 38: Backward compatibility - eski fetchData fonksiyonu ═══
  const fetchData = useCallback(async (isPolling = false) => {
    // Sadece aktif sekmenin verisini çek
    await fetchTabData(activeTab, isPolling)
  }, [activeTab, fetchTabData])

  // Swap'lar için okunmamış mesaj sayılarını getir
  const fetchUnreadCounts = async (swaps: PendingSwapRequest[]) => {
    if (!currentUserId || swaps.length === 0) return
    
    try {
      // Tüm unique otherUserId'leri topla
      const otherUserIds = swaps.map(swap => 
        swap.requesterId === currentUserId ? swap.ownerId : swap.requesterId
      ).filter((id, i, arr) => arr.indexOf(id) === i)
      
      // Paralel olarak her kullanıcı için okunmamış mesaj sayısını al
      const counts: Record<string, number> = {}
      await Promise.all(otherUserIds.map(async (userId) => {
        try {
          const res = await safeFetch(`/api/messages?userId=${userId}&unreadOnly=true`, { timeout: 5000 })
          if (!res.error && res.data?.unreadCount !== undefined) {
            // Bu kullanıcı ile ilgili tüm swap'lara unread count ata
            swaps.forEach(swap => {
              const otherUserId = swap.requesterId === currentUserId ? swap.ownerId : swap.requesterId
              if (otherUserId === userId) {
                counts[swap.id] = res.data.unreadCount
              }
            })
          }
        } catch (e) {
          console.error('Unread count fetch error for user:', userId, e)
        }
      }))
      
      setUnreadCounts(counts)
    } catch (error) {
      console.error('fetchUnreadCounts error:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    showNotification('success', 'Veriler güncellendi!')
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // Teslim noktalarını çek
  const fetchDeliveryPoints = async () => {
    try {
      const res = await fetch('/api/delivery-points')
      if (res.ok) {
        const data = await res.json()
        setDeliveryPoints(data.deliveryPoints || data || [])
      }
    } catch {}
  }

  // Teslimat önerisi gönder
  const submitDeliveryProposal = async () => {
    if (!deliverySwapId) return
    setDeliveryLoading(true)
    try {
      const res = await fetch('/api/swap-requests/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: deliverySwapId,
          action: deliveryAction,
          deliveryMethod,
          deliveryPointId: deliveryMethod === 'delivery_point' ? deliveryPointId : undefined,
          customLocation: deliveryMethod === 'custom_location' ? customLocation : undefined,
          deliveryDate: deliveryDate || undefined,
          deliveryTime: deliveryTime || undefined,
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', data.message || 'Teslimat önerisi gönderildi!')
        setShowDeliveryModal(false)
        resetDeliveryModal()
        fetchData()
      } else {
        showNotification('error', data.error || 'Bir hata oluştu')
      }
    } catch {
      showNotification('error', 'Bağlantı hatası')
    }
    setDeliveryLoading(false)
  }

  // Teslimat önerisini kabul et
  const acceptDeliveryProposal = async (swapId: string) => {
    setDeliveryLoading(true)
    try {
      const res = await fetch('/api/swap-requests/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: swapId,
          action: 'accept',
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', '✅ Teslimat noktası onaylandı! QR kod oluşturuldu.')
        fetchData()
      } else {
        showNotification('error', data.error || 'Onaylama başarısız')
      }
    } catch {
      showNotification('error', 'Bağlantı hatası')
    }
    setDeliveryLoading(false)
  }

  // Modal'ı sıfırla
  const resetDeliveryModal = () => {
    setDeliverySwapId(null)
    setDeliveryMethod('custom_location')
    setDeliveryPointId('')
    setCustomLocation('')
    setDeliveryDate('')
    setDeliveryTime('')
    setDeliveryAction('propose')
  }

  // Kullanıcı rolünü kontrol et
  const isOwner = (request: PendingSwapRequest) => request.ownerId === currentUserId
  const isRequester = (request: PendingSwapRequest) => request.requesterId === currentUserId

  // ═══ TAKAS ADIMLARI FONKSİYONLARI (SADELEŞTİRİLMİŞ) ═══
  
  // DEVRE DIŞI - Eski akış için stub fonksiyonlar (TypeScript hata önleme)
  const handleArrived = async (_swapId: string) => { console.warn('handleArrived devre dışı') }
  const handleStartInspection = async (_swapId: string) => { console.warn('handleStartInspection devre dışı') }
  const handleApproveProduct = async (_swapId: string) => { console.warn('handleApproveProduct devre dışı') }

  // 6 haneli kodu doğrular — status: completed
  const handleVerifyCode = async (swapId: string) => {
    const code = verificationInput[swapId]
    if (!code || code.length !== 6) {
      showNotification('error', '6 haneli kodu girin')
      return
    }
    setProcessingAction(swapId + '_verify')
    try {
      const res = await fetch('/api/swap-requests/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId: swapId, action: 'verify_code', code })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', '🎉 Takas güvenle tamamlandı!')
        fetchData()
      } else showNotification('error', data.error || 'Kod yanlış')
    } catch { showNotification('error', 'Bağlantı hatası') }
    setProcessingAction(null)
  }

  // ═══ QR TARAMA FONKSİYONU ═══
  const handleScanQR = async (swapId: string, qrCode: string) => {
    if (!qrCode || !qrCode.toUpperCase().startsWith('TAKAS-')) {
      showNotification('error', 'Geçersiz QR kod formatı')
      return
    }
    setProcessingAction(swapId + '_scan')
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCode: qrCode.toUpperCase(),
          action: 'scan_qr'
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', '✅ QR kod tarandı! Şimdi ürünü kontrol edebilirsiniz.')
        fetchData()
        setScanInput(prev => ({ ...prev, [swapId]: '' }))
      } else {
        showNotification('error', data.error || 'QR tarama hatası')
      }
    } catch {
      showNotification('error', 'Bağlantı hatası')
    }
    setProcessingAction(null)
  }

  // ═══ QR KAMERA TARAMA FONKSİYONLARI ═══
  const onQrCodeScanned = useCallback(async (decodedText: string) => {
    const qrValue = decodedText.toUpperCase()
    if (qrValue.startsWith('TAKAS-') || qrValue.length > 10) {
      setIsScanning(false)
      await stopCamera()
      setTimeout(() => {
        if (qrScanSwapId) {
          handleScanQR(qrScanSwapId, qrValue)
        }
        setShowQrScanModal(false)
        setShowManualInput(false)
      }, 300)
    }
  }, [qrScanSwapId])

  const startCamera = async () => {
    setCameraError('')
    setIsScanning(true)
    setIsCameraActive(true)
    
    try {
      // Lazy load html5-qrcode modülü
      await loadQrScanner()
      
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState()
          if (state === Html5QrcodeScannerState.SCANNING) {
            await html5QrCodeRef.current.stop()
          }
        } catch {}
        html5QrCodeRef.current = null
      }
      
      await new Promise(resolve => setTimeout(resolve, 400))
      
      const container = document.getElementById(qrScannerContainerId)
      if (!container || container.offsetParent === null) {
        setCameraError('QR tarayıcı yüklenemedi. Sayfayı yenileyin.')
        setIsScanning(false)
        setIsCameraActive(false)
        return
      }
      
      html5QrCodeRef.current = new Html5Qrcode(qrScannerContainerId)
      
      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        setCameraError('Kamera bulunamadı. Kamera erişimini kontrol edin.')
        setIsScanning(false)
        setIsCameraActive(false)
        return
      }
      
      try {
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => onQrCodeScanned(decodedText),
          () => {}
        )
      } catch {
        const cameraId = devices[devices.length - 1]?.id || devices[0].id
        await html5QrCodeRef.current.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => onQrCodeScanned(decodedText),
          () => {}
        )
      }
    } catch (err: any) {
      setIsCameraActive(false)
      setIsScanning(false)
      if (err.name === 'NotAllowedError') {
        setCameraError('⚠️ Kamera izni verilmedi. Tarayıcı ayarlarından izin verin.')
      } else if (err.name === 'NotFoundError') {
        setCameraError('⚠️ Kamera bulunamadı.')
      } else {
        setCameraError(`Kamera başlatılamadı: ${err.message || 'Bilinmeyen hata'}`)
      }
    }
  }

  const stopCamera = async () => {
    setIsScanning(false)
    setIsCameraActive(false)
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await html5QrCodeRef.current.stop()
        }
      } catch {}
      html5QrCodeRef.current = null
    }
  }

  const openQrScanModal = (swapId: string) => {
    setQrScanSwapId(swapId)
    setCameraError('')
    setShowQrScanModal(true)
    setTimeout(() => startCamera(), 500)
  }

  // QR kamera cleanup
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState()
          if (state === Html5QrcodeScannerState.SCANNING) {
            html5QrCodeRef.current.stop().catch(() => {})
          }
        } catch {}
        html5QrCodeRef.current = null
      }
    }
  }, [])

  // ═══ TESLİMAT YÖNTEMİ FONKSİYONLARI ═══
  
  // Teslimat yöntemi seç (face_to_face veya drop_off)
  const setDeliveryTypeForSwap = async (swapId: string, type: 'face_to_face' | 'drop_off') => {
    setProcessingAction(swapId + '_delivery_type')
    try {
      const res = await fetch('/api/swap-requests/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId: swapId, action: 'set_delivery_type', deliveryType: type })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', type === 'face_to_face' 
          ? '🤝 Buluşma yöntemi seçildi' 
          : '📍 Teslim noktasına bırakma seçildi')
        fetchData()
      } else showNotification('error', data.error || 'Hata')
    } catch { showNotification('error', 'Bağlantı hatası') }
    setProcessingAction(null)
  }

  // Satıcı: Ürünü teslim noktasına bıraktı (drop_off yöntemi)
  const handleDropOff = async (swapId: string) => {
    setProcessingAction(swapId + '_dropoff')
    try {
      const res = await fetch('/api/swap-requests/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId: swapId, action: 'drop_off' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', '📦 Ürün bırakıldı! Alıcıya bildirim gönderildi.')
        fetchData()
      } else showNotification('error', data.error || 'Hata')
    } catch { showNotification('error', 'Bağlantı hatası') }
    setProcessingAction(null)
  }

  // Alıcı: Ürünü teslim noktasından aldı (drop_off yöntemi) — kod doğrulamalı
  const handlePickedUp = async (swapId: string) => {
    const code = verificationInput[swapId] || ''
    if (code.length !== 6) {
      showNotification('error', '6 haneli teslim kodunu girin')
      return
    }
    setProcessingAction(swapId + '_pickup')
    try {
      const res = await fetch('/api/swap-requests/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId: swapId, action: 'picked_up', code })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showNotification('success', '✅ Ürünü aldınız! Şimdi kontrol edin.')
        setVerificationInput(prev => ({ ...prev, [swapId]: '' }))
        fetchData()
      } else showNotification('error', data.error || 'Hata')
    } catch { showNotification('error', 'Bağlantı hatası') }
    setProcessingAction(null)
  }

  // ═══ ANLAŞMAZLIK (DISPUTE) FONKSİYONLARI ═══
  const openDisputeModal = (swapId: string) => {
    setDisputeSwapId(swapId)
    setDisputeType('')
    setDisputeDescription('')
    setDisputePhotos([])
    setShowDisputeModal(true)
  }

  const resetDisputeModal = () => {
    setShowDisputeModal(false)
    setDisputeSwapId(null)
    setDisputeType('')
    setDisputeDescription('')
    setDisputePhotos([])
    // GÖREV 46: Yeni alanları sıfırla
    setDisputeContactEmail('')
    setDisputeExpectedResolution('')
  }

  const handleDisputePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploadingDisputePhoto(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          showNotification('error', 'Fotoğraf 10MB\'dan küçük olmalı')
          continue
        }
        if (disputePhotos.length >= 5) break
        
        // Base64'e çevir
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        
        setDisputePhotos(prev => {
          if (prev.length >= 5) return prev
          return [...prev, base64]
        })
      }
    } catch {
      showNotification('error', 'Fotoğraf yüklenemedi')
    }
    setUploadingDisputePhoto(false)
    // Input'u sıfırla
    if (e.target) e.target.value = ''
  }

  const handleSubmitDispute = async () => {
    if (!disputeSwapId || !disputeType) return
    // GÖREV 46: Email zorunlu kontrolü
    if (!disputeContactEmail || !disputeContactEmail.includes('@')) {
      showNotification('error', '📧 Lütfen geçerli bir email adresi girin')
      return
    }
    // GÖREV 46: 50 karakter minimum
    if (disputeDescription.length < 50) {
      showNotification('error', 'Açıklama en az 50 karakter olmalı')
      return
    }
    // GÖREV 46: Beklenen çözüm zorunlu
    if (!disputeExpectedResolution) {
      showNotification('error', '✅ Lütfen beklenen çözümü seçin')
      return
    }
    // Fotoğraf opsiyonel hale geldi (görev 46)
    
    setDisputeSubmitting(true)
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: disputeSwapId,
          type: disputeType,
          description: disputeDescription,
          evidence: disputePhotos,
          // GÖREV 46: Yeni alanlar
          contactEmail: disputeContactEmail,
          disputeType: disputeType, // Aynı zamanda yeni field
          expectedResolution: disputeExpectedResolution,
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rapor gönderilemedi')
      
      showNotification('success', '⚠️ Anlaşmazlık bildirimi gönderildi. Admin ekibi en kısa sürede inceleyecek ve email ile bilgilendirileceksiniz.')
      resetDisputeModal()
      fetchData() // Listeyi yenile
    } catch (err: any) {
      showNotification('error', err.message)
    }
    setDisputeSubmitting(false)
  }

  // ═══ FOTOĞRAF YÜKLEME FONKSİYONLARI ═══
  // Fotoğraf yükle (presigned URL ile S3'e)
  const handlePhotoUpload = async (
    swapId: string, 
    type: 'packaging' | 'delivery' | 'receiving',
    files: FileList
  ) => {
    if (files.length === 0) return
    const key = `${swapId}_${type}`
    
    // Max 5 kontrol
    const current = pendingPhotos[key] || []
    if (current.length + files.length > 5) {
      showNotification('error', 'En fazla 5 fotoğraf yükleyebilirsiniz')
      return
    }
    
    setUploadingPhotos(true)
    const uploadedUrls: string[] = []
    
    // Görsel sıkıştırma fonksiyonu
    const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = document.createElement('img')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        img.onload = () => {
          const MAX_SIZE = 1200
          let { width, height } = img
          
          if (width > MAX_SIZE) { height = (height * MAX_SIZE) / width; width = MAX_SIZE }
          if (height > MAX_SIZE) { width = (width * MAX_SIZE) / height; height = MAX_SIZE }
          
          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)
          
          const base64 = canvas.toDataURL('image/jpeg', 0.8)
          URL.revokeObjectURL(img.src)
          resolve(base64)
        }
        img.onerror = () => reject(new Error('Görsel yüklenemedi'))
        img.src = URL.createObjectURL(file)
      })
    }
    
    try {
      for (const file of Array.from(files)) {
        // Dosya boyutu kontrolü (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          showNotification('error', 'Her fotoğraf max 10MB olabilir')
          continue
        }
        
        // Sıkıştır ve base64'e çevir
        const base64 = await compressImage(file)
        uploadedUrls.push(base64)
      }
      
      if (uploadedUrls.length > 0) {
        setPendingPhotos(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), ...uploadedUrls]
        }))
        showNotification('success', `📸 ${uploadedUrls.length} fotoğraf yüklendi`)
      }
    } catch (err) {
      console.error('Photo upload error:', err)
      showNotification('error', 'Fotoğraf yükleme hatası')
    }
    setUploadingPhotos(false)
  }

  // Fotoğrafları DB'ye kaydet
  const savePhotos = async (swapId: string, type: 'packaging' | 'delivery' | 'receiving') => {
    const key = `${swapId}_${type}`
    const photos = pendingPhotos[key]
    
    if (!photos || photos.length === 0) {
      return false
    }
    
    try {
      const res = await fetch('/api/swap-requests/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: swapId,
          photoType: type,
          photos,
        })
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Fotoğraf Yükleme UI Bileşeni
  const PhotoUploadSection = ({ 
    swapId, 
    type, 
    title, 
    description,
    required = true 
  }: { 
    swapId: string
    type: 'packaging' | 'delivery' | 'receiving'
    title: string
    description: string
    required?: boolean
  }) => {
    const key = `${swapId}_${type}`
    const photos = pendingPhotos[key] || []
    
    return (
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-800">
            📸 {title} {required && <span className="text-red-500">*</span>}
          </p>
          <span className="text-[10px] text-gray-500">{photos.length}/5</span>
        </div>
        <p className="text-[10px] text-gray-500">{description}</p>
        
        {/* Yüklenen fotoğraflar önizleme */}
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setPendingPhotos(prev => ({
                      ...prev,
                      [key]: prev[key].filter((_, i) => i !== idx)
                    }))
                  }}
                  className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Yükleme butonu */}
        {photos.length < 5 && (
          <label className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            uploadingPhotos ? 'border-gray-300 bg-gray-100' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
          }`}>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handlePhotoUpload(swapId, type, e.target.files)
                e.target.value = '' // Reset input
              }}
              disabled={uploadingPhotos}
            />
            {uploadingPhotos ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <span className="text-xs text-blue-600 font-medium">📷 Fotoğraf Çek / Seç</span>
            )}
          </label>
        )}
        
        {photos.length > 0 && (
          <p className="text-[10px] text-green-600 text-center font-medium">
            ✅ {photos.length} fotoğraf hazır
          </p>
        )}
      </div>
    )
  }

  const handleCreateMultiSwap = async (participants: SwapParticipant[]) => {
    setCreatingSwap(true)
    try {
      const { data, error } = await safeFetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', participants }),
      })

      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', 'Çoklu takas oluşturuldu! Katılımcıların onayı bekleniyor.')
        await fetchData()
      }
    } catch (error) {
      showNotification('error', 'Takas oluşturulurken hata oluştu')
    } finally {
      setCreatingSwap(false)
    }
  }

  const handleConfirmSwap = async (multiSwapId: string) => {
    setConfirmingSwap(multiSwapId)
    try {
      const { data, error } = await safeFetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', multiSwapId }),
      })

      if (error) {
        showNotification('error', error)
      } else {
        playSuccessSound()
        showNotification('success', data?.message || 'Onay verildi!')
        await fetchData()
      }
    } catch (error) {
      showNotification('error', 'Onay gönderilirken hata oluştu')
    } finally {
      setConfirmingSwap(null)
    }
  }

  const handleRejectSwap = (multiSwapId: string) => {
    setShowRejectModal(multiSwapId)
    setRejectReason('')
  }

  const confirmRejectSwap = async () => {
    if (!showRejectModal) return
    
    setRejectingSwap(showRejectModal)
    try {
      const { data, error } = await safeFetch('/api/multi-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject', 
          multiSwapId: showRejectModal,
          reason: rejectReason || undefined
        }),
      })

      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', data?.message || 'Takas reddedildi')
        await fetchData()
        setShowRejectModal(null)
        setRejectReason('')
      }
    } catch (error) {
      showNotification('error', 'Red işlemi sırasında hata oluştu')
    } finally {
      setRejectingSwap(null)
    }
  }

  // Status badge helper function (sadeleştirilmiş akış)
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      // Ana akış (4 adım)
      pending:            { label: 'Teklif Gönderildi',           color: 'bg-yellow-100 text-yellow-700' },
      accepted:           { label: 'Anlaşma Sağlandı',            color: 'bg-green-100 text-green-700' },
      awaiting_delivery:  { label: 'Teslimat Bekliyor',           color: 'bg-blue-100 text-blue-700' },
      completed:          { label: 'Takas Tamamlandı',            color: 'bg-emerald-100 text-emerald-700' },
      // Özel durumlar
      disputed:           { label: 'Sorun Bildirildi',            color: 'bg-red-100 text-red-700' },
      rejected:           { label: 'Reddedildi',                  color: 'bg-red-100 text-red-700' },
      cancelled:          { label: 'İptal Edildi',                color: 'bg-gray-100 text-gray-700' },
      expired:            { label: 'Süresi Doldu',                color: 'bg-gray-100 text-gray-700' },
      auto_cancelled:     { label: 'Otomatik İptal',              color: 'bg-gray-100 text-gray-700' },
    }
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }
  
  // ═══ GÖREV 13: 48 Saat Geçmiş Pending Teklif Kontrolü ═══
  const isPendingExpired = (createdAt: string, status: string) => {
    if (status !== 'pending') return false
    const created = new Date(createdAt)
    const now = new Date()
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return hoursElapsed >= 48
  }
  
  const getPendingExpiryInfo = (createdAt: string, status: string) => {
    if (status !== 'pending') return { isExpired: false, hoursRemaining: 0 }
    const created = new Date(createdAt)
    const now = new Date()
    const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    const hoursRemaining = Math.max(0, 48 - hoursElapsed)
    return {
      isExpired: hoursElapsed >= 48,
      hoursRemaining: Math.floor(hoursRemaining),
      hoursElapsed: Math.floor(hoursElapsed)
    }
  }

  // ═══ TESLİM TARİHİ HELPER FONKSİYONLARI (GÖREV 8) ═══
  
  // Teslim tarihi geçmiş mi ve kaç saat geçmiş kontrol et
  const getDeliveryDateStatus = (swap: PendingSwapRequest) => {
    if (!swap.scheduledDeliveryDate || !swap.deliveryDateAcceptedBy) {
      return { isOverdue: false, hoursOverdue: 0, isPending: !!swap.deliveryDateProposedBy && !swap.deliveryDateAcceptedBy }
    }
    
    const scheduledDate = new Date(swap.scheduledDeliveryDate)
    const now = new Date()
    const diffMs = now.getTime() - scheduledDate.getTime()
    const hoursOverdue = Math.floor(diffMs / (1000 * 60 * 60))
    
    return {
      isOverdue: hoursOverdue >= 6,
      isCritical: hoursOverdue >= 24,
      hoursOverdue,
      isPending: false
    }
  }
  
  // Teslim tarihi öner
  const handleProposeDeliveryDate = async (swapId: string, proposedDate: string) => {
    setDeliveryDateLoading(true)
    try {
      const { data, error } = await safeFetch('/api/swap-requests/delivery-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, action: 'propose', proposedDate }),
      })
      
      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', 'Teslim tarihi önerisi gönderildi!')
        setShowDeliveryDateModal(false)
        setProposedDeliveryDate('')
        await fetchData()
      }
    } catch (err) {
      showNotification('error', 'Teslim tarihi önerilirken hata oluştu')
    } finally {
      setDeliveryDateLoading(false)
    }
  }
  
  // Teslim tarihi kabul et
  const handleAcceptDeliveryDate = async (swapId: string) => {
    setDeliveryDateLoading(true)
    try {
      const { data, error } = await safeFetch('/api/swap-requests/delivery-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, action: 'accept' }),
      })
      
      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', 'Teslim tarihi kabul edildi!')
        await fetchData()
      }
    } catch (err) {
      showNotification('error', 'Teslim tarihi kabul edilirken hata oluştu')
    } finally {
      setDeliveryDateLoading(false)
    }
  }
  
  // Teslim tarihi reddet
  const handleRejectDeliveryDate = async (swapId: string) => {
    setDeliveryDateLoading(true)
    try {
      const { data, error } = await safeFetch('/api/swap-requests/delivery-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, action: 'reject' }),
      })
      
      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', 'Teslim tarihi önerisi reddedildi')
        await fetchData()
      }
    } catch (err) {
      showNotification('error', 'Teslim tarihi reddedilirken hata oluştu')
    } finally {
      setDeliveryDateLoading(false)
    }
  }
  
  // ═══ GÖREV 14: Takas İptal Modal'ı Aç ═══
  const openCancelModal = (swapId: string, status: string = '') => {
    setCancelSwapId(swapId)
    setCancelSwapStatus(status)
    setSelectedCancelReason('')
    setCustomCancelReason('')
    setShowCancelModal(true)
  }
  
  // ═══ GÖREV 14: Takas İptal Et (Modal Submit) ═══
  const handleCancelSwap = async (swapId: string) => {
    // Eğer modal açık değilse modal aç
    if (!showCancelModal) {
      openCancelModal(swapId)
      return
    }
    
    // Modal'dan onay ile iptal
    if (!selectedCancelReason) {
      showNotification('error', 'Lütfen iptal nedenini seçin')
      return
    }
    
    setCancelLoading(true)
    try {
      const { data, error } = await safeFetch('/api/swap-requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          swapId: cancelSwapId || swapId, 
          reason: selectedCancelReason,
          customReason: selectedCancelReason === 'other' ? customCancelReason : undefined
        }),
      })
      
      if (error) {
        showNotification('error', error)
      } else {
        showNotification('success', '✅ Takas iptal edildi')
        setShowCancelModal(false)
        setCancelSwapId(null)
        setSelectedCancelReason('')
        setCustomCancelReason('')
        await fetchData()
      }
    } catch (err) {
      showNotification('error', 'Takas iptal edilirken hata oluştu')
    } finally {
      setCancelLoading(false)
    }
  }
  
  // ═══ GÖREV 14: Hızlı İptal (Banner'dan confirm ile) ═══
  const handleQuickCancelSwap = async (swapId: string) => {
    openCancelModal(swapId, 'quick')
  }

  const handleUpdateRequest = async (requestId: string, newStatus: string) => {
    try {
      const { data, error } = await safeFetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, status: newStatus }),
      })

      if (error) {
        showNotification('error', error)
      } else {
        if (newStatus === 'accepted') {
          playSuccessSound()
        }
        showNotification('success', newStatus === 'accepted' ? 'Talep kabul edildi!' : 'Talep reddedildi.')
        await fetchData()
      }
    } catch (error) {
      showNotification('error', 'İşlem sırasında hata oluştu')
    }
  }

  // ═══ MobileSwapActionBar — Mobil Aksiyon Handler ═══
  const handleMobileSwapAction = async (action: string, swapId: string) => {
    switch (action) {
      case 'accept':
        handleUpdateRequest(swapId, 'accepted')
        break
      case 'reject':
        handleUpdateRequest(swapId, 'rejected')
        break
      case 'cancel':
        handleCancelSwap(swapId)
        break
      case 'delivery':
        setDeliverySwapId(swapId)
        break
      case 'confirm_delivery':
        acceptDeliveryProposal(swapId)
        break
      case 'counter':
        // TODO: handleCounterOffer — karşı teklif akışı henüz mevcut değil
        showNotification('success', 'Karşı teklif özelliği yakında aktif olacak')
        break
      case 'qr_verify':
        // TODO: handleQRVerify — QR doğrulama akışı ayrı component'te
        showNotification('success', 'QR doğrulama için yukarıdaki paneli kullanın')
        break
      case 'history':
        router.push('/profil?tab=swapHistory')
        break
      default:
        console.warn('[MobileSwapActionBar] Unhandled action:', action)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-frozen-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Tamamlanan, iptal edilen ve süre aşımı teklifleri "Teklifler" sekmesinden filtrele
  // Bu teklifler sadece "Tamamlanan" sekmesinde görünecek (GÖREV 23)
  const hiddenStatuses = ['completed', 'cancelled', 'expired', 'auto_cancelled']
  const visibleReceivedRequests = receivedRequests.filter(r => !hiddenStatuses.includes(r.status))
  const visibleSentRequests = sentRequests.filter(r => !hiddenStatuses.includes(r.status))
  const pendingReceivedCount = visibleReceivedRequests.filter(r => r.status === 'pending').length
  
  // ═══ GELEN/GİDEN FİLTRESİ HESAPLAMALARI (GÖREV 19) ═══
  const incomingCount = visibleReceivedRequests.length
  const outgoingCount = visibleSentRequests.length
  
  // Filtrelenmiş teklifler
  const filteredReceivedRequests = offerFilter === 'outgoing' ? [] : visibleReceivedRequests
  const filteredSentRequests = offerFilter === 'incoming' ? [] : visibleSentRequests

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-purple-50/30 pt-20 pb-12">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Takası Reddet</h3>
              </div>
              
              <p className="text-gray-400 text-sm mb-4">
                Bu takası reddettiğinizde tüm zincir iptal edilecek ve diğer katılımcılara bildirim gönderilecektir.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Red Nedeni (İsteğe Bağlı)
                </label>
                <div className="space-y-2">
                  {rejectionReasons.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        rejectReason === reason.label
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        value={reason.label}
                        checked={rejectReason === reason.label}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmRejectSwap}
                  disabled={rejectingSwap === showRejectModal}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {rejectingSwap === showRejectModal ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Reddediliyor...</>
                  ) : (
                    <><X className="w-5 h-5" /> Reddet</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6 text-white" />
              </div>
              {language === 'tr' ? '🔄 Takas Merkezi' : '🔄 Swap Center'}
            </h1>
            <p className="text-gray-400 mt-2">{language === 'tr' ? 'Tüm takas işlemlerinizi tek merkezden yönetin' : 'Manage all your swap transactions from one place'}</p>
            {swapStats && (
              <div className="flex gap-3 mt-3">
                <div className="px-3 py-1.5 bg-purple-100 rounded-lg">
                  <span className="text-purple-600 text-xs">Aktif İlgi: </span>
                  <span className="text-purple-700 font-bold text-sm">
                    {swapStats.totalFound || 0}
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xs">Dengeli: </span>
                  <span className="text-green-700 font-bold text-sm">
                    {swapStats.balanced || 0}
                  </span>
                </div>
              </div>
            )}
            {/* Günlük Teklif Limiti Bilgisi (GÖREV 15) */}
            {dailyLimit && (
              <div className={`flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg ${
                dailyLimit.isVip
                  ? 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30'
                  : dailyLimit.remaining === 0
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                {dailyLimit.isVip ? (
                  <span className="text-amber-700 dark:text-amber-300 text-xs font-medium">
                    ⭐ VIP — Sınırsız teklif hakkı
                  </span>
                ) : (
                  <span className={`text-xs font-medium ${
                    dailyLimit.remaining === 0 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    📊 Bugün: {dailyLimit.used}/{dailyLimit.limit} teklif
                    {dailyLimit.remaining > 0 && (
                      <span className="ml-1 text-green-600 dark:text-green-400">
                        ({dailyLimit.remaining} hak kaldı)
                      </span>
                    )}
                    {dailyLimit.remaining === 0 && (
                      <span className="ml-1">— Yarın yenilenir</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        {/* ═══ SEKMELER - MOBİL UYUMLU GRİD (GÖREV 18/22) ═══ */}
        
        {/* Mobil: 2x2 Grid düzeni (4 sekme) */}
        <div className="grid grid-cols-2 gap-2 mb-6 md:hidden">
          <button
            onClick={() => setActiveTab('requests')}
            className={`p-3 rounded-xl text-center text-sm font-medium transition-all flex flex-col items-center gap-1 ${
              activeTab === 'requests'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>{t('offers')}</span>
            {pendingReceivedCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'requests' ? 'bg-white/20' : 'bg-red-500 text-white'
              }`}>
                {pendingReceivedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`p-3 rounded-xl text-center text-sm font-medium transition-all flex flex-col items-center gap-1 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Aktif</span>
            {(activeSwaps.length + activeDirectSwaps.length) > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'active' ? 'bg-white/20' : 'bg-purple-500 text-white'
              }`}>
                {activeSwaps.length + activeDirectSwaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`p-3 rounded-xl text-center text-sm font-medium transition-all flex flex-col items-center gap-1 ${
              activeTab === 'completed'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{t('completedTab')}</span>
            {completedSwaps.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'completed' ? 'bg-white/20' : 'bg-green-500 text-white'
              }`}>
                {completedSwaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`p-3 rounded-xl text-center text-sm font-medium transition-all flex flex-col items-center gap-1 ${
              activeTab === 'opportunities'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Çoklu</span>
            {opportunities.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'opportunities' ? 'bg-white/20' : 'bg-green-500 text-white'
              }`}>
                {opportunities.length}
              </span>
            )}
          </button>
        </div>

        {/* Masaüstü: Normal tab bar */}
        <div className="hidden md:flex gap-2 mb-8 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>{t('offers')}</span>
            {pendingReceivedCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'requests' ? 'bg-white/20' : 'bg-red-500 text-white'
              }`}>
                {pendingReceivedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>{t('activeSwaps')}</span>
            {(activeSwaps.length + activeDirectSwaps.length) > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'active' ? 'bg-white/20' : 'bg-purple-500 text-white'
              }`}>
                {activeSwaps.length + activeDirectSwaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                : 'text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{t('completedTab')}</span>
            {completedSwaps.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'completed' ? 'bg-white/20' : 'bg-green-500 text-white'
              }`}>
                {completedSwaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'opportunities'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                : 'text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>{t('multiSwapTab')}</span>
            {opportunities.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'opportunities' ? 'bg-white/20' : 'bg-green-500 text-white'
              }`}>
                {opportunities.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* ═══ GELEN/GİDEN FİLTRE PİLLERİ (GÖREV 19) ═══ */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button 
                  onClick={() => setOfferFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    offerFilter === 'all' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('filterAllOffers')} ({incomingCount + outgoingCount})
                </button>
                <button 
                  onClick={() => setOfferFilter('incoming')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    offerFilter === 'incoming' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('filterIncoming')} {incomingCount > 0 && `(${incomingCount})`}
                </button>
                <button 
                  onClick={() => setOfferFilter('outgoing')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    offerFilter === 'outgoing' 
                      ? 'bg-orange-600 text-white shadow-md' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('filterOutgoing')} {outgoingCount > 0 && `(${outgoingCount})`}
                </button>
              </div>

              {/* BİLGİLENDİRME NOTU - GÖREV 25 */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ℹ️ Teklifler sekmesi takas işleminin ilk aşamasıdır. Takas süreci, teklif kabul edildikten sonra <strong>Aktif Takaslar</strong> sekmesinden devam ettirilmelidir.
                </p>
              </div>

              {/* Received Requests - Gelen Teklifler */}
              {offerFilter !== 'outgoing' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  {t('incomingRequests')}
                  <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">{t('incomingOfferBadge')}</span>
                </h2>
                {filteredReceivedRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-400">{t('noIncomingRequests')}</p>
                    <Link href="/urunler" className="inline-flex items-center gap-2 mt-4 text-purple-600 font-medium hover:underline">
                      {t('browseProducts')} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReceivedRequests.map((request: any) => (
                      <motion.div
                        key={request.id}
                        ref={request.id === selectedSwapData?.id ? selectedSwapRef : null}
                        layout
                        className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${
                          request.status === 'pending' ? 'border-purple-200' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {request.product.images?.[0] ? (
                              <Image src={request.product.images[0]} alt="" fill className="object-cover" />
                            ) : (
                              <Package className="w-8 h-8 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm text-gray-400">Ürününüz için talep:</p>
                                <Link href={`/urun/${request.product.id}`} className="font-semibold text-gray-900 hover:text-purple-600">
                                  {request.product.title}
                                </Link>
                                <p className="text-sm text-gray-400 mt-1">
                                  <span className="font-medium">{request.requester.name || 'Kullanıcı'}</span> ilgi bildirdi
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelectSwap(request)
                                    setShowChatPanel(true)
                                  }}
                                  className="p-1.5 rounded-full bg-frozen-100 text-frozen-600 hover:bg-frozen-200 transition-colors"
                                  title="Mesajlaş"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(request.status).color}`}>
                                  {getStatusInfo(request.status).label}
                                </span>
                              </div>
                            </div>
                            {/* BUG 3 FIX: Valor teklifi bilgisini göster */}
                            {request.offeredProduct ? (
                              <div className="mt-3 p-3 bg-purple-50 rounded-xl">
                                <p className="text-xs text-purple-600 font-medium mb-1">🔄 Ürüne karşı ürün teklifi:</p>
                                <Link href={`/urun/${request.offeredProduct.id}`} className="text-sm font-medium text-gray-900 hover:text-purple-600">
                                  {request.offeredProduct.title} ({request.offeredProduct.valorPrice} Valor)
                                </Link>
                                {/* BUG #1 FIX: VALOR farkını hesapla ve göster */}
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <span className="text-gray-400">
                                    Sizin ürününüz: {request.product.valorPrice} V
                                  </span>
                                  <span className="font-medium">
                                    {(() => {
                                      const diff = request.offeredProduct.valorPrice - request.product.valorPrice
                                      if (diff > 0) return <span className="text-green-600">+{diff} V lehine</span>
                                      if (diff < 0) return <span className="text-orange-600">{diff} V</span>
                                      return <span className="text-gray-400">Eşit değer</span>
                                    })()}
                                  </span>
                                </div>
                              </div>
                            ) : request.pendingValorAmount && request.pendingValorAmount > 0 ? (
                              <div className="mt-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">💎</span>
                                  <p className="text-sm font-bold text-amber-800">Valor Teklifi</p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-2xl font-bold text-amber-600">{request.pendingValorAmount.toLocaleString('tr-TR')} VALOR</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Ürün değeri: {request.product.valorPrice.toLocaleString('tr-TR')} Valor
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {request.pendingValorAmount >= request.product.valorPrice ? (
                                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        ✅ %{Math.round((request.pendingValorAmount / request.product.valorPrice) * 100)} değerinde
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                        %{Math.round((request.pendingValorAmount / request.product.valorPrice) * 100)} değerinde
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {request.message && (
                              <p className="text-sm text-gray-400 mt-2 italic">"{request.message}"</p>
                            )}
                            {request.status === 'pending' && (
                              <div className="flex gap-2 mt-4">
                                <button
                                  onClick={() => handleUpdateRequest(request.id, 'accepted')}
                                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                                >
                                  <Check className="w-4 h-4" /> Kabul Et
                                </button>
                                <button
                                  onClick={() => handleUpdateRequest(request.id, 'rejected')}
                                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 transition-colors"
                                >
                                  <X className="w-4 h-4" /> Reddet
                                </button>
                              </div>
                            )}

                            {/* ACCEPTED - Her iki taraf teslimat noktası önerebilir */}
                            {request.status === 'accepted' && (
                              <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
                                <p className="text-sm text-green-700 mb-2">✅ Teklif kabul edildi!</p>
                                <button
                                  onClick={() => {
                                    setDeliverySwapId(request.id)
                                    setDeliveryAction('propose')
                                    setShowDeliveryModal(true)
                                    fetchDeliveryPoints()
                                  }}
                                  className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                >
                                  <MapPin className="w-4 h-4" />
                                  📍 Teslimat Noktası Öner
                                </button>
                              </div>
                            )}

                            {/* DELIVERY_PROPOSED - Onayla/Karşı Öneri */}
                            {request.status === 'delivery_proposed' && (
                              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <MapPin className="w-4 h-4 text-blue-600" />
                                  <p className="text-sm font-medium text-blue-800">Teslimat Noktası Önerisi</p>
                                </div>
                                {request.customLocation && (
                                  <p className="text-xs text-blue-700 mb-2">📍 {request.customLocation}</p>
                                )}
                                {request.deliveryPoint && (
                                  <p className="text-xs text-blue-700 mb-2">📍 {request.deliveryPoint.name}</p>
                                )}
                                
                                {/* Kendi önerisini onaylayamaz kontrolü */}
                                {request.lastProposedBy === currentUserId ? (
                                  <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                    <p className="text-xs text-amber-700">⏳ Karşı tarafın yanıtını bekliyorsunuz. Kendi önerinizi onaylayamazsınız.</p>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => acceptDeliveryProposal(request.id)}
                                      disabled={deliveryLoading}
                                      className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {deliveryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                      Onayla
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeliverySwapId(request.id)
                                        setDeliveryAction('counter')
                                        setShowDeliveryModal(true)
                                        fetchDeliveryPoints()
                                      }}
                                      className="flex-1 py-2 border border-blue-300 text-blue-600 rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                                    >
                                      <MapPin className="w-4 h-4" />
                                      Farklı Yer Öner
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* QR_GENERATED - QR Kod Göster */}
                            {request.status === 'qr_generated' && (
                              <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                                  <p className="text-sm font-medium text-indigo-800">QR Kod Hazır</p>
                                </div>
                                <p className="text-xs text-indigo-600 mb-2">Belirlenen noktada buluşun. QR kodu taratarak teslimatı başlatın.</p>
                                {request.qrCode && (
                                  <div className="p-2 bg-white rounded-lg text-center">
                                    <QRCodeSVG value={request.qrCode} size={96} level="H" includeMargin={true} />
                                    <p className="text-[10px] text-gray-500 mt-1 font-mono">{request.qrCode}</p>
                                  </div>
                                )}
                                {request.customLocation && (
                                  <p className="text-xs text-indigo-600 mt-2">📍 {request.customLocation}</p>
                                )}
                              </div>
                            )}

                            {/* ═══ GÖREV 14: İptal Butonu (Alınan Teklifler - Pending hariç) ═══ */}
                            {['accepted', 'awaiting_delivery'].includes(request.status) && (
                              <button
                                onClick={() => openCancelModal(request.id, request.status)}
                                className="w-full mt-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-red-200 transition-colors"
                              >
                                ❌ Takası İptal Et
                              </button>
                            )}

                            {/* 💬 Mesajlar Butonu ve Inline Chat */}
                            <button
                              onClick={() => {
                                setOpenChatId(openChatId === request.id ? null : request.id)
                                if (openChatId !== request.id) {
                                  setUnreadCounts(prev => ({ ...prev, [request.id]: 0 }))
                                }
                              }}
                              className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 relative"
                            >
                              💬 Mesajlar
                              {unreadCounts[request.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                  {unreadCounts[request.id] > 99 ? '99+' : unreadCounts[request.id]}
                                </span>
                              )}
                            </button>

                            {openChatId === request.id && (
                              <div className="mt-3">
                                <SwapChat
                                  swapRequestId={request.id}
                                  otherUserId={request.requesterId === currentUserId ? request.ownerId : request.requesterId}
                                  otherUserName={request.requesterId === currentUserId ? request.product.user?.name : request.requester?.name}
                                  otherUserImage={request.requesterId === currentUserId ? (request.owner?.image || request.product?.user?.image) : request.requester?.image}
                                  productTitle={request.product?.title}
                                  status={request.status}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Sent Requests - Giden Teklifler */}
              {offerFilter !== 'incoming' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  {t('sentRequests')}
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs rounded-full">{t('outgoingOfferBadge')}</span>
                </h2>
                {filteredSentRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-400">{t('noSentRequests')}</p>
                    <Link href="/urunler" className="inline-flex items-center gap-2 mt-4 text-purple-600 font-medium hover:underline">
                      {t('browseProducts')} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSentRequests.map((request: any) => (
                      <div key={request.id} ref={request.id === selectedSwapData?.id ? selectedSwapRef : null} className="bg-white rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {request.product.images?.[0] ? (
                              <Image src={request.product.images[0]} alt="" fill className="object-cover" />
                            ) : (
                              <Package className="w-8 h-8 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm text-gray-400">İlgilendiğiniz ürün:</p>
                                <Link href={`/urun/${request.product.id}`} className="font-semibold text-gray-900 hover:text-purple-600">
                                  {request.product.title}
                                </Link>
                                <p className="text-sm text-purple-600 font-medium">{request.product.valorPrice} Valor</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelectSwap(request)
                                    setShowChatPanel(true)
                                  }}
                                  className="p-1.5 rounded-full bg-frozen-100 text-frozen-600 hover:bg-frozen-200 transition-colors"
                                  title="Mesajlaş"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(request.status).color}`}>
                                  {getStatusInfo(request.status).label}
                                </span>
                              </div>
                            </div>

                            {/* Gönderilen talep için durumlar - Her iki taraf teslimat noktası önerebilir */}
                            {request.status === 'accepted' && (
                              <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                                <p className="text-xs text-green-700 mb-2">✅ Kabul edildi!</p>
                                <button
                                  onClick={() => {
                                    setDeliverySwapId(request.id)
                                    setDeliveryAction('propose')
                                    setShowDeliveryModal(true)
                                    fetchDeliveryPoints()
                                  }}
                                  className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                >
                                  <MapPin className="w-4 h-4" />
                                  📍 Teslimat Noktası Öner
                                </button>
                              </div>
                            )}

                            {request.status === 'delivery_proposed' && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <MapPin className="w-4 h-4 text-blue-600" />
                                  <p className="text-sm font-medium text-blue-800">Teslimat Noktası Önerisi</p>
                                </div>
                                {request.customLocation && (
                                  <p className="text-xs text-blue-700 mb-2">📍 {request.customLocation}</p>
                                )}
                                {request.deliveryPoint && (
                                  <p className="text-xs text-blue-700 mb-2">📍 {request.deliveryPoint.name}</p>
                                )}
                                
                                {/* Kendi önerisini onaylayamaz kontrolü */}
                                {request.lastProposedBy === currentUserId ? (
                                  <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                    <p className="text-xs text-amber-700">⏳ Karşı tarafın yanıtını bekliyorsunuz. Kendi önerinizi onaylayamazsınız.</p>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => acceptDeliveryProposal(request.id)}
                                      disabled={deliveryLoading}
                                      className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {deliveryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                      Onayla
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeliverySwapId(request.id)
                                        setDeliveryAction('counter')
                                        setShowDeliveryModal(true)
                                        fetchDeliveryPoints()
                                      }}
                                      className="flex-1 py-2 border border-blue-300 text-blue-600 rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                                    >
                                      <MapPin className="w-4 h-4" />
                                      Farklı Yer
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {request.status === 'qr_generated' && (
                              <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                                  <p className="text-sm font-medium text-indigo-800">QR Kod Hazır</p>
                                </div>
                                <p className="text-xs text-indigo-600 mb-2">Belirlenen noktada buluşun. QR kodu taratarak teslimatı başlatın.</p>
                                {request.qrCode && (
                                  <div className="p-2 bg-white rounded-lg text-center">
                                    <QRCodeSVG value={request.qrCode} size={96} level="H" includeMargin={true} />
                                    <p className="text-[10px] text-gray-500 mt-1 font-mono">{request.qrCode}</p>
                                  </div>
                                )}
                                {request.customLocation && (
                                  <p className="text-xs text-indigo-600 mt-2">📍 {request.customLocation}</p>
                                )}
                              </div>
                            )}

                            {/* ═══ GÖREV 14: İptal Butonu (Gönderilen Teklifler) ═══ */}
                            {['pending', 'accepted', 'awaiting_delivery'].includes(request.status) && (
                              <button
                                onClick={() => openCancelModal(request.id, request.status)}
                                className="w-full mt-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-red-200 transition-colors"
                              >
                                ❌ {request.status === 'pending' ? 'Teklifi Geri Çek' : 'Takası İptal Et'}
                              </button>
                            )}

                            {/* 💬 Mesajlar Butonu ve Inline Chat */}
                            <button
                              onClick={() => {
                                setOpenChatId(openChatId === request.id ? null : request.id)
                                if (openChatId !== request.id) {
                                  setUnreadCounts(prev => ({ ...prev, [request.id]: 0 }))
                                }
                              }}
                              className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 relative"
                            >
                              💬 Mesajlar
                              {unreadCounts[request.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                  {unreadCounts[request.id] > 99 ? '99+' : unreadCounts[request.id]}
                                </span>
                              )}
                            </button>

                            {openChatId === request.id && (
                              <div className="mt-3">
                                <SwapChat
                                  swapRequestId={request.id}
                                  otherUserId={request.requesterId === currentUserId ? request.ownerId : request.requesterId}
                                  otherUserName={request.requesterId === currentUserId ? request.product.user?.name : request.requester?.name}
                                  otherUserImage={request.requesterId === currentUserId ? (request.owner?.image || request.product?.user?.image) : request.requester?.image}
                                  productTitle={request.product?.title}
                                  status={request.status}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

                {/* ═══ MESAJLAŞMA PANELİ — TEKLİFLER İÇİN ═══ */}
                {selectedSwapId && selectedSwapData && showChatPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-6 bg-white rounded-2xl shadow-lg border-2 border-frozen-200 overflow-hidden"
                  >
                    <div className="p-4 bg-gradient-to-r from-frozen-500 to-blue-500 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5" />
                        <div>
                          <p className="font-semibold text-sm">Takas Mesajlaşması</p>
                          <p className="text-xs text-white/80">{selectedSwapData.product.title}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowChatPanel(false)}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <SwapChat
                      swapRequestId={selectedSwapId}
                      otherUserId={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requesterId : selectedSwapData.ownerId}
                      otherUserName={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requester.name : selectedSwapData.product.user.name}
                      otherUserImage={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requester?.image : (selectedSwapData.owner?.image || selectedSwapData.product?.user?.image)}
                      productTitle={selectedSwapData.product?.title}
                      status={selectedSwapData.status}
                      className="max-h-[400px]"
                    />
                  </motion.div>
                )}
            </motion.div>
          )}

          {activeTab === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Aktif 1-1 Takaslar */}
              {activeDirectSwaps.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-500" />
                    Aktif Takaslar ({activeDirectSwaps.length})
                  </h2>
                  {activeDirectSwaps.map((swap) => {
                    const amIOwner = swap.ownerId === currentUserId
                    const otherUser = amIOwner ? swap.requester : swap.product.user
                    const statusInfo = getStatusInfo(swap.status)
                    const swapSteps = getSwapSteps(swap.deliveryType)
                    const currentStep = getStepIndex(swap.status, swap.deliveryType)
                    const deliveryDateStatus = getDeliveryDateStatus(swap)
                    
                    return (
                      <div 
                        key={swap.id}
                        ref={swap.id === selectedSwapData?.id ? selectedSwapRef : null}
                        className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border-2 transition-all cursor-pointer ${
                          selectedSwapId === swap.id 
                            ? 'border-frozen-500 ring-2 ring-frozen-200' 
                            : deliveryDateStatus.isCritical
                              ? 'border-red-300 hover:border-red-400'
                              : deliveryDateStatus.isOverdue
                                ? 'border-yellow-300 hover:border-yellow-400'
                                : 'border-green-100 hover:border-green-300'
                        }`}
                        onClick={() => handleSelectSwap(swap)}
                      >
                        {/* ═══ TESLİM TARİHİ UYARI BANNERLARI (GÖREV 8, 10) ═══ */}
                        
                        {/* 24 saat+ geçmiş - KRİTİK UYARI (GÖREV 10) */}
                        {deliveryDateStatus.isCritical && (
                          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                                  🔴 Teslim tarihi {deliveryDateStatus.hoursOverdue} saattir geçmiş!
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  Acil aksiyon gerekli. Lütfen takası iptal edin veya yeni teslim tarihi belirleyin.
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeliveryDateSwapId(swap.id)
                                      setShowDeliveryDateModal(true)
                                    }}
                                    className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    📅 Teslim Tarihini Güncelle
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openCancelModal(swap.id, swap.status)
                                    }}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    ❌ Takası İptal Et
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* 6-24 saat geçmiş - SARI UYARI (GÖREV 8) */}
                        {deliveryDateStatus.isOverdue && !deliveryDateStatus.isCritical && (
                          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                                  ⚠️ Teslim tarihi geçti! ({deliveryDateStatus.hoursOverdue} saat)
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                  Lütfen yeni tarih belirleyin veya takası iptal edin.
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeliveryDateSwapId(swap.id)
                                      setShowDeliveryDateModal(true)
                                    }}
                                    className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    📅 Teslim Tarihini Güncelle
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openCancelModal(swap.id, swap.status)
                                    }}
                                    className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    ❌ Takas İptal Et
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Teslim tarihi önerisi bekliyor */}
                        {deliveryDateStatus.isPending && swap.deliveryDateProposedBy !== currentUserId && (
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                            <div className="flex items-start gap-2">
                              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                  📅 Yeni teslim tarihi önerisi var!
                                </p>
                                {swap.scheduledDeliveryDate && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Önerilen: {new Date(swap.scheduledDeliveryDate).toLocaleDateString('tr-TR', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAcceptDeliveryDate(swap.id)
                                    }}
                                    disabled={deliveryDateLoading}
                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    ✅ Kabul Et
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRejectDeliveryDate(swap.id)
                                    }}
                                    disabled={deliveryDateLoading}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    ❌ Reddet
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-4">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {swap.product.images?.[0] ? (
                              <Image src={swap.product.images[0]} alt="" fill className="object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{swap.product.title}</p>
                                <p className="text-xs text-gray-400">
                                  {amIOwner ? 'Alıcı' : 'Satıcı'}: {otherUser?.name || 'Kullanıcı'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelectSwap(swap)
                                    setShowChatPanel(true)
                                  }}
                                  className="p-1.5 rounded-full bg-frozen-100 text-frozen-600 hover:bg-frozen-200 transition-colors"
                                  title="Mesajlaş"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                            </div>

                            {/* ═══ TAKAS ADIMLARI TİMELINE — 5×2 GRİD ═══ */}
                            {currentStep >= 0 && (
                              <div className="mt-3 mb-2">
                                {/* Teslimat yöntemi göstergesi */}
                                {swap.deliveryType && (
                                  <div className="mb-2 text-center">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                      swap.deliveryType === 'drop_off' 
                                        ? 'bg-orange-100 text-orange-700' 
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {swap.deliveryType === 'drop_off' ? '📍 Teslim Noktasına Bırakma' : '🤝 Buluşma'}
                                    </span>
                                  </div>
                                )}
                                {/* 2 Satırlı Grid — 5'er adım */}
                                <div className="grid grid-cols-5 gap-1.5">
                                  {swapSteps.map((step, idx) => {
                                    const isCompleted = idx < currentStep
                                    const isCurrent = idx === currentStep
                                    
                                    return (
                                      <div 
                                        key={step.key} 
                                        className={`relative flex flex-col items-center p-1.5 rounded-xl border-2 transition-all ${
                                          isCompleted 
                                            ? 'bg-green-50 border-green-400' 
                                            : isCurrent 
                                              ? 'bg-purple-50 border-purple-500 shadow-md shadow-purple-200' 
                                              : 'bg-gray-50 border-gray-200'
                                        }`}
                                      >
                                        {/* Adım numarası + icon */}
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                          isCompleted 
                                            ? 'bg-green-500 text-white' 
                                            : isCurrent 
                                              ? 'bg-purple-500 text-white animate-pulse' 
                                              : 'bg-gray-200 text-gray-400'
                                        }`}>
                                          {isCompleted ? '✓' : step.icon}
                                        </div>
                                        
                                        {/* Kısa label */}
                                        <span className={`text-[8px] mt-1 text-center leading-tight font-medium ${
                                          isCompleted ? 'text-green-700' 
                                          : isCurrent ? 'text-purple-700 font-bold' 
                                          : 'text-gray-400'
                                        }`}>
                                          {step.shortLabel}
                                        </span>
                                        
                                        {/* Aktif göstergesi */}
                                        {isCurrent && (
                                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white animate-ping" />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                                
                                {/* Mevcut adım açıklaması */}
                                <div className="mt-2 text-center">
                                  <span className={`text-[11px] font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1 ${
                                    swap.status === 'completed' 
                                      ? 'bg-green-100 text-green-700' 
                                      : swap.status === 'disputed'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {swapSteps[currentStep]?.icon} {swapSteps[currentStep]?.label || swap.status}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* ═══ DURUMA GÖRE AKSİYON BUTONLARI ═══ */}

                            {/* ADIM 3: accepted — Teslimat yöntemi seç + konum öner */}
                            {swap.status === 'accepted' && (
                              <div className="mt-3 space-y-3">
                                {/* Teslimat yöntemi henüz seçilmediyse */}
                                {!swap.deliveryType && (
                                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                    <p className="text-sm font-semibold text-blue-800 mb-3">
                                      📦 Teslimat Yöntemi Seçin
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {/* Buluşma */}
                                      <button
                                        onClick={() => setDeliveryTypeForSwap(swap.id, 'face_to_face')}
                                        disabled={processingAction === swap.id + '_delivery_type'}
                                        className="p-3 bg-white rounded-xl border-2 border-blue-200 hover:border-blue-500 transition-all text-center disabled:opacity-50"
                                      >
                                        <div className="text-2xl mb-1">🤝</div>
                                        <p className="text-xs font-bold text-gray-800">Buluşma</p>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                          İki taraf aynı yerde buluşur
                                        </p>
                                      </button>
                                      
                                      {/* Teslim noktasına bırak */}
                                      <button
                                        onClick={() => setDeliveryTypeForSwap(swap.id, 'drop_off')}
                                        disabled={processingAction === swap.id + '_delivery_type'}
                                        className="p-3 bg-white rounded-xl border-2 border-orange-200 hover:border-orange-500 transition-all text-center disabled:opacity-50"
                                      >
                                        <div className="text-2xl mb-1">📍</div>
                                        <p className="text-xs font-bold text-gray-800">Teslim Noktası</p>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                          Satıcı bırakır, alıcı sonra alır
                                        </p>
                                      </button>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Yöntem seçildiyse → Teslimat noktası öner */}
                                {swap.deliveryType && (
                                  <div className="space-y-2">
                                    <div className="p-2 bg-gray-50 rounded-lg flex items-center gap-2 text-xs text-gray-400">
                                      {swap.deliveryType === 'face_to_face' ? '🤝 Buluşma' : '📍 Teslim Noktasına Bırakma'}
                                    </div>
                                    <button onClick={() => {
                                      setDeliverySwapId(swap.id)
                                      setDeliveryAction('propose')
                                      setShowDeliveryModal(true)
                                      fetchDeliveryPoints()
                                    }} className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                                      <MapPin className="w-4 h-4" /> 
                                      📍 {swap.deliveryType === 'drop_off' ? 'Teslim Noktası Seç' : 'Buluşma Noktası Öner'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ADIM 4: delivery_proposed — Onayla / Karşı Öner */}
                            {swap.status === 'delivery_proposed' && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <p className="text-xs text-blue-700 mb-2">
                                  📍 {swap.customLocation || swap.deliveryPoint?.name || 'Konum belirtilmedi'}
                                </p>
                                {swap.lastProposedBy === currentUserId ? (
                                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                                    ⏳ Karşı tarafın yanıtını bekliyorsunuz
                                  </p>
                                ) : (
                                  <div className="flex gap-2">
                                    <button onClick={() => acceptDeliveryProposal(swap.id)}
                                      disabled={deliveryLoading}
                                      className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                                      ✅ Onayla
                                    </button>
                                    <button onClick={() => {
                                        setDeliverySwapId(swap.id)
                                        setDeliveryAction('counter')
                                        setShowDeliveryModal(true)
                                        fetchDeliveryPoints()
                                      }}
                                      className="flex-1 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                                      📍 Farklı Yer
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ADIM 5: qr_generated — QR Kod + Paketleme Fotoğrafı (satıcı) + ÇİFT TARAFLI "Geldim" SİSTEMİ */}
                            {false && swap.status === 'qr_generated' /* DEVRE DIŞI - awaiting_delivery kullanın */ && (
                              <div className="mt-3 space-y-3">
                                {/* QR Kod gösterimi - SADECE SATICI GÖRÜR */}
                                {isOwner(swap) ? (
                                  <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-200">
                                    <p className="text-xs text-indigo-700 font-semibold mb-2">📱 QR Kod Hazır (Sadece Sende Görünür)</p>
                                    {swap.qrCode ? (
                                      <>
                                        <div className="flex justify-center mb-2">
                                          <QRCodeSVG 
                                            value={swap.qrCode || ''} 
                                            size={100}
                                            level="H"
                                            includeMargin={true}
                                          />
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-mono bg-white py-1 px-2 rounded inline-block mb-2">
                                          {swap.qrCode || ''}
                                        </p>
                                        {/* QR Kodu TAKAS-A Mesaj ile Gönder */}
                                        <div className="flex gap-2 justify-center">
                                          <button
                                            onClick={() => {
                                              const receiverId = swap.requesterId
                                              const content = `📱 TAKAS-A QR KODU\n\n🔑 Kod: ${swap.qrCode}\n📍 Buluşma: ${swap.customLocation || swap.deliveryPoint?.name || ''}\n\n⚠️ Teslim noktasına geldiğinizde bu kodu taratarak ürünü teslim alabilirsiniz.`
                                              sendSwapMessage(receiverId, content, swap.id)
                                            }}
                                            disabled={sendingMessage === swap.id}
                                            className="px-3 py-1.5 bg-purple-500 text-white rounded text-[10px] font-medium disabled:opacity-50 flex items-center gap-1"
                                          >
                                            {sendingMessage === swap.id ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <>💬 Alıcıya Mesaj Gönder</>
                                            )}
                                          </button>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(swap.qrCode || '')
                                              showNotification('success', '📋 Kopyalandı!')
                                            }}
                                            className="px-2 py-1 bg-gray-500 text-white rounded text-[10px] font-medium"
                                          >
                                            📋 Kopyala
                                          </button>
                                        </div>
                                        <p className="text-[10px] text-orange-600 mt-2 font-medium">
                                          ⚠️ QR kodu alıcıya iletmeyi unutmayın!
                                        </p>
                                      </>
                                    ) : (
                                      <p className="text-xs text-yellow-600">⚠️ QR kod yükleniyor...</p>
                                    )}
                                    <p className="text-[10px] text-indigo-500 mt-2">
                                      📍 {swap.customLocation || swap.deliveryPoint?.name || ''}
                                    </p>
                                  </div>
                                ) : (
                                  /* ALICI - QR Kodu Bekleme Mesajı */
                                  <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-200">
                                    <p className="text-xs text-blue-700 font-semibold mb-1">📱 QR Kod Bekleniyor</p>
                                    <p className="text-[10px] text-blue-600">
                                      Satıcı QR kodunu size mesaj ile iletecek. Teslim noktasına vardığınızda bu kodu taratarak ürünü teslim alabilirsiniz.
                                    </p>
                                    <p className="text-[10px] text-blue-500 mt-2">
                                      📍 Buluşma: {swap.customLocation || swap.deliveryPoint?.name || ''}
                                    </p>
                                  </div>
                                )}
                                
                                {/* 📸 Paketleme Fotoğrafı — SATIŞ YAPAN için ZORUNLU */}
                                {isOwner(swap) && (
                                  <PhotoUploadSection
                                    swapId={swap.id}
                                    type="packaging"
                                    title="Paketleme Fotoğrafı"
                                    description="Ürünü paketledikten sonra fotoğrafını çekin. Bu fotoğraf teslim anlaşmazlığında kanıt olarak kullanılır."
                                  />
                                )}

                                {/* ═══ DROP_OFF MODU: Satıcı teslim noktasına bırakacak ═══ */}
                                {swap.deliveryType === 'drop_off' ? (
                                  <>
                                    {isOwner(swap) ? (
                                      <button onClick={async () => {
                                        const packKey = `${swap.id}_packaging`
                                        if (!pendingPhotos[packKey] || pendingPhotos[packKey].length === 0) {
                                          showNotification('error', '📸 Önce paketleme fotoğrafı yükleyin')
                                          return
                                        }
                                        await savePhotos(swap.id, 'packaging')
                                        handleDropOff(swap.id)
                                      }}
                                        disabled={processingAction === swap.id + '_dropoff'}
                                        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                      >
                                        {processingAction === swap.id + '_dropoff' 
                                          ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                          : <>📦 Ürünü Teslim Noktasına Bıraktım</>}
                                      </button>
                                    ) : (
                                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                                        <p className="text-xs text-amber-700">
                                          ⏳ Satıcının ürünü teslim noktasına bırakmasını bekliyorsunuz
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* ═══ FACE_TO_FACE MODU: Çift taraflı varış sistemi ═══ */}
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                      <p className="text-xs font-semibold text-gray-700 mb-2">📍 Varış Durumu</p>
                                      <div className="flex gap-3">
                                        <div className={`flex-1 text-center p-2 rounded-lg ${
                                          swap.ownerArrived ? 'bg-green-100 border border-green-300' : 'bg-gray-100 border border-gray-200'
                                        }`}>
                                          <p className="text-[10px] text-gray-500">Satıcı</p>
                                          <p className="text-sm font-bold">
                                            {swap.ownerArrived ? '✅ Geldi' : '⏳ Bekleniyor'}
                                          </p>
                                        </div>
                                        <div className={`flex-1 text-center p-2 rounded-lg ${
                                          swap.requesterArrived ? 'bg-green-100 border border-green-300' : 'bg-gray-100 border border-gray-200'
                                        }`}>
                                          <p className="text-[10px] text-gray-500">Alıcı</p>
                                          <p className="text-sm font-bold">
                                            {swap.requesterArrived ? '✅ Geldi' : '⏳ Bekleniyor'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* "Geldim" butonu — henüz gelmediyse göster */}
                                    {((isOwner(swap) && !swap.ownerArrived) || 
                                      (isRequester(swap) && !swap.requesterArrived)) && (
                                      <button onClick={async () => {
                                        if (isOwner(swap)) {
                                          const packKey = `${swap.id}_packaging`
                                          if (!pendingPhotos[packKey] || pendingPhotos[packKey].length === 0) {
                                            showNotification('error', '📸 Lütfen önce ürünün paketleme fotoğrafını yükleyin')
                                            return
                                          }
                                          const saved = await savePhotos(swap.id, 'packaging')
                                          if (!saved) {
                                            showNotification('error', 'Fotoğraf kaydedilemedi')
                                            return
                                          }
                                        }
                                        handleArrived(swap.id)
                                      }}
                                        disabled={processingAction === swap.id + '_arrived'}
                                        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                        {processingAction === swap.id + '_arrived' 
                                          ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                          : <>📍 Teslimat Noktasına Geldim</>}
                                      </button>
                                    )}

                                    {/* Zaten geldiyse bekle mesajı */}
                                    {((isOwner(swap) && swap.ownerArrived && !swap.requesterArrived) || 
                                      (isRequester(swap) && swap.requesterArrived && !swap.ownerArrived)) && (
                                      <div className="p-3 bg-amber-50 rounded-lg text-center border border-amber-200">
                                        <p className="text-xs text-amber-700 font-medium">
                                          ⏳ Geldiğinizi bildirdiniz. Karşı tarafı bekliyorsunuz...
                                        </p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* ADIM 6: arrived — HER İKİ TARAF DA GELDİ → QR TARAMA */}
                            {false && swap.status === 'arrived' /* DEVRE DIŞI */ && (
                              <div className="mt-3 space-y-3">
                                <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
                                  <p className="text-sm text-green-800 font-semibold">✅ Her İki Taraf da Geldi!</p>
                                  <p className="text-xs text-green-600 mt-1">
                                    {isOwner(swap) 
                                      ? 'Alıcının QR kodu taratmasını bekleyin veya QR kodu gösterin.' 
                                      : 'Satıcının gösterdiği QR kodu taratarak ürünü kontrol için teslim alın.'}
                                  </p>
                                </div>

                                {/* SATICI: QR Kod Göster */}
                                {isOwner(swap) && swap.qrCode && (
                                  <div className="p-4 bg-white rounded-xl border-2 border-purple-200 text-center">
                                    <p className="text-xs text-purple-700 font-semibold mb-3">📱 Bu QR Kodu Alıcıya Gösterin</p>
                                    <div className="flex justify-center mb-3">
                                      <QRCodeSVG 
                                        value={swap.qrCode || ''} 
                                        size={180}
                                        level="H"
                                        includeMargin={true}
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                      />
                                    </div>
                                    <p className="text-xs text-gray-400 font-mono bg-gray-100 py-1 px-2 rounded inline-block">
                                      {swap.qrCode || ''}
                                    </p>
                                    
                                    {/* QR Kodu Mesaj ile Gönder */}
                                    <div className="mt-3 flex gap-2 justify-center">
                                      <button
                                        onClick={() => {
                                          const receiverId = swap.requesterId
                                          const content = `📱 QR KODU HAZIR\n\n🔑 Kod: ${swap.qrCode}\n\n⚠️ Lütfen bu kodu taratarak ürünü kontrol için teslim alın.`
                                          sendSwapMessage(receiverId, content, swap.id)
                                        }}
                                        disabled={sendingMessage === swap.id}
                                        className="px-3 py-2 bg-purple-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                      >
                                        {sendingMessage === swap.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>💬 Alıcıya Mesaj Gönder</>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(swap.qrCode || '')
                                          showNotification('success', '📋 QR kod kopyalandı!')
                                        }}
                                        className="px-3 py-2 bg-gray-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                      >
                                        📋 Kopyala
                                      </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">
                                      Alıcı QR kodu tarattığında ürünü kontrol için teslim alacak.
                                    </p>
                                  </div>
                                )}

                                {/* ALICI: QR Tarama Arayüzü */}
                                {isRequester(swap) && (
                                  <>
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                                      <p className="text-xs text-purple-700 font-semibold mb-1">📱 QR Kodu Taratın</p>
                                      <p className="text-[10px] text-purple-600">
                                        Satıcının gösterdiği QR kodu taratarak ürünü kontrol için teslim alın.
                                      </p>
                                    </div>

                                    {/* QR Tarama Butonu — KAMERA MODAL */}
                                    <button 
                                      onClick={() => openQrScanModal(swap.id)}
                                      disabled={processingAction === swap.id + '_scan'}
                                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                      {processingAction === swap.id + '_scan' 
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <>📷 Kamera ile QR Tarat</>}
                                    </button>

                                    {/* Manuel QR Kodu Gir */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="text"
                                        value={scanInput[swap.id] || ''}
                                        onChange={(e) => setScanInput(prev => ({ 
                                          ...prev, 
                                          [swap.id]: e.target.value.toUpperCase() 
                                        }))}
                                        placeholder="QR kodu manuel girin (TAKAS-...)"
                                        className="w-full sm:flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-purple-400 focus:ring-0"
                                      />
                                      <button 
                                        onClick={() => handleScanQR(swap.id, scanInput[swap.id] || '')}
                                        disabled={!(scanInput[swap.id] || '').startsWith('TAKAS-') || processingAction === swap.id + '_scan'}
                                        className="w-full sm:w-auto px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex-shrink-0"
                                      >
                                        Tarat
                                      </button>
                                    </div>
                                  </>
                                )}

                                {/* Satıcı için bekleme mesajı */}
                                {isOwner(swap) && (
                                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                                    <p className="text-xs text-amber-700">
                                      ⏳ Alıcının QR kodu taratmasını bekliyorsunuz...
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ═══ DROP_OFF ADIM 6: dropped_off — Satıcı ürünü bıraktı, Alıcı bekliyor ═══ */}
                            {swap.status === 'dropped_off' && swap.deliveryType === 'drop_off' && (
                              <div className="mt-3 space-y-3">
                                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                                  <p className="text-sm font-semibold text-green-800">📦 Ürün Teslim Noktasında!</p>
                                  <p className="text-xs text-green-600 mt-1">
                                    {isRequester(swap as any) 
                                      ? `3 iş günü içinde teslim noktasından ürünü almalısınız.`
                                      : 'Ürünü teslim noktasına bıraktınız. Alıcının almasını bekliyorsunuz.'}
                                  </p>
                                  {swap.dropOffDeadline && (
                                    <p className="text-xs text-red-600 font-semibold mt-2">
                                      ⏰ Son tarih: {new Date(swap.dropOffDeadline).toLocaleDateString('tr-TR', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-green-500 mt-2">
                                    📍 {swap.customLocation || swap.deliveryPoint?.name || ''}
                                  </p>
                                </div>
                                
                                {/* Alıcı: Teslim Kodu Girişi + Aldım Butonu */}
                                {isRequester(swap as any) && (
                                  <>
                                    {/* Teslim kodu girişi */}
                                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                                      <p className="text-xs font-semibold text-blue-800 mb-2">
                                        🔑 Teslim Kodunu Girin
                                      </p>
                                      <p className="text-[10px] text-blue-600 mb-2">
                                        Mesajlarınıza gönderilen 6 haneli kodu girin
                                      </p>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={verificationInput[swap.id] || ''}
                                        onChange={(e) => setVerificationInput(prev => ({ 
                                          ...prev, 
                                          [swap.id]: e.target.value.replace(/\D/g, '').slice(0, 6) 
                                        }))}
                                        placeholder="000000"
                                        className="w-full text-center text-2xl font-black tracking-[8px] p-3 rounded-xl border-2 border-blue-300 bg-white"
                                      />
                                    </div>

                                    <button onClick={() => handlePickedUp(swap.id)}
                                      disabled={processingAction === swap.id + '_pickup' || (verificationInput[swap.id] || '').length !== 6}
                                      className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
                                        (verificationInput[swap.id] || '').length === 6
                                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                          : 'bg-gray-200 text-gray-400'
                                      }`}
                                    >
                                      {processingAction === swap.id + '_pickup' 
                                        ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                        : <>✅ Ürünü Aldım — Kodu Doğrula</>}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* ADIM 7: qr_scanned — Teslim Fotoğrafı (satıcı) + "Ürünü Kontrol Ediyorum" (alıcı) */}
                            {swap.status === 'qr_scanned' && (
                              <div className="mt-3 space-y-2">
                                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                                  <p className="text-sm text-purple-800 font-semibold">✅ QR Kod Okutuldu!</p>
                                  <p className="text-xs text-purple-600 mt-1">
                                    {isRequester(swap) 
                                      ? 'Ürünü kontrol edin ve onaylayın.' 
                                      : 'Alıcı ürünü kontrol ediyor...'}
                                  </p>
                                </div>
                                
                                {/* 📸 Teslim Fotoğrafı — SATIŞ YAPAN (satıcı) */}
                                {isOwner(swap) && (
                                  <PhotoUploadSection
                                    swapId={swap.id}
                                    type="delivery"
                                    title="Teslim Fotoğrafı"
                                    description="Ürünü alıcıya teslim ederken fotoğraf çekin."
                                  />
                                )}
                                
                                {isRequester(swap) && (
                                  <button onClick={() => handleStartInspection(swap.id)}
                                    disabled={processingAction === swap.id + '_inspect'}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                    {processingAction === swap.id + '_inspect' 
                                      ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                      : <>🔍 Ürünü Kontrol Ediyorum</>}
                                  </button>
                                )}
                                
                                {/* Satıcı bekliyor mesajı */}
                                {isOwner(swap) && (
                                  <p className="text-xs text-purple-600 text-center">Alıcının ürünü kontrol etmesini bekleyin.</p>
                                )}
                              </div>
                            )}

                            {/* ADIM 8: inspection — Alım Fotoğrafı (alıcı) + "Ürünü Onaylıyorum" / "Sorun Var" */}
                            {false && swap.status === 'inspection' /* DEVRE DIŞI */ && (
                              <div className="mt-3 space-y-2">
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                                  <p className="text-sm text-amber-800 font-semibold">🔍 Ürün Kontrol Ediliyor</p>
                                  <p className="text-xs text-amber-600 mt-1">
                                    {isRequester(swap) 
                                      ? 'Ürünü inceleyip onaylayın veya sorun bildirin.' 
                                      : 'Alıcı ürünü inceliyor, lütfen bekleyin.'}
                                  </p>
                                </div>
                                
                                {/* Alıcı: Alım fotoğrafı çek — ZORUNLU */}
                                {isRequester(swap) && (
                                  <>
                                    <PhotoUploadSection
                                      swapId={swap.id}
                                      type="receiving"
                                      title="Alım Fotoğrafı"
                                      description="Aldığınız ürünün fotoğrafını çekin. Bu fotoğraf ürün kontrolü kanıtıdır."
                                    />
                                    
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={async () => {
                                          const recKey = `${swap.id}_receiving`
                                          if (!pendingPhotos[recKey] || pendingPhotos[recKey].length === 0) {
                                            showNotification('error', '📸 Lütfen önce ürünün alım fotoğrafını yükleyin')
                                            return
                                          }
                                          const saved = await savePhotos(swap.id, 'receiving')
                                          if (!saved) {
                                            showNotification('error', 'Fotoğraf kaydedilemedi')
                                            return
                                          }
                                          handleApproveProduct(swap.id)
                                        }}
                                        disabled={processingAction === swap.id + '_approve'}
                                        className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                        {processingAction === swap.id + '_approve' 
                                          ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                          : <>✅ Ürünü Onaylıyorum</>}
                                      </button>
                                      <button onClick={() => openDisputeModal(swap.id)}
                                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                                        ⚠️ Sorun Var
                                      </button>
                                    </div>
                                  </>
                                )}
                                
                                {isOwner(swap) && (
                                  <p className="text-xs text-amber-600 text-center">Alıcı ürünü inceliyor, lütfen bekleyin.</p>
                                )}
                              </div>
                            )}

                            {/* ADIM 9: code_sent — 6 Haneli Kod Doğrulama */}
                            {false && swap.status === 'code_sent' /* DEVRE DIŞI */ && (
                              <div className="mt-3 space-y-3">
                                {isRequester(swap) ? (
                                  /* ═══ ALICI: 6 haneli kodu göster ═══ */
                                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-300 text-center">
                                    <p className="text-xs font-bold text-green-800 mb-2">🔑 Doğrulama Kodunuz</p>
                                    <span className="text-3xl font-black text-green-700 tracking-[8px]">
                                      {readyForPickup[swap.id] || '••••••'}
                                    </span>
                                    <p className="text-[10px] text-green-600 mt-2">
                                      ⚠️ Bu kodu teslim noktasında satıcıya söyleyin
                                    </p>
                                    {!readyForPickup[swap.id] && (
                                      <p className="text-[10px] text-gray-500 mt-1">
                                        💡 Kodu göremiyorsanız mesajlarınızı veya e-postanızı kontrol edin
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  /* ═══ SATICI: 6 haneli kodu doğrula ═══ */
                                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                                    <p className="text-sm font-bold text-blue-800 text-center mb-1">
                                      🔑 Doğrulama Kodu Girin
                                    </p>
                                    <p className="text-xs text-blue-600 text-center mb-3">
                                      Alıcının size söylediği 6 haneli kodu girin
                                    </p>
                                    
                                    {/* 6 haneli kod input — BÜYÜK */}
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={6}
                                      value={verificationInput[swap.id] || ''}
                                      onChange={(e) => setVerificationInput(prev => ({ 
                                        ...prev, 
                                        [swap.id]: e.target.value.replace(/\D/g, '').slice(0, 6) 
                                      }))}
                                      placeholder="000000"
                                      className="w-full text-center text-3xl font-black tracking-[10px] p-4 rounded-xl border-2 border-blue-300 bg-white focus:border-blue-500 focus:ring-0"
                                    />
                                    
                                    {/* Doğrula butonu */}
                                    <button 
                                      onClick={() => handleVerifyCode(swap.id)}
                                      disabled={
                                        processingAction === swap.id + '_verify' || 
                                        (verificationInput[swap.id] || '').length !== 6
                                      }
                                      className={`w-full mt-3 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                        (verificationInput[swap.id] || '').length === 6
                                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      }`}
                                    >
                                      {processingAction === swap.id + '_verify' 
                                        ? <Loader2 className="w-4 h-4 animate-spin" /> 
                                        : <>✅ Kodu Doğrula ve Takası Tamamla</>}
                                    </button>
                                    
                                    {/* Yardım linki */}
                                    <p className="text-[10px] text-gray-400 text-center mt-2">
                                      💡 Alıcı kodu mesajlarından veya e-postasından bulabilir
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ADIM 10: completed — Tamamlandı */}
                            {swap.status === 'completed' && (
                              <div className="mt-3 space-y-3">
                                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-300 text-center">
                                  <p className="text-lg font-bold text-green-700">🎉 Takas Güvenle Tamamlandı!</p>
                                  <p className="text-xs text-green-600 mt-1">Karşı tarafı değerlendirmeyi unutmayın.</p>
                                </div>
                                
                                {/* Dispute Window Göstergesi */}
                                {swap.disputeWindowEndsAt && (() => {
                                  const now = new Date()
                                  const ends = new Date(swap.disputeWindowEndsAt)
                                  const remaining = ends.getTime() - now.getTime()
                                  const hoursLeft = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)))
                                  const minutesLeft = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)))
                                  const isExpired = remaining <= 0
                                  const isUrgent = hoursLeft < 6

                                  if (isExpired) return null // Süre doldu, gösterme

                                  return (
                                    <div className={`p-3 rounded-xl border-2 ${
                                      isUrgent 
                                        ? 'bg-red-50 border-red-300' 
                                        : 'bg-amber-50 border-amber-200'
                                    }`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className={`text-xs font-bold ${isUrgent ? 'text-red-800' : 'text-amber-800'}`}>
                                          ⏰ Anlaşmazlık Bildirim Süresi
                                        </p>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                          isUrgent 
                                            ? 'bg-red-200 text-red-700' 
                                            : 'bg-amber-200 text-amber-700'
                                        }`}>
                                          {hoursLeft}s {minutesLeft}dk kaldı
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-400">
                                        {isUrgent 
                                          ? '⚠️ Süre dolmak üzere! Sorun varsa hemen bildirin.'
                                          : 'Ürünle ilgili bir sorun varsa bu süre içinde bildirebilirsiniz.'
                                        }
                                      </p>
                                      
                                      {/* Sorun Bildir butonu */}
                                      <button 
                                        onClick={() => openDisputeModal(swap.id)}
                                        className={`w-full mt-2 py-2 rounded-lg text-xs font-medium border ${
                                          isUrgent
                                            ? 'border-red-400 text-red-700 hover:bg-red-100'
                                            : 'border-amber-400 text-amber-700 hover:bg-amber-100'
                                        }`}
                                      >
                                        ⚠️ Sorun Bildir
                                      </button>
                                    </div>
                                  )
                                })()}
                              </div>
                            )}

                            {/* DISPUTED — Sorun bildirildi (detaylı) */}
                            {swap.status === 'disputed' && (
                              <div className="mt-3 space-y-2">
                                <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                    <p className="text-sm font-bold text-red-800">Anlaşmazlık İnceleniyor</p>
                                  </div>
                                  <p className="text-xs text-red-600 mb-3">
                                    Sorun raporu oluşturuldu. Destek ekibimiz 24 saat içinde inceleyecek.
                                  </p>
                                  
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs text-red-700">
                                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                      Teminatlar donduruldu
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-red-700">
                                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                      Her iki taraf bilgilendirildi
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-orange-600">
                                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                                      Uzlaşma süreci başlatılacak
                                    </div>
                                  </div>
                                  
                                  <div className="mt-3 p-2 bg-white rounded-lg border border-red-100">
                                    <p className="text-[10px] text-gray-500">
                                      💡 İpucu: Karşı tarafla mesajlaşarak sorunu çözmeye çalışabilirsiniz.
                                      Uzlaşma sağlanırsa anlaşmazlık kapanır.
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Mesaj Gönder butonu */}
                                <button 
                                  onClick={() => {
                                    const otherUser = isRequester(swap) 
                                      ? (swap as any).owner || (swap as any).product?.user
                                      : (swap as any).requester
                                    if (otherUser?.id) {
                                      window.location.href = `/profil?tab=messages&user=${otherUser.id}`
                                    }
                                  }}
                                  className="w-full py-2 border border-blue-300 text-blue-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  💬 Karşı Tarafla Mesajlaş
                                </button>
                              </div>
                            )}

                            {/* REFUNDED — İade edildi */}
                            {swap.status === 'refunded' && (
                              <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                                <p className="text-sm font-semibold text-gray-700">💰 Teminat İade Edildi</p>
                                <p className="text-xs text-gray-500 mt-1">Anlaşmazlık çözüldü ve teminatınız iade edildi.</p>
                              </div>
                            )}

                            {/* Sorun Var linki — teslim sürecindeki herhangi bir adımda (her iki taraf) */}
                            {['arrived', 'qr_scanned'].includes(swap.status) && (
                              <button 
                                onClick={() => openDisputeModal(swap.id)}
                                className="w-full mt-2 py-1.5 text-red-500 text-xs font-medium underline"
                              >
                                ⚠️ Sorun mu var? Bildir
                              </button>
                            )}

                            {/* Inline Mesajlaşma butonu */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenChatId(openChatId === swap.id ? null : swap.id)
                                if (openChatId !== swap.id) {
                                  setUnreadCounts(prev => ({ ...prev, [swap.id]: 0 }))
                                }
                              }}
                              className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors relative"
                            >
                              💬 Mesajlar
                              {unreadCounts[swap.id] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                  {unreadCounts[swap.id] > 99 ? '99+' : unreadCounts[swap.id]}
                                </span>
                              )}
                            </button>

                            {/* Inline Mesajlaşma paneli */}
                            {openChatId === swap.id && (
                              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                                <SwapChat
                                  swapRequestId={swap.id}
                                  otherUserId={swap.requesterId === currentUserId ? swap.ownerId : swap.requesterId}
                                  otherUserName={swap.requesterId === currentUserId ? swap.product?.user?.name : swap.requester?.name}
                                  otherUserImage={swap.requesterId === currentUserId ? (swap.owner?.image || swap.product?.user?.image) : swap.requester?.image}
                                  productTitle={swap.product?.title}
                                  status={swap.status}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ═══ MESAJLAŞMA PANELİ — SEÇİLİ TAKAS İÇİN ═══ */}
              {selectedSwapId && selectedSwapData && showChatPanel && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6 bg-white rounded-2xl shadow-lg border-2 border-frozen-200 overflow-hidden"
                >
                  <div className="p-4 bg-gradient-to-r from-frozen-500 to-blue-500 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5" />
                      <div>
                        <p className="font-semibold text-sm">Takas Mesajlaşması</p>
                        <p className="text-xs text-white/80">{selectedSwapData.product.title}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowChatPanel(false)}
                      className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <SwapChat
                    swapRequestId={selectedSwapId}
                    otherUserId={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requesterId : selectedSwapData.ownerId}
                    otherUserName={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requester.name : selectedSwapData.product.user.name}
                    otherUserImage={selectedSwapData.ownerId === currentUserId ? selectedSwapData.requester?.image : (selectedSwapData.owner?.image || selectedSwapData.product?.user?.image)}
                    productTitle={selectedSwapData.product?.title}
                    status={selectedSwapData.status}
                    className="max-h-[400px]"
                  />
                </motion.div>
              )}

              {/* Çoklu Takas Banner */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-xl mb-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">Çoklu Takas</h3>
                    <p className="text-sm text-white/90">
                      3+ kişilik takas döngüleri. Sistem otomatik eşleşme bulur!
                    </p>
                  </div>
                  <Info className="w-5 h-5 text-white/70" />
                </div>
              </div>

              {/* Çoklu Takaslar */}
              {activeSwaps.length === 0 && activeDirectSwaps.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-transparent dark:border-gray-700">
                  <Users className="w-16 h-16 text-gray-300 dark:text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Aktif Takas Yok</h3>
                  <p className="text-gray-400 dark:text-gray-400 mb-4">
                    Şu anda katıldığınız aktif bir takas bulunmuyor.
                  </p>
                </div>
              ) : activeSwaps.length > 0 && (
                <div className="space-y-6">
                  {activeSwaps.map((swap: any) => {
                    const myParticipation = swap.participants.find((p: any) => p.user?.email === session?.user?.email)
                    const alreadyConfirmed = myParticipation?.confirmed
                    const confirmedCount = swap.participants.filter((p: any) => p.confirmed).length
                    const remainingCount = swap.participants.length - confirmedCount

                    return (
                      <div key={swap.id} ref={swap.id === selectedSwapData?.id ? selectedSwapRef : null} className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border-2 ${
                        swap.status === 'confirmed' ? 'border-green-200 dark:border-green-700' : 'border-yellow-100 dark:border-yellow-800'
                      }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {swap.participants.length} Kişilik Takas
                            </h3>
                            {swap.isInitiator && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium">
                                Başlatan
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Time Remaining */}
                            {swap.status === 'pending' && swap.timeRemaining !== null && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                                swap.timeRemaining < 120 ? 'bg-red-100 text-red-700' : 
                                swap.timeRemaining < 480 ? 'bg-orange-100 text-orange-700' : 
                                'bg-blue-100 text-blue-700'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {swap.timeRemaining < 60 
                                  ? `${swap.timeRemaining} dk` 
                                  : `${Math.floor(swap.timeRemaining / 60)} sa ${swap.timeRemaining % 60} dk`}
                              </span>
                            )}
                            {/* Status Badge */}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              swap.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                              swap.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                              'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            }`}>
                              {swap.status === 'pending' ? `${confirmedCount}/${swap.participants.length} Onay` :
                               swap.status === 'confirmed' ? '✓ Onaylandı' : swap.status}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {swap.status === 'pending' && (
                          <div className="mb-4">
                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                style={{ width: `${(confirmedCount / swap.participants.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Participants */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-4">
                          {swap.participants.map((p: any, idx: number) => (
                            <div key={p.id} className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-center">
                                <div className={`relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2 border-2 ${
                                  p.confirmed ? 'border-green-300 dark:border-green-600' : 'border-gray-200 dark:border-gray-600'
                                }`}>
                                  {p.givesProduct.images?.[0] ? (
                                    <Image src={p.givesProduct.images[0]} alt="" fill className="object-cover" />
                                  ) : (
                                    <Package className="w-6 h-6 text-gray-300 dark:text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                  )}
                                  {/* Valor badge */}
                                  <div className="absolute bottom-0.5 right-0.5 bg-white/90 dark:bg-gray-900/90 px-1 py-0.5 rounded text-xs font-bold text-purple-700 dark:text-purple-400">
                                    {p.givesProduct.valorPrice}V
                                  </div>
                                </div>
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[80px]">
                                  {p.user.name || 'Kullanıcı'}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-400 truncate max-w-[80px]">
                                  {p.givesProduct.title}
                                </p>
                                {p.confirmed ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1">
                                    <CheckCircle className="w-3 h-3" /> Onayladı
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    <Clock className="w-3 h-3" /> Bekliyor
                                  </span>
                                )}
                              </div>
                              {idx < swap.participants.length - 1 && (
                                <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-400" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        {swap.status === 'pending' && (
                          <div className="flex gap-3 mt-4">
                            {!alreadyConfirmed ? (
                              <>
                                <button
                                  onClick={() => handleConfirmSwap(swap.id)}
                                  disabled={confirmingSwap === swap.id}
                                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                  {confirmingSwap === swap.id ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Onaylanıyor...</>
                                  ) : (
                                    <><Check className="w-5 h-5" /> Onayla</>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectSwap(swap.id)}
                                  disabled={rejectingSwap === swap.id}
                                  className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                  {rejectingSwap === swap.id ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <X className="w-5 h-5" />
                                  )}
                                  Reddet
                                </button>
                              </>
                            ) : (
                              <div className="flex-1 py-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium text-center flex items-center justify-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                Onayınız alındı. {remainingCount > 0 ? `${remainingCount} kişi bekleniyor.` : ''}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Confirmed Status */}
                        {swap.status === 'confirmed' && (
                          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold mb-2">
                              <CheckCircle className="w-5 h-5" />
                              Takas Onaylandı!
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Tüm katılımcılar onayladı. Teslim detayları için diğer kullanıcılarla iletişime geçin.
                            </p>
                          </div>
                        )}

                        {/* 💬 Çoklu Takas Mesajlaşma */}
                        <button
                          onClick={() => setOpenChatId(openChatId === swap.id ? null : swap.id)}
                          className="w-full mt-4 py-2 bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                          💬 Katılımcılarla Mesajlaş
                        </button>

                        {openChatId === swap.id && (
                          <div className="mt-3">
                            <MultiSwapChat
                              swapRequestId={swap.id}
                              participants={swap.participants
                                .filter((p: any) => p.user?.id !== currentUserId)
                                .map((p: any) => ({
                                  userId: p.user?.id || p.userId,
                                  userName: p.user?.name || 'Kullanıcı'
                                }))}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ TAMAMLANAN TAKASLAR SEKMESİ (GÖREV 11) ═══ */}
          {activeTab === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Tamamlanan Takaslar ({completedSwaps.length})
                </h2>
                
                {completedSwaps.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 dark:text-gray-400">Henüz tamamlanmış takas yok</p>
                    <p className="text-sm text-gray-400 dark:text-gray-400 mt-2">
                      Takaslarınız tamamlandığında burada görünecek
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completedSwaps.map((swap) => {
                      const amIOwner = swap.ownerId === currentUserId
                      const otherUser = amIOwner ? swap.requester : swap.product.user
                      
                      return (
                        <div 
                          key={swap.id}
                          ref={swap.id === selectedSwapData?.id ? selectedSwapRef : null}
                          className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-5 shadow-sm border-2 border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-start gap-4">
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {swap.product.images?.[0] ? (
                                <Image src={swap.product.images[0]} alt="" fill className="object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-gray-300 dark:text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                              )}
                              {/* Tamamlandı rozeti */}
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{swap.product.title}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {amIOwner ? 'Alıcı' : 'Satıcı'}: {otherUser?.name || 'Kullanıcı'}
                                  </p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">
                                  ✅ Tamamlandı
                                </span>
                              </div>
                              
                              {/* Takas detayları */}
                              <div className="mt-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Valor:</span>
                                    <span className="ml-1 font-semibold text-gray-900 dark:text-gray-100">
                                      {swap.agreedPriceRequester || swap.product.valorPrice} V
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Tamamlanma:</span>
                                    <span className="ml-1 font-semibold text-gray-900 dark:text-gray-100">
                                      {new Date(swap.completedAt || swap.createdAt).toLocaleDateString('tr-TR')}
                                    </span>
                                  </div>
                                  {swap.offeredProduct && (
                                    <div className="col-span-2">
                                      <span className="text-gray-500 dark:text-gray-400">Karşılık Ürün:</span>
                                      <span className="ml-1 font-semibold text-gray-900 dark:text-gray-100">
                                        {swap.offeredProduct.title}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'opportunities' && (
            <motion.div
              key="opportunities"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Filters & Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-6 shadow-sm border border-transparent dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Filters */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtreler:</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyBalanced}
                        onChange={(e) => {
                          setShowOnlyBalanced(e.target.checked)
                          setTimeout(fetchData, 100)
                        }}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-400 dark:text-gray-400">Sadece Dengeli</span>
                    </label>
                    <select
                      value={minScoreFilter}
                      onChange={(e) => {
                        setMinScoreFilter(parseInt(e.target.value))
                        setTimeout(fetchData, 100)
                      }}
                      className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="0">Tüm Skorlar</option>
                      <option value="30">Min. 30 Puan</option>
                      <option value="50">Min. 50 Puan</option>
                      <option value="70">Min. 70 Puan</option>
                    </select>
                  </div>
                  
                  {/* Stats */}
                  {swapStats && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{swapStats.totalFound}</span> fırsat
                      </span>
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        <span className="font-bold">{swapStats.balanced}</span> dengeli
                      </span>
                      <span className="text-orange-700 dark:text-orange-400 font-medium">
                        <span className="font-bold">{swapStats.unbalanced}</span> dengesiz
                      </span>
                      {swapStats.averageScore > 0 && (
                        <span className="text-purple-700 dark:text-purple-400 font-medium">
                          Ort. <span className="font-bold">{swapStats.averageScore}</span> puan
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {opportunities.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-5xl mb-4">🔄</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    {showOnlyBalanced || minScoreFilter > 0 
                      ? 'Filtrelere Uygun Fırsat Yok'
                      : 'Henüz Çoklu Takas Fırsatı Yok'}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-md mx-auto">
                    {showOnlyBalanced || minScoreFilter > 0 
                      ? 'Seçili filtrelere uygun takas bulunamadı. Filtreleri değiştirmeyi deneyin.'
                      : 'Çoklu takas fırsatları, kullanıcılar ürünlere ilgi bildirdikçe otomatik olarak oluşur. Şansınızı artırmak için:'}
                  </p>
                  
                  {!(showOnlyBalanced || minScoreFilter > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center border border-blue-100 dark:border-blue-800">
                        <span className="text-2xl">1️⃣</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-2">Ürünlere göz atın</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400">Beğendiğiniz ürünleri bulun</p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-center border border-purple-100 dark:border-purple-800">
                        <span className="text-2xl">2️⃣</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-2">Takas teklif edin</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400">&quot;Hızlı Takas&quot; butonuna basın</p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl text-center border border-green-100 dark:border-green-800">
                        <span className="text-2xl">3️⃣</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-2">Fırsatlar oluşsun</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400">Algoritma otomatik eşleştirir</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Link
                      href="/urunler"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90"
                    >
                      🛍️ {t('browseProducts')}
                    </Link>
                    <Link
                      href="/istek-panosu"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      🎯 {t('wishBoard')}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Banner */}
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 rounded-2xl p-6 border border-transparent dark:border-gray-700">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Akıllı Takas Algoritması</h3>
                        <p className="text-sm text-gray-400 dark:text-gray-300">
                          Algoritmamız değer dengesi (±%20 tolerans) ve konum yakınlığını analiz ederek en adil ve pratik takas döngülerini önceliklendirir. 
                          Yeşil badge = dengeli değerler, yüksek skor = daha iyi eşleşme!
                        </p>
                      </div>
                    </div>
                  </div>

                  {opportunities.map((opportunity, idx) => (
                    <div 
                      key={idx} 
                      className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border-2 transition-all ${
                        opportunity.isValueBalanced 
                          ? 'border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600' 
                          : 'border-orange-200 dark:border-orange-700 hover:border-orange-300 dark:hover:border-orange-600'
                      }`}
                    >
                      {/* Header with badges */}
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                          {opportunity.chainLength} Kişilik Takas Fırsatı
                        </h3>
                        <div className="flex items-center gap-2">
                          {/* Balance Badge */}
                          {opportunity.isValueBalanced ? (
                            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium flex items-center gap-1">
                              <Scale className="w-3 h-3" /> Dengeli
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> %{opportunity.valueDifference} Fark
                            </span>
                          )}
                          {/* Total Score Badge */}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            opportunity.totalScore >= 70 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                              : opportunity.totalScore >= 50 
                                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                            {opportunity.totalScore} Puan
                          </span>
                        </div>
                      </div>

                      {/* Score Details */}
                      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-400 mb-1">
                            <Scale className="w-3 h-3" /> Değer Dengesi
                          </div>
                          <div className={`text-lg font-bold ${
                            opportunity.valueBalanceScore >= 70 ? 'text-green-600 dark:text-green-400' :
                            opportunity.valueBalanceScore >= 40 ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400'
                          }`}>
                            {opportunity.valueBalanceScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-400 mb-1">
                            <MapPin className="w-3 h-3" /> Konum Skoru
                          </div>
                          <div className={`text-lg font-bold ${
                            opportunity.locationScore >= 70 ? 'text-green-600 dark:text-green-400' :
                            opportunity.locationScore >= 40 ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400'
                          }`}>
                            {opportunity.locationScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-400 mb-1">
                            <TrendingUp className="w-3 h-3" /> Ort. Değer
                          </div>
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {opportunity.averageValorPrice} V
                          </div>
                        </div>
                      </div>
                      
                      {/* Participants */}
                      <div className="flex items-center gap-4 overflow-x-auto pb-4">
                        {opportunity.participants.map((p, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-center">
                              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2 border-2 border-purple-200 dark:border-purple-700">
                                {p.productImage ? (
                                  <Image src={p.productImage} alt="" fill className="object-cover" />
                                ) : (
                                  <Package className="w-8 h-8 text-gray-300 dark:text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                                {/* Valor Price Badge */}
                                <div className="absolute bottom-1 right-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs font-bold text-purple-700 dark:text-purple-400">
                                  {p.productValorPrice}V
                                </div>
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.userName}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-400 truncate max-w-[100px]">{p.productTitle}</p>
                              {p.productLocation && (
                                <p className="text-xs text-gray-400 dark:text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[80px]">{p.productLocation}</span>
                                </p>
                              )}
                            </div>
                            {pIdx < opportunity.participants.length - 1 && (
                              <ArrowRight className="w-6 h-6 text-purple-400 dark:text-purple-500" />
                            )}
                          </div>
                        ))}
                        <ArrowRight className="w-6 h-6 text-purple-400 dark:text-purple-500 rotate-180 flex-shrink-0" />
                      </div>

                      {/* Warning for unbalanced swaps */}
                      {!opportunity.isValueBalanced && (
                        <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl mb-4">
                          <Info className="w-4 h-4 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-700 dark:text-orange-300">
                            Bu takas zincirinde ürün değerleri arasında %{opportunity.valueDifference} farklılık var. 
                            Yine de katılmak isterseniz, tüm tarafların onayı gerekecektir.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => handleCreateMultiSwap(opportunity.participants)}
                        disabled={creatingSwap}
                        className={`w-full py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${
                          opportunity.isValueBalanced
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                        }`}
                      >
                        {creatingSwap ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Oluşturuluyor...</>
                        ) : (
                          <><ArrowLeftRight className="w-5 h-5" /> Bu Takası Başlat</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Teslimat Noktası Belirleme Modalı */}
      <AnimatePresence>
        {showDeliveryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDeliveryModal(false); resetDeliveryModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold text-gray-900">
                    {deliveryAction === 'counter' ? '🔄 Karşı Öneri Yap' : '📍 Teslimat Noktası Belirle'}
                  </h3>
                </div>
                <button
                  onClick={() => { setShowDeliveryModal(false); resetDeliveryModal(); }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-4">
                {/* Teslimat Yöntemi */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Teslim Yeri Tipi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDeliveryMethod('delivery_point')}
                      className={`p-3 rounded-xl border-2 text-center text-sm transition-all ${
                        deliveryMethod === 'delivery_point'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      🏪 Teslim Noktası
                    </button>
                    <button
                      onClick={() => setDeliveryMethod('custom_location')}
                      className={`p-3 rounded-xl border-2 text-center text-sm transition-all ${
                        deliveryMethod === 'custom_location'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      📍 Özel Konum
                    </button>
                  </div>
                </div>

                {/* Teslim Noktası Seçimi */}
                {deliveryMethod === 'delivery_point' && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Teslim Noktası Seçin
                    </label>
                    {deliveryPoints.length > 0 ? (
                      <select
                        value={deliveryPointId}
                        onChange={(e) => setDeliveryPointId(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
                      >
                        <option value="">Seçiniz...</option>
                        {deliveryPoints.map(dp => (
                          <option key={dp.id} value={dp.id}>
                            {dp.name} — {dp.address}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-500">Teslim noktası yükleniyor...</p>
                    )}
                  </div>
                )}

                {/* Özel Konum */}
                {deliveryMethod === 'custom_location' && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Buluşma Noktası
                    </label>
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Örn: Konak Meydanı, Starbucks önü"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
                    />
                  </div>
                )}

                {/* Tarih ve Saat */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      📅 Tarih
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      ⏰ Saat
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
                    />
                  </div>
                </div>

                {/* Bilgi Notu */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700">
                    💡 {deliveryAction === 'counter' 
                      ? 'Karşı öneriniz karşı tarafa iletilecek. Onayladığında QR kod oluşturulur.'
                      : 'Öneriniz karşı tarafa iletilecek. Onayladığında veya karşı öneri yaptığında bilgilendirileceksiniz.'
                    }
                  </p>
                </div>

                {/* Gönder Butonu */}
                <button
                  onClick={submitDeliveryProposal}
                  disabled={deliveryLoading || 
                    (deliveryMethod === 'delivery_point' && !deliveryPointId) ||
                    (deliveryMethod === 'custom_location' && !customLocation)
                  }
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deliveryLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      {deliveryAction === 'counter' ? 'Karşı Öneri Gönder' : 'Teslimat Önerisi Gönder'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ANLAŞMAZLIK / SORUN BİLDİR MODALI — GÖREV 46 ═══ */}
      {showDisputeModal && disputeSwapId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => resetDisputeModal()}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-7 h-7 text-violet-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Anlaşmazlık Bildirimi</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sorununuzu detaylı bildirin, admin ekibi adil bir karar verecektir.
                </p>
              </div>

              {/* 1. İletişim Email Adresi — GÖREV 46 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📧 İletişim E-posta Adresiniz <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={disputeContactEmail}
                  onChange={(e) => setDisputeContactEmail(e.target.value)}
                  placeholder="size@email.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-0 bg-white text-gray-900 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Admin sizinle bu email üzerinden iletişime geçecektir.</p>
              </div>

              {/* 2. Anlaşmazlık Kategorisi — GÖREV 46 (8 seçenek) */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📋 Anlaşmazlık Türü <span className="text-red-500">*</span>
                </label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-0 bg-white text-gray-900 text-sm"
                >
                  <option value="">Seçiniz...</option>
                  <option value="product_mismatch">📋 Ürün açıklamayla uyuşmuyor</option>
                  <option value="product_damaged">💥 Ürün hasarlı/kusurlu geldi</option>
                  <option value="product_not_delivered">📦 Ürün teslim edilmedi</option>
                  <option value="wrong_product">❌ Yanlış ürün gönderildi</option>
                  <option value="valor_dispute">💰 VALOR değeri anlaşmazlığı</option>
                  <option value="communication_issue">📱 İletişim sorunu</option>
                  <option value="fraud_suspicion">🚨 Dolandırıcılık şüphesi</option>
                  <option value="other">💬 Diğer</option>
                </select>
              </div>

              {/* 3. Detaylı Açıklama — GÖREV 46 (50 karakter min) */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Detaylı Açıklama <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-1">(min. 50 karakter)</span>
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Lütfen sorunu detaylı olarak açıklayın. Ne oldu? Ne bekliyordunuz? Minimum 50 karakter."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-0 text-sm resize-none"
                />
                <div className="flex justify-between mt-1">
                  <p className={`text-xs ${disputeDescription.length >= 50 ? 'text-green-500' : 'text-red-400'}`}>
                    {disputeDescription.length}/50 karakter {disputeDescription.length >= 50 ? '✓' : ''}
                  </p>
                </div>
              </div>

              {/* 4. Beklenen Çözüm — GÖREV 46 (6 seçenek) */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ✅ Beklenen Çözüm <span className="text-red-500">*</span>
                </label>
                <select
                  value={disputeExpectedResolution}
                  onChange={(e) => setDisputeExpectedResolution(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-0 bg-white text-gray-900 text-sm"
                >
                  <option value="">Seçiniz...</option>
                  <option value="refund_valor">💰 VALOR iadesi</option>
                  <option value="product_return">📦 Ürün iadesi</option>
                  <option value="replacement">🔄 Değişim</option>
                  <option value="partial_refund">💵 Kısmi VALOR iadesi</option>
                  <option value="apology">🤝 Özür / uyarı yeterli</option>
                  <option value="other">💬 Diğer</option>
                </select>
              </div>

              {/* 5. Kanıt Fotoğrafları — GÖREV 46 (opsiyonel, max 5) */}
              <div className="mb-4 p-4 rounded-xl bg-violet-50 border-2 border-violet-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-violet-800">
                    📸 Kanıt Fotoğrafları <span className="text-gray-500 font-normal">(opsiyonel)</span>
                  </p>
                  <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                    {disputePhotos.length}/5
                  </span>
                </div>
                <p className="text-xs text-violet-600 mb-3">
                  Hasarlı ürün, yanlış ürün vb. fotoğraflarını yükleyebilirsiniz. (max 5 adet, her biri max 5MB)
                </p>
                
                <input
                  ref={disputePhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleDisputePhotoUpload}
                  className="hidden"
                />
                
                {/* Yüklenen fotoğraflar grid */}
                {disputePhotos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {disputePhotos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                        <img src={photo} alt={`Kanıt ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setDisputePhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {disputePhotos.length < 5 && (
                  <button
                    onClick={() => disputePhotoInputRef.current?.click()}
                    disabled={uploadingDisputePhoto}
                    className="w-full py-2.5 border-2 border-dashed border-violet-300 rounded-xl text-violet-600 text-sm font-medium hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
                  >
                    {uploadingDisputePhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>📷 Fotoğraf Ekle</>
                    )}
                  </button>
                )}
                
                {disputePhotos.length > 0 && (
                  <p className="mt-2 text-xs text-green-600 text-center font-medium">
                    ✅ {disputePhotos.length} fotoğraf yüklendi
                  </p>
                )}
              </div>

              {/* Uyarı */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-5">
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Asılsız veya yanlış raporlar güven puanınızı düşürebilir. 
                    Lütfen sadece gerçek sorunları bildirin.
                  </span>
                </p>
              </div>

              {/* Süreç Bilgisi */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-5">
                <p className="text-xs text-blue-700 font-semibold mb-1">📋 Süreç nasıl işler?</p>
                <ol className="text-[10px] text-blue-600 space-y-1 list-decimal pl-4">
                  <li>Bildiriminiz admin ekibine iletilir</li>
                  <li>AI destekli ön analiz yapılır</li>
                  <li>Her iki tarafın bilgileri ve kanıtlar incelenir</li>
                  <li>Admin adil bir karar verir</li>
                  <li>Karar email ile size bildirilir</li>
                </ol>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3">
                <button
                  onClick={resetDisputeModal}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-400 rounded-xl font-medium text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmitDispute}
                  disabled={
                    disputeSubmitting || 
                    !disputeType || 
                    disputeDescription.length < 50 ||
                    !disputeContactEmail ||
                    !disputeExpectedResolution
                  }
                  className={`flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 ${
                    disputeType && disputeDescription.length >= 50 && disputeContactEmail && disputeExpectedResolution
                      ? 'bg-violet-600 hover:bg-violet-700' 
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {disputeSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>📩 Bildirim Gönder</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TESLİM TARİHİ GÜNCELLEME MODALI (GÖREV 8) ═══ */}
      <AnimatePresence>
        {showDeliveryDateModal && deliveryDateSwapId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowDeliveryDateModal(false)
              setDeliveryDateSwapId(null)
              setProposedDeliveryDate('')
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">📅 Yeni Teslim Tarihi Belirle</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Karşı tarafın onayı ile teslim tarihi güncellenecektir.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Yeni Teslim Tarihi ve Saati <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={proposedDeliveryDate}
                  onChange={(e) => setProposedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-yellow-500 focus:ring-0 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 mb-5">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">📋 Nasıl çalışır?</p>
                <ul className="text-[10px] text-blue-600 dark:text-blue-400 space-y-1 list-disc pl-4">
                  <li>Öneriniz karşı tarafa gönderilir</li>
                  <li>Karşı taraf kabul ederse tarih kesinleşir</li>
                  <li>Karşı taraf reddetirse yeni öneri yapabilirsiniz</li>
                  <li>Her iki tarafın onayı gereklidir</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeliveryDateModal(false)
                    setDeliveryDateSwapId(null)
                    setProposedDeliveryDate('')
                  }}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    if (proposedDeliveryDate && deliveryDateSwapId) {
                      handleProposeDeliveryDate(deliveryDateSwapId, proposedDeliveryDate)
                    }
                  }}
                  disabled={!proposedDeliveryDate || deliveryDateLoading}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deliveryDateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>📅 Tarih Öner</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ GÖREV 14: TAKAS İPTAL MODALI ═══ */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setShowCancelModal(false)
              setCancelSwapId(null)
              setSelectedCancelReason('')
              setCustomCancelReason('')
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {cancelSwapStatus === 'pending' ? 'Teklifi Geri Çek' : 'Takası İptal Et'}
                      </h3>
                      <p className="text-sm text-gray-400 dark:text-gray-400">İptal nedenini seçin</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCancelModal(false)
                      setCancelSwapId(null)
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* İptal Nedenleri */}
              <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                {CANCEL_REASONS.map((reason) => (
                  <label
                    key={reason.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedCancelReason === reason.key
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason.key}
                      checked={selectedCancelReason === reason.key}
                      onChange={(e) => setSelectedCancelReason(e.target.value)}
                      className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {reason.label}
                      </span>
                      {reason.penaltyTarget === 'other_party' && (
                        <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
                          (Karşı tarafa ceza)
                        </span>
                      )}
                      {reason.penaltyTarget === 'canceller' && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (Size ceza uygulanabilir)
                        </span>
                      )}
                    </div>
                  </label>
                ))}

                {/* Diğer seçildiğinde açıklama alanı */}
                {selectedCancelReason === 'other' && (
                  <div className="mt-3">
                    <textarea
                      value={customCancelReason}
                      onChange={(e) => setCustomCancelReason(e.target.value)}
                      placeholder="İptal nedeninizi açıklayın..."
                      className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Ceza Uyarısı */}
              <div className="px-5 pb-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-bold mb-1">⚠️ Güven Puanı Cezaları:</p>
                      <ul className="space-y-0.5 list-disc pl-4">
                        <li>Teslim öncesi iptal: <strong>-3 puan</strong></li>
                        <li>Teslim tarihi geçtikten sonra: <strong>-10 puan</strong></li>
                        <li>Teslim alındıktan sonra: <strong>-15 puan</strong></li>
                        <li>Karşı tarafın hatası ise: <strong>Ceza yok</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Butonlar */}
              <div className="p-5 pt-0 flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false)
                    setCancelSwapId(null)
                    setSelectedCancelReason('')
                    setCustomCancelReason('')
                  }}
                  className="flex-1 py-3 border-2 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Vazgeç
                </button>
                <button
                  onClick={() => handleCancelSwap(cancelSwapId || '')}
                  disabled={!selectedCancelReason || cancelLoading || (selectedCancelReason === 'other' && !customCancelReason.trim())}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>❌ {cancelSwapStatus === 'pending' ? 'Teklifi Geri Çek' : 'Takası İptal Et'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ QR TARAMA MODALI — KAMERA ═══ */}
      {showQrScanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            <h3 className="text-white font-bold text-lg">📷 QR Kod Tarat</h3>
            <button 
              onClick={() => { stopCamera(); setShowQrScanModal(false); setShowManualInput(false) }}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              ✕
            </button>
          </div>
          
          {/* Kamera Alanı */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div 
              id={qrScannerContainerId} 
              className="w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden bg-gray-900"
              style={{ minHeight: '300px' }}
            />
            
            {cameraError && (
              <div className="mt-4 p-3 bg-red-500/20 rounded-xl max-w-sm">
                <p className="text-sm text-red-200 text-center">{cameraError}</p>
              </div>
            )}
            
            {isScanning && !cameraError && (
              <p className="mt-4 text-white/70 text-sm animate-pulse">
                📱 QR kodu kameraya gösterin...
              </p>
            )}
          </div>
          
          {/* Alt Butonlar */}
          <div className="p-4 bg-black/50 space-y-3">
            {!isScanning && !cameraError && (
              <button onClick={() => startCamera()}
                className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold text-sm">
                📷 Kamerayı Yeniden Başlat
              </button>
            )}
            
            {cameraError && (
              <button onClick={() => startCamera()}
                className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold text-sm">
                🔄 Tekrar Dene
              </button>
            )}
            
            {/* Manuel Giriş Butonu */}
            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 border border-white/20 transition-colors"
            >
              ✏️ Manuel Giriş
              <span className="text-xs">{showManualInput ? '▲' : '▼'}</span>
            </button>

            {/* Manuel giriş alanı - toggle ile açılır */}
            {showManualInput && (
              <div className="flex flex-col sm:flex-row gap-2 w-full mt-3 animate-in slide-in-from-top-2 duration-200">
                <input
                  type="text"
                  value={scanInput[qrScanSwapId || ''] || ''}
                  onChange={(e) => setScanInput(prev => ({ 
                    ...prev, 
                    [qrScanSwapId || '']: e.target.value.toUpperCase() 
                  }))}
                  placeholder="QR kodu girin: TAKAS-..."
                  className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 text-sm placeholder-white/40 focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  autoFocus
                />
                <button 
                  onClick={() => {
                    const code = scanInput[qrScanSwapId || ''] || ''
                    if (code.startsWith('TAKAS-') && qrScanSwapId) {
                      stopCamera()
                      handleScanQR(qrScanSwapId, code)
                      setShowQrScanModal(false)
                      setShowManualInput(false)
                    }
                  }}
                  disabled={!(scanInput[qrScanSwapId || ''] || '').startsWith('TAKAS-')}
                  className="w-full sm:w-auto px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
                >
                  ✓ Onayla
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TEKİL MobileSwapActionBar — selectedSwap üzerinden ═══ */}
      {selectedSwapData && (
        <MobileSwapActionBar
          swapRequestId={selectedSwapData.id}
          status={selectedSwapData.status}
          isReceiverSide={selectedSwapData.ownerId === currentUserId}
          onAction={handleMobileSwapAction}
        />
      )}
    </main>
  )
}
// Trigger Vercel deploy - Wed Feb 25 07:55:06 UTC 2026