/* AudioWorklet wrapper: Dolphin engine → stereo output. Runs after dolphin-engine.js. */
class DolphinProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.eng = new DolphinEngine(sampleRate, 1234);
    this.vizEvery = Math.round(sampleRate / 30);
    this.vizCount = 0;
    // DSP load: time spent in the engine / length of audio produced. performance.now() where the
    // worklet has it; otherwise Date.now(), whose 1 ms steps average out over half a second
    this.hiRes = typeof performance !== 'undefined' && typeof performance.now === 'function';
    this.clock = this.hiRes ? () => performance.now() : () => Date.now();
    this.busyMs = 0; this.audioMs = 0; this.load = 0; this.peak = 0; this.winPeak = 0; this.peakAge = 0;
    this.port.onmessage = (e) => {
      const m = e.data, eng = this.eng;
      if (m.t === 'p') eng.setParam(m.id, m.v);
      else if (m.t === 'many') { for (const k in m.p) eng.setParam(k, m.p[k]); }
      else if (m.t === 'on') eng.noteOn(m.n, m.v);
      else if (m.t === 'off') eng.noteOff(m.n);
      else if (m.t === 'bend') eng.setBend(m.v);
      else if (m.t === 'tempo') eng.setTempo(m.v);
      else if (m.t === 'panic') eng.allNotesOff();
    };
    this.port.postMessage({ t: 'ready', sr: sampleRate, latency: DolphinEngine.LATENCY });
  }
  process(inputs, outputs) {
    const out = outputs[0], l = out[0], r = out[1] || null, n = l.length;
    const t0 = this.clock();
    this.eng.process(l, r, n);
    const spent = this.clock() - t0, len = n / sampleRate * 1000;
    this.busyMs += spent; this.audioMs += len;
    if (this.hiRes && spent / len > this.winPeak) this.winPeak = spent / len;
    if (this.audioMs >= 500) {
      this.load = this.busyMs / this.audioMs; this.busyMs = 0; this.audioMs = 0;
      // peak: the slowest single callback, held for 2 s
      if (this.winPeak >= this.peak || ++this.peakAge >= 4) { this.peak = this.winPeak; this.peakAge = 0; }
      this.winPeak = 0;
    }
    this.vizCount += n;
    if (this.vizCount >= this.vizEvery) {
      this.vizCount = 0;
      const i = this.eng.info;
      const e = this.eng;
      let kernels = 0; for (const v of e.voices) kernels += v.kN;
      this.port.postMessage({ t: 'stat', voices: i.voices, rate: i.rate, whistle: i.whistle, click: e.clickFc,
        load: this.load, peak: this.hiRes ? this.peak : -1, kernels, idle: !!i.idle,
        lfo: { t: Array.from(e.lfoTarget), ph: Array.from(e.lfoPhase), y: Array.from(e.lfoSm) } });
    }
    return true;
  }
}
registerProcessor('dolphin-processor', DolphinProcessor);
