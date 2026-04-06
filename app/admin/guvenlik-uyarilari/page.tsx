'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, User, Package, RefreshCw, Flag, Bell } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface AdminAlert {
  id: string
  type: string
  triggeredById: string
  targetUserId: string | null
  metadata: string | null
  isRead: boolean
  createdAt: string
  triggeredBy: {
    id: string
    name: string | null
    email: string | null
  }
}

interface UserHistory {
  user: {
    id: string
    name: string | null
    email: string | null
    createdAt: string
    image: string | null
    isBanned: boolean
    bannedAt: string | null
  }
  products: Array<{ id: string; title: string; status: string; createdAt: string }>
  swaps: Array<{ id: string; status: string; createdAt: string }>
  reports: Array<{ id: string; reason: string; createdAt: string; reporter: { name: string | null; email: string | null } }>
  alerts: Array<{ id: string; type: string; createdAt: string; targetUserId: string | null }>
}

const alertTypeConfig: Record<string, { label: string; color: string; description: string }> = {
  BLOCK_ATTEMPT: {
    label: "Engelleme Girişimi",
    color: "bg-red-500",
    description: "admin'i engellemeye çalıştı"
  },
  SUSPICIOUS_SIMILARITY: {
    label: "⚠️ Şüpheli Benzerlik",
    color: "bg-yellow-500",
    description: "benzer email ile şüpheli işlem tespit edildi"
  },
}

export default function GuvenlikUyarilariPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userHistory, setUserHistory] = useState<UserHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'profil' | 'urunler' | 'takaslar' | 'sikayetler' | 'uyarilar'>('profil')
  const [banLoading, setBanLoading] = useState(false)

  // Admin kontrolü
  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user?.email || session.user.email !== 'join@takas-a.com') {
      router.push('/')
    }
  }, [session, status, router])

  // Uyarıları yükle
  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/alerts')
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Alerts fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Uyarıyı okundu işaretle
  const markAsRead = async (alertId: string) => {
    try {
      await fetch(`/api/admin/alerts/${alertId}`, { method: 'PATCH' })
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a))
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }

  // Kullanıcı geçmişini yükle
  const loadUserHistory = async (userId: string) => {
    try {
      setHistoryLoading(true)
      setSelectedUserId(userId)

      const res = await fetch(`/api/admin/users/${userId}/history`)
      const data = await res.json()
      setUserHistory(data)
    } catch (error) {
      console.error('User history fetch error:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Kullanıcıyı banla
  const banUser = async () => {
    if (!selectedUserId || !confirm('Bu kullanıcıyı sistemden uzaklaştırmak istediğinizden emin misiniz?')) {
      return
    }

    try {
      setBanLoading(true)

      const res = await fetch(`/api/admin/users/${selectedUserId}/ban`, { method: 'POST' })

      if (!res.ok) {
        throw new Error('Ban işlemi başarısız')
      }

      alert('Kullanıcı sistemden uzaklaştırıldı')
      setSelectedUserId(null)
      setUserHistory(null)
      fetchAlerts()
    } catch (error: any) {
      alert(error.message || 'Bir hata oluştu')
    } finally {
      setBanLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          Güvenlik Uyarıları
        </h1>

        {/* Uyarı Listesi */}
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400">Henüz güvenlik uyarısı yok</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const metadata = alert.metadata ? JSON.parse(alert.metadata) : {}

              return (
                <div
                  key={alert.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 ${
                    alert.isRead ? 'border-gray-300' : 'border-red-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {!alert.isRead && (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
                            YENİ
                          </span>
                        )}
                        {alertTypeConfig[alert.type] && (
                          <span className={`px-2 py-1 text-white text-xs rounded ${alertTypeConfig[alert.type].color}`}>
                            {alertTypeConfig[alert.type].label}
                          </span>
                        )}
                        <span className="font-semibold">
                          {alert.triggeredBy.name || alert.triggeredBy.email}
                        </span>
                        <span className="text-sm text-gray-400">
                          {alertTypeConfig[alert.type]?.description || alert.type}
                        </span>
                      </div>

                      <p className="text-sm text-gray-400 mb-2">
                        Zaman: {new Date(alert.createdAt).toLocaleString('tr-TR')}
                      </p>

                      {metadata.triggeredByEmail && (
                        <p className="text-sm text-gray-400">
                          Email: {metadata.triggeredByEmail}
                        </p>
                      )}
                      {metadata.suspiciousEmail && (
                        <p className="text-sm text-yellow-500">
                          Şüpheli Email: {metadata.suspiciousEmail}
                        </p>
                      )}
                      {metadata.note && (
                        <p className="text-sm text-gray-400 italic">
                          Not: {metadata.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        loadUserHistory(alert.triggeredById)
                        if (!alert.isRead) {
                          markAsRead(alert.id)
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Detay Gör
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Kullanıcı Geçmişi Modal */}
        {selectedUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-semibold">Kullanıcı Geçmişi</h2>
                <button
                  onClick={() => {
                    setSelectedUserId(null)
                    setUserHistory(null)
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {historyLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p>Yükleniyor...</p>
                  </div>
                ) : userHistory ? (
                  <>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                      {([
                        { key: 'profil', label: 'Profil', icon: User },
                        { key: 'urunler', label: 'Ürünler', icon: Package },
                        { key: 'takaslar', label: 'Takaslar', icon: RefreshCw },
                        { key: 'sikayetler', label: 'Şikayetler', icon: Flag },
                        { key: 'uyarilar', label: 'Uyarılar', icon: AlertTriangle }
                      ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setActiveTab(key)}
                          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === key
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'profil' && (
                      <div className="space-y-4">
                        {userHistory.user.image && (
                          <img
                            src={userHistory.user.image}
                            alt={userHistory.user.name || 'User'}
                            className="w-24 h-24 rounded-full"
                          />
                        )}
                        <div>
                          <p><strong>Ad:</strong> {userHistory.user.name || 'N/A'}</p>
                          <p><strong>Email:</strong> {userHistory.user.email}</p>
                          <p><strong>Kayıt Tarihi:</strong> {new Date(userHistory.user.createdAt).toLocaleDateString('tr-TR')}</p>
                          {userHistory.user.isBanned && (
                            <p className="text-red-600 font-semibold">
                              <strong>Durum:</strong> Banlandı ({userHistory.user.bannedAt ? new Date(userHistory.user.bannedAt).toLocaleDateString('tr-TR') : 'N/A'})
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'urunler' && (
                      <div className="space-y-2">
                        {userHistory.products.length === 0 ? (
                          <p className="text-gray-400">Ürün yok</p>
                        ) : (
                          userHistory.products.map((product) => (
                            <div key={product.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p><strong>{product.title}</strong></p>
                              <p className="text-sm text-gray-400">
                                Durum: {product.status} | {new Date(product.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'takaslar' && (
                      <div className="space-y-2">
                        {userHistory.swaps.length === 0 ? (
                          <p className="text-gray-400">Takas yok</p>
                        ) : (
                          userHistory.swaps.map((swap) => (
                            <div key={swap.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p>Durum: {swap.status}</p>
                              <p className="text-sm text-gray-400">
                                {new Date(swap.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'sikayetler' && (
                      <div className="space-y-2">
                        {userHistory.reports.length === 0 ? (
                          <p className="text-gray-400">Şikayet yok</p>
                        ) : (
                          userHistory.reports.map((report) => (
                            <div key={report.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p><strong>Neden:</strong> {report.reason}</p>
                              <p className="text-sm text-gray-400">
                                Şikayet eden: {report.reporter.name || report.reporter.email}
                              </p>
                              <p className="text-sm text-gray-400">
                                {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'uyarilar' && (
                      <div className="space-y-2">
                        {userHistory.alerts.length === 0 ? (
                          <p className="text-gray-400">Uyarı yok</p>
                        ) : (
                          userHistory.alerts.map((alert) => (
                            <div key={alert.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p><strong>Tip:</strong> {alert.type}</p>
                              <p className="text-sm text-gray-400">
                                {new Date(alert.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Modal Footer */}
              {userHistory && !userHistory.user.isBanned && (
                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={banUser}
                    disabled={banLoading}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {banLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        İşleniyor...
                      </>
                    ) : (
                      'Sistemden Uzaklaştır'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
