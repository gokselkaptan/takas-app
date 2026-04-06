'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { RefreshCw, ChevronLeft, User, Flag, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface ReportDetail {
  id: string
  reason: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
  adminNote: string | null
  resolvedAt: string | null
  reporter: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    createdAt: string
  }
  reported: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    createdAt: string
    isBanned: boolean
  }
  resolver: {
    id: string
    name: string | null
    email: string | null
  } | null
}

const statusLabels: Record<string, string> = {
  PENDING: 'Bekleyen',
  REVIEWED: 'İncelendi',
  RESOLVED: 'Çözüldü',
  DISMISSED: 'Reddedildi',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-800',
}

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Taciz',
  fake_product: 'Sahte Ürün',
  fraud: 'Dolandırıcılık',
  inappropriate_content: 'Uygunsuz İçerik',
  other: 'Diğer',
}

const reasonColors: Record<string, string> = {
  spam: 'bg-orange-100 text-orange-800',
  harassment: 'bg-red-100 text-red-800',
  fake_product: 'bg-purple-100 text-purple-800',
  fraud: 'bg-red-100 text-red-800',
  inappropriate_content: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800',
}

export default function AdminReportDetailPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const reportId = params?.id as string

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Form state
  const [formStatus, setFormStatus] = useState<string>('')
  const [formNote, setFormNote] = useState<string>('')

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session?.user) {
      router.push('/')
    }
  }, [session, sessionStatus, router])

  useEffect(() => {
    if (reportId) {
      fetchReport()
    }
  }, [reportId])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/reports/${reportId}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/')
          return
        }
        if (res.status === 404) {
          setReport(null)
          return
        }
        throw new Error('Fetch error')
      }
      const data = await res.json()
      setReport(data)
      setFormStatus(data.status || 'PENDING')
      setFormNote(data.adminNote || '')
    } catch (error) {
      console.error('Report fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!report) return

    try {
      setUpdating(true)
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formStatus,
          adminNote: formNote,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Güncelleme başarısız')
      }

      setToast('Şikayet başarıyla güncellendi')
      setTimeout(() => setToast(null), 3000)
      fetchReport()
    } catch (error: any) {
      setToast(error.message || 'Bir hata oluştu')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setUpdating(false)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <Flag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-xl text-gray-400 mb-4">Rapor bulunamadı</p>
          <Link
            href="/admin/reports"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Listeye Dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/reports"
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-600" />
            Şikayet Detayı
          </h1>
          <span className={`ml-auto px-3 py-1 rounded-lg text-sm font-medium ${statusColors[report.status] || 'bg-gray-100 text-gray-800'}`}>
            {statusLabels[report.status] || report.status}
          </span>
        </div>

        {/* Kullanıcı Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Şikayet Eden */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Şikayet Eden</p>
            <div className="flex items-center gap-3">
              {report.reporter.image ? (
                <img
                  src={report.reporter.image}
                  alt={report.reporter.name || 'User'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {report.reporter.name || 'İsimsiz'}
                </p>
                <p className="text-sm text-gray-400">{report.reporter.email}</p>
                <p className="text-xs text-gray-400">
                  Kayıt: {new Date(report.reporter.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
          </div>

          {/* Şikayet Edilen */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Şikayet Edilen</p>
            <div className="flex items-center gap-3">
              {report.reported.image ? (
                <img
                  src={report.reported.image}
                  alt={report.reported.name || 'User'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-red-600" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {report.reported.name || 'İsimsiz'}
                  {report.reported.isBanned && (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-semibold">
                      Kullanıcı Banlanmış
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-400">{report.reported.email}</p>
                <p className="text-xs text-gray-400">
                  Kayıt: {new Date(report.reported.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/guvenlik-uyarilari`}
              className="inline-block mt-3 text-sm text-blue-600 hover:underline"
            >
              Kullanıcı Profilini Görüntüle →
            </Link>
          </div>
        </div>

        {/* Şikayet Detayları */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-600 mb-6">
          <h2 className="text-lg font-semibold mb-4">Şikayet Bilgileri</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Neden</p>
              <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${reasonColors[report.reason] || 'bg-gray-100 text-gray-800'}`}>
                {reasonLabels[report.reason] || report.reason}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Tarih</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(report.createdAt).toLocaleString('tr-TR')}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Açıklama</p>
            <p className="text-sm text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              {report.description || 'Açıklama eklenmemiş'}
            </p>
          </div>

          {report.resolver && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Çözümleyen Admin</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {report.resolver.name || report.resolver.email}
                </p>
              </div>
              {report.resolvedAt && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Çözülme Tarihi</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(report.resolvedAt).toLocaleString('tr-TR')}
                  </p>
                </div>
              )}
            </div>
          )}

          {report.adminNote && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Admin Notu</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                {report.adminNote}
              </p>
            </div>
          )}
        </div>

        {/* Admin İşlem Formu */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold mb-4">Admin İşlemi</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Durum</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PENDING">Bekleyen</option>
                <option value="REVIEWED">İncelendi</option>
                <option value="RESOLVED">Çözüldü</option>
                <option value="DISMISSED">Reddedildi</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Admin Notu</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={4}
                placeholder="İşlem hakkında not ekleyin..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleUpdate}
              disabled={updating}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {updating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Güncelleniyor...
                </>
              ) : (
                'Güncelle'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
