'use client'

import { motion } from 'framer-motion'
import { Target, Eye, Heart, Leaf, Users, Lightbulb, Recycle, Globe } from 'lucide-react'

const values = [
  {
    icon: Leaf,
    title: 'Sürdürülebilirlik',
    description: 'Karbon salınımını azaltıyor, atıkları minimize ediyoruz.',
  },
  {
    icon: Heart,
    title: 'Toplumsal Fayda',
    description: 'Çocukların mutluluğu, ailelerin tasarrufu için çalışıyoruz.',
  },
  {
    icon: Users,
    title: 'Paylaşım & Dayanışma',
    description: 'Topluluk olarak birbirimize destek oluyoruz.',
  },
  {
    icon: Lightbulb,
    title: 'Teknoloji & Yenilik',
    description: 'Modern çözümlerle takas deneyimini kolaylaştırıyoruz.',
  },
]

export default function HakkimizdaPage() {
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
              Hakkımızda
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Paylaşım ekonomisinin İzmir'öncüsü TAKAS-A'yı tanıyın
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-2xl p-8"
            >
              <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Misyonumuz</h2>
              <p className="text-gray-600 text-lg">
                Para ödemeden takas yaparak sürdürülebilir bir ekonomi oluşturmak.
                İnsanların ihtiyaç duymadıkları ürünleri, ihtiyaç duydukları ürünlerle
                kolayca takas edebilecekleri bir platform sunmak.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-2xl p-8"
            >
              <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Vizyonumuz</h2>
              <p className="text-gray-600 text-lg">
                Türkiye'nin her şehrinde paylaşım ekonomisini yaygınlaştırmak.
                Gelecekte milyonlarca insanın takas yaparak hem tasarruf ettiği
                hem de çevreye katkıda bulunduğu bir dünya hayal ediyoruz.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Gelecek <span className="text-gradient-frozen">Burada</span>
            </h2>
            <p className="text-lg text-gray-600">TAKAS-A vizyonumuzu keşfedin</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="aspect-video rounded-2xl overflow-hidden shadow-2xl"
          >
            <video
              src="/videos/b2ace4c8-480e-4c33-9837-fbdf7b4a2cd3.mp4"
              controls
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Değerlerimiz
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 rounded-2xl p-6 text-center hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {value.title}
                </h3>
                <p className="text-gray-600">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="py-20 gradient-frozen">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Toplumsal Etki
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Recycle,
                stat: '15 Ton',
                label: 'Atık Önlendi',
              },
              {
                icon: Globe,
                stat: '8.5 Ton',
                label: 'CO₂ Azaltıldı',
              },
              {
                icon: Heart,
                stat: '₺2.5M+',
                label: 'Aile Tasarrufu',
              },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center text-white"
              >
                <item.icon className="w-10 h-10 mx-auto mb-4" />
                <div className="text-4xl font-bold mb-2">{item.stat}</div>
                <div className="text-white/80">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
