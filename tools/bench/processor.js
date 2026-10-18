/* AudioWorklet wrapper: Dolphin engine → stereo output. Runs after dolphin-engine.js. */
class DolphinProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.eng = new DolphinEngine(sampleRate, 1234);
    this.vizEvery = Math.round(sampleRate / 30);
    this.vizCount = 0;
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
    this.eng.process(l, r, n);
    this.vizCount += n;
    if (this.vizCount >= this.vizEvery) {
      this.vizCount = 0;
      const i = this.eng.info;
      this.port.postMessage({ t: 'stat', voices: i.voices, rate: i.rate, whistle: i.whistle, click: this.eng.clickFc });
    }
    return true;
  }
}
registerProcessor('dolphin-processor', DolphinProcessor);
