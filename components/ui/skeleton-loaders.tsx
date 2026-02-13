'use client'

import { motion } from 'framer-motion'

// Shimmer animation for skeletons
const shimmer = {
  initial: { x: '-100%' },
  animate: { x: '100%' },
  transition: { repeat: Infinity, duration: 1.5, ease: 'linear' }
}

// Base skeleton with shimmer effect
function SkeletonBase({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gray-200 rounded-lg ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        initial={shimmer.initial}
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
    </div>
  )
}

// Product Card Skeleton
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Image */}
      <SkeletonBase className="aspect-square" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category badge */}
        <SkeletonBase className="h-5 w-20 rounded-full" />
        
        {/* Title */}
        <SkeletonBase className="h-5 w-full" />
        <SkeletonBase className="h-5 w-3/4" />
        
        {/* Price and location */}
        <div className="flex items-center justify-between pt-2">
          <SkeletonBase className="h-6 w-24" />
          <SkeletonBase className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

// Product List Skeleton (horizontal)
export function ProductListSkeleton() {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100">
      {/* Image */}
      <SkeletonBase className="w-24 h-24 rounded-xl flex-shrink-0" />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-4 w-16 rounded-full" />
        <SkeletonBase className="h-5 w-full" />
        <SkeletonBase className="h-4 w-2/3" />
        <div className="flex items-center gap-4 pt-1">
          <SkeletonBase className="h-5 w-20" />
          <SkeletonBase className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

// Activity Feed Skeleton
export function ActivityFeedSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <SkeletonBase className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-4 w-3/4" />
        <SkeletonBase className="h-3 w-1/4" />
      </div>
    </div>
  )
}

// Profile Card Skeleton
export function ProfileCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center gap-4">
        <SkeletonBase className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="text-center space-y-2">
            <SkeletonBase className="h-8 w-12 mx-auto" />
            <SkeletonBase className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-3">
        <SkeletonBase className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <SkeletonBase className="h-6 w-16" />
          <SkeletonBase className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

// Category Chip Skeleton
export function CategoryChipSkeleton() {
  return <SkeletonBase className="h-9 w-24 rounded-full" />
}

// Message Skeleton
export function MessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`space-y-2 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <SkeletonBase className={`h-12 w-48 ${isOwn ? 'rounded-l-2xl rounded-tr-2xl' : 'rounded-r-2xl rounded-tl-2xl'}`} />
        <SkeletonBase className="h-3 w-12" />
      </div>
    </div>
  )
}

// Full Page Product Grid Skeleton
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Swap Request Skeleton
export function SwapRequestSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBase className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-4 w-24" />
          <SkeletonBase className="h-3 w-16" />
        </div>
        <SkeletonBase className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex gap-3">
        <SkeletonBase className="h-16 w-16 rounded-lg" />
        <SkeletonBase className="h-6 w-6" />
        <SkeletonBase className="h-16 w-16 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <SkeletonBase className="h-10 flex-1 rounded-lg" />
        <SkeletonBase className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  )
}
