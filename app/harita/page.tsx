'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Store, X, Navigation, AlertCircle, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

interface DeliveryPoint {
  id: string
  name: string
  address: string
  district: string
  latitude: number
  longitude: number
  hours: string | null
  image: string | null
}

// Loading Skeleton Component
function MapSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-[600px] bg-gray-200 rounded-2xl" />
    </div>
  )
}

// Error Component
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { language } = useLanguage()
  
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-2xl border border-red-200">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-red-700 mb-2">
        {language === 'tr' ? 'Veri Yüklenemedi' : 'Data Load Error'}
      </h3>
      <p className="text-red-600 text-center mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        {language === 'tr' ? 'Tekrar Dene' : 'Retry'}
      </button>
    </div>
  )
}

// List Skeleton Component
function ListSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export default function HaritaPage() {
  const { t, language } = useLanguage()
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([])
  const [selectedPoint, setSelectedPoint] = useState<DeliveryPoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const pointsRes = await fetch('/api/delivery-points')
      
      if (!pointsRes.ok) {
        throw new Error(`Teslimat noktası verisi alınamadı: ${pointsRes.status}`)
      }
      
      const pointsData = await pointsRes.json()
      
      const validPoints = Array.isArray(pointsData?.points)
        ? pointsData.points
        : Array.isArray(pointsData)
          ? pointsData
          : []
      
      setDeliveryPoints(validPoints)
      
      if (validPoints.length === 0) {
        console.warn('Harita: Teslim noktası bulunamadı')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata'
      console.error('Harita veri hatası:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
  }

  // İzmir merkez koordinatları
  const center = { lat: 38.4237, lng: 27.1428 }

  // Hata durumunda
  if (error) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50">
        <section className="py-8">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <ErrorMessage message={error} onRetry={fetchData} />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      {/* Header */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('mapTitle')}</h1>
          <p className="text-gray-600 mb-4">{t('mapSubtitle')}</p>
          
          {/* Teslim Noktası Sayısı */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 text-green-700 w-fit">
            <Store className="w-5 h-5" />
            <span className="font-medium">{deliveryPoints.length} {language === 'tr' ? 'Teslim Noktası' : 'Delivery Points'}</span>
          </div>
        </div>
      </section>

      {/* Map & List */}
      <section className="py-8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2">
              {loading ? (
                <MapSkeleton />
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg" style={{ height: '600px' }}>
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d50000!2d${center.lng}!3d${center.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1str!2str!4v1706000000000!5m2!1str!2str`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
              
              {/* Legend */}
              <div className="mt-4 flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span className="text-gray-600">{t('showDeliveryPoints')}</span>
              </div>
            </div>

            {/* Sidebar List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ height: '600px' }}>
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900">
                    {t('deliveryPointsTitle')}
                  </h3>
                </div>
                <div className="overflow-y-auto" style={{ height: 'calc(100% - 57px)' }}>
                  {loading ? (
                    <ListSkeleton />
                  ) : (
                    <div className="p-4 space-y-3">
                      {/* No Data State */}
                      {deliveryPoints.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>{language === 'tr' ? 'Henüz teslim noktası bulunamadı' : 'No delivery points available yet'}</p>
                        </div>
                      )}

                      {/* Delivery Points */}
                      {deliveryPoints.map((point) => (
                        <motion.div
                          key={point.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-all cursor-pointer"
                          onClick={() => setSelectedPoint(point)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Store className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{point.name}</h4>
                              <p className="text-sm text-gray-600 truncate">{point.address}</p>
                              {point.hours && (
                                <p className="text-xs text-gray-500 mt-1">{point.hours}</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openGoogleMaps(point.latitude, point.longitude)
                              }}
                              className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition-colors"
                            >
                              <Navigation className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Selected Point Modal */}
      {selectedPoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPoint(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">{selectedPoint.name}</h3>
                <button onClick={() => setSelectedPoint(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div>
                <p className="text-gray-600 mb-2">{selectedPoint.address}</p>
                {selectedPoint.hours && (
                  <p className="text-sm text-gray-500 mb-4">{selectedPoint.hours}</p>
                )}
                <button
                  onClick={() => openGoogleMaps(selectedPoint.latitude, selectedPoint.longitude)}
                  className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  {t('getDirections')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
