'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Home, Package, MessageCircle, User, Sparkles, RefreshCw, Plus, Search, Heart, ArrowLeftRight, Eye, Menu, LogOut, Globe, Bell } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { useEffect, useState, useRef, useCallback } from 'react'

const navTexts = {
  tr: {
    home: 'Anasayfa',
    offers: 'Teklifler',
    messages: 'Mesajlar',
    profile: 'Profilim',
    forYou: 'Öneriler',
    addProduct: 'Ekle',
    search: 'Ara',
    favorites: 'Favorilerim',
  },
  en: {
    home: 'Home',
    offers: 'Offers',
    messages: 'Messages',
    profile: 'Profile',
    forYou: 'For You',
    addProduct: 'Add',
    search: 'Search',
    favorites: 'Favorites',
  },
  es: {
    home: 'Inicio',
    offers: 'Ofertas',
    messages: 'Mensajes',
    profile: 'Perfil',
    forYou: 'Para Ti',
    addProduct: 'Añadir',
    search: 'Buscar',
    favorites: 'Favoritos',
  },
  ca: {
    home: 'Inici',
    offers: 'Ofertes',
    messages: 'Missatges',
    profile: 'Perfil',
    forYou: 'Per a Tu',
    addProduct: 'Afegir',
    search: 'Cerca',
    favorites: 'Favorits',
  },
}

// TAKAS-A Logo Style Back Arrow (curved arc like logo)
function TakasABackArrow({ className = '' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mor yay ok - Logo stilinde (sola dönük) */}
      <path 
        d="M26 18 Q16 8, 6 14" 
        stroke="#8B5CF6" 
        strokeWidth="3" 
        strokeLinecap="round"
        fill="none"
      />
      {/* Ok ucu */}
      <path 
        d="M6 14 L10 12 M6 14 L9 18" 
        stroke="#8B5CF6" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Turuncu alt yay - Logo stilinde */}
      <path 
        d="M6 20 Q16 28, 26 22" 
        stroke="#F59E0B" 
        strokeWidth="2.5" 
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

// TAKAS-A Logo Style Forward Arrow (curved arc like logo)
function TakasAForwardArrow({ className = '' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mor yay ok - Logo stilinde (sağa dönük) */}
      <path 
        d="M6 18 Q16 8, 26 14" 
        stroke="#8B5CF6" 
        strokeWidth="3" 
        strokeLinecap="round"
        fill="none"
      />
      {/* Ok ucu */}
      <path 
        d="M26 14 L22 12 M26 14 L23 18" 
        stroke="#8B5CF6" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Turuncu alt yay - Logo stilinde */}
      <path 
        d="M26 20 Q16 28, 6 22" 
        stroke="#F59E0B" 
        strokeWidth="2.5" 
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

// Mobile Top Navigation with Back/Forward
export function MobileTopNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession() || {}
  const [canGoBack, setCanGoBack] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    // Check if we can navigate
    setCanGoBack(typeof window !== 'undefined' && window.history.length > 1)
  }, [pathname])

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

  // Close menu on route change
  useEffect(() => {
    setShowMobileMenu(false)
  }, [pathname])

  // Listen for close menu event
  useEffect(() => {
    const handleClose = () => setShowMobileMenu(false)
    window.addEventListener('closeMobileMenu', handleClose)
    return () => window.removeEventListener('closeMobileMenu', handleClose)
  }, [])

  const isHomePage = pathname === '/'
  const isAuthenticated = status === 'authenticated' && session

  const menuItems = [
    { label: 'Nasıl Çalışır?', href: '/nasil-calisir', icon: '📖' },
    { label: 'Ürünler', href: '/urunler', icon: '📦' },
    { label: '🌍 Global', href: '/global', icon: '🌍' },
    { label: 'Teslim Noktaları', href: '/teslim-noktalari', icon: '📍' },
    { label: 'Harita', href: '/harita', icon: '🗺️' },
    { label: 'Hakkımızda', href: '/hakkimizda', icon: '💜' },
    { label: 'SSS', href: '/sss', icon: '❓' },
    { label: 'İletişim', href: '/iletisim', icon: '📧' },
    { label: 'Kurumsal', href: '/kurumsal', icon: '🏢' },
  ]

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-700 safe-area-top">
        <div className="flex items-center justify-between px-4 h-12">
          {isHomePage ? (
            // Homepage: Show logo and quick action icons
            <>
              <span className="text-lg font-black">
                <span className="bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                  TAKAS
                </span>
                <span className="text-purple-700">-</span>
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  A
                </span>
              </span>
              <div className="flex items-center gap-0.5">
                {/* Ürün Ekle */}
                <Link
                  href={isAuthenticated ? '/urun-ekle' : '/giris'}
                  className="p-2 rounded-lg hover:bg-green-50 active:bg-green-100 text-emerald-600"
                  title="Ürün Ekle"
                >
                  <Plus className="w-6 h-6" />
                </Link>
                
                {/* Görsel Arama */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openVisualSearch'))}
                  className="p-2 rounded-lg hover:bg-indigo-50 active:bg-indigo-100 text-indigo-500"
                  title="Görsel Arama"
                >
                  <Eye className="w-6 h-6" />
                </button>
                
                {/* Bildirim Çanı - Sadece giriş yapmış kullanıcılara göster */}
                {isAuthenticated && (
                  <Link
                    href="/takaslarim"
                    className="relative p-2 rounded-lg hover:bg-orange-50 active:bg-orange-100 text-orange-500"
                    title="Takaslarım"
                  >
                    <Bell className="w-6 h-6" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </Link>
                )}
                
                {/* Profile Icon */}
                <Link
                  href={isAuthenticated ? '/profil' : '/giris'}
                  className="p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-600"
                  title={isAuthenticated ? 'Profilim' : 'Giriş Yap'}
                >
                  <User className="w-6 h-6" />
                </Link>

                {/* Hamburger Menu */}
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
                  title="Menü"
                  aria-label="Menü"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </>
          ) : (
            // Other pages: Show back button + page title + hamburger menu
            <>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-purple-50 active:bg-purple-100 transition-colors"
                aria-label="Geri"
              >
                <TakasABackArrow className="w-5 h-5" />
                <span className="text-sm font-medium text-purple-600">Geri</span>
              </button>
              
              <div className="flex-1 flex justify-center">
                <span className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[180px]">
                  {getPageTitle(pathname)}
                </span>
              </div>
              
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
                title="Menü"
                aria-label="Menü"
              >
                <Menu className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="md:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMobileMenu(false)}
        >
          <div 
            className="absolute top-12 right-0 w-64 bg-white dark:bg-slate-800 rounded-bl-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{item.label}</span>
                </Link>
              ))}
              
              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-slate-700 my-2" />
              
              {/* Auth Links */}
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false)
                      signOut({ callbackUrl: '/' })
                    }}
                    className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">Çıkış Yap</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/giris"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <span className="text-xl">🔑</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">Giriş Yap</span>
                  </Link>
                  <Link
                    href="/kayit"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <span className="text-xl">✨</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">Üye Ol</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/urunler': 'Ürünler',
    '/profil': 'Profilim',
    '/urun-ekle': 'Ürün Ekle',
    '/harita': 'Harita',
    '/teslim-noktalari': 'Teslim Noktaları',
    '/hakkimizda': 'Hakkımızda',
    '/iletisim': 'İletişim',
    '/nasil-calisir': 'Nasıl Çalışır',
    '/sss': 'SSS',
    '/barcelona': 'Barcelona',
    '/kurumsal': 'Kurumsal',
    '/takas-firsatlari': 'Takas Fırsatları',
    '/davet': 'Davet Et',
    '/giris': 'Giriş',
    '/kayit': 'Kayıt',
    '/global': 'Global',
    '/admin': 'Admin',
    '/ambassador': 'Elçi',
    '/favoriler': 'Favorilerim',
    '/mesajlar': 'Mesajlarım',
    '/takaslarim': 'Takaslarım',
    '/teklifler': 'Teklifler',
    '/sifremi-unuttum': 'Şifremi Unuttum',
  }
  
  if (pathname.startsWith('/urun/')) return 'Ürün Detayı'
  return titles[pathname] || 'TAKAS-A'
}

// Floating Action Button - Artık kullanılmıyor (Bottom Nav'a taşındı)
// Backward compatibility için boş export
export function FloatingActionButton() {
  return null
}

// Mobile Bottom Navigation
export function MobileBottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession() || {}
  const { language } = useLanguage()
  const texts = navTexts[language]
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingSwaps, setPendingSwaps] = useState(0)
  const [isPWAInstalling, setIsPWAInstalling] = useState(false)
  
  // Scroll yönüne göre nav gizleme
  const [isVisible, setIsVisible] = useState(true)
  const [forceHidden, setForceHidden] = useState(false) // Modal/chat açıkken zorla gizle
  const lastScrollY = useRef(0)
  const scrollThreshold = 10 // Minimum scroll miktarı

  // Modal veya chat açıldığında bottom nav'ı gizle
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleHideNav = () => setForceHidden(true)
    const handleShowNav = () => setForceHidden(false)
    
    window.addEventListener('hideBottomNav', handleHideNav)
    window.addEventListener('showBottomNav', handleShowNav)
    
    return () => {
      window.removeEventListener('hideBottomNav', handleHideNav)
      window.removeEventListener('showBottomNav', handleShowNav)
    }
  }, [])

  // Scroll event listener - aşağı kaydırınca gizle, yukarı kaydırınca göster
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleScroll = () => {
      // Force hidden durumunda scroll dinleme
      if (forceHidden) return
      
      const currentScrollY = window.scrollY
      const diff = currentScrollY - lastScrollY.current
      
      // Minimum threshold kontrolü
      if (Math.abs(diff) < scrollThreshold) return
      
      // Sayfa en üstündeyse her zaman göster
      if (currentScrollY < 50) {
        setIsVisible(true)
        lastScrollY.current = currentScrollY
        return
      }
      
      // Aşağı scroll -> gizle
      if (diff > 0 && isVisible) {
        setIsVisible(false)
      }
      // Yukarı scroll -> göster
      else if (diff < 0 && !isVisible) {
        setIsVisible(true)
      }
      
      lastScrollY.current = currentScrollY
    }
    
    // Passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isVisible, forceHidden])

  // PWA yükleme eventlerini dinle
  useEffect(() => {
    const handleInstallStarted = () => {
      setIsPWAInstalling(true)
    }
    
    const handleInstallEnded = () => {
      setIsPWAInstalling(false)
    }
    
    window.addEventListener('pwaInstallStarted', handleInstallStarted)
    window.addEventListener('pwaInstallEnded', handleInstallEnded)
    
    return () => {
      window.removeEventListener('pwaInstallStarted', handleInstallStarted)
      window.removeEventListener('pwaInstallEnded', handleInstallEnded)
    }
  }, [])

  // Bildirimleri 60 saniyede bir veya profil sayfasına gidince güncelle
  useEffect(() => {
    if (!session?.user?.email) return
    
    // İlk yükleme
    const timeout = setTimeout(fetchNotifications, 1000) // 1 saniye gecikme ile
    
    // Periyodik güncelleme - 60 saniyede bir
    const interval = setInterval(fetchNotifications, 60000)
    
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [session])
  
  // Profil sayfasına geçince hemen güncelle
  useEffect(() => {
    if (session?.user?.email && pathname.includes('/profil')) {
      fetchNotifications()
    }
  }, [pathname, session])

  const fetchNotifications = async () => {
    try {
      // Fetch unread messages count
      const msgRes = await fetch('/api/messages?unreadOnly=true')
      if (msgRes.ok) {
        const data = await msgRes.json()
        setUnreadCount(data.unreadCount || 0)
      }
      
      // Fetch pending swaps count
      const swapRes = await fetch('/api/swap-requests?status=pending')
      if (swapRes.ok) {
        const data = await swapRes.json()
        setPendingSwaps(data.requests?.length || 0)
      }
    } catch (err) {
      console.error('Notification fetch error:', err)
    }
  }

  // 5 item - Ara, Favorilerim, Anasayfa (ortada), Mesajlar, Takaslarım
  const navItems = [
    {
      id: 'search',
      label: texts.search,
      icon: Search,
      path: '/urunler',
      requiresAuth: false,
    },
    {
      id: 'favorites',
      label: texts.favorites,
      icon: Heart,
      path: '/favoriler',
      requiresAuth: true,
    },
    {
      id: 'home',
      label: texts.home,
      icon: Home,
      path: '/',
      requiresAuth: false,
      isCenter: true, // Ortada özel tasarım
    },
    {
      id: 'messages',
      label: texts.messages,
      icon: MessageCircle,
      path: '/mesajlar',
      requiresAuth: true,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      id: 'offers',
      label: texts.offers,
      icon: ArrowLeftRight,
      path: '/takaslarim',
      requiresAuth: true,
      badge: pendingSwaps > 0 ? pendingSwaps : null,
    },
  ]

  const handleNavClick = (item: typeof navItems[0]) => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30)
    }
    
    // Hamburger menüyü kapat (custom event)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeMobileMenu'))
    }
    
    if (item.requiresAuth && !session?.user) {
      router.push('/giris')
    } else {
      router.push(item.path)
    }
  }

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    if (path.includes('?')) {
      const basePath = path.split('?')[0]
      return pathname === basePath || pathname.startsWith(basePath)
    }
    return pathname === path || pathname.startsWith(path)
  }

  // PWA yüklemesi sırasında gizle
  if (isPWAInstalling) {
    return null
  }

  return (
    <>
      {/* Bottom Navigation Bar - TAKAS-A Turuncu */}
      <nav 
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[60] safe-area-bottom transition-transform duration-300 ease-out ${
          (isVisible && !forceHidden) ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
          boxShadow: isVisible ? '0 -4px 20px rgba(249, 115, 22, 0.3)' : 'none',
        }}
      >
        {/* Top highlight line */}
        <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        
        <div className="flex items-center justify-around h-[72px] px-1 pb-1">
          {navItems.map((item) => {
            const Icon = item.icon!
            const active = isActive(item.path)
            const isCenterItem = (item as any).isCenter === true
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full relative 
                  transition-all duration-200 rounded-xl mx-0.5
                  ${active
                    ? 'text-white'
                    : 'text-white/70 active:text-white active:bg-white/10'
                  }
                `}
              >
                {/* Active background glow - beyaz */}
                {active && !isCenterItem && (
                  <div 
                    className="absolute inset-1 rounded-xl bg-white/20"
                    style={{
                      boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.2)',
                    }}
                  />
                )}
                
                {/* Ortadaki Anasayfa için özel tasarım */}
                {isCenterItem ? (
                  <div className={`relative z-10 -mt-5 w-14 h-14 rounded-full flex items-center justify-center ${
                    active 
                      ? 'bg-white shadow-lg' 
                      : 'bg-white/90 shadow-md'
                  }`}
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 3px rgba(249, 115, 22, 0.5)',
                  }}
                  >
                    <Icon className={`w-7 h-7 ${active ? 'text-orange-600' : 'text-orange-500'}`} strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="relative z-10">
                    <Icon className={`w-6 h-6 transition-all ${active ? 'stroke-[2.5] scale-110' : 'stroke-[1.8]'}`} />
                    {item.badge && (
                      <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-white text-orange-600 text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
                
                <span className={`text-xs relative z-10 transition-all ${
                  isCenterItem ? 'mt-1' : 'mt-1.5'
                } ${
                  active ? 'font-bold text-white' : 'font-medium text-white/80'
                }`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

// Body scroll lock hook
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (isLocked) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
      document.body.style.width = '100%'
    } else {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.body.style.width = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }
    
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.body.style.width = ''
    }
  }, [isLocked])
}
