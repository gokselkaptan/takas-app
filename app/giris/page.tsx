'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn, AlertCircle, Shield, Clock } from 'lucide-react'
import Script from 'next/script'

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

export default function GirisPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockoutInfo, setLockoutInfo] = useState<{ minutes: number; until: string } | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false)

  // Kilitleme süresi sayacı
  useEffect(() => {
    if (lockoutInfo) {
      const interval = setInterval(() => {
        const now = new Date()
        const until = new Date(lockoutInfo.until)
        const diff = Math.ceil((until.getTime() - now.getTime()) / 60000)
        
        if (diff <= 0) {
          setLockoutInfo(null)
          setFailedAttempts(0)
        } else {
          setLockoutInfo(prev => prev ? { ...prev, minutes: diff } : null)
        }
      }, 30000) // Her 30 saniyede güncelle
      
      return () => clearInterval(interval)
    }
  }, [lockoutInfo])

  const getCaptchaToken = useCallback(async (): Promise<string | null> => {
    if (!RECAPTCHA_SITE_KEY || !recaptchaLoaded || !window.grecaptcha) {
      return null
    }
    
    try {
      return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' })
    } catch (err) {
      console.error('reCAPTCHA error:', err)
      return null
    }
  }, [recaptchaLoaded])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (lockoutInfo) {
      setError(`Hesabınız ${lockoutInfo.minutes} dakika boyunca kilitli`)
      return
    }
    
    setError('')
    setLoading(true)

    try {
      // 3+ başarısız denemeden sonra reCAPTCHA kullan
      let captchaToken: string | null = null
      if (failedAttempts >= 2 && RECAPTCHA_SITE_KEY) {
        captchaToken = await getCaptchaToken()
      }

      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        const newAttempts = failedAttempts + 1
        setFailedAttempts(newAttempts)
        
        if (result.error === 'ACCOUNT_LOCKED' || result.error.includes('ACCOUNT_LOCKED')) {
          // Hesap kilitlendi
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 dakika
          setLockoutInfo({
            minutes: 30,
            until: lockUntil.toISOString()
          })
          setError('Hesabınız çok fazla başarısız deneme nedeniyle geçici olarak kilitlendi')
        } else if (newAttempts >= 4) {
          setError(`Geçersiz email veya şifre. Son ${5 - newAttempts} deneme hakkınız kaldı.`)
        } else {
          setError('Geçersiz email veya şifre')
        }
      } else {
        setFailedAttempts(0)
        router.replace('/')
      }
    } catch (err) {
      setError('Giriş yapılırken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* reCAPTCHA v3 Script */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          onLoad={() => setRecaptchaLoaded(true)}
        />
      )}
      
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-gradient-to-br from-frozen-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-4"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <Link href="/" className="text-3xl font-bold text-gradient-frozen">
                TAKAS-A
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-4">Giriş Yap</h1>
              <p className="text-gray-600 mt-2">Hesabına giriş yap ve takas yapmaya başla</p>
            </div>

            {/* Kilitleme Uyarısı */}
            {lockoutInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
              >
                <div className="flex items-center gap-3 text-red-700">
                  <Clock className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Hesap Geçici Olarak Kilitli</p>
                    <p className="text-sm">
                      {lockoutInfo.minutes} dakika sonra tekrar deneyebilirsiniz
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                    placeholder="ornek@email.com"
                    disabled={!!lockoutInfo}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Şifre
                  </label>
                  <Link 
                    href="/sifremi-unuttum" 
                    className="text-sm text-frozen-600 hover:text-frozen-700 hover:underline"
                  >
                    Şifremi Unuttum
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    disabled={!!lockoutInfo}
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Başarısız deneme uyarısı */}
              {failedAttempts >= 2 && !lockoutInfo && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl text-sm">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>Güvenlik doğrulaması aktif</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!lockoutInfo}
                className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  'Giriş yapılıyor...'
                ) : lockoutInfo ? (
                  <>
                    <Clock className="w-5 h-5" />
                    Kilitli
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Giriş Yap
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-6">
              Hesabın yok mu?{' '}
              <Link href="/kayit" className="text-frozen-600 font-semibold hover:underline">
                Kayıt Ol
              </Link>
            </p>
            
            {/* Güvenlik Bilgisi */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield className="w-3 h-3" />
                <span>Bu sayfa SSL ile korunmaktadır</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
