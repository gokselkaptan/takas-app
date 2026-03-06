// Bildirim sesleri — SES KALDIRILDI, Vibration fallback aktif
// Ses dosyaları 404 verdiği için kaldırıldı - sadece titreşim kullanılıyor

let soundsUnlocked = false

export function isSoundEnabled(): boolean {
  try { return localStorage.getItem('takas-a-sound') !== 'off' } catch { return true }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem('takas-a-sound', enabled ? 'on' : 'off') } catch {}
}

export function getVolume(): number {
  try {
    const vol = localStorage.getItem('takas-a-volume')
    return vol ? parseFloat(vol) : 0.7
  } catch { return 0.7 }
}

export function setVolume(volume: number): void {
  try { localStorage.setItem('takas-a-volume', Math.min(1, Math.max(0, volume)).toString()) } catch {}
}

// Mobil için vibration fallback
function vibrateDevice(pattern: number[] = [200, 100, 200]): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
      console.log('[Sound] Vibration triggered:', pattern)
    }
  } catch (e) {
    console.log('[Sound] Vibration failed:', e)
  }
}

// Android autoplay policy bypass - legacy uyumluluk için bırakıldı
export function unlockAudioContext(): void {
  if (soundsUnlocked) return
  soundsUnlocked = true
  console.log('[Sound] Audio context unlock called (no-op, sounds disabled)')
}

// 🔔 Bildirim sesi - sadece titreşim
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([200, 100, 200])
}

// 💬 Mesaj sesi - sadece titreşim
export function playMessageSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([150, 75, 150])
}

// 🔄 Takas teklifi sesi - sadece titreşim
export function playSwapSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([300, 100, 300, 100, 300])
}

// 💰 Valor kazanma sesi - sadece titreşim
export function playCoinSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([100, 50, 100, 50, 200])
}

// 🎉 Eşleşme sesi - sadece titreşim
export function playMatchSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([200, 100, 200, 100, 400])
}

// Service Worker'dan gelen ses çalma komutunu işle - sadece titreşim
export function playSoundFromSW(soundPath: string): void {
  if (!isSoundEnabled()) return
  console.log('[Sound] SW sound request (vibration only):', soundPath)
  vibrateDevice([200, 100, 200])
}

// Legacy fonksiyon - titreşim
export function playNotificationSoundLegacy(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([200, 100, 200])
}

// ✅ Başarı sesi - sadece titreşim
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([100, 50, 100, 50, 100, 50, 200])
}

// 💡 Popup sesi - sadece titreşim
export function playPopupSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([50, 50, 50])
}
