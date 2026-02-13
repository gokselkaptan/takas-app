'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Mail, Phone, Send, CheckCircle, AlertCircle } from 'lucide-react'

export default function IletisimPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
      } else {
        setStatus('error')
        setErrorMessage(data?.error || 'Bir hata oluştu')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage('Bağlantı hatası')
    }
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
              İletişim
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Sorularınız, önerileriniz veya iş birliği teklifleriniz için bize ulaşın
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Mesaj Gönder</h2>

              {status === 'success' ? (
                <div className="bg-green-50 rounded-2xl p-8 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Mesajınız Gönderildi!
                  </h3>
                  <p className="text-gray-600">
                    En kısa sürede size dönüş yapacağız.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-4 px-6 py-2 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all"
                  >
                    Yeni Mesaj
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                      placeholder="Adınız Soyadınız"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      E-posta *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                      placeholder="ornek@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                      placeholder="+90 5XX XXX XX XX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Konu
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all"
                      placeholder="Mesajınızın konusu"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mesaj *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-frozen-500 focus:border-transparent transition-all resize-none"
                      placeholder="Mesajınızı buraya yazın..."
                    />
                  </div>

                  {status === 'error' && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                      <AlertCircle className="w-5 h-5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full py-4 rounded-xl bg-frozen-500 text-white font-semibold hover:bg-frozen-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'loading' ? (
                      'Gönderiliyor...'
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Gönder
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Mesajınız veritabanımıza kaydedilecektir. Gizlilik politikamıza uygun şekilde işlenecektir.
                  </p>
                </form>
              )}
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">İletişim Bilgileri</h2>

              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-frozen flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Adres</h3>
                    <p className="text-gray-600">
                      Alsancak Mahallesi, 1453 Sokak No:12<br />
                      Konak / İzmir, Türkiye
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-frozen flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">E-posta</h3>
                    <p className="text-gray-600">
                      <a href="mailto:join@takas-a.com" className="hover:text-frozen-600 transition-colors">join@takas-a.com</a>
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-frozen flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Telefon</h3>
                    <p className="text-gray-600">+90 232 XXX XX XX</p>
                    <p className="text-sm text-gray-500">Hafta içi 09:00 - 18:00</p>
                  </div>
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="mt-8 aspect-video rounded-2xl overflow-hidden bg-gray-200">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12516.226746961!2d27.1367!3d38.4237!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14bbd862a762cacd%3A0x628cbba1a59ce8fe!2sAlsancak%2C%20Konak%2F%C4%B0zmir!5e0!3m2!1str!2str!4v1706000000000!5m2!1str!2str"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
