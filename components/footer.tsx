'use client'

import Link from 'next/link'
import { MapPin, Mail, Phone, LogIn, LogOut, UserPlus, Instagram } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { useSession, signOut } from 'next-auth/react'

export function Footer() {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session
  
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="text-2xl font-bold text-gradient-frozen mb-4">TAKAS-A</div>
            <p className="text-gray-300 mb-4 max-w-md">
              {t('footerDesc')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-frozen-400">{t('quickLinks')}</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/nasil-calisir" className="text-gray-300 hover:text-white transition-colors">
                {t('howItWorks')}
              </Link>
              <Link href="/urunler" className="text-gray-300 hover:text-white transition-colors">
                {t('products')}
              </Link>
              <Link href="/premium" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                👑 Premium
              </Link>
              <Link href="/hakkimizda" className="text-gray-300 hover:text-white transition-colors">
                {t('about')}
              </Link>
              <Link href="/iletisim" className="text-gray-300 hover:text-white transition-colors">
                {t('contact')}
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-frozen-400">{t('contactInfo')}</h3>
            <div className="flex flex-col gap-3 text-gray-300">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-frozen-400" />
                <span>İzmir, Türkiye</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-frozen-400" />
                <a href="mailto:join@takas-a.com" className="hover:text-white transition-colors">join@takas-a.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                <a href="mailto:social-media@takas-a.com" className="hover:text-white transition-colors">social-media@takas-a.com</a>
              </div>
              <a 
                href="https://instagram.com/takasabarty" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Instagram className="w-4 h-4 text-pink-400" />
                <span>@takasabarty</span>
              </a>
              <a 
                href="https://www.facebook.com/profile.php?id=61588631287931" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-400">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Facebook</span>
              </a>
              
              {/* Test Phase Warning - 4 Languages */}
              <div className="mt-4 pt-3 border-t border-gray-700 text-center">
                <p className="text-xs text-gray-300">🇹🇷 ⚠️ Bu platform henüz test aşamasındadır ve herhangi bir ticari faaliyet içermemektedir.</p>
                <p className="text-xs text-gray-300">🇬🇧 ⚠️ This platform is currently in the testing phase and does not involve any commercial activity.</p>
                <p className="text-xs text-gray-300">🇪🇸 ⚠️ Esta plataforma se encuentra en fase de pruebas y no implica ninguna actividad comercial.</p>
                <p className="text-xs text-gray-300">🏳️ ⚠️ Aquesta plataforma es troba en fase de proves i no implica cap activitat comercial.</p>
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
        <div className="border-t border-gray-800 mt-8 pt-8 text-gray-300 text-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 TAKAS-A. {t('allRightsReserved')}</p>
            <div className="flex items-center gap-4">
              <Link href="/gizlilik" className="hover:text-white transition-colors">
                Gizlilik Politikası
              </Link>
              <Link href="/kullanim-kosullari" className="hover:text-white transition-colors">
                Kullanım Koşulları
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
