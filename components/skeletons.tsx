'use client'

export function MobileNavSkeleton() {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center justify-around px-4 md:hidden z-40">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-6 h-6 bg-gray-200 dark:bg-slate-600 rounded-full animate-pulse" />
          <div className="w-8 h-2 bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200 dark:bg-slate-700" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function HeaderSkeleton() {
  return (
    <div className="h-16 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <div className="w-24 h-8 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="flex gap-4">
          <div className="w-20 h-8 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="w-20 h-8 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    </div>
  )
}
