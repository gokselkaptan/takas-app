'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Clock, MapPin, Zap, Star,
  X, Sparkles, ArrowRight, Eye, Briefcase,
  User, Building2, Tag, ArrowLeftRight, MessageCircle, Pause, Play, Trash2, Edit
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { safeFetch } from '@/lib/safe-fetch'
import { useLanguage } from '@/lib/language-context'

const SERVICE_CATEGORIES = [
  { value: 'cleaning', label: '🧹 Temizlik', desc: 'Ev, ofis, araç temizliği' },
  { value: 'electrical', label: '⚡ Elektrik', desc: 'Tesisat, tamir, kurulum' },
  { value: 'plumbing', label: '🔧 Tadilat & Tesisat', desc: 'Boya, tamirat, su tesisatı' },
  { value: 'beauty', label: '💇 Güzellik & Bakım', desc: 'Kuaför, cilt bakımı, manikür' },
  { value: 'education', label: '👨‍🏫 Eğitim', desc: 'Özel ders, kurs, mentorluk' },
  { value: 'cooking', label: '🍳 Yemek & Catering', desc: 'Aşçılık, catering, pasta' },
  { value: 'repair', label: '🛠️ Tamir & Bakım', desc: 'Beyaz eşya, elektronik, araç' },
  { value: 'delivery', label: '🚚 Taşıma & Kurye', desc: 'Nakliyat, kurye, teslimat' },
  { value: 'design', label: '💻 Dijital & Tasarım', desc: 'Web, grafik, sosyal medya' },
  { value: 'photography', label: '📸 Fotoğraf & Video', desc: 'Çekim, düzenleme, drone' },
  { value: 'other', label: '🛠️ Diğer', desc: 'Diğer hizmetler' },
]

const DURATION_OPTIONS = [
  { value: '1 saat', label: '1 Saat' },
  { value: '2 saat', label: '2 Saat' },
  { value: '4 saat', label: '4 Saat (Yarım Gün)' },
  { value: '8 saat', label: '8 Saat (Tam Gün)' },
  { value: '1 hafta', label: '1 Hafta' },
  { value: 'paket', label: 'Paket Hizmet' },
]

interface ServiceType {
  id: string
  title: string
  description: string
  category: string
  duration: string
  unitType: string
  unitCount: number
  valorPrice: number
  city: string
  district?: string
  serviceArea?: string
  wantCategory?: string
  wantDescription?: string
  status: string
  listingType: string
  businessName?: string
  views: number
  completedSwaps: number
  rating?: number
  createdAt: string
  acceptsNegotiation?: boolean
  userId?: string
  user: {
    id: string
    name: string | null
    image: string | null
    trustScore?: number
  }
}

export default function HizmetTakasiPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
  const [services, setServices] = useState<ServiceType[]>([])
  const [myServices, setMyServices] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Teklif Modal State
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    duration: '1 saat',
    valorPrice: '',
    city: 'İzmir',
    district: '',
    serviceArea: '',
    wantCategory: '',
    wantDescription: '',
    listingType: 'individual',
    businessName: '',
  })

  useEffect(() => {
    fetchServices()
  }, [selectedCategory])

  useEffect(() => {
    if (session?.user) fetchMyServices()
  }, [session])

  const fetchServices = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      params.set('limit', '30')
      
      const { data, error } = await safeFetch(`/api/services?${params}`)
      if (data && !error) {
        setServices(data.services || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMyServices = async () => {
    const { data } = await safeFetch('/api/services?my=true')
    if (data) setMyServices(data.services || [])
  }

  const handleCreate = async () => {
    if (!session) { router.push('/giris'); return }
    if (!formData.title || !formData.category || !formData.valorPrice) {
      toast.error('Başlık, kategori ve değer zorunludur')
      return
    }
    
    setSubmitting(true)
    const { data, error } = await safeFetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      timeout: 15000,
    })
    
    if (error) { toast.error(error); setSubmitting(false); return }
    if (data?.success) {
      toast.success('Hizmetiniz listelendi!')
      setShowCreateModal(false)
      setFormData({ 
        title: '', description: '', category: '', duration: '1 saat', 
        valorPrice: '', city: 'İzmir', district: '', serviceArea: '', 
        wantCategory: '', wantDescription: '', listingType: 'individual', businessName: '' 
      })
      fetchServices()
      fetchMyServices()
    }
    setSubmitting(false)
  }

  const handleToggleStatus = async (id: string) => {
    setActionLoading(id)
    const { data, error } = await safeFetch('/api/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'toggleStatus' }),
    })
    if (data?.success) {
      toast.success('Durum güncellendi')
      fetchMyServices()
    } else {
      toast.error(error || 'Hata oluştu')
    }
    setActionLoading(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu hizmeti silmek istediğinizden emin misiniz?')) return
    setActionLoading(id)
    const { data, error } = await safeFetch('/api/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    })
    if (data?.success) {
      toast.success('Hizmet silindi')
      fetchMyServices()
    } else {
      toast.error(error || 'Hata oluştu')
    }
    setActionLoading(null)
  }

  const getCategoryInfo = (value: string) => {
    return SERVICE_CATEGORIES.find(c => c.value === value) || { label: '🛠️ Diğer', value: 'other' }
  }

  // Mesaj butonu handler
  const handleMessageClick = (service: ServiceType) => {
    if (!session?.user) {
      router.push('/giris')
      return
    }
    const currentUserId = (session.user as any)?.id
    const serviceUserId = service.user?.id || service.userId
    // Kendi hizmetin ise mesaj gönderme
    if (serviceUserId === currentUserId) {
      toast.error('Kendi hizmetinize mesaj gönderemezsiniz')
      return
    }
    // Mesaj kabul etmiyorsa uyar
    if (service.acceptsNegotiation === false) {
      toast.error('Bu hizmet sahibi şu anda mesaj kabul etmiyor.')
      return
    }
    // YENİ KONUŞMA AÇAR — userId + productId + productTitle ile
    const params = new URLSearchParams({
      userId: serviceUserId || '',
      productId: service.id,
      productTitle: service.title,
    })
    router.push(`/mesajlar?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24">
      {/* Hero */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                🤝 {t('serviceSwap')}
              </h1>
              <p className="text-white/90 mt-1">
                {t('serviceSwapDesc')}
              </p>
            </div>
            <Button
              onClick={() => session ? setShowCreateModal(true) : router.push('/giris')}
              className="bg-white text-green-600 hover:bg-green-50 font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('addService')}
            </Button>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab'lar */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'browse' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            🔍 {t('exploreServices')}
          </button>
          {session && (
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'my' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 {t('myServices')} ({myServices.length})
            </button>
          )}
        </div>

        {/* Kategori Filtreleri */}
        {activeTab === 'browse' && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-green-600 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-green-400 shadow-sm'
              }`}
            >
              {t('all')}
            </button>
            {SERVICE_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-green-400 shadow-sm'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Hizmet Kartları */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-3">{t('loading')}</p>
          </div>
        ) : activeTab === 'browse' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('noServiceListings')}</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{t('beFirst')}</p>
                <Button onClick={() => session ? setShowCreateModal(true) : router.push('/giris')} className="mt-4 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold">
                  <Plus className="w-4 h-4 mr-2" /> {t('addService')}
                </Button>
              </div>
            ) : (
              services.map((service) => {
                const currentUserId = (session?.user as any)?.id
                const isOwnService = service.user?.id === currentUserId || service.userId === currentUserId
                const canMessage = service.acceptsNegotiation !== false && !isOwnService
                
                return (
                  <motion.div 
                    key={service.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md hover:border-green-200 dark:hover:border-green-800 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {getCategoryInfo(service.category).label.split(' ')[0]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{service.title}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" /> {service.user?.name || 'Anonim'}
                          {service.listingType === 'business' && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
                              {t('corporate').toUpperCase()}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white bg-green-600 px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
                        ⭐ {service.valorPrice} V
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">{service.description || t('noDescription')}</p>
                    
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {service.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {service.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {service.views}
                      </span>
                    </div>
                    
                    {service.wantDescription && (
                      <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                          🔄 {t('wantsInReturn')}: {service.wantDescription}
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-3 pt-3 border-t dark:border-gray-700 flex gap-2">
                      {/* ✅ Teklif Ver → Özel teklif formu modal'ı aç */}
                      <Button 
                        size="sm" 
                        className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm"
                        onClick={() => {
                          if (!session) { router.push('/giris'); return }
                          setSelectedService(service)
                          setShowOfferModal(true)
                        }}
                      >
                        <ArrowLeftRight className="w-3 h-3 mr-1" /> {t('makeOffer')}
                      </Button>
                      {/* 💬 Mesaj → acceptsNegotiation kontrolü ile */}
                      <button
                        onClick={() => handleMessageClick(service)}
                        disabled={!canMessage}
                        className={`p-2.5 rounded-xl transition-colors ${
                          !canMessage
                            ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-40'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                        title={
                          isOwnService
                            ? 'Kendi hizmetinize mesaj gönderemezsiniz'
                            : service.acceptsNegotiation === false
                            ? 'Bu hizmet sahibi mesaj kabul etmiyor'
                            : 'Hizmet sahibine mesaj gönder'
                        }
                      >
                        <MessageCircle className={`w-4 h-4 ${
                          !canMessage
                            ? 'text-gray-300 dark:text-gray-600'
                            : 'text-blue-500 dark:text-blue-400'
                        }`} />
                      </button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        ) : (
          /* Hizmetlerim Tab'ı */
          <div className="space-y-4">
            {myServices.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">Henüz hizmet eklemediniz.</p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-green-500 hover:bg-green-600">
                  <Plus className="w-4 h-4 mr-2" /> İlk Hizmetimi Ekle
                </Button>
              </div>
            ) : (
              myServices.map((service) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }} 
                  className="bg-white rounded-xl shadow-sm border p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {getCategoryInfo(service.category).label.split(' ')[0]}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900">{service.title}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> {service.duration}
                          <span>•</span>
                          <span className="font-bold text-green-700">{service.valorPrice} Valor</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        service.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {service.status === 'active' ? 'Aktif' : 'Duraklatıldı'}
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleToggleStatus(service.id)}
                        disabled={actionLoading === service.id}
                      >
                        {service.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(service.id)}
                        disabled={actionLoading === service.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {service.views} görüntüleme</span>
                    <span className="flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> {service.completedSwaps} takas</span>
                    {service.serviceArea && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {service.serviceArea}</span>}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
        
        {/* Hizmet Teşvik Bölümü */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Hizmetini Paylaş, Karşılığını Al!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-md mx-auto">
            Ders ver, tamirat yap, güzellik hizmeti sun — karşılığında 
            istediğin ürün veya hizmeti al.
          </p>
        </div>
      </div>

      {/* Hizmet Oluşturma Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Hizmet Ekle
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Bireysel / Kurumsal Seçimi */}
            <div className="flex gap-2">
              <button
                onClick={() => setFormData({...formData, listingType: 'individual'})}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.listingType === 'individual' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" /> Bireysel
              </button>
              <button
                onClick={() => setFormData({...formData, listingType: 'business'})}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.listingType === 'business' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-1" /> Kurumsal
              </button>
            </div>
            
            {formData.listingType === 'business' && (
              <Input
                placeholder="İşletme / Firma Adı"
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="border-gray-300"
              />
            )}
            
            <Input
              placeholder="Hizmet Başlığı (ör: Ev Temizliği, Elektrik Tamiratı)"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="border-gray-300"
            />
            
            <Textarea
              placeholder="Hizmet detaylarını açıklayın..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="border-gray-300"
            />
            
            {/* Kategori */}
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Kategori Seçin</option>
              {SERVICE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label} — {cat.desc}</option>
              ))}
            </select>
            
            {/* Süre */}
            <select
              value={formData.duration}
              onChange={(e) => setFormData({...formData, duration: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            {/* Valor Değeri */}
            <div className="relative">
              <Input
                type="number"
                placeholder="Valor değeri"
                value={formData.valorPrice}
                onChange={(e) => setFormData({...formData, valorPrice: e.target.value})}
                className="border-gray-300 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-600 font-bold">Valor</span>
            </div>
            
            {/* Konum */}
            <Input
              placeholder="Hizmet bölgesi (ör: Bornova ve çevresi)"
              value={formData.serviceArea}
              onChange={(e) => setFormData({...formData, serviceArea: e.target.value})}
              className="border-gray-300"
            />
            
            {/* Karşılığında ne istiyor */}
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-700 font-bold mb-2">🎯 Karşılığında Ne İstiyorsunuz?</p>
              <Textarea
                placeholder="ör: Mutfak tüpü, elektrikli süpürge veya kıyafet"
                value={formData.wantDescription}
                onChange={(e) => setFormData({...formData, wantDescription: e.target.value})}
                rows={2}
                className="bg-white border-gray-300"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                İptal
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={submitting}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Ekleniyor...
                  </>
                ) : (
                  '✅ Hizmeti Listele'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ TEKLİF FORMU MODAL ═══ */}
      {showOfferModal && selectedService && (
        <ServiceOfferModal
          service={selectedService}
          onClose={() => { setShowOfferModal(false); setSelectedService(null) }}
          onSuccess={() => { 
            setShowOfferModal(false)
            setSelectedService(null)
            toast.success('Teklifiniz gönderildi!')
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// TEKLİF FORMU BİLEŞENİ
// ═══════════════════════════════════════

function ServiceOfferModal({ 
  service, onClose, onSuccess 
}: { 
  service: ServiceType
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: session } = useSession()
  const [offerType, setOfferType] = useState<'product' | 'valor' | 'mixed'>('valor')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [valorAmount, setValorAmount] = useState(0)
  const [message, setMessage] = useState('')
  const [myProducts, setMyProducts] = useState<any[]>([])
  const [userBalance, setUserBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Kullanıcının ürünlerini ve bakiyesini çek
  useEffect(() => {
    const fetchMyData = async () => {
      setLoading(true)
      try {
        const [productsRes, profileRes] = await Promise.all([
          fetch('/api/products?myProducts=true'),
          fetch('/api/profile'),
        ])
        if (productsRes.ok) {
          const data = await productsRes.json()
          const products = data.products || data || []
          setMyProducts(products.filter((p: any) => p.status === 'active'))
        }
        if (profileRes.ok) {
          const data = await profileRes.json()
          setUserBalance(data.valorBalance || data.user?.valorBalance || 0)
        }
      } catch {}
      setLoading(false)
    }
    fetchMyData()
  }, [])

  const servicePrice = service.valorPrice

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)

    try {
      // Validasyon
      if (offerType === 'product' && !selectedProductId) {
        setError('Lütfen bir ürün seçin')
        setSubmitting(false)
        return
      }
      if (offerType === 'valor' && valorAmount <= 0) {
        setError('Lütfen Valor miktarı girin')
        setSubmitting(false)
        return
      }
      if (offerType === 'mixed' && !selectedProductId && valorAmount <= 0) {
        setError('Lütfen bir ürün seçin veya Valor miktarı girin')
        setSubmitting(false)
        return
      }

      // Teklif mesajını oluştur
      let offerMessage = message || ''
      if (offerType === 'product') {
        const p = myProducts.find(p => p.id === selectedProductId)
        offerMessage = `[Hizmet Takası Teklifi]\nKarşılığında sunulan: ${p?.title} (${p?.valorPrice || p?.userValorPrice}V)\n${message ? `Not: ${message}` : ''}`
      } else if (offerType === 'valor') {
        offerMessage = `[Hizmet Takası Teklifi]\nKarşılığında sunulan: ${valorAmount} Valor\n${message ? `Not: ${message}` : ''}`
      } else {
        const p = myProducts.find(p => p.id === selectedProductId)
        offerMessage = `[Hizmet Takası Teklifi]\nKarşılığında sunulan: ${p ? `${p.title} (${p.valorPrice || p.userValorPrice}V)` : ''} ${valorAmount > 0 ? `+ ${valorAmount} Valor` : ''}\n${message ? `Not: ${message}` : ''}`
      }

      // API çağrısı — mevcut swap-requests API'sini kullan
      const res = await fetch('/api/swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: service.id,
          offeredProductId: selectedProductId || undefined,
          offeredValor: offerType === 'valor' || offerType === 'mixed' ? valorAmount : undefined,
          message: offerMessage,
        })
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => onSuccess(), 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Teklif gönderilemedi')
      }
    } catch (e) {
      setError('Bir hata oluştu. Tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-t-2xl flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-lg">🔄 Teklif Ver</h2>
            <p className="text-emerald-100 text-sm truncate max-w-[250px]">{service.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          
          {/* Hizmet bilgisi */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{service.title}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              👤 {service.user?.name || 'Anonim'} • 📍 {service.city} • 💰 {servicePrice} Valor
            </p>
            {service.wantDescription && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                🎯 İstiyor: {service.wantDescription}
              </p>
            )}
          </div>

          {/* Teklif Tipi Seçimi */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              Ne teklif ediyorsun?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setOfferType('product')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  offerType === 'product'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">📦</span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Ürün</span>
              </button>
              <button
                onClick={() => setOfferType('valor')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  offerType === 'valor'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">💰</span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Valor</span>
              </button>
              <button
                onClick={() => setOfferType('mixed')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  offerType === 'mixed'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">🔀</span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Karma</span>
              </button>
            </div>
          </div>

          {/* Ürün Seçimi (product veya mixed) */}
          {(offerType === 'product' || offerType === 'mixed') && (
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                📦 Ürününü Seç
              </p>
              {loading ? (
                <p className="text-sm text-gray-400">Yükleniyor...</p>
              ) : myProducts.length === 0 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Aktif ürününüz yok. Önce ürün ekleyin.
                  </p>
                  <Link href="/urun-ekle" className="text-xs text-yellow-600 underline mt-1 inline-block">
                    + Ürün Ekle
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {myProducts.map(product => (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selectedProductId === product.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedProduct"
                        checked={selectedProductId === product.id}
                        onChange={() => setSelectedProductId(product.id)}
                        className="accent-emerald-600"
                      />
                      {product.images?.[0] && (
                        <img 
                          src={product.images[0]} 
                          alt={product.title} 
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-gray-500">{product.valorPrice || product.userValorPrice} Valor</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Valor Miktarı (valor veya mixed) */}
          {(offerType === 'valor' || offerType === 'mixed') && (
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                💰 Valor Miktarı
              </p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={userBalance}
                  value={valorAmount || ''}
                  onChange={(e) => setValorAmount(Math.min(Number(e.target.value), userBalance))}
                  placeholder={`Mevcut bakiye: ${userBalance} V`}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  V
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Bakiyeniz: {userBalance.toLocaleString()} Valor
              </p>
              {/* Hızlı seçim */}
              <div className="flex gap-2 mt-2">
                {[
                  { label: '25%', value: Math.round(servicePrice * 0.25) },
                  { label: '50%', value: Math.round(servicePrice * 0.5) },
                  { label: '100%', value: servicePrice },
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setValorAmount(Math.min(opt.value, userBalance))}
                    className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    {opt.label} ({opt.value}V)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mesaj / Not */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              📝 Mesajınız (opsiyonel)
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Örn: Konser biletim var, dersleriniz karşılığında teklif edebilir miyim?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Teklif Özeti */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Teklif Özeti</p>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {offerType === 'product' && selectedProductId && (
                <p>📦 {myProducts.find(p => p.id === selectedProductId)?.title}</p>
              )}
              {offerType === 'valor' && valorAmount > 0 && (
                <p>💰 {valorAmount} Valor</p>
              )}
              {offerType === 'mixed' && (
                <>
                  {selectedProductId && <p>📦 {myProducts.find(p => p.id === selectedProductId)?.title}</p>}
                  {valorAmount > 0 && <p>💰 + {valorAmount} Valor</p>}
                </>
              )}
              {!selectedProductId && valorAmount <= 0 && (
                <p className="text-gray-400 italic">Henüz bir teklif seçilmedi</p>
              )}
            </div>
          </div>

          {/* Hata */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Başarı */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400 font-bold">
                ✅ Teklifiniz gönderildi! Hizmet sahibi değerlendirecek.
              </p>
            </div>
          )}

          {/* Gönder Butonu */}
          {!success && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-base hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '⏳ Gönderiliyor...' : '🔄 Teklifi Gönder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
