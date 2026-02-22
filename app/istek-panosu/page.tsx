'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, Clock, MapPin, Tag, Zap, Heart,
  X, ChevronDown, ChevronRight, Sparkles, ArrowRight, Eye,
  Check, MessageCircle, Trash2, RefreshCw, AlertCircle, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { safeFetch } from '@/lib/safe-fetch';

const CATEGORIES = [
  { value: 'elektronik', label: 'Elektronik' },
  { value: 'giyim', label: 'Giyim' },
  { value: 'ev-esyalari', label: 'Ev Eşyaları' },
  { value: 'spor', label: 'Spor' },
  { value: 'kitap-muzik', label: 'Kitap & Müzik' },
  { value: 'oyuncak', label: 'Oyuncak' },
  { value: 'bebek', label: 'Bebek' },
  { value: 'hobi', label: 'Hobi' },
  { value: 'bahce', label: 'Bahçe' },
  { value: 'otomotiv', label: 'Otomotiv' },
  { value: 'diger', label: 'Diğer' },
];

const CITIES = [
  'İzmir', 'İstanbul', 'Ankara', 'Antalya', 'Bursa', 'Adana', 'Konya', 'Mersin'
];

interface WishItem {
  id: string;
  wantTitle: string;
  wantDescription?: string;
  wantCategory: string;
  wantMinValue?: number;
  wantMaxValue?: number;
  offerType: string;
  offerCategory?: string;
  offerDescription?: string;
  preferredCity?: string;
  isUrgent: boolean;
  status: string;
  viewCount: number;
  matchCount: number;
  createdAt: string;
  expiresAt?: string;
  user: {
    id: string;
    name: string;
    image?: string;
    location?: string;
  };
  matches?: any[];
}

export default function WishBoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [myWishes, setMyWishes] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Yeni istek formu
  const [formData, setFormData] = useState({
    wantTitle: '',
    wantDescription: '',
    wantCategory: '',
    wantMinValue: '',
    wantMaxValue: '',
    offerType: 'category',
    offerCategory: '',
    offerDescription: '',
    preferredCity: '',
    isUrgent: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Verileri yükle
  useEffect(() => {
    fetchWishes();
    fetchStats();
    if ((session?.user as any)?.id) {
      fetchMyWishes();
    }
  }, [session, selectedCategory, selectedCity, showUrgentOnly, searchQuery]);

  const fetchWishes = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedCity && selectedCity !== 'all') params.set('city', selectedCity);
      if (showUrgentOnly) params.set('urgent', 'true');
      if (searchQuery) params.set('q', searchQuery);
      params.set('limit', '50');

      const { data, error } = await safeFetch(`/api/wishboard?${params}`);
      if (error) { console.error('Wishboard error:', error); return; }
      if (data) setWishes(data.wishes || []);
    } catch (error) {
      console.error('Fetch wishes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyWishes = async () => {
    try {
      const { data, error } = await safeFetch('/api/wishboard?my=true');
      if (data) setMyWishes(data.wishes || []);
    } catch (error) {
      console.error('Fetch my wishes error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await safeFetch('/api/wishboard?stats=true');
      if (data) setStats(data);
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleCreateWish = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!session?.user?.email) {
      toast.error('Lütfen giriş yapın');
      router.push('/giris');
      return;
    }

    if (!formData.wantTitle || !formData.wantCategory) {
      toast.error('Lütfen başlık ve kategori girin');
      return;
    }

    setSubmitting(true);
    try {
      const requestBody = {
        action: 'create',
        wantTitle: formData.wantTitle.trim(),
        wantDescription: formData.wantDescription?.trim() || undefined,
        wantCategory: formData.wantCategory,
        wantMinValue: formData.wantMinValue ? parseInt(formData.wantMinValue) : undefined,
        wantMaxValue: formData.wantMaxValue ? parseInt(formData.wantMaxValue) : undefined,
        offerType: formData.offerType,
        offerCategory: formData.offerCategory || undefined,
        offerDescription: formData.offerDescription?.trim() || undefined,
        preferredCity: formData.preferredCity && formData.preferredCity !== 'any' ? formData.preferredCity : undefined,
        isUrgent: formData.isUrgent,
      };

      const { data, error } = await safeFetch('/api/wishboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        timeout: 15000,
      });

      if (error) {
        toast.error(error);
        setSubmitting(false);
        return;
      }

      if (data?.success) {
        toast.success('İsteğiniz oluşturuldu! Eşleşmeler aranıyor...');
        // Reset form first
        setFormData({
          wantTitle: '',
          wantDescription: '',
          wantCategory: '',
          wantMinValue: '',
          wantMaxValue: '',
          offerType: 'category',
          offerCategory: '',
          offerDescription: '',
          preferredCity: '',
          isUrgent: false,
        });
        // Then close modal
        setShowCreateModal(false);
        // Then refresh data
        setTimeout(() => {
          fetchWishes();
          fetchMyWishes();
        }, 100);
      } else {
        toast.error(data.error || 'Bir hata oluştu');
      }
    } catch (error: any) {
      console.error('Create wish error:', error);
      toast.error(error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWish = async (wishId: string) => {
    try {
      const res = await fetch('/api/wishboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', wishId }),
      });

      if (res.ok) {
        toast.success('İstek iptal edildi');
        fetchMyWishes();
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const getCategoryLabel = (slug: string) => {
    return CATEGORIES.find(c => c.value === slug)?.label || slug;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const getExpiryText = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Süresi doldu';
    if (diffDays === 1) return 'Son 1 gün';
    if (diffDays <= 7) return `${diffDays} gün kaldı`;
    return `${diffDays} gün`;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Gift className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
                <span className="truncate">İstek Panosu</span>
              </h1>
              <p className="text-purple-100 mt-1 text-sm sm:text-base">
                Ne istediğinizi paylaşın, eşleşmeleri bulalım!
              </p>
            </div>
            <Button
              onClick={() => session ? setShowCreateModal(true) : router.push('/giris')}
              className="bg-white text-purple-600 hover:bg-purple-50 font-semibold w-full sm:w-auto flex-shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Yeni İstek
            </Button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.totalActive || 0}</div>
                <div className="text-sm text-purple-100">Aktif İstek</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.totalMatches || 0}</div>
                <div className="text-sm text-purple-100">Eşleşme</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{myWishes.filter(w => w.status === 'active').length}</div>
                <div className="text-sm text-purple-100">İsteklerim</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="all" className="text-sm">
              <Search className="w-4 h-4 mr-2" />
              Tüm İstekler
            </TabsTrigger>
            <TabsTrigger value="my" className="text-sm">
              <Heart className="w-4 h-4 mr-2" />
              İsteklerim ({myWishes.length})
            </TabsTrigger>
          </TabsList>

          {/* All Wishes Tab */}
          <TabsContent value="all">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="İstek ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[100] max-h-60">
                    <SelectItem value="all">Tümü</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Şehir" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[100] max-h-60">
                    <SelectItem value="all">Tümü</SelectItem>
                    {CITIES.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={showUrgentOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowUrgentOnly(!showUrgentOnly)}
                  className={showUrgentOnly ? 'bg-orange-500 hover:bg-orange-600' : ''}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Acil
                </Button>
              </div>
            </div>

            {/* Wishes List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : wishes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
                  İlk isteği sen oluştur!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
                  Ne aradığını paylaş — belki aradığın eşya birinin dolabında bekliyor!
                </p>
                <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mb-6">
                  <span>🔍 140+ aktif ürün</span>
                  <span>·</span>
                  <span>👥 150+ kullanıcı</span>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  + İlk İsteğimi Oluştur
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {wishes.map((wish) => (
                  <WishCard
                    key={wish.id}
                    wish={wish}
                    getCategoryLabel={getCategoryLabel}
                    formatDate={formatDate}
                    getExpiryText={getExpiryText}
                    isOwn={wish.user.id === (session?.user as any)?.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Wishes Tab */}
          <TabsContent value="my">
            {!session ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">Giriş Yapmalısınız</h3>
                <p className="text-gray-600 mt-1 mb-4">İsteklerinizi görmek için giriş yapın</p>
                <Button onClick={() => router.push('/giris')}>
                  Giriş Yap
                </Button>
              </div>
            ) : myWishes.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Henüz isteğiniz yok</h3>
                <p className="text-gray-600 mt-1 mb-4">Ne istediğinizi paylaşın, eşleşmeleri bulalım!</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-5 h-5 mr-2" />
                  İlk İsteğinizi Oluşturun
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myWishes.map((wish) => (
                  <MyWishCard
                    key={wish.id}
                    wish={wish}
                    getCategoryLabel={getCategoryLabel}
                    formatDate={formatDate}
                    getExpiryText={getExpiryText}
                    onCancel={() => handleCancelWish(wish.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Wish Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 px-6 py-4 border-b-2 border-purple-100 dark:border-gray-700">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5 text-purple-600" />
              Yeni Takas İsteği
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Ne istiyorum */}
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
              <h3 className="font-bold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2 text-sm">
                <Heart className="w-4 h-4 flex-shrink-0" />
                <span>Ne İstiyorum?</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Ürün Adı *</label>
                  <Input
                    placeholder="Örn: iPhone 13, Bisiklet..."
                    value={formData.wantTitle}
                    onChange={(e) => setFormData({ ...formData, wantTitle: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Açıklama</label>
                  <Textarea
                    placeholder="Detaylı açıklama (isteğe bağlı)"
                    value={formData.wantDescription}
                    onChange={(e) => setFormData({ ...formData, wantDescription: e.target.value })}
                    rows={2}
                    className="w-full resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kategori *</label>
                  <Select
                    value={formData.wantCategory}
                    onValueChange={(v) => setFormData({ ...formData, wantCategory: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Min Valor</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.wantMinValue}
                      onChange={(e) => setFormData({ ...formData, wantMinValue: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Max Valor</label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={formData.wantMaxValue}
                      onChange={(e) => setFormData({ ...formData, wantMaxValue: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Ne verebilirim */}
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 border border-green-100 dark:border-green-800">
              <h3 className="font-bold text-green-900 dark:text-green-200 mb-3 flex items-center gap-2 text-sm">
                <Gift className="w-4 h-4 flex-shrink-0" />
                <span>Ne Verebilirim?</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teklif Türü</label>
                  <Select
                    value={formData.offerType}
                    onValueChange={(v) => setFormData({ ...formData, offerType: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Bir kategoriden ürün</SelectItem>
                      <SelectItem value="any">Herhangi bir şey</SelectItem>
                      <SelectItem value="specific_product">Belirli bir ürün</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.offerType === 'category' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teklif Kategorisi</label>
                    <Select
                      value={formData.offerCategory}
                      onValueChange={(v) => setFormData({ ...formData, offerCategory: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Kategori seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teklif Açıklaması</label>
                  <Textarea
                    placeholder="Teklifinizi açıklayın (isteğe bağlı)"
                    value={formData.offerDescription}
                    onChange={(e) => setFormData({ ...formData, offerDescription: e.target.value })}
                    rows={2}
                    className="w-full resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Tercihler */}
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>Tercihler</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tercih Edilen Şehir</label>
                  <Select
                    value={formData.preferredCity}
                    onValueChange={(v) => setFormData({ ...formData, preferredCity: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Şehir seçin (isteğe bağlı)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Farketmez</SelectItem>
                      {CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={formData.isUrgent}
                    onChange={(e) => setFormData({ ...formData, isUrgent: e.target.checked })}
                    className="w-4 h-4 rounded border-orange-500 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="flex items-center gap-1 text-orange-600 text-sm">
                    <Zap className="w-4 h-4" />
                    Acil istek olarak işaretle
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Fixed Bottom Buttons */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t-2 border-purple-100 dark:border-gray-700 px-6 py-4">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                type="button"
                disabled={submitting || !formData.wantTitle.trim() || !formData.wantCategory}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                onClick={() => handleCreateWish()}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    İsteği Oluştur
                  </>
                )}
              </Button>
            </div>
            {(!formData.wantTitle.trim() || !formData.wantCategory) && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center font-medium bg-red-50 dark:bg-red-900/20 py-1 rounded-lg">
                * Ürün adı ve kategori zorunludur
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wish Card Component
function WishCard({
  wish,
  getCategoryLabel,
  formatDate,
  getExpiryText,
  isOwn,
}: {
  wish: WishItem;
  getCategoryLabel: (slug: string) => string;
  formatDate: (date: string) => string;
  getExpiryText: (date?: string) => string | null;
  isOwn: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0">
              {wish.user.image ? (
                <Image
                  src={wish.user.image}
                  alt={wish.user.name || ''}
                  width={36}
                  height={36}
                  className="rounded-full w-9 h-9 object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">
                    {wish.user.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {wish.user.name}
              </div>
              {wish.user.location && (
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{wish.user.location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wish.isUrgent && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                <Zap className="w-3 h-3 mr-1" />
                Acil
              </Badge>
            )}
            {isOwn && (
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                Sizin
              </Badge>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {wish.wantTitle}
        </h3>

        {wish.wantDescription && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {wish.wantDescription}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            <Tag className="w-3 h-3 mr-1" />
            {getCategoryLabel(wish.wantCategory)}
          </Badge>
          {(wish.wantMinValue || wish.wantMaxValue) && (
            <Badge variant="secondary">
              {wish.wantMinValue && wish.wantMaxValue
                ? `${wish.wantMinValue}-${wish.wantMaxValue}V`
                : wish.wantMinValue
                ? `${wish.wantMinValue}V+`
                : `Max ${wish.wantMaxValue}V`}
            </Badge>
          )}
          {wish.preferredCity && (
            <Badge variant="outline">
              <MapPin className="w-3 h-3 mr-1" />
              {wish.preferredCity}
            </Badge>
          )}
        </div>

        {wish.offerCategory && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 mb-3">
            <span className="text-xs text-green-700 dark:text-green-300">
              <Gift className="w-3 h-3 inline mr-1" />
              Karşılığında: {getCategoryLabel(wish.offerCategory)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {wish.viewCount}
            </span>
            {wish.matchCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <Sparkles className="w-3 h-3" />
                {wish.matchCount} eşleşme
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {wish.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getExpiryText(wish.expiresAt)}
              </span>
            )}
            <span>{formatDate(wish.createdAt)}</span>
          </div>
        </div>
      </div>

      {!isOwn && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <Link href={`/mesajlar?user=${wish.user.id}`}>
            <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700">
              <MessageCircle className="w-4 h-4 mr-2" />
              Mesaj Gönder
            </Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// My Wish Card Component
function MyWishCard({
  wish,
  getCategoryLabel,
  formatDate,
  getExpiryText,
  onCancel,
}: {
  wish: WishItem;
  getCategoryLabel: (slug: string) => string;
  formatDate: (date: string) => string;
  getExpiryText: (date?: string) => string | null;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {wish.wantTitle}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                {getCategoryLabel(wish.wantCategory)}
              </Badge>
              <Badge
                variant={wish.status === 'active' ? 'default' : 'secondary'}
                className={wish.status === 'active' ? 'bg-green-500' : ''}
              >
                {wish.status === 'active' ? 'Aktif' : wish.status === 'fulfilled' ? 'Tamamlandı' : 'Pasif'}
              </Badge>
              {wish.isUrgent && (
                <Badge className="bg-orange-100 text-orange-700">
                  <Zap className="w-3 h-3 mr-1" />
                  Acil
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{formatDate(wish.createdAt)}</span>
            {wish.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {wish.viewCount} görüntüleme
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <Sparkles className="w-4 h-4" />
            {wish.matchCount} eşleşme
          </span>
          {wish.expiresAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {getExpiryText(wish.expiresAt)}
            </span>
          )}
        </div>

        {/* Matches */}
        {wish.matches && wish.matches.length > 0 && (
          <div
            className="cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
              <span className="font-medium text-green-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {wish.matches.length} Eşleşme Bulundu
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
            
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 pt-2"
                >
                  {wish.matches.map((match: any, idx: number) => (
                    <div
                      key={match.id || idx}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          Eşleşme #{idx + 1}
                        </div>
                        <div className="text-xs text-gray-600">
                          Skor: {Math.round(match.score)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {match.matchType === 'direct' ? 'Direkt' : 'Döngüsel'}
                        </Badge>
                        {match.matchedUserId && (
                          <Link href={`/mesajlar?user=${match.matchedUserId}`}>
                            <Button size="sm" variant="outline">
                              <MessageCircle className="w-3 h-3 mr-1" />
                              İletişim
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
