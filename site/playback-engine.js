// File/HTTPS transport. Embedded audio can use a shared pitch graph; mixing
// happens before pitch shifting so the source and retimed chords stay together.
export class PlaybackEngine {
  constructor({ onState = () => {}, onError = () => {} } = {}) {
    this.audio = new Audio(); this.follower = null; this.onState = onState; this.onError = onError
    this.audio.preload = 'metadata'; this.audio.playsInline = true
    this.audio.addEventListener('play', () => this.onState(true))
    this.audio.addEventListener('pause', () => this.onState(false))
    this.audio.addEventListener('ended', () => this.onState(false))
    this.audio.addEventListener('error', () => { if (!this.closed) this.onError(new Error('media')) })
    this.context = null; this.pitchNode = null; this.sources = []; this.closed = false; this.pitch = 0
    this.firstBar = 0; this.lastCorrection = 0; this.local = false; this.graphPromise = null; this.loadRejects = new Set()
  }
  async load(url, { local = false, followerURL = null, firstBar = 0 } = {}) {
    this.local = local; this.firstBar = firstBar
    if (followerURL) {
      this.follower = new Audio(); this.follower.preload = 'auto'; this.follower.playsInline = true
      this.follower.addEventListener('error', () => { if (!this.closed) this.onError(new Error('follower')) })
    }
    await Promise.all([this.loadMedia(this.audio, url), this.follower ? this.loadMedia(this.follower, followerURL) : null])
  }
  loadMedia(media, url) {
    return new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); media.removeEventListener('loadedmetadata', ready); media.removeEventListener('error', failed); this.loadRejects.delete(failed) }
      const ready = () => { done(); resolve() }
      const failed = () => { done(); reject(new Error('media')) }
      const timer = setTimeout(() => { done(); reject(new Error('timeout')) }, 20000)
      this.loadRejects.add(failed)
      media.addEventListener('loadedmetadata', ready); media.addEventListener('error', failed)
      media.src = url; media.load()
    })
  }
  get currentTime() { return this.audio.currentTime || 0 }
  get duration() { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0 }
  get playing() { return !this.audio.paused && !this.audio.ended }
  async play() {
    if (this.closed) return
    if (this.context?.state === 'suspended') await this.context.resume()
    await this.audio.play()
    if (this.closed) { this.pause(); return }
    await this.synchronize(true, true)
  }
  pause() { this.audio.pause(); this.follower?.pause() }
  seek(seconds) {
    this.audio.currentTime = Math.max(0, Math.min(this.duration || seconds, seconds))
    this.synchronize(this.playing, true)
  }
  async synchronize(playing, force = false) {
    const follower = this.follower
    if (!follower || this.closed) return
    const target = this.currentTime - this.firstBar
    if (!playing || target < 0 || !Number.isFinite(follower.duration) || target >= follower.duration) { follower.pause(); return }
    const now = performance.now()
    if (force || (now - this.lastCorrection > 500 && Math.abs(follower.currentTime - target) > .09)) {
      follower.currentTime = target; this.lastCorrection = now
    }
    if (follower.paused) {
      follower.currentTime = target
      try { await follower.play() } catch (error) { if (!this.closed) this.onError(error) }
    }
  }
  async setPitch(semitones) {
    if (!this.local || this.closed) throw new Error('local-only')
    if (!this.graphPromise) {
      this.graphPromise = this.createPitchGraph().catch(error => { this.graphPromise = null; throw error })
    }
    await this.graphPromise
    if (this.closed) return
    await this.context.resume()
    this.pitch = Math.max(-12, Math.min(12, semitones))
    this.pitchNode.parameters.get('semitones').setValueAtTime(this.pitch, this.context.currentTime)
  }
  async createPitchGraph() {
    const Context = window.AudioContext || window.webkitAudioContext
    if (!Context || !window.AudioWorkletNode) throw new Error('worklet-unavailable')
    const context = new Context({ latencyHint: 'playback' })
    this.context = context
    try {
      await context.resume()
      await context.audioWorklet.addModule(new URL('./pitch-worklet.js', import.meta.url))
      if (this.closed) return
      this.pitchNode = new AudioWorkletNode(context, 'mpdf-pitch', { outputChannelCount: [2] })
      this.pitchNode.connect(context.destination)
      for (const media of [this.audio, this.follower].filter(Boolean)) {
        const source = context.createMediaElementSource(media)
        source.connect(this.pitchNode); this.sources.push(source)
      }
    } catch (error) { await context.close().catch(() => {}); this.context = null; throw error }
  }
  destroy() {
    this.closed = true; this.pause(); for (const reject of [...this.loadRejects]) reject()
    for (const media of [this.audio, this.follower].filter(Boolean)) { media.removeAttribute('src'); media.load() }
    this.sources.forEach(source => source.disconnect()); this.pitchNode?.disconnect()
    this.context?.close().catch(() => {})
  }
}

// Native score/chord files are already retimed by the app's audioSyncMap.
// Their zero corresponds to the first source anchor, not source-file zero.
export function publicationOffset(publication) {
  const first = publication?.audioSyncMap?.anchors?.[0]?.seconds
  return Number.isFinite(first) && first >= 0 ? first : Math.max(0, Number(publication?.sourceStartSeconds) || 0)
}
export function interpolateSync(anchors, value, input = 'seconds', output = 'tick') {
  if (!Array.isArray(anchors) || anchors.length < 2) return null
  if (value <= anchors[0][input]) return anchors[0][output]
  if (value >= anchors.at(-1)[input]) return anchors.at(-1)[output]
  let lo = 0, hi = anchors.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (anchors[m][input] <= value) lo = m; else hi = m }
  const a = anchors[lo], b = anchors[hi], fraction = (value - a[input]) / (b[input] - a[input])
  return a[output] + fraction * (b[output] - a[output])
}
