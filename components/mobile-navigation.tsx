'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Home, Package, MessageCircle, User, Sparkles, RefreshCw, Plus, Search, Heart, Eye, Menu, LogOut, Globe, ArrowLeftRight, ChevronDown, Bell } from 'lucide-react'
import Link from 'next/link'
import { useLanguage, Language } from '@/lib/language-context'
import { useEffect, useState, useRef, useCallback } from 'react'
import { getCachedFetch } from '@/lib/fetch-cache'
import { setAppBadge } from '@/lib/app-badge'
import { NotificationCenter } from '@/components/notification-center'

// Dil seçenekleri
const languageNames: Record<Language, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  ca: 'Català'
}

const languageConfig: Record<Language, { flag: string; label: string; code: string; isSvg?: boolean }> = {
  tr: { flag: '🇹🇷', label: 'Türkçe', code: 'TR' },
  en: { flag: '🇬🇧', label: 'English', code: 'EN' },
  es: { flag: '🇪🇸', label: 'Español', code: 'ES' },
  ca: { flag: '/images/flags/ca.svg', label: 'Català', code: 'CA', isSvg: true }
}

const FlagIcon = ({ config, size = 'sm' }: { config: typeof languageConfig[Language]; size?: 'sm' | 'md' }) => {
  const cls = size === 'md' ? 'w-6 h-4' : 'w-5 h-3.5'
  if (config.isSvg) {
    return (
      <img src={config.flag} className={`${cls} object-contain rounded-sm`} alt={config.label} />
    )
  }
  if (config.flag.length <= 4 && !config.flag.startsWith('/')) {
    return <span className={size === 'md' ? 'text-base' : 'text-sm'}>{config.flag}</span>
  }
  return (
    <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 text-[10px] font-medium">
      {config.code}
    </span>
  )
}

const navTexts = {
  tr: {
    home: 'Anasayfa',
    offers: 'Sana Özel',
    messages: 'Mesajlar',
    profile: 'Profilim',
    forYou: 'Öneriler',
    addProduct: 'Ekle',
    search: 'Ara',
    favorites: 'Favorilerim',
    swaps: 'Takaslarım',
    products: 'Ürünler',
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
    swaps: 'My Swaps',
    products: 'Products',
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
    swaps: 'Intercambios',
    products: 'Productos',
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
    swaps: 'Intercanvis',
    products: 'Productes',
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
  const { data: session, status } = useSession()
  const { t, language, setLanguage } = useLanguage()
  const [canGoBack, setCanGoBack] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifUnreadCount, setNotifUnreadCount] = useState(0)
  
  // Okunmamış mesaj sayısını çek
  useEffect(() => {
    if (status !== 'authenticated') return
    
    const fetchUnread = async () => {
      try {
        const res = await getCachedFetch('/api/messages?unreadOnly=true')
        setUnreadCount(res?.unreadCount || 0)
      } catch {}
    }
    fetchUnread()
    // 30 saniyede bir güncelle
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    // Check if we can navigate
    setCanGoBack(typeof window !== 'undefined' && window.history.length > 1)
  }, [pathname])

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
    { label: t('mySwaps'), href: '/takaslarim', icon: '🔄', requiresAuth: true },
    { label: t('messages'), href: '/mesajlar', icon: '💬', requiresAuth: true, badge: unreadCount },
    { label: t('serviceSwap'), href: '/hizmet-takasi', icon: '🤝' },
    { label: t('wishBoard'), href: '/istek-panosu', icon: '📋' },
    { label: t('communities'), href: '/topluluk', icon: '👥' },
    { label: t('profile'), href: '/profil', icon: '👤', requiresAuth: true },
    { label: t('products'), href: '/urunler', icon: '📦' },
    { label: `🌍 ${t('exploreGlobal')}`, href: '/global', icon: '🌍' },
    { label: t('exploreHowItWorks'), href: '/nasil-calisir', icon: '📖' },
    { label: t('exploreFaq'), href: '/sss', icon: '❓' },
    { label: t('exploreContact'), href: '/iletisim', icon: '📧' },
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
                {/* Arama */}
                <button
                  onClick={() => router.push('/urunler')}
                  className="p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-500"
                  title="Ürün Ara"
                  aria-label="Ürün Ara"
                >
                  <Search className="w-5 h-5" />
                </button>
                
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
                
                {/* Bildirimler - Bell Icon */}
                {isAuthenticated && (
                  <button
                    onClick={() => setShowNotifications(prev => !prev)}
                    className="relative p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-500"
                    title={language === 'tr' ? 'Bildirimler' : language === 'es' ? 'Notificaciones' : language === 'ca' ? 'Notificacions' : 'Notifications'}
                    aria-label={language === 'tr' ? 'Bildirimler' : language === 'es' ? 'Notificaciones' : language === 'ca' ? 'Notificacions' : 'Notifications'}
                  >
                    <Bell className="w-5 h-5" />
                    {notifUnreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                        {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Mesajlar - GÖREV 31 */}
                <Link
                  href={isAuthenticated ? '/mesajlar' : '/giris'}
                  className="relative p-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 text-blue-500"
                  title={language === 'tr' ? 'Mesajlar' : 'Messages'}
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Hamburger Menu */}
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
                  title={language === 'tr' ? 'Menü' : 'Menu'}
                  aria-label={language === 'tr' ? 'Menü' : 'Menu'}
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
                aria-label={t('back')}
              >
                <TakasABackArrow className="w-5 h-5" />
                <span className="text-sm font-medium text-purple-600">{t('back')}</span>
              </button>
              
              <div className="flex-1 flex justify-center">
                <span className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[180px]">
                  {getPageTitle(pathname, language)}
                </span>
              </div>
              
              <div className="flex items-center gap-0.5">
                {/* Bildirimler - Bell Icon (tüm sayfalarda) */}
                {isAuthenticated && (
                  <button
                    onClick={() => setShowNotifications(prev => !prev)}
                    className="relative p-2 rounded-lg hover:bg-purple-50 active:bg-purple-100 text-purple-500"
                    title={language === 'tr' ? 'Bildirimler' : language === 'es' ? 'Notificaciones' : language === 'ca' ? 'Notificacions' : 'Notifications'}
                    aria-label={language === 'tr' ? 'Bildirimler' : language === 'es' ? 'Notificaciones' : language === 'ca' ? 'Notificacions' : 'Notifications'}
                  >
                    <Bell className="w-5 h-5" />
                    {notifUnreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                        {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
                  title={language === 'tr' ? 'Menü' : 'Menu'}
                  aria-label={language === 'tr' ? 'Menü' : 'Menu'}
                >
                  <Menu className="w-6 h-6" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notification Center Panel */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={(count) => setNotifUnreadCount(count)}
      />

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="md:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMobileMenu(false)}
        >
          <div 
            className="absolute top-12 right-0 w-64 max-h-[calc(100vh-60px)] bg-white dark:bg-slate-800 rounded-bl-2xl shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={(item as any).requiresAuth && !isAuthenticated ? '/giris' : item.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium flex-1">{item.label}</span>
                  {(item as any).badge > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1">
                      {(item as any).badge > 99 ? '99+' : (item as any).badge}
                    </span>
                  )}
                </Link>
              ))}
              
              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-slate-700 my-2" />
              
              {/* Dil Seçici */}
              <div className="px-4 py-2">
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-purple-50 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-slate-600 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <FlagIcon config={languageConfig[language]} size="sm" />
                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                      {languageNames[language]}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-purple-600 dark:text-purple-400 transition-transform ${showLanguageMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showLanguageMenu && (
                  <div className="mt-2 space-y-1">
                    {(Object.keys(languageNames) as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang)
                          setShowLanguageMenu(false)
                        }}
                        className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          language === lang 
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                            : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                        }`}
                      >
                        <FlagIcon config={languageConfig[lang]} size="md" />
                        <span>{languageNames[lang]}</span>
                        {language === lang && <span className="ml-auto text-purple-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
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
                    <span className="text-red-600 dark:text-red-400 font-medium">{language === 'tr' ? 'Çıkış Yap' : language === 'en' ? 'Log Out' : language === 'es' ? 'Cerrar Sesión' : 'Tancar Sessió'}</span>
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
                    <span className="text-gray-700 dark:text-gray-200 font-medium">{t('login')}</span>
                  </Link>
                  <Link
                    href="/kayit"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <span className="text-xl">✨</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">{t('register')}</span>
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

function getPageTitle(pathname: string, language: string = 'tr'): string {
  const titles: Record<string, Record<string, string>> = {
    '/urunler': { tr: 'Ürünler', en: 'Products', es: 'Productos', ca: 'Productes' },
    '/profil': { tr: 'Profilim', en: 'My Profile', es: 'Mi Perfil', ca: 'El Meu Perfil' },
    '/urun-ekle': { tr: 'Ürün Ekle', en: 'Add Product', es: 'Añadir Producto', ca: 'Afegir Producte' },
    '/harita': { tr: 'Harita', en: 'Map', es: 'Mapa', ca: 'Mapa' },
    '/teslim-noktalari': { tr: 'Teslim Noktaları', en: 'Delivery Points', es: 'Puntos de Entrega', ca: 'Punts de Lliurament' },
    '/hakkimizda': { tr: 'Hakkımızda', en: 'About Us', es: 'Sobre Nosotros', ca: 'Sobre Nosaltres' },
    '/iletisim': { tr: 'İletişim', en: 'Contact', es: 'Contacto', ca: 'Contacte' },
    '/nasil-calisir': { tr: 'Nasıl Çalışır', en: 'How It Works', es: 'Cómo Funciona', ca: 'Com Funciona' },
    '/sss': { tr: 'SSS', en: 'FAQ', es: 'FAQ', ca: 'FAQ' },
    '/barcelona': { tr: 'Barcelona', en: 'Barcelona', es: 'Barcelona', ca: 'Barcelona' },
    '/kurumsal': { tr: 'Kurumsal', en: 'Business', es: 'Empresas', ca: 'Empreses' },
    '/takas-firsatlari': { tr: 'Takas Fırsatları', en: 'Swap Opportunities', es: 'Oportunidades de Intercambio', ca: 'Oportunitats d\'Intercanvi' },
    '/davet': { tr: 'Davet Et', en: 'Invite Friends', es: 'Invitar Amigos', ca: 'Convidar Amics' },
    '/giris': { tr: 'Giriş', en: 'Login', es: 'Iniciar Sesión', ca: 'Iniciar Sessió' },
    '/kayit': { tr: 'Kayıt', en: 'Register', es: 'Registrarse', ca: 'Registrar-se' },
    '/global': { tr: 'Global', en: 'Global', es: 'Global', ca: 'Global' },
    '/admin': { tr: 'Admin', en: 'Admin', es: 'Admin', ca: 'Admin' },
    '/ambassador': { tr: 'Elçi', en: 'Ambassador', es: 'Embajador', ca: 'Ambaixador' },
    '/favoriler': { tr: 'Favorilerim', en: 'My Favorites', es: 'Mis Favoritos', ca: 'Els Meus Favorits' },
    '/mesajlar': { tr: 'Mesajlarım', en: 'My Messages', es: 'Mis Mensajes', ca: 'Els Meus Missatges' },
    '/takaslarim': { tr: 'Takaslarım', en: 'My Swaps', es: 'Mis Intercambios', ca: 'Els Meus Intercanvis' },
    '/teklifler': { tr: 'Teklifler', en: 'Offers', es: 'Ofertas', ca: 'Ofertes' },
    '/sifremi-unuttum': { tr: 'Şifremi Unuttum', en: 'Forgot Password', es: 'Olvidé mi Contraseña', ca: 'He Oblidat la Contrasenya' },
    '/hizmet-takasi': { tr: 'Hizmet Takası', en: 'Service Swap', es: 'Intercambio de Servicios', ca: 'Intercanvi de Serveis' },
    '/istek-panosu': { tr: 'İstek Panosu', en: 'Wish Board', es: 'Tablón de Deseos', ca: 'Tauler de Desitjos' },
    '/topluluk': { tr: 'Topluluk', en: 'Community', es: 'Comunidad', ca: 'Comunitat' },
    '/topluluklar': { tr: 'Topluluklar', en: 'Communities', es: 'Comunidades', ca: 'Comunitats' },
    '/premium': { tr: 'Premium', en: 'Premium', es: 'Premium', ca: 'Premium' },
  }
  
  if (pathname.startsWith('/urun/')) {
    const productDetail = { tr: 'Ürün Detayı', en: 'Product Details', es: 'Detalles del Producto', ca: 'Detalls del Producte' }
    return productDetail[language as keyof typeof productDetail] || productDetail.tr
  }
  
  const titleObj = titles[pathname]
  if (titleObj) {
    return titleObj[language as keyof typeof titleObj] || titleObj.tr
  }
  return 'TAKAS-A'
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
  const { data: session } = useSession()
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

  // Pending swap offers for badge
  const [pendingSwapOffers, setPendingSwapOffers] = useState(0)

  // Bildirimleri 90 saniyede bir veya profil sayfasına gidince güncelle
  useEffect(() => {
    if (!session?.user?.email) return
    
    // İlk yükleme - 3 saniye gecikmeyle (header ile çakışmayı önle)
    const timeout = setTimeout(fetchNotifications, 3000)
    
    // Periyodik güncelleme - 90 saniyede bir (header ile senkronize)
    const interval = setInterval(fetchNotifications, 90000)
    
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
      // Paralel fetch with deduplication cache
      const [msgData, swapData, offersData] = await Promise.all([
        getCachedFetch('/api/messages?unreadOnly=true').catch(() => ({})),
        getCachedFetch('/api/swap-requests?status=pending').catch(() => ({})),
        getCachedFetch('/api/swap-requests?status=pending&role=owner&count=true').catch(() => ({}))
      ])
      
      const unreadMessages = msgData?.unreadCount || 0
      const pendingSwapsCount = swapData?.requests?.length || 0
      const pendingOffersCount = offersData?.count || 0
      
      setUnreadCount(unreadMessages)
      setPendingSwaps(pendingSwapsCount)
      setPendingSwapOffers(pendingOffersCount)
      
      // PWA App Badge'i güncelle - sadece gerçek bildirim varsa
      const totalBadge = unreadMessages + pendingSwapsCount + pendingOffersCount
      setAppBadge(totalBadge) // 0 ise otomatik temizlenir
    } catch (err) {
      console.error('Notification fetch error:', err)
    }
  }

  // 5 item - Favoriler, Takas Merkezi, Anasayfa (ortada), Öneriler, Profil
  // GÖREV 30: Öneriler geri eklendi, Mesajlar üst bara taşındı
  const navItems = [
    {
      id: 'favorites',
      label: texts.favorites,
      icon: Heart,
      path: '/favoriler',
      requiresAuth: true,
    },
    {
      id: 'takas',
      label: language === 'tr' ? 'Takas Merkezi' 
        : language === 'es' ? 'Centro de Intercambio'
        : language === 'ca' ? 'Centre d\'Intercanvi'
        : 'Swap Center',
      icon: ArrowLeftRight,
      path: '/takas-firsatlari',
      requiresAuth: true,
      badge: pendingSwapOffers > 0 ? pendingSwapOffers : null,
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
      id: 'foryou',
      label: texts.forYou,
      icon: Sparkles,
      path: '/oneriler',
      requiresAuth: true,
    },
    {
      id: 'profile',
      label: texts.profile,
      icon: User,
      path: '/profil',
      requiresAuth: true,
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
