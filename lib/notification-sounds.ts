// Bildirim sesleri — Audio dosyası + Web Audio API fallback + Vibration fallback
// Android Chrome autoplay policy: kullanıcı etkileşimi gerektirir

let audioContext: AudioContext | null = null
let soundsUnlocked = false
const audioCache: Map<string, HTMLAudioElement> = new Map()

// Ses dosyalarını önceden yükle ve cache'le
const SOUND_FILES = {
  notification: '/sounds/notification.mp3',
  message: '/sounds/message.mp3',
  swap: '/sounds/swap-offer.mp3',
  coin: '/sounds/coin.mp3',
  match: '/sounds/match.mp3'
}

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
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

// Audio dosyası ile ses çal (Android için daha güvenilir)
function playAudioFile(soundPath: string, vibrationPattern: number[] = [200, 100, 200]): void {
  try {
    // Cache'den al veya yeni oluştur
    let audio = audioCache.get(soundPath)
    if (!audio) {
      audio = new Audio(soundPath)
      audio.preload = 'auto'
      audioCache.set(soundPath, audio)
    }
    
    audio.volume = getVolume()
    audio.currentTime = 0
    
    const playPromise = audio.play()
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[Sound] Audio played:', soundPath)
        })
        .catch((error) => {
          console.log('[Sound] Audio play failed, trying vibration:', error.message)
          // Ses çalamazsa titreşim yap
          vibrateDevice(vibrationPattern)
        })
    }
  } catch (error) {
    console.log('[Sound] Audio error, fallback to vibration:', error)
    vibrateDevice(vibrationPattern)
  }
}

// Android autoplay policy bypass - sayfa ile ilk etkileşimde çağır
export function unlockAudioContext(): void {
  if (soundsUnlocked) return
  
  try {
    // AudioContext'i resume et
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[Sound] AudioContext resumed')
      })
    }
    
    // Tüm ses dosyalarını sessiz şekilde yükle ve hazırla
    Object.values(SOUND_FILES).forEach(soundPath => {
      const audio = new Audio(soundPath)
      audio.volume = 0
      audio.preload = 'auto'
      const playPromise = audio.play()
      if (playPromise) {
        playPromise.then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.volume = getVolume()
          audioCache.set(soundPath, audio)
        }).catch(() => {})
      }
    })
    
    soundsUnlocked = true
    console.log('[Sound] Audio unlocked for mobile')
  } catch (e) {
    console.log('[Sound] Unlock failed:', e)
  }
}

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

// 🔔 Bildirim sesi
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.notification, [200, 100, 200])
}

// 💬 Mesaj sesi
export function playMessageSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.message, [150, 75, 150])
}

// 🔄 Takas teklifi sesi
export function playSwapSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.swap, [300, 100, 300, 100, 300])
}

// 💰 Valor kazanma sesi
export function playCoinSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.coin, [100, 50, 100, 50, 200])
}

// 🎉 Eşleşme sesi
export function playMatchSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.match, [200, 100, 200, 100, 400])
}

// Service Worker'dan gelen ses çalma komutunu işle
export function playSoundFromSW(soundPath: string): void {
  if (!isSoundEnabled()) return
  console.log('[Sound] Playing from SW:', soundPath)
  playAudioFile(soundPath, [200, 100, 200])
}

// Legacy AudioContext based sounds (fallback) - DEPRECATED ama geriye uyumluluk için kalıyor
export function playNotificationSoundLegacy(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1)
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    vibrateDevice([200, 100, 200])
  }
}

// ✅ Başarı sesi
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.match, [100, 50, 100, 50, 100, 50, 200])
}

// 💡 Popup sesi
export function playPopupSound(): void {
  if (!isSoundEnabled()) return
  playAudioFile(SOUND_FILES.notification, [50, 50, 50])
}
