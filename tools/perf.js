// Performance benchmark for the reference engine. Run: node tools/perf.js [seconds]
// Prints how much of one CPU core each scenario needs to run in real time at 48 kHz.
// This is the JS reference; the C++ port will be faster, but the ratios between scenarios carry over.
'use strict';
const path = require('path');
const { DolphinEngine } = require(path.join(__dirname, '..', 'reference', 'dolphin-engine.js'));

const SR = 48000, SECS = +process.argv[2] || 3, BL = 128;
const chord = [48, 52, 55, 60, 64, 67, 71, 74];
const SCENARIOS = [
  ['Silent (no notes)', {}, []],
  ['1 voice, whistle only', { register: 1 }, [69]],
  ['1 voice, pulses 13/s', { register: 0, keytrack: 0, freerate: 13 }, [60]],
  ['1 voice, both lips', {}, [60]],
  ['8 voices, whistle only', { register: 1, harmonics: 3 }, chord],
  ['8 voices, pulses 472/s', { register: 0, keytrack: 0, freerate: 472 }, chord],
  ['8 voices, buzz 2000/s, wide clicks', { register: 0, keytrack: 0, freerate: 2000, clickwidth: 0.5 }, chord],
  ['8 voices, both lips, ring and biphonation', { ring: 0.7, biphon: 0.6, harmonics: 3 }, chord],
  ['8 voices, both lips, 4 LFOs', { harmonics: 3, lfo1target: 'pitch', lfo1shape: 6, lfo1rate: 5, pitchmode: 1,
    lfo2target: 'rate', lfo2shape: 0, lfo2rate: 3, lfo3target: 'vowel', lfo3rate: 2, lfo4target: 'spread', lfo4shape: 4, lfo4rate: 8 }, chord],
  ['Worst case: 8 voices, buzz, ring, biphon, LFOs', { register: 0.5, keytrack: 0, freerate: 2000, clickwidth: 0.5, ring: 0.8, biphon: 0.8, harmonics: 3,
    lfo1target: 'vowel', lfo1rate: 6, lfo2target: 'clicktone', lfo2rate: 4, lfo3target: 'register', lfo3rate: 1, lfo4target: 'size', lfo4shape: 6, lfo4rate: 0.5, sizemode: 1 }, chord],
];

function run(params, notes) {
  const e = new DolphinEngine(SR, 1234);
  for (const k in params) e.setParam(k, params[k]);
  e.setParam('sustain', 1);
  for (const n of notes) e.noteOn(n, 100);
  const L = new Float32Array(BL), R = new Float32Array(BL);
  for (let i = 0; i < SR * 0.25; i += BL) e.process(L, R, BL);          // warm up the JIT
  const total = Math.round(SR * SECS / BL) * BL;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < total; i += BL) e.process(L, R, BL);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return ms / (total / SR * 1000);                                        // share of real time
}

const rows = [];
for (const [name, p, notes] of SCENARIOS) {
  const best = Math.min(run(p, notes), run(p, notes));                   // best of two, less noise
  rows.push([name, best]);
}
const w = Math.max(...rows.map(r => r[0].length));
console.log('Dolphin reference engine · ' + SR / 1000 + ' kHz · ' + SECS + ' s per run · Node ' + process.version);
console.log('Scenario'.padEnd(w) + '  CPU   x real time');
for (const [name, f] of rows) console.log(name.padEnd(w) + '  ' + (f * 100).toFixed(1).padStart(4) + '%  ' + (1 / f).toFixed(0).padStart(5) + 'x');
