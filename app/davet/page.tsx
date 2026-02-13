'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  UserPlus, Gift, Copy, CheckCircle, Clock, Star, Users, Share2,
  AlertCircle, Loader2, Send
} from 'lucide-react'

export default function DavetPage() {
  const router = useRouter()
  const { data: session, status } = useSession() || {}

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  const [referralData, setReferralData] = useState<{
    referralCode: string
    totalReferrals: number
    valorBalance: number
    canInvite: boolean
    hoursUntilNextInvite: number
  } | null>(null)

  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    } else if (status === 'authenticated') {
      fetchReferralData()
    }
  }, [status, router])

  useEffect(() => {
    if (!referralData?.canInvite && referralData?.hoursUntilNextInvite) {
      const totalSeconds = referralData.hoursUntilNextInvite * 3600
      let remaining = totalSeconds

      const interval = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(interval)
          fetchReferralData()
          return
        }

        const hours = Math.floor(remaining / 3600)
        const minutes = Math.floor((remaining % 3600) / 60)
        const seconds = remaining % 60
        setCountdown({ hours, minutes, seconds })
      }, 1000)

      // Initial set
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      setCountdown({ hours, minutes, seconds })

      return () => clearInterval(interval)
    }
  }, [referralData])

  const fetchReferralData = async () => {
    try {
      const res = await fetch('/api/referral')
      const data = await res.json()
      if (res.ok) {
        setReferralData(data)
      }
    } catch (err) {
      console.error('Referral data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = () => {
    if (!referralData) return
    const link = `https://takas-a.com/kayit?ref=${referralData.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendInvite = async () => {
    if (!inviteEmail || sending) return
    setError('')
    setSuccess('')
    setSending(true)

    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Davet gönderilemedi')
        return
      }

      setSuccess('Davet başarıyla gönderildi!')
      setInviteEmail('')
      fetchReferralData()
    } catch (err) {
      setError('Bir hata oluştu')
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Arkadaşını Davet Et</h1>
          <p className="text-gray-600 mt-2">
            Arkadaşlarını davet et, hem sen hem de arkadaşın Valor kazan!
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-gray-900">
              {referralData?.totalReferrals || 0}
            </div>
            <div className="text-sm text-gray-600">Davet Edilen</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-gray-900">
              {referralData?.valorBalance || 0}
            </div>
            <div className="text-sm text-gray-600">Toplam Valor</div>
          </div>
        </motion.div>

        {/* Referral Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-purple-600" />
            Davet Kodun
          </h2>

          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200 font-mono text-lg text-purple-700 text-center">
              {referralData?.referralCode || '...'}
            </div>
            <button
              onClick={copyReferralLink}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 transition-all"
            >
              {copied ? <CheckCircle className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
            </button>
          </div>

          {copied && (
            <p className="text-green-600 text-sm mt-2 text-center">Link kopyalandı!</p>
          )}
        </motion.div>

        {/* Invite Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-600" />
            Email ile Davet Gönder
          </h2>

          {referralData?.canInvite ? (
            <>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="arkadas@email.com"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail || sending}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {sending ? 'Gönderiliyor...' : 'Davet Et'}
                </button>
              </div>

              <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Günde 1 arkadaşını davet edebilirsin
              </p>
            </>
          ) : (
            <div className="text-center py-6">
              <Clock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sonraki davet hakkınız için bekleniyor
              </h3>
              
              {/* Countdown Timer */}
              <div className="flex justify-center gap-4 my-6">
                <div className="bg-purple-100 rounded-xl px-4 py-3 min-w-[70px]">
                  <div className="text-3xl font-bold text-purple-700">
                    {String(countdown.hours).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-purple-600">Saat</div>
                </div>
                <div className="bg-purple-100 rounded-xl px-4 py-3 min-w-[70px]">
                  <div className="text-3xl font-bold text-purple-700">
                    {String(countdown.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-purple-600">Dakika</div>
                </div>
                <div className="bg-purple-100 rounded-xl px-4 py-3 min-w-[70px]">
                  <div className="text-3xl font-bold text-purple-700">
                    {String(countdown.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-purple-600">Saniye</div>
                </div>
              </div>

              <p className="text-gray-500 text-sm">
                Bu sürede referans linkini paylaşmaya devam edebilirsiniz
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 rounded-xl bg-green-50 text-green-700 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}
        </motion.div>

        {/* Rewards Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-8 h-8" />
            <h2 className="text-xl font-bold">Ödüller</h2>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                50
              </div>
              <span>Her başarılı davet için 50 Valor kazanırsın</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                25
              </div>
              <span>Arkadaşın da kayıt bonusu olarak 25 Valor kazanır</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                ∞
              </div>
              <span>Linki istediğin kadar paylaş, davetler limitli değil!</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </main>
  )
}
