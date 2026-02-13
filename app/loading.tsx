export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950">
      <div className="relative w-20 h-20">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-orange-900" />
        {/* Animated spinner - using animate-spin from Tailwind */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-orange-400 animate-spin" />
        {/* Center logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
            T
          </span>
        </div>
      </div>
      <p className="mt-4 text-base font-medium text-gray-700 dark:text-gray-200">Yükleniyor...</p>
      {/* Simple progress indicator */}
      <div className="mt-3 w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full w-2/5 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-pulse" />
      </div>
    </div>
  )
}
