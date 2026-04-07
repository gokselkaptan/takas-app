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
import type { TranslationKey } from '@/lib/translations'

// Category keys mapped to translation keys
const SERVICE_CATEGORY_KEYS: { value: string; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { value: 'cleaning', labelKey: 'htCatCleaning', descKey: 'htCatCleaningDesc' },
  { value: 'electrical', labelKey: 'htCatElectrical', descKey: 'htCatElectricalDesc' },
  { value: 'plumbing', labelKey: 'htCatPlumbing', descKey: 'htCatPlumbingDesc' },
  { value: 'beauty', labelKey: 'htCatBeauty', descKey: 'htCatBeautyDesc' },
  { value: 'education', labelKey: 'htCatEducation', descKey: 'htCatEducationDesc' },
  { value: 'cooking', labelKey: 'htCatCooking', descKey: 'htCatCookingDesc' },
  { value: 'repair', labelKey: 'htCatRepair', descKey: 'htCatRepairDesc' },
  { value: 'delivery', labelKey: 'htCatDelivery', descKey: 'htCatDeliveryDesc' },
  { value: 'design', labelKey: 'htCatDesign', descKey: 'htCatDesignDesc' },
  { value: 'photography', labelKey: 'htCatPhotography', descKey: 'htCatPhotographyDesc' },
  { value: 'other', labelKey: 'htCatOther', descKey: 'htCatOtherDesc' },
]

const DURATION_KEYS: { value: string; labelKey: TranslationKey }[] = [
  { value: '1 saat', labelKey: 'htDur1h' },
  { value: '2 saat', labelKey: 'htDur2h' },
  { value: '4 saat', labelKey: 'htDur4h' },
  { value: '8 saat', labelKey: 'htDur8h' },
  { value: '1 hafta', labelKey: 'htDur1w' },
  { value: 'paket', labelKey: 'htDurPackage' },
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
      toast.error(t('htRequiredFields'))
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
      toast.success(t('htServiceListed'))
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
      toast.success(t('htStatusUpdated'))
      fetchMyServices()
    } else {
      toast.error(error || t('htErrorOccurred'))
    }
    setActionLoading(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('htConfirmDelete'))) return
    setActionLoading(id)
    const { data, error } = await safeFetch('/api/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    })
    if (data?.success) {
      toast.success(t('htServiceDeleted'))
      fetchMyServices()
    } else {
      toast.error(error || t('htErrorOccurred'))
    }
    setActionLoading(null)
  }

  const getCategoryLabel = (value: string) => {
    const found = SERVICE_CATEGORY_KEYS.find(c => c.value === value)
    return found ? t(found.labelKey) : t('htCatOther')
  }

  const handleMessageClick = (service: ServiceType) => {
    if (!session?.user) {
      router.push('/giris')
      return
    }
    const currentUserId = (session.user as any)?.id
    const serviceUserId = service.user?.id || service.userId
    if (serviceUserId === currentUserId) {
      toast.error(t('htCantMessageSelf'))
      return
    }
    if (service.acceptsNegotiation === false) {
      toast.error(t('htOwnerNotAccepting'))
      return
    }
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

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'browse' ? 'bg-green-500 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'
            }`}
          >
            🔍 {t('exploreServices')}
          </button>
          {session && (
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'my' ? 'bg-green-500 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'
              }`}
            >
              📋 {t('myServices')} ({myServices.length})
            </button>
          )}
        </div>

        {/* Category Filters */}
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
            {SERVICE_CATEGORY_KEYS.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-green-400 shadow-sm'
                }`}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        )}

        {/* Service Cards */}
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
                <p className="text-gray-400 dark:text-gray-400 mt-1">{t('beFirst')}</p>
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
                        {getCategoryLabel(service.category).split(' ')[0]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{service.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-300 font-medium flex items-center gap-1 mt-1">
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
                    
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-gray-400">
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
                            ? t('htTitleCantMessageSelf')
                            : service.acceptsNegotiation === false
                            ? t('htTitleNotAccepting')
                            : t('htTitleSendMessage')
                        }
                      >
                        <MessageCircle className={`w-4 h-4 ${
                          !canMessage
                            ? 'text-gray-300 dark:text-gray-400'
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
          /* My Services Tab */
          <div className="space-y-4">
            {myServices.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-400">{t('htNoServicesYet')}</p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-green-500 hover:bg-green-600">
                  <Plus className="w-4 h-4 mr-2" /> {t('htAddFirstService')}
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
                        {getCategoryLabel(service.category).split(' ')[0]}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900">{service.title}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> {service.duration}
                          <span>•</span>
                          <span className="font-bold text-green-700">{service.valorPrice} Valor</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        service.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {service.status === 'active' ? t('htStatusActive') : t('htStatusPaused')}
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
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {t('htViewCount').replace('{count}', String(service.views))}</span>
                    <span className="flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> {t('htSwapCount').replace('{count}', String(service.completedSwaps))}</span>
                    {service.serviceArea && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {service.serviceArea}</span>}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
        
        {/* Promotion Section */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t('htShareService')}
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-300 mb-4 max-w-md mx-auto">
            {t('htShareServiceDesc')}
          </p>
        </div>
      </div>

      {/* Create Service Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              {t('htAddServiceTitle')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Individual / Business Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setFormData({...formData, listingType: 'individual'})}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.listingType === 'individual' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" /> {t('htIndividual')}
              </button>
              <button
                onClick={() => setFormData({...formData, listingType: 'business'})}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.listingType === 'business' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-1" /> {t('htBusiness')}
              </button>
            </div>
            
            {formData.listingType === 'business' && (
              <Input
                placeholder={t('htBusinessNamePlaceholder')}
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="border-gray-300"
              />
            )}
            
            <Input
              placeholder={t('htTitlePlaceholder')}
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="border-gray-300"
            />
            
            <Textarea
              placeholder={t('htDescriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="border-gray-300"
            />
            
            {/* Category */}
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">{t('htSelectCategory')}</option>
              {SERVICE_CATEGORY_KEYS.map(cat => (
                <option key={cat.value} value={cat.value}>{t(cat.labelKey)} — {t(cat.descKey)}</option>
              ))}
            </select>
            
            {/* Duration */}
            <select
              value={formData.duration}
              onChange={(e) => setFormData({...formData, duration: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {DURATION_KEYS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
            
            {/* Valor Value */}
            <div className="relative">
              <Input
                type="number"
                placeholder={t('htValorValue')}
                value={formData.valorPrice}
                onChange={(e) => setFormData({...formData, valorPrice: e.target.value})}
                className="border-gray-300 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-600 font-bold">Valor</span>
            </div>
            
            {/* Location */}
            <Input
              placeholder={t('htServiceAreaPlaceholder')}
              value={formData.serviceArea}
              onChange={(e) => setFormData({...formData, serviceArea: e.target.value})}
              className="border-gray-300"
            />
            
            {/* What do you want in return */}
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-700 font-bold mb-2">{t('htWhatDoYouWant')}</p>
              <Textarea
                placeholder={t('htWantPlaceholder')}
                value={formData.wantDescription}
                onChange={(e) => setFormData({...formData, wantDescription: e.target.value})}
                rows={2}
                className="bg-white border-gray-300"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('htCancel')}
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={submitting}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    {t('htAdding')}
                  </>
                ) : (
                  t('htListService')
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Modal */}
      {showOfferModal && selectedService && (
        <ServiceOfferModal
          service={selectedService}
          onClose={() => { setShowOfferModal(false); setSelectedService(null) }}
          onSuccess={() => { 
            setShowOfferModal(false)
            setSelectedService(null)
            toast.success(t('htOfferSent'))
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// Service Offer Modal Component
// ═══════════════════════════════════════

function ServiceOfferModal({ 
  service, onClose, onSuccess 
}: { 
  service: ServiceType
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: session } = useSession()
  const { t } = useLanguage()
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
      if (offerType === 'product' && !selectedProductId) {
        setError(t('htSelectProduct'))
        setSubmitting(false)
        return
      }
      if (offerType === 'valor' && valorAmount <= 0) {
        setError(t('htEnterValor'))
        setSubmitting(false)
        return
      }
      if (offerType === 'mixed' && !selectedProductId && valorAmount <= 0) {
        setError(t('htSelectProductOrValor'))
        setSubmitting(false)
        return
      }

      let offerMessage = message || ''
      if (offerType === 'product') {
        const p = myProducts.find(p => p.id === selectedProductId)
        offerMessage = `${t('htOfferPrefix')}\n${t('htOfferedInReturn')} ${p?.title} (${p?.valorPrice || p?.userValorPrice}V)\n${message ? `${t('htNote')} ${message}` : ''}`
      } else if (offerType === 'valor') {
        offerMessage = `${t('htOfferPrefix')}\n${t('htOfferedInReturn')} ${valorAmount} Valor\n${message ? `${t('htNote')} ${message}` : ''}`
      } else {
        const p = myProducts.find(p => p.id === selectedProductId)
        offerMessage = `${t('htOfferPrefix')}\n${t('htOfferedInReturn')} ${p ? `${p.title} (${p.valorPrice || p.userValorPrice}V)` : ''} ${valorAmount > 0 ? `+ ${valorAmount} Valor` : ''}\n${message ? `${t('htNote')} ${message}` : ''}`
      }

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
        setError(data.error || t('htOfferFailed'))
      }
    } catch (e) {
      setError(t('htGenericError'))
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
            <h2 className="font-bold text-lg">{t('htMakeOfferTitle')}</h2>
            <p className="text-emerald-100 text-sm truncate max-w-[250px]">{service.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          
          {/* Service info */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{service.title}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              👤 {service.user?.name || 'Anonim'} • 📍 {service.city} • 💰 {servicePrice} Valor
            </p>
            {service.wantDescription && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                {t('htWants')} {service.wantDescription}
              </p>
            )}
          </div>

          {/* Offer Type Selection */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              {t('htWhatAreYouOffering')}
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
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{t('htProduct')}</span>
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
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{t('htValor')}</span>
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
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{t('htMixed')}</span>
              </button>
            </div>
          </div>

          {/* Product Selection (product or mixed) */}
          {(offerType === 'product' || offerType === 'mixed') && (
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                {t('htSelectYourProduct')}
              </p>
              {loading ? (
                <p className="text-sm text-gray-400">{t('htLoadingProducts')}</p>
              ) : myProducts.length === 0 ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t('htNoActiveProducts')}
                  </p>
                  <Link href="/urun-ekle" className="text-xs text-yellow-600 underline mt-1 inline-block">
                    {t('htAddProduct')}
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

          {/* Valor Amount (valor or mixed) */}
          {(offerType === 'valor' || offerType === 'mixed') && (
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                {t('htValorAmount')}
              </p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={userBalance}
                  value={valorAmount || ''}
                  onChange={(e) => setValorAmount(Math.min(Number(e.target.value), userBalance))}
                  placeholder={t('htBalancePlaceholder').replace('{balance}', String(userBalance))}
                  className="w-full px-4 py-3 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  V
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('htYourBalance').replace('{balance}', userBalance.toLocaleString())}
              </p>
              {/* Quick selection */}
              <div className="flex gap-2 mt-2">
                {[
                  { label: '25%', value: Math.round(servicePrice * 0.25) },
                  { label: '50%', value: Math.round(servicePrice * 0.5) },
                  { label: '100%', value: servicePrice },
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setValorAmount(Math.min(opt.value, userBalance))}
                    className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    {opt.label} ({opt.value}V)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message / Note */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
              {t('htYourMessage')}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('htMessagePlaceholder')}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Offer Summary */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('htOfferSummary')}</p>
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
                <p className="text-gray-400 italic">{t('htNoOfferSelected')}</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400 font-bold">
                {t('htOfferSentSuccess')}
              </p>
            </div>
          )}

          {/* Submit Button */}
          {!success && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-base hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('htSending') : t('htSendOffer')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
