import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { HeroSection } from '@/components/home/hero-section'

// Critical: Load immediately
const ProductsShowcase = dynamic(
  () => import('@/components/home/products-showcase').then(mod => ({ default: mod.ProductsShowcase })),
  { 
    loading: () => <ProductsSkeletonLoader />,
    ssr: true 
  }
)

// Non-critical: Load when scrolled into view
const LiveActivityFeed = dynamic(
  () => import('@/components/home/live-activity-feed').then(mod => ({ default: mod.LiveActivityFeed })),
  { 
    loading: () => <ActivitySkeletonLoader />,
    ssr: false 
  }
)

const MiniDashboard = dynamic(
  () => import('@/components/home/mini-dashboard').then(mod => ({ default: mod.MiniDashboard })),
  { 
    loading: () => <DashboardSkeletonLoader />,
    ssr: false 
  }
)

const StatsSection = dynamic(
  () => import('@/components/home/stats-section').then(mod => ({ default: mod.StatsSection })),
  { ssr: true }
)

const TestimonialsSection = dynamic(
  () => import('@/components/home/testimonials-section').then(mod => ({ default: mod.TestimonialsSection })),
  { 
    loading: () => <TestimonialsSkeletonLoader />,
    ssr: false 
  }
)

const CTASection = dynamic(
  () => import('@/components/home/cta-section').then(mod => ({ default: mod.CTASection })),
  { ssr: true }
)

const AIVisualizationPromo = dynamic(
  () => import('@/components/ai-visualization-promo'),
  { ssr: false }
)

const RecentViews = dynamic(
  () => import('@/components/home/recent-views').then(mod => ({ default: mod.RecentViews })),
  { ssr: false }
)

// Skeleton Loaders for fast perceived loading
function ProductsSkeletonLoader() {
  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl aspect-[3/4]" />
          ))}
        </div>
      </div>
    </section>
  )
}

function ActivitySkeletonLoader() {
  return (
    <section className="py-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  )
}

function DashboardSkeletonLoader() {
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="animate-pulse grid md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-2xl" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    </section>
  )
}

function TestimonialsSkeletonLoader() {
  return (
    <section className="py-16 bg-gradient-to-b from-white to-orange-50/30">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-48" />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      {/* Critical: Hero loads immediately */}
      <HeroSection />
      
      {/* High priority: Products load with SSR */}
      <Suspense fallback={<ProductsSkeletonLoader />}>
        <ProductsShowcase />
      </Suspense>
      
      {/* Medium priority: Activity feed */}
      <Suspense fallback={<ActivitySkeletonLoader />}>
        <LiveActivityFeed />
      </Suspense>
      
      {/* Low priority: Below the fold content */}
      <Suspense fallback={<DashboardSkeletonLoader />}>
        <MiniDashboard />
      </Suspense>
      
      <StatsSection />
      
      <Suspense fallback={<TestimonialsSkeletonLoader />}>
        <TestimonialsSection />
      </Suspense>
      
      <CTASection />
      
      {/* Lowest priority: Promo content */}
      <Suspense fallback={null}>
        <RecentViews />
      </Suspense>
      
      <Suspense fallback={null}>
        <AIVisualizationPromo />
      </Suspense>
    </>
  )
}
