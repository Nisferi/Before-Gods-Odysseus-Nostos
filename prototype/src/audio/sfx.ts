// Procedural audio — no sample files, every voice is synthesized at runtime.
// The soundscape of a world the gods are leaving: no melody, only things making noise.

let ac: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let ambient: { stop: () => void } | null = null
let muted = false

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ac) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ac = new AC()
    master = ac.createGain()
    master.gain.value = 0.3
    master.connect(ac.destination)
    const len = Math.floor(ac.sampleRate * 2)
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

/** Short pitched voice with an exponential decay. */
function tone(
  freq: number, dur: number, type: OscillatorType, vol: number,
  freqTo?: number, delay = 0
) {
  const c = ensure()
  if (!c || !master || muted) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g); g.connect(master)
  osc.start(t0); osc.stop(t0 + dur + 0.02)
}

/** Filtered noise burst — impacts, whooshes, footfalls. */
function noise(
  dur: number, vol: number, filter: BiquadFilterType,
  f0: number, f1: number, q = 1, delay = 0
) {
  const c = ensure()
  if (!c || !master || !noiseBuf || muted) return
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const bq = c.createBiquadFilter()
  bq.type = filter
  bq.Q.value = q
  bq.frequency.setValueAtTime(f0, t0)
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.01, dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bq); bq.connect(g); g.connect(master)
  src.start(t0); src.stop(t0 + dur + 0.02)
}

export const sfx = {
  /** Must run inside a user gesture — browsers block audio otherwise. */
  unlock() { ensure() },

  get muted() { return muted },
  toggle() {
    muted = !muted
    if (master) master.gain.value = muted ? 0 : 0.3
    if (muted) sfx.stopAmbient()
    return muted
  },

  // ── Player ──
  swing(combo = 0) {
    noise(0.12, 0.28, 'bandpass', 900 + combo * 350, 2600 + combo * 500, 1.4)
  },
  hit(heavy = false) {
    tone(heavy ? 90 : 150, 0.1, 'sine', 0.42, heavy ? 40 : 60)
    noise(0.08, 0.3, 'lowpass', 2600, 500, 1)
  },
  parry() {
    tone(1750, 0.16, 'square', 0.14, 2300)
    tone(2480, 0.2, 'triangle', 0.1, 1900)
    noise(0.07, 0.16, 'highpass', 3200, 5200, 2)
  },
  hurt() {
    tone(240, 0.24, 'sawtooth', 0.22, 70)
    noise(0.14, 0.16, 'lowpass', 1200, 260, 1)
  },
  jump()   { tone(320, 0.13, 'triangle', 0.13, 640) },
  land()   { noise(0.11, 0.2, 'lowpass', 700, 130, 1); tone(90, 0.09, 'sine', 0.16, 55) },
  step()   { noise(0.045, 0.055, 'bandpass', 1500, 700, 1.2) },
  dash()   { noise(0.2, 0.22, 'bandpass', 500, 2800, 1.1) },
  pickup() { tone(680, 0.1, 'sine', 0.16, 700); tone(1020, 0.22, 'sine', 0.13, 1040, 0.07) },
  enemyDie() {
    tone(180, 0.34, 'sawtooth', 0.18, 45)
    noise(0.3, 0.2, 'lowpass', 1600, 180, 0.8)
  },
  slam() {
    tone(64, 0.55, 'sine', 0.5, 28)
    noise(0.4, 0.32, 'lowpass', 900, 90, 0.7)
  },
  bossRoar() {
    tone(120, 0.9, 'sawtooth', 0.2, 52)
    tone(76, 1.1, 'square', 0.12, 40)
    noise(0.8, 0.14, 'lowpass', 700, 150, 0.6)
  },
  portal() {
    tone(220, 0.6, 'sine', 0.14, 880)
    tone(330, 0.7, 'triangle', 0.1, 1320, 0.05)
  },

  // ── Ambience: surf and distant fire, looped and slowly modulated ──
  startAmbient() {
    const c = ensure()
    if (!c || !master || ambient || muted || !noiseBuf) return
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const g = c.createGain()
    g.gain.value = 0.05
    // slow swell — waves rolling in
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.13
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.032
    lfo.connect(lfoGain); lfoGain.connect(g.gain)
    src.connect(lp); lp.connect(g); g.connect(master)
    src.start(); lfo.start()
    ambient = {
      stop: () => {
        try { src.stop(); lfo.stop() } catch { /* already stopped */ }
      },
    }
  },
  stopAmbient() {
    ambient?.stop()
    ambient = null
  },
}
