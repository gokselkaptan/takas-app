import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Sayfa Bulunamadı
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Link href="/"
          className="inline-block w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors text-center"
        >
          🏠 Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
