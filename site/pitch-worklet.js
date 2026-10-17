// Stereo dual-window delay pitch shifter. The media clock runs at its original
// speed; overlapping read heads change pitch only. No playbackRate changes.
// Fixed 96 ms grains and bounded ring buffers avoid decoding whole music files.
class MPDFPitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'semitones', defaultValue: 0, minValue: -12, maxValue: 12, automationRate: 'k-rate' }] }
  constructor() {
    super()
    this.size = 32768
    this.buffers = [new Float32Array(this.size), new Float32Array(this.size)]
    this.write = 0; this.phase = 0; this.ratio = 1; this.wet = 0
    this.grain = Math.min(12000, Math.round(sampleRate * .096))
  }
  sample(channel, delay) {
    let p = (this.write - delay + this.size) % this.size
    const n = Math.floor(p), f = p - n, b = this.buffers[channel]
    return b[n] * (1 - f) + b[(n + 1) % this.size] * f
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0], output = outputs[0]
    if (!output?.length) return true
    const semitones = parameters.semitones[0]
    const target = Math.pow(2, semitones / 12), wetTarget = Math.abs(semitones) > .001 ? 1 : 0
    for (let i = 0; i < output[0].length; i++) {
      this.ratio += (target - this.ratio) * .002
      this.wet += (wetTarget - this.wet) * .002
      this.phase = (this.phase + (1 - this.ratio) / this.grain + 1) % 1
      const second = (this.phase + .5) % 1
      const weight = Math.sin(Math.PI * this.phase) ** 2
      for (let ch = 0; ch < Math.min(2, output.length); ch++) {
        const dry = input?.[ch]?.[i] ?? input?.[0]?.[i] ?? 0
        this.buffers[ch][this.write] = dry
        const shifted = this.sample(ch, 2 + this.phase * this.grain) * weight + this.sample(ch, 2 + second * this.grain) * (1 - weight)
        output[ch][i] = dry * (1 - this.wet) + shifted * this.wet
      }
      this.write = (this.write + 1) % this.size
    }
    return true
  }
}
registerProcessor('mpdf-pitch', MPDFPitchProcessor)
