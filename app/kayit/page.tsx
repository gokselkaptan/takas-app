'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, UserPlus, AlertCircle, CheckCircle, ShieldCheck, RefreshCw, AtSign, Info } from 'lucide-react'

export default function KayitPage() {
  const router = useRouter()
  const [step, setStep] = useState<'register' | 'verify'>('register')
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showNicknameHelp, setShowNicknameHelp] = useState(false)
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalı')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          nickname: formData.nickname || undefined,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Kayıt sırasında bir hata oluştu')
        return
      }

      if (data.requiresVerification) {
        setStep('verify')
        setSuccess(data.message)
      }
    } catch (err) {
      setError('Kayıt sırasında bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const codes = value.slice(0, 6).split('')
      const newCode = [...verificationCode]
      codes.forEach((c, i) => {
        if (index + i < 6) newCode[index + i] = c
      })
      setVerificationCode(newCode)
      const nextIndex = Math.min(index + codes.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const code = verificationCode.join('')
    if (code.length !== 6) {
      setError('Lütfen 6 haneli kodu girin')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Doğrulama sırasında bir hata oluştu')
        return
      }

      // Auto login after verification
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.ok) {
        router.replace('/')
      } else {
        setSuccess('Hesabınız doğrulandı! Giriş yapabilirsiniz.')
        setTimeout(() => router.replace('/giris'), 2000)
      }
    } catch (err) {
      setError('Doğrulama sırasında bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setResending(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          nickname: formData.nickname || undefined,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await res.json()

      if (data.requiresVerification) {
        setSuccess('Yeni doğrulama kodu gönderildi!')
        setVerificationCode(['', '', '', '', '', ''])
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Kod gönderilemedi')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-gradient-to-br from-frozen-50 to-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-4"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <AnimatePresence mode="wait">
            {step === 'register' ? (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-8">
                  <Link href="/" className="text-3xl font-bold text-gradient-frozen">
                    TAKAS-A
                  </Link>
                  <h1 className="text-2xl font-bold text-gray-900 mt-4">Ücretsiz Kayıt Ol</h1>
                  <p className="text-gray-600 mt-2">Hemen üye ol ve takas yapmaya başla</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ad Soyad
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                        placeholder="Adınız Soyadınız"
                      />
                    </div>
                  </div>

                  {/* Nickname Field */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Takma Ad (İsteğe Bağlı)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNicknameHelp(!showNicknameHelp)}
                        className="text-frozen-500 hover:text-frozen-600"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                    {showNicknameHelp && (
                      <div className="mb-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                        Takma ad kullanarak gizliliğinizi koruyabilirsiniz. Bu isim platformda ad soyadınız yerine gösterilecektir.
                      </div>
                    )}
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                        placeholder="Örn: SwapMaster, TakasSever..."
                        maxLength={20}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Boş bırakırsanız adınızın ilk harfi ve soyadınızın baş harfi gösterilir
                    </p>
                  </div>

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
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifre
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                        placeholder="En az 6 karakter"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifre Tekrar
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                        placeholder="Şifreyi tekrar girin"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      'Kayıt oluşturuluyor...'
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Kayıt Ol
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-gray-600 mt-6">
                  Zaten hesabın var mı?{' '}
                  <Link href="/giris" className="text-frozen-600 font-semibold hover:underline">
                    Giriş Yap
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Email Doğrulama</h1>
                  <p className="text-gray-600 mt-2">
                    <span className="font-medium text-frozen-600">{formData.email}</span> adresine gönderilen 6 haneli kodu girin
                  </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                  <div className="flex justify-center gap-2">
                    {verificationCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-frozen-500 focus:ring-2 focus:ring-frozen-200 transition-all"
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Doğrulanıyor...' : 'Doğrula ve Devam Et'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600 mb-2">Kod gelmedi mi?</p>
                  <button
                    onClick={handleResendCode}
                    disabled={resending}
                    className="inline-flex items-center gap-2 text-frozen-600 font-semibold hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Gönderiliyor...' : 'Tekrar Gönder'}
                  </button>
                </div>

                <button
                  onClick={() => setStep('register')}
                  className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  ← Kayıt formuna geri dön
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}