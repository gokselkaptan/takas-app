'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { 
  MessageCircle, Heart, Package, Users, Clock, CheckCircle, XCircle,
  ArrowLeft, Eye, Mail, Calendar, Filter, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart3,
  Coins, PiggyBank, ArrowUpRight, ArrowDownRight, Wallet, Activity, AlertTriangle, Bug, Trash2,
  Scale, Camera, FileWarning, Gavel, Shield, Lock, Globe, Fingerprint, Settings, Gauge, Zap, Save, ChevronDown,
  Volume2, VolumeX, Music, Bell, CheckCircle2
} from 'lucide-react'
import { playMessageSound, playSwapOfferSound, playMatchSound, playCoinSound, playNotificationSound, playErrorSound, unlockAudio } from '@/lib/notification-sounds'
import { triggerSwapConfetti, triggerValorConfetti, triggerMiniConfetti } from '@/components/confetti-celebration'
import { ValorAnimation, useValorAnimation } from '@/components/valor-animation'
import { getDisplayName } from '@/lib/display-name'
import { safeGet, safeFetch, isOffline } from '@/lib/safe-fetch'

interface SwapRequest {
  id: string
  message: string | null
  status: string
  createdAt: string
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
    category: { name: string }
    user: { name: string | null; email: string }
  }
  requester: {
    id: string
    name: string | null
    email: string
  }
}

interface Message {
  id: string
  content: string
  createdAt: string
  isRead: boolean
  sender: { id: string; name: string | null; email: string }
  receiver: { id: string; name: string | null; email: string }
  product: { id: string; title: string; images: string[]; valorPrice: number } | null
}

interface CategoryDemand {
  categoryId: string
  categoryName: string
  totalViews: number
  totalProducts: number
  completedSwaps: number
  avgViewsPerProduct: number
  demandScore: number
  priceMultiplier: number
  trend: 'rising' | 'stable' | 'falling'
}

interface DemandAnalysis {
  analyzedAt: string
  categories: CategoryDemand[]
  globalStats: {
    totalViews: number
    totalSwaps: number
    avgDemandScore: number
  }
}

interface ValorTransaction {
  id: string
  type: string
  amount: number
  fee: number
  netAmount: number
  description: string | null
  createdAt: string
  fromUser: { name: string | null; nickname: string | null; email: string } | null
  toUser: { name: string | null; nickname: string | null; email: string } | null
}

interface SystemValorStats {
  communityPoolValor: number
  totalFeesCollected: number
  distributedValor: number
  totalValorSupply: number
  reserveValor: number
  totalTransactions: number
  totalSwapsCompleted: number
  totalMeltedValor: number
  lastMeltProcessedAt: string | null
  circulatingValor: number
  totalUserValor: number
  utilizationRate: number
  averageFeePerSwap: number
  recentTransactions: ValorTransaction[]
}

interface ErrorLog {
  id: string
  type: string
  message: string
  stack: string | null
  componentStack: string | null
  url: string | null
  userAgent: string | null
  severity: string
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string } | null
}

interface ErrorStats {
  _count: number
  type?: string
  severity?: string
  resolved?: boolean
}

// GÖREV 47: Gelişmiş Dispute interface
interface Dispute {
  id: string
  type: string
  description: string
  status: string
  evidence: string[]
  reporterEvidence: string[]
  reporterEvidenceNote: string | null
  reporterEvidenceAt: string | null
  reportedEvidence: string[]
  reportedEvidenceNote: string | null
  reportedEvidenceAt: string | null
  evidenceDeadline: string | null
  reporterSettlementChoice: string | null
  reportedSettlementChoice: string | null
  settlementType: string | null
  resolution: string | null
  adminNotes: string | null
  createdAt: string
  // GÖREV 46/47: Yeni alanlar
  contactEmail?: string
  disputeType?: string
  expectedResolution?: string
  evidencePhotos?: string[]
  aiAnalysis?: string
  resolvedAt?: string
  disputeTypeLabel?: string
  expectedResolutionLabel?: string
  reporterSwapCount?: number
  ownerSwapCount?: number
  reporterId?: string
  reportedUserId?: string
  swapRequest: {
    id: string
    product: { id: string; title: string; images: string[]; valorPrice?: number; description?: string }
    offeredProduct?: { id: string; title: string; images: string[]; valorPrice?: number; description?: string } | null
    owner: { id: string; name: string | null; email: string; image?: string; trustScore?: number; nickname?: string | null }
    requester: { id: string; name: string | null; email: string; image?: string; trustScore?: number; nickname?: string | null }
  }
}

// GÖREV 47: Güncellenmiş label'lar
const DISPUTE_TYPE_LABELS: Record<string, string> = {
  defect: 'Ürün Kusurlu',
  not_as_described: 'Açıklamayla Uyuşmuyor',
  missing_parts: 'Eksik Parça',
  damaged: 'Hasar Var',
  other: 'Diğer',
  product_mismatch: 'Ürün Açıklamayla Uyuşmuyor',
  product_damaged: 'Ürün Hasarlı/Kusurlu Geldi',
  product_not_delivered: 'Ürün Teslim Edilmedi',
  wrong_product: 'Yanlış Ürün Gönderildi',
  valor_dispute: 'VALOR Değeri Anlaşmazlığı',
  communication_issue: 'İletişim Sorunu',
  fraud_suspicion: 'Dolandırıcılık Şüphesi',
  wrong_item: 'Yanlış Ürün',
  no_show: 'Karşı Taraf Gelmedi'
}

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: 'Açık',
  evidence_pending: 'Kanıt Bekleniyor',
  settlement_pending: 'Uzlaşma Bekleniyor',
  under_review: 'İnceleniyor',
  resolved: 'Çözüldü',
  resolved_reporter: 'Bildirici Haklı',
  resolved_respondent: 'Karşı Taraf Haklı',
  resolved_mutual: 'Karşılıklı Çözüm',
  closed: 'Kapatıldı',
  rejected: 'Reddedildi'
}

const EXPECTED_RESOLUTION_LABELS: Record<string, string> = {
  refund_valor: 'VALOR İadesi',
  product_return: 'Ürün İadesi',
  replacement: 'Değişim',
  partial_refund: 'Kısmi VALOR İadesi',
  apology: 'Özür / Uyarı Yeterli',
  other: 'Diğer'
}

const SETTLEMENT_OPTIONS = [
  { id: '50_50', title: 'Eşit Paylaşım', description: '%50 iade her iki tarafa' },
  { id: '70_30', title: 'Alıcı Lehine', description: '%70 alıcıya, %30 satıcıya' },
  { id: 'full_refund', title: 'Tam İade', description: 'Tüm teminat alıcıya' },
  { id: 'cancel_no_penalty', title: 'Cezasız İptal', description: 'Trust puanı etkilenmez' }
]

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'interests' | 'messages' | 'demand' | 'valor' | 'errors' | 'disputes' | 'security' | 'inflation' | 'config' | 'backup' | 'test' | 'users' | 'newsletter' | 'ses-testi' | 'bildirimler'>('interests')
  const [testResults, setTestResults] = useState<any>({})
  const { show: showValorAnim, amount: valorAmount, showValor, hideValor } = useValorAnimation()
  
  // Kullanıcı Analitik State
  const [userAnalytics, setUserAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week')
  const [backupLoading, setBackupLoading] = useState(false)
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)
  const [showPasswordWarning, setShowPasswordWarning] = useState(true)
  const [inflationData, setInflationData] = useState<{
    metrics: {
      weekly: { distributed: number; percentOfTotal: number; percentOfRemaining: number }
      monthly: { estimated: number; percentOfTotal: number }
      yearly: { estimated: number; percentOfTotal: number; yearsUntilExhaustion: number }
      healthStatus: 'healthy' | 'warning' | 'critical'
      recommendation?: string
    }
    bonusBreakdown: Array<{ type: string; totalAmount: number; count: number }>
    systemStatus: {
      totalSupply: number
      distributed: number
      remaining: number
      weeklyDistributed: number
      lastWeeklyReset: string | null
    }
  } | null>(null)
  const [configData, setConfigData] = useState<{
    welcomeBonusAmount: number
    dailyBonusBase: number
    productBonusAmount: number
    referralBonusAmount: number
    reviewBonusAmount: number
    minAccountAgeDays: number
    requireVerification: boolean
  } | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [revalueStatus, setRevalueStatus] = useState<{
    mode: 'dry_run' | 'apply'
    processed: number
    totalProducts: number
    errors: number
    totalOldValor: number
    totalNewValor: number
    totalChange: string
    results: Array<{ id: string; title: string; category?: string; country?: string; oldValor: number; newValor: number; estimatedTL?: number; change?: string; formula?: string; error?: string }>
  } | null>(null)
  const [revaluing, setRevaluing] = useState(false)
  const [revalueMode, setRevalueMode] = useState<'dry_run' | 'apply'>('dry_run')
  const [revalueCategory, setRevalueCategory] = useState('all')
  const [revalueLimit, setRevalueLimit] = useState(50)
  const [securityStats, setSecurityStats] = useState<{
    total: number
    last24h: number
    last7d: number
    byType: Array<{ eventType: string; _count: number }>
    bySeverity: Array<{ severity: string; _count: number }>
    topIPs: Array<{ ip: string; count: number }>
  } | null>(null)
  const [securityLogs, setSecurityLogs] = useState<Array<{
    id: string
    eventType: string
    ip: string
    userAgent: string | null
    email: string | null
    severity: string
    metadata: string | null
    createdAt: string
    user: { id: string; name: string; email: string } | null
  }>>([])
  const [suspiciousActivities, setSuspiciousActivities] = useState<Array<{
    id: string
    type: string
    message: string
    severity: string
    userId: string | null
    user: { id: string; name: string; email: string } | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }>>([])
  const [securityFilter, setSecurityFilter] = useState({ eventType: '', severity: '' })
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState<{ id: string; content: string } | null>(null)
  // Yeni mesajlar sekmesi state'leri
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [searchUserQuery, setSearchUserQuery] = useState('')
  const [filteredConversations, setFilteredConversations] = useState<any[]>([])
  const [demandAnalysis, setDemandAnalysis] = useState<DemandAnalysis | null>(null)
  const [systemValor, setSystemValor] = useState<SystemValorStats | null>(null)
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [errorStats, setErrorStats] = useState<ErrorStats[]>([])
  const [errorTotal, setErrorTotal] = useState(0)
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [disputeResolution, setDisputeResolution] = useState('')
  const [disputePenalty, setDisputePenalty] = useState(0)
  const [disputeAdminNotes, setDisputeAdminNotes] = useState('')
  const [processingDispute, setProcessingDispute] = useState(false)
  // GÖREV 47/48: AI analizi için state'ler
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null) // dispute.id
  const [expandedDispute, setExpandedDispute] = useState<string | null>(null) // Detay görünümü için
  const [loading, setLoading] = useState(true)
  const [refreshingDemand, setRefreshingDemand] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [errorFilter, setErrorFilter] = useState<'all' | 'resolved' | 'unresolved'>('all')
  const [showClearMenu, setShowClearMenu] = useState(false)
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all')
  const [disputeFilter, setDisputeFilter] = useState<'all' | 'open' | 'evidence_pending' | 'under_review' | 'resolved'>('all')

  // Newsletter State
  const [newsletterSubject, setNewsletterSubject] = useState('')
  const [newsletterContent, setNewsletterContent] = useState('')
  const [newsletterSending, setNewsletterSending] = useState(false)
  const [newsletterProgress, setNewsletterProgress] = useState<{sent: number; failed: number; total: number} | null>(null)
  const [newsletterSendToAll, setNewsletterSendToAll] = useState(false)
  const [newsletterStats, setNewsletterStats] = useState<{totalUsers: number; verifiedUsers: number; eligibleRecipients: number} | null>(null)

  // Verification Reminder State
  const [verificationSending, setVerificationSending] = useState(false)
  const [verificationProgress, setVerificationProgress] = useState<{sent: number; failed: number; total: number; languageStats?: {tr: number; en: number; de: number}} | null>(null)
  const [verificationStats, setVerificationStats] = useState<{totalUsers: number; verifiedUsers: number; unverifiedUsers: number; verificationRate: string} | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  // Broadcast Push Notification State
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastUrl, setBroadcastUrl] = useState('/')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{sent: number, failed: number} | null>(null)
  const [broadcastSegment, setBroadcastSegment] = useState<'all' | 'inactive_3days' | 'no_product' | 'no_offer'>('all')

  // Tek useEffect ile auth kontrolü
  useEffect(() => {
    // next-auth session yüklenene kadar bekle
    if (status === 'loading') return

    // Giriş yapılmamışsa yönlendir
    if (status === 'unauthenticated') {
      router.replace('/giris')
      return
    }

    // Authenticated — admin kontrolü yap
    if (status === 'authenticated' && session?.user?.email) {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.role === 'admin') {
            setPageReady(true)
          } else {
            setPageError('Bu sayfaya erişim yetkiniz yok. Sadece adminler erişebilir.')
            setLoading(false)
          }
        })
        .catch(() => {
          setPageError('Profil yüklenemedi. Lütfen sayfayı yenileyin.')
          setLoading(false)
        })
    }
  }, [status, session, router])

  // Tab değiştiğinde veri çek
  useEffect(() => {
    if (!pageReady) return
    fetchData()
  }, [pageReady, activeTab])

  // Güvenlik filtresi değiştiğinde sadece güvenlik tab'ında veri çek  
  useEffect(() => {
    if (activeTab === 'security' && pageReady) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [securityFilter])
  
  // Son yedekleme tarihini localStorage'dan al
  useEffect(() => {
    const lastBackup = localStorage.getItem('takas-a-last-backup')
    setLastBackupDate(lastBackup)
  }, [])

  const fetchData = async () => {
    // Offline kontrolü
    if (isOffline()) {
      setError('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin.')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      if (activeTab === 'interests') {
        const { data, ok, error } = await safeGet('/api/swap-requests?all=true', { timeout: 15000 })
        if (ok && data) {
          setSwapRequests(Array.isArray(data) ? data : (data.requests || []))
        } else {
          setError(error || 'Takas istekleri yüklenemedi')
        }
      } else if (activeTab === 'messages') {
        await fetchConversations()
      } else if (activeTab === 'demand') {
        const { data, ok, error } = await safeGet('/api/admin/demand-analysis', { timeout: 15000 })
        if (ok && data) {
          setDemandAnalysis(data)
        } else {
          setError(error || 'Talep analizi yüklenemedi')
        }
      } else if (activeTab === 'valor') {
        const { data, ok, error } = await safeGet('/api/admin/system-valor', { timeout: 15000 })
        if (ok && data) {
          setSystemValor(data)
        } else {
          setError(error || 'Valor istatistikleri yüklenemedi')
        }
      } else if (activeTab === 'errors') {
        await fetchErrors()
      } else if (activeTab === 'disputes') {
        await fetchDisputes()
      } else if (activeTab === 'security') {
        // Paralel güvenlik verileri
        const [statsResult, logsResult, suspiciousResult] = await Promise.all([
          safeGet('/api/admin/security?action=stats', { timeout: 15000 }),
          safeGet(`/api/admin/security?action=logs&eventType=${securityFilter.eventType}&severity=${securityFilter.severity}`, { timeout: 15000 }),
          safeGet('/api/admin/security?action=suspicious', { timeout: 15000 })
        ])
        
        if (statsResult.ok && statsResult.data) {
          setSecurityStats(statsResult.data)
        }
        if (logsResult.ok && logsResult.data) {
          setSecurityLogs(logsResult.data.logs || [])
        }
        if (suspiciousResult.ok && suspiciousResult.data) {
          setSuspiciousActivities(suspiciousResult.data.activities || [])
        }
        if (!statsResult.ok && !logsResult.ok) {
          setError(statsResult.error || 'Güvenlik verileri yüklenemedi')
        }
      } else if (activeTab === 'inflation') {
        const { data, ok, error } = await safeGet('/api/admin/inflation', { timeout: 15000 })
        if (ok && data) {
          setInflationData(data)
        } else {
          setError(error || 'Enflasyon verileri yüklenemedi')
        }
      } else if (activeTab === 'config') {
        const { data, ok, error } = await safeGet('/api/admin/config', { timeout: 15000 })
        if (ok && data) {
          setConfigData(data.config)
        } else {
          setError(error || 'Konfigürasyon yüklenemedi')
        }
      } else if (activeTab === 'newsletter') {
        // Newsletter istatistikleri
        const { data, ok } = await safeGet('/api/admin/send-newsletter', { timeout: 15000 })
        if (ok && data) {
          setNewsletterStats(data)
        }
        // Doğrulama hatırlatması istatistikleri
        const { data: verifyData, ok: verifyOk } = await safeGet('/api/admin/send-verification-reminder', { timeout: 15000 })
        if (verifyOk && verifyData) {
          setVerificationStats(verifyData)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/admin/disputes')
      if (res.ok) {
        const data = await res.json()
        setDisputes(data)
      }
    } catch (error) {
      console.error('Error fetching disputes:', error)
    }
  }

  const handleResolveDispute = async (resolution: string, refundApproved: boolean) => {
    if (!selectedDispute) return
    
    setProcessingDispute(true)
    try {
      const res = await fetch('/api/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          status: 'resolved',
          resolution: disputeResolution || resolution,
          penaltyAmount: disputePenalty,
          refundApproved,
          adminNotes: disputeAdminNotes,
        }),
      })
      
      if (res.ok) {
        setSelectedDispute(null)
        setDisputeResolution('')
        setDisputePenalty(0)
        setDisputeAdminNotes('')
        await fetchDisputes()
      }
    } catch (error) {
      console.error('Error resolving dispute:', error)
    } finally {
      setProcessingDispute(false)
    }
  }

  const fetchErrors = async () => {
    try {
      const params = new URLSearchParams()
      if (errorFilter === 'resolved') params.append('resolved', 'true')
      else if (errorFilter === 'unresolved') params.append('resolved', 'false')
      if (errorTypeFilter !== 'all') params.append('type', errorTypeFilter)
      params.append('limit', '50')
      
      const res = await fetch(`/api/errors?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setErrorLogs(data.errors || [])
        setErrorStats(data.stats || [])
        setErrorTotal(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching errors:', error)
    }
  }

  const handleResolveError = async (errorId: string, resolved: boolean) => {
    try {
      const res = await fetch('/api/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: errorId, resolved })
      })
      if (res.ok) {
        fetchErrors()
      }
    } catch (error) {
      console.error('Error resolving error:', error)
    }
  }

  const handleClearErrors = async (mode: 'resolved' | 'old' | 'all') => {
    const messages = {
      resolved: 'Tüm çözülmüş hataları silmek istediğinize emin misiniz?',
      old: '7 günden eski TÜM hataları silmek istediğinize emin misiniz?',
      all: '⚠️ TÜM hataları silmek istediğinize emin misiniz? Bu işlem geri alınamaz!'
    }
    
    if (!confirm(messages[mode])) return
    setShowClearMenu(false)
    
    try {
      let url = '/api/errors?'
      if (mode === 'resolved') {
        url += 'onlyResolved=true&olderThan=0'
      } else if (mode === 'old') {
        url += 'olderThan=7'
      } else {
        url += 'olderThan=0'
      }
      
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        alert(`✅ ${data.deleted} hata kaydı silindi`)
        fetchErrors()
      } else {
        const data = await res.json()
        alert(`❌ Hata: ${data.error}`)
      }
    } catch (error) {
      console.error('Error clearing errors:', error)
      alert('Hata temizlenirken bir sorun oluştu')
    }
  }

  const refreshDemandAnalysis = async () => {
    setRefreshingDemand(true)
    try {
      const res = await fetch('/api/admin/demand-analysis', {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        setDemandAnalysis(data.analysis)
      }
    } catch (error) {
      console.error('Refresh error:', error)
    } finally {
      setRefreshingDemand(false)
    }
  }

  // Admin mesaj silme (eski - artık kullanılmıyor ama uyumluluk için kalıyor)
  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId)
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })
      
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId))
        setConversationMessages(prev => prev.filter(m => m.id !== messageId))
        setDeleteMessageConfirm(null)
      } else {
        const data = await res.json()
        alert(data.error || 'Mesaj silinemedi')
      }
    } catch (error) {
      console.error('Delete message error:', error)
      alert('Mesaj silinirken bir hata oluştu')
    } finally {
      setDeletingMessageId(null)
    }
  }

  // Konuşma listesini getir
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/admin/messages?type=conversations')
      if (res.ok) {
        const data = await res.json()
        const convArray = Array.isArray(data) ? data : []
        setConversations(convArray)
        setFilteredConversations(convArray)
      } else {
        console.error('Conversations fetch failed:', res.status)
        setConversations([])
        setFilteredConversations([])
      }
    } catch (error) {
      console.error('Fetch conversations error:', error)
      setConversations([])
      setFilteredConversations([])
    }
  }

  // Konuşma detayını getir
  const fetchConversationDetail = async (conv: any) => {
    setSelectedConversation(conv)
    setLoadingConversation(true)
    
    const user1 = conv.participants[0]?.id
    const user2 = conv.participants[1]?.id
    const productId = conv.product?.id || 'null'
    
    try {
      const res = await fetch(
        `/api/admin/messages?type=conversation-detail&user1=${user1}&user2=${user2}&productId=${productId}`
      )
      if (res.ok) {
        const data = await res.json()
        setConversationMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Fetch conversation detail error:', error)
    }
    setLoadingConversation(false)
  }

  // Tek mesaj sil
  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return
    
    setDeletingMessageId(messageId)
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })
      if (res.ok) {
        setConversationMessages(prev => prev.filter(m => m.id !== messageId))
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
    setDeletingMessageId(null)
  }

  // Tüm konuşmayı sil
  const handleDeleteConversation = async (conv: any) => {
    const msgCount = conv.messages?.length || 0
    if (!confirm(`Bu konuşmadaki ${msgCount} mesajı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return
    
    const user1 = conv.participants[0]?.id
    const user2 = conv.participants[1]?.id
    const productId = conv.product?.id
    const conversationKey = productId 
      ? `${productId}-${[user1, user2].sort().join('-')}`
      : `no-product-${[user1, user2].sort().join('-')}`
    
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationKey })
      })
      if (res.ok) {
        fetchConversations()
        setSelectedConversation(null)
        setConversationMessages([])
      }
    } catch (error) {
      console.error('Delete conversation error:', error)
    }
  }

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: newStatus }),
      })
      if (res.ok) {
        setSwapRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
        )
      }
    } catch (error) {
      console.error('Update error:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ═══ Kullanıcı Analitik Fetch ═══
  const fetchUserAnalytics = async (period: string) => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/admin/user-analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setUserAnalytics(data)
      }
    } catch (e) {
      console.error('Analytics fetch error:', e)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Tab değiştiğinde otomatik fetch
  useEffect(() => {
    if (activeTab === 'users' && pageReady) {
      fetchUserAnalytics(analyticsPeriod)
    }
  }, [activeTab, pageReady])

  // ═══ Broadcast Push Notification ═══
  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return
    setBroadcastSending(true)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broadcast: true,
          type: 'SYSTEM',
          segment: broadcastSegment,
          data: {
            title: broadcastTitle,
            body: broadcastBody,
            icon: '/icons/icon-192x192.png',
            url: broadcastUrl,
          }
        })
      })
      if (res.ok) {
        const data = await res.json()
        setBroadcastResult({ sent: data.sent || data.totalSent || 1, failed: data.totalFailed || 0 })
      } else {
        setBroadcastResult({ sent: 0, failed: -1 })
      }
    } catch (e) {
      setBroadcastResult({ sent: 0, failed: -1 })
    } finally {
      setBroadcastSending(false)
    }
  }

  const filteredRequests = swapRequests.filter((r) => {
    if (filter === 'all') return true
    return r.status === filter
  })

  // Hata durumu - en önce kontrol et
  if (pageError) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl mb-4">🚫</div>
        <p className="text-red-500 text-lg text-center">{pageError}</p>
        <button 
          onClick={() => { setPageError(null); window.location.reload(); }}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition"
        >
          Tekrar Dene
        </button>
        <Link href="/" className="text-purple-600 hover:underline mt-2">Ana Sayfaya Dön</Link>
      </div>
    )
  }

  // Admin kontrolü tamamlanmadıysa spinner göster
  if (!pageReady) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Admin kontrolü yapılıyor...</p>
        </div>
      </div>
    )
  }

  // Veri yüklenirken hata varsa göster
  if (error) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-red-500 text-lg text-center">{error}</p>
        <button 
          onClick={() => { setError(null); fetchData(); }}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition"
        >
          Tekrar Dene
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-frozen-500 mx-auto mb-4" />
          <p className="text-gray-600">Veriler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-20 pb-12">
      {/* Admin Şifre Uyarısı */}
      {showPasswordWarning && session?.user?.email === 'join@takas-a.com' && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white p-3 text-center">
          <p className="text-sm font-bold">
            ⚠️ Admin şifreniz zayıf olabilir! Güvenliğiniz için lütfen değiştirin.
          </p>
          <div className="flex justify-center gap-3 mt-2">
            <button 
              onClick={() => router.push('/profil?tab=settings')}
              className="px-4 py-1 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors"
            >
              Şifreyi Değiştir
            </button>
            <button 
              onClick={() => setShowPasswordWarning(false)}
              className="px-4 py-1 bg-red-700 rounded-lg text-sm hover:bg-red-800 transition-colors"
            >
              Sonra
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Yedekleme Hatırlatıcısı */}
        {(!lastBackupDate || (Date.now() - new Date(lastBackupDate).getTime()) > 7 * 24 * 60 * 60 * 1000) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">
                {lastBackupDate ? 'Son yedekleme 7 günden eski!' : 'Henüz yedek alınmadı!'}
              </p>
              <p className="text-xs text-red-500">
                Veri kaybını önlemek için hemen yedek alın.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('backup')}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
            >
              Yedek Al
            </button>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Ana Sayfa</span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600">Tüm ürün ilgi bildirimleri ve mesajlar</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Yenile</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{swapRequests.length}</p>
                <p className="text-sm text-gray-400">Toplam İlgi</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {swapRequests.filter((r) => r.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-400">Bekleyen</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {swapRequests.filter((r) => r.status === 'accepted').length}
                </p>
                <p className="text-sm text-gray-400">Kabul Edilen</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{messages.length}</p>
                <p className="text-sm text-gray-400">Mesaj</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Grid Menü */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
          {[
            { id: 'interests', icon: '❤️', label: 'İlgi Bildirimleri', color: 'from-pink-500 to-rose-500', badge: null },
            { id: 'messages', icon: '💬', label: 'Mesajlar', color: 'from-blue-500 to-cyan-500', badge: null },
            { id: 'demand', icon: '📊', label: 'Talep Analizi', color: 'from-emerald-500 to-green-500', badge: null },
            { id: 'valor', icon: '💰', label: 'Sistem Valor', color: 'from-yellow-500 to-amber-500', badge: null },
            { id: 'errors', icon: '🐛', label: 'Hata İzleme', color: 'from-red-500 to-orange-500', badge: errorTotal > 0 ? errorTotal : null },
            { id: 'disputes', icon: '⚖️', label: 'Anlaşmazlıklar', color: 'from-amber-500 to-yellow-500', badge: disputes.filter(d => d.status !== 'resolved' && d.status !== 'rejected').length > 0 ? disputes.filter(d => d.status !== 'resolved' && d.status !== 'rejected').length : null },
            { id: 'security', icon: '🔒', label: 'Güvenlik', color: 'from-indigo-500 to-purple-500', badge: securityStats && securityStats.last24h > 10 ? securityStats.last24h : null },
            { id: 'inflation', icon: '📈', label: 'Enflasyon', color: 'from-purple-500 to-pink-500', badge: inflationData?.metrics?.healthStatus === 'critical' ? '!' : null },
            { id: 'users', icon: '👥', label: 'Kullanıcı Analitik', color: 'from-blue-500 to-indigo-500', badge: null },
            { id: 'test', icon: '🧪', label: 'Test & Doğrulama', color: 'from-lime-500 to-green-500', badge: null },
            { id: 'config', icon: '⚙️', label: 'Ayarlar', color: 'from-gray-500 to-slate-500', badge: null },
            { id: 'newsletter', icon: '📨', label: 'Newsletter', color: 'from-pink-500 to-fuchsia-500', badge: null },
            { id: 'backup', icon: '💾', label: 'Yedekleme', color: 'from-teal-500 to-emerald-500', badge: null },
            { id: 'ses-testi', icon: '🔊', label: 'Ses Testi', color: 'from-violet-500 to-purple-500', badge: null },
            { id: 'bildirimler', icon: '🔔', label: 'Bildirimler', color: 'from-orange-500 to-red-500', badge: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                activeTab === tab.id
                  ? `bg-gradient-to-br ${tab.color} text-white shadow-lg scale-[1.02]`
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border dark:border-gray-700'
              }`}
            >
              <span className="text-2xl mb-1">{tab.icon}</span>
              <span className="text-[11px] font-bold leading-tight text-center">
                {tab.label}
              </span>
              {/* Badge */}
              {tab.badge !== null && (
                <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full ${
                  activeTab === tab.id ? 'bg-white text-red-500' : 'bg-red-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
              {/* Aktif gösterge */}
              {activeTab === tab.id && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-white/60 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'interests' && (
          <div>
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-frozen-500 focus:border-transparent"
              >
                <option value="all">Tümü</option>
                <option value="pending">Bekleyen</option>
                <option value="accepted">Kabul Edilen</option>
                <option value="rejected">Reddedilen</option>
              </select>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400">Henüz ilgi bildirimi yok</p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Product Image */}
                      <div className="relative w-full md:w-32 h-32 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        {request.product.images[0] ? (
                          <Image
                            src={request.product.images[0]}
                            alt={request.product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link
                              href={`/urun/${request.product.id}`}
                              className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            >
                              {request.product.title}
                            </Link>
                            <p className="text-sm text-gray-400">
                              {request.product.valorPrice} Valor • {request.product.category.name}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              request.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : request.status === 'accepted'
                                ? 'bg-green-100 text-green-700'
                                : request.status === 'awaiting_delivery'
                                ? 'bg-blue-100 text-blue-700'
                                : request.status === 'delivered'
                                ? 'bg-indigo-100 text-indigo-700'
                                : request.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : request.status === 'disputed'
                                ? 'bg-orange-100 text-orange-700'
                                : request.status === 'refunded'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {request.status === 'pending'
                              ? 'Bekliyor'
                              : request.status === 'accepted'
                              ? 'Kabul Edildi'
                              : request.status === 'awaiting_delivery'
                              ? 'Teslimat Bekliyor'
                              : request.status === 'delivered'
                              ? 'Teslim Edildi'
                              : request.status === 'completed'
                              ? 'Tamamlandı'
                              : request.status === 'disputed'
                              ? 'Sorun Bildirildi'
                              : request.status === 'refunded'
                              ? 'İade Edildi'
                              : 'Reddedildi'}
                          </span>
                        </div>

                        {/* Requester Info */}
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-gray-300" />
                            <span className="font-medium text-gray-700">
                              {request.requester.name || 'Anonim'}
                            </span>
                            <a
                              href={`mailto:${request.requester.email}`}
                              className="text-purple-600 hover:underline"
                            >
                              {request.requester.email}
                            </a>
                          </div>
                          {request.message && (
                            <p className="mt-2 text-sm text-gray-600 italic">
                              "{request.message}"
                            </p>
                          )}
                        </div>

                        {/* Actions & Date */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(request.createdAt)}</span>
                          </div>

                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateRequestStatus(request.id, 'accepted')}
                                className="flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Kabul Et</span>
                              </button>
                              <button
                                onClick={() => updateRequestStatus(request.id, 'rejected')}
                                className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Reddet</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="flex gap-4 h-[70vh]">
            {/* SOL PANEL — Konuşma Listesi */}
            <div className="w-1/3 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col bg-white dark:bg-gray-800">
              {/* Arama */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <input
                  type="text"
                  placeholder="Kullanıcı adı veya email ile ara..."
                  value={searchUserQuery}
                  onChange={(e) => {
                    setSearchUserQuery(e.target.value)
                    const q = e.target.value.toLowerCase()
                    setFilteredConversations(
                      conversations.filter((c: any) => 
                        c.participants?.some((p: any) => 
                          p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
                        )
                      )
                    )
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-medium">
                  Toplam {filteredConversations.length} konuşma
                </p>
              </div>
              
              {/* Konuşma listesi */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-600 dark:text-gray-300">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-70" />
                    <p className="font-medium">Konuşma bulunamadı</p>
                  </div>
                ) : (
                  filteredConversations.map((conv: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => fetchConversationDetail(conv)}
                      className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${
                        selectedConversation === conv ? 'bg-blue-100 dark:bg-blue-900/50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {conv.participants?.[0]?.name || 'Anonim'} ↔ {conv.participants?.[1]?.name || 'Anonim'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                            {conv.product?.title || 'Genel mesajlaşma'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {conv.messages?.length || 0} mesaj • {new Date(conv.lastMessage).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv) }}
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          title="Tüm konuşmayı sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* SAĞ PANEL — Mesaj Detayı */}
            <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col bg-white dark:bg-gray-800">
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center text-gray-600 dark:text-gray-300">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-2 opacity-70" />
                    <p className="font-medium">Bir konuşma seçin</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Konuşma başlığı */}
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {selectedConversation.participants?.[0]?.name || selectedConversation.participants?.[0]?.email} ↔ {selectedConversation.participants?.[1]?.name || selectedConversation.participants?.[1]?.email}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                        {selectedConversation.product?.title || 'Genel'} • {conversationMessages.length} mesaj
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteConversation(selectedConversation)}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/70 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Tümünü Sil
                      </button>
                      <button
                        onClick={() => { setSelectedConversation(null); setConversationMessages([]) }}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium"
                      >
                        ✕ Kapat
                      </button>
                    </div>
                  </div>
                  
                  {/* Mesaj listesi */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                    {loadingConversation ? (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-300">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Yükleniyor...
                      </div>
                    ) : conversationMessages.length === 0 ? (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-300 font-medium">Mesaj bulunamadı</div>
                    ) : (
                      conversationMessages.map((msg: any) => (
                        <div key={msg.id} className="group relative">
                          <div className={`flex items-start gap-2 ${
                            msg.senderId === selectedConversation.participants?.[0]?.id 
                              ? '' : 'flex-row-reverse'
                          }`}>
                            <div className={`max-w-[75%] rounded-xl p-3 ${
                              msg.senderId === selectedConversation.participants?.[0]?.id
                                ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100' 
                                : 'bg-blue-500 text-white'
                            }`}>
                              <p className="text-xs font-semibold mb-1 opacity-80">
                                {msg.sender?.name || msg.sender?.email}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <div className="flex items-center justify-between mt-1 gap-2">
                                <p className="text-[10px] opacity-60">
                                  {new Date(msg.createdAt).toLocaleString('tr-TR')}
                                </p>
                                {msg.isModerated && (
                                  <span className="text-[10px] bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-1 rounded font-medium">
                                    Moderasyonlu
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Silme butonu — hover'da görünür */}
                            <button
                              onClick={() => handleDeleteSingleMessage(msg.id)}
                              disabled={deletingMessageId === msg.id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg mt-2"
                              title="Bu mesajı sil"
                            >
                              {deletingMessageId === msg.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Alt bilgi */}
                  <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      ⚠️ Admin görünümü — Mesajlar sadece kötüye kullanım tespiti için incelenir
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Demand Analysis Tab */}
        {activeTab === 'demand' && (
          <div className="space-y-6">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Kategori Talep Analizi</h3>
                {demandAnalysis && (
                  <p className="text-sm text-gray-400">
                    Son güncelleme: {new Date(demandAnalysis.analyzedAt).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>
              <button
                onClick={refreshDemandAnalysis}
                disabled={refreshingDemand}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingDemand ? 'animate-spin' : ''}`} />
                {refreshingDemand ? 'Güncelleniyor...' : 'Yenile'}
              </button>
            </div>

            {/* Global Stats */}
            {demandAnalysis && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                  <p className="text-sm text-blue-600 font-medium">Toplam Görüntülenme</p>
                  <p className="text-2xl font-bold text-blue-700">{demandAnalysis.globalStats.totalViews.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
                  <p className="text-sm text-green-600 font-medium">Haftalık Takas</p>
                  <p className="text-2xl font-bold text-green-700">{demandAnalysis.globalStats.totalSwaps}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
                  <p className="text-sm text-purple-600 font-medium">Ort. Talep Skoru</p>
                  <p className="text-2xl font-bold text-purple-700">{demandAnalysis.globalStats.avgDemandScore}/100</p>
                </div>
              </div>
            )}

            {/* Category List */}
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : demandAnalysis?.categories.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-400">Henüz analiz verisi yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {demandAnalysis?.categories.map((cat) => (
                  <motion.div
                    key={cat.categoryId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Trend Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          cat.trend === 'rising' ? 'bg-green-100' :
                          cat.trend === 'falling' ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          {cat.trend === 'rising' ? (
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          ) : cat.trend === 'falling' ? (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          ) : (
                            <Minus className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-900">{cat.categoryName}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <span>{cat.totalProducts} ürün</span>
                            <span>{cat.totalViews.toLocaleString()} görüntülenme</span>
                            <span>{cat.completedSwaps} takas</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Demand Score */}
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${
                            cat.demandScore >= 70 ? 'text-green-600' :
                            cat.demandScore >= 40 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {cat.demandScore}
                          </div>
                          <p className="text-xs text-gray-400">Talep Skoru</p>
                        </div>

                        {/* Price Multiplier */}
                        <div className="text-center bg-gradient-to-br from-purple-50 to-purple-100 px-4 py-2 rounded-xl">
                          <div className={`text-xl font-bold ${
                            cat.priceMultiplier > 1 ? 'text-green-600' :
                            cat.priceMultiplier < 1 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {cat.priceMultiplier > 1 ? '+' : ''}{Math.round((cat.priceMultiplier - 1) * 100)}%
                          </div>
                          <p className="text-xs text-purple-600">Fiyat Çarpanı</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar for demand score */}
                    <div className="mt-3">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            cat.demandScore >= 70 ? 'bg-green-500' :
                            cat.demandScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${cat.demandScore}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 mb-2">Fiyat Çarpanı Nasıl Çalışır?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Yüksek talep</strong> (+%30'a kadar): Çok görüntülenen, az ürün olan kategoriler</li>
                <li>• <strong>Normal talep</strong> (±%0): Dengeli arz-talep olan kategoriler</li>
                <li>• <strong>Düşük talep</strong> (-%20'ye kadar): Az ilgi gören kategoriler</li>
                <li>• AI fiyat önerisi bu çarpanla otomatik ayarlanır</li>
              </ul>
            </div>
          </div>
        )}

        {/* System Valor Tab */}
        {activeTab === 'valor' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : systemValor ? (
              <>
                {/* Main Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Sistem Havuzu (Toplanan Kesintiler) */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-100 p-6 rounded-2xl border border-amber-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center">
                        <PiggyBank className="w-5 h-5 text-amber-700" />
                      </div>
                      <span className="text-sm font-medium text-amber-700">Sistem Havuzu</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-900">
                      {systemValor.communityPoolValor.toLocaleString('tr-TR')}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Takaslardan kesilen toplam Valor</p>
                  </div>

                  {/* Dolaşımdaki Valor */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-2xl border border-green-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-green-700" />
                      </div>
                      <span className="text-sm font-medium text-green-700">Dolaşımdaki</span>
                    </div>
                    <p className="text-3xl font-bold text-green-900">
                      {systemValor.circulatingValor.toLocaleString('tr-TR')}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Aktif kullanımdaki Valor</p>
                  </div>

                  {/* Dağıtılan Toplam */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-6 rounded-2xl border border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-blue-700" />
                      </div>
                      <span className="text-sm font-medium text-blue-700">Dağıtılan</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-900">
                      {systemValor.distributedValor.toLocaleString('tr-TR')}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Toplam dağıtılmış Valor</p>
                  </div>

                  {/* Toplam Takas */}
                  <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-6 rounded-2xl border border-purple-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-700" />
                      </div>
                      <span className="text-sm font-medium text-purple-700">Tamamlanan</span>
                    </div>
                    <p className="text-3xl font-bold text-purple-900">
                      {systemValor.totalSwapsCompleted}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">Toplam takas sayısı</p>
                  </div>
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-400">Kullanım Oranı</p>
                    <p className="text-2xl font-bold text-gray-900">%{systemValor.utilizationRate}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-400">Ort. Kesinti/Takas</p>
                    <p className="text-2xl font-bold text-gray-900">{systemValor.averageFeePerSwap} V</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-400">Toplam İşlem</p>
                    <p className="text-2xl font-bold text-gray-900">{systemValor.totalTransactions}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-400">Kullanıcı Bakiyeleri</p>
                    <p className="text-2xl font-bold text-gray-900">{systemValor.totalUserValor.toLocaleString('tr-TR')} V</p>
                  </div>
                </div>

                {/* Supply Breakdown */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Valor Arzı Dağılımı</h3>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-green-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(systemValor.circulatingValor / systemValor.totalValorSupply) * 100}%` }}
                      >
                        {((systemValor.circulatingValor / systemValor.totalValorSupply) * 100).toFixed(2)}%
                      </div>
                      <div 
                        className="bg-amber-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(systemValor.communityPoolValor / systemValor.totalValorSupply) * 100}%` }}
                      >
                        {((systemValor.communityPoolValor / systemValor.totalValorSupply) * 100).toFixed(2)}%
                      </div>
                      <div 
                        className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${(systemValor.reserveValor / systemValor.totalValorSupply) * 100}%` }}
                      >
                        Rezerv
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>Dolaşımda: {systemValor.circulatingValor.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span>Sistem Havuzu: {systemValor.communityPoolValor.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span>Rezerv: {systemValor.reserveValor.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span>Dağıtılmamış: {(systemValor.totalValorSupply - systemValor.distributedValor - systemValor.reserveValor).toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Son İşlemler</h3>
                  {systemValor.recentTransactions.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Henüz işlem yok</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {systemValor.recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              tx.type.includes('bonus') ? 'bg-green-100' :
                              tx.type === 'swap_fee' ? 'bg-amber-100' :
                              tx.type === 'swap_complete' ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              {tx.type.includes('bonus') ? (
                                <ArrowUpRight className="w-5 h-5 text-green-600" />
                              ) : tx.type === 'swap_fee' ? (
                                <ArrowDownRight className="w-5 h-5 text-amber-600" />
                              ) : (
                                <Wallet className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {tx.type === 'welcome_bonus' ? 'Hoşgeldin Bonusu' :
                                 tx.type === 'survey_bonus' ? 'Anket Bonusu' :
                                 tx.type === 'referral_bonus' ? 'Davet Bonusu' :
                                 tx.type === 'swap_fee' ? 'Takas Kesintisi' :
                                 tx.type === 'swap_complete' ? 'Takas Tamamlandı' :
                                 tx.type === 'swap_bonus' ? 'Takas Bonusu' :
                                 tx.type === 'multi_swap_bonus' ? 'Çoklu Takas Bonusu' :
                                 tx.type}
                              </p>
                              <p className="text-xs text-gray-400">
                                {tx.toUser ? getDisplayName(tx.toUser) : 'Sistem'}
                                {tx.fromUser ? ` ← ${getDisplayName(tx.fromUser)}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${
                              tx.type === 'swap_fee' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {tx.type === 'swap_fee' ? '-' : '+'}{tx.amount} V
                            </p>
                            <p className="text-xs text-gray-300">
                              {new Date(tx.createdAt).toLocaleDateString('tr-TR', { 
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ═══ TOPLU VALOR YENİDEN DEĞERLEME ═══ */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    🔄 Toplu Valor Yeniden Değerleme (Formül Tabanlı)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Tüm ürünlerin Valor değerlerini yeni endeks formülüne göre yeniden hesaplar.
                    Ülke bazlı fiyatlandırma (TR/EU) otomatik algılanır.
                    Önce &quot;Dry Run&quot; yaparak sonuçları inceleyin.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Mod seçimi */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Mod</label>
                      <select 
                        value={revalueMode} 
                        onChange={(e) => setRevalueMode(e.target.value as 'dry_run' | 'apply')}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="dry_run">🔍 Dry Run (Önizleme)</option>
                        <option value="apply">⚡ Uygula (Kalıcı)</option>
                      </select>
                    </div>
                    
                    {/* Kategori filtresi */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Kategori</label>
                      <select 
                        value={revalueCategory} 
                        onChange={(e) => setRevalueCategory(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">Tüm Kategoriler</option>
                        <option value="elektronik">Elektronik</option>
                        <option value="giyim">Giyim</option>
                        <option value="ev-yasam">Ev & Yaşam</option>
                        <option value="spor-outdoor">Spor & Outdoor</option>
                        <option value="oto-yedek-parca">Oto & Moto</option>
                        <option value="beyaz-esya">Beyaz Eşya</option>
                        <option value="mutfak">Mutfak</option>
                        <option value="taki-aksesuar">Takı & Aksesuar</option>
                        <option value="bebek-cocuk">Bebek & Çocuk</option>
                        <option value="evcil-hayvan">Evcil Hayvan</option>
                        <option value="kitap-hobi">Kitap & Hobi</option>
                        <option value="bahce">Bahçe</option>
                      </select>
                    </div>
                    
                    {/* Limit */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Ürün Limiti</label>
                      <select 
                        value={revalueLimit} 
                        onChange={(e) => setRevalueLimit(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={10}>10 ürün</option>
                        <option value={25}>25 ürün</option>
                        <option value={50}>50 ürün</option>
                        <option value={100}>100 ürün</option>
                        <option value={200}>200 ürün (max)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Başlat butonu */}
                  <button 
                    onClick={async () => {
                      if (revalueMode === 'apply') {
                        if (!confirm('⚠️ DİKKAT: Bu işlem seçili ürünlerin Valor değerlerini KALICI olarak değiştirecek. Devam?')) return
                        if (!confirm('🔴 GERÇEKTEN EMİN MİSİNİZ? Bu işlem geri alınamaz!')) return
                      }
                      setRevaluing(true)
                      setRevalueStatus(null)
                      try {
                        const res = await fetch('/api/admin/revalue', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            mode: revalueMode,
                            categoryFilter: revalueCategory,
                            limit: revalueLimit,
                          })
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setRevalueStatus(data)
                        } else {
                          alert(data.error || 'Hata oluştu')
                        }
                      } catch { alert('Bağlantı hatası') }
                      setRevaluing(false)
                    }}
                    disabled={revaluing}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                      revalueMode === 'apply' 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    } disabled:opacity-50`}
                  >
                    {revaluing ? '⏳ Hesaplanıyor... (bu birkaç dakika sürebilir)' : 
                      revalueMode === 'apply' ? '⚡ TOPLU GÜNCELLEME BAŞLAT' : '🔍 Dry Run Başlat'}
                  </button>
                  
                  {/* Sonuçlar */}
                  {revalueStatus && (
                    <div className="mt-6 space-y-4">
                      {/* Özet */}
                      <div className={`p-4 rounded-xl border-2 ${
                        revalueStatus.mode === 'apply' ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {revalueStatus.mode === 'apply' ? '✅ Güncellendi' : '🔍 Önizleme'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                          <div>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300">İşlenen</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{revalueStatus.processed}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300">Eski Toplam</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{revalueStatus.totalOldValor?.toLocaleString('tr-TR')} V</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300">Yeni Toplam</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{revalueStatus.totalNewValor?.toLocaleString('tr-TR')} V</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 dark:text-gray-300">Değişim</p>
                            <p className={`text-lg font-bold ${
                              revalueStatus.totalChange?.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>{revalueStatus.totalChange}</p>
                          </div>
                        </div>
                        {revalueStatus.errors > 0 && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-2">⚠️ {revalueStatus.errors} ürün hata aldı</p>
                        )}
                      </div>
                      
                      {/* Detay tablosu */}
                      {revalueStatus.results?.length > 0 && (
                        <div className="overflow-x-auto max-h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left p-2 text-gray-600 dark:text-gray-300">Ürün</th>
                                <th className="text-left p-2 text-gray-600 dark:text-gray-300">Kategori</th>
                                <th className="text-center p-2 text-gray-600 dark:text-gray-300">Ülke</th>
                                <th className="text-right p-2 text-gray-600 dark:text-gray-300">TL Tahmin</th>
                                <th className="text-right p-2 text-gray-600 dark:text-gray-300">Eski V</th>
                                <th className="text-right p-2 text-gray-600 dark:text-gray-300">Yeni V</th>
                                <th className="text-right p-2 text-gray-600 dark:text-gray-300">Değişim</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revalueStatus.results.map((r: any) => (
                                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="p-2 max-w-[180px] truncate text-gray-900 dark:text-white" title={r.title}>{r.title}</td>
                                  <td className="p-2 text-gray-600 dark:text-gray-300">{r.category}</td>
                                  <td className="p-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      r.country === 'TR' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    }`}>{r.country || 'TR'}</span>
                                  </td>
                                  <td className="p-2 text-right text-gray-600 dark:text-gray-300">{r.estimatedTL?.toLocaleString('tr-TR')}₺</td>
                                  <td className="p-2 text-right text-gray-600 dark:text-gray-300">{r.oldValor?.toLocaleString('tr-TR')}</td>
                                  <td className="p-2 text-right font-bold text-purple-700 dark:text-purple-400">{r.newValor?.toLocaleString('tr-TR')}</td>
                                  <td className={`p-2 text-right font-bold ${
                                    r.change?.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                  }`}>{r.error ? '❌ Hata' : r.change}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="font-medium text-amber-800 mb-2">Sistem Valor Nasıl Çalışır?</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• <strong>Sistem Havuzu:</strong> Her takasta %0.5-3 arası progresif kesinti alınır</li>
                    <li>• <strong>Dolaşımdaki:</strong> Kullanıcılara dağıtılmış ve aktif kullanımda olan Valor</li>
                    <li>• <strong>Rezerv:</strong> Gelecekteki etkinlikler ve bonuslar için ayrılmış miktar</li>
                    <li>• Sistem havuzundaki Valor, platform geliştirme ve topluluk ödülleri için kullanılır</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Coins className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400">Sistem Valor verileri yüklenemedi</p>
              </div>
            )}
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <div>
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Bug className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{errorTotal}</p>
                    <p className="text-sm text-gray-400">Toplam Hata</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {errorStats.filter(s => s.resolved === false).reduce((acc, s) => acc + s._count, 0)}
                    </p>
                    <p className="text-sm text-gray-400">Çözülmemiş</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {errorStats.filter(s => s.resolved === true).reduce((acc, s) => acc + s._count, 0)}
                    </p>
                    <p className="text-sm text-gray-400">Çözüldü</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {errorStats.filter(s => s.type === 'client').reduce((acc, s) => acc + s._count, 0)}
                    </p>
                    <p className="text-sm text-gray-400">Client Hatası</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={errorFilter}
                  onChange={(e) => {
                    setErrorFilter(e.target.value as 'all' | 'resolved' | 'unresolved')
                    setTimeout(fetchErrors, 100)
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-red-500"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="unresolved">Çözülmemiş</option>
                  <option value="resolved">Çözüldü</option>
                </select>
              </div>
              <select
                value={errorTypeFilter}
                onChange={(e) => {
                  setErrorTypeFilter(e.target.value)
                  setTimeout(fetchErrors, 100)
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Tüm Tipler</option>
                <option value="client">Client</option>
                <option value="server">Server</option>
                <option value="api">API</option>
              </select>
              <button
                onClick={fetchErrors}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Yenile
              </button>
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowClearMenu(!showClearMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hataları Temizle
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showClearMenu && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 overflow-hidden">
                    <button
                      onClick={() => handleClearErrors('resolved')}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    >
                      ✅ Çözülmüş hataları sil
                    </button>
                    <button
                      onClick={() => handleClearErrors('old')}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                    >
                      📅 7 günden eskilerini sil
                    </button>
                    <hr className="dark:border-gray-700" />
                    <button
                      onClick={() => handleClearErrors('all')}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold"
                    >
                      🗑️ Tüm hataları sil
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error List */}
            {loading ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-spin" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <p className="text-gray-400">Kayıtlı hata bulunamadı</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorLogs.map((error) => (
                  <motion.div
                    key={error.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-xl p-4 border ${
                      error.resolved ? 'border-green-200 bg-green-50/30' : 'border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            error.type === 'client' ? 'bg-purple-100 text-purple-700' :
                            error.type === 'server' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {error.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            error.severity === 'error' ? 'bg-red-100 text-red-700' :
                            error.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {error.severity}
                          </span>
                          {error.resolved && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">
                              ✓ Çözüldü
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 mb-1 break-all line-clamp-2">
                          {error.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(error.createdAt).toLocaleString('tr-TR')}
                          </span>
                          {error.url && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <Eye className="w-4 h-4" />
                              {error.url}
                            </span>
                          )}
                          {error.user && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {error.user.name || error.user.email}
                            </span>
                          )}
                        </div>
                        {error.stack && (
                          <details className="mt-2">
                            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-700">
                              Stack Trace Göster
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-x-auto max-h-40">
                              {error.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {!error.resolved ? (
                          <button
                            onClick={() => handleResolveError(error.id, true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Çözüldü
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResolveError(error.id, false)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Geri Al
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <h4 className="font-medium text-red-800 mb-2">Hata İzleme Sistemi</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• <strong>Client:</strong> Tarayıcıda oluşan JavaScript hataları</li>
                <li>• <strong>Server:</strong> Sunucu tarafında oluşan hatalar</li>
                <li>• <strong>API:</strong> API endpoint hatalarını</li>
                <li>• Çözülmüş hatalar 30 gün sonra otomatik silinebilir</li>
              </ul>
            </div>
          </div>
        )}

        {/* Disputes Panel */}
        {activeTab === 'disputes' && (
          <div>
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={disputeFilter}
                onChange={(e) => setDisputeFilter(e.target.value as any)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">Tüm Anlaşmazlıklar</option>
                <option value="evidence_pending">Kanıt Bekleniyor</option>
                <option value="under_review">İnceleniyor</option>
                <option value="open">Açık</option>
                <option value="resolved">Çözüldü</option>
              </select>
              <button
                onClick={fetchDisputes}
                className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200"
              >
                <RefreshCw className="w-4 h-4" />
                Yenile
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileWarning className="w-5 h-5 text-amber-500" />
                  <span className="text-sm text-gray-400">Toplam</span>
                </div>
                <p className="text-2xl font-bold mt-1">{disputes.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-400">Kanıt Bekleyen</span>
                </div>
                <p className="text-2xl font-bold mt-1">{disputes.filter(d => d.status === 'evidence_pending').length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-gray-400">İnceleniyor</span>
                </div>
                <p className="text-2xl font-bold mt-1">{disputes.filter(d => d.status === 'under_review').length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-400">Çözüldü</span>
                </div>
                <p className="text-2xl font-bold mt-1">{disputes.filter(d => d.status === 'resolved').length}</p>
              </div>
            </div>

            {/* Disputes List */}
            <div className="space-y-4">
              {disputes
                .filter(d => disputeFilter === 'all' || d.status === disputeFilter)
                .map((dispute) => (
                  <motion.div
                    key={dispute.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-2xl p-6 shadow-sm ${
                      dispute.status === 'resolved' ? 'border-l-4 border-green-500' : 
                      dispute.status === 'under_review' ? 'border-l-4 border-amber-500' :
                      'border-l-4 border-red-500'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                          <Scale className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{dispute.swapRequest.product.title}</h3>
                          <p className="text-sm text-gray-400">{DISPUTE_TYPE_LABELS[dispute.type] || dispute.type}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        dispute.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        dispute.status === 'under_review' ? 'bg-amber-100 text-amber-700' :
                        dispute.status === 'evidence_pending' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {DISPUTE_STATUS_LABELS[dispute.status] || dispute.status}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-sm text-gray-700">{dispute.description}</p>
                    </div>

                    {/* GÖREV 47: Detaylı Kullanıcı Bilgileri */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                        <p className="text-xs text-violet-500 mb-2 font-semibold">📢 BİLDİRİCİ (Alıcı)</p>
                        <div className="flex items-center gap-3 mb-2">
                          {dispute.swapRequest.requester.image ? (
                            <Image src={dispute.swapRequest.requester.image} alt="" width={40} height={40} className="rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center text-violet-600 font-bold">
                              {(dispute.swapRequest.requester.name || dispute.swapRequest.requester.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-violet-800">
                              {dispute.swapRequest.requester.nickname || dispute.swapRequest.requester.name || dispute.swapRequest.requester.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-violet-600">{dispute.swapRequest.requester.email}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-400">Güven Puanı</p>
                            <p className={`font-bold ${(dispute.swapRequest.requester.trustScore || 0) >= 70 ? 'text-green-600' : (dispute.swapRequest.requester.trustScore || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {dispute.swapRequest.requester.trustScore || 100}/100
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-400">Takas Sayısı</p>
                            <p className="font-bold text-violet-600">{dispute.reporterSwapCount || 0}</p>
                          </div>
                        </div>
                        {dispute.contactEmail && (
                          <p className="text-xs text-violet-600 mt-2">📧 İletişim: {dispute.contactEmail}</p>
                        )}
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <p className="text-xs text-blue-500 mb-2 font-semibold">🏪 KARŞI TARAF (Satıcı)</p>
                        <div className="flex items-center gap-3 mb-2">
                          {dispute.swapRequest.owner.image ? (
                            <Image src={dispute.swapRequest.owner.image} alt="" width={40} height={40} className="rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 font-bold">
                              {(dispute.swapRequest.owner.name || dispute.swapRequest.owner.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-blue-800">
                              {dispute.swapRequest.owner.nickname || dispute.swapRequest.owner.name || dispute.swapRequest.owner.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-blue-600">{dispute.swapRequest.owner.email}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-400">Güven Puanı</p>
                            <p className={`font-bold ${(dispute.swapRequest.owner.trustScore || 0) >= 70 ? 'text-green-600' : (dispute.swapRequest.owner.trustScore || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {dispute.swapRequest.owner.trustScore || 100}/100
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-400">Takas Sayısı</p>
                            <p className="font-bold text-blue-600">{dispute.ownerSwapCount || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GÖREV 47: Ürün Fotoğrafları Yan Yana */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Teklif Edilen Ürün */}
                      {dispute.swapRequest.offeredProduct && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                          <p className="text-xs text-amber-600 font-semibold mb-2">📦 TEKLİF EDİLEN ÜRÜN</p>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {dispute.swapRequest.offeredProduct.images?.slice(0, 3).map((img, idx) => (
                              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-white">
                                <Image src={img} alt={`Ürün ${idx + 1}`} fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                          <p className="font-medium text-amber-800 text-sm">{dispute.swapRequest.offeredProduct.title}</p>
                          <p className="text-xs text-amber-600">VALOR: {dispute.swapRequest.offeredProduct.valorPrice || 0}</p>
                        </div>
                      )}
                      {/* Talep Edilen Ürün */}
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <p className="text-xs text-green-600 font-semibold mb-2">🎯 TALEP EDİLEN ÜRÜN</p>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {dispute.swapRequest.product.images?.slice(0, 3).map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-white">
                              <Image src={img} alt={`Ürün ${idx + 1}`} fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                        <p className="font-medium text-green-800 text-sm">{dispute.swapRequest.product.title}</p>
                        <p className="text-xs text-green-600">VALOR: {dispute.swapRequest.product.valorPrice || 0}</p>
                      </div>
                    </div>

                    {/* GÖREV 47: Beklenen Çözüm */}
                    {dispute.expectedResolution && (
                      <div className="bg-purple-50 rounded-xl p-3 mb-4 border border-purple-200">
                        <p className="text-xs text-purple-500 mb-1">✅ Beklenen Çözüm</p>
                        <p className="font-medium text-purple-800">
                          {EXPECTED_RESOLUTION_LABELS[dispute.expectedResolution] || dispute.expectedResolution}
                        </p>
                      </div>
                    )}

                    {/* Evidence Section */}
                    <div className="border-t pt-4 mb-4">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Kanıtlar
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Reporter Evidence */}
                        <div className="bg-red-50 rounded-xl p-4">
                          <p className="text-sm font-medium text-red-800 mb-2">Şikayetçi Kanıtları</p>
                          {dispute.reporterEvidence && dispute.reporterEvidence.length > 0 ? (
                            <>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {dispute.reporterEvidence.map((url, idx) => (
                                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                                    <Image src={url} alt={`Kanıt ${idx + 1}`} fill className="object-cover" />
                                  </div>
                                ))}
                              </div>
                              {dispute.reporterEvidenceNote && (
                                <p className="text-xs text-red-700 italic">&quot;{dispute.reporterEvidenceNote}&quot;</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-red-600">Henüz kanıt yüklenmedi</p>
                          )}
                        </div>

                        {/* Reported Evidence */}
                        <div className="bg-blue-50 rounded-xl p-4">
                          <p className="text-sm font-medium text-blue-800 mb-2">Satıcı Kanıtları</p>
                          {dispute.reportedEvidence && dispute.reportedEvidence.length > 0 ? (
                            <>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {dispute.reportedEvidence.map((url, idx) => (
                                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                                    <Image src={url} alt={`Kanıt ${idx + 1}`} fill className="object-cover" />
                                  </div>
                                ))}
                              </div>
                              {dispute.reportedEvidenceNote && (
                                <p className="text-xs text-blue-700 italic">&quot;{dispute.reportedEvidenceNote}&quot;</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-blue-600">Henüz kanıt yüklenmedi</p>
                          )}
                        </div>
                      </div>

                      {/* Initial Evidence */}
                      {dispute.evidence && dispute.evidence.length > 0 && (
                        <div className="mt-4 bg-gray-100 rounded-xl p-4">
                          <p className="text-sm font-medium text-gray-800 mb-2">İlk Şikayet Kanıtları</p>
                          <div className="grid grid-cols-6 gap-2">
                            {dispute.evidence.map((url, idx) => (
                              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                                <Image src={url} alt={`İlk kanıt ${idx + 1}`} fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* GÖREV 47: evidencePhotos - Form üzerinden yüklenen kanıt fotoğrafları */}
                      {dispute.evidencePhotos && dispute.evidencePhotos.length > 0 && (
                        <div className="mt-4 bg-rose-50 rounded-xl p-4 border border-rose-200">
                          <p className="text-sm font-medium text-rose-800 mb-2">📸 Form Kanıt Fotoğrafları ({dispute.evidencePhotos.length} adet)</p>
                          <div className="grid grid-cols-4 gap-2">
                            {dispute.evidencePhotos.map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="relative aspect-square rounded-lg overflow-hidden bg-rose-100 hover:ring-2 hover:ring-rose-400 transition-all"
                              >
                                <Image src={url} alt={`Form kanıtı ${idx + 1}`} fill className="object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Settlement Choices */}
                    {(dispute.reporterSettlementChoice || dispute.reportedSettlementChoice) && (
                      <div className="border-t pt-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Gavel className="w-5 h-5" />
                          Uzlaşma Tercihleri
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`rounded-xl p-3 ${dispute.reporterSettlementChoice ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <p className="text-xs text-gray-400 mb-1">Şikayetçi Tercihi</p>
                            <p className="font-medium">
                              {dispute.reporterSettlementChoice 
                                ? SETTLEMENT_OPTIONS.find(o => o.id === dispute.reporterSettlementChoice)?.title || dispute.reporterSettlementChoice
                                : 'Henüz seçim yapılmadı'}
                            </p>
                          </div>
                          <div className={`rounded-xl p-3 ${dispute.reportedSettlementChoice ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <p className="text-xs text-gray-400 mb-1">Satıcı Tercihi</p>
                            <p className="font-medium">
                              {dispute.reportedSettlementChoice 
                                ? SETTLEMENT_OPTIONS.find(o => o.id === dispute.reportedSettlementChoice)?.title || dispute.reportedSettlementChoice
                                : 'Henüz seçim yapılmadı'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* GÖREV 48: AI Analizi Bölümü */}
                    <div className="border-t pt-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          🤖 AI Analizi
                        </h4>
                        {!dispute.aiAnalysis && dispute.status !== 'resolved' && (
                          <button
                            onClick={async () => {
                              setAiAnalyzing(dispute.id)
                              try {
                                const res = await fetch('/api/admin/disputes/analyze', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ disputeId: dispute.id })
                                })
                                const data = await res.json()
                                if (data.success) {
                                  // Disputes listesini güncelle
                                  setDisputes(prev => prev.map(d => 
                                    d.id === dispute.id 
                                      ? { ...d, aiAnalysis: JSON.stringify(data.analysis) }
                                      : d
                                  ))
                                }
                              } catch (err) {
                                console.error('AI analysis error:', err)
                              }
                              setAiAnalyzing(null)
                            }}
                            disabled={aiAnalyzing === dispute.id}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                          >
                            {aiAnalyzing === dispute.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Analiz ediliyor...
                              </>
                            ) : (
                              <>🤖 AI Analiz Yap</>
                            )}
                          </button>
                        )}
                      </div>

                      {dispute.aiAnalysis ? (
                        (() => {
                          try {
                            const ai = JSON.parse(dispute.aiAnalysis)
                            return (
                              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 rounded-xl p-4">
                                <div className="grid grid-cols-4 gap-3 mb-4">
                                  <div className="bg-white rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 mb-1">Meşruiyet Puanı</p>
                                    <p className={`text-2xl font-bold ${
                                      ai.legitimacyScore >= 7 ? 'text-green-600' : 
                                      ai.legitimacyScore >= 4 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                      {ai.legitimacyScore}/10
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 mb-1">Haklı Taraf</p>
                                    <p className={`text-lg font-bold ${
                                      ai.likelyRightParty === 'reporter' ? 'text-violet-600' : 
                                      ai.likelyRightParty === 'respondent' ? 'text-blue-600' : 'text-gray-600'
                                    }`}>
                                      {ai.likelyRightParty === 'reporter' ? '📢 Bildirici' : 
                                       ai.likelyRightParty === 'respondent' ? '🏪 Karşı Taraf' : '❓ Belirsiz'}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 mb-1">Dolandırıcılık Riski</p>
                                    <p className={`text-lg font-bold ${
                                      ai.fraudRisk === 'high' ? 'text-red-600' : 
                                      ai.fraudRisk === 'medium' ? 'text-amber-600' : 'text-green-600'
                                    }`}>
                                      {ai.fraudRisk === 'high' ? '🔴 Yüksek' : 
                                       ai.fraudRisk === 'medium' ? '🟡 Orta' : '🟢 Düşük'}
                                    </p>
                                  </div>
                                  <div className="bg-white rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Önerilen Çözüm</p>
                                    <p className="text-xs font-medium text-violet-700 line-clamp-3">
                                      {ai.suggestedResolution}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="bg-white rounded-lg p-3 mb-3">
                                  <p className="text-xs text-gray-400 mb-1 font-semibold">📋 Gerekçe</p>
                                  <p className="text-sm text-gray-700">{ai.reasoning}</p>
                                </div>
                                
                                {ai.recommendations && ai.recommendations.length > 0 && (
                                  <div className="bg-white rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-2 font-semibold">💡 Öneriler</p>
                                    <ul className="space-y-1">
                                      {ai.recommendations.map((rec: string, idx: number) => (
                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                          <span className="text-violet-500">•</span>
                                          {rec}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )
                          } catch {
                            return <p className="text-sm text-gray-400">AI analiz verisi okunamadı</p>
                          }
                        })()
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <p className="text-sm text-gray-400">
                            Henüz AI analizi yapılmadı. &quot;AI Analiz Yap&quot; butonuna tıklayarak analiz başlatabilirsiniz.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Admin Actions */}
                    {dispute.status !== 'resolved' && dispute.status !== 'rejected' && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Admin Kararı</h4>
                        
                        {selectedDispute?.id === dispute.id ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Karar Açıklaması</label>
                              <textarea
                                value={disputeResolution}
                                onChange={(e) => setDisputeResolution(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500"
                                rows={2}
                                placeholder="Kararınızı açıklayın..."
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Trust Puanı Cezası</label>
                                <input
                                  type="number"
                                  value={disputePenalty}
                                  onChange={(e) => setDisputePenalty(parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500"
                                  min="0"
                                  max="50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notu</label>
                                <input
                                  type="text"
                                  value={disputeAdminNotes}
                                  onChange={(e) => setDisputeAdminNotes(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500"
                                  placeholder="İç not..."
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResolveDispute('Alıcı lehine karar', true)}
                                disabled={processingDispute}
                                className="flex-1 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50"
                              >
                                İade Onayla
                              </button>
                              <button
                                onClick={() => handleResolveDispute('Satıcı lehine karar', false)}
                                disabled={processingDispute}
                                className="flex-1 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50"
                              >
                                Talebi Reddet
                              </button>
                              <button
                                onClick={() => setSelectedDispute(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300"
                              >
                                İptal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedDispute(dispute)}
                            className="w-full py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600"
                          >
                            Karar Ver
                          </button>
                        )}
                      </div>
                    )}

                    {/* Resolution Info */}
                    {dispute.resolution && (
                      <div className="border-t pt-4 mt-4 bg-green-50 rounded-xl p-4">
                        <h4 className="font-semibold text-green-800 mb-2">Karar</h4>
                        <p className="text-sm text-green-700">{dispute.resolution}</p>
                        {dispute.adminNotes && (
                          <p className="text-xs text-green-600 mt-2 italic">Admin notu: {dispute.adminNotes}</p>
                        )}
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      {new Date(dispute.createdAt).toLocaleString('tr-TR')}
                      {dispute.evidenceDeadline && (
                        <span className="ml-2 text-amber-600">
                          Kanıt süresi: {new Date(dispute.evidenceDeadline).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}

              {disputes.filter(d => disputeFilter === 'all' || d.status === disputeFilter).length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
                  <Scale className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400">Anlaşmazlık bulunamadı</p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-medium text-amber-800 mb-2">Anlaşmazlık Yönetimi</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• <strong>Kanıt Bekleniyor:</strong> Her iki taraf 48 saat içinde kanıt yükleyebilir</li>
                <li>• <strong>Uzlaşma:</strong> Taraflar aynı çözümü seçerse otomatik uzlaşma sağlanır</li>
                <li>• <strong>İnceleme:</strong> Uzlaşma sağlanamazsa admin incelemesi yapılır</li>
                <li>• Trust puanı cezası en fazla 50 puan olabilir</li>
              </ul>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-6 h-6 text-slate-300" />
                  <span className="text-slate-300 text-sm">Toplam Log</span>
                </div>
                <p className="text-3xl font-bold">{securityStats?.total || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-6 h-6 text-blue-200" />
                  <span className="text-blue-200 text-sm">Son 24 Saat</span>
                </div>
                <p className="text-3xl font-bold">{securityStats?.last24h || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-6 h-6 text-purple-200" />
                  <span className="text-purple-200 text-sm">Son 7 Gün</span>
                </div>
                <p className="text-3xl font-bold">{securityStats?.last7d || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-6 h-6 text-red-200" />
                  <span className="text-red-200 text-sm">Yüksek Önem</span>
                </div>
                <p className="text-3xl font-bold">
                  {securityStats?.bySeverity?.find(s => s.severity === 'high')?._count || 0}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={securityFilter.eventType}
                  onChange={(e) => setSecurityFilter(prev => ({ ...prev, eventType: e.target.value }))}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Tüm Olaylar</option>
                  <option value="login_failed">Başarısız Giriş</option>
                  <option value="login_success">Başarılı Giriş</option>
                  <option value="brute_force_detected">Brute Force</option>
                  <option value="rate_limit_exceeded">Rate Limit</option>
                  <option value="captcha_failed">CAPTCHA Hatası</option>
                  <option value="suspicious_request">Şüpheli İstek</option>
                </select>
              </div>
              <select
                value={securityFilter.severity}
                onChange={(e) => setSecurityFilter(prev => ({ ...prev, severity: e.target.value }))}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Tüm Önem Dereceleri</option>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
              <button
                onClick={() => fetchData()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Yenile
              </button>
              <button
                onClick={async () => {
                  if (confirm('30 günden eski düşük/orta önemli logları silmek istediğinize emin misiniz?')) {
                    const res = await fetch('/api/admin/security?days=30', { method: 'DELETE' })
                    if (res.ok) {
                      const data = await res.json()
                      alert(`${data.deleted} log silindi`)
                      fetchData()
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Eski Logları Temizle
              </button>
            </div>

            {/* Event Type Distribution */}
            {securityStats?.byType && securityStats.byType.length > 0 && (
              <div className="bg-white rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Olay Türü Dağılımı (Son 7 Gün)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {securityStats.byType.map((item) => (
                    <div key={item.eventType} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{item._count}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.eventType === 'login_failed' ? 'Başarısız Giriş' :
                         item.eventType === 'login_success' ? 'Başarılı Giriş' :
                         item.eventType === 'brute_force_detected' ? 'Brute Force' :
                         item.eventType === 'rate_limit_exceeded' ? 'Rate Limit' :
                         item.eventType === 'captcha_failed' ? 'CAPTCHA Hatası' :
                         item.eventType === 'suspicious_request' ? 'Şüpheli İstek' :
                         item.eventType}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Suspicious IPs */}
            {securityStats?.topIPs && securityStats.topIPs.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                  <Fingerprint className="w-5 h-5" />
                  Şüpheli IP Adresleri (Son 24 Saat)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {securityStats.topIPs.slice(0, 10).map((item: { ip: string; count: number }, idx: number) => (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-red-100">
                      <p className="font-mono text-sm text-gray-700 truncate">{item.ip}</p>
                      <p className="text-red-600 font-bold">{item.count} deneme</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs List */}
            <div className="space-y-3">
              {securityLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-xl p-4 border-l-4 ${
                    log.severity === 'critical' ? 'border-l-red-600 bg-red-50' :
                    log.severity === 'high' ? 'border-l-orange-500 bg-orange-50' :
                    log.severity === 'medium' ? 'border-l-yellow-500' :
                    'border-l-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {log.eventType === 'login_failed' && <Lock className="w-4 h-4 text-red-500" />}
                        {log.eventType === 'login_success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {log.eventType === 'brute_force_detected' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        {log.eventType === 'suspicious_request' && <Eye className="w-4 h-4 text-orange-500" />}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          log.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                          log.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.severity === 'critical' ? 'Kritik' :
                           log.severity === 'high' ? 'Yüksek' :
                           log.severity === 'medium' ? 'Orta' : 'Düşük'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
                          {log.eventType === 'login_failed' ? 'Başarısız Giriş' :
                           log.eventType === 'login_success' ? 'Başarılı Giriş' :
                           log.eventType === 'brute_force_detected' ? 'Brute Force Tespit' :
                           log.eventType === 'rate_limit_exceeded' ? 'Rate Limit Aşımı' :
                           log.eventType === 'captcha_failed' ? 'CAPTCHA Hatası' :
                           log.eventType === 'suspicious_request' ? 'Şüpheli İstek' :
                           log.eventType}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span className="font-mono">{log.ip}</span>
                        </span>
                        {log.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {log.email}
                          </span>
                        )}
                        {log.user && (
                          <span className="text-blue-600">
                            Kullanıcı: {log.user.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      {log.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-700">
                            Detayları göster
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.userAgent && (
                        <p className="mt-1 text-xs text-gray-300 truncate max-w-xl" title={log.userAgent}>
                          {log.userAgent}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {securityLogs.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
                  <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400">Güvenlik logu bulunamadı</p>
                </div>
              )}
            </div>

            {/* Şüpheli Aktiviteler */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Şüpheli Aktiviteler (Son 7 Gün)
              </h3>
              
              {suspiciousActivities.length > 0 ? (
                <div className="space-y-3">
                  {suspiciousActivities.map((activity) => (
                    <div key={activity.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              activity.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              activity.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                              activity.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {activity.severity.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {activity.type === 'valor_manipulation' && '💰 Valor Manipülasyonu'}
                              {activity.type === 'multiple_accounts' && '👥 Çoklu Hesap'}
                              {activity.type === 'spam_swaps' && '🔄 Spam Takas'}
                              {activity.type === 'spam_messages' && '💬 Spam Mesaj'}
                              {activity.type === 'rapid_product_creation' && '📦 Hızlı Ürün Ekleme'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{activity.message}</p>
                          {activity.user && (
                            <p className="text-xs text-gray-400 mt-1">
                              Kullanıcı: {activity.user.name || activity.user.email}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-300">
                          {new Date(activity.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Shield className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">Şüpheli aktivite tespit edilmedi</p>
                  <p className="text-green-600 text-sm">Sistem güvenle çalışıyor</p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-slate-100 border border-slate-200 rounded-xl p-4">
              <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Güvenlik Özellikleri
              </h4>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• <strong>Brute-Force Koruması:</strong> 5 başarısız denemeden sonra 30 dakika kilitleme</li>
                <li>• <strong>Rate Limiting:</strong> API isteklerine dakika bazlı sınırlama</li>
                <li>• <strong>Security Headers:</strong> HSTS, CSP, XSS koruması aktif</li>
                <li>• <strong>reCAPTCHA:</strong> 3+ başarısız denemede otomatik aktif</li>
                <li>• <strong>Şüpheli IP Tespiti:</strong> Bot/crawler/selenium user agent kontrolü</li>
                <li>• <strong>Fraud Detection:</strong> Spam takas, Valor manipülasyonu, çoklu hesap tespiti</li>
              </ul>
            </div>
          </div>
        )}

        {/* Enflasyon İzleme Tab */}
        {activeTab === 'inflation' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-4" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : inflationData ? (
              <>
                {/* Health Status Banner */}
                <div className={`p-4 rounded-2xl border ${
                  inflationData.metrics.healthStatus === 'critical' 
                    ? 'bg-red-50 border-red-200' 
                    : inflationData.metrics.healthStatus === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      inflationData.metrics.healthStatus === 'critical' 
                        ? 'bg-red-200' 
                        : inflationData.metrics.healthStatus === 'warning'
                        ? 'bg-amber-200'
                        : 'bg-green-200'
                    }`}>
                      <Gauge className={`w-6 h-6 ${
                        inflationData.metrics.healthStatus === 'critical' 
                          ? 'text-red-700' 
                          : inflationData.metrics.healthStatus === 'warning'
                          ? 'text-amber-700'
                          : 'text-green-700'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${
                        inflationData.metrics.healthStatus === 'critical' 
                          ? 'text-red-800' 
                          : inflationData.metrics.healthStatus === 'warning'
                          ? 'text-amber-800'
                          : 'text-green-800'
                      }`}>
                        Sistem Durumu: {
                          inflationData.metrics.healthStatus === 'critical' ? 'Kritik' :
                          inflationData.metrics.healthStatus === 'warning' ? 'Uyarı' : 'Sağlıklı'
                        }
                      </h3>
                      {inflationData.metrics.recommendation && (
                        <p className="text-sm mt-1">{inflationData.metrics.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inflation Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Haftalık */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-rose-100 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-rose-600" />
                      </div>
                      <span className="font-medium text-gray-700">Haftalık</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {inflationData.metrics.weekly.distributed.toLocaleString('tr-TR')} V
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Toplam arzın %{inflationData.metrics.weekly.percentOfTotal.toFixed(3)}&apos;ı
                    </p>
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${Math.min(inflationData.metrics.weekly.percentOfTotal * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Aylık */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-amber-100 rounded-xl">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="font-medium text-gray-700">Aylık (Tahmini)</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {inflationData.metrics.monthly.estimated.toLocaleString('tr-TR')} V
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Toplam arzın %{inflationData.metrics.monthly.percentOfTotal.toFixed(2)}&apos;ı
                    </p>
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.min(inflationData.metrics.monthly.percentOfTotal * 10, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Yıllık */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-100 rounded-xl">
                        <Zap className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-700">Yıllık (Tahmini)</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {inflationData.metrics.yearly.estimated.toLocaleString('tr-TR')} V
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Toplam arzın %{inflationData.metrics.yearly.percentOfTotal.toFixed(2)}&apos;ı
                    </p>
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          inflationData.metrics.yearly.percentOfTotal > 15 ? 'bg-red-500' :
                          inflationData.metrics.yearly.percentOfTotal > 10 ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(inflationData.metrics.yearly.percentOfTotal * 5, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Exhaustion Timer */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-2xl border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-2">Arz Tükenme Tahmini</h4>
                  <p className="text-4xl font-bold text-purple-900">
                    {inflationData.metrics.yearly.yearsUntilExhaustion === Infinity 
                      ? '∞' 
                      : `${inflationData.metrics.yearly.yearsUntilExhaustion} yıl`}
                  </p>
                  <p className="text-sm text-purple-600 mt-2">
                    Mevcut dağıtım hızıyla kalan Valor&apos;un tükenmesi için tahmini süre
                  </p>
                </div>

                {/* Bonus Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Son 4 Haftada Bonus Dağılımı</h4>
                  <div className="space-y-3">
                    {inflationData.bonusBreakdown.map((bonus) => (
                      <div key={bonus.type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            bonus.type === 'welcome_bonus' ? 'bg-green-500' :
                            bonus.type === 'daily_bonus' ? 'bg-blue-500' :
                            bonus.type === 'swap_bonus' ? 'bg-purple-500' :
                            bonus.type === 'referral_bonus' ? 'bg-amber-500' :
                            bonus.type === 'product_bonus' ? 'bg-cyan-500' :
                            'bg-gray-500'
                          }`} />
                          <span className="font-medium text-gray-700">
                            {bonus.type === 'welcome_bonus' ? 'Hoşgeldin Bonusu' :
                             bonus.type === 'daily_bonus' ? 'Günlük Bonus' :
                             bonus.type === 'swap_bonus' ? 'Takas Bonusu' :
                             bonus.type === 'referral_bonus' ? 'Davet Bonusu' :
                             bonus.type === 'product_bonus' ? 'Ürün Bonusu' :
                             bonus.type === 'review_bonus' ? 'Değerlendirme Bonusu' :
                             bonus.type}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{bonus.totalAmount.toLocaleString('tr-TR')} V</p>
                          <p className="text-xs text-gray-400">{bonus.count} işlem</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <h4 className="font-medium text-rose-800 mb-2">Enflasyon Kontrolü</h4>
                  <ul className="text-sm text-rose-700 space-y-1">
                    <li>• <strong>Hedef:</strong> Yıllık %5-10 enflasyon oranı sağlıklı kabul edilir</li>
                    <li>• <strong>%10-15:</strong> Dikkatli izlenmeli, bonus miktarları gözden geçirilmeli</li>
                    <li>• <strong>%15+:</strong> Kritik seviye, acil müdahale gerekli</li>
                    <li>• Bonus miktarlarını &quot;Ayarlar&quot; sekmesinden değiştirebilirsiniz</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Gauge className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400">Enflasyon verileri yüklenemedi</p>
              </div>
            )}
          </div>
        )}

        {/* Ayarlar/Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 mx-auto mb-4" />
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : configData ? (
              <>
                {/* Bonus Ayarları */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    Bonus Miktarları
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Welcome Bonus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hoşgeldin Bonusu (0-500 V)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={configData.welcomeBonusAmount}
                        onChange={(e) => setConfigData({ ...configData, welcomeBonusAmount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Yeni kayıt olan kullanıcılara verilen Valor</p>
                    </div>

                    {/* Daily Bonus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Günlük Giriş Bonusu (0-50 V)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={configData.dailyBonusBase}
                        onChange={(e) => setConfigData({ ...configData, dailyBonusBase: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Her gün giriş yapan kullanıcılara verilen baz bonus</p>
                    </div>

                    {/* Product Bonus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ürün Ekleme Bonusu (0-100 V)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configData.productBonusAmount}
                        onChange={(e) => setConfigData({ ...configData, productBonusAmount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Ürün ekleyen kullanıcılara verilen Valor</p>
                    </div>

                    {/* Referral Bonus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Davet Bonusu (0-100 V)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configData.referralBonusAmount}
                        onChange={(e) => setConfigData({ ...configData, referralBonusAmount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Arkadaş davet eden kullanıcılara verilen Valor</p>
                    </div>

                    {/* Review Bonus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Değerlendirme Bonusu (0-50 V)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={configData.reviewBonusAmount}
                        onChange={(e) => setConfigData({ ...configData, reviewBonusAmount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Değerlendirme yapan kullanıcılara verilen Valor</p>
                    </div>
                  </div>
                </div>

                {/* Sybil Direnci Ayarları */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-slate-600" />
                    Sybil Direnci Ayarları
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Min Account Age */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Hesap Yaşı (0-30 gün)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={configData.minAccountAgeDays}
                        onChange={(e) => setConfigData({ ...configData, minAccountAgeDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">Bonus almak için gereken minimum hesap yaşı</p>
                    </div>

                    {/* Require Verification */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Doğrulama Zorunluluğu
                      </label>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => setConfigData({ ...configData, requireVerification: true })}
                          className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            configData.requireVerification 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Evet
                        </button>
                        <button
                          onClick={() => setConfigData({ ...configData, requireVerification: false })}
                          className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            !configData.requireVerification 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Hayır
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Evet: Hesap yaşı veya doğrulama gerekli | Hayır: Sadece hesap yaşı kontrol edilir
                      </p>
                    </div>
                  </div>
                </div>

                {/* Kaydet Butonu */}
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      setSavingConfig(true)
                      try {
                        const res = await fetch('/api/admin/config', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(configData)
                        })
                        const data = await res.json()
                        if (res.ok) {
                          alert('Ayarlar başarıyla kaydedildi!')
                          setConfigData(data.config)
                        } else {
                          alert(data.error || 'Kaydetme hatası')
                        }
                      } catch (error) {
                        console.error('Save error:', error)
                        alert('Kaydetme hatası')
                      } finally {
                        setSavingConfig(false)
                      }
                    }}
                    disabled={savingConfig}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {savingConfig ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    <span>{savingConfig ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
                  </button>
                </div>

                {/* Info Box */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                  <h4 className="font-medium text-cyan-800 mb-2">A/B Testi ve Enflasyon Kontrolü</h4>
                  <ul className="text-sm text-cyan-700 space-y-1">
                    <li>• Bonus miktarlarını değiştirmek enflasyon oranını doğrudan etkiler</li>
                    <li>• Değişiklikler yeni işlemlerden itibaren geçerli olur</li>
                    <li>• &quot;Enflasyon&quot; sekmesinden değişikliklerin etkisini izleyebilirsiniz</li>
                    <li>• Sybil direnci: Bonus almak için min. {configData.minAccountAgeDays} gün hesap yaşı veya doğrulama gerekir</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400">Ayarlar yüklenemedi</p>
              </div>
            )}
          </div>
        )}

        {/* Yedekleme Tab */}
        {activeTab === 'backup' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Save className="w-6 h-6 text-emerald-500" />
              Veritabanı Yedekleme
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                { type: 'full', label: 'Tam Yedek', desc: 'Tüm veriler (Kullanıcılar, Ürünler, Takaslar, Mesajlar, Valor)', icon: '📦', color: 'emerald' },
                { type: 'users', label: 'Kullanıcılar', desc: 'Sadece kullanıcı verileri', icon: '👥', color: 'blue' },
                { type: 'products', label: 'Ürünler', desc: 'Sadece ürün verileri', icon: '📦', color: 'purple' },
                { type: 'swaps', label: 'Takaslar', desc: 'Takas talepleri ve geçmişi', icon: '🔄', color: 'orange' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={async () => {
                    try {
                      setBackupLoading(true)
                      const res = await fetch(`/api/admin/backup?type=${item.type}`)
                      if (!res.ok) throw new Error('Yedekleme başarısız')
                      const data = await res.json()
                      
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `takas-a-backup-${item.type}-${new Date().toISOString().split('T')[0]}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                      
                      // Başarılı yedekleme tarihini kaydet
                      const now = new Date().toISOString()
                      localStorage.setItem('takas-a-last-backup', now)
                      setLastBackupDate(now)
                    } catch (error) {
                      console.error('Backup error:', error)
                      alert('Yedekleme hatası oluştu')
                    } finally {
                      setBackupLoading(false)
                    }
                  }}
                  disabled={backupLoading}
                  className={`p-4 rounded-xl border-2 border-${item.color}-200 hover:border-${item.color}-400 bg-${item.color}-50 transition-all text-left disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-bold text-gray-800">{item.label}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                  {backupLoading && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      İndiriliyor...
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Önemli:</strong> Yedekler JSON formatında indirilir. 
                Düzenli yedekleme alarak verilerinizi koruyun. 
                Yedek dosyalarını güvenli bir yerde saklayın.
              </p>
            </div>
          </div>
        )}

        {/* Kullanıcı Analitik Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold dark:text-white">👥 Kullanıcı Analitik</h2>
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => { setAnalyticsPeriod(period); fetchUserAnalytics(period) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      analyticsPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700'
                    }`}
                  >
                    {period === 'today' ? 'Bugün' : period === 'week' ? 'Bu Hafta' : period === 'month' ? 'Bu Ay' : 'Tümü'}
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : userAnalytics ? (
              <>
                {/* Özet Kartları */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 text-center">
                    <p className="text-3xl font-bold text-blue-600">{userAnalytics.summary?.totalUsers || 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Toplam Üye</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 text-center">
                    <p className="text-3xl font-bold text-green-600">{userAnalytics.summary?.newUsers || 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      Yeni Kayıt ({analyticsPeriod === 'today' ? 'bugün' : analyticsPeriod === 'week' ? 'bu hafta' : analyticsPeriod === 'month' ? 'bu ay' : 'toplam'})
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 text-center">
                    <p className="text-3xl font-bold text-purple-600">{userAnalytics.summary?.activeUsers || 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Aktif (son 24s)</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 text-center">
                    <p className="text-3xl font-bold text-orange-600">{userAnalytics.summary?.verifiedUsers || 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Doğrulanmış</p>
                  </div>
                </div>

                {/* Şehir Dağılımı */}
                {userAnalytics.cities && userAnalytics.cities.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 dark:text-white">🏙️ Şehir Dağılımı</h3>
                    <div className="space-y-3">
                      {userAnalytics.cities.map((city: any, i: number) => (
                        <div key={city.name} className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-400 w-6">{i + 1}.</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-28 truncate">{city.name}</span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(8, (city.count / (userAnalytics.cities[0]?.count || 1)) * 100)}%` }}
                            >
                              <span className="text-[10px] font-bold text-white">{city.count}</span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-300 w-10 text-right">%{city.percent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Son Giriş Yapanlar */}
                {userAnalytics.recentLogins && userAnalytics.recentLogins.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 dark:text-white">🔑 Son Giriş Yapanlar</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Kullanıcı</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Email</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Şehir</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Son Giriş</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Güven</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAnalytics.recentLogins.map((user: any) => (
                            <tr key={user.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {user.image ? (
                                    <img src={user.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px]">👤</div>
                                  )}
                                  <span className="font-medium text-gray-900 dark:text-white">{user.name || 'Anonim'}</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300 text-xs">{user.email}</td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{user.city || '—'}</td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300 text-xs">{user.lastLoginAt}</td>
                              <td className="py-2 px-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  user.trustScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : user.trustScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {user.trustScore}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Yeni Kayıtlar */}
                {userAnalytics.newRegistrations && userAnalytics.newRegistrations.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 dark:text-white">🆕 Yeni Kayıtlar</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Kullanıcı</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Email</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Kayıt Tarihi</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Davet Eden</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Doğrulama</th>
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Güven</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAnalytics.newRegistrations.map((user: any) => (
                            <tr key={user.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{user.name || 'Anonim'}</td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300 text-xs">{user.email}</td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300 text-xs">{user.createdAt}</td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-300 text-xs">{user.referredBy || '—'}</td>
                              <td className="py-2 px-3">
                                <div className="flex gap-1">
                                  {user.isPhoneVerified && <span title="Telefon" className="text-xs">📱</span>}
                                  {user.isIdentityVerified && <span title="Kimlik" className="text-xs">🪪</span>}
                                  {!user.isPhoneVerified && !user.isIdentityVerified && <span className="text-xs text-gray-300">—</span>}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  user.trustScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : user.trustScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {user.trustScore}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Günlük Giriş Grafiği */}
                {userAnalytics.dailyLogins && userAnalytics.dailyLogins.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 dark:text-white">📊 Günlük Giriş Akışı (Son 14 Gün)</h3>
                    <div className="flex items-end gap-1 h-32">
                      {userAnalytics.dailyLogins.map((day: any) => (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300">{day.count}</span>
                          <div
                            className="w-full bg-gradient-to-t from-blue-500 to-indigo-400 rounded-t-md min-h-[4px]"
                            style={{ height: `${Math.max(4, (day.count / (userAnalytics.maxDailyLogin || 1)) * 100)}%` }}
                          />
                          <span className="text-[8px] text-gray-300 -rotate-45 origin-top-left mt-1">{day.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-300">
                <div className="text-4xl mb-2">👥</div>
                Veri yüklenemedi. Bir periyot seçin.
              </div>
            )}
          </div>
        )}

        {/* Newsletter Tab */}
        {activeTab === 'newsletter' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold dark:text-white">📨 Newsletter Gönder</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Tüm kullanıcılara toplu e-posta gönder</p>
              </div>
              {newsletterStats && (
                <div className="flex gap-4">
                  <div className="text-center px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{newsletterStats.totalUsers}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Toplam Üye</p>
                  </div>
                  <div className="text-center px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{newsletterStats.eligibleRecipients}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Gönderilebilir</p>
                  </div>
                </div>
              )}
            </div>

            {/* Newsletter Form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="space-y-4">
                {/* Konu */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📌 E-posta Konusu
                  </label>
                  <input
                    type="text"
                    value={newsletterSubject}
                    onChange={(e) => setNewsletterSubject(e.target.value)}
                    placeholder="Örn: VALOR Nedir? Takas-A Nasıl Çalışır?"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>

                {/* İçerik */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    ✍️ E-posta İçeriği (HTML Destekli)
                  </label>
                  <textarea
                    value={newsletterContent}
                    onChange={(e) => setNewsletterContent(e.target.value)}
                    placeholder="<h2>VALOR ile Parasız Takas!</h2>&#10;<p>Merhaba,</p>&#10;<p>Takas-A'da VALOR ile ürünlerinizi kolayca takas edebilirsiniz...</p>&#10;<ul>&#10;  <li>✅ Kayıt olun ve 100 VALOR kazanın</li>&#10;  <li>✅ Ürünlerinizi listeleyin</li>&#10;  <li>✅ İstediğiniz ürünlerle takas yapın</li>&#10;</ul>"
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                    💡 HTML etiketleri kullanabilirsiniz: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a href=&quot;...&quot;&gt;
                  </p>
                </div>

                {/* Önizleme */}
                {newsletterContent && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      👁️ İçerik Önizlemesi
                    </label>
                    <div 
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: newsletterContent }}
                    />
                  </div>
                )}

                {/* Progress */}
                {newsletterProgress && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        {newsletterSending ? '📤 Gönderiliyor...' : '✅ Gönderim Tamamlandı'}
                      </span>
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        {newsletterProgress.sent + newsletterProgress.failed} / {newsletterProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                        style={{ width: `${((newsletterProgress.sent + newsletterProgress.failed) / newsletterProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-green-600 dark:text-green-400">✓ Başarılı: {newsletterProgress.sent}</span>
                      {newsletterProgress.failed > 0 && (
                        <span className="text-red-600 dark:text-red-400">✕ Başarısız: {newsletterProgress.failed}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* sendToAll Checkbox */}
                <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newsletterSendToAll}
                      onChange={(e) => setNewsletterSendToAll(e.target.checked)}
                      className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        Tüm kullanıcılara gönder (doğrulanmamış dahil)
                      </span>
                      {newsletterSendToAll && (
                        <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                          ⚠️ Bu seçenek tüm kullanıcılara (email doğrulanmamış dahil) gönderir.
                          Toplam: {newsletterStats?.totalUsers || '?'} kullanıcı
                        </p>
                      )}
                      {!newsletterSendToAll && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          Varsayılan: Sadece email doğrulanmış kullanıcılara gönderilir ({newsletterStats?.verifiedUsers || '?'} kullanıcı)
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                {/* Butonlar */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={async () => {
                      if (!newsletterSubject || !newsletterContent) {
                        alert('Lütfen konu ve içerik alanlarını doldurun.')
                        return
                      }
                      setNewsletterSending(true)
                      setNewsletterProgress(null)
                      try {
                        const res = await fetch('/api/admin/send-newsletter', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            subject: newsletterSubject,
                            content: newsletterContent,
                            testMode: true,
                            sendToAll: newsletterSendToAll
                          })
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setNewsletterProgress({ sent: data.sent, failed: data.failed, total: data.total })
                          alert(`✅ Test e-postası gönderildi!\n\nGönderilen: ${data.sent}\nBaşarısız: ${data.failed}`)
                        } else {
                          alert(`❌ Hata: ${data.error}`)
                        }
                      } catch (err: any) {
                        alert(`❌ Bağlantı hatası: ${err.message}`)
                      }
                      setNewsletterSending(false)
                    }}
                    disabled={newsletterSending || !newsletterSubject || !newsletterContent}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-colors"
                  >
                    {newsletterSending ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Test Gönder (Sadece Bana)
                      </>
                    )}
                  </button>

                  <button
                    onClick={async () => {
                      if (!newsletterSubject || !newsletterContent) {
                        alert('Lütfen konu ve içerik alanlarını doldurun.')
                        return
                      }
                      const targetCount = newsletterSendToAll 
                        ? newsletterStats?.totalUsers 
                        : newsletterStats?.eligibleRecipients
                      const confirmed = confirm(
                        `⚠️ DİKKAT!\n\nBu işlem ${targetCount || 'tüm'} kullanıcıya e-posta gönderecek.${newsletterSendToAll ? '\n\n🔶 DOĞRULANMAMIŞ KULLANICILAR DAHİL!' : ''}\n\nKonu: ${newsletterSubject}\n\nDevam etmek istediğinize emin misiniz?`
                      )
                      if (!confirmed) return
                      
                      const doubleConfirmed = confirm(
                        `🔴 SON ONAY\n\nBu işlem geri alınamaz. ${targetCount || 'Tüm'} kullanıcıya e-posta gönderilecek.\n\nGÖNDER?`
                      )
                      if (!doubleConfirmed) return

                      setNewsletterSending(true)
                      setNewsletterProgress(null)
                      try {
                        const res = await fetch('/api/admin/send-newsletter', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            subject: newsletterSubject,
                            content: newsletterContent,
                            testMode: false,
                            sendToAll: newsletterSendToAll
                          })
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setNewsletterProgress({ sent: data.sent, failed: data.failed, total: data.total })
                          alert(`✅ Newsletter gönderildi!\n\nToplam: ${data.total}\nBaşarılı: ${data.sent}\nBaşarısız: ${data.failed}`)
                        } else {
                          alert(`❌ Hata: ${data.error}`)
                        }
                      } catch (err: any) {
                        alert(`❌ Bağlantı hatası: ${err.message}`)
                      }
                      setNewsletterSending(false)
                    }}
                    disabled={newsletterSending || !newsletterSubject || !newsletterContent}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-colors"
                  >
                    {newsletterSending ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Users className="w-5 h-5" />
                        Herkese Gönder
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Hazır Şablonlar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-lg mb-4 dark:text-white">📋 Hazır Şablonlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setNewsletterSubject('VALOR Nedir? Takas-A Nasıl Çalışır?')
                    setNewsletterContent(`<h2>🔄 VALOR ile Parasız Takas!</h2>
<p>Merhaba,</p>
<p>Takas-A'da <strong>VALOR</strong> ile ürünlerinizi kolayca takas edebilirsiniz. Para yerine VALOR kullanarak istediğiniz ürünlere ulaşın!</p>
<h3>✨ VALOR Avantajları:</h3>
<ul>
  <li>✅ Kayıt olun ve <strong>100 VALOR</strong> kazanın</li>
  <li>✅ Ürünlerinizi listeleyin, VALOR kazanın</li>
  <li>✅ İstediğiniz ürünlerle takas yapın</li>
  <li>✅ Güvenli ve hızlı işlem</li>
</ul>
<p>Hemen Takas-A'ya gelin, takas yapın! 💜</p>`)
                  }}
                  className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span className="text-lg">💰</span>
                  <span className="font-semibold ml-2 text-gray-900 dark:text-white">VALOR Tanıtım</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">VALOR sistemi ve avantajları</p>
                </button>

                <button
                  onClick={() => {
                    setNewsletterSubject('Yeni Özellikler Takas-A\'da!')
                    setNewsletterContent(`<h2>🎉 Yeni Özellikler Yayında!</h2>
<p>Merhaba,</p>
<p>Takas-A'da yeni özellikler sizi bekliyor:</p>
<ul>
  <li>🆕 <strong>Çoklu Takas:</strong> Birden fazla ürünü aynı anda takas edin</li>
  <li>📍 <strong>Teslimat Noktaları:</strong> Güvenli buluşma noktaları</li>
  <li>⭐ <strong>Değerlendirme Sistemi:</strong> Güvenilir kullanıcıları bulun</li>
  <li>🔔 <strong>Anlık Bildirimler:</strong> Hiçbir fırsatı kaçırmayın</li>
</ul>
<p>Hemen keşfedin! 🚀</p>`)
                  }}
                  className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span className="text-lg">🆕</span>
                  <span className="font-semibold ml-2 text-gray-900 dark:text-white">Yeni Özellikler</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Platform güncellemeleri</p>
                </button>

                <button
                  onClick={() => {
                    setNewsletterSubject('Güvenli Takas İpuçları')
                    setNewsletterContent(`<h2>🛡️ Güvenli Takas İpuçları</h2>
<p>Merhaba,</p>
<p>Takas-A'da güvenli takas için dikkat etmeniz gerekenler:</p>
<h3>📌 Önemli İpuçları:</h3>
<ul>
  <li>✅ Ürün fotoğraflarını detaylı inceleyin</li>
  <li>✅ Satıcının puanını kontrol edin</li>
  <li>✅ Teslimat noktalarını kullanın</li>
  <li>✅ Ürünü teslim almadan önce kontrol edin</li>
  <li>✅ Şüpheli durumlarda bize bildirin</li>
</ul>
<p>Güvenli takaslar! 💜</p>`)
                  }}
                  className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span className="text-lg">🛡️</span>
                  <span className="font-semibold ml-2 text-gray-900 dark:text-white">Güvenlik İpuçları</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Güvenli takas rehberi</p>
                </button>

                <button
                  onClick={() => {
                    setNewsletterSubject('Sizi Özledik! Takas-A\'ya Geri Dönün')
                    setNewsletterContent(`<h2>👋 Sizi Özledik!</h2>
<p>Merhaba,</p>
<p>Takas-A'da sizi görmeyeli uzun zaman oldu. Sizin için birçok yeni ürün ve fırsat bekliyor!</p>
<h3>🎁 Geri Dönüş Bonusu:</h3>
<ul>
  <li>🎯 İlk takasınızı tamamladığınızda <strong>+5 VALOR</strong> bonus</li>
  <li>📦 Yeni kategoriler eklendi</li>
  <li>🚀 Daha hızlı takas süreci</li>
</ul>
<p>Hemen geri dönün ve takas yapmaya başlayın! 💜</p>`)
                  }}
                  className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span className="text-lg">👋</span>
                  <span className="font-semibold ml-2 text-gray-900 dark:text-white">Geri Kazanım</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Pasif kullanıcıları geri çağır</p>
                </button>
              </div>
            </div>

            {/* Bilgi Kutusu */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
              <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">📧 Newsletter Hakkında</h4>
              <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                <li>• <strong>Test Gönder:</strong> Sadece admin e-postasına gönderir (önizleme için)</li>
                <li>• <strong>Herkese Gönder:</strong> Tüm doğrulanmış kullanıcılara gönderir</li>
                <li>• <strong>Rate Limiting:</strong> Spam engellemek için saniyede 1 mail gönderilir</li>
                <li>• E-postalar TAKAS-A markası ile profesyonel şablonla gönderilir</li>
              </ul>
            </div>

            {/* Email Doğrulama Hatırlatması Bölümü */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-xl dark:text-white">✉️ Email Doğrulama Hatırlatması</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Doğrulanmamış kullanıcılara hatırlatma gönder</p>
                </div>
                {verificationStats && (
                  <div className="flex gap-3">
                    <div className="text-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{verificationStats.totalUsers}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">Toplam</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">{verificationStats.verifiedUsers}</p>
                      <p className="text-xs text-green-600 dark:text-green-500">Doğrulanmış</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{verificationStats.unverifiedUsers}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500">Doğrulanmamış</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{verificationStats.verificationRate}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-500">Doğrulama Oranı</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Uyarı */}
              {verificationStats && verificationStats.unverifiedUsers > 0 && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        ⚠️ {verificationStats.unverifiedUsers} kullanıcı email doğrulamadı!
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        Bu kullanıcılar newsletter alamıyor ve platformun tüm özelliklerini kullanamıyor.
                        Email doğrulama hatırlatması göndererek onları geri kazanabilirsiniz.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Özellikler */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🌍</span>
                    <span className="font-medium text-purple-800 dark:text-purple-300">4 Dil Desteği</span>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-400">Türkçe, İngilizce, İspanyolca, Almanca</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎁</span>
                    <span className="font-medium text-amber-800 dark:text-amber-300">5 VALOR Bonus</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">İlk takas sonrası verilir</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⏱️</span>
                    <span className="font-medium text-green-800 dark:text-green-300">10 Dakika Geçerli</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400">Yeni doğrulama kodu oluşturulur</p>
                </div>
              </div>

              {/* Progress */}
              {verificationProgress && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-green-700 dark:text-green-300">
                      {verificationSending ? '📤 Gönderiliyor...' : '✅ Gönderim Tamamlandı'}
                    </span>
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {verificationProgress.sent + verificationProgress.failed} / {verificationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${((verificationProgress.sent + verificationProgress.failed) / verificationProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-green-600 dark:text-green-400">✓ Başarılı: {verificationProgress.sent}</span>
                    {verificationProgress.failed > 0 && (
                      <span className="text-red-600 dark:text-red-400">✕ Başarısız: {verificationProgress.failed}</span>
                    )}
                  </div>
                  {verificationProgress.languageStats && (
                    <div className="flex gap-4 mt-3 text-xs text-gray-600 dark:text-gray-300">
                      <span>🇹🇷 TR: {verificationProgress.languageStats.tr}</span>
                      <span>🇬🇧 EN: {verificationProgress.languageStats.en}</span>
                      <span>🇩🇪 DE: {verificationProgress.languageStats.de}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Butonlar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={async () => {
                    setVerificationSending(true)
                    setVerificationProgress(null)
                    try {
                      const res = await fetch('/api/admin/send-verification-reminder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ testMode: true })
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setVerificationProgress({ 
                          sent: data.sent, 
                          failed: data.failed, 
                          total: data.total,
                          languageStats: data.languageStats
                        })
                        alert(`✅ Test e-postası gönderildi!\n\nGönderilen: ${data.sent}\nBaşarısız: ${data.failed}`)
                      } else {
                        alert(`❌ Hata: ${data.error}`)
                      }
                    } catch (err: any) {
                      alert(`❌ Bağlantı hatası: ${err.message}`)
                    }
                    setVerificationSending(false)
                  }}
                  disabled={verificationSending}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-colors"
                >
                  {verificationSending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      Test Gönder (Sadece Bana)
                    </>
                  )}
                </button>

                <button
                  onClick={async () => {
                    const confirmed = confirm(
                      `⚠️ DİKKAT!\n\nBu işlem ${verificationStats?.unverifiedUsers || 'tüm doğrulanmamış'} kullanıcıya e-posta gönderecek.\n\nHer kullanıcı için:\n• Yeni doğrulama kodu oluşturulacak\n• 4 dilde email gönderilecek (TR/EN/ES/DE)\n• 5 VALOR bonus (ilk takas sonrası) vurgulu hatırlatma\n\nDevam etmek istediğinize emin misiniz?`
                    )
                    if (!confirmed) return
                    
                    const doubleConfirmed = confirm(
                      '🔴 SON ONAY\n\nBu işlem geri alınamaz. Tüm doğrulanmamış kullanıcılara e-posta gönderilecek.\n\nGÖNDER?'
                    )
                    if (!doubleConfirmed) return

                    setVerificationSending(true)
                    setVerificationProgress(null)
                    try {
                      const res = await fetch('/api/admin/send-verification-reminder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ testMode: false })
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setVerificationProgress({ 
                          sent: data.sent, 
                          failed: data.failed, 
                          total: data.total,
                          languageStats: data.languageStats
                        })
                        alert(`✅ Doğrulama hatırlatması gönderildi!\n\nToplam: ${data.total}\nBaşarılı: ${data.sent}\nBaşarısız: ${data.failed}\n\n📊 Dil Dağılımı:\n🇹🇷 Türkçe: ${data.languageStats?.tr || 0}\n🇬🇧 İngilizce: ${data.languageStats?.en || 0}\n🇩🇪 Almanca: ${data.languageStats?.de || 0}`)
                        // İstatistikleri güncelle
                        fetchData()
                      } else {
                        alert(`❌ Hata: ${data.error}`)
                      }
                    } catch (err: any) {
                      alert(`❌ Bağlantı hatası: ${err.message}`)
                    }
                    setVerificationSending(false)
                  }}
                  disabled={verificationSending || (verificationStats?.unverifiedUsers || 0) === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-colors"
                >
                  {verificationSending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Tüm Doğrulanmamışlara Gönder ({verificationStats?.unverifiedUsers || 0})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test & Doğrulama Tab */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold dark:text-white">🧪 Sistem Test & Doğrulama</h2>
            
            {/* Takas Algoritması Testi */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
              <h3 className="font-bold text-lg mb-4 dark:text-white">🔄 Takas Algoritması Testi</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Multi-swap algoritmasını test eder. Mevcut aktif ürünlerle 
                olası takas döngülerini hesaplar.
              </p>
              <button
                onClick={async () => {
                  setTestResults((prev: any) => ({ ...prev, swapAlgo: { loading: true } }))
                  try {
                    const res = await fetch('/api/admin/test-swap-algorithm', { method: 'POST' })
                    const data = await res.json()
                    setTestResults((prev: any) => ({ ...prev, swapAlgo: { loading: false, data } }))
                  } catch (e) {
                    setTestResults((prev: any) => ({ ...prev, swapAlgo: { loading: false, error: 'Test başarısız' } }))
                  }
                }}
                disabled={testResults?.swapAlgo?.loading}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {testResults?.swapAlgo?.loading ? '⏳ Test Ediliyor...' : '🔄 Takas Algoritmasını Test Et'}
              </button>
              {testResults?.swapAlgo?.data && (
                <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs overflow-auto max-h-60">
                  {JSON.stringify(testResults.swapAlgo.data, null, 2)}
                </pre>
              )}
              {testResults?.swapAlgo?.error && (
                <p className="mt-4 text-red-500 text-sm">{testResults.swapAlgo.error}</p>
              )}
            </div>

            {/* Ekonomi Tutarlılık Testi */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
              <h3 className="font-bold text-lg mb-4 dark:text-white">💰 Ekonomi Tutarlılık Testi</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Bonus değerleri, seviye sistemi, aylık tavanlar ve rozet 
                ödüllerinin tutarlılığını kontrol eder.
              </p>
              <button
                onClick={async () => {
                  setTestResults((prev: any) => ({ ...prev, economy: { loading: true } }))
                  try {
                    const res = await fetch('/api/admin/test-economy', { method: 'POST' })
                    const data = await res.json()
                    setTestResults((prev: any) => ({ ...prev, economy: { loading: false, data } }))
                  } catch (e) {
                    setTestResults((prev: any) => ({ ...prev, economy: { loading: false, error: 'Test başarısız' } }))
                  }
                }}
                disabled={testResults?.economy?.loading}
                className="px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {testResults?.economy?.loading ? '⏳ Test Ediliyor...' : '💰 Ekonomi Testini Çalıştır'}
              </button>
              {testResults?.economy?.data && (
                <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs overflow-auto max-h-60">
                  {JSON.stringify(testResults.economy.data, null, 2)}
                </pre>
              )}
              {testResults?.economy?.error && (
                <p className="mt-4 text-red-500 text-sm">{testResults.economy.error}</p>
              )}
            </div>

            {/* Trust Score Tutarlılık */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
              <h3 className="font-bold text-lg mb-4 dark:text-white">🔒 Güven Skoru Kontrol</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                100&apos;ü aşan trust score, negatif balance, orphan transaction 
                gibi anomalileri tespit eder ve otomatik düzeltir.
              </p>
              <button
                onClick={async () => {
                  setTestResults((prev: any) => ({ ...prev, trust: { loading: true } }))
                  try {
                    const res = await fetch('/api/admin/test-trust', { method: 'POST' })
                    const data = await res.json()
                    setTestResults((prev: any) => ({ ...prev, trust: { loading: false, data } }))
                  } catch (e) {
                    setTestResults((prev: any) => ({ ...prev, trust: { loading: false, error: 'Test başarısız' } }))
                  }
                }}
                disabled={testResults?.trust?.loading}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {testResults?.trust?.loading ? '⏳ Kontrol Ediliyor...' : '🔒 Güven Kontrol'}
              </button>
              {testResults?.trust?.data && (
                <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs overflow-auto max-h-60">
                  {JSON.stringify(testResults.trust.data, null, 2)}
                </pre>
              )}
              {testResults?.trust?.error && (
                <p className="mt-4 text-red-500 text-sm">{testResults.trust.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Ses Testi Tab */}
        {activeTab === 'ses-testi' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
              <h3 className="font-bold text-xl mb-2 dark:text-white flex items-center gap-2">
                <Volume2 className="w-6 h-6 text-violet-500" />
                Ses ve Animasyon Test Paneli
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Tüm bildirim seslerini ve animasyonları test edin. Önce &quot;Ses Kilidini Aç&quot; butonuna tıklayın.
              </p>

              {/* Ses Kilidi Açma */}
              <div className="mb-8">
                <button
                  onClick={() => unlockAudio()}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Music className="w-5 h-5" />
                  Ses Kilidini Aç
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Tarayıcı seslerinin çalışması için önce bu butona tıklayın
                </p>
              </div>

              {/* Ses Butonları */}
              <div className="mb-8">
                <h4 className="font-semibold text-lg mb-4 dark:text-white">🔊 Ses Testleri</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => playMessageSound()}
                    className="px-4 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Mesaj Sesi
                  </button>
                  <button
                    onClick={() => playSwapOfferSound()}
                    className="px-4 py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    Takas Teklifi
                  </button>
                  <button
                    onClick={() => playMatchSound()}
                    className="px-4 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Eşleşme Sesi
                  </button>
                  <button
                    onClick={() => playCoinSound()}
                    className="px-4 py-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-xl font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Coins className="w-4 h-4" />
                    Valor Sesi
                  </button>
                  <button
                    onClick={() => playNotificationSound()}
                    className="px-4 py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Bildirim Sesi
                  </button>
                  <button
                    onClick={() => playErrorSound()}
                    className="px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-all flex items-center justify-center gap-2"
                  >
                    <VolumeX className="w-4 h-4" />
                    Hata Sesi
                  </button>
                </div>
              </div>

              {/* Animasyon Butonları */}
              <div className="mb-8">
                <h4 className="font-semibold text-lg mb-4 dark:text-white">🎉 Animasyon Testleri</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => triggerSwapConfetti()}
                    className="px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    🎊 Takas Konfeti
                  </button>
                  <button
                    onClick={() => triggerValorConfetti()}
                    className="px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    💰 Valor Konfeti
                  </button>
                  <button
                    onClick={() => triggerMiniConfetti()}
                    className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    ✨ Mini Konfeti
                  </button>
                  <button
                    onClick={() => {
                      triggerSwapConfetti()
                      playMatchSound()
                    }}
                    className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    🎯 Ses + Konfeti
                  </button>
                </div>
              </div>

              {/* Valor Popup Testleri */}
              <div className="mb-8">
                <h4 className="font-semibold text-lg mb-4 dark:text-white">💎 Valor Popup Testleri</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => { showValor(10); playCoinSound() }}
                    className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +10 Valor
                  </button>
                  <button
                    onClick={() => { showValor(25); playCoinSound() }}
                    className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +25 Valor
                  </button>
                  <button
                    onClick={() => { showValor(50); playCoinSound() }}
                    className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +50 Valor
                  </button>
                  <button
                    onClick={() => { showValor(100); playCoinSound(); triggerValorConfetti() }}
                    className="px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +100 Valor 🎉
                  </button>
                  <button
                    onClick={() => { showValor(250); playCoinSound(); triggerValorConfetti() }}
                    className="px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +250 Valor 🎉
                  </button>
                  <button
                    onClick={() => { showValor(500); playCoinSound(); triggerValorConfetti() }}
                    className="px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    +500 Valor 🎉
                  </button>
                </div>
              </div>

              {/* Tam Takas Deneyimi */}
              <div>
                <h4 className="font-semibold text-lg mb-4 dark:text-white">🚀 Tam Deneyim Testi</h4>
                <button
                  onClick={async () => {
                    unlockAudio()
                    await new Promise(r => setTimeout(r, 100))
                    playSwapOfferSound()
                    await new Promise(r => setTimeout(r, 1500))
                    playMatchSound()
                    triggerSwapConfetti()
                    await new Promise(r => setTimeout(r, 1000))
                    showValor(150)
                    playCoinSound()
                    triggerValorConfetti()
                  }}
                  className="px-6 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all flex items-center gap-3"
                >
                  <Zap className="w-6 h-6" />
                  Tam Takas Deneyimini Başlat
                  <span className="text-sm opacity-75">(Teklif → Kabul → Valor)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Push Notification Tab */}
        {activeTab === 'bildirimler' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              🔔 Segmentli Push Bildirim Gönder
            </h3>

            <div className="space-y-6">
              {/* Segment Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hedef Segment
                </label>
                <select
                  value={broadcastSegment}
                  onChange={(e) => setBroadcastSegment(e.target.value as typeof broadcastSegment)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">🌐 Tüm Kullanıcılar</option>
                  <option value="inactive_3days">😴 3+ Gündür Giriş Yapmayanlar</option>
                  <option value="no_product">📦 Hiç Ürün Yüklemeyenler</option>
                  <option value="no_offer">🤝 Hiç Teklif Vermeyenler</option>
                </select>
              </div>

              {/* Hazır Şablonlar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hazır Şablonlar
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('Seni özledik! 👋')
                      setBroadcastBody('3 gündür görünmedin. Yeni takaslar seni bekliyor!')
                      setBroadcastSegment('inactive_3days')
                    }}
                    className="px-3 py-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-left"
                  >
                    😴 Seni özledik!
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('İlk ürününü yükle 🎁')
                      setBroadcastBody('Hemen ürün ekle, Valor kazan ve takas dünyasına katıl!')
                      setBroadcastSegment('no_product')
                    }}
                    className="px-3 py-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-left"
                  >
                    📦 İlk ürünü yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('Harika eşleşmeler var! 🔄')
                      setBroadcastBody('Sana uygun takaslar seni bekliyor. Hemen bak!')
                      setBroadcastSegment('all')
                    }}
                    className="px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-left"
                  >
                    🔄 Eşleşmeler var
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('Teklif ver, kazan! 💜')
                      setBroadcastBody('Beğendiğin ürüne teklif ver. Parasız alışveriş başlasın!')
                      setBroadcastSegment('no_offer')
                    }}
                    className="px-3 py-2 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors text-left"
                  >
                    🤝 Teklif ver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('Unutma! ⏰')
                      setBroadcastBody("Takas-A'da bugün yüzlerce yeni ürün eklendi. Kaçırma!")
                      setBroadcastSegment('all')
                    }}
                    className="px-3 py-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-left"
                  >
                    ⏰ Unutma!
                  </button>
                </div>
              </div>

              {/* Başlık Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bildirim Başlığı <span className="text-gray-400">({broadcastTitle.length}/50)</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value.slice(0, 50))}
                  placeholder="Örn: Yeni Özellik!"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Mesaj Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bildirim Mesajı <span className="text-gray-400">({broadcastBody.length}/120)</span>
                </label>
                <textarea
                  maxLength={120}
                  rows={3}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value.slice(0, 120))}
                  placeholder="Kullanıcılara gösterilecek mesaj..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* URL Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tıklanınca Açılacak Sayfa
                </label>
                <select
                  value={broadcastUrl}
                  onChange={(e) => setBroadcastUrl(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="/">Ana Sayfa</option>
                  <option value="/urunler">Ürünler</option>
                  <option value="/takas-firsatlari">Takas Merkezi</option>
                  <option value="/oneriler">Öneriler</option>
                  <option value="/premium">Premium</option>
                  <option value="/hakkimizda">Hakkımızda</option>
                </select>
              </div>

              {/* Önizleme */}
              {(broadcastTitle.trim() || broadcastBody.trim()) && (
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">📱 Önizleme</p>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-lg">T</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {broadcastTitle || 'Başlık girilmedi'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        {broadcastBody || 'Mesaj girilmedi'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Gönder Butonu */}
              <button
                onClick={handleBroadcast}
                disabled={broadcastSending || !broadcastTitle.trim() || !broadcastBody.trim()}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  broadcastSending || !broadcastTitle.trim() || !broadcastBody.trim()
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                {broadcastSending ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    {broadcastSegment === 'all' ? 'Tüm Kullanıcılara Gönder' : 'Segmente Gönder'}
                  </>
                )}
              </button>

              {/* Sonuç */}
              {broadcastResult && (
                <div className={`p-4 rounded-xl ${
                  broadcastResult.failed === -1 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}>
                  {broadcastResult.failed === -1 ? (
                    <p className="font-medium">❌ Gönderim sırasında bir hata oluştu</p>
                  ) : (
                    <div>
                      <p className="font-medium">✅ Bildirim gönderildi!</p>
                      <p className="text-sm mt-1">
                        Gönderilen kullanıcı: {broadcastResult.sent} | Başarısız: {broadcastResult.failed}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bilgi Notu */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ℹ️ Bu bildirim, push notification'a izin vermiş tüm kullanıcılara gönderilecektir.
                  Kullanıcılar bildirimi tıkladığında seçilen sayfa açılacaktır.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Valor Animation */}
      <ValorAnimation amount={valorAmount} show={showValorAnim} onComplete={hideValor} />
    </main>
  )
}
