// Bildirim sesleri — Web Audio API (harici dosya gerekmez!)

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
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
    return vol ? parseFloat(vol) : 0.5
  } catch { return 0.5 }
}

export function setVolume(volume: number): void {
  try { localStorage.setItem('takas-a-volume', Math.min(1, Math.max(0, volume)).toString()) } catch {}
}

// 🔔 Bildirim sesi — kısa "ding"
export function playNotificationSound(): void {
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
  } catch {}
}

// 💬 Mesaj sesi — yumuşak "blop"
export function playMessageSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(523, ctx.currentTime)
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08)
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol * 0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
  } catch {}
}

// 🔄 Takas teklifi sesi — "ta-da!"
export function playSwapSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const notes = [
      { freq: 523, start: 0, dur: 0.15 },
      { freq: 659, start: 0.15, dur: 0.15 },
      { freq: 784, start: 0.3, dur: 0.3 },
    ]
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    })
  } catch {}
}

// 💰 Valor kazanma sesi — "ching!"
export function playCoinSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1318, ctx.currentTime)
    osc.frequency.setValueAtTime(1568, ctx.currentTime + 0.05)
    osc.frequency.setValueAtTime(2093, ctx.currentTime + 0.1)
    osc.type = 'triangle'
    gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

// ✅ Başarı sesi — jingle
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const startTime = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(vol * 0.25, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2)
      osc.start(startTime)
      osc.stop(startTime + 0.2)
    })
  } catch {}
}

// 💡 Popup sesi — yumuşak "pop"
export function playPopupSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    const vol = getVolume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.setValueAtTime(550, ctx.currentTime + 0.05)
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol * 0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {}
}
