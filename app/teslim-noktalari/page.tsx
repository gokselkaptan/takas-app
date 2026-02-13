'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { MapPin, Clock, Coffee, Navigation } from 'lucide-react'

const deliveryPoints = [
  {
    name: 'Alsancak Merkez',
    cafe: 'Coffee Lab',
    address: 'Kıbrıs Şehitleri Cad. No: 45, Alsancak',
    hours: '09:00 - 21:00',
    landmark: 'Saat Kulesi',
    image: 'https://cdn.abacus.ai/images/7d523cb8-cb7d-4e86-9e69-ec022aeff892.png',
    mapUrl: 'https://maps.google.com/?q=Alsancak,+İzmir',
  },
  {
    name: 'Karşıyaka Sahil',
    cafe: 'Kahve Dünyası',
    address: 'Cemal Gürsel Cad. No: 123, Karşıyaka',
    hours: '08:00 - 22:00',
    landmark: 'Karşıyaka Sahili',
    image: 'https://cdn.abacus.ai/images/91211233-f5d3-4094-bd0a-f3eeebf83ec5.png',
    mapUrl: 'https://maps.google.com/?q=Karşıyaka+Sahil,+İzmir',
  },
  {
    name: 'Balçova AVM',
    cafe: 'Starbucks',
    address: 'Balçova AVM, Kat: 2, Balçova',
    hours: '10:00 - 22:00',
    landmark: 'Balçova Teleferik',
    image: 'https://cdn.abacus.ai/images/4cc8a08b-c494-4510-8acc-08b98d60dd5e.png',
    mapUrl: 'https://maps.google.com/?q=Balçova+Teleferik,+İzmir',
  },
  {
    name: 'Konak Asansör',
    cafe: 'Tarihi Asansör Kafe',
    address: 'Asansör Meydanı, Konak',
    hours: '09:00 - 20:00',
    landmark: 'Tarihi Asansör',
    image: 'https://cdn.abacus.ai/images/24efd56f-8104-426a-b23c-6957edd92c42.png',
    mapUrl: 'https://maps.google.com/?q=Tarihi+Asansör,+İzmir',
  },
  {
    name: 'Bornova Forum',
    cafe: 'Gloria Jeans',
    address: 'Forum Bornova AVM, Kat: 1',
    hours: '10:00 - 22:00',
    landmark: 'Forum Bornova',
    image: 'https://cdn.abacus.ai/images/503970de-de77-4cc0-936c-c9b7cd3a2d48.png',
    mapUrl: 'https://maps.google.com/?q=Forum+Bornova,+İzmir',
  },
  {
    name: 'Buca Park',
    cafe: 'Espresso Lab',
    address: 'Buca Park AVM, Giriş Kat',
    hours: '10:00 - 21:00',
    landmark: 'Buca Park',
    image: 'https://cdn.abacus.ai/images/f4027bb4-f073-4c98-a216-4d70c9a6c1ca.png',
    mapUrl: 'https://maps.google.com/?q=Buca+Park,+İzmir',
  },
]

export default function TeslimNoktalariPage() {
  const handleDirections = (mapUrl: string) => {
    window.open(mapUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-20 gradient-frozen">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Teslim Noktaları
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              İzmir'in dört bir yanında, size en yakın noktada takasınızı tamamlayın
            </p>
          </motion.div>
        </div>
      </section>

      {/* Map Info */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-frozen flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900">6 Aktif Teslim Noktası</div>
                <div className="text-sm text-gray-500">İzmir genelinde</div>
              </div>
            </div>
            <div className="text-center md:text-right">
              <div className="text-frozen-600 font-semibold">Yakında daha fazla nokta!</div>
              <div className="text-sm text-gray-500">Bostanlı, Çeşme, Urla...</div>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Points Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {deliveryPoints.map((point, index) => (
              <motion.div
                key={point.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all group"
              >
                <div className="relative aspect-video">
                  <Image
                    src={point.image}
                    alt={point.landmark}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="px-3 py-1 bg-frozen-500 text-white text-sm rounded-full">
                      {point.landmark}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {point.name}
                  </h3>
                  <div className="space-y-2 text-gray-700">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-frozen-600" />
                      <span className="font-medium">{point.cafe}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-frozen-600 mt-0.5" />
                      <span className="text-sm text-gray-600">{point.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-frozen-600" />
                      <span className="text-gray-600">{point.hours}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDirections(point.mapUrl)}
                    className="mt-4 w-full py-3 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Yol Tarifi
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Info Banner */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-frozen-500 to-frozen-600 rounded-2xl p-8 md:p-12 text-center text-white"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Sende Teslim Noktası Olmak İster misin?
            </h2>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
              Kafen veya işyerin TAKAS-A teslim noktası olarak çalışabilir. Bizimle iletişime geç!
            </p>
            <a
              href="/iletisim"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-frozen-600 font-semibold hover:bg-gray-100 transition-all"
            >
              İletişime Geç
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
