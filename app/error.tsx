'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Hatayı logla
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          Bir Sorun Oluştu
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Sayfa yüklenirken beklenmeyen bir hata oluştu. 
          Lütfen tekrar deneyin.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            🔄 Tekrar Dene
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            🏠 Ana Sayfaya Git
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-4">
          Hata devam ederse lütfen destek ekibiyle iletişime geçin.
        </p>
      </div>
    </div>
  )
}
