'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Sparkles, Coins, Users, 
  ChevronRight, Star, Zap, Target, Award, Heart,
  ArrowLeftRight, Flame, CheckCircle2
} from 'lucide-react'

export default function OnerilerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [dailyTasks, setDailyTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userLevel, setUserLevel] = useState<any>(null)
  const [taskStatus, setTaskStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
      return
    }
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Paralel veri çekme
      const [profileRes, levelRes, tasksRes, productsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/valor?action=user_level'),
        fetch('/api/valor?action=task_status'),
        fetch('/api/products?limit=8&sort=recommended')
      ])

      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data)
      }

      if (levelRes.ok) {
        const levelData = await levelRes.json()
        setUserLevel(levelData)
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTaskStatus(tasksData)
      }

      if (productsRes.ok) {
        const data = await productsRes.json()
        setRecommendations(Array.isArray(data) ? data : data.products || [])
      }
    } catch (error) {
      console.error('Öneriler yüklenemedi:', error)
    }
    setLoading(false)
  }

  const buildDailyTasks = () => {
    // Progresif Bonus Sistemi v3.0 - Seviye bazlı dinamik görevler + taskStatus tracking
    const tasks = [
      {
        id: 'daily-login',
        icon: '🔥',
        title: 'Günlük Giriş',
        description: userLevel?.level === 0 
          ? 'Her gün giriş yap! İlk takasından sonra bonus 2x!' 
          : `Seviye ${userLevel?.level}: Günlük ${userLevel?.dailyBonus}V`,
        reward: `+${userLevel?.dailyBonus || 1} Valor`,
        completed: taskStatus['daily-login'] || false,
        action: null,
        locked: false,
      },
      {
        id: 'add-product',
        icon: '📦',
        title: 'Ürün Ekle',
        description: userLevel?.productBonus > 0 
          ? `Ürün ekle, ${userLevel.productBonus}V kazan!`
          : 'İlk takasını tamamla, ürün bonusu açılsın!',
        reward: userLevel?.productBonus > 0 ? `+${userLevel.productBonus}V` : '🔒 Seviye 1',
        completed: taskStatus['add-product'] || false,
        action: { label: 'Ürün Ekle', href: '/urun-ekle' },
        locked: !userLevel?.productBonus,
      },
      {
        id: 'send-swap',
        icon: '🔄',
        title: 'Takas Gönder',
        description: 'Her takas seviyen artırır!',
        reward: 'Seviye Atla!',
        completed: false,
        action: { label: 'Ürünlere Git', href: '/urunler' },
        locked: false,
      },
      {
        id: 'invite-friend',
        icon: '👥',
        title: 'Arkadaş Davet Et',
        description: userLevel?.referralBonus > 0 
          ? `Davet et, ${userLevel.referralBonus}V kazan!`
          : 'İlk takasından sonra davet bonusu aktif!',
        reward: userLevel?.referralBonus > 0 ? `+${userLevel.referralBonus}V` : '🔒 Seviye 1',
        completed: taskStatus['invite-friend'] || false,
        action: { label: 'Davet Et', href: '/davet' },
        locked: !userLevel?.referralBonus,
      },
      {
        id: 'write-review',
        icon: '⭐',
        title: 'Değerlendirme Yaz',
        description: userLevel?.reviewBonus > 0 
          ? `Review yaz, ${userLevel.reviewBonus}V kazan!`
          : 'İlk takasından sonra review bonusu aktif!',
        reward: userLevel?.reviewBonus > 0 ? `+${userLevel.reviewBonus}V` : '🔒 Seviye 1',
        completed: taskStatus['write-review'] || false,
        action: { label: 'Takaslarım', href: '/takaslarim' },
        locked: !userLevel?.reviewBonus,
      },
    ]
    setDailyTasks(tasks)
  }

  useEffect(() => {
    if (profile !== null || userLevel !== null) buildDailyTasks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, userLevel, taskStatus])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-20 pb-24">
        <div className="max-w-2xl mx-auto px-4">
          <div className="animate-pulse space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  const completedTasks = dailyTasks.filter(t => t.completed).length
  const totalTasks = dailyTasks.length

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-24">
      <div className="max-w-2xl mx-auto px-4">
        
        {/* Hero — Kişisel Karşılama */}
        <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-bold">
              Merhaba {profile?.name?.split(' ')[0] || 'Kullanıcı'}! 👋
            </h1>
          </div>
          <p className="text-white/80 text-sm mb-4">
            Bugün senin için hazırladığımız öneriler ve görevler var.
          </p>
          
          {/* Hızlı İstatistikler */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold">{profile?.valorBalance || 0}</p>
              <p className="text-[10px] text-white/70">Valor</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold">{profile?.trustScore || 0}</p>
              <p className="text-[10px] text-white/70">Güven</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold">{profile?._count?.products || 0}</p>
              <p className="text-[10px] text-white/70">Ürün</p>
            </div>
          </div>
        </div>

        {/* Seviye Progress Kartı */}
        {userLevel && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{userLevel.emoji}</span>
                <div>
                  <p className="text-xs text-white/70">Seviyen</p>
                  <p className="font-bold">Seviye {userLevel.level}: {userLevel.name}</p>
                </div>
              </div>
              {userLevel.nextLevel && (
                <div className="text-right">
                  <p className="text-xs text-white/70">Sonraki Seviye</p>
                  <p className="text-sm font-bold">{userLevel.swapsToNext} takas kaldı</p>
                </div>
              )}
            </div>
            {userLevel.nextLevel && (
              <div className="h-2 bg-white/20 rounded-full">
                <div 
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${userLevel.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Günlük Görevler */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Günlük Görevler
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {completedTasks}/{totalTasks} tamamlandı
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
              style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {dailyTasks.map(task => (
              <div
                key={task.id}
                className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  task.completed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : task.locked
                    ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                }`}
              >
                <span className="text-2xl">{task.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    task.completed ? 'text-green-700 dark:text-green-400 line-through' : 
                    task.locked ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                  }`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    task.completed
                      ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300'
                      : task.locked
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                  }`}>
                    {task.reward}
                  </span>
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : task.locked ? (
                    <span className="text-gray-400">🔒</span>
                  ) : task.action ? (
                    <Link
                      href={task.action.href}
                      className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-200"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {completedTasks === totalTasks && totalTasks > 0 && (
            <div className="mt-3 p-4 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-xl text-center">
              <p className="text-lg mb-1">🎉</p>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Tüm günlük görevleri tamamladın!
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Yarın yeni görevler seni bekliyor
              </p>
            </div>
          )}
        </div>

        {/* Akıllı Öneriler */}
        <div className="mb-6">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-500" />
            Sana Özel Öneriler
          </h2>

          <div className="space-y-3">
            {/* Valor Artır */}
            <Link href="/profil?tab=valor" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Coins className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">💰 Seviyen Arttıkça Kazan!</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Takas yap, seviye atla, bonusların katlansın! Şu an: {profile?.valorBalance || 0} Valor
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </div>
            </Link>

            {/* Arkadaş Davet */}
            <Link href="/davet" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-200">👥 Arkadaşını Davet Et!</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    {userLevel?.referralBonus > 0 ? `Her davet için +${userLevel.referralBonus}V kazan!` : 'Seviye 1+ bonus aktif'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-400" />
              </div>
            </Link>

            {/* Çoklu Takas */}
            <Link href="/takas-firsatlari" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ArrowLeftRight className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-purple-900 dark:text-purple-200">🔄 Çoklu Takas Fırsatları</p>
                  <p className="text-xs text-purple-700 dark:text-purple-400">
                    Direkt takas bulamıyorsan, çoklu takas ile şansını artır!
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-400" />
              </div>
            </Link>

            {/* İstek Panosu */}
            <Link href="/istek-panosu" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-900 dark:text-rose-200">🎯 İstediğin Ürünü Yaz!</p>
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    İstek panosuna yaz, birisi sana teklif yapabilir.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-rose-400" />
              </div>
            </Link>

            {/* Hizmet Takası */}
            <Link href="/hizmet-takasi" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-200 dark:border-teal-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-teal-900 dark:text-teal-200">🤝 Hizmetini Takas Et!</p>
                  <p className="text-xs text-teal-700 dark:text-teal-400">
                    Emeğini listele — temizlik, ders, tamir karşılığında ürün al.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-teal-400" />
              </div>
            </Link>

            {/* Rozet */}
            <Link href="/profil?tab=badges" className="block">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-yellow-900 dark:text-yellow-200">🏆 Rozet Topla!</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    İlerledikçe ödüller büyür 🎯
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-yellow-400" />
              </div>
            </Link>
          </div>
        </div>

        {/* Beğenebileceğin Ürünler */}
        {recommendations.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              Beğenebileceğin Ürünler
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {recommendations.slice(0, 4).map((product: any) => (
                <Link
                  key={product.id}
                  href={`/urun/${product.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative bg-gray-100 dark:bg-gray-700">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        📦
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                      ⭐ {product.valorPrice}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {product.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/urunler"
              className="mt-3 flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-purple-600 dark:text-purple-400 font-medium text-sm hover:bg-purple-50 dark:hover:bg-gray-700"
            >
              Tüm Ürünleri Gör <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

      </div>
    </main>
  )
}
