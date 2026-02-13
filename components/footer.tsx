'use client'

import Link from 'next/link'
import { MapPin, Mail, Phone, LogIn, LogOut, UserPlus } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { useSession, signOut } from 'next-auth/react'

export function Footer() {
  const { t } = useLanguage()
  const { data: session, status } = useSession() || {}
  const isAuthenticated = status === 'authenticated' && session
  
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="text-2xl font-bold text-gradient-frozen mb-4">TAKAS-A</div>
            <p className="text-gray-400 mb-4 max-w-md">
              {t('footerDesc')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-frozen-400">{t('quickLinks')}</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/nasil-calisir" className="text-gray-400 hover:text-white transition-colors">
                {t('howItWorks')}
              </Link>
              <Link href="/urunler" className="text-gray-400 hover:text-white transition-colors">
                {t('products')}
              </Link>
              <Link href="/harita" className="text-gray-400 hover:text-white transition-colors">
                {t('map')}
              </Link>
              <Link href="/teslim-noktalari" className="text-gray-400 hover:text-white transition-colors">
                {t('deliveryPoints')}
              </Link>
              <Link href="/hakkimizda" className="text-gray-400 hover:text-white transition-colors">
                {t('about')}
              </Link>
              <Link href="/iletisim" className="text-gray-400 hover:text-white transition-colors">
                {t('contact')}
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-frozen-400">{t('contactInfo')}</h3>
            <div className="flex flex-col gap-3 text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-frozen-400" />
                <span>İzmir, Türkiye</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-frozen-400" />
                <a href="mailto:join@takas-a.com" className="hover:text-white transition-colors">join@takas-a.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-frozen-400" />
                <span>+90 232 XXX XX XX</span>
              </div>
            </div>
            
            {/* Login/Logout & Register */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex flex-col gap-3">
                {isAuthenticated ? (
                  <button 
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    Çıkış Yap
                  </button>
                ) : (
                  <Link 
                    href="/giris" 
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-medium"
                  >
                    <LogIn className="w-5 h-5 text-frozen-400" />
                    {t('login')}
                  </Link>
                )}
                <Link 
                  href="/kayit" 
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-medium"
                >
                  <UserPlus className="w-5 h-5 text-frozen-400" />
                  {t('register')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>© 2026 TAKAS-A. {t('allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  )
}
