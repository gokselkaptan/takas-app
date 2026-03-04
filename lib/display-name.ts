/**
 * Display Name Utility
 * Kullanıcı adını görüntülemek için yardımcı fonksiyonlar
 * 
 * Öncelik sırası:
 * 1. Nickname (varsa)
 * 2. İsim + Soyismin ilk harfi (örn: "Ahmet K.")
 * 3. Email'in @ öncesi kısmı
 */

export interface UserForDisplay {
  name?: string | null
  nickname?: string | null
  email?: string
}

/**
 * Kullanıcının görünen adını döndürür
 * @param user - User objesi (name, nickname, email alanları)
 * @returns Görünen ad
 */
export function getDisplayName(user: UserForDisplay | null | undefined): string {
  if (!user) return 'Anonim'

  // 1. Nickname varsa kullan
  if (user.nickname && user.nickname.trim()) {
    return user.nickname.trim()
  }

  // 2. İsim varsa, İsim + Soyismin ilk harfi formatında göster
  if (user.name && user.name.trim()) {
    const parts = user.name.trim().split(' ').filter(p => p.length > 0)
    
    if (parts.length === 1) {
      // Tek isim varsa direkt göster
      return parts[0]
    } else if (parts.length >= 2) {
      // İsim + Soyismin ilk harfi
      const firstName = parts[0]
      const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
      return `${firstName} ${lastInitial}.`
    }
  }

  // 3. Email varsa @ öncesini kullan
  if (user.email) {
    const emailPart = user.email.split('@')[0]
    return emailPart.length > 15 ? emailPart.substring(0, 15) + '...' : emailPart
  }

  return 'Anonim'
}

/**
 * Kullanıcının tam adını döndürür (admin paneli için)
 * @param user - User objesi
 * @returns Tam ad veya email
 */
export function getFullName(user: UserForDisplay | null | undefined): string {
  if (!user) return 'Anonim'
  
  if (user.name && user.name.trim()) {
    return user.name.trim()
  }
  
  if (user.email) {
    return user.email.split('@')[0]
  }
  
  return 'Anonim'
}

/**
 * Kullanıcının nickname'i var mı kontrol eder
 */
export function hasNickname(user: UserForDisplay | null | undefined): boolean {
  return !!(user?.nickname && user.nickname.trim())
}
