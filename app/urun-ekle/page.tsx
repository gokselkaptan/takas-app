'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Package, Upload, Sparkles, AlertTriangle, CheckCircle, Info,
  ChevronRight, Star, Loader2, Crown, X, Shield, ShieldAlert, ImagePlus, Brain
} from 'lucide-react'
import { getChecklistForCategory } from '@/lib/types'
import { useLanguage } from '@/lib/language-context'
import { playSuccessSound } from '@/lib/notification-sounds'
import { Analytics } from '@/lib/analytics'

// AI photo analysis threshold
const AI_PHOTO_ANALYSIS_VALOR_THRESHOLD = 5000

interface Category {
  id: string
  name: string
  slug: string
}

export default function UrunEklePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useLanguage()

  // Category-based question sets using translation keys
  const CATEGORY_QUESTIONS: Record<string, Array<{
    id: string
    label: string
    type: 'text' | 'select'
    placeholder?: string
    options?: string[]
  }>> = useMemo(() => ({
    'Kitap & Hobi': [
      { id: 'edition', label: t('cqEditionYear'), type: 'text', placeholder: '2020' },
      { id: 'publisher', label: t('cqPublisher'), type: 'text', placeholder: t('cqPublisher') },
      { id: 'read', label: t('cqRead'), type: 'select', options: [t('cqYes'), t('cqNo'), t('cqPartially')] },
      { id: 'notes', label: t('cqNotes'), type: 'select', options: [t('cqNone'), t('cqFew'), t('cqMany')] },
    ],
    'Elektronik': [
      { id: 'warranty', label: t('cqWarranty'), type: 'select', options: [t('cqNoWarranty'), t('cq6Months'), t('cq1Year'), t('cq2YearsPlus')] },
      { id: 'box', label: t('cqHasBox'), type: 'select', options: [t('cqYes'), t('cqNo')] },
      { id: 'accessories', label: t('cqAccessories'), type: 'select', options: [t('cqAllIncluded'), t('cqPartial'), t('cqNotIncluded')] },
      { id: 'age', label: t('cqYearsUsed'), type: 'select', options: [t('cqLessThan1Year'), t('cq1to2Years'), t('cq3to5Years'), t('cq5PlusYears')] },
    ],
    'Giyim': [
      { id: 'size', label: t('cqSize'), type: 'text', placeholder: t('cqSizePlaceholder') },
      { id: 'worn', label: t('cqTimesWorn'), type: 'select', options: [t('cqNever'), t('cq1to5Times'), t('cq6to20Times'), t('cq20PlusTimes')] },
      { id: 'cleaned', label: t('cqDryCleaned'), type: 'select', options: [t('cqYes'), t('cqNo')] },
    ],
    'Oto & Moto': [
      { id: 'km', label: t('cqKilometer'), type: 'text', placeholder: t('cqKmPlaceholder') },
      { id: 'year', label: t('cqModelYear'), type: 'text', placeholder: '2018' },
      { id: 'damage', label: t('cqDamageRecord'), type: 'select', options: [t('cqNone'), t('cqExists')] },
      { id: 'inspection', label: t('cqInspectionDate'), type: 'text', placeholder: '03/2026' },
    ],
    'Oto Aksesuar': [
      { id: 'compatible', label: t('cqCompatibleVehicle'), type: 'text', placeholder: t('cqCompatiblePlaceholder') },
      { id: 'usage', label: t('cqUsagePeriod'), type: 'select', options: [t('cqNeverUsed'), t('cqLessThan6Months'), t('cq1to2YearsUsage'), t('cq2PlusYears')] },
    ],
    'Beyaz Esya': [
      { id: 'age', label: t('cqHowOld'), type: 'select', options: [t('cq0to2Years'), t('cq3to5YearsAge'), t('cq6to10Years'), t('cq10PlusYears')] },
      { id: 'fault', label: t('cqFaultHistory'), type: 'select', options: [t('cqNone'), t('cqMinorFault'), t('cqMajorFault')] },
      { id: 'invoice', label: t('cqHasInvoice'), type: 'select', options: [t('cqYes'), t('cqNo')] },
    ],
    'Antika & Koleksiyon': [
      { id: 'period', label: t('cqPeriod'), type: 'text', placeholder: t('cqPeriodPlaceholder') },
      { id: 'certificate', label: t('cqAuthenticityCert'), type: 'select', options: [t('cqYes'), t('cqNo')] },
      { id: 'origin', label: t('cqOrigin'), type: 'text', placeholder: t('cqOriginPlaceholder') },
    ],
    'Cocuk & Bebek': [
      { id: 'ageRange', label: t('cqAgeRange'), type: 'text', placeholder: t('cqAgeRangePlaceholder') },
      { id: 'cleaned', label: t('cqSterilized'), type: 'select', options: [t('cqYes'), t('cqNo')] },
      { id: 'complete', label: t('cqAllPartsComplete'), type: 'select', options: [t('cqYes'), t('cqMissingParts')] },
    ],
    'Oyuncak': [
      { id: 'ageRange', label: t('cqAgeRange'), type: 'text', placeholder: t('cqAgeRangeToyPlaceholder') },
      { id: 'complete', label: t('cqAllPartsComplete'), type: 'select', options: [t('cqYes'), t('cqMissingParts')] },
      { id: 'battery', label: t('cqBattery'), type: 'select', options: [t('cqNoBattery'), t('cqBatteryWorks'), t('cqBatteryNotWorks')] },
    ],
    'Spor & Outdoor': [
      { id: 'size', label: t('cqSizeOutdoor'), type: 'text', placeholder: t('cqSizeOutdoorPlaceholder') },
      { id: 'usage', label: t('cqTimesUsed'), type: 'select', options: [t('cqNever'), t('cq1to5Times'), t('cq6to20Times'), t('cq20PlusTimes')] },
    ],
    'Ev & Yasam': [
      { id: 'dimensions', label: t('cqDimensions'), type: 'text', placeholder: t('cqDimensionsPlaceholder') },
      { id: 'material', label: t('cqMaterial'), type: 'text', placeholder: t('cqMaterialPlaceholder') },
    ],
    'Gayrimenkul': [
      { id: 'sqm', label: t('cqSquareMeters'), type: 'text', placeholder: t('cqSqmPlaceholder') },
      { id: 'rooms', label: t('cqRooms'), type: 'text', placeholder: t('cqRoomsPlaceholder') },
      { id: 'floor', label: t('cqFloor'), type: 'text', placeholder: t('cqFloorPlaceholder') },
      { id: 'dues', label: t('cqDues'), type: 'text', placeholder: t('cqDuesPlaceholder') },
    ],
    'Tekne & Denizcilik': [
      { id: 'length', label: t('cqBoatLength'), type: 'text', placeholder: t('cqBoatLengthPlaceholder') },
      { id: 'engineHours', label: t('cqEngineHours'), type: 'text', placeholder: t('cqEngineHoursPlaceholder') },
      { id: 'year', label: t('cqManufactureYear'), type: 'text', placeholder: '2015' },
    ],
    'Bahce': [
      { id: 'type', label: t('cqProductType'), type: 'text', placeholder: t('cqProductTypePlaceholder') },
      { id: 'age', label: t('cqAge'), type: 'select', options: [t('cqNew'), t('cq1to3Years'), t('cq3PlusYears')] },
    ],
    'Evcil Hayvan': [
      { id: 'petType', label: t('cqForWhichPet'), type: 'text', placeholder: t('cqPetPlaceholder') },
      { id: 'usage', label: t('cqUsageCondition'), type: 'select', options: [t('cqNeverUsed'), t('cqLightlyUsed'), t('cqNormalUsage')] },
    ],
    'default': [
      { id: 'usage', label: t('cqUsageCondition'), type: 'select', options: [t('cqNeverUsed'), t('cqLightlyUsed'), t('cqNormalUsage'), t('cqHeavyUsage')] },
      { id: 'complete', label: t('cqAllPartsComplete'), type: 'select', options: [t('cqYes'), t('cqMissingParts'), t('cqNotApplicable')] },
    ]
  }), [t])

  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')
  const [dailyLimit, setDailyLimit] = useState({ count: 0, limit: 3, canAdd: true })

  const HIGH_VALUE_CATEGORIES = ['Oto & Moto', 'Gayrimenkul', 'Tekne & Denizcilik', 'Ev & Yaşam']

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    categorySlug: '',
    categoryName: '',
    condition: 'good',
    usageInfo: '',
    images: [] as string[],
    city: '',
    district: '',
    isFreeAvailable: false,
    acceptsNegotiation: true,
    userPriceMin: '' as string | number,
    userPriceMax: '' as string | number,
  })

  // Category-based question answers (Layer 1)
  const [categoryAnswers, setCategoryAnswers] = useState<Record<string, string>>({})
  // AI photo analysis questions (Layer 2)
  const [aiQuestions, setAiQuestions] = useState<Array<{id: string, label: string}>>([])
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({})
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false)

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
    try {
      const response = await fetch('/api/user/daily-limit')
      if (!response.ok) return
      const data = await response.json()
      setDailyLimit({
        count: data.count,
        limit: data.limit,
        canAdd: data.canAdd
      })
    } catch (error) {
      console.error('Daily limit check error:', error)
    }
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
      setImageError(t('apMaxPhotosError'))
      return
    }

    setUploadingImage(true)
    setImageError('')
    setQualityWarnings([])
    setModerationStatus({ status: 'checking', message: t('apQualityChecking') })

    for (const file of Array.from(files)) {
      try {
        // Image compression (before upload - 80% quality, max 1200px)
        const compressImage = (f: File): Promise<File> => {
          return new Promise((resolve) => {
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
                0.80
              )
              URL.revokeObjectURL(img.src)
            }
            img.onerror = () => resolve(f)
            img.src = URL.createObjectURL(f)
          })
        }

        const compressedFile = await compressImage(file)

        // Check file size (max 5MB - compressed)
        if (compressedFile.size > 5 * 1024 * 1024) {
          setImageError(t('apFileSizeError'))
          continue
        }

        // Create FormData for quality check
        const qualityFormData = new FormData()
        qualityFormData.append('file', compressedFile)
        qualityFormData.append('title', formData.title)
        qualityFormData.append('category', formData.categoryName)

        // Step 1: AI Quality Check (includes stock photo & fake detection)
        setModerationStatus({ status: 'checking', message: t('apAiQualityChecking') })
        
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
        setModerationStatus({ status: 'checking', message: t('apContentSecurityCheck') })
        
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
            message: t('apPhotoRejected').replace('{reason}', moderationResult.reason)
          })
          setImageError(t('apPhotoNotSuitable').replace('{reason}', moderationResult.reason))
          continue
        }

        // Set appropriate status based on quality score
        if (qualityResult.overallScore >= 70) {
          setModerationStatus({ 
            status: 'approved', 
            message: t('apExcellentQuality').replace('{score}', qualityResult.overallScore) 
          })
        } else if (qualityResult.overallScore >= 50) {
          setModerationStatus({ 
            status: 'warning', 
            message: t('apAcceptedQuality').replace('{score}', qualityResult.overallScore) 
          })
        } else {
          setModerationStatus({ 
            status: 'approved', 
            message: t('apPhotoApproved') 
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
        setImageError(t('apPhotoUploadError'))
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

  // AI Photo Analysis (Layer 2)
  const analyzePhotoWithAI = async (imageBase64: string) => {
    setIsAnalyzingPhoto(true)
    try {
      const response = await fetch('/api/ai/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageBase64, category: formData.categoryName })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.questions && data.questions.length > 0) {
          setAiQuestions(data.questions)
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error)
    } finally {
      setIsAnalyzingPhoto(false)
    }
  }

  // Format answers for description
  const formatAnswersForDescription = () => {
    let formatted = ''
    
    // Category answers
    const categoryQs = CATEGORY_QUESTIONS[formData.categoryName] || CATEGORY_QUESTIONS['default']
    const categoryAnswersList = categoryQs
      .filter(q => categoryAnswers[q.id])
      .map(q => `${q.label} ${categoryAnswers[q.id]}`)
    
    if (categoryAnswersList.length > 0) {
      formatted += '\n\n---\n📋 Product Details:\n' + categoryAnswersList.join('\n')
    }
    
    // AI answers
    const aiAnswersList = aiQuestions
      .filter(q => aiAnswers[q.id])
      .map(q => `${q.label} ${aiAnswers[q.id]}`)
    
    if (aiAnswersList.length > 0) {
      formatted += '\n\n🤖 Additional Info:\n' + aiAnswersList.join('\n')
    }
    
    return formatted
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
          city: formData.city,
          checklistData: checklistAnswers,
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || t('apValorCalcError'))
      }
      
      setValorResult({
        aiPrice: data.valorPrice,
        userPrice: data.valorPrice,
        reason: data.reason || t('apAiRecommendation'),
        estimatedTL: data.estimatedTL,
        formula: data.formula,
        simpleFormula: data.simpleFormula,
        marketInsight: data.marketInsight || '',
        economics: data.economics,
      })
      setStep(5)
    } catch (err: any) {
      setError(err.message || t('apValorCalcRetry'))
    } finally {
      setCalculating(false)
    }
  }

  const handleSubmit = async () => {
    if (!valorResult) return
    if (!formData.city.trim()) {
      setError(t('cityRequired'))
      return
    }
    setLoading(true)
    setError('')

    try {
      const finalDescription = formData.description + formatAnswersForDescription()
      
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: finalDescription,
          categoryId: formData.categoryId,
          condition: formData.condition,
          usageInfo: formData.usageInfo,
          valorPrice: formData.isFreeAvailable ? 1 : valorResult.userPrice,
          userValorPrice: formData.isFreeAvailable ? 1 : valorResult.userPrice,
          aiValorPrice: valorResult.aiPrice,
          aiValorReason: valorResult.reason,
          checklistData: JSON.stringify(checklistAnswers),
          images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400'],
          city: formData.city,
          district: formData.district,
          isFreeAvailable: formData.isFreeAvailable,
          acceptsNegotiation: formData.acceptsNegotiation,
          userPriceMin: formData.userPriceMin ? Number(formData.userPriceMin) : undefined,
          userPriceMax: formData.userPriceMax ? Number(formData.userPriceMax) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        // 403 Forbidden - Account restricted (spam)
        if (res.status === 403) {
          setError(data.error || t('apAccountRestricted'))
          return
        }
        // 409 Conflict - Duplicate product
        if (res.status === 409) {
          setError(data.error || t('apProductAlreadyExists'))
          if (data.existingProductId) {
            setTimeout(() => {
              if (confirm(t('apViewExistingProduct'))) {
                router.push(`/urun/${data.existingProductId}`)
              }
            }, 100)
          }
          return
        }
        // 429 Too Many Requests - Flood protection
        if (res.status === 429) {
          setError(data.error || t('apTooFastAdding'))
          return
        }
        throw new Error(data.error || t('apProductAddError'))
      }

      const successData = await res.json().catch(() => ({}))
      Analytics.productAdded(
        successData.id || 'unknown',
        formData.categoryId,
        formData.isFreeAvailable ? 1 : valorResult.userPrice
      )
      playSuccessSound()
      router.push('/urunler')
    } catch (err: any) {
      setError(err.message || t('apProductAddErrorGeneric'))
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('addProduct')}</h1>
          <p className="text-gray-400 dark:text-gray-400 mt-2">{t('apAddProductSubtitle')}</p>
        </div>

        {/* Daily Limit Info */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-purple-600" />
              <span className="text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: t('apTodayProducts').replace('{count}', `<strong>${dailyLimit.count}</strong>`).replace('{limit}', `<strong>${dailyLimit.limit}</strong>`) }} />
            </div>
            <Link
              href="#"
              className="flex items-center gap-1 text-sm text-purple-600 hover:underline"
            >
              <Crown className="w-4 h-4" />
              <span>{t('apPremiumUnlimited')}</span>
            </Link>
          </div>
        </div>

        {/* Trust Score Warning */}
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">{t('apImportantWarning')}</p>
              <p className="text-sm text-amber-700 mt-1" dangerouslySetInnerHTML={{ __html: t('apTrustWarningText') }} />
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold transition-all text-sm sm:text-base ${
                  step >= s
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-300'
                }`}
              >
                {step > s ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : s}
              </div>
              {s < 5 && (
                <div
                  className={`w-10 sm:w-16 h-1 mx-1 sm:mx-2 rounded ${step > s ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700'}`}
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('apSelectCategory')}</h2>
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('apProductInfo')} - {formData.categoryName}</h2>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('apProductTitleLabel')}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={t('apProductTitlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('apDescriptionLabel')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={t('apDescriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('apUsageInfoLabel')}
                </label>
                <textarea
                  value={formData.usageInfo}
                  onChange={(e) => setFormData({ ...formData, usageInfo: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={t('apUsageInfoPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('city')} *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder={t('cityPlaceholder')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('districtLabel')}</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder={t('districtPlaceholder')}
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-800">
                    {t('apProductPhotos')}
                  </label>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>{t('apAiSecurityCheck')}</span>
                  </div>
                </div>

                {/* Uploaded Images Preview */}
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {formData.images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={t('apProductAlt').replace('{index}', String(index + 1))}
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
                        <span className="text-purple-600 font-medium">{t('apChecking')}</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {formData.images.length >= 5 ? t('apMaxPhotosReached') : t('apUploadPhoto')}
                        </span>
                        <span className="text-sm text-gray-400 dark:text-gray-400 mt-1">{t('apPhotoFormats')}</span>
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
                        <strong className="block mb-1">{t('apQualityImprovements')}</strong>
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
                      <strong>{t('apAiQualityControl')}</strong> {t('apAiQualityDesc')}
                      <span className="block mt-1">{t('apAiQualityCheck1')}</span>
                      <span className="block">{t('apAiQualityCheck2')}</span>
                      <span className="block">{t('apAiQualityCheck3')}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* High Value Categories - Market Price Range */}
              {HIGH_VALUE_CATEGORIES.includes(formData.categoryName) && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 space-y-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 dark:text-amber-300">
                        {t('apMarketValueTitle')}
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        {t('apMarketValueDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('apMinimumTL')}
                      </label>
                      <input
                        type="number"
                        value={formData.userPriceMin}
                        onChange={(e) => setFormData({ ...formData, userPriceMin: e.target.value ? Number(e.target.value) : '' })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('apMinPlaceholder')}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('apMaximumTL')}
                      </label>
                      <input
                        type="number"
                        value={formData.userPriceMax}
                        onChange={(e) => setFormData({ ...formData, userPriceMax: e.target.value ? Number(e.target.value) : '' })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={t('apMaxPlaceholder')}
                        min={0}
                      />
                    </div>
                  </div>
                  {formData.userPriceMin && formData.userPriceMax && Number(formData.userPriceMin) > Number(formData.userPriceMax) && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {t('apMinMaxError')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('apBack')}
                </button>
                <button
                  onClick={() => {
                    setStep(3)
                    // Trigger AI photo analysis (if first photo exists and analysis hasn't been done)
                    if (formData.images.length > 0 && aiQuestions.length === 0 && !isAnalyzingPhoto) {
                      analyzePhotoWithAI(formData.images[0])
                    }
                  }}
                  disabled={!formData.title || !formData.description}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {t('apContinue')} <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Product Details - Category Questions + AI Questions */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('apProductDetails')}</h2>
                <p className="text-gray-400 dark:text-gray-400">{t('apShareInfoForBuyers')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('apAllQuestionsOptional')}</p>
              </div>

              {/* Category Questions (Layer 1) */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 sm:p-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>📦</span> {t('apCategoryQuestions').replace('{category}', formData.categoryName)}
                </h3>
                <div className="space-y-4">
                  {(CATEGORY_QUESTIONS[formData.categoryName] || CATEGORY_QUESTIONS['default']).map((question) => (
                    <div key={question.id}>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {question.label}
                      </label>
                      {question.type === 'text' ? (
                        <input
                          type="text"
                          value={categoryAnswers[question.id] || ''}
                          onChange={(e) => setCategoryAnswers({
                            ...categoryAnswers,
                            [question.id]: e.target.value
                          })}
                          placeholder={question.placeholder}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                      ) : (
                        <select
                          value={categoryAnswers[question.id] || ''}
                          onChange={(e) => setCategoryAnswers({
                            ...categoryAnswers,
                            [question.id]: e.target.value
                          })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">{t('apSelectOption')}</option>
                          {question.options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Questions (Layer 2) */}
              {isAnalyzingPhoto && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                    <Brain className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">{t('apAiAnalyzing')}</span>
                  </div>
                </div>
              )}

              {aiQuestions.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-5 sm:p-6 border border-purple-200 dark:border-purple-700">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    {t('apAiSpecialQuestions')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('apAiPhotoAnalyzed')}
                  </p>
                  <div className="space-y-4">
                    {aiQuestions.map((question) => (
                      <div key={question.id}>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          {question.label}
                        </label>
                        <input
                          type="text"
                          value={aiAnswers[question.id] || ''}
                          onChange={(e) => setAiAnswers({
                            ...aiAnswers,
                            [question.id]: e.target.value
                          })}
                          className="w-full px-4 py-3 rounded-xl border border-purple-300 dark:border-purple-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder={t('apYourAnswer')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info when no photo uploaded for AI analysis */}
              {formData.images.length === 0 && !isAnalyzingPhoto && aiQuestions.length === 0 && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    {t('apUploadPhotoForAi')}
                  </p>
                </div>
              )}

              {/* Forward/Back Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('apBack')}
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 flex items-center gap-2"
                >
                  {t('apContinue')} <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Checklist */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('apConditionCheck')}</h2>
                <p className="text-gray-400 dark:text-gray-400 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  {t('apConditionCheckInfo')}
                </p>
              </div>

              <div className="space-y-4">
                {/* General Condition */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    {t('apGeneralCondition')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'new', label: t('conditionNew'), color: 'green' },
                      { value: 'like_new', label: t('conditionLikeNew'), color: 'blue' },
                      { value: 'good', label: t('conditionGood'), color: 'yellow' },
                      { value: 'fair', label: t('conditionFair'), color: 'orange' },
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
                        {[t('apYes'), t('apNo')].map((opt, idx) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleChecklistAnswer(item.id, idx === 0)}
                            className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                              checklistAnswers[item.id] === (idx === 0)
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
                        <option value="">{t('apSelectOption')}</option>
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
                  onClick={() => setStep(3)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('apBack')}
                </button>
                <button
                  onClick={calculateValor}
                  disabled={calculating}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {calculating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('calculating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {t('calculateValor')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Valor Result & Submit */}
          {step === 5 && valorResult && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('apValorDetermined')}</h2>

              {/* AI Recommendation */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  <span className="font-semibold text-purple-800">{t('apAiRecommendation')}</span>
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
                
                {/* Economic Valuation Detail */}
                {valorResult.economics && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs space-y-2">
                    <p className="font-bold text-gray-700 dark:text-gray-300">{t('apValuationDetail')}</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white dark:bg-gray-700 p-2 rounded">
                        <p className="text-gray-500">{t('apMarketValue')}</p>
                        <p className="font-bold text-gray-900 dark:text-white">~{valorResult.economics.estimatedPriceTL}₺</p>
                      </div>
                      <div className="bg-white dark:bg-gray-700 p-2 rounded">
                        <p className="text-gray-500">{t('apValorRate')}</p>
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
                  {t('apRequestedValor')}
                </label>
                <p className="text-sm text-gray-400 dark:text-gray-400 mb-4">
                  {t('apValorRangeInfo').split('%50').join('<span class="font-semibold text-purple-600">%50</span>').split('%200').join('<span class="font-semibold text-purple-600">%200</span>') ? t('apValorRangeInfo') : t('apValorRangeInfo')}
                </p>
                
                {/* Min/Max Info */}
                <div className="flex justify-between text-sm text-gray-400 dark:text-gray-400 mb-2">
                  <span>Min: {Math.max(1, Math.round(valorResult.aiPrice * 0.5))} Valor (0.5x)</span>
                  <span>Max: {Math.round(valorResult.aiPrice * 2)} Valor (2x)</span>
                </div>
                
                {/* Numeric Input Box */}
                <div className="mb-4 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                  <label className="block text-sm font-medium text-purple-700 mb-2 text-center">
                    {t('apRequestedValorLabel')}
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
                        {t('apDifferentFromAi').replace('{percent}', `${valorResult.userPrice > valorResult.aiPrice ? '+' : ''}${Math.round(((valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice) * 100)}%`)}
                        {Math.abs(valorResult.userPrice - valorResult.aiPrice) / valorResult.aiPrice > 0.5 && 
                          <span className="ml-1">{t('apHighDifference')}</span>
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
                      <strong>{t('apNote')}</strong> {t('apValorNote')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Additional Options */}
              <div className="p-6 rounded-2xl bg-white border border-gray-200 dark:border-gray-700 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  {t('apSwapOptions')}
                </h3>

                {/* Open to Negotiation & Messages */}
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
                      <span className="font-medium text-gray-900 dark:text-white">{t('apOpenToNegotiation')}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {t('apNegotiationDesc')}
                    </p>
                  </div>
                </label>

                {/* Free Available */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isFreeAvailable}
                    onChange={(e) => {
                      const isChecked = e.target.checked
                      setFormData({ ...formData, isFreeAvailable: isChecked })
                      if (valorResult) {
                        setValorResult({
                          ...valorResult,
                          userPrice: isChecked ? 1 : valorResult.aiPrice
                        })
                      }
                    }}
                    className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎁</span>
                      <span className="font-medium text-green-800 dark:text-green-300">{t('apFreeAvailable')}</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {t('apFreeAvailableDesc')}
                    </p>
                    {formData.isFreeAvailable && (
                      <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {t('apFreeAvailableNote')}
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
                  onClick={() => setStep(4)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('apBack')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('publishing')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      {t('publishProduct')}
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
