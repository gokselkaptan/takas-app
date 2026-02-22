'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Package, Upload, Sparkles, AlertTriangle, CheckCircle, Info,
  ChevronRight, Star, Loader2, Crown, X, Shield, ShieldAlert, ImagePlus
} from 'lucide-react'
import { getChecklistForCategory } from '@/lib/types'
import { useLanguage } from '@/lib/language-context'
import { playSuccessSound } from '@/lib/notification-sounds'

interface Category {
  id: string
  name: string
  slug: string
}

export default function UrunEklePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useLanguage()

  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')
  const [dailyLimit, setDailyLimit] = useState({ count: 0, limit: 3, canAdd: true })

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    categorySlug: '',
    categoryName: '',
    condition: 'good',
    usageInfo: '',
    images: [] as string[],
    city: 'İzmir',
    district: '',
    isFreeAvailable: false,
    acceptsNegotiation: true,
  })

  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, any>>({})
  const [valorResult, setValorResult] = useState<{
    aiPrice: number
    userPrice: number
    reason: string
    marketInsight: string
    estimatedTL?: number
    formula?: string
    simpleFormula?: string
    economics?: {
      estimatedPriceTL: number
      priceRangeTL: { low: number; high: number }
      breakdown: {
        baseValueTL: number
        valorRate: number
        rawValor: number
        conditionMultiplier: number
        demandMultiplier: number
        regionalMultiplier: number
        inflationCorrection: number
        finalValor: number
      }
      marketContext: {
        goldTrend: string
        foodTrend: string
        demandLevel: string
        inflationStatus: string
        region: string
      }
      formula: string
      confidence: string
    }
  } | null>(null)
  
  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [moderationStatus, setModerationStatus] = useState<{
    status: 'idle' | 'checking' | 'approved' | 'rejected' | 'warning'
    message: string
  }>({ status: 'idle', message: '' })
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    }
  }, [status, router])

  useEffect(() => {
    fetchCategories()
    checkDailyLimit()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error('Categories fetch error:', err)
    }
  }

  const checkDailyLimit = async () => {
    // This would normally fetch from an API
    // For now, we'll simulate it
    setDailyLimit({ count: 0, limit: 3, canAdd: true })
  }

  const handleCategorySelect = (category: Category) => {
    setFormData({
      ...formData,
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
    })
    setChecklistAnswers({})
    setStep(2)
  }

  const handleChecklistAnswer = (id: string, value: any) => {
    setChecklistAnswers({ ...checklistAnswers, [id]: value })
  }

  // Image upload with AI quality control and moderation
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Max 5 images
    if (formData.images.length + files.length > 5) {
      setImageError('En fazla 5 fotoğraf yükleyebilirsiniz')
      return
    }

    setUploadingImage(true)
    setImageError('')
    setQualityWarnings([])
    setModerationStatus({ status: 'checking', message: 'Fotoğraf kalite ve güvenlik kontrolü yapılıyor...' })

    for (const file of Array.from(files)) {
      try {
        // ═══ GÖRSEL SIKIŞTRMA (Upload öncesi - %80 kalite, max 1200px) ═══
        const compressImage = (f: File): Promise<File> => {
          return new Promise((resolve) => {
            // Zaten küçükse dokunma
            if (f.size < 500 * 1024) { resolve(f); return }
            
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
              
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    resolve(new File([blob], f.name, { type: 'image/jpeg', lastModified: Date.now() }))
                  } else resolve(f)
                },
                'image/jpeg',
                0.80 // %80 kalite
              )
              URL.revokeObjectURL(img.src)
            }
            img.onerror = () => resolve(f)
            img.src = URL.createObjectURL(f)
          })
        }

        // Sıkıştır
        const compressedFile = await compressImage(file)

        // Check file size (max 5MB - sıkıştırılmış)
        if (compressedFile.size > 5 * 1024 * 1024) {
          setImageError('Dosya boyutu sıkıştırma sonrası 5MB\'dan büyük')
          continue
        }

        // Create FormData for quality check
        const qualityFormData = new FormData()
        qualityFormData.append('file', compressedFile)
        qualityFormData.append('title', formData.title)
        qualityFormData.append('category', formData.categoryName)

        // Step 1: AI Quality Check (includes stock photo & fake detection)
        setModerationStatus({ status: 'checking', message: 'AI kalite kontrolü yapılıyor...' })
        
        const qualityRes = await fetch('/api/product-quality-check', {
          method: 'POST',
          body: qualityFormData
        })

        const qualityResult = await qualityRes.json()

        // Check if blocked by quality control
        if (!qualityResult.passed && qualityResult.blockedReason) {
          setModerationStatus({
            status: 'rejected',
            message: qualityResult.blockedReason
          })
          setImageError(qualityResult.blockedReason)
          continue
        }

        // Collect warnings if any
        if (qualityResult.recommendations && qualityResult.recommendations.length > 0) {
          setQualityWarnings(qualityResult.recommendations)
        }

        // Step 2: Content Moderation (inappropriate content check)
        setModerationStatus({ status: 'checking', message: 'İçerik güvenlik kontrolü yapılıyor...' })
        
        const moderationFormData = new FormData()
        moderationFormData.append('file', compressedFile)

        const moderationRes = await fetch('/api/moderate-image', {
          method: 'POST',
          body: moderationFormData
        })

        const moderationResult = await moderationRes.json()

        if (!moderationResult.isAppropriate) {
          setModerationStatus({
            status: 'rejected',
            message: `Fotoğraf reddedildi: ${moderationResult.reason}`
          })
          setImageError(`Bu fotoğraf uygun değil: ${moderationResult.reason}`)
          continue
        }

        // Set appropriate status based on quality score
        if (qualityResult.overallScore >= 70) {
          setModerationStatus({ 
            status: 'approved', 
            message: `Mükemmel! Kalite puanı: ${qualityResult.overallScore}/100` 
          })
        } else if (qualityResult.overallScore >= 50) {
          setModerationStatus({ 
            status: 'warning', 
            message: `Kabul edildi. Kalite puanı: ${qualityResult.overallScore}/100 - İyileştirme önerileri mevcut` 
          })
        } else {
          setModerationStatus({ 
            status: 'approved', 
            message: 'Fotoğraf onaylandı' 
          })
        }

        // If approved, convert to base64 for preview
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, base64]
          }))
        }
        reader.readAsDataURL(compressedFile)

      } catch (err) {
        console.error('Image upload error:', err)
        setImageError('Fotoğraf yüklenirken bir hata oluştu')
      }
    }

    setUploadingImage(false)
    // Reset moderation status after a delay
    setTimeout(() => {
      setModerationStatus({ status: 'idle', message: '' })
    }, 5000)

    // Reset input
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const calculateValor = async () => {
    setCalculating(true)
    setError('')

    try {
      const res = await fetch('/api/valor/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          categoryName: formData.categoryName,
          categorySlug: formData.categorySlug,
          condition: formData.condition,
          city: formData.city || 'İzmir',
          checklistData: checklistAnswers,
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Valor hesaplanamadı')
      }
      
      setValorResult({
        aiPrice: data.valorPrice,
        userPrice: data.valorPrice,
        reason: data.reason || 'AI tarafından hesaplandı',
        estimatedTL: data.estimatedTL,
        formula: data.formula,
        simpleFormula: data.simpleFormula,
        marketInsight: data.marketInsight || '',
        economics: data.economics,
      })
      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Valor hesaplanamadı, lütfen tekrar deneyin')
    } finally {
      setCalculating(false)
    }
  }

  const handleSubmit = async () => {
    if (!valorResult) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          categoryId: formData.categoryId,
          condition: formData.condition,
          usageInfo: formData.usageInfo,
          valorPrice: formData.isFreeAvailable ? 0 : valorResult.userPrice,
          userValorPrice: formData.isFreeAvailable ? 0 : valorResult.userPrice,
          aiValorPrice: valorResult.aiPrice,
          aiValorReason: valorResult.reason,
          checklistData: JSON.stringify(checklistAnswers),
          images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400'],
          city: formData.city,
          district: formData.district,
          isFreeAvailable: formData.isFreeAvailable,
          acceptsNegotiation: formData.acceptsNegotiation,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        // 403 Forbidden - Hesap kısıtlandı (spam)
        if (res.status === 403) {
          setError(data.error || 'Hesabınız kısıtlandı')
          return
        }
        // 409 Conflict - Duplicate ürün
        if (res.status === 409) {
          setError(data.error || 'Bu ürün zaten mevcut')
          // Opsiyonel: Mevcut ürüne yönlendir
          if (data.existingProductId) {
            setTimeout(() => {
              if (confirm('Mevcut ürününüzü görüntülemek ister misiniz?')) {
                router.push(`/urun/${data.existingProductId}`)
              }
            }, 100)
          }
          return
        }
        // 429 Too Many Requests - Flood koruması
        if (res.status === 429) {
          setError(data.error || 'Çok hızlı ürün ekliyorsunuz')
          return
        }
        throw new Error(data.error || 'Ürün eklenemedi')
      }

      playSuccessSound()
      router.push('/urunler')
    } catch (err: any) {
      setError(err.message || 'Ürün eklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const checklist = getChecklistForCategory(formData.categorySlug)

  if (status === 'loading') {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ürün Ekle</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Takas yapmak istediğin ürünü sisteme ekle</p>
        </div>

        {/* Daily Limit Info */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-purple-600" />
              <span className="text-gray-800 dark:text-gray-200">
                Bugün <strong>{dailyLimit.count}/{dailyLimit.limit}</strong> ürün eklediniz
              </span>
            </div>
            <Link
              href="#"
              className="flex items-center gap-1 text-sm text-purple-600 hover:underline"
            >
              <Crown className="w-4 h-4" />
              <span>Premium ile sınırsız - Yakında</span>
            </Link>
          </div>
        </div>

        {/* Trust Score Warning */}
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Önemli Uyarı</p>
              <p className="text-sm text-amber-700 mt-1">
                Ürün hakkında yanlış veya yanıltıcı bilgi vermeniz durumunda, kişisel 
                <strong> Güven Puanınız</strong> düşecektir. Dürüst bilgi verin, 
                iyi niyetli kullanıcılara destek olun.
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-16 sm:w-24 h-1 mx-2 rounded ${step > s ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8"
        >
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Kategori Seçin</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Product Details + Checklist */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ürün Bilgileri - {formData.categoryName}</h2>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Ürün Başlığı *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Örn: iPhone 12 Pro Max 256GB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Açıklama *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Ürününüzü detaylı anlatın..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Kullanım Bilgisi
                </label>
                <textarea
                  value={formData.usageInfo}
                  onChange={(e) => setFormData({ ...formData, usageInfo: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Kaç ay/yıl kullandınız, nasıl kullandınız..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Şehir</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="İzmir">İzmir</option>
                    <option value="Barcelona">Barcelona</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">İlçe</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Örn: Bornova"
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-800">
                    Ürün Fotoğrafları (max 5)
                  </label>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>AI Güvenlik Kontrolü</span>
                  </div>
                </div>

                {/* Uploaded Images Preview */}
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {formData.images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Ürün ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-xl border-2 border-green-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImage || formData.images.length >= 5}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                    uploadingImage ? 'border-purple-400 bg-purple-50' : 
                    formData.images.length >= 5 ? 'border-gray-200 bg-gray-50' : 
                    'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}>
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                        <span className="text-purple-600 font-medium">Kontrol ediliyor...</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {formData.images.length >= 5 ? 'Maksimum fotoğraf sayısına ulaşıldı' : 'Fotoğraf Yükle'}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 mt-1">JPEG, PNG, GIF, WebP (max 10MB)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Moderation Status */}
                {moderationStatus.status !== 'idle' && (
                  <div className={`p-3 rounded-xl flex items-center gap-2 ${
                    moderationStatus.status === 'checking' ? 'bg-blue-50 text-blue-700' :
                    moderationStatus.status === 'approved' ? 'bg-green-50 text-green-700' :
                    moderationStatus.status === 'warning' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {moderationStatus.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {moderationStatus.status === 'approved' && <Shield className="w-4 h-4" />}
                    {moderationStatus.status === 'warning' && <AlertTriangle className="w-4 h-4" />}
                    {moderationStatus.status === 'rejected' && <ShieldAlert className="w-4 h-4" />}
                    <span className="text-sm">{moderationStatus.message}</span>
                  </div>
                )}

                {/* Quality Warnings/Recommendations */}
                {qualityWarnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-700">
                        <strong className="block mb-1">Kalite İyileştirme Önerileri:</strong>
                        <ul className="list-disc list-inside space-y-1">
                          {qualityWarnings.map((warning, idx) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Error */}
                {imageError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{imageError}</span>
                  </div>
                )}

                {/* Security Notice */}
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-purple-700">
                      <strong>AI Kalite Kontrolü:</strong> Fotoğraflarınız yapay zeka ile analiz edilir:
                      <span className="block mt-1">• Netlik ve çözünürlük kontrolü</span>
                      <span className="block">• Stock fotoğraf ve sahte görsel tespiti</span>
                      <span className="block">• İçerik uygunluk kontrolü</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Geri
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!formData.title || !formData.description}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  Devam <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Checklist */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ürün Durum Kontrolü</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Bu sorular Valor değerini etkiler, lütfen doğru yanıtlayın
                </p>
              </div>

              <div className="space-y-4">
                {/* General Condition */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Genel Durum *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'new', label: 'Sıfır', color: 'green' },
                      { value: 'like_new', label: 'Sıfır Gibi', color: 'blue' },
                      { value: 'good', label: 'İyi', color: 'yellow' },
                      { value: 'fair', label: 'Orta', color: 'orange' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, condition: opt.value })}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.condition === opt.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Checklist */}
                {checklist.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                      {item.question}
                    </label>
                    {item.type === 'boolean' ? (
                      <div className="flex gap-3">
                        {['Evet', 'Hayır'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleChecklistAnswer(item.id, opt === 'Evet')}
                            className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                              checklistAnswers[item.id] === (opt === 'Evet')
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <select
                        value={checklistAnswers[item.id] || ''}
                        onChange={(e) => handleChecklistAnswer(item.id, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Seçiniz...</option>
                        {item.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Geri
                </button>
                <button
                  onClick={calculateValor}
                  disabled={calculating}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {calculating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Hesaplanıyor...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      AI ile Valor Hesapla
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Valor Result & Submit */}
          {step === 4 && valorResult && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Valor Değeri Belirlendi</h2>

              {/* AI Recommendation */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  <span className="font-semibold text-purple-800">AI Önerisi</span>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl font-bold text-purple-700">{valorResult.aiPrice}</div>
                  <div className="flex items-center gap-1 text-purple-600">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-medium">Valor</span>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{valorResult.reason}</p>
                {valorResult.marketInsight && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 italic">{valorResult.marketInsight}</p>
                )}
                
                {/* Ekonomik Değerleme Detayı */}
                {valorResult.economics && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs space-y-2">
                    <p className="font-bold text-gray-700 dark:text-gray-300">📊 Değerleme Detayı</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white dark:bg-gray-700 p-2 rounded">
                        <p className="text-gray-500">Piyasa Değeri</p>
                        <p className="font-bold text-gray-900 dark:text-white">~{valorResult.economics.estimatedPriceTL}₺</p>
                      </div>
                      <div className="bg-white dark:bg-gray-700 p-2 rounded">
                        <p className="text-gray-500">Valor Kuru</p>
                        <p className="font-bold text-gray-900 dark:text-white">×{valorResult.economics.breakdown.valorRate}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                        {valorResult.economics.marketContext.goldTrend}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                        {valorResult.economics.marketContext.demandLevel}
                      </span>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                        {valorResult.economics.marketContext.inflationStatus}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                        📍 {valorResult.economics.marketContext.region}
                      </span>
                    </div>
                    
                    <p className="text-gray-500 italic text-[10px]">{valorResult.economics.formula}</p>
                  </div>
                )}
              </div>

              {/* User Adjustment - flexible pricing */}
              <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Talep Ettiğiniz Valor Değeri
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  AI önerisinin <span className="font-semibold text-purple-600">%50 - %200</span> aralığında değiştirebilirsiniz
                </p>
                
                {/* Min/Max Info */}
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Min: {Math.max(1, Math.round(valorResult.aiPrice * 0.5))} Valor (0.5x)</span>
                  <span>Max: {Math.round(valorResult.aiPrice * 2)} Valor (2x)</span>
                </div>
                
                {/* Sayısal Giriş Kutusu - Belirgin */}
                <div className="mb-4 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                  <label className="block text-sm font-medium text-purple-700 mb-2 text-center">
                    Talep Ettiğiniz Valor
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      min={Math.max(1, Math.round(valorResult.aiPrice * 0.5))}
                      max={Math.round(valorResult.aiPrice * 2)}
                      value={valorResult.userPrice}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        const minVal = Math.max(1, Math.round(valorResult.aiPrice * 0.5))
                        const maxVal = Math.round(valorResult.aiPrice * 2)
                        const clampedVal = Math.min(Math.max(val, minVal), maxVal)
                        setValorResult({ ...valorResult, userPrice: clampedVal })
                      }}
                      className="w-32 px-4 py-3 rounded-xl border-2 border-purple-300 text-center font-bold text-2xl text-purple-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <span className="text-purple-600 font-semibold">Valor</span>
                  </div>
                </div>
                
                {/* Slider */}
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={Math.max(1, Math.round(valorResult.aiPrice * 0.5))}
                    max={Math.round(valorResult.aiPrice * 2)}
                    value={valorResult.userPrice}
                    onChange={(e) => setValorResult({ ...valorResult, userPrice: parseInt(e.target.value) })}
                    className="flex-1 h-3 accent-purple-600 cursor-pointer"
                  />
                </div>
                
                {/* Difference indicator with color coding */}
                {valorResult.userPrice !== valorResult.aiPrice && (
                  <div className={`mt-3 p-3 rounded-xl border ${
                    Math.abs(valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice > 0.5 
                      ? 'bg-orange-50 border-orange-200' 
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <p className={`text-sm flex items-center gap-2 ${
                      Math.abs(valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice > 0.5 
                        ? 'text-orange-700' 
                        : 'text-amber-700'
                    }`}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        AI önerisinden <strong>{valorResult.userPrice > valorResult.aiPrice ? '+' : ''}{Math.round(((valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice) * 100)}%</strong> farklı
                        {Math.abs(valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice > 0.5 && 
                          <span className="ml-1">(yüksek fark)</span>
                        }
                      </span>
                    </p>
                  </div>
                )}

                {/* Info Note */}
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-blue-700 text-sm flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Not:</strong> Ürün sayfanızda hem AI tarafından önerilen değer hem de sizin talep ettiğiniz değer görünecektir.
                    </span>
                  </p>
                </div>
              </div>

              {/* Ek Seçenekler */}
              <div className="p-6 rounded-2xl bg-white border border-gray-200 dark:border-gray-700 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Takas Seçenekleri
                </h3>

                {/* Pazarlığa & Mesaja Açık */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.acceptsNegotiation}
                    onChange={(e) => setFormData({ ...formData, acceptsNegotiation: e.target.checked })}
                    className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤝</span>
                      <span className="font-medium text-gray-900 dark:text-white">Pazarlığa & mesaja açığım</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      Alıcılar teklif gönderebilir ve size doğrudan mesaj atabilir
                    </p>
                  </div>
                </label>

                {/* Bedelsiz de Olur */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isFreeAvailable}
                    onChange={(e) => setFormData({ ...formData, isFreeAvailable: e.target.checked })}
                    className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎁</span>
                      <span className="font-medium text-green-800 dark:text-green-300">Bedelsiz de verilebilir</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Bu ürünü ihtiyacı olan birine ücretsiz vermek isterim
                    </p>
                    {formData.isFreeAvailable && (
                      <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          ✓ Ürününüz &quot;Bedelsiz&quot; olarak işaretlenecek ve 0 Valor ile takas edilebilecek
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Geri
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Yayınlanıyor...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Ürünü Yayınla
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  )
}
