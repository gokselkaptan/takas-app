'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  QrCode, Check, X, Clock, AlertTriangle, Package, 
  MapPin, Camera, Send, ChevronRight, Loader2, Shield,
  CheckCircle, XCircle, MessageSquare, FileWarning, Star,
  Scan, Info, Percent, Upload, ImageIcon, Navigation
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getDisplayName } from '@/lib/display-name'
import jsQR from 'jsqr'

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
  const [showFirstSwapGuide, setShowFirstSwapGuide] = useState(false)
  
  // Action states
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Camera QR scanning
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  // İki aşamalı QR tarama
  const [scanStep, setScanStep] = useState<'qr' | 'verify'>('qr')
  const [verificationCode, setVerificationCode] = useState('')
  const [scannedQrCode, setScannedQrCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Fotoğraf yükleme states
  const [packagingPhoto, setPackagingPhoto] = useState<string | null>(null)
  const [receiverPhoto, setReceiverPhoto] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const packagingInputRef = useRef<HTMLInputElement>(null)
  const receiverInputRef = useRef<HTMLInputElement>(null)
  
  // Fee preview
  const [feePreview, setFeePreview] = useState<{ fee: number; netAmount: number; rate: string } | null>(null)
  
  // Pazarlık states
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [proposedPrice, setProposedPrice] = useState('')

  useEffect(() => {
    fetchSwapRequests()
    fetchDeliveryPoints()
  }, [type])
  
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
      if (!res.ok) throw new Error(data.error || 'Fiyat gönderilemedi')
      
      await fetchSwapRequests()
      setShowPriceModal(false)
      setProposedPrice('')
      
      if (data.priceAgreed) {
        setSuccess(`🤝 ${data.agreedPrice} Valor fiyatında anlaştınız! Takası başlatabilirsiniz.`)
      } else {
        setSuccess('Fiyat öneriniz gönderildi. Karşı tarafın onayı bekleniyor.')
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
      if (!res.ok) throw new Error(data.error || 'Takas başlatılamadı')
      
      await fetchSwapRequests()
      setSuccess(`✅ Takas onaylandı! QR Kod: ${data.qrCode?.slice(0, 20)}... Doğrulama: ${data.verificationCode}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }
  
  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const fetchSwapRequests = async () => {
    try {
      // Hem gelen (received) hem de gönderilen (sent) talepleri çek
      const [receivedRes, sentRes] = await Promise.all([
        fetch('/api/swap-requests?type=received'),
        fetch('/api/swap-requests?type=sent'),
      ])
      
      const receivedData = await receivedRes.json()
      const sentData = await sentRes.json()
      
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
    } catch (err) {
      console.error('Swap requests fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDeliveryPoints = async () => {
    try {
      const res = await fetch('/api/delivery-points')
      const data = await res.json()
      setDeliveryPoints(data)
    } catch (err) {
      console.error('Delivery points fetch error:', err)
    }
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
      if (!res.ok) throw new Error('Kabul edilemedi')
      await fetchSwapRequests()
      setSuccess('Takas teklifi kabul edildi!')
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
      if (!res.ok) throw new Error('Reddedilemedi')
      await fetchSwapRequests()
      setSuccess('Takas teklifi reddedildi')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Teslimat ayarla ve QR kod oluştur
  const handleSetupDelivery = async () => {
    if (!selectedSwap) return
    if (!packagingPhoto) {
      setError('Paketleme fotoğrafı zorunludur')
      return
    }
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
          packagingPhoto: packagingPhoto, // Paketleme fotoğrafı
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Teslimat ayarlanamadı')
      
      await fetchSwapRequests()
      setShowDeliveryModal(false)
      setPackagingPhoto(null) // Fotoğrafı temizle
      setSuccess('QR kod oluşturuldu! Alıcı bu kodu tarayarak ürünü teslim alabilir.')
      
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

  // jsQR ile QR kod tarama
  const scanQRFromVideo = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })
    
    if (code && code.data) {
      // QR kod bulundu!
      const qrValue = code.data.toUpperCase()
      if (qrValue.startsWith('TAKAS-') || qrValue.length > 10) {
        setScanInput(qrValue)
        setIsScanning(false)
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
        }
        // Otomatik olarak taramayı başlat
        setTimeout(() => {
          handleScanQRStep1Auto(qrValue)
        }, 300)
      }
    }
  }, [isCameraActive])
  
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
      if (!res.ok) throw new Error(data.error || 'QR kod taranamadı')
      
      stopCamera()
      setScannedQrCode(qrCode)
      
      if (data.alreadyScanned) {
        setScanStep('verify')
      } else {
        await fetchSwapRequests()
        setScanStep('verify')
        setSuccess('📧 QR tarandı! Email adresinize 6 haneli doğrulama kodu gönderildi.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // Kamera başlat
  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraActive(true)
      setIsScanning(true)
      
      // jsQR tarama döngüsü başlat
      scanIntervalRef.current = setInterval(() => {
        scanQRFromVideo()
      }, 200) // Her 200ms'de bir tara
    } catch (err: any) {
      console.error('Camera error:', err)
      setCameraError('Kamera erişimi sağlanamadı. Lütfen izin verin veya manuel kod girin.')
    }
  }

  // Kamera durdur
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setIsScanning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }
  
  // Fotoğraf yükle (base64)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'packaging' | 'receiver' | 'dispute') => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (type === 'dispute') {
      setUploadingDisputePhoto(true)
    } else {
      setUploadingPhoto(true)
    }
    
    try {
      // Dosyayı base64'e çevir
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        if (type === 'packaging') {
          setPackagingPhoto(base64)
        } else if (type === 'receiver') {
          setReceiverPhoto(base64)
        } else if (type === 'dispute') {
          // Maksimum 5 fotoğraf
          if (disputePhotos.length < 5) {
            setDisputePhotos(prev => [...prev, base64])
          }
        }
        if (type === 'dispute') {
          setUploadingDisputePhoto(false)
        } else {
          setUploadingPhoto(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Photo upload error:', err)
      setError('Fotoğraf yüklenemedi')
      if (type === 'dispute') {
        setUploadingDisputePhoto(false)
      } else {
        setUploadingPhoto(false)
      }
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
      if (!res.ok) throw new Error(data.error || 'QR kod taranamadı')
      
      stopCamera()
      setScannedQrCode(scanInput.trim().toUpperCase())
      
      if (data.alreadyScanned) {
        // QR zaten taranmış, direkt doğrulama adımına geç
        setScanStep('verify')
      } else {
        // QR başarıyla tarandı, email gönderildi
        await fetchSwapRequests()
        setScanStep('verify')
        setSuccess('📧 QR tarandı! Email adresinize 6 haneli doğrulama kodu gönderildi.')
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
      setError('Lütfen 6 haneli doğrulama kodunu girin')
      return
    }
    if (!receiverPhoto) {
      setError('Lütfen teslim fotoğrafı yükleyin - dispute durumunda kanıt olarak kullanılacak')
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
          receiverPhotos: [receiverPhoto] // Zorunlu fotoğraf
        }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Doğrulama başarısız')
      
      await fetchSwapRequests()
      setShowScanModal(false)
      setScanInput('')
      setVerificationCode('')
      setScannedQrCode('')
      setReceiverPhoto(null)
      setScanStep('qr')
      setSuccess('✅ Teslimat tamamlandı! 24 saat içinde sorun bildirmezseniz takas otomatik onaylanır.')
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
      if (!res.ok) throw new Error(data.error || 'Onay başarısız')
      
      await fetchSwapRequests()
      setSuccess(`Takas tamamlandı! Satıcıya ${data.valorTransferred} Valor aktarıldı.`)
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
      setError('Lütfen en az 1 fotoğraf yükleyin - kanıt olarak kullanılacak')
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
      if (!res.ok) throw new Error(data.error || 'Rapor oluşturulamadı')
      
      await fetchSwapRequests()
      setShowDisputeModal(false)
      setDisputeType('')
      setDisputeDescription('')
      setDisputePhotos([])
      setSuccess('Sorun raporu oluşturuldu. Admin ekibimiz 24 saat içinde inceleyecek.')
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
      return ['accepted', 'awaiting_delivery', 'qr_scanned', 'delivered', 'completed', 'disputed', 'refunded'].includes(swap.status)
    }
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700' },
      accepted: { label: 'Kabul Edildi', color: 'bg-green-100 text-green-700' },
      rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-700' },
      awaiting_delivery: { label: 'Teslimat Bekliyor', color: 'bg-blue-100 text-blue-700' },
      qr_scanned: { label: 'QR Tarandı', color: 'bg-indigo-100 text-indigo-700' },
      delivered: { label: 'Teslim Edildi', color: 'bg-purple-100 text-purple-700' },
      completed: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' },
      disputed: { label: 'Sorun Bildirildi', color: 'bg-red-100 text-red-700' },
      refunded: { label: 'İade Edildi', color: 'bg-gray-100 text-gray-700' },
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  const getRemainingTime = (deadline: string) => {
    const remaining = new Date(deadline).getTime() - Date.now()
    if (remaining <= 0) return 'Süre doldu'
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours} saat ${minutes} dakika`
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
          QR Kod Tara - Ürün Teslim Al
        </Button>
      )}

      {/* Boş Durum */}
      {filteredRequests.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-800 mb-1">
            {type === 'offers' ? 'Aktif Teklifiniz Yok' : 'Aktif Takasınız Yok'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {type === 'offers' 
              ? 'Ürünlerinize gelen teklifleri burada görebilirsiniz.'
              : 'Kabul edilmiş ve devam eden takaslarınız burada görünecek.'}
          </p>
          <Link href="/takas-firsatlari">
            <Button size="sm">Takas Fırsatlarını Gör</Button>
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
                  Onay süresi: {getRemainingTime(swap.deliveryConfirmDeadline)}
                </div>
              )}
            </div>

            {/* Ürünler */}
            <div className="p-4">
              <div className="flex items-center gap-4">
                {/* İstenen Ürün */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">İstenen Ürün</p>
                  <Link href={`/urun/${swap.product.id}`} className="flex items-center gap-3 group">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image
                        src={swap.product.images[0] || '/images/placeholder.jpg'}
                        alt={swap.product.title}
                        width={64}
                        height={64}
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
                  <p className="text-xs text-gray-500 mb-1">Karşılığında</p>
                  {swap.offeredProduct ? (
                    <Link href={`/urun/${swap.offeredProduct.id}`} className="flex items-center gap-3 group">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={swap.offeredProduct.images[0] || '/images/placeholder.jpg'}
                          alt={swap.offeredProduct.title}
                          width={64}
                          height={64}
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
                  <p className="text-sm text-gray-600">"{swap.message}"</p>
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
                        ? swap.deliveryPoint?.name || 'Teslim Noktası'
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
                    <span className="text-sm font-medium text-amber-800">Sistem Kesintisi Bilgisi</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Takas tamamlandığında sistem kesintisi alınacaktır:
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <span className="text-amber-600 font-semibold">{swap.product.valorPrice} Valor</span>
                      <p className="text-gray-600">Ürün Değeri</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <span className="text-amber-600 font-semibold">~%{swap.product.valorPrice <= 100 ? '5' : swap.product.valorPrice <= 500 ? '4' : swap.product.valorPrice <= 2000 ? '3' : '2'}</span>
                      <p className="text-gray-600">Kesinti Oranı</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Takas sonrası satıcıya net tutar aktarılır.
                  </p>
                </div>
              )}
              
              {/* Pazarlık Durumu Gösterimi */}
              {swap.status === 'pending' && (
                <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Pazarlık Durumu</span>
                  </div>
                  
                  {/* Fiyat Önerileri */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className={`p-2 rounded-lg ${swap.agreedPriceRequester ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <p className="text-xs text-gray-500">{getDisplayName(swap.requester)} önerisi:</p>
                      <p className="font-semibold text-purple-700">
                        {swap.agreedPriceRequester !== null ? `${swap.agreedPriceRequester} Valor` : 'Henüz yok'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${swap.agreedPriceOwner ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <p className="text-xs text-gray-500">{getDisplayName(swap.owner)} önerisi:</p>
                      <p className="font-semibold text-green-700">
                        {swap.agreedPriceOwner !== null ? `${swap.agreedPriceOwner} Valor` : 'Henüz yok'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Anlaşma Durumu */}
                  {swap.negotiationStatus === 'price_agreed' && (
                    <div className="mt-2 p-2 rounded-lg bg-green-100 border border-green-300">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Fiyat anlaşması sağlandı: {swap.pendingValorAmount || swap.agreedPriceRequester} Valor</span>
                      </div>
                    </div>
                  )}
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
                      Takası Başlat ({swap.pendingValorAmount || swap.agreedPriceRequester} Valor)
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
                          ? 'Fiyatı Değiştir' 
                          : 'Fiyat Öner'}
                      </Button>
                      
                      {/* Reddet */}
                      {isOwner && (
                        <Button
                          onClick={() => handleReject(swap.id)}
                          disabled={processing}
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" /> Reddet
                        </Button>
                      )}
                    </>
                  )}
                  
                  {!isOwner && swap.negotiationStatus !== 'price_agreed' && (
                    <p className="text-xs text-center text-gray-500">
                      Pazarlık devam ediyor. Karşı tarafla aynı fiyatı girdiğinizde anlaşma sağlanır.
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
                      <span className="font-medium text-green-800">Takas Kodları Hazır!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white p-2 rounded-lg border">
                        <p className="text-xs text-gray-500">QR Kod</p>
                        <p className="font-mono font-semibold text-xs break-all">{swap.qrCode?.slice(0, 20)}...</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border">
                        <p className="text-xs text-gray-500">6 Haneli Kod</p>
                        <p className="font-mono font-bold text-xl text-green-600 tracking-widest">{swap.deliveryVerificationCode}</p>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      📍 Teslim noktasında bu kodları alıcıya gösterin.
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
                    QR Kodu Büyük Göster
                  </Button>
                </div>
              )}
              
              {/* Kabul Edilmiş - Alıcıya Bilgilendirme (QR/Kod gösterme, sadece bilgi) */}
              {swap.status === 'accepted' && swap.qrCode && isRequester && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Takas Onaylandı!</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Satıcı teslimat noktasını belirledi. Buluşma zamanını mesaj üzerinden koordine edin.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    ⏳ Satıcıdan QR kodunu teslim noktasında alacaksınız.
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
                  Teslimat Noktası Belirle & QR Oluştur
                </Button>
              )}

              {/* Satıcı: QR Kodu Göster (awaiting_delivery veya qr_scanned) */}
              {(swap.status === 'awaiting_delivery' || swap.status === 'qr_scanned') && swap.qrCode && isOwner && (
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowQRModal(true)
                    }}
                    className="w-full"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    QR Kodu Göster
                  </Button>
                  {swap.status === 'qr_scanned' && (
                    <p className="text-sm text-center text-indigo-600">
                      ✅ Alıcı QR kodu taradı. Doğrulama kodu bekleniyor...
                    </p>
                  )}
                </div>
              )}

              {/* Alıcı: QR Kod Tara veya Doğrulama Kodu Gir */}
              {swap.status === 'awaiting_delivery' && isRequester && (
                <div className="space-y-2">
                  {/* QR Resmi göster (mesajdan alınan) */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                    <QrCode className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-blue-700 font-medium">Satıcıdan QR kodu aldınız mı?</p>
                    <p className="text-xs text-blue-600 mt-1">Mesajlar sekmesinde QR kodunu bulabilirsiniz.</p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowScanModal(true)
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    QR Kodu Tara
                  </Button>
                </div>
              )}

              {/* Alıcı: QR Tarandı - Doğrulama Kodu Gir */}
              {swap.status === 'qr_scanned' && isRequester && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                      <span className="font-medium text-indigo-800">QR Kod Tarandı!</span>
                    </div>
                    <p className="text-sm text-indigo-700">
                      📧 Email adresinize 6 haneli doğrulama kodu gönderildi.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedSwap(swap)
                      setShowScanModal(true)
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Doğrulama Kodu Gir & Teslim Al
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
                    Ürünü Onayla - Takası Tamamla
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
                    Sorun Bildir
                  </Button>
                </div>
              )}

              {swap.status === 'delivered' && isOwner && (
                <p className="text-sm text-center text-purple-600">
                  Alıcı onayı bekleniyor...
                </p>
              )}

              {/* Tamamlandı */}
              {swap.status === 'completed' && (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Takas Başarıyla Tamamlandı</span>
                </div>
              )}

              {/* Sorun Bildirildi */}
              {swap.status === 'disputed' && (
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Sorun inceleniyor...</span>
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
                <h3 className="text-xl font-bold text-gray-800 mb-4">📍 Teslimat Noktası Belirle</h3>
                
                {/* Paketleme Fotoğrafı - ZORUNLU */}
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-800">Paketleme Fotoğrafı (Zorunlu)</span>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    Ürünün paketlenmiş halinin fotoğrafını çekin. Bu, takas sürecinin güvenliği için gereklidir.
                  </p>
                  
                  <input
                    ref={packagingInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoUpload(e, 'packaging')}
                    className="hidden"
                  />
                  
                  {packagingPhoto ? (
                    <div className="relative">
                      <Image
                        src={packagingPhoto}
                        alt="Paketleme fotoğrafı"
                        width={200}
                        height={200}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => setPackagingPhoto(null)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Fotoğraf yüklendi
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => packagingInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      variant="outline"
                      className="w-full border-dashed border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 h-32"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                          <span className="text-amber-700">Fotoğraf Çek / Yükle</span>
                        </div>
                      )}
                    </Button>
                  )}
                </div>
                
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
                        <p className="font-medium">🗺️ Teslim Noktası Seç</p>
                        <p className="text-sm text-gray-500">İzmir'deki güvenli teslim noktalarından birini seçin</p>
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
                        <p className="font-medium">📍 Özel Buluşma Noktası</p>
                        <p className="text-sm text-gray-500">Alıcıyla mesajlaşarak belirleyin</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Teslim Noktası Seçimi - Gelişmiş Dropdown */}
                {deliveryMethod === 'delivery_point' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İlçe ve Teslim Noktası Seçin
                    </label>
                    
                    {/* İlçelere göre gruplandırılmış dropdown */}
                    <select
                      value={selectedDeliveryPoint}
                      onChange={(e) => setSelectedDeliveryPoint(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="">📍 Teslim noktası seçiniz...</option>
                      
                      {/* İlçelere göre grupla */}
                      {Object.entries(
                        deliveryPoints.reduce((acc, dp) => {
                          const district = dp.district || 'Diğer'
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
                                  <p className="text-xs text-gray-600 mt-1">{selectedPoint.address}</p>
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
                      Buluşma Noktasını Yazın
                    </label>
                    <Textarea
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Örn: Forum Bornova AVM, ana giriş önü, saat 14:00"
                      rows={3}
                      className="mb-2"
                    />
                    <p className="text-xs text-gray-500">
                      💡 İpucu: Saat ve detaylı konum bilgisi verin
                    </p>
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeliveryModal(false)
                      setPackagingPhoto(null)
                    }}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleSetupDelivery}
                    disabled={processing || 
                      !packagingPhoto ||
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
                        QR Kod Oluştur
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Uyarı - fotoğraf eksikse */}
                {!packagingPhoto && (
                  <p className="text-xs text-center text-amber-600 mt-3">
                    ⚠️ Devam etmek için paketleme fotoğrafı zorunludur
                  </p>
                )}
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
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-2">QR Kodunuz</h3>
              <p className="text-sm text-gray-500 mb-4">
                Bu QR kodu alıcıya gösterin veya mesaj olarak gönderin.
              </p>
              
              {/* QR Kod Resmi */}
              <div className="bg-white rounded-xl p-4 mb-4 border-2 border-purple-200">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedSwap.qrCode)}`}
                  alt="QR Kod"
                  width={200}
                  height={200}
                  className="mx-auto"
                />
              </div>
              
              {/* QR Kod Metni */}
              <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">QR Kod:</p>
                <p className="text-sm font-mono font-bold text-purple-700 break-all">
                  {selectedSwap.qrCode}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-green-50 border border-green-200 mb-4">
                <p className="text-sm text-green-700">
                  ✅ QR kod alıcıya mesaj olarak da gönderildi!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <p className="text-sm text-amber-700">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Alıcı QR'ı taradığında emailine 6 haneli kod gidecek.
                </p>
              </div>

              <Button onClick={() => setShowQRModal(false)} className="w-full">
                Tamam
              </Button>
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
                    <h3 className="text-xl font-bold text-gray-800">QR Kod Tara</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 text-center mb-4">
                    Satıcının size gönderdiği QR kodu tarayın. QR tarandığında emailinize 6 haneli doğrulama kodu gelecek.
                  </p>
                  
                  {/* Kamera Görünümü - jsQR ile Otomatik Tarama */}
                  {isCameraActive ? (
                    <div className="mb-4">
                      <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        {/* Tarama çerçevesi */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-56 h-56 relative">
                            {/* Köşeler */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                            {/* Tarama çizgisi animasyonu */}
                            {isScanning && (
                              <div className="absolute left-2 right-2 h-0.5 bg-green-400 animate-[scanLine_2s_ease-in-out_infinite]" style={{
                                animation: 'scanLine 2s ease-in-out infinite'
                              }} />
                            )}
                          </div>
                        </div>
                        {/* Tarama durumu */}
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                          <span className="bg-black/70 text-white text-sm px-4 py-2 rounded-full inline-flex items-center gap-2">
                            {isScanning ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                QR kod aranıyor...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                QR kod bulundu!
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={stopCamera}
                        className="w-full mt-2"
                        size="sm"
                      >
                        <X className="w-4 h-4 mr-1" /> Kamerayı Kapat
                      </Button>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <Button
                        onClick={startCamera}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 mb-3 py-6 text-lg"
                      >
                        <Camera className="w-6 h-6 mr-2" />
                        📷 Kamera ile QR Tara
                      </Button>
                      <p className="text-xs text-center text-gray-500 mb-2">
                        Kameranızı QR koda doğrultun, otomatik taranacak
                      </p>
                      {cameraError && (
                        <p className="text-xs text-amber-600 text-center mb-2">{cameraError}</p>
                      )}
                    </div>
                  )}
                  
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Manuel Giriş */}
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-2 text-center">
                      veya QR kodu manuel girin:
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
                      İptal
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
                          QR Tara
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
                    <h3 className="text-xl font-bold text-gray-800">Teslim Onayla</h3>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 mb-4">
                    <p className="text-sm text-green-700 text-center">
                      ✅ QR kod başarıyla tarandı!<br/>
                      📧 Email adresinize 6 haneli doğrulama kodu gönderildi.
                    </p>
                  </div>
                  
                  {/* Alıcı Teslim Fotoğrafı - ZORUNLU */}
                  <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-red-800">Teslim Fotoğrafı (Zorunlu) *</span>
                    </div>
                    <p className="text-xs text-red-700 mb-3">
                      ⚠️ Ürünü kontrol ettikten sonra fotoğraf çekin. Bu fotoğraf, dispute durumunda KRİTİK kanıt olarak kullanılır!
                    </p>
                    
                    <input
                      ref={receiverInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'receiver')}
                      className="hidden"
                    />
                    
                    {receiverPhoto ? (
                      <div className="relative">
                        <Image
                          src={receiverPhoto}
                          alt="Teslim fotoğrafı"
                          width={200}
                          height={200}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => setReceiverPhoto(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg">
                          <CheckCircle className="w-3 h-3" /> ✅ Fotoğraf Hazır
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => receiverInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        size="sm"
                        className="w-full border-2 border-dashed border-red-400 bg-white hover:bg-red-50 text-red-600"
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            📸 Fotoğraf Çek (Zorunlu)
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 text-center mb-2">
                    Emailinizdeki 6 haneli kodu girin:
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
                      ⚠️ Kodu girmeden önce ürünü mutlaka kontrol edin! Kod girildikten sonra teslimat onaylanmış sayılır.
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
                        setReceiverPhoto(null)
                        setError('')
                      }}
                      className="flex-1"
                    >
                      Geri
                    </Button>
                    <Button
                      onClick={handleScanQRStep2}
                      disabled={processing || verificationCode.length !== 6 || !receiverPhoto}
                      className={`flex-1 ${receiverPhoto ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-400'}`}
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : !receiverPhoto ? (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Önce Fotoğraf Yükle
                        </>
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
                <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Sorun Bildir</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">
                  Ürünle ilgili bir sorun mu var? Lütfen detayları paylaşın.
                </p>

                {/* Sorun Türü */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sorun Türü *
                  </label>
                  <select
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Seçiniz...</option>
                    <option value="not_as_described">Açıklamayla uyuşmuyor</option>
                    <option value="defect">Arıza/Bozukluk var</option>
                    <option value="damaged">Hasarlı/Kırık</option>
                    <option value="missing_parts">Eksik parça</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>

                {/* Açıklama */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detaylı Açıklama * (min. 20 karakter)
                  </label>
                  <Textarea
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Sorunu detaylı bir şekilde açıklayın..."
                    rows={3}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {disputeDescription.length}/20 karakter
                  </p>
                </div>

                {/* Kanıt Fotoğrafları - ZORUNLU */}
                <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-800">Kanıt Fotoğrafları (Zorunlu) *</span>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    📸 Sorunu gösteren fotoğraflar yükleyin. En az 1, en fazla 5 fotoğraf.
                  </p>
                  
                  <input
                    ref={disputePhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoUpload(e, 'dispute')}
                    className="hidden"
                  />
                  
                  {/* Yüklenen fotoğraflar */}
                  {disputePhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {disputePhotos.map((photo, index) => (
                        <div key={index} className="relative aspect-square">
                          <Image
                            src={photo}
                            alt={`Kanıt ${index + 1}`}
                            fill
                            className="object-cover rounded-lg"
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
                          {disputePhotos.length === 0 ? '📸 Fotoğraf Ekle (Zorunlu)' : `📸 Fotoğraf Ekle (${disputePhotos.length}/5)`}
                        </>
                      )}
                    </Button>
                  )}
                  
                  {disputePhotos.length > 0 && (
                    <div className="mt-2 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs text-center">
                      ✅ {disputePhotos.length} fotoğraf yüklendi
                    </div>
                  )}
                </div>

                {/* Uyarı */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                  <p className="text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Yanlış veya asılsız raporlar güven puanınızı düşürebilir.
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
                    İptal
                  </Button>
                  <Button
                    onClick={handleOpenDispute}
                    disabled={processing || !disputeType || disputeDescription.length < 20 || disputePhotos.length === 0}
                    className={`flex-1 ${disputePhotos.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400'}`}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Rapor Gönder'
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
              className="bg-white rounded-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Fiyat Öner</h3>
                    <p className="text-sm text-gray-500">{selectedSwap.product.title}</p>
                  </div>
                </div>
                
                {/* Mevcut Durum */}
                <div className="mb-4 p-3 rounded-xl bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Ürün Fiyatı</p>
                      <p className="font-semibold text-purple-600">{selectedSwap.product.valorPrice} Valor</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Karşı Taraf Önerisi</p>
                      <p className="font-semibold text-green-600">
                        {selectedSwap.owner.id === userId 
                          ? (selectedSwap.agreedPriceRequester !== null ? `${selectedSwap.agreedPriceRequester} Valor` : 'Henüz yok')
                          : (selectedSwap.agreedPriceOwner !== null ? `${selectedSwap.agreedPriceOwner} Valor` : 'Henüz yok')}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Fiyat Girişi */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sizin Fiyat Öneriniz (Valor)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      min="0"
                      max={selectedSwap.product.valorPrice * 2}
                      className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Valor</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Karşı tarafla aynı fiyatı girdiğinizde anlaşma sağlanır.
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
                    İptal
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
                        Fiyat Öner
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
                  <h2 className="text-2xl font-bold text-gray-900">🎉 İlk Takasınız!</h2>
                  <p className="text-gray-600 mt-2">Teslimat sürecini adım adım anlatalım</p>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900">📍 Teslim Noktası Seçin</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Güvenli bir teslim noktası (AVM, polis yanı vb.) veya kendi belirttiğiniz bir konum seçin.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="font-bold text-purple-900">📸 Paket Fotoğrafı Çekin</h3>
                      <p className="text-sm text-purple-700 mt-1">
                        Ürünü vermeden önce paket halinde fotoğrafını çekin. Bu, dispute durumunda kanıt olacak.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900">🔐 QR Kod Oluşturun</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Sistem size özel bir QR kod ve 6 haneli doğrulama kodu üretecek. Bu kodu SADECE teslim anında paylaşın.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0">
                      4
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-900">📱 Alıcı QR Tarar</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Alıcı QR kodu tarar → Email&apos;ine gelen 6 haneli kodu girer → <strong>Zorunlu fotoğraf çeker</strong> → Teslimat onaylanır.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-red-100 border border-red-200">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold shrink-0">
                      5
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900">⏰ 24 Saat Kontrol Süresi</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Teslimat sonrası alıcı 24 saat içinde ürünü kontrol eder. Sorun varsa &quot;Dispute&quot; açabilir. Yoksa Valor otomatik aktarılır.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 text-gray-700 shrink-0" />
                    <div>
                      <h4 className="font-bold text-gray-800">Güvenlik İpuçları</h4>
                      <ul className="text-sm text-gray-600 mt-2 space-y-1">
                        <li>✅ Teslim noktasında buluşun</li>
                        <li>✅ Ürünü teslim etmeden önce fotoğraflayın</li>
                        <li>✅ QR kodu göstermeden önce ürünü inceletin</li>
                        <li>✅ Sorun olursa 24 saat içinde dispute açın</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Button */}
                <Button
                  onClick={dismissGuide}
                  className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 text-lg font-bold shadow-lg"
                >
                  Anladım, Devam Et! 🚀
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
