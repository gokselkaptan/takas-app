'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  QrCode, Check, X, Clock, AlertTriangle, Package, 
  MapPin, Camera, Send, ChevronRight, Loader2, Shield,
  CheckCircle, XCircle, MessageSquare, FileWarning, Star,
  Scan, Info, Percent, Upload, ImageIcon, Navigation, Mail, KeyRound,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getDisplayName } from '@/lib/display-name'
import { safeGet, safeFetch, isOffline } from '@/lib/safe-fetch'
import { triggerSwapConfetti, triggerValorConfetti } from '@/components/confetti-celebration'
import { playMatchSound, playCoinSound } from '@/lib/notification-sounds'
import { ValorAnimation, useValorAnimation } from '@/components/valor-animation'
import { useLanguage } from '@/lib/language-context'

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

interface NegotiationHistoryItem {
  id: string
  actionType: string
  proposedPrice: number | null
  previousPrice: number | null
  message: string | null
  createdAt: string
  isCurrentUser: boolean
}

interface DisputeWindowInfo {
  endsAt: string | null
  hoursTotal: number
  remainingHours: number
  isActive: boolean
  canOpenDispute: boolean
  canAutoComplete: boolean
}

interface SwapRequest {
  id: string
  status: string
  message: string | null
  qrCode: string | null
  qrCodeGeneratedAt: string | null
  deliveryMethod: string | null
  deliveryPointId: string | null
  customLocation: string | null
  deliveredAt: string | null
  deliveryConfirmDeadline: string | null
  receiverConfirmed: boolean
  pendingValorAmount: number | null
  createdAt: string
  // Pazarlık sistemi
  negotiationStatus: string | null
  agreedPriceRequester: number | null
  agreedPriceOwner: number | null
  priceAgreedAt: string | null
  deliveryVerificationCode: string | null
  // Counter offer
  counterOfferCount?: number
  maxCounterOffers?: number
  lastCounterOfferAt?: string | null
  // Dispute window
  disputeWindowEndsAt?: string | null
  riskTier?: string | null
  autoCompleteEligible?: boolean
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  }
  offeredProduct: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  } | null
  owner: {
    id: string
    name: string | null
    nickname: string | null
    image: string | null
  }
  requester: {
    id: string
    name: string | null
    nickname: string | null
    image: string | null
  }
  deliveryPoint?: {
    id: string
    name: string
    address: string
  } | null
}

interface DeliveryPoint {
  id: string
  name: string
  address: string
  city: string
  district: string
}

interface Props {
  userId: string
  type: 'offers' | 'swaps'
  highlightedSwapId?: string | null
}

export function SwapManagement({ userId, type, highlightedSwapId }: Props) {
  const { t, language } = useLanguage()
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([])
  
  // Modal states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null)
  
  // Form states
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery_point' | 'custom_location'>('delivery_point')
  const [selectedDeliveryPoint, setSelectedDeliveryPoint] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [scanInput, setScanInput] = useState('')
  const [disputeType, setDisputeType] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputePhotos, setDisputePhotos] = useState<string[]>([])
  const [uploadingDisputePhoto, setUploadingDisputePhoto] = useState(false)
  const disputePhotoInputRef = useRef<HTMLInputElement>(null)
  const disputeCameraInputRef = useRef<HTMLInputElement>(null)
  const [showFirstSwapGuide, setShowFirstSwapGuide] = useState(false)
  
  // Mobil cihaz tespiti
  const [isMobile, setIsMobile] = useState(false)
  
  // Action states
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Camera QR scanning with html5-qrcode
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const html5QrCodeRef = useRef<any>(null)
  const qrScannerContainerId = 'qr-reader-container'
  
  // İki aşamalı QR tarama
  const [scanStep, setScanStep] = useState<'qr' | 'verify'>('qr')
  const [verificationCode, setVerificationCode] = useState('')
  const [scannedQrCode, setScannedQrCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  
  // Email ile kod gönderme
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  
  // Alıcı için direkt kod girme modal
  const [showEnterCodeModal, setShowEnterCodeModal] = useState(false)
  const [directVerificationCode, setDirectVerificationCode] = useState('')
  
  // Fee preview
  const [feePreview, setFeePreview] = useState<{ fee: number; netAmount: number; rate: string } | null>(null)
  
  // Pazarlık states
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [proposedPrice, setProposedPrice] = useState('')
  
  // Pazarlık Geçmişi states
  const [showNegotiationHistoryModal, setShowNegotiationHistoryModal] = useState(false)
  const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [counterOfferPrice, setCounterOfferPrice] = useState('')
  const [counterOfferMessage, setCounterOfferMessage] = useState('')
  
  // Dispute Window states
  const [disputeWindowInfo, setDisputeWindowInfo] = useState<DisputeWindowInfo | null>(null)
  const [showDisputeWindowModal, setShowDisputeWindowModal] = useState(false)

  // Valor animation
  const { show: showValorAnim, amount: valorAmount, showValor, hideValor } = useValorAnimation()

  useEffect(() => {
    if (userId) {
      fetchSwapRequests()
      fetchDeliveryPoints()
    }
    
    // 30 saniyede bir otomatik yenile
    const interval = setInterval(() => {
      if (userId) {
        fetchSwapRequests()
      }
    }, 30000)

    // Service Worker'dan REFRESH_SWAPS mesajı gelince anında yenile
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_SWAPS') {
        fetchSwapRequests()
        playCoinSound() // bildirim sesi çal
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      clearInterval(interval)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [type, userId])
  
  // html5-qrcode cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState()
          if (state === Html5QrcodeScannerState.SCANNING) {
            html5QrCodeRef.current.stop().catch(() => {})
          }
        } catch {
          // Ignore cleanup errors
        }
        html5QrCodeRef.current = null
      }
    }
  }, [])
  
  // İlk takas rehberi kontrolü
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenGuide = localStorage.getItem('hasSeenSwapGuide')
      // Eğer ilk kez teslimat modal'ını açıyorsa ve rehberi görmemişse
      if (showDeliveryModal && !hasSeenGuide) {
        setShowFirstSwapGuide(true)
      }
    }
  }, [showDeliveryModal])
  
  const dismissGuide = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenSwapGuide', 'true')
    }
    setShowFirstSwapGuide(false)
  }
  
  // Mobil cihaz tespiti useEffect
  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
  }, [])
  
  // Fiyat önerisi gönder
  const handleProposePrice = async () => {
    if (!selectedSwap || !proposedPrice) return
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSwap.id,
          action: 'propose_price',
          proposedPrice: parseInt(proposedPrice)
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotSendPrice'))
      
      await fetchSwapRequests()
      setShowPriceModal(false)
      setProposedPrice('')
      
      if (data.priceAgreed) {
        setSuccess(`🤝 ${data.agreedPrice} ${t('smPriceAgreedSuccess')}`)
      } else {
        setSuccess(t('smPriceSent'))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }
  
  // Takası başlat (fiyat anlaşması sonrası)
  const handleConfirmSwap = async (swapId: string) => {
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapId, action: 'confirm_swap' }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotStartSwap'))
      
      await fetchSwapRequests()
      setSuccess(`${t('smSwapConfirmed')} QR: ${data.qrCode?.slice(0, 20)}... Code: ${data.verificationCode}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }
  


  const fetchSwapRequests = async () => {
    if (isOffline()) {
      setError(t('smNoConnection'))
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      // Hem gelen (received) hem de gönderilen (sent) talepleri çek - paralel ve timeout ile
      const [receivedResult, sentResult] = await Promise.all([
        safeGet('/api/swap-requests?type=received', { timeout: 12000 }),
        safeGet('/api/swap-requests?type=sent', { timeout: 12000 }),
      ])
      
      let receivedData: SwapRequest[] = []
      let sentData: SwapRequest[] = []
      
      if (receivedResult.ok && receivedResult.data) {
        const receivedJson = receivedResult.data
        receivedData = Array.isArray(receivedJson) ? receivedJson : (receivedJson.requests || [])
      }
      
      if (sentResult.ok && sentResult.data) {
        const sentJson = sentResult.data
        sentData = Array.isArray(sentJson) ? sentJson : (sentJson.requests || [])
      }
      
      // İki listeyi birleştir ve tekrar edenleri kaldır
      const combined = [...receivedData, ...sentData]
      const uniqueSwaps = combined.reduce((acc: SwapRequest[], swap) => {
        if (!acc.find(s => s.id === swap.id)) {
          acc.push(swap)
        }
        return acc
      }, [])
      
      // Tarihe göre sırala (en yeni en üstte)
      uniqueSwaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      setSwapRequests(uniqueSwaps)
      
      // Hata varsa göster
      if (!receivedResult.ok && !sentResult.ok) {
        setError(receivedResult.error || sentResult.error || t('smCouldNotLoadOffers'))
      }
    } catch (err) {
      console.error('Swap requests fetch error:', err)
      setError(t('smErrorLoadingOffers'))
    } finally {
      setLoading(false)
    }
  }

  const fetchDeliveryPoints = async () => {
    try {
      const res = await fetch('/api/delivery-points')
      const data = await res.json()
      // API { points: [...], districts, total } formatında döndürüyor
      const points = Array.isArray(data) ? data : (data.points || [])
      setDeliveryPoints(points)
    } catch (err) {
      console.error('Delivery points fetch error:', err)
    }
  }

  // Pazarlık geçmişini getir
  const fetchNegotiationHistory = async (swapId: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/swap-requests/negotiate?swapId=${swapId}`)
      const data = await res.json()
      if (res.ok) {
        setNegotiationHistory(data.history || [])
      }
    } catch (err) {
      console.error('Negotiation history fetch error:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Pazarlık geçmişi modalını aç
  const openNegotiationHistory = async (swap: SwapRequest) => {
    setSelectedSwap(swap)
    setShowNegotiationHistoryModal(true)
    setCounterOfferPrice('')
    setCounterOfferMessage('')
    await fetchNegotiationHistory(swap.id)
  }

  // Karşı teklif gönder
  const handleCounterOffer = async () => {
    if (!selectedSwap || !counterOfferPrice) return
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId: selectedSwap.id,
          action: 'counter',
          proposedPrice: parseInt(counterOfferPrice),
          message: counterOfferMessage || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotSendCounterOffer'))
      setSuccess(data.message)
      setCounterOfferPrice('')
      setCounterOfferMessage('')
      await fetchNegotiationHistory(selectedSwap.id)
      await fetchSwapRequests()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Fiyatı kabul et
  const handleAcceptPrice = async () => {
    if (!selectedSwap) return
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId: selectedSwap.id,
          action: 'accept'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotAcceptPrice'))
      setSuccess(data.message)
      setShowNegotiationHistoryModal(false)
      await fetchSwapRequests()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Dispute window bilgisini getir
  const fetchDisputeWindowInfo = async (swapId: string) => {
    try {
      const res = await fetch(`/api/swap-requests/dispute?swapId=${swapId}`)
      const data = await res.json()
      if (res.ok) {
        setDisputeWindowInfo(data.disputeWindow)
      }
    } catch (err) {
      console.error('Dispute window fetch error:', err)
    }
  }

  // Dispute window modalını aç
  const openDisputeWindow = async (swap: SwapRequest) => {
    setSelectedSwap(swap)
    setShowDisputeWindowModal(true)
    await fetchDisputeWindowInfo(swap.id)
  }

  // Takas isteğini kabul et
  const handleAccept = async (swapId: string) => {
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapId, status: 'accepted' }),
      })
      if (!res.ok) throw new Error(t('smCouldNotAccept'))
      await fetchSwapRequests()
      setSuccess(t('smOfferAccepted'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Takas isteğini reddet
  const handleReject = async (swapId: string) => {
    setProcessing(true)
    setError('')
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapId, status: 'rejected' }),
      })
      if (!res.ok) throw new Error(t('smCouldNotReject'))
      await fetchSwapRequests()
      setSuccess(t('smOfferRejected'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Teslimat ayarla ve QR kod oluştur
  const handleSetupDelivery = async () => {
    if (!selectedSwap) return
    // Paketleme fotoğrafı artık opsiyonel
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: selectedSwap.id,
          deliveryMethod,
          deliveryPointId: deliveryMethod === 'delivery_point' ? selectedDeliveryPoint : null,
          customLocation: deliveryMethod === 'custom_location' ? customLocation : null,
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotSetupDelivery'))
      
      await fetchSwapRequests()
      setShowDeliveryModal(false)
      setSuccess(t('smQrCreated'))
      
      // QR kodunu göster
      const updatedSwap = swapRequests.find(s => s.id === selectedSwap.id)
      if (updatedSwap) {
        setSelectedSwap({ ...selectedSwap, qrCode: data.qrCode })
        setShowQRModal(true)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // html5-qrcode ile QR kod bulunduğunda çağrılacak callback
  const onQrCodeScanned = useCallback(async (decodedText: string) => {
    const qrValue = decodedText.toUpperCase()
    if (qrValue.startsWith('TAKAS-') || qrValue.length > 10) {
      setScanInput(qrValue)
      setIsScanning(false)
      // Kamerayı durdur
      await stopCamera()
      // Otomatik olarak taramayı başlat
      setTimeout(() => {
        handleScanQRStep1Auto(qrValue)
      }, 300)
    }
  }, [])
  
  // Otomatik QR tarama (kamera ile)
  const handleScanQRStep1Auto = async (qrCode: string) => {
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCode: qrCode,
          action: 'scan_qr'
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotScanQr'))
      
      stopCamera()
      setScannedQrCode(qrCode)
      
      if (data.alreadyScanned) {
        setScanStep('verify')
      } else {
        await fetchSwapRequests()
        setScanStep('verify')
        setSuccess(t('smQrScannedEmailSent'))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Satıcı: Email ile doğrulama kodu gönder (QR taramadan)
  const handleSendCodeViaEmail = async () => {
    if (!selectedSwap) return
    setSendingEmail(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send_code_email',
          swapRequestId: selectedSwap.id
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotSendEmail'))
      
      setEmailSent(true)
      setSuccess(data.message || t('smVerificationCodeSentSuccess'))
      await fetchSwapRequests()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingEmail(false)
    }
  }

  // Alıcı: Direkt kod ile teslimat onayla (QR taramadan)
  const handleDirectCodeVerification = async () => {
    if (!selectedSwap || !directVerificationCode) return
    if (directVerificationCode.length !== 6) {
      setError(t('smCodeMustBe6Digits'))
      return
    }
    
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCode: selectedSwap.qrCode,
          verificationCode: directVerificationCode.trim(),
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smVerificationFailed'))
      
      setShowEnterCodeModal(false)
      setDirectVerificationCode('')
      setSuccess(t('smDeliveryCompleted'))
      await fetchSwapRequests()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // html5-qrcode ile kamera başlat
  const startCamera = async () => {
    setCameraError('')
    setIsScanning(true)
    // Önce container'ı görünür yap
    setIsCameraActive(true)
    
    try {
      // Lazy load html5-qrcode modülü
      await loadQrScanner()
      // Eğer önceki scanner varsa ve aktifse, önce durdur
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState()
          if (state === Html5QrcodeScannerState.SCANNING) {
            await html5QrCodeRef.current.stop()
          }
        } catch {
          // Ignore errors while stopping
        }
        html5QrCodeRef.current = null
      }
      
      // Container'ın görünür olmasını bekle (DOM güncellenmesi için)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const container = document.getElementById(qrScannerContainerId)
      if (!container) {
        setCameraError(t('smQrScannerLoadFailed'))
        setIsScanning(false)
        setIsCameraActive(false)
        return
      }
      
      // Container'ın görünür olduğundan emin ol
      if (container.offsetParent === null) {
        setCameraError(t('smQrScannerNotVisible'))
        setIsScanning(false)
        setIsCameraActive(false)
        return
      }
      
      // Yeni Html5Qrcode instance oluştur
      html5QrCodeRef.current = new Html5Qrcode(qrScannerContainerId)
      
      // Kamera erişimi kontrolü
      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        setCameraError(t('smCameraNotFound'))
        setIsScanning(false)
        setIsCameraActive(false)
        return
      }
      
      console.log('Available cameras:', devices.map(d => d.label))
      
      // Arka kamerayı tercih et, yoksa ön kamerayı kullan
      let cameraId = devices[0].id
      const backCamera = devices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('arka') ||
        d.label.toLowerCase().includes('environment') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('0')  // Bazı cihazlarda "camera 0" arka kameradır
      )
      if (backCamera) {
        cameraId = backCamera.id
        console.log('Using back camera:', backCamera.label)
      } else if (devices.length > 1) {
        // Genellikle son kamera arka kameradır
        cameraId = devices[devices.length - 1].id
        console.log('Using last camera:', devices[devices.length - 1].label)
      }
      
      // Taramayı başlat - facingMode ile de dene
      try {
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },  // Önce facingMode ile dene
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onQrCodeScanned(decodedText)
          },
          () => {}
        )
        console.log('Camera started with facingMode: environment')
      } catch (facingModeErr) {
        console.log('facingMode failed, trying cameraId:', facingModeErr)
        // facingMode başarısız olursa cameraId ile dene
        await html5QrCodeRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onQrCodeScanned(decodedText)
          },
          () => {}
        )
        console.log('Camera started with cameraId')
      }
      
    } catch (err: any) {
      console.error('Camera start error:', err)
      setIsCameraActive(false)
      
      // Daha anlaşılır hata mesajları
      if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
        setCameraError(t('smCameraPermissionDenied'))
      } else if (err.message?.includes('NotFoundError') || err.name === 'NotFoundError') {
        setCameraError(t('smCameraNotFoundError'))
      } else if (err.message?.includes('NotReadableError') || err.name === 'NotReadableError') {
        setCameraError(t('smCameraInUse'))
      } else if (err.message?.includes('OverconstrainedError') || err.name === 'OverconstrainedError') {
        setCameraError(t('smCameraNotSupported'))
      } else {
        setCameraError(`${t('smCameraStartFailed')} ${err.message || t('smUnknownError')}. ${t('smManualEntryFallback')}`)
      }
      setIsScanning(false)
    }
  }

  // html5-qrcode kamerayı durdur
  const stopCamera = async () => {
    setIsScanning(false)
    setIsCameraActive(false)
    
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        console.log('Error stopping camera:', err)
      }
      html5QrCodeRef.current = null
    }
  }
  
  // Fotoğraf yükle (S3 presigned URL ile) - Sadece dispute için
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'dispute') => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploadingDisputePhoto(true)
    
    try {
      // Dispute photos için /api/disputes/photos endpoint'i kullan
      const res = await fetch('/api/disputes/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          disputeId: selectedSwap?.id || 'temp', // Geçici ID
        }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('smPresignedUrlFailed'))
      }
      
      const { uploadUrl, publicUrl } = await res.json()
      
      // S3'e PUT ile yükle
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      
      if (!uploadRes.ok) {
        throw new Error(t('smS3UploadFailed'))
      }
      
      // Maksimum 5 fotoğraf
      if (disputePhotos.length < 5) {
        setDisputePhotos(prev => [...prev, publicUrl])
      }
      setUploadingDisputePhoto(false)
    } catch (err: any) {
      console.error('Photo upload error:', err)
      setError(err.message || t('smPhotoUploadFailed'))
      setUploadingDisputePhoto(false)
    }
  }

  // QR kod tara - Aşama 1 (sadece QR tarama)
  const handleScanQRStep1 = async () => {
    if (!scanInput.trim()) return
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCode: scanInput.trim().toUpperCase(),
          action: 'scan_qr'
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smCouldNotScanQr'))
      
      stopCamera()
      setScannedQrCode(scanInput.trim().toUpperCase())
      
      if (data.alreadyScanned) {
        // QR zaten taranmış, direkt doğrulama adımına geç
        setScanStep('verify')
      } else {
        // QR başarıyla tarandı, email gönderildi
        await fetchSwapRequests()
        setScanStep('verify')
        setSuccess(t('smQrScannedEmailSent'))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }
  
  // QR kod tara - Aşama 2 (doğrulama kodu girme)
  const handleScanQRStep2 = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError(t('smEnter6DigitCodeError'))
      return
    }
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrCode: scannedQrCode || scanInput.trim().toUpperCase(),
          verificationCode: verificationCode.trim(),
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smVerificationFailed'))
      
      await fetchSwapRequests()
      setShowScanModal(false)
      setScanInput('')
      setVerificationCode('')
      setScannedQrCode('')
      setScanStep('qr')
      setSuccess(t('smDeliveryCompletedWithDispute'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }
  
  // Kesinti önizleme al
  const fetchFeePreview = async (amount: number) => {
    try {
      const res = await fetch(`/api/valor?action=preview&amount=${amount}`)
      const data = await res.json()
      setFeePreview({
        fee: data.totalFee,
        netAmount: data.netAmount,
        rate: `%${(data.effectiveRate * 100).toFixed(1)}`
      })
    } catch (err) {
      console.error('Fee preview error:', err)
    }
  }

  // Teslimatı onayla
  const handleConfirmDelivery = async (swapId: string) => {
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/swap-requests/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapRequestId: swapId, action: 'confirm' }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smConfirmFailed'))
      
      await fetchSwapRequests()
      setSuccess(`${t('smSwapCompletedValor')} ${data.valorTransferred} ${t('smValorTransferred')}`)
      
      // Takas tamamlandı - kutlama!
      triggerSwapConfetti()
      playMatchSound()
      setTimeout(() => {
        triggerValorConfetti()
        playCoinSound()
        showValor(data.valorTransferred || 25)
      }, 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Sorun bildir
  const handleOpenDispute = async () => {
    if (!selectedSwap || !disputeType || disputeDescription.length < 20) return
    if (disputePhotos.length === 0) {
      setError(t('smUploadAtLeast1Photo'))
      return
    }
    setProcessing(true)
    setError('')
    
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: selectedSwap.id,
          type: disputeType,
          description: disputeDescription,
          evidence: disputePhotos, // Fotoğrafları gönder
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('smReportCreationFailed'))
      
      await fetchSwapRequests()
      setShowDisputeModal(false)
      setDisputeType('')
      setDisputeDescription('')
      setDisputePhotos([])
      setSuccess(t('smReportCreated'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Status'a göre filtrele
  const filteredRequests = swapRequests.filter(swap => {
    if (type === 'offers') {
      // Bekleyen teklifler + reddedilen teklifler (hem gelen hem giden)
      return ['pending', 'rejected'].includes(swap.status)
    } else {
      // Aktif ve tamamlanmış takaslar (kabul edilmiş, teslimat bekliyor, qr tarandı, teslim edilmiş, tamamlanmış, sorunlu, iade)
      return ['accepted', 'awaiting_delivery', 'delivered', 'completed', 'disputed', 'refunded'].includes(swap.status)
    }
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'tr' ? 'tr-TR' : language === 'es' ? 'es-ES' : language === 'ca' ? 'ca-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      pending: { label: t('smStatusPending'), color: 'bg-yellow-100 text-yellow-700' },
      accepted: { label: t('smStatusAccepted'), color: 'bg-green-100 text-green-700' },
      rejected: { label: t('smStatusRejected'), color: 'bg-red-100 text-red-700' },
      awaiting_delivery: { label: t('smStatusAwaitingDelivery'), color: 'bg-blue-100 text-blue-700' },
      delivered: { label: t('smStatusDelivered'), color: 'bg-purple-100 text-purple-700' },
      completed: { label: t('smStatusCompleted'), color: 'bg-green-100 text-green-700' },
      disputed: { label: t('smStatusDisputed'), color: 'bg-red-100 text-red-700' },
      refunded: { label: t('smStatusRefunded'), color: 'bg-gray-100 text-gray-700' },
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  const getRemainingTime = (deadline: string) => {
    const remaining = new Date(deadline).getTime() - Date.now()
    if (remaining <= 0) return t('smTimeExpired')
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours} ${t('smHoursMinutes')} ${minutes} ${t('smMinutes')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hata/Başarı Mesajları */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-green-50 text-green-700 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Kod Tara Butonu (Alıcılar için) */}
      {type === 'swaps' && (
        <Button
          onClick={() => setShowScanModal(true)}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white"
        >
          <QrCode className="w-5 h-5 mr-2" />
          {t('smScanQrReceive')}
        </Button>
      )}

      {/* Boş Durum */}
      {filteredRequests.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-800 mb-1">
            {type === 'offers' ? t('smNoActiveOffers') : t('smNoActiveSwaps')}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {type === 'offers' 
              ? t('smOffersInfo')
              : t('smSwapsInfo')}
          </p>
          <Link href="/takas-firsatlari">
            <Button size="sm">{t('smViewSwapOpportunities')}</Button>
          </Link>
        </div>
      )}

      {/* Takas Listesi */}
      {filteredRequests.map((swap) => {
        const isOwner = swap.owner.id === userId
        const isRequester = swap.requester.id === userId
        const statusBadge = getStatusBadge(swap.status)
        const isHighlighted = highlightedSwapId === swap.id
        
        return (
          <motion.div
            key={swap.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${
              isHighlighted ? 'ring-2 ring-frozen-500 ring-offset-2 animate-pulse' : ''
            }`}
            ref={(el) => {
              // Highlighted olduğunda scroll into view
              if (isHighlighted && el) {
                setTimeout(() => {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 300)
              }
            }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
                <span className="text-xs text-gray-500">{formatDate(swap.createdAt)}</span>
              </div>
              {swap.status === 'delivered' && swap.deliveryConfirmDeadline && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="w-3 h-3" />
                  {t('smConfirmApprovalTime')} {getRemainingTime(swap.deliveryConfirmDeadline)}
                </div>
              )}
            </div>

            {/* Ürünler */}
            <div className="p-4">
              <div className="flex items-center gap-4">
                {/* İstenen Ürün */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">{t('smRequestedProduct')}</p>
                  <Link href={`/urun/${swap.product.id}`} className="flex items-center gap-3 group">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={swap.product.images[0] || '/images/placeholder.jpg'}
                        alt={swap.product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 group-hover:text-purple-600 line-clamp-1">
                        {swap.product.title}
                      </p>
                      <p className="text-sm text-purple-600 font-semibold">
                        {swap.product.valorPrice} Valor
                      </p>
                    </div>
                  </Link>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-300" />

                {/* Teklif Edilen Ürün veya Valor */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">{t('smInReturn')}</p>
                  {swap.offeredProduct ? (
                    <Link href={`/urun/${swap.offeredProduct.id}`} className="flex items-center gap-3 group">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                          src={swap.offeredProduct.images[0] || '/images/placeholder.jpg'}
                          alt={swap.offeredProduct.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 group-hover:text-purple-600 line-clamp-1">
                          {swap.offeredProduct.title}
                        </p>
                        <p className="text-sm text-purple-600 font-semibold">
                          {swap.offeredProduct.valorPrice} Valor
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold text-amber-600">{swap.product.valorPrice} Valor</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mesaj */}
              {swap.message && (
                <div className="mt-3 p-3 rounded-xl bg-gray-50">
                  <p className="text-sm text-gray-400">"{swap.message}"</p>
                  <p className="text-xs text-gray-400 mt-1">- {getDisplayName(swap.requester)}</p>
                </div>
              )}

              {/* Teslimat Bilgisi */}
              {swap.deliveryMethod && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50">
                  <div className="flex items-center gap-2 text-blue-700">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {swap.deliveryMethod === 'delivery_point' 
                        ? swap.deliveryPoint?.name || t('smDeliveryPoint')
                        : swap.customLocation}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Aksiyonlar */}
            <div className="p-4 border-t bg-gray-50">
              {/* Kesinti Bilgisi - Takas sırasında göster */}
              {(swap.status === 'pending' || swap.status === 'accepted' || swap.status === 'awaiting_delivery') && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Percent className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">{t('smSystemFeeInfo')}</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    {t('smFeeOnCompletion')}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <span className="text-amber-600 font-semibold">{swap.product.valorPrice} Valor</span>
                      <p className="text-gray-400">{t('smProductValue')}</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <span className="text-amber-600 font-semibold">~%{swap.product.valorPrice <= 100 ? '5' : swap.product.valorPrice <= 500 ? '4' : swap.product.valorPrice <= 2000 ? '3' : '2'}</span>
                      <p className="text-gray-400">{t('smFeeRate')}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {t('smNetTransferInfo')}
                  </p>
                </div>
              )}
              
              {/* Pazarlık Durumu Gösterimi */}
              {swap.status === 'pending' && (
                <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{t('smNegotiationStatus')}</span>
                  </div>
                  
                  {/* Fiyat Önerileri */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className={`p-2 rounded-lg ${swap.agreedPriceRequester ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <p className="text-xs text-gray-500">{getDisplayName(swap.requester)} {t('smProposal')}</p>
                      <p className="font-semibold text-purple-700">
                        {swap.agreedPriceRequester !== null ? `${swap.agreedPriceRequester} Valor` : t('smNotYet')}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${swap.agreedPriceOwner ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <p className="text-xs text-gray-500">{getDisplayName(swap.owner)} {t('smProposal')}</p>
                      <p className="font-semibold text-green-700">
                        {swap.agreedPriceOwner !== null ? `${swap.agreedPriceOwner} Valor` : t('smNotYet')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Anlaşma Durumu */}
                  {swap.negotiationStatus === 'price_agreed' && (
                    <div className="mt-2 p-2 rounded-lg bg-green-100 border border-green-300">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">{t('smPriceAgreed')} {swap.pendingValorAmount || swap.agreedPriceRequester} Valor</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Pazarlık Geçmişi Butonu */}
                  <button
                    onClick={() => openNegotiationHistory(swap)}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {t('smViewNegotiationHistory')}
                  </button>
                </div>
              )}
              
              {/* Bekleyen Teklifler - Pazarlık Akışı */}
              {swap.status === 'pending' && (
                <div className="space-y-2">
                  {/* Fiyat anlaşması sağlandıysa - Takası Başlat */}
                  {swap.negotiationStatus === 'price_agreed' ? (
                    <Button
                      onClick={() => handleConfirmSwap(swap.id)}
                      disabled={processing}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('smStartSwap')} ({swap.pendingValorAmount || swap.agreedPriceRequester} Valor)
                    </Button>
                  ) : (
                    <>
                      {/* Fiyat Öner */}
                      <Button
                        onClick={() => {
                          setSelectedSwap(swap)
                          setProposedPrice(
                            (isOwner ? swap.agreedPriceOwner : swap.agreedPriceRequester)?.toString() || 
                            swap.product.valorPrice.toString()
                          )
                          setShowPriceModal(true)
                        }}
                        disabled={processing}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {(isOwner ? swap.agreedPriceOwner : swap.agreedPriceRequester) !== null 
                          ? t('smChangePrice') 
                          : t('smProposePrice')}
                      </Button>
                      
                      {/* Reddet */}
                      {isOwner && (
                        <Button
                          onClick={() => handleReject(swap.id)}
                          disabled={processing}
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" /> {t('smReject')}
                        </Button>
                      )}
                    </>
                  )}
                  
                  {!isOwner && swap.negotiationStatus !== 'price_agreed' && (
                    <p className="text-xs text-center text-gray-500">
                      {t('smNegotiationOngoing')}
                    </p>
                  )}
                </div>
              )}

              {/* Kabul Edilmiş - Satıcıya QR Kod ve Doğrulama Kodu Göster (SADECE SATICI) */}
              {swap.status === 'accepted' && swap.qrCode && isOwner && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <QrCode className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">{t('smSwapCodesReady')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white p-2 rounded-lg border">
                        <p className="text-xs text-gray-500">{t('smQrCode')}</p>
                        <p className="font-mono font-semibold text-xs break-all">{swap.qrCode?.slice(0, 20)}...</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border">
                        <p className="text-xs text-gray-500">{t('smSixDigitCode')}</p>
                        <p className="font-mono font-bold text-xl text-green-600 tracking-widest">{swap.deliveryVerificationCode}</p>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      {t('smShowCodesAtPoint')}
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowQRModal(true)
                    }}
                    className="w-full"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {t('smShowQrLarge')}
                  </Button>
                </div>
              )}
              
              {/* Kabul Edilmiş - Alıcıya Bilgilendirme (QR/Kod gösterme, sadece bilgi) */}
              {swap.status === 'accepted' && swap.qrCode && isRequester && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">{t('smSwapApproved')}</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {t('smSellerSetDelivery')}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    {t('smWaitForQr')}
                  </p>
                </div>
              )}
              
              {/* Kabul Edilmiş - Teslimat Ayarla (QR yoksa) */}
              {swap.status === 'accepted' && !swap.qrCode && isOwner && (
                <Button
                  onClick={() => {
                    setSelectedSwap(swap)
                    setShowDeliveryModal(true)
                  }}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {t('smSetDeliveryAndQr')}
                </Button>
              )}

              {/* Satıcı: QR Kodu Göster (awaiting_delivery veya qr_scanned) */}
              {swap.status === 'awaiting_delivery' && swap.qrCode && isOwner && (
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowQRModal(true)
                    }}
                    className="w-full"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {t('smShowQr')}
                  </Button>
                  {false && (
                    <p className="text-sm text-center text-indigo-600">
                      {t('smBuyerScannedQr')}
                    </p>
                  )}
                </div>
              )}

              {/* Alıcı: Teslimat Bekliyor - Kod Gir */}
              {swap.status === 'awaiting_delivery' && isRequester && (
                <div className="space-y-2">
                  {/* Bilgilendirme */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                    <Mail className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-blue-700 font-medium">{t('smWaitingForCode')}</p>
                    <p className="text-xs text-blue-600 mt-1">{t('smSellerWillSendCode')}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowEnterCodeModal(true)
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
                  >
                    <KeyRound className="w-4 h-4 mr-2" />
                    {t('smEnterCodeReceive')}
                  </Button>
                  <p className="text-xs text-center text-gray-500">
                    {t('smEmailCodeHint')}
                  </p>
                </div>
              )}

              {/* Alıcı: Kod Gönderildi - Doğrulama Kodu Gir */}
              {false && isRequester && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">{t('smCodeSentViaEmail')}</span>
                    </div>
                    <p className="text-sm text-green-700">
                      {t('smVerificationCodeSent')}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowEnterCodeModal(true)
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 py-6"
                  >
                    <KeyRound className="w-5 h-5 mr-2" />
                    {t('smEnterCodeReceive')}
                  </Button>
                </div>
              )}

              {/* Teslim Edildi - Onay/Sorun Bildir */}
              {swap.status === 'delivered' && isRequester && !swap.receiverConfirmed && (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleConfirmDelivery(swap.id)}
                    disabled={processing}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('smApproveProduct')}
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowDisputeModal(true)
                    }}
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <FileWarning className="w-4 h-4 mr-2" />
                    {t('smReportIssue')}
                  </Button>
                </div>
              )}

              {swap.status === 'delivered' && isOwner && (
                <p className="text-sm text-center text-purple-600">
                  {t('smWaitingBuyerApproval')}
                </p>
              )}

              {/* Teslim Edilmiş - İtiraz Süresi Butonu */}
              {swap.status === 'delivered' && (
                <button
                  onClick={() => openDisputeWindow(swap)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 text-sm text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
                >
                  <Clock className="w-4 h-4" />
                  {t('smViewDisputeWindow')}
                </button>
              )}

              {/* Tamamlandı */}
              {swap.status === 'completed' && (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t('smSwapCompleted')}</span>
                </div>
              )}

              {/* Sorun Bildirildi */}
              {swap.status === 'disputed' && (
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">{t('smIssueUnderReview')}</span>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}

      {/* Teslimat Modal */}
      <AnimatePresence>
        {showDeliveryModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowDeliveryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">{t('smSetDeliveryPoint')}</h3>
                
                {/* Yöntem Seçimi */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => setDeliveryMethod('delivery_point')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      deliveryMethod === 'delivery_point' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Navigation className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">{t('smSelectDeliveryPoint')}</p>
                        <p className="text-sm text-gray-500">{t('smDeliveryPointDesc')}</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setDeliveryMethod('custom_location')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      deliveryMethod === 'custom_location' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">{t('smCustomMeetingPoint')}</p>
                        <p className="text-sm text-gray-500">{t('smCustomMeetingDesc')}</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Teslim Noktası Seçimi - Gelişmiş Dropdown */}
                {deliveryMethod === 'delivery_point' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('smSelectDistrictAndPoint')}
                    </label>
                    
                    {/* İlçelere göre gruplandırılmış dropdown */}
                    <select
                      value={selectedDeliveryPoint}
                      onChange={(e) => setSelectedDeliveryPoint(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">{t('smSelectDeliveryPointPlaceholder')}</option>
                      
                      {/* İlçelere göre grupla */}
                      {Object.entries(
                        deliveryPoints.reduce((acc, dp) => {
                          const district = dp.district || t('smOther')
                          if (!acc[district]) acc[district] = []
                          acc[district].push(dp)
                          return acc
                        }, {} as Record<string, typeof deliveryPoints>)
                      ).map(([district, points]) => (
                        <optgroup key={district} label={`📍 ${district}`}>
                          {points.map((dp) => (
                            <option key={dp.id} value={dp.id}>
                              {dp.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    
                    {/* Seçilen nokta bilgisi */}
                    {selectedDeliveryPoint && (
                      <div className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200">
                        {(() => {
                          const selectedPoint = deliveryPoints.find(dp => dp.id === selectedDeliveryPoint)
                          if (!selectedPoint) return null
                          return (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium text-purple-800">{selectedPoint.name}</p>
                                <p className="text-sm text-purple-600">{selectedPoint.district}</p>
                                {selectedPoint.address && (
                                  <p className="text-xs text-gray-400 mt-1">{selectedPoint.address}</p>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Özel Konum */}
                {deliveryMethod === 'custom_location' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('smWriteMeetingPoint')}
                    </label>
                    <Textarea
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder={t('smCustomLocationPlaceholder')}
                      rows={3}
                      className="mb-2"
                    />
                    <p className="text-xs text-gray-500">
                      {t('smLocationTip')}
                    </p>
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeliveryModal(false)
                    }}
                    className="flex-1"
                  >
                    {t('smCancel')}
                  </Button>
                  <Button
                    onClick={handleSetupDelivery}
                    disabled={processing || 
                      (deliveryMethod === 'delivery_point' && !selectedDeliveryPoint) ||
                      (deliveryMethod === 'custom_location' && !customLocation)
                    }
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 mr-2" />
                        {t('smCreateQr')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Kod Modal - QR Resmi ile */}
      <AnimatePresence>
        {showQRModal && selectedSwap?.qrCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { setShowQRModal(false); setEmailSent(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 text-center max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('smDeliveryCode')}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('smDeliveryCodeDesc')}
              </p>
              
              {/* Doğrulama Kodu - Öne Çıkarılmış */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 mb-4 text-white">
                <p className="text-xs opacity-80 mb-1">{t('smVerificationCode6Digit')}</p>
                <p className="text-3xl font-mono font-bold tracking-[0.3em]">
                  {selectedSwap.deliveryVerificationCode || '------'}
                </p>
              </div>
              
              {/* Email Gönder Butonu - Ana Aksiyon */}
              <Button 
                onClick={handleSendCodeViaEmail}
                disabled={sendingEmail || emailSent}
                className={`w-full mb-3 py-6 text-lg ${
                  emailSent 
                    ? 'bg-green-500 hover:bg-green-500' 
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                }`}
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('smSending')}
                  </>
                ) : emailSent ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {t('smCodeSentViaEmailBtn')}
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    {t('smSendCodeToReceiver')}
                  </>
                )}
              </Button>
              
              {emailSent && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 mb-4">
                  <p className="text-sm text-green-700">
                    {t('smVerificationCodeSentToEmail')}
                  </p>
                </div>
              )}

              {/* Kullanım Senaryosu */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-4 text-left">
                <p className="text-xs font-semibold text-blue-700 mb-2">{t('smHowItWorks')}</p>
                <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                  <li>{t('smStep1DropProduct')}</li>
                  <li>{t('smStep2ClickSendCode')}</li>
                  <li>{t('smStep3ReceiverEntersCode')}</li>
                  <li>{t('smStep4DeliveryConfirmed')}</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <p className="text-sm text-amber-700">
                  <Shield className="w-4 h-4 inline mr-1" />
                  {t('smCodeValid24h')}
                </p>
              </div>
              
              {/* QR Kod - Alternatif Yöntem */}
              <details className="text-left mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  {t('smQrAlternativeMethod')}
                </summary>
                <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-center mb-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedSwap.qrCode)}`}
                      alt="QR Kod"
                      style={{ width: 150, height: 150 }}
                    />
                  </div>
                  <p className="text-xs font-mono text-gray-500 break-all text-center">
                    {selectedSwap.qrCode}
                  </p>
                </div>
              </details>

              <Button 
                onClick={() => { setShowQRModal(false); setEmailSent(false); }} 
                variant="outline"
                className="w-full"
              >
                {t('smClose')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kod Gir Modal - Alıcı için (QR taramadan direkt kod girme) */}
      <AnimatePresence>
        {showEnterCodeModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowEnterCodeModal(false)
              setDirectVerificationCode('')
              setError('')
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <KeyRound className="w-8 h-8 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-800">{t('smEnterVerificationCode')}</h3>
              </div>
              
              <p className="text-sm text-gray-500 text-center mb-4">
                {t('smEnterSellerCode')}
              </p>
              
              {/* Ürün Bilgisi */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                {selectedSwap.product.images?.[0] && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden">
                    <img
                      src={selectedSwap.product.images[0]}
                      alt={selectedSwap.product.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800 text-sm">{selectedSwap.product.title}</p>
                  <p className="text-xs text-gray-500">{t('smSeller')} {getDisplayName(selectedSwap.owner)}</p>
                </div>
              </div>
              
              {/* Kod Girişi */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('sm6DigitVerificationCode')}
                </label>
                <input
                  type="text"
                  value={directVerificationCode}
                  onChange={(e) => setDirectVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="______"
                  className="w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {t('smEnterEmailCode')}
                </p>
              </div>
              
              {/* Uyarı */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <p className="text-sm text-amber-700">
                  <Shield className="w-4 h-4 inline mr-1" />
                  {t('smCheckProductBeforeCode')}
                </p>
              </div>
              
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              {/* Butonlar */}
              <div className="space-y-2">
                <Button
                  onClick={handleDirectCodeVerification}
                  disabled={processing || directVerificationCode.length !== 6}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 py-6 text-lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('smProcessing')}
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      {t('smConfirmDelivery')}
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => {
                    setShowEnterCodeModal(false)
                    setDirectVerificationCode('')
                    setError('')
                  }}
                  variant="outline"
                  className="w-full"
                >
                  {t('smCancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Tara Modal - İki Aşamalı */}
      <AnimatePresence>
        {showScanModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              stopCamera()
              setShowScanModal(false)
              setScanStep('qr')
              setVerificationCode('')
              setScannedQrCode('')
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Aşama Göstergesi */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  scanStep === 'qr' ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                }`}>
                  {scanStep === 'qr' ? '1' : '✓'}
                </div>
                <div className="w-8 h-1 bg-gray-200 rounded">
                  <div className={`h-full rounded transition-all ${scanStep === 'verify' ? 'w-full bg-purple-500' : 'w-0'}`} />
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  scanStep === 'verify' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
              </div>
              
              {/* AŞAMA 1: QR Tarama */}
              {scanStep === 'qr' && (
                <>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <QrCode className="w-8 h-8 text-purple-600" />
                    <h3 className="text-xl font-bold text-gray-800">{t('smScanQrCode')}</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 text-center mb-4">
                    {t('smScanQrDesc')}
                  </p>
                  
                  {/* Kamera Görünümü - html5-qrcode ile Otomatik Tarama */}
                  <div className="mb-4">
                    {/* html5-qrcode container - her zaman DOM'da olmalı */}
                    <div 
                      className={`relative rounded-xl overflow-hidden bg-black ${isCameraActive ? 'block' : 'hidden'}`}
                    >
                      <div 
                        id={qrScannerContainerId} 
                        className="w-full"
                        style={{ minHeight: '300px' }}
                      />
                      {/* Tarama durumu */}
                      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
                        <span className="bg-black/70 text-white text-sm px-4 py-2 rounded-full inline-flex items-center gap-2">
                          {isScanning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('smSearchingQr')}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              {t('smQrFound')}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {isCameraActive ? (
                      <Button
                        variant="outline"
                        onClick={stopCamera}
                        className="w-full mt-2"
                        size="sm"
                      >
                        <X className="w-4 h-4 mr-1" /> {t('smCloseCamera')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={startCamera}
                          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 mb-3 py-6 text-lg"
                        >
                          <Camera className="w-6 h-6 mr-2" />
                          {t('smScanWithCamera')}
                        </Button>
                        <p className="text-xs text-center text-gray-500 mb-2">
                          {t('smPointCameraToQr')}
                        </p>
                        {cameraError && (
                          <p className="text-xs text-amber-600 text-center mb-2">{cameraError}</p>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Manuel Giriş */}
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-400 mb-2 text-center">
                      {t('smOrEnterManually')}
                    </p>
                    <input
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                      placeholder="TAKAS-XXXXXX-XXXX"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 text-center font-mono text-lg uppercase mb-4"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        stopCamera()
                        setShowScanModal(false)
                        setScanInput('')
                        setError('')
                        setCameraError('')
                      }}
                      className="flex-1"
                    >
                      {t('smCancel')}
                    </Button>
                    <Button
                      onClick={handleScanQRStep1}
                      disabled={processing || !scanInput.trim()}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Scan className="w-4 h-4 mr-2" />
                          {t('smScanQr')}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
              
              {/* AŞAMA 2: Doğrulama Kodu + Alıcı Fotoğrafı */}
              {scanStep === 'verify' && (
                <>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <h3 className="text-xl font-bold text-gray-800">{t('smConfirmDeliveryTitle')}</h3>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 mb-4">
                    <p className="text-sm text-green-700 text-center">
                      {t('smQrScannedSuccess')}<br/>
                      {t('smVerificationCodeSentToYourEmail')}
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-500 text-center mb-2">
                    {t('smEnter6DigitCode')}
                  </p>
                  
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-4 rounded-xl border-2 border-purple-300 focus:ring-2 focus:ring-purple-500 text-center font-mono text-3xl tracking-[0.5em] mb-4"
                  />
                  
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                    <p className="text-xs text-amber-700">
                      {t('smCheckProductBeforeCodeWarning')}
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setScanStep('qr')
                        setVerificationCode('')
                        setError('')
                      }}
                      className="flex-1"
                    >
                      {t('smBack')}
                    </Button>
                    <Button
                      onClick={handleScanQRStep2}
                      disabled={processing || verificationCode.length !== 6}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Teslim Al
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sorun Bildir Modal */}
      <AnimatePresence>
        {showDisputeModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowDisputeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <FileWarning className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">{t('smReportIssueTitle')}</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">
                  {t('smReportIssueDesc')}
                </p>

                {/* Sorun Türü */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('smIssueType')}
                  </label>
                  <select
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('smSelect')}</option>
                    <option value="not_as_described">{t('smNotAsDescribed')}</option>
                    <option value="defect">{t('smDefect')}</option>
                    <option value="damaged">{t('smDamaged')}</option>
                    <option value="missing_parts">{t('smMissingParts')}</option>
                    <option value="other">{t('smOther')}</option>
                  </select>
                </div>

                {/* Açıklama */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('smDetailedDescription')}
                  </label>
                  <Textarea
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder={t('smDescribeProblem')}
                    rows={3}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {disputeDescription.length}/20 {t('smCharacters')}
                  </p>
                </div>

                {/* Kanıt Fotoğrafları - ZORUNLU */}
                <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-800">{t('smEvidencePhotos')}</span>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    {t('smUploadEvidencePhotos')}
                  </p>
                  
                  {/* Mobil için tek input (kamera), Desktop için iki input (dosya + kamera) */}
                  {isMobile ? (
                    // MOBİL: Tek input - kamera ile fotoğraf çek
                    <input
                      ref={disputePhotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'dispute')}
                      className="hidden"
                    />
                  ) : (
                    // DESKTOP: İki ayrı input
                    <>
                      {/* Dosyadan seç input */}
                      <input
                        ref={disputePhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'dispute')}
                        className="hidden"
                      />
                      {/* Kamera input */}
                      <input
                        ref={disputeCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'dispute')}
                        className="hidden"
                      />
                    </>
                  )}
                  
                  {/* Yüklenen fotoğraflar */}
                  {disputePhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {disputePhotos.map((photo, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={photo}
                            alt={`${t('smEvidence')} ${index + 1}`}
                            className="object-cover rounded-lg w-full h-full"
                          />
                          <button
                            onClick={() => setDisputePhotos(prev => prev.filter((_, i) => i !== index))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {disputePhotos.length < 5 && (
                    <>
                      {isMobile ? (
                        // MOBİL: Tek buton - kamera
                        <Button
                          onClick={() => disputePhotoInputRef.current?.click()}
                          disabled={uploadingDisputePhoto}
                          size="sm"
                          className="w-full border-2 border-dashed border-red-400 bg-white hover:bg-red-50 text-red-600"
                        >
                          {uploadingDisputePhoto ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Camera className="w-4 h-4 mr-2" />
                              {disputePhotos.length === 0 ? t('smTakePhoto') : `${t('smTakePhotoWithCount')} (${disputePhotos.length}/5)`}
                            </>
                          )}
                        </Button>
                      ) : (
                        // DESKTOP: İki buton yan yana
                        <div className="flex gap-2">
                          <Button
                            onClick={() => disputePhotoInputRef.current?.click()}
                            disabled={uploadingDisputePhoto}
                            size="sm"
                            className="flex-1 border-2 border-dashed border-red-400 bg-white hover:bg-red-50 text-red-600"
                          >
                            {uploadingDisputePhoto ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {t('smSelectFile')}
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => disputeCameraInputRef.current?.click()}
                            disabled={uploadingDisputePhoto}
                            size="sm"
                            className="flex-1 border-2 border-dashed border-red-400 bg-white hover:bg-red-50 text-red-600"
                          >
                            {uploadingDisputePhoto ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-4 h-4 mr-2" />
                                {t('smCamera')}
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  
                  {disputePhotos.length > 0 && (
                    <div className="mt-2 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs text-center">
                      ✅ {disputePhotos.length} {t('smPhotosUploaded')}
                    </div>
                  )}
                </div>

                {/* Uyarı */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                  <p className="text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    {t('smFalseReportsWarning')}
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDisputeModal(false)
                      setDisputeType('')
                      setDisputeDescription('')
                      setDisputePhotos([])
                      setError('')
                    }}
                    className="flex-1"
                  >
                    {t('smCancel')}
                  </Button>
                  <Button
                    onClick={handleOpenDispute}
                    disabled={processing || !disputeType || disputeDescription.length < 20 || disputePhotos.length === 0}
                    className={`flex-1 ${disputePhotos.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400'}`}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('smSendReport')
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fiyat Önerme Modal */}
      <AnimatePresence>
        {showPriceModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowPriceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('smProposeNewPrice')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedSwap.product.title}</p>
                  </div>
                </div>
                
                {/* Mevcut Durum */}
                <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('smProductPrice')}</p>
                      <p className="font-semibold text-purple-600 dark:text-purple-400">{selectedSwap.product.valorPrice} Valor</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('smCounterPartyProposal')}</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {selectedSwap.owner.id === userId 
                          ? (selectedSwap.agreedPriceRequester !== null ? `${selectedSwap.agreedPriceRequester} Valor` : t('smNotYet'))
                          : (selectedSwap.agreedPriceOwner !== null ? `${selectedSwap.agreedPriceOwner} Valor` : t('smNotYet'))}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Fiyat Girişi */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('smYourPriceProposal')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      min="0"
                      max={selectedSwap.product.valorPrice * 2}
                      className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">Valor</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('smSamePriceTip')}
                  </p>
                </div>
                
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}
                
                {/* Butonlar */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPriceModal(false)
                      setProposedPrice('')
                      setError('')
                    }}
                    className="flex-1"
                  >
                    {t('smCancel')}
                  </Button>
                  <Button
                    onClick={handleProposePrice}
                    disabled={processing || !proposedPrice || parseInt(proposedPrice) < 0}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('smProposePrice')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* İlk Takas Rehberi Modal */}
      <AnimatePresence>
        {showFirstSwapGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onClick={dismissGuide}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                    <Package className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('smFirstSwapTitle')}</h2>
                  <p className="text-gray-400 mt-2">{t('smFirstSwapDesc')}</p>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900">{t('smStep1Title')}</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        {t('smStep1Desc')}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="font-bold text-purple-900">{t('smStep2Title')}</h3>
                      <p className="text-sm text-purple-700 mt-1">
                        {t('smStep2Desc')}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900">{t('smStep3Title')}</h3>
                      <p className="text-sm text-green-700 mt-1">
                        {t('smStep3Desc')}
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0">
                      4
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-900">{t('smStep4Title')}</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        {t('smStep4Desc')}
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-red-100 border border-red-200">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold shrink-0">
                      5
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900">{t('smStep5Title')}</h3>
                      <p className="text-sm text-red-700 mt-1">
                        {t('smStep5Desc')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 text-gray-700 shrink-0" />
                    <div>
                      <h4 className="font-bold text-gray-800">{t('smSecurityTips')}</h4>
                      <ul className="text-sm text-gray-400 mt-2 space-y-1">
                        <li>{t('smTip1')}</li>
                        <li>{t('smTip2')}</li>
                        <li>{t('smTip3')}</li>
                        <li>{t('smTip4')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Button */}
                <Button
                  onClick={dismissGuide}
                  className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 text-lg font-bold shadow-lg"
                >
                  {t('smGotItContinue')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pazarlık Geçmişi Modalı */}
      <AnimatePresence>
        {showNegotiationHistoryModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNegotiationHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    {t('smNegotiationHistory')}
                  </h2>
                  <button
                    onClick={() => setShowNegotiationHistoryModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Ürün Bilgisi */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white overflow-hidden">
                      <img
                        src={selectedSwap.product.images[0] || '/placeholder.png'}
                        alt={selectedSwap.product.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{selectedSwap.product.title}</p>
                      <p className="text-sm text-gray-500">
                        {t('smStarting')} {selectedSwap.product.valorPrice} Valor
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mevcut Durum */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-xs text-blue-600 mb-1">{t('smYourOffer')}</p>
                    <p className="text-lg font-bold text-blue-700">
                      {selectedSwap.agreedPriceRequester || '-'} V
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl text-center">
                    <p className="text-xs text-purple-600 mb-1">{t('smCounterOffer')}</p>
                    <p className="text-lg font-bold text-purple-700">
                      {selectedSwap.agreedPriceOwner || '-'} V
                    </p>
                  </div>
                </div>

                {/* Kalan Karşı Teklif Hakkı */}
                {selectedSwap.maxCounterOffers && (
                  <div className="p-3 bg-orange-50 rounded-xl mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-700">{t('smRemainingCounterOffers')}</span>
                      <span className="font-bold text-orange-600">
                        {(selectedSwap.maxCounterOffers || 5) - (selectedSwap.counterOfferCount || 0)} / {selectedSwap.maxCounterOffers || 5}
                      </span>
                    </div>
                  </div>
                )}

                {/* Geçmiş Timeline */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-3">{t('smNegotiationHistoryTitle')}</h3>
                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                    </div>
                  ) : negotiationHistory.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">{t('smNoNegotiationYet')}</p>
                  ) : (
                    <div className="space-y-3">
                      {negotiationHistory.map((item, index) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl ${
                            item.isCurrentUser 
                              ? 'bg-blue-50 border-l-4 border-blue-500' 
                              : 'bg-gray-50 border-l-4 border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${item.isCurrentUser ? 'text-blue-600' : 'text-gray-400'}`}>
                              {item.isCurrentUser ? t('smYou') : t('smCounterParty')}
                              {item.actionType === 'propose' && ` • ${t('smOffer')}`}
                              {item.actionType === 'counter' && ` • ${t('smCounterOfferLabel')}`}
                              {item.actionType === 'accept' && ` • ${t('smAcceptLabel')}`}
                              {item.actionType === 'reject' && ` • ${t('smRejectLabel')}`}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(item.createdAt).toLocaleString(language === 'tr' ? 'tr-TR' : language === 'es' ? 'es-ES' : language === 'ca' ? 'ca-ES' : 'en-US')}
                            </span>
                          </div>
                          {item.proposedPrice && (
                            <p className="font-bold text-gray-800">
                              {item.proposedPrice} Valor
                              {item.previousPrice && (
                                <span className="text-sm text-gray-400 ml-2">
                                  ({t('smPrevious')} {item.previousPrice})
                                </span>
                              )}
                            </p>
                          )}
                          {item.message && (
                            <p className="text-sm text-gray-400 mt-1">{item.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Karşı Teklif Formu */}
                {selectedSwap.negotiationStatus !== 'price_agreed' && 
                 selectedSwap.status === 'pending' && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-700 mb-3">{t('smSendCounterOffer')}</h3>
                    <div className="space-y-3">
                      <Input
                        type="number"
                        placeholder={t('smOfferPlaceholder')}
                        value={counterOfferPrice}
                        onChange={(e) => setCounterOfferPrice(e.target.value)}
                        className="bg-gray-50"
                      />
                      <Textarea
                        placeholder={t('smMessageOptional')}
                        value={counterOfferMessage}
                        onChange={(e) => setCounterOfferMessage(e.target.value)}
                        className="bg-gray-50"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCounterOffer}
                          disabled={!counterOfferPrice || processing}
                          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                          {processing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                          {t('smSendCounterOffer')}
                        </Button>
                        {selectedSwap.agreedPriceOwner && (
                          <Button
                            onClick={handleAcceptPrice}
                            disabled={processing}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
                          >
                            {processing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                            {selectedSwap.agreedPriceOwner} V {t('smAcceptOffer')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Anlaşma Durumu */}
                {selectedSwap.negotiationStatus === 'price_agreed' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-bold text-green-700">{t('smPriceAgreedTitle')}</p>
                        <p className="text-sm text-green-600">
                          {t('smAgreedPrice')} {selectedSwap.agreedPriceRequester} Valor
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispute Window Modalı */}
      <AnimatePresence>
        {showDisputeWindowModal && selectedSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDisputeWindowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    {t('smDisputeWindow')}
                  </h2>
                  <button
                    onClick={() => setShowDisputeWindowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {disputeWindowInfo ? (
                  <>
                    {/* Kalan Süre */}
                    <div className={`p-6 rounded-2xl mb-6 ${
                      disputeWindowInfo.isActive 
                        ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200' 
                        : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                    }`}>
                      <div className="text-center">
                        <p className={`text-sm mb-2 ${disputeWindowInfo.isActive ? 'text-orange-600' : 'text-green-600'}`}>
                          {disputeWindowInfo.isActive ? t('smRemainingDisputeTime') : t('smDisputeTimeExpired')}
                        </p>
                        <p className={`text-4xl font-bold ${disputeWindowInfo.isActive ? 'text-orange-700' : 'text-green-700'}`}>
                          {disputeWindowInfo.isActive ? `${disputeWindowInfo.remainingHours} ${t('smHours')}` : t('smCompleted')}
                        </p>
                        {disputeWindowInfo.endsAt && (
                          <p className="text-xs text-gray-500 mt-2">
                            {t('smEnd')} {new Date(disputeWindowInfo.endsAt).toLocaleString(language === 'tr' ? 'tr-TR' : language === 'es' ? 'es-ES' : language === 'ca' ? 'ca-ES' : 'en-US')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t('smStart')}</span>
                        <span>{disputeWindowInfo.hoursTotal} {t('smTotalHours')}</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            disputeWindowInfo.isActive 
                              ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                              : 'bg-gradient-to-r from-green-500 to-emerald-500'
                          }`}
                          style={{ 
                            width: `${100 - (disputeWindowInfo.remainingHours / disputeWindowInfo.hoursTotal * 100)}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Risk Seviyesi */}
                    {selectedSwap.riskTier && (
                      <div className={`p-4 rounded-xl mb-6 ${
                        selectedSwap.riskTier === 'low' ? 'bg-green-50' :
                        selectedSwap.riskTier === 'medium' ? 'bg-yellow-50' : 'bg-red-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{t('smRiskLevel')}</span>
                          <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                            selectedSwap.riskTier === 'low' ? 'bg-green-200 text-green-700' :
                            selectedSwap.riskTier === 'medium' ? 'bg-yellow-200 text-yellow-700' : 'bg-red-200 text-red-700'
                          }`}>
                            {selectedSwap.riskTier === 'low' ? t('smLow') :
                             selectedSwap.riskTier === 'medium' ? t('smMedium') : t('smHigh')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Açıklama */}
                    <div className="p-4 bg-blue-50 rounded-xl mb-6">
                      <h4 className="font-semibold text-blue-800 mb-2">{t('smDisputeWindowExplain')}</h4>
                      <p className="text-sm text-blue-700">
                        {t('smDisputeWindowDesc1')} {disputeWindowInfo.hoursTotal} {t('smDisputeWindowDesc2')}
                      </p>
                    </div>

                    {/* İtiraz Aç Butonu */}
                    {disputeWindowInfo.canOpenDispute && (
                      <Button
                        onClick={() => {
                          setShowDisputeWindowModal(false)
                          setShowDisputeModal(true)
                        }}
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 text-lg font-bold"
                      >
                        {t('smOpenDispute')}
                      </Button>
                    )}

                    {/* Auto-complete Bilgisi */}
                    {disputeWindowInfo.canAutoComplete && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <div>
                            <p className="font-semibold text-green-700">{t('smAutoComplete')}</p>
                            <p className="text-sm text-green-600">
                              {t('smAutoCompleteDesc')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Valor Animation */}
      <ValorAnimation amount={valorAmount} show={showValorAnim} onComplete={hideValor} />
    </div>
  )
}
