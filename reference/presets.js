/*
 * Dolphin factory test presets · bytebent
 *
 * Starting points for listening checks and tests. Used by the bench page and tests/engine-test.js;
 * left out of the JUCE build for now. Each preset lists only what differs from the defaults.
 * Rates for the four bottlenose pulsed sounds are the means from Luís, Couchinho & dos Santos (2016).
 */
(function (root) {
  'use strict';
  const PULSES = { register: 0, keytrack: 0, jitter: 0.05, ring: 0, spread: 0 };
  const PRESETS = [
    { name: 'Slow click train', note: 60, targetRate: 13,
      p: Object.assign({}, PULSES, { freerate: 13, clicktone: 0.3, attack: 0.002, sustain: 1 }) },
    { name: 'Creak', note: 60, targetRate: 83,
      p: Object.assign({}, PULSES, { freerate: 83, clicktone: -0.2, attack: 0.01, sustain: 1 }) },
    { name: 'Short burst-pulse', note: 60, targetRate: 287,
      p: Object.assign({}, PULSES, { freerate: 287, clicktone: -0.3, attack: 0.004, decay: 0.06, sustain: 0, release: 0.03 }) },
    { name: 'Squawk', note: 60, targetRate: 472,
      p: Object.assign({}, PULSES, { freerate: 472, clicktone: -0.4, attack: 0.02, decay: 0.44, sustain: 0.3, release: 0.1 }) },
    { name: 'Fastest clicks (buzz)', note: 60, targetRate: 700,
      p: Object.assign({}, PULSES, { freerate: 700, clickwidth: 0.06, sustain: 1 }) },
    { name: 'Sperm whale coda 1+1+3', note: 48, targetRate: 4.5,
      p: Object.assign({}, PULSES, { freerate: 4.5, pattern: 3, coda: 5, size: 1, ring: 0.7, clickwidth: 0.2, vowel: 0, sustain: 1 }) },
    { name: 'Sperm whale coda 5R, i vowel', note: 48, targetRate: 15,
      p: Object.assign({}, PULSES, { freerate: 15, pattern: 0, coda: 5, size: 1, ring: 0.7, clickwidth: 0.2, vowel: 1, sustain: 1 }) },
    { name: 'Signature whistle', note: 69,
      p: { register: 1, pitchmode: 0, shape: 3, sweep: 1.0, time: 1.2, harmonics: 1, harmlevel: -12, attack: 0.03, sustain: 1, release: 0.08 } },
    { name: 'Upsweep whistle', note: 64,
      p: { register: 1, pitchmode: 0, shape: 1, sweep: 1.4, time: 0.6, harmonics: 2, attack: 0.02, sustain: 1, release: 0.06 } },
    // pulses near 1.1 kHz (the low part) under a whistle near 7 kHz (the high part)
    { name: 'Orca-style biphonic call', note: 69,
      p: { register: 0.5, keytrack: 1, rate: 1.3, biphon: 0.7, pitchmode: 0, shape: 2, sweep: 0.5, time: 1.0, size: 0, clicktone: -1, spread: 0.2, attack: 0.03, sustain: 1, release: 0.1 } },
    { name: 'Creak into whistle', note: 67,
      p: { register: 0.45, keytrack: 1, rate: -4, shape: 3, sweep: 0.8, time: 1.5, ring: 0.2, attack: 0.02, sustain: 1 } },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = { PRESETS };
  else root.DolphinPresets = PRESETS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
