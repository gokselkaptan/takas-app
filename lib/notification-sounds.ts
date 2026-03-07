// Web Audio API ile bildirim sesleri — MP3 dosyası kullanmadan JavaScript ile ses üretimi

let audioCtx: AudioContext | null = null
let soundsUnlocked = false

// AudioContext singleton
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioCtx
}

// Ses ayarları
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
    }
  } catch (e) {}
}

// playTone helper - tek nota çalma
function playTone(
  frequency: number, 
  duration: number, 
  type: OscillatorType = 'sine', 
  volume = 0.3, 
  delay = 0
): void {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
    gain.gain.setValueAtTime(volume * getVolume(), ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime + delay + duration)
  } catch (e) {}
}

// Android/iOS autoplay policy bypass
export function unlockAudio(): void {
  if (soundsUnlocked) return
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    // Sessiz ses çal
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.001)
    soundsUnlocked = true
  } catch (e) {}
}

// Legacy uyumluluk
export function unlockAudioContext(): void {
  unlockAudio()
}

// 💬 Mesaj sesi - çift ding (880Hz → 1100Hz)
export function playMessageSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([150, 75, 150])
  playTone(880, 0.15, 'sine', 0.3, 0)
  playTone(1100, 0.15, 'sine', 0.3, 0.15)
}

// 🔄 Takas teklifi sesi - üç nota artan (C5, E5, G5)
export function playSwapOfferSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([300, 100, 300, 100, 300])
  playTone(523.25, 0.12, 'sine', 0.25, 0)      // C5
  playTone(659.25, 0.12, 'sine', 0.25, 0.12)   // E5
  playTone(783.99, 0.18, 'sine', 0.3, 0.24)    // G5
}

// 🎉 Eşleşme sesi - zafer fanfarı (C majör akor)
export function playMatchSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([200, 100, 200, 100, 400])
  // C majör akor - aynı anda çalan notalar
  playTone(523.25, 0.4, 'sine', 0.2, 0)    // C5
  playTone(659.25, 0.4, 'sine', 0.2, 0)    // E5
  playTone(783.99, 0.4, 'sine', 0.2, 0)    // G5
  // Ardından yüksek C
  playTone(1046.5, 0.3, 'sine', 0.3, 0.4)  // C6
}

// 💰 Coin/Valor kazanma sesi - metalik coin
export function playCoinSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([100, 50, 100, 50, 200])
  playTone(1200, 0.08, 'square', 0.15, 0)
  playTone(1800, 0.08, 'square', 0.12, 0.06)
  playTone(2400, 0.15, 'sine', 0.1, 0.12)
}

// 🔔 Bildirim sesi - tek ding
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([200, 100, 200])
  playTone(880, 0.2, 'sine', 0.3, 0)
}

// ❌ Hata sesi - iki inen nota
export function playErrorSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([300, 100, 300])
  playTone(440, 0.15, 'sawtooth', 0.2, 0)
  playTone(330, 0.2, 'sawtooth', 0.25, 0.15)
}

// ✅ Başarı sesi
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([100, 50, 100, 50, 100, 50, 200])
  playTone(523.25, 0.1, 'sine', 0.25, 0)
  playTone(659.25, 0.1, 'sine', 0.25, 0.1)
  playTone(783.99, 0.2, 'sine', 0.3, 0.2)
}

// 💡 Popup sesi
export function playPopupSound(): void {
  if (!isSoundEnabled()) return
  vibrateDevice([50, 50, 50])
  playTone(600, 0.1, 'sine', 0.2, 0)
}

// Legacy uyumluluk - playSwapSound
export function playSwapSound(): void {
  playSwapOfferSound()
}

// Service Worker'dan gelen ses çalma komutunu işle
export function playSoundFromSW(soundPath: string): void {
  if (!isSoundEnabled()) return
  // Ses tipine göre uygun fonksiyonu çağır
  if (soundPath.includes('message')) {
    playMessageSound()
  } else if (soundPath.includes('swap') || soundPath.includes('offer')) {
    playSwapOfferSound()
  } else if (soundPath.includes('match')) {
    playMatchSound()
  } else if (soundPath.includes('coin') || soundPath.includes('valor')) {
    playCoinSound()
  } else {
    playNotificationSound()
  }
}

// Legacy fonksiyon
export function playNotificationSoundLegacy(): void {
  playNotificationSound()
}
