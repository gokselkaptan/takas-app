'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const videos = [
  {
    id: 1,
    src: '/videos/10d12dd5-7479-4c98-b672-faf5646de640.mp4',
    title: 'TAKAS-A Sinematik',
  },
  {
    id: 2,
    src: '/videos/b2ace4c8-480e-4c33-9837-fbdf7b4a2cd3.mp4',
    title: 'Gelecek Burada',
  },
  {
    id: 3,
    src: '/videos/TAKAS-a.mp4',
    title: 'TAKAS-A Tanıtım',
  },
  {
    id: 4,
    src: '/videos/takasa video.mp4',
    title: 'Nasıl Çalışır',
  },
]

export function VideoGallery() {
  const [selectedVideo, setSelectedVideo] = useState<typeof videos[0] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    const ref = scrollRef.current
    if (ref) {
      ref.addEventListener('scroll', checkScroll)
      return () => ref.removeEventListener('scroll', checkScroll)
    }
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Video <span className="text-gradient-frozen">Galeri</span>
          </h2>
          <p className="text-gray-600">
            TAKAS-A'yı daha yakından tanı
          </p>
        </motion.div>

        {/* Horizontal Scrollable Container */}
        <div className="relative">
          {/* Left Scroll Button */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Right Scroll Button */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Videos Container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2 -mx-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedVideo(video)}
                className="relative flex-shrink-0 w-[200px] sm:w-[240px] aspect-[9/14] rounded-xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-all"
                style={{ scrollSnapAlign: 'start' }}
              >
                <video
                  src={video.src}
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = 0
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-white font-semibold text-sm">{video.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-12 right-0 text-white hover:text-frozen-400 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
              <video
                src={selectedVideo.src}
                controls
                autoPlay
                className="w-full rounded-xl"
              />
              <div className="mt-3 text-center">
                <h3 className="text-white text-lg font-semibold">
                  {selectedVideo.title}
                </h3>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
