// Reference engine tests. Run: node tests/engine-test.js
'use strict';
const path = require('path');
const { DolphinEngine, PARAMS, MOD_TARGETS } = require(path.join(__dirname, '..', 'reference', 'dolphin-engine.js'));
const { PRESETS } = require(path.join(__dirname, '..', 'reference', 'presets.js'));

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!ok) failed++;
}

function render(sr, seconds, setup, block) {
  const e = new DolphinEngine(sr, 1234);
  const n = Math.round(sr * seconds);
  const L = new Float32Array(n), R = new Float32Array(n);
  setup(e);
  const bl = block || 128;
  const tl = new Float32Array(bl), tr = new Float32Array(bl);
  for (let i = 0; i < n; i += bl) {
    const m = Math.min(bl, n - i);
    e.process(tl, tr, m);
    L.set(tl.subarray(0, m), i); R.set(tr.subarray(0, m), i);
  }
  return { e, L, R };
}

function apply(e, p) { for (const k in p) e.setParam(k, p[k]); }

// 1. pulse rate: counted onsets match the free rate
for (const rate of [1, 13, 100, 472, 2000]) {
  const secs = rate < 5 ? 4 : 2;
  const { e } = render(48000, secs, e => { apply(e, { register: 0, keytrack: 0, freerate: rate, jitter: 0, sustain: 1 }); e.noteOn(60, 100); });
  const want = rate * secs;
  check('pulse rate ' + rate + '/s', Math.abs(e.pulseCount - want) <= Math.max(1, want * 0.001) + 1, e.pulseCount + ' pulses, want ~' + want);
}

// 2. key-tracked rate: Rate 0 on A4 gives 440 pulses per second
{
  const { e } = render(48000, 1, e => { apply(e, { register: 0, keytrack: 1, rate: 0, jitter: 0, sustain: 1 }); e.noteOn(69, 100); });
  check('key-tracked rate', Math.abs(e.pulseCount - 440) <= 2, e.pulseCount + ' pulses');
}

// 3. onset timing: gaps are exact at a non-integer period
{
  const { e } = render(48000, 1, e => { apply(e, { register: 0, keytrack: 0, freerate: 287, jitter: 0, sustain: 1 }); e.onsets = []; e.noteOn(60, 100); });
  const o = e.onsets, period = 48000 * 4 / 287;
  let worst = 0;
  for (let i = 2; i < o.length; i++) worst = Math.max(worst, Math.abs(o[i] - o[i - 1] - period));
  check('sub-sample onsets', worst < 1e-6 * period + 1e-3, 'worst gap error ' + worst.toExponential(2) + ' samples at 4x');
}

// 4. coda patterns: gap ratios
function codaGaps(pattern, n) {
  const { e } = render(48000, 3, e => { apply(e, { register: 0, keytrack: 0, freerate: 10, jitter: 0, coda: n, pattern, sustain: 1 }); e.onsets = []; e.noteOn(60, 100); });
  const o = e.onsets, g = [];
  for (let i = 1; i < n; i++) g.push(o[i] - o[i - 1]);
  return { g, rest: o[n] - o[n - 1] };
}
{
  const r = codaGaps(0, 5);
  check('coda regular', r.g.every(x => Math.abs(x / r.g[0] - 1) < 1e-6), r.g.map(x => (x / 768).toFixed(3)).join(' ') + ' (rest ' + (r.rest / r.g[0]).toFixed(2) + 'x)');
  const inc = codaGaps(1, 5);
  check('coda increasing', inc.g.slice(1).every((x, i) => Math.abs(x / inc.g[i] - 1.15) < 1e-6));
  const dec = codaGaps(2, 5);
  check('coda decreasing', dec.g.slice(1).every((x, i) => Math.abs(x / dec.g[i] - 0.87) < 1e-6));
  const grp = codaGaps(3, 5);
  check('coda grouped 1+1+3', Math.abs(grp.g[0] / grp.g[2] - 4) < 1e-6 && Math.abs(grp.g[1] / grp.g[3] - 4) < 1e-6, grp.g.map(x => (x / 768).toFixed(2)).join(' '));
}

// 5. whistle pitch: knob mode, smallest size, A4 → 7040 Hz
function zcFreq(x, sr, from) {
  let c = 0, first = -1, last = -1;
  for (let i = from + 1; i < x.length; i++) if (x[i - 1] <= 0 && x[i] > 0) {
    const t = i - 1 + x[i - 1] / (x[i - 1] - x[i]);
    if (first < 0) first = t; last = t; c++;
  }
  return (c - 1) / ((last - first) / sr);
}
{
  const { L } = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, pitch: 0, harmonics: 0, size: 0, sustain: 1, spread: 0 }); e.noteOn(69, 100); });
  const f = zcFreq(L, 48000, 4800);
  check('whistle pitch A4 small', Math.abs(1200 * Math.log2(f / 7040)) < 10, f.toFixed(1) + ' Hz');
  const big = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, pitch: 0, harmonics: 0, size: 1, sustain: 1, spread: 0 }); e.noteOn(69, 100); });
  const fb = zcFreq(big.L, 48000, 4800);
  check('whistle pitch A4 large', Math.abs(1200 * Math.log2(fb / 440)) < 10, fb.toFixed(1) + ' Hz');
  const mid = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, harmonics: 0, size: 0.4, sizemode: 0, sustain: 1, spread: 0 }); e.noteOn(69, 100); });
  const fm = zcFreq(mid.L, 48000, 4800);
  check('size octaves mode stays in tune', Math.abs(1200 * Math.log2(fm / 1760)) < 10, fm.toFixed(1) + ' Hz');
  const cont = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, harmonics: 0, size: 0.4, sizemode: 1, sustain: 1, spread: 0 }); e.noteOn(69, 100); });
  const fc = zcFreq(cont.L, 48000, 4800), want = 440 * Math.pow(2, 4 * 0.6);
  check('size continuous mode', Math.abs(1200 * Math.log2(fc / want)) < 10, fc.toFixed(1) + ' Hz, want ' + want.toFixed(1));
  const bend = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, harmonics: 0, size: 1, sustain: 1, spread: 0, bendrange: 12 }); e.setBend(1); e.noteOn(69, 100); });
  const fbd = zcFreq(bend.L, 48000, 4800);
  check('pitch bend +12', Math.abs(1200 * Math.log2(fbd / 880)) < 10, fbd.toFixed(1) + ' Hz');
}

// 6. whistle envelope: Up sweep ends Sweep octaves above the start
{
  const { L } = render(48000, 1.6, e => { apply(e, { register: 1, pitchmode: 0, shape: 1, sweep: 1, time: 0.5, harmonics: 0, size: 1, sustain: 1, spread: 0 }); e.noteOn(57, 100); });
  const f = zcFreq(L.subarray(0, 48000 * 1.6), 48000, 48000);
  check('envelope Up reaches +1 octave', Math.abs(1200 * Math.log2(f / 440)) < 15, f.toFixed(1) + ' Hz after the sweep');
}

// 7. band limit: no energy above 20 kHz at 44.1 kHz
function bandEnergy(x, sr, f0, f1, step) {
  let e = 0; const N = x.length;
  for (let f = f0; f <= f1; f += step) {
    let re = 0, im = 0; const w = 2 * Math.PI * f / sr;
    for (let i = 0; i < N; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); re += x[i] * h * Math.cos(w * i); im += x[i] * h * Math.sin(w * i); }
    e += re * re + im * im;
  }
  return e;
}
{
  const cases = [
    ['whistle, 3 harmonics, high note', { register: 1, pitchmode: 1, harmonics: 3, harmlevel: 0, size: 0, sustain: 1 }, 76],
    ['narrow bright clicks', { register: 0, keytrack: 0, freerate: 700, clickwidth: 0.05, clicktone: 2, sustain: 1 }, 60],
  ];
  for (const [name, p, note] of cases) {
    const { L } = render(44100, 0.4, e => { apply(e, p); e.noteOn(note, 127); });
    const x = L.subarray(4410, 4410 + 4096);
    const hi = bandEnergy(x, 44100, 20000, 22000, 100);
    const all = bandEnergy(x, 44100, 100, 22000, 100);
    const db = 10 * Math.log10(hi / all + 1e-30);
    check('band limit: ' + name, db < -50, db.toFixed(1) + ' dB above 20 kHz');
  }
}

// 8. biphonation: sidebands at whistle ± rate
{
  const sr = 48000;
  const { L } = render(sr, 0.5, e => { apply(e, { register: 1, biphon: 1, pitchmode: 1, harmonics: 0, size: 0, keytrack: 0, freerate: 1000, sustain: 1, spread: 0 }); e.noteOn(69, 100); });
  const x = L.subarray(4800, 4800 + 8192);
  const at = f => bandEnergy(x, sr, f, f, 1);
  const c = at(7040), lo = at(6040), hi = at(8040), off = at(7540);
  check('biphonation sidebands', lo > c * 0.02 && hi > c * 0.02 && off < lo * 0.05, 'centre ' + c.toExponential(1) + ', sidebands ' + lo.toExponential(1) + '/' + hi.toExponential(1) + ', between ' + off.toExponential(1));
}

// 9. determinism across host buffer sizes
{
  const setup = e => { apply(e, { register: 0.5, jitter: 0.4, rubato: 0.5, ornament: 0.5, coda: 4, keytrack: 0, freerate: 40, ring: 0.5, biphon: 0.3 }); e.noteOn(60, 100); e.noteOn(67, 90); };
  const a = render(48000, 1, setup, 1).L, b = render(48000, 1, setup, 64).L, c = render(48000, 1, setup, 1024).L;
  let same = true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] || a[i] !== c[i]) { same = false; break; }
  check('same output at buffer sizes 1, 64, 1024', same);
}

// 10. every factory test preset renders: not silent, no clipping, no NaN
for (const pr of PRESETS) {
  const { e, L, R } = render(48000, 1.5, e => { apply(e, pr.p); e.noteOn(pr.note, 100); });
  let peak = 0, nan = false;
  for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (!(v === v)) nan = true; if (v > peak) peak = v; }
  let rateOk = true, rateTxt = '';
  if (pr.targetRate) {  // 0 = modulated rate, not checked
    const want = pr.targetRate * 1.5 * (pr.p.coda ? 0.5 : 1);
    rateTxt = ', ' + e.pulseCount + ' pulses';
    if (!pr.p.coda) rateOk = Math.abs(e.pulseCount - pr.targetRate * 1.5) <= pr.targetRate * 1.5 * 0.1 + 2;
    else rateOk = e.pulseCount > 0;
    void want;
  }
  check('preset: ' + pr.name, !nan && peak > 0.01 && peak < 0.999 && rateOk, 'peak ' + peak.toFixed(3) + rateTxt);
}

// 11. whistle transpose moves the whistle only
{
  const { e, L } = render(48000, 0.6, e => { apply(e, { register: 1, pitchmode: 1, harmonics: 0, size: 1, sustain: 1, spread: 0, wtranspose: 12, keytrack: 1, rate: 0 }); e.noteOn(69, 100); });
  const f = zcFreq(L, 48000, 4800);
  check('whistle transpose +12', Math.abs(1200 * Math.log2(f / 880)) < 10, f.toFixed(1) + ' Hz');
  check('whistle transpose leaves pulse rate alone', Math.abs(e.pulseCount - 0.6 * 440) <= 2, e.pulseCount + ' pulses');
}

// 12. LFOs: dormant without a target, exact when used
{
  const base = e => { apply(e, { register: 0.5, keytrack: 0, freerate: 40, jitter: 0.3, sustain: 1 }); e.noteOn(60, 100); e.noteOn(64, 100); };
  const plain = render(48000, 1, base).L;
  const t0 = Date.now(); render(48000, 1, base); const tPlain = Date.now() - t0;
  const parked = e => { for (let n = 1; n <= 4; n++) apply(e, { ['lfo' + n + 'target']: 0, ['lfo' + n + 'shape']: 6, ['lfo' + n + 'rate']: 30, ['lfo' + n + 'from']: 0.1, ['lfo' + n + 'to']: 0.9 }); base(e); };
  const t1 = Date.now(); const idle = render(48000, 1, parked).L; const tIdle = Date.now() - t1;
  let same = true; for (let i = 0; i < plain.length; i++) if (plain[i] !== idle[i]) { same = false; break; }
  check('LFOs without a target change nothing', same, 'render ' + tPlain + ' ms plain, ' + tIdle + ' ms with 4 parked LFOs');
  const pitchIdx = MOD_TARGETS.indexOf('pitch') + 1;
  // square LFO on Pitch: first half cycle at From (0 oct), second at To (+1 oct)
  const { L } = render(48000, 2, e => { apply(e, { register: 1, pitchmode: 1, harmonics: 0, size: 1, sustain: 1, spread: 0,
    lfo1target: pitchIdx, lfo1shape: 4, lfo1rate: 0.5, lfo1from: 0.5, lfo1to: 0.5 + 1 / 6 }); e.noteOn(69, 100); });
  const fa = zcFreq(L.subarray(0, 48000 * 0.9), 48000, 9600), fb = zcFreq(L.subarray(0, 48000 * 1.9), 48000, 48000 * 1.1);
  check('LFO square on Pitch: From then To', Math.abs(1200 * Math.log2(fa / 440)) < 10 && Math.abs(1200 * Math.log2(fb / 880)) < 10, fa.toFixed(1) + ' Hz, then ' + fb.toFixed(1) + ' Hz');
  check('LFO sync: 2 Hz at 120 BPM is a quarter note', DolphinEngine.lfoBeats(2, 120) === 1 && DolphinEngine.lfoBeats(3.1, 120) === 2 / 3);
  // ramp on Free rate from 10 to 1000 per second: more pulses than either end alone would give in a second
  const rateIdx = MOD_TARGETS.indexOf('freerate') + 1;
  const r = render(48000, 1, e => { apply(e, { register: 0, keytrack: 0, sustain: 1, jitter: 0, lfo1target: rateIdx, lfo1shape: 2, lfo1rate: 1, lfo1from: 0, lfo1to: 1 }); e.noteOn(60, 100); });
  check('LFO ramp on Free rate sweeps it', r.e.pulseCount > 100 && r.e.pulseCount < 2000, r.e.pulseCount + ' pulses in 1 s');
  const setup = e => { apply(e, { register: 0.5, jitter: 0.4, keytrack: 0, freerate: 40, lfo1target: pitchIdx, lfo1shape: 6, lfo1rate: 7, lfo2target: rateIdx, lfo2shape: 5, lfo2rate: 3, lfo2retrig: 1 }); e.noteOn(60, 100); e.noteOn(67, 90); };
  const a = render(48000, 1, setup, 1).L, b = render(48000, 1, setup, 64).L, c = render(48000, 1, setup, 1024).L;
  let eq = true; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] || a[i] !== c[i]) { eq = false; break; }
  check('random LFOs repeat exactly at buffer sizes 1, 64, 1024', eq);
}

check('64 parameters (36 sound + 4 LFOs x 7)', PARAMS.length === 64, PARAMS.length + '');
console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
