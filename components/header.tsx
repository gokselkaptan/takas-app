'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, User, LogOut, Package, Plus, UserPlus, Shield, Search, ArrowLeftRight, Moon, Sun, Eye, Bell, Tag, Gift, ShoppingBag, MessageSquare, RefreshCw, Check, XCircle, Clock, Briefcase, Users, Sparkles } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/lib/language-context'
import { Language } from '@/lib/translations'
import { SoundToggle } from '@/components/sound-settings'

const languageNames: Record<Language, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  ca: 'Català'
}

const languageFlags: Record<Language, { flag: string; code: string }> = {
  tr: { flag: '/images/flags/tr.svg', code: 'TR' },
  en: { flag: '/images/flags/gb.svg', code: 'EN' },
  es: { flag: '/images/flags/es.svg', code: 'ES' },
  ca: { flag: '/images/flags/ca.svg', code: 'CA' }
}

interface Notification {
  id: string
  type: 'offer' | 'campaign' | 'swap' | 'comment' | 'system'
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
  swapId?: string
}

interface SwapRequest {
  id: string
  status: string
  offeredValor: number
  createdAt: string
  product: { id: string; title: string; images: string[] }
  requester: { id: string; name: string }
  productOwner: { id: string; name: string }
  requesterId: string
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
  const [isExploreOpen, setIsExploreOpen] = useState(false)
  const exploreRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notificationTab, setNotificationTab] = useState<'notifications' | 'offers' | 'swaps' | 'multi'>('notifications')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [multiSwaps, setMultiSwaps] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch notification count
  useEffect(() => {
    if (status !== 'authenticated') return
    
    const fetchNotifications = async () => {
      try {
        const [msgRes, swapRes] = await Promise.all([
          fetch('/api/messages?unreadOnly=true'),
          fetch('/api/swap-requests?status=pending')
        ])
        
        const msgData = msgRes.ok ? await msgRes.json() : {}
        const swapData = swapRes.ok ? await swapRes.json() : {}
        
        const unreadMessages = msgData.unreadCount || 0
        const pendingSwaps = Array.isArray(swapData) ? swapData.filter((s: any) => s.status === 'pending').length : 0
        
        setNotificationCount(unreadMessages + pendingSwaps)
      } catch (error) {
        console.error('Notification fetch error:', error)
      }
    }
    
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
      if (exploreRef.current && !exploreRef.current.contains(event.target as Node)) {
        setIsExploreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch notifications and swap requests when dropdown opens
  const fetchNotificationData = async () => {
    if (status !== 'authenticated') return
    setLoadingNotifications(true)
    try {
      const [swapRes, multiRes] = await Promise.all([
        fetch('/api/swap-requests'),
        fetch('/api/multi-swap?type=active')
      ])
      
      const swapData = swapRes.ok ? await swapRes.json() : []
      const multiData = multiRes.ok ? await multiRes.json() : []
      
      setSwapRequests(Array.isArray(swapData) ? swapData : [])
      setMultiSwaps(Array.isArray(multiData) ? multiData : [])
      
      // Generate notifications from swap requests
      const notifs: Notification[] = []
      const userId = (session as any)?.user?.id
      
      if (Array.isArray(swapData)) {
        swapData.forEach((swap: SwapRequest) => {
          if (swap.status === 'accepted' && swap.requesterId === userId) {
            notifs.push({
              id: `swap-accepted-${swap.id}`,
              type: 'swap',
              title: 'Teklif Kabul Edildi! 🎉',
              message: `"${swap.product.title}" için teklifiniz kabul edildi`,
              read: false,
              createdAt: swap.createdAt,
              link: `/urun/${swap.product.id}`,
              swapId: swap.id
            })
          } else if (swap.status === 'pending' && swap.productOwner?.id === userId) {
            notifs.push({
              id: `swap-pending-${swap.id}`,
              type: 'offer',
              title: 'Yeni Takas Teklifi',
              message: `"${swap.product.title}" için ${swap.offeredValor} Valor teklif edildi`,
              read: false,
              createdAt: swap.createdAt,
              link: `/urun/${swap.product.id}`,
              swapId: swap.id
            })
          }
        })
      }
      
      // Add multi-swap notifications
      if (Array.isArray(multiData)) {
        multiData.forEach((multi: any) => {
          if (multi.status === 'pending' && !multi.isInitiator) {
            notifs.push({
              id: `multi-swap-${multi.id}`,
              type: 'swap',
              title: 'Çoklu Takas Daveti! 🔄',
              message: `${multi.participants?.length || 2} kişilik çoklu takas fırsatı`,
              read: false,
              createdAt: multi.createdAt,
              link: `/takaslarim?multi=${multi.id}`,
            })
          }
        })
      }
      setNotifications(notifs)
    } catch (error) {
      console.error('Error fetching notification data:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    if (isNotificationOpen) {
      fetchNotificationData()
    }
  }, [isNotificationOpen, status])

  const handleSwapAction = async (swapId: string, action: 'accepted' | 'rejected') => {
    try {
      const res = await fetch('/api/swap-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, status: action })
      })
      if (res.ok) {
        fetchNotificationData()
        // Refresh notification count
        const [msgRes, swapRes] = await Promise.all([
          fetch('/api/messages?unreadOnly=true'),
          fetch('/api/swap-requests?status=pending')
        ])
        const msgData = msgRes.ok ? await msgRes.json() : {}
        const swapData = swapRes.ok ? await swapRes.json() : {}
        const unreadMessages = msgData.unreadCount || 0
        const pendingSwaps = Array.isArray(swapData) ? swapData.filter((s: any) => s.status === 'pending').length : 0
        setNotificationCount(unreadMessages + pendingSwaps)
      }
    } catch (error) {
      console.error('Error updating swap:', error)
    }
  }

  // Bottom nav'dan gelen menü kapatma eventi
  useEffect(() => {
    const handleCloseMobileMenu = () => {
      setIsMenuOpen(false)
    }
    window.addEventListener('closeMobileMenu', handleCloseMobileMenu)
    return () => window.removeEventListener('closeMobileMenu', handleCloseMobileMenu)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/urunler?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/urunler', label: t('products') },
    { href: '/hizmet-takasi', label: t('serviceSwap') },
    { href: '/istek-panosu', label: t('wishBoard') },
    { href: '/takas-firsatlari', label: '🔄 Takas Merkezi' },
  ]

  const exploreLinks = [
    { href: '/topluluklar', label: `👥 ${t('communities')}` },
    { href: '/global', label: `🌍 ${t('exploreGlobal')}` },
    { href: '/kurumsal', label: `🏢 ${t('exploreCorporate')}` },
    { href: '/premium', label: `👑 ${t('explorePremium')}`, highlight: true },
    { href: '/nasil-calisir', label: `📖 ${t('exploreHowItWorks')}` },
    { href: '/sss', label: `❓ ${t('exploreFaq')}` },
    { href: '/iletisim', label: `📧 ${t('exploreContact')}` },
  ]

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setIsLangMenuOpen(false)
  }

  return (
    <header
      className={`fixed w-full top-0 z-50 transition-all duration-300 hidden md:block ${
        isScrolled 
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg dark:shadow-slate-900/50' 
          : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo + Search Bar */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                  TAKAS
                </span>
                <span className="text-purple-700">-</span>
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  A
                </span>
              </span>
            </Link>
            
            {/* Search Bar - Desktop */}
            <form onSubmit={handleSearch} className="hidden lg:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchProducts')}
                  className="w-48 xl:w-64 pl-10 pr-4 py-2 rounded-xl border-2 border-purple-200 dark:border-slate-600 bg-purple-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:border-purple-400 dark:focus:border-purple-500 focus:outline-none transition-all text-sm text-gray-700 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 dark:text-purple-300" />
              </div>
            </form>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg font-medium transition-all text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50"
              >
                {link.label}
              </Link>
            ))}

            {/* Keşfet Dropdown */}
            <div className="relative" ref={exploreRef}>
              <button 
                onClick={() => setIsExploreOpen(!isExploreOpen)}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-200 hover:text-purple-600 dark:hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                🧭 {t('explore')}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExploreOpen ? 'rotate-180' : ''}`} />
              </button>
              {isExploreOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 py-2 z-50">
                  {exploreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsExploreOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right Side */}
          <div className="hidden xl:flex items-center gap-3">
            {/* Language Switcher Dropdown with Flags */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-slate-600 transition-all text-sm font-bold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-slate-600"
              >
                <div className="w-6 h-4 relative overflow-hidden rounded-sm shadow-sm">
                  <Image 
                    src={languageFlags[language].flag} 
                    alt={language} 
                    fill 
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <span>{languageFlags[language].code}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-purple-100 dark:border-slate-700 py-2 z-50">
                  {(Object.keys(languageNames) as Language[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      aria-label={`${languageNames[lang]} dilini seç`}
                      onClick={() => handleLanguageChange(lang)}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-slate-700 text-sm font-medium transition-all ${
                        language === lang ? 'bg-purple-100 dark:bg-slate-700 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="w-7 h-5 relative overflow-hidden rounded shadow-sm border dark:border-slate-600">
                        <Image 
                          src={languageFlags[lang].flag} 
                          alt={lang} 
                          fill 
                          className="object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <span>{languageNames[lang]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Notification Bell kaldırıldı - Bildirimler profil sayfasında */}

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl bg-purple-50 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-slate-600 transition-all border border-purple-200 dark:border-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={resolvedTheme === 'dark' ? 'Açık moda geç' : 'Karanlık moda geç'}
            >
              {mounted && (
                resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5 text-purple-600" />
                )
              )}
            </button>

            {/* Ses Toggle */}
            <SoundToggle />

            {status === 'authenticated' && session ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-frozen-50 dark:bg-gray-700 hover:bg-frozen-100 dark:hover:bg-gray-600 transition-all"
                >
                  <User className="w-4 h-4 text-frozen-600 dark:text-white" />
                  <span className="text-sm font-medium text-frozen-700 dark:text-white">{session.user?.name || 'Kullanıcı'}</span>
                  <ChevronDown className="w-4 h-4 text-frozen-600 dark:text-white" />
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border dark:border-gray-700 overflow-hidden z-50">
                    
                    {/* Kullanıcı Bilgisi */}
                    <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b dark:border-gray-700">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {(session as any)?.user?.name || 'Kullanıcı'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {(session as any)?.user?.email}
                      </p>
                    </div>

                    {/* Grup 1: Ana İşlemler */}
                    <div className="p-2">
                      <p className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Ana İşlemler
                      </p>
                      <Link href="/profil" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <User className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Profilim</span>
                      </Link>
                      <Link href="/profil?tab=messages" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">💬 Mesajlar</span>
                        {notificationCount > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {notificationCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/profil?tab=products" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <Package className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Ürünlerim</span>
                      </Link>
                    </div>

                    <hr className="mx-2 dark:border-gray-700" />

                    {/* Grup 2: Keşfet */}
                    <div className="p-2">
                      <p className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {t('explore')}
                      </p>
                      <Link href="/urun-ekle" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <Plus className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">{t('addProduct')}</span>
                      </Link>
                      <Link href="/takas-firsatlari" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">🔄 Takas Merkezi</span>
                      </Link>
                      <Link href="/davet" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <UserPlus className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">{t('inviteFriends')}</span>
                      </Link>
                    </div>

                    <hr className="mx-2 dark:border-gray-700" />

                    {/* Grup 3: Premium + Admin */}
                    <div className="p-2">
                      <Link href="/premium" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-yellow-50 dark:hover:bg-yellow-900/10 text-gray-700 dark:text-gray-200 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                        <span className="text-base">👑</span>
                        <span className="text-sm font-medium">Premium</span>
                      </Link>
                      {(session as any)?.user?.role === 'admin' && (
                        <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 text-orange-600 dark:text-orange-400 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-medium">Admin Panel</span>
                        </Link>
                      )}
                    </div>

                    <hr className="mx-2 dark:border-gray-700" />

                    {/* Çıkış */}
                    <div className="p-2">
                      <button
                        onClick={() => { setIsUserMenuOpen(false); signOut() }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 w-full text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Çıkış Yap</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : status === 'loading' ? (
              <div className="px-4 py-2 text-gray-400 text-sm">Yükleniyor...</div>
            ) : (
              <>
                <Link
                  href="/giris"
                  className="px-4 py-2 text-frozen-600 font-semibold hover:text-frozen-700 transition-colors text-sm"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/kayit"
                  className="px-4 py-2 rounded-xl gradient-frozen text-white font-semibold hover:opacity-90 transition-all text-sm"
                >
                  {t('register')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button + Quick Actions */}
          <div className="xl:hidden flex items-center gap-0.5">
            {/* Ürün Ekle - Mobile */}
            <Link
              href={status === 'authenticated' ? '/urun-ekle' : '/giris'}
              className="p-2 rounded-lg hover:bg-green-50 active:bg-green-100 text-emerald-600"
              title="Ürün Ekle"
            >
              <Plus className="w-6 h-6" />
            </Link>
            
            {/* Görsel Arama - Mobile */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openVisualSearch'))}
              className="p-2 rounded-lg hover:bg-indigo-50 active:bg-indigo-100 text-indigo-500"
              title="Görsel Arama"
            >
              <Eye className="w-6 h-6" />
            </button>
            
            {/* Profile Icon - Mobile */}
            {status === 'authenticated' && session ? (
              <Link
                href="/profil"
                className="p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-600"
                title="Profilim"
              >
                <User className="w-6 h-6" />
              </Link>
            ) : (
              <Link
                href="/giris"
                className="p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-600"
                title="Giriş Yap"
              >
                <User className="w-6 h-6" />
              </Link>
            )}
            
            {/* Hamburger Menu */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-800"
            >
              {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="xl:hidden py-4 border-t border-purple-100 max-h-[80vh] overflow-y-auto">
            <nav className="flex flex-col gap-1">
              {/* Mobile Search Bar */}
              <form onSubmit={(e) => { handleSearch(e); setIsMenuOpen(false); }} className="px-4 py-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchProducts')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-purple-200 bg-purple-50/50 focus:bg-white focus:border-purple-400 focus:outline-none transition-all text-base text-gray-700 placeholder-gray-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                </div>
              </form>
              
              {/* User Section - Moved to top for better accessibility */}
              <hr className="my-2 border-purple-100" />
              {status === 'loading' ? (
                <div className="px-4 py-3 text-gray-400 text-center">Yükleniyor...</div>
              ) : status === 'authenticated' && session ? (
                <div className="bg-frozen-50/50 rounded-lg mx-2 py-2">
                  <Link href="/profil" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-frozen-100 text-frozen-600 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <User className="w-5 h-5" />
                    Profilim
                  </Link>
                  <Link href="/profil?tab=messages" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-blue-100 text-blue-600 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <MessageSquare className="w-5 h-5" />
                    💬 Mesajlar
                  </Link>
                  <Link href="/profil?tab=products" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-frozen-100 text-frozen-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <Package className="w-5 h-5" />
                    {t('myProducts')}
                  </Link>
                  <Link href="/urun-ekle" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-frozen-100 text-frozen-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <Plus className="w-5 h-5" />
                    {t('addProduct')}
                  </Link>
                  <Link href="/takas-firsatlari" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-blue-100 text-blue-600 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <ArrowLeftRight className="w-5 h-5" />
                    🔄 Takas Merkezi
                  </Link>
                  <Link href="/davet" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-purple-100 text-purple-600 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <UserPlus className="w-5 h-5" />
                    {t('inviteFriends')}
                  </Link>
                  <Link href="/istek-panosu" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-yellow-100 text-yellow-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <Tag className="w-5 h-5" />
                    🎯 {t('wishBoard')}
                  </Link>
                  <Link href="/hizmet-takasi" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-emerald-100 text-emerald-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <ArrowLeftRight className="w-5 h-5" />
                    🤝 {t('serviceSwap')}
                  </Link>
                  <Link href="/topluluk" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-cyan-100 text-cyan-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <MessageSquare className="w-5 h-5" />
                    👥 {t('communities')}
                  </Link>
                  <Link href="/topluluklar" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-indigo-100 text-indigo-700 font-bold" onClick={() => setIsMenuOpen(false)}>
                    <User className="w-5 h-5" />
                    🏘️ {t('communities')}
                  </Link>
                  {(session as any)?.user?.role === 'admin' && (
                    <Link href="/admin" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-orange-100 text-orange-600 font-bold" onClick={() => setIsMenuOpen(false)}>
                      <Shield className="w-5 h-5" />
                      {language === 'tr' ? 'Admin Panel' : 'Admin Panel'}
                    </Link>
                  )}
                  <button 
                    onClick={() => { setIsMenuOpen(false); signOut(); }} 
                    className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-red-100 text-red-600 font-bold text-left w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 px-4 py-2">
                  <Link href="/giris" className="flex-1 px-4 py-3 rounded-xl border-2 border-purple-300 text-purple-600 font-bold text-center" onClick={() => setIsMenuOpen(false)}>
                    {t('login')}
                  </Link>
                  <Link href="/kayit" className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold text-center" onClick={() => setIsMenuOpen(false)}>
                    {t('register')}
                  </Link>
                </div>
              )}
              
              <hr className="my-2 border-purple-100" />
              
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg hover:bg-purple-50 text-purple-800 font-bold text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="my-3 border-purple-100" />
              
              {/* Mobile Language Selector */}
              <div className="px-4 py-2">
                <p className="text-sm text-purple-600 mb-3 font-semibold">{t('language' as any) || 'Language'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(languageNames) as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang)
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        language === lang 
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
                          : 'bg-gray-100 text-gray-700 hover:bg-purple-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="w-6 h-4 relative overflow-hidden rounded-sm shadow-sm border">
                        <Image 
                          src={languageFlags[lang].flag} 
                          alt={lang} 
                          fill 
                          className="object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <span>{languageNames[lang]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}