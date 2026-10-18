# Dolphin

A cetacean voice synth by bytebent. Each voice has two phonic-lip sources, as toothed whales do:
a **pulse** source whose rate runs from rhythm (codas, click trains) to pitch (creaks, squawks,
burst pulses), and a **whistle** source of a few pure partials with no mouth formants. Biphonation
couples them, so the whistle carries sidebands at the pulse rate, as in orca calls.

Status: **prototype**. The reference engine and the browser bench exist; the C++ port and JUCE
plugin come next. Design: *Dolphin: design and architecture*. Research: *Cetacean voice synth:
research brief*.

## Bench

Open `tools/dolphin.html` in a current browser and press **Power on**. Play with the computer
keyboard (Ableton layout: `A`–`;` white keys, `W E T Y U O P` black keys, `Z`/`X` octave,
`C`/`V` velocity) or click the keys. The **Modulation** page has four LFOs; each moves one knob
between a From and a To value, free or synced to tempo, and does no work while its target is None.
The bench also has the test presets and a pitch-bend slider.

Rebuild it after changing the engine: `node tools/bench/build.js`.

## Repository layout

- `reference/dolphin-engine.js` — the reference engine; defines the sound
- `reference/presets.js` — factory test presets (bench and tests only, not the plugin build)
- `tests/engine-test.js` — engine tests
- `tools/bench/` — bench template, AudioWorklet wrapper and build script → `tools/dolphin.html`
- `tools/render-presets.js` — renders every test preset to a WAV

## Tests

```sh
node tests/engine-test.js
```

## Performance

```sh
node tools/perf.js
```

Prints how much of one CPU core each scenario needs to run in real time at 48 kHz, from silence
to the worst case (8 voices, 2,000 clicks per second, ring, biphonation and four LFOs). The bench
page shows the same live as **DSP** in the readouts, with **CLICKS** for the click kernels sounding.
Both measure the JavaScript reference; the C++ plugin will be lighter, but the ratios carry over.
