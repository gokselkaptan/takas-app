'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react'

export default function SifremiUnuttumPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'verify' | 'success'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSuccessMessage(data.message)
        setStep('verify')
      } else {
        setError(data.error || 'Bir hata oluştu')
      }
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }
    
    if (newPassword.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır')
      return
    }
    
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword 
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setStep('success')
      } else {
        setError(data.error || 'Bir hata oluştu')
      }
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSuccessMessage('Yeni kod gönderildi!')
        setCode('')
      } else {
        setError(data.error || 'Kod gönderilemedi')
      }
    } catch (err) {
      setError('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-gradient-to-br from-frozen-50 to-white dark:from-gray-900 dark:to-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-4"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-bold text-gradient-frozen">
              TAKAS-A
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
              {step === 'email' && 'Şifremi Unuttum'}
              {step === 'verify' && 'Şifre Sıfırla'}
              {step === 'success' && 'Başarılı!'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {step === 'email' && 'Email adresinizi girin, size doğrulama kodu gönderelim'}
              {step === 'verify' && 'Emailinize gelen kodu girin ve yeni şifrenizi belirleyin'}
              {step === 'success' && 'Şifreniz başarıyla güncellendi'}
            </p>
          </div>

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
              </button>

              <Link 
                href="/giris" 
                className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-frozen-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Giriş sayfasına dön
              </Link>
            </form>
          )}

          {/* Step 2: Verify & Reset */}
          {step === 'verify' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-xl"
                >
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{successMessage}</span>
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Doğrulama Kodu (6 haneli)
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all text-center tracking-widest text-xl font-mono"
                    placeholder="000000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Yeni Şifre
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                    placeholder="En az 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Şifre Tekrar
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                    placeholder="Şifreyi tekrar girin"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Güncelleniyor...' : 'Şifremi Güncelle'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-frozen-600 hover:underline disabled:opacity-50"
                >
                  Kodu tekrar gönder
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Email değiştir
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-10 h-10 text-green-600" />
              </motion.div>
              
              <p className="text-gray-600 dark:text-gray-400">
                Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.
              </p>
              
              <Link
                href="/giris"
                className="block w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all text-center"
              >
                Giriş Yap
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
