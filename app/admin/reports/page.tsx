'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Flag, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Report {
  id: string
  reason: string
  description: string | null
  status: string
  createdAt: string
  adminNote: string | null
  resolvedAt: string | null
  reporter: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  reported: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    isBanned: boolean
  }
  resolver: {
    id: string
    name: string | null
    email: string | null
  } | null
}

interface Stats {
  pending: number
  reviewed: number
  resolved: number
  dismissed: number
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
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

export default function AdminReportsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, reviewed: 0, resolved: 0, dismissed: 0 })
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterReason, setFilterReason] = useState<string>('')

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session?.user) {
      router.push('/')
    }
  }, [session, sessionStatus, router])

  useEffect(() => {
    fetchReports(1)
  }, [filterStatus, filterReason])

  const fetchReports = async (page: number) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (filterStatus) params.set('status', filterStatus)
      if (filterReason) params.set('reason', filterReason)

      const res = await fetch(`/api/admin/reports?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Fetch error')
      }
      const data = await res.json()
      setReports(data.reports || [])
      setStats(data.stats || { pending: 0, reviewed: 0, resolved: 0, dismissed: 0 })
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
    } catch (error) {
      console.error('Reports fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Flag className="w-8 h-8 text-red-600" />
              Şikayet Yönetimi
            </h1>
          </div>
          <button
            onClick={() => fetchReports(pagination.page)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </button>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <span className="text-lg">⏳</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
                <p className="text-sm text-gray-400">Bekleyen</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <span className="text-lg">🔍</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.reviewed}</p>
                <p className="text-sm text-gray-400">İncelendi</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <span className="text-lg">✅</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.resolved}</p>
                <p className="text-sm text-gray-400">Çözüldü</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <span className="text-lg">❌</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.dismissed}</p>
                <p className="text-sm text-gray-400">Reddedildi</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Durum</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tümü</option>
              <option value="PENDING">Bekleyen</option>
              <option value="REVIEWED">İncelendi</option>
              <option value="RESOLVED">Çözüldü</option>
              <option value="DISMISSED">Reddedildi</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Neden</label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tümü</option>
              <option value="spam">Spam</option>
              <option value="harassment">Taciz</option>
              <option value="fake_product">Sahte Ürün</option>
              <option value="fraud">Dolandırıcılık</option>
              <option value="inappropriate_content">Uygunsuz İçerik</option>
              <option value="other">Diğer</option>
            </select>
          </div>
        </div>

        {/* Tablo */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Yükleniyor...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-400 text-lg">Henüz şikayet yok</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Şikayet Eden</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Şikayet Edilen</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Neden</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Açıklama</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Tarih</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Durum</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {report.reporter.name || 'İsimsiz'}
                          </p>
                          <p className="text-xs text-gray-400">{report.reporter.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {report.reported.name || 'İsimsiz'}
                            {report.reported.isBanned && (
                              <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-semibold">
                                BANLI
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{report.reported.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${reasonColors[report.reason] || 'bg-gray-100 text-gray-800'}`}>
                          {reasonLabels[report.reason] || report.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-400 max-w-[200px] truncate" title={report.description || ''}>
                          {report.description || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors[report.status] || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[report.status] || report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/reports/${report.id}`}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-400">
                  Toplam {pagination.total} şikayet — Sayfa {pagination.page} / {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchReports(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchReports(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
