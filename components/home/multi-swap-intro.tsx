'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

export function MultiSwapIntro() {
  const { t } = useLanguage()
  
  return (
    <section className="py-16 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            🔄 {t('howMultiSwapWorks')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('multiSwapMainDesc')}
          </p>
        </div>

        {/* 3 Adım */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👆</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('step1Title')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('step1Desc')}
            </p>
          </div>
          
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('step2Title')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('step2Desc')}
            </p>
          </div>
          
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('step3Title')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('step3Desc')}
            </p>
          </div>
        </div>

        {/* Görsel Örnek */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white text-center mb-6">{t('exampleMultiSwap')}</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl min-w-[140px]">
              <span className="text-2xl">👩</span>
              <p className="font-bold text-gray-900 dark:text-white text-sm mt-1">Ayşe</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{t('givingBicycle')}</p>
            </div>
            <span className="text-2xl text-purple-500 rotate-90 md:rotate-0">➡️</span>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl min-w-[140px]">
              <span className="text-2xl">👨</span>
              <p className="font-bold text-gray-900 dark:text-white text-sm mt-1">Mehmet</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{t('givingPhone')}</p>
            </div>
            <span className="text-2xl text-purple-500 rotate-90 md:rotate-0">➡️</span>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl min-w-[140px]">
              <span className="text-2xl">👩‍🦰</span>
              <p className="font-bold text-gray-900 dark:text-white text-sm mt-1">Zeynep</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{t('givingLaptop')}</p>
            </div>
            <span className="text-2xl text-purple-500 rotate-90 md:rotate-0">🔄</span>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-300 dark:border-yellow-600">
              <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{t('cycle')}</p>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-500">Ayşe→Mehmet→Zeynep→Ayşe</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">{t('everyoneWins')}</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/takas-firsatlari"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            ⚡ {t('discoverSwapOpportunities')}
          </Link>
        </div>
      </div>
    </section>
  )
}
