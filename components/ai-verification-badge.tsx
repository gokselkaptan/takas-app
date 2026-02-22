'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Info, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

interface VerificationData {
  verified: boolean
  score: number | null
  verifiedAt?: string
  checks?: {
    resolution: boolean
    clarity: number
    authenticity: boolean
    isStockPhoto: boolean
    content: boolean
    lighting: number
  }
  recommendations?: string[]
  blockReason?: string
}

interface AIVerificationBadgeProps {
  productId: string
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
  className?: string
}

const translations = {
  tr: {
    verified: 'AI Doğrulandı',
    notVerified: 'Doğrulanmamış',
    checking: 'Kontrol ediliyor...',
    score: 'Kalite Puanı',
    resolution: 'Çözünürlük',
    clarity: 'Netlik',
    authenticity: 'Gerçeklik',
    content: 'İçerik',
    lighting: 'Aydınlatma',
    passed: 'Geçti',
    failed: 'Kaldı',
    stockPhoto: 'Stock Fotoğraf Tespit Edildi',
    recommendations: 'Öneriler',
    verifiedAt: 'Doğrulandı',
    whatIsThis: 'AI Doğrulama Nedir?',
    explanation: 'Yapay zeka tarafından ürün fotoğrafının gerçek olduğu, stock fotoğraf olmadığı ve kaliteli olduğu doğrulanmıştır.',
  },
  en: {
    verified: 'AI Verified',
    notVerified: 'Not Verified',
    checking: 'Checking...',
    score: 'Quality Score',
    resolution: 'Resolution',
    clarity: 'Clarity',
    authenticity: 'Authenticity',
    content: 'Content',
    lighting: 'Lighting',
    passed: 'Passed',
    failed: 'Failed',
    stockPhoto: 'Stock Photo Detected',
    recommendations: 'Recommendations',
    verifiedAt: 'Verified',
    whatIsThis: 'What is AI Verification?',
    explanation: 'The product photo has been verified by AI to be authentic, not a stock photo, and of good quality.',
  },
  es: {
    verified: 'Verificado por IA',
    notVerified: 'No Verificado',
    checking: 'Verificando...',
    score: 'Puntuación de Calidad',
    resolution: 'Resolución',
    clarity: 'Claridad',
    authenticity: 'Autenticidad',
    content: 'Contenido',
    lighting: 'Iluminación',
    passed: 'Aprobado',
    failed: 'Fallido',
    stockPhoto: 'Foto de Stock Detectada',
    recommendations: 'Recomendaciones',
    verifiedAt: 'Verificado',
    whatIsThis: '¿Qué es la Verificación IA?',
    explanation: 'La foto del producto ha sido verificada por IA como auténtica, no es una foto de stock y es de buena calidad.',
  },
  ca: {
    verified: 'Verificat per IA',
    notVerified: 'No Verificat',
    checking: 'Verificant...',
    score: 'Puntuació de Qualitat',
    resolution: 'Resolució',
    clarity: 'Claredat',
    authenticity: 'Autenticitat',
    content: 'Contingut',
    lighting: 'Il·luminació',
    passed: 'Aprovat',
    failed: 'Fallat',
    stockPhoto: 'Foto de Stock Detectada',
    recommendations: 'Recomanacions',
    verifiedAt: 'Verificat',
    whatIsThis: 'Què és la Verificació IA?',
    explanation: 'La foto del producte ha estat verificada per IA com a autèntica, no és una foto de stock i és de bona qualitat.',
  }
}

export default function AIVerificationBadge({
  productId,
  size = 'md',
  showDetails = false,
  className = ''
}: AIVerificationBadgeProps) {
  const { language } = useLanguage()
  const t = translations[language] || translations.tr
  
  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const res = await fetch(`/api/product-verification?productId=${productId}`)
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (error) {
        console.error('Verification fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchVerification()
  }, [productId])

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2'
  }
  const iconSize = { sm: 14, md: 16, lg: 20 }

  if (loading) {
    return (
      <div className={`inline-flex items-center ${sizeClasses[size]} bg-gray-100 text-gray-500 rounded-full animate-pulse ${className}`}>
        <Shield size={iconSize[size]} />
        <span>{t.checking}</span>
      </div>
    )
  }

  if (!data || data.score === null) {
    return null // Doğrulama verisi yoksa hiçbir şey gösterme
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getIcon = () => {
    if (data.verified && data.score && data.score >= 70) {
      return <ShieldCheck size={iconSize[size]} className="text-green-600" />
    }
    if (data.checks?.isStockPhoto) {
      return <ShieldX size={iconSize[size]} className="text-red-600" />
    }
    if (data.score && data.score >= 50) {
      return <Shield size={iconSize[size]} className="text-blue-600" />
    }
    return <ShieldAlert size={iconSize[size]} className="text-yellow-600" />
  }

  const badgeColor = data.verified 
    ? 'bg-green-50 text-green-700 border border-green-200' 
    : data.checks?.isStockPhoto 
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center ${sizeClasses[size]} ${badgeColor} rounded-full font-medium cursor-pointer`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {getIcon()}
        <span>
          {data.verified ? t.verified : data.checks?.isStockPhoto ? t.stockPhoto : t.notVerified}
        </span>
        {data.score !== null && (
          <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${getScoreColor(data.score)}`}>
            {data.score}
          </span>
        )}
        <Info size={iconSize[size] - 4} className="opacity-50" />
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {(showTooltip || showDetails) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border p-4"
          >
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="text-purple-600" size={18} />
              {t.whatIsThis}
            </h4>
            <p className="text-xs text-gray-600 mb-3">{t.explanation}</p>

            {data.score !== null && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>{t.score}</span>
                  <span className="font-bold">{data.score}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${data.score >= 70 ? 'bg-green-500' : data.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data.score}%` }}
                  />
                </div>
              </div>
            )}

            {data.checks && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>{t.resolution}</span>
                  {data.checks.resolution ? (
                    <CheckCircle2 size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.clarity}</span>
                  <span className="font-medium">{data.checks.clarity}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.authenticity}</span>
                  {data.checks.authenticity && !data.checks.isStockPhoto ? (
                    <CheckCircle2 size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.content}</span>
                  {data.checks.content ? (
                    <CheckCircle2 size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.lighting}</span>
                  <span className="font-medium">{data.checks.lighting}/100</span>
                </div>
              </div>
            )}

            {data.checks?.isStockPhoto && (
              <div className="mt-3 p-2 bg-red-50 rounded-lg flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle size={14} />
                <span>{t.stockPhoto}</span>
              </div>
            )}

            {data.recommendations && data.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <h5 className="text-xs font-medium mb-2">{t.recommendations}</h5>
                <ul className="space-y-1">
                  {data.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-purple-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.verifiedAt && (
              <div className="mt-3 pt-2 border-t text-xs text-gray-500">
                {t.verifiedAt}: {new Date(data.verifiedAt).toLocaleDateString(language)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Simple inline badge for product cards
export function AIVerificationBadgeSimple({ verified, score }: { verified: boolean; score?: number }) {
  if (!verified) return null
  
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
      <ShieldCheck size={12} />
      <span>AI</span>
      {score && <span className="font-bold">{score}</span>}
    </div>
  )
}
