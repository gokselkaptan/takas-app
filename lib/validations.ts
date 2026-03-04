import { z } from 'zod'

// ═══ ÜRÜN ═══
export const createProductSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter').max(200, 'Başlık en fazla 200 karakter').trim(),
  description: z.string().min(10, 'Açıklama en az 10 karakter').max(5000).trim(),
  valorPrice: z.number().int().min(1, 'Değer en az 1 Valor').max(100000, 'Değer en fazla 100000 Valor'),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).default('good'),
  categoryId: z.string().min(1, 'Kategori seçiniz'),
  city: z.string().default('İzmir'),
  district: z.string().optional(),
  images: z.array(z.string()).max(10, 'En fazla 10 görsel').optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  usageInfo: z.string().optional(),
  checklistData: z.string().optional(),
  userValorPrice: z.number().optional(),
  acceptsNegotiation: z.boolean().optional(),
  isFreeAvailable: z.boolean().optional(),
})

// ═══ TAKAS TEKLİFİ ═══
export const createSwapSchema = z.object({
  productId: z.string().min(1, 'Ürün ID gerekli'),
  message: z.string().max(1000, 'Mesaj en fazla 1000 karakter').optional(),
  offeredProductId: z.string().nullable().optional(),
  offeredValor: z.union([z.number(), z.string()]).optional().transform(val => {
    if (val === '' || val === null || val === undefined) return undefined
    return typeof val === 'string' ? parseInt(val, 10) : val
  }),
  quickOffer: z.boolean().optional(),
  smartMatch: z.boolean().optional(),
  previewOnly: z.boolean().optional(),
})

// ═══ MESAJ ═══
export const createMessageSchema = z.object({
  receiverId: z.string().min(1, 'Alıcı ID gerekli'),
  content: z.string().min(1, 'Mesaj boş olamaz').max(5000, 'Mesaj en fazla 5000 karakter').trim(),
  productId: z.string().optional(),
  image: z.string().optional(),
})

// ═══ PROFİL ═══
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter').max(100).trim().optional(),
  phone: z.string().regex(/^(\+90|0)?[0-9]{10}$/, 'Geçersiz telefon numarası').optional().nullable(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
})

// ═══ HİZMET ═══
export const createServiceSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter').max(200).trim(),
  description: z.string().min(10, 'Açıklama en az 10 karakter').max(5000).trim(),
  category: z.enum(['cleaning', 'electrical', 'plumbing', 'beauty', 'education', 'cooking', 'repair', 'delivery', 'design', 'photography', 'other']),
  duration: z.string().max(50),
  valorPrice: z.number().int().min(1, 'Değer en az 1 Valor').max(100000),
  city: z.string().default('İzmir'),
  district: z.string().optional(),
  serviceArea: z.string().optional(),
  wantCategory: z.string().optional(),
  wantDescription: z.string().max(500).optional(),
  listingType: z.enum(['individual', 'business']).default('individual'),
  businessName: z.string().max(200).optional(),
  businessType: z.string().optional(),
  unitType: z.string().optional(),
  unitCount: z.number().int().optional(),
  images: z.array(z.string()).optional(),
})

// ═══ İSTEK PANOSU ═══
export const createWishSchema = z.object({
  wantTitle: z.string().min(3, 'Başlık en az 3 karakter').max(200).trim(),
  wantDescription: z.string().max(2000).optional(),
  wantCategory: z.string().min(1, 'Kategori gerekli'),
  wantMinValue: z.number().int().min(0).optional(),
  wantMaxValue: z.number().int().max(100000).optional(),
  offerType: z.enum(['specific_product', 'category', 'any']).default('any'),
  preferredCity: z.string().optional(),
  isUrgent: z.boolean().default(false),
  offerProductId: z.string().optional(),
  offerCategory: z.string().optional(),
  offerTitle: z.string().optional(),
  offerDescription: z.string().optional(),
  offerMinValue: z.number().optional(),
  offerMaxValue: z.number().optional(),
  deadline: z.string().optional(),
  urgencyBonus: z.number().optional(),
})

// ═══ Yardımcı validate fonksiyonu ═══
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  error?: string 
} {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map(e => e.message).join(', ')
      return { success: false, error: messages }
    }
    return { success: false, error: 'Geçersiz veri' }
  }
}

// Safe parse - hata fırlatmaz, başarısızlık durumunda error döner
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  error?: string 
} {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const messages = result.error.errors.map(e => e.message).join(', ')
  return { success: false, error: messages }
}

// ═══ ŞİFRE GÜCÜ ═══
export const passwordSchema = z.string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(128, 'Şifre en fazla 128 karakter olabilir')
  .refine(val => /[A-Z]/.test(val), 'En az 1 büyük harf gerekli')
  .refine(val => /[a-z]/.test(val), 'En az 1 küçük harf gerekli')
  .refine(val => /[0-9]/.test(val), 'En az 1 rakam gerekli')

export const signupSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin').trim().toLowerCase(),
  password: passwordSchema,
  name: z.string().min(2, 'İsim en az 2 karakter').max(100).trim(),
  nickname: z.string().min(2).max(50).trim().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: passwordSchema,
})
