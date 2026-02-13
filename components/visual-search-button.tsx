'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Camera, Upload, Search, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import Image from 'next/image';
import Link from 'next/link';

// Tooltip translations
const tooltipText = {
  tr: 'Görsel arama ile ürünü bul',
  en: 'Find product with visual search',
  es: 'Buscar producto con imagen',
  ca: 'Cerca producte amb imatge'
};

interface Product {
  id: string;
  title: string;
  images: string[];
  valorPrice: number;
  category: { name: string };
  user: { name: string | null };
}

interface SearchResult {
  analysis: {
    category: string;
    description: string;
    keywords: string[];
  };
  products: Product[];
  count: number;
}

const translations = {
  tr: {
    title: 'Görsel Arama',
    subtitle: 'Aradığın ürünün fotoğrafını yükle',
    upload: 'Fotoğraf Yükle',
    camera: 'Kamera',
    searchButton: 'Ürünü Ara',
    searching: 'Benzer ürünler aranıyor...',
    found: 'benzer ürün bulundu',
    closestProducts: 'Platformdaki En Yakın Ürünler',
    notFound: 'Benzer ürün bulunamadı',
    tryAnother: 'Başka bir fotoğraf deneyin',
    detected: 'Algılanan',
    keywords: 'Anahtar kelimeler',
    close: 'Kapat',
    dragDrop: 'veya sürükle bırak'
  },
  en: {
    title: 'Visual Search',
    subtitle: 'Upload a photo of the item you are looking for',
    upload: 'Upload Photo',
    camera: 'Camera',
    searchButton: 'Search Product',
    searching: 'Searching for similar items...',
    found: 'similar items found',
    closestProducts: 'Closest Products on Platform',
    notFound: 'No similar items found',
    tryAnother: 'Try another photo',
    detected: 'Detected',
    keywords: 'Keywords',
    close: 'Close',
    dragDrop: 'or drag and drop'
  },
  es: {
    title: 'Búsqueda Visual',
    subtitle: 'Sube una foto del producto que buscas',
    upload: 'Subir Foto',
    camera: 'Cámara',
    searchButton: 'Buscar Producto',
    searching: 'Buscando productos similares...',
    found: 'productos similares encontrados',
    closestProducts: 'Productos Más Cercanos en la Plataforma',
    notFound: 'No se encontraron productos similares',
    tryAnother: 'Prueba otra foto',
    detected: 'Detectado',
    keywords: 'Palabras clave',
    close: 'Cerrar',
    dragDrop: 'o arrastra y suelta'
  },
  ca: {
    title: 'Cerca Visual',
    subtitle: 'Puja una foto del producte que busques',
    upload: 'Pujar Foto',
    camera: 'Càmera',
    searchButton: 'Cercar Producte',
    searching: 'Cercant productes similars...',
    found: 'productes similars trobats',
    closestProducts: 'Productes Més Propers a la Plataforma',
    notFound: 'No s\'han trobat productes similars',
    tryAnother: 'Prova una altra foto',
    detected: 'Detectat',
    keywords: 'Paraules clau',
    close: 'Tancar',
    dragDrop: 'o arrossega i deixa anar'
  }
};

export default function VisualSearchButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasShownTooltip, setHasShownTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { language } = useLanguage();
  const t = translations[language] || translations.tr;
  const tooltip = tooltipText[language] || tooltipText.tr;

  // Scroll sync - FAB ile senkronize küçülme
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // İlk kullanımda tooltip göster (5 saniye sonra, 3 saniye süreyle)
  useEffect(() => {
    if (hasShownTooltip) return;
    
    const showTimer = setTimeout(() => {
      setShowTooltip(true);
      setHasShownTooltip(true);
      
      const hideTimer = setTimeout(() => {
        setShowTooltip(false);
      }, 3000);
      
      return () => clearTimeout(hideTimer);
    }, 5000);
    
    return () => clearTimeout(showTimer);
  }, [hasShownTooltip]);

  // Listen for external open event (from header)
  useEffect(() => {
    const handleOpenVisualSearch = () => {
      setIsOpen(true);
    };
    window.addEventListener('openVisualSearch', handleOpenVisualSearch);
    return () => window.removeEventListener('openVisualSearch', handleOpenVisualSearch);
  }, []);

  // Blinking animation every 5-10 seconds
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 300);
      setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 300);
      }, 400);
    };

    const interval = setInterval(() => {
      if (!isOpen) blink();
    }, 5000 + Math.random() * 5000);

    // Initial blink after 2 seconds
    const initialTimeout = setTimeout(blink, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isOpen]);

  // Uzun basma tooltip
  const handleLongPressStart = useCallback(() => {
    longPressTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    // Tooltip'i 2 saniye sonra gizle
    setTimeout(() => setShowTooltip(false), 2000);
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Preview only - don't search yet
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
    setResults(null);
    setError(null);
  };

  const handleSearch = async () => {
    if (!selectedFile) return;

    setIsSearching(true);
    setResults(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/visual-search', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        setResults(data);
      } else {
        setError(data.error || 'Arama sırasında hata oluştu');
      }
    } catch (err) {
      console.error('Visual search error:', err);
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const resetSearch = () => {
    setPreview(null);
    setSelectedFile(null);
    setResults(null);
    setError(null);
  };

  return (
    <>
      {/* Floating Eye Button - Mobilde kaldırıldı, sadece masaüstünde göster */}
      {/* Mobilde top navigation'daki göz ikonuna taşındı */}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{t.title}</h2>
                    <p className="text-sm text-white/80">{t.subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                {!preview ? (
                  /* Upload Area */
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      dragOver
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                        <Search className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium"
                        >
                          <Upload className="w-5 h-5" />
                          {t.upload}
                        </button>
                        <button
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
                        >
                          <Camera className="w-5 h-5" />
                          {t.camera}
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t.dragDrop}</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    />
                  </div>
                ) : (
                  /* Preview & Search Area */
                  <div className="space-y-4">
                    {/* Preview Image */}
                    <div className="flex gap-4 items-start">
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={preview}
                          alt="Uploaded"
                          fill
                          className="object-cover"
                        />
                        <button
                          onClick={resetSearch}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-3">
                        {/* Search Button - always visible when preview exists */}
                        {!results && !isSearching && (
                          <button
                            onClick={handleSearch}
                            className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                          >
                            <Search className="w-5 h-5" />
                            {t.searchButton}
                          </button>
                        )}
                        
                        {/* Error message */}
                        {error && (
                          <p className="text-sm text-red-500">{error}</p>
                        )}
                        
                        {/* Analysis results after search */}
                        {results?.analysis && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t.detected}:</p>
                            <p className="font-medium text-gray-900 dark:text-white">{results.analysis.description}</p>
                            {results.analysis.keywords.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t.keywords}:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {results.analysis.keywords.map((kw, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loading */}
                    {isSearching && (
                      <div className="flex items-center justify-center gap-3 py-8">
                        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                        <span className="text-gray-600 dark:text-gray-300">{t.searching}</span>
                      </div>
                    )}

                    {/* Results */}
                    {results && !isSearching && (
                      <>
                        <div className="flex items-center justify-between border-t pt-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {t.closestProducts}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {results.count > 0 ? `${results.count} ${t.found}` : t.notFound}
                            </p>
                          </div>
                          <button
                            onClick={resetSearch}
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            {t.tryAnother}
                          </button>
                        </div>

                        {results.count > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                            {results.products.map((product) => (
                              <Link
                                key={product.id}
                                href={`/urun/${product.id}`}
                                onClick={() => setIsOpen(false)}
                                className="group bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                              >
                                <div className="relative aspect-square">
                                  <Image
                                    src={product.images[0] || '/placeholder.png'}
                                    alt={product.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform"
                                  />
                                </div>
                                <div className="p-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {product.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {product.category.name}
                                  </p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                    {product.valorPrice} Valor
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">
                            <p>{t.notFound}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
