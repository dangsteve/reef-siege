'use strict';
/* ============================================================================
   music.js — Castle Siege audio: generative medieval-fantasy soundtrack + SFX
   ----------------------------------------------------------------------------
   Fully self-contained WebAudio synthesis (no audio files, no modules).
   Exposes two globals: Music and SFX2.

   Music: endless generative loop in D dorian, ~92 BPM.
     - Karplus-Strong plucked lute/harp arpeggios over Dm-C-Bb-C style
       progressions (variant progressions chosen per 8-bar phrase).
     - Airy flute melody from D dorian pentatonic (question/answer phrasing).
     - Soft low drone (filtered saw + sines on D2/A2/D1).
     - Hand-drum thumps, tambourine ticks, boss toms.
     - Intensity layers (calm / battle / boss) crossfaded over ~1.5s.
     - Look-ahead scheduler: Music.update(dt) schedules ~2s ahead.

   Never throws if AudioContext is unavailable.
   ============================================================================ */

/* ------------------------------ shared core ------------------------------- */

const _AudioCtor = (typeof window !== 'undefined')
  ? (window.AudioContext || window.webkitAudioContext) : null;

const MUSIC_MASTER = 0.16;
const SFX_MASTER = 0.5;

let _actx = null;        // AudioContext, or null if unavailable
let _audioFailed = false;
let _musicBus = null;    // music master gain
let _sfxBus = null;      // sfx master gain
let _noiseBuf = null;    // shared 1s white-noise buffer

function _ensureAudio() {
  if (_actx) {
    if (_actx.state === 'suspended') { try { _actx.resume(); } catch (e) {} }
    return _actx;
  }
  if (_audioFailed || !_AudioCtor) return null;
  try {
    _actx = new _AudioCtor();
    _musicBus = _actx.createGain();
    _musicBus.gain.value = Music.enabled ? MUSIC_MASTER : 0;
    _musicBus.connect(_actx.destination);
    _sfxBus = _actx.createGain();
    _sfxBus.gain.value = SFX_MASTER;
    _sfxBus.connect(_actx.destination);
    _noiseBuf = _makeNoiseBuffer();
    _buildMusicGraph();
    if (_actx.state === 'suspended') { try { _actx.resume(); } catch (e) {} }
  } catch (e) {
    _audioFailed = true;
    _actx = null; _musicBus = null; _sfxBus = null;
    return null;
  }
  return _actx;
}

function _makeNoiseBuffer() {
  const sr = _actx.sampleRate;
  const len = Math.floor(sr * 1.0);
  const b = _actx.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function _midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* --------------------- Karplus-Strong plucked string ---------------------- */
/* A noise burst fed into a feedback delay line with an averaging lowpass —
   rendered once per pitch into a cached AudioBuffer, then replayed cheaply. */

const _ksCache = new Map();

function _ksBuffer(freq) {
  const key = Math.round(freq * 8);
  let b = _ksCache.get(key);
  if (b) return b;
  const sr = _actx.sampleRate;
  const N = Math.max(2, Math.round(sr / freq));           // delay-line length
  const dur = freq < 120 ? 2.2 : 1.5;
  const len = Math.max(N + 2, Math.floor(sr * dur));
  b = _actx.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  // softened noise burst (pre-lowpassed pick transient)
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = 0.5 * (w + prev);
    prev = w;
  }
  // feedback loop: lowpass (2-sample average) * damping — ~0.5s half-life
  const damp = Math.min(0.9995, Math.pow(0.5, 1 / (freq * 0.5)));
  for (let i = N + 1; i < len; i++) {
    d[i] = damp * 0.5 * (d[i - N] + d[i - N - 1]);
  }
  // fade the tail so loops never click
  const fade = Math.min(len, Math.floor(sr * 0.05));
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  _ksCache.set(key, b);
  return b;
}

function _pluck(t, freq, vol, dest) {
  if (!_actx || !dest) return;
  const src = _actx.createBufferSource();
  src.buffer = _ksBuffer(freq);
  const g = _actx.createGain();
  g.gain.value = vol * 0.55;
  src.connect(g); g.connect(dest);
  src.start(t);
}

/* ------------------------------ music theory ------------------------------ */

const BPM = 92;
const STEP = 60 / BPM / 4;      // one sixteenth note
const AHEAD = 2.0;              // scheduling look-ahead (seconds)
const PHRASE_STEPS = 128;       // 8 bars of 16ths

// D dorian pentatonic (D E G A C), D4..E5 — melody pool
const PENT = [62, 64, 67, 69, 72, 74, 76];

const CH = {
  Dm: [50, 53, 57, 62], C: [48, 52, 55, 60], Bb: [46, 50, 53, 58],
  F: [53, 57, 60, 65], G: [50, 55, 59, 62],
};
const PROGS = [
  [CH.Dm, CH.C, CH.Bb, CH.C],   // main
  [CH.Dm, CH.F, CH.C, CH.G],    // alternates, chosen generatively
  [CH.Dm, CH.Bb, CH.F, CH.C],
  [CH.Dm, CH.G, CH.Bb, CH.C],
];
const SPARSE_ARP = [0, 2, 1, 3];
const FULL_ARP = [0, 1, 2, 3, 2, 3, 1, 2, 0, 2, 1, 3, 2, 1, 3, 2];
const OSTINATO = [38, 38, 45, 38, 41, 38, 45, 43];   // D2 D2 A2 D2 F2 D2 A2 G2
const MEL_DURS = [4, 4, 6, 8, 8, 12];                // in 16th steps

const LAYER_LEVELS = {
  calm:   { drone: 0.9, lute: 0.8, luteFull: 0,    drums: 0,    melody: 0.55, ost: 0 },
  battle: { drone: 1.0, lute: 0.5, luteFull: 0.9,  drums: 0.9,  melody: 1.0,  ost: 0 },
  boss:   { drone: 1.0, lute: 0.4, luteFull: 1.0,  drums: 1.15, melody: 1.0,  ost: 0.9 },
};

/* ----------------------------- music state -------------------------------- */

let _lyr = null;            // layer gain nodes {drone,lute,luteFull,drums,melody,ost}
let _intensity = 'calm';
let _nextTime = 0;
let _stepIdx = 0;
let _curProg = PROGS[0];
let _melodyMap = {};
let _melodyOn = false;
let _phraseOctUp = false;

function _buildMusicGraph() {
  _lyr = {};
  const lv = LAYER_LEVELS[_intensity];
  for (const n of ['drone', 'lute', 'luteFull', 'drums', 'melody', 'ost']) {
    const g = _actx.createGain();
    g.gain.value = lv[n];
    g.connect(_musicBus);
    _lyr[n] = g;
  }
  // --- persistent low drone: filtered saw D2 + sine A2 + sine sub D1 ---
  const lp = _actx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.5;
  const parts = [
    ['sawtooth', 38, 0.14],   // D2
    ['sine', 45, 0.10],       // A2
    ['sine', 26, 0.08],       // D1 sub
  ];
  for (const p of parts) {
    const o = _actx.createOscillator();
    o.type = p[0]; o.frequency.value = _midiHz(p[1]);
    const g = _actx.createGain(); g.gain.value = p[2];
    o.connect(g); g.connect(lp);
    o.start();
  }
  lp.connect(_lyr.drone);
  // slow breathing on the drone filter
  const lfo = _actx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.07;
  const lg = _actx.createGain(); lg.gain.value = 60;
  lfo.connect(lg); lg.connect(lp.frequency);
  lfo.start();

  _nextTime = _actx.currentTime + 0.1;
  _stepIdx = 0;
}

/* ------------------------------ instruments ------------------------------- */

function _flute(t, freq, dur, vol) {
  if (dur < 0.3) dur = 0.3;
  const o1 = _actx.createOscillator();
  o1.type = 'sine'; o1.frequency.value = freq;
  const o2 = _actx.createOscillator();
  o2.type = 'sine'; o2.frequency.value = freq * 1.005;  // airy detuned partner
  const vib = _actx.createOscillator();
  vib.type = 'sine'; vib.frequency.value = 4.6 + Math.random() * 0.8;
  const vg = _actx.createGain(); vg.gain.value = freq * 0.007;
  vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
  const lp = _actx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.4;
  const g = _actx.createGain();
  const peak = 0.09 * vol;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.09);
  g.gain.setValueAtTime(peak, t + dur - 0.14);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(_lyr.melody);
  const te = t + dur + 0.05;
  o1.start(t); o2.start(t); vib.start(t);
  o1.stop(te); o2.stop(te); vib.stop(te);
}

function _thump(t, vol, f) {          // muffled hand-drum
  const o = _actx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f * 0.45), t + 0.12);
  const g = _actx.createGain();
  g.gain.setValueAtTime(0.12 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(_lyr.drums);
  o.start(t); o.stop(t + 0.25);
  const n = _actx.createBufferSource();          // skin slap
  n.buffer = _noiseBuf; n.loop = true;
  const f2 = _actx.createBiquadFilter();
  f2.type = 'lowpass'; f2.frequency.value = 900;
  const g2 = _actx.createGain();
  g2.gain.setValueAtTime(0.05 * vol, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(f2); f2.connect(g2); g2.connect(_lyr.drums);
  n.start(t, Math.random() * 0.5); n.stop(t + 0.08);
}

function _tick(t, vol) {              // soft tambourine
  const n = _actx.createBufferSource();
  n.buffer = _noiseBuf; n.loop = true;
  const f = _actx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 6000;
  const g = _actx.createGain();
  g.gain.setValueAtTime(0.03 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(f); f.connect(g); g.connect(_lyr.drums);
  n.start(t, Math.random() * 0.5); n.stop(t + 0.07);
}

function _tom(t, vol, f) {
  const o = _actx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.16);
  const g = _actx.createGain();
  g.gain.setValueAtTime(0.09 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(_lyr.drums);
  o.start(t); o.stop(t + 0.2);
}

/* --------------------------- generative engine ---------------------------- */

function _newPhrase() {
  _curProg = Math.random() < 0.45
    ? PROGS[0]
    : PROGS[1 + ((Math.random() * (PROGS.length - 1)) | 0)];
  const p = _intensity === 'calm' ? 0.3 : (_intensity === 'battle' ? 0.85 : 0.95);
  _melodyOn = Math.random() < p;         // only sometimes present in calm
  _phraseOctUp = Math.random() < 0.4;    // boss: melody up an octave sometimes
  _melodyMap = _genMelodyMap();
}

// Two 4-bar phrases: question (cadence on A) then answer (cadence on D).
function _genMelodyMap() {
  const map = {};
  for (let half = 0; half < 2; half++) {
    const base = half * 64;
    let step = Math.random() < 0.5 ? 0 : 4;
    let idx = 2 + ((Math.random() * 3) | 0);
    while (step < 52) {
      const d = MEL_DURS[(Math.random() * MEL_DURS.length) | 0];
      if (step + d > 54) break;
      map[base + step] = { m: PENT[idx], d: d };
      step += d + (Math.random() < 0.35 ? 4 : 0);   // breathing rests
      let mv = ((Math.random() * 3) | 0) - 1;
      if (mv === 0 && Math.random() < 0.6) mv = Math.random() < 0.5 ? -1 : 1;
      idx = Math.max(0, Math.min(PENT.length - 1, idx + mv));
    }
    map[base + 56] = { m: half === 0 ? 69 : 62, d: 8 };
  }
  return map;
}

function _scheduleStep(i, t) {
  const p = i % PHRASE_STEPS;
  if (p === 0) _newPhrase();
  const chord = _curProg[p >> 5];     // 2 bars per chord
  const inten = _intensity;

  // sparse lute — the calm backbone, always gently present
  if (p % 8 === 0) {
    _pluck(t, _midiHz(chord[SPARSE_ARP[(p >> 3) % SPARSE_ARP.length]]), 0.5, _lyr.lute);
    if (p % 32 === 0) _pluck(t, _midiHz(chord[0] - 12), 0.35, _lyr.lute);  // bass root
  }
  // full lute arpeggio (battle/boss), 8ths with occasional 16th pickups in boss
  if (inten !== 'calm' && p % 2 === 0) {
    _pluck(t, _midiHz(chord[FULL_ARP[(p >> 1) % FULL_ARP.length]]), 0.42, _lyr.luteFull);
    if (inten === 'boss' && Math.random() < 0.12) {
      _pluck(t + STEP, _midiHz(chord[1 + (i % 3)]), 0.3, _lyr.luteFull);
    }
  }
  // percussion — off in calm, sparse in battle, driving with toms in boss
  if (inten === 'battle') {
    if (p % 16 === 0) _thump(t, 0.9, 95);
    else if (p % 16 === 8) _thump(t, 0.6, 85);
    if (p % 8 === 6 && Math.random() < 0.45) _tick(t, 0.5);
  } else if (inten === 'boss') {
    if (p % 4 === 0) _thump(t, p % 16 === 0 ? 1.0 : 0.65, p % 8 === 0 ? 95 : 80);
    if (p % 16 === 14 || (p % 16 === 6 && Math.random() < 0.6)) {
      _tom(t, 0.7, 120 + 40 * Math.random());
    }
    if (p % 4 === 2) _tick(t, 0.55);
    if (p % 16 === 15 && Math.random() < 0.5) _thump(t, 0.5, 70);  // pickup
  }
  // low ostinato (boss only) — driving 8ths
  if (inten === 'boss' && p % 2 === 0) {
    _pluck(t, _midiHz(OSTINATO[(p >> 1) % OSTINATO.length]), 0.55, _lyr.ost);
  }
  // flute melody
  if (_melodyOn) {
    const ev = _melodyMap[p];
    if (ev) {
      const shift = (inten === 'boss' && _phraseOctUp) ? 12 : 0;
      _flute(t, _midiHz(ev.m + shift), ev.d * STEP * 0.92, 0.5);
    }
  }
}

/* ------------------------------ Music (API) ------------------------------- */

const Music = {
  enabled: true,

  init() {
    try { _ensureAudio(); } catch (e) {}
  },

  setEnabled(b) {
    b = !!b;
    Music.enabled = b;
    if (!_actx || !_musicBus) return;
    try {
      const now = _actx.currentTime;
      const g = _musicBus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(b ? MUSIC_MASTER : 0, now + 0.5);
    } catch (e) {}
  },

  setIntensity(level) {
    const lv = LAYER_LEVELS[level];
    if (!lv) return;
    _intensity = level;
    if (!_actx || !_lyr) return;
    try {
      const now = _actx.currentTime;
      for (const k in _lyr) {
        const g = _lyr[k].gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(lv[k], now + 1.5);   // ~1.5s crossfade
      }
    } catch (e) {}
  },

  update(dt) {
    if (!_actx || !_lyr) return;
    try {
      if (_actx.state !== 'running') return;
      const now = _actx.currentTime;
      if (_nextTime < now - 0.25) _nextTime = now + 0.05;   // tab was hidden
      const horizon = now + AHEAD;
      let guard = 0;
      while (_nextTime < horizon && guard++ < 256) {
        if (Music.enabled) _scheduleStep(_stepIdx, _nextTime);
        _stepIdx++;
        _nextTime += STEP;
      }
    } catch (e) {}
  },
};

/* ============================== SFX toolkit =============================== */

function _fx(t, type, f0, f1, dur, vol, o) {   // tone with pitch envelope
  o = o || {};
  const osc = _actx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = _actx.createGain();
  const a = Math.min(o.a || 0.005, dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let head = osc;
  if (o.lp) {
    const f = _actx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = o.lp;
    head.connect(f); head = f;
  }
  head.connect(g); g.connect(_sfxBus);
  osc.start(t); osc.stop(t + dur + 0.03);
}

function _fn(t, dur, vol, ftype, f0, f1, q, o) {   // filtered noise burst
  o = o || {};
  const src = _actx.createBufferSource();
  src.buffer = _noiseBuf; src.loop = true;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = _actx.createBiquadFilter();
  f.type = ftype || 'bandpass';
  f.frequency.setValueAtTime(Math.max(30, f0 || 1000), t);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  f.Q.value = q || 1;
  const g = _actx.createGain();
  const a = Math.min(o.a || 0.004, dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(_sfxBus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.03);
}

function _clank(t, f, vol, dur) {   // metal hit: detuned square pair + snap
  _fx(t, 'square', f, f * 0.82, dur, 0.045 * vol, { lp: 3200 });
  _fx(t, 'square', f * 1.53, f * 1.31, dur * 0.8, 0.03 * vol, { lp: 4200 });
  _fn(t, 0.04, 0.035 * vol, 'highpass', 3500, null, 1);
}

function _ding(t, f, vol, dur) {    // bright bell ding (sine + 2nd partial)
  dur = dur || 0.25;
  _fx(t, 'sine', f, null, dur, vol);
  _fx(t, 'sine', f * 2.02, null, dur * 0.6, vol * 0.35);
}

function _knock(t, vol) {           // wooden hammer knock
  _fx(t, 'sine', 190, 85, 0.09, 0.07 * vol);
  _fn(t, 0.05, 0.04 * vol, 'lowpass', 1200, null, 1);
}

function _blip(t) {                 // soft generic fallback for unknown names
  _fx(t, 'sine', 640, 520, 0.08, 0.03);
}

/* ------------------------------ SFX designs ------------------------------- */

const SFXDEFS = {
  /* --- UI --- */
  ui_click(t)  { _fx(t, 'square', 950, 620, 0.055, 0.045, { lp: 2500 }); },
  ui_tab(t)    { _fx(t, 'square', 680, 880, 0.06, 0.04, { lp: 2500 }); },
  ui_open(t)   { _fx(t, 'sine', 480, 860, 0.12, 0.055); _fx(t + 0.02, 'sine', 960, 1300, 0.09, 0.025); },
  ui_close(t)  { _fx(t, 'sine', 860, 430, 0.12, 0.055); },
  error(t)     { _fx(t, 'square', 150, 138, 0.22, 0.05, { lp: 700 }); _fx(t, 'square', 154, 140, 0.22, 0.04, { lp: 700 }); },
  build(t)     { _knock(t, 1); _knock(t + 0.14, 0.85); },
  sell(t)      { _ding(t, 1175, 0.05, 0.18); _ding(t + 0.09, 784, 0.05, 0.25); },
  upgrade(t)   { _ding(t, 659, 0.045, 0.2); _ding(t + 0.08, 880, 0.05, 0.2); _ding(t + 0.16, 1319, 0.055, 0.35); },
  coin(t)      { _ding(t, 1568, 0.06, 0.22); },
  chest(t)     { _ding(t, 1175, 0.05, 0.16); _ding(t + 0.07, 1397, 0.05, 0.16); _ding(t + 0.15, 1760, 0.055, 0.3); },
  relic_buy(t) { _fx(t, 'sine', 220, null, 0.9, 0.07); _ding(t + 0.05, 880, 0.04, 0.7); _fn(t + 0.1, 0.8, 0.02, 'highpass', 5000, null, 1); },

  /* --- flow --- */
  horn_wave(t) {
    _fx(t, 'sawtooth', 110, 164, 1.1, 0.06, { a: 0.25, lp: 750 });
    _fx(t, 'sawtooth', 164.5, 220, 1.1, 0.035, { a: 0.3, lp: 900 });
  },
  horn_victory(t) {
    const n = [294, 392, 587];
    for (let i = 0; i < 3; i++) _fx(t + i * 0.14, 'sawtooth', n[i], null, i === 2 ? 0.5 : 0.16, 0.055, { lp: 1600, a: 0.01 });
  },
  boss_roar(t) { _fx(t, 'sawtooth', 85, 52, 1.0, 0.08, { lp: 420, a: 0.05 }); _fn(t, 0.9, 0.05, 'lowpass', 350, 180, 1); },
  boss_die(t)  { _fx(t, 'sine', 190, 36, 0.9, 0.1); _fn(t, 1.3, 0.06, 'lowpass', 300, 90, 1); _fx(t + 0.02, 'square', 95, 40, 0.4, 0.05, { lp: 400 }); },
  game_over(t) {
    const n = [440, 349, 262];
    for (let i = 0; i < 3; i++) _fx(t + i * 0.38, 'sine', n[i], n[i] * 0.985, 0.42, 0.06);
  },
  leak(t)    { _fx(t, 'sine', 240, 110, 0.28, 0.08, { lp: 800 }); _fn(t, 0.12, 0.03, 'lowpass', 500, null, 1); },
  summon(t)  { _fx(t, 'sawtooth', 196, 247, 0.22, 0.05, { lp: 1200, a: 0.03 }); },
  recruit(t) { _fx(t, 'sawtooth', 294, null, 0.15, 0.05, { lp: 1500 }); _fx(t + 0.13, 'sawtooth', 440, null, 0.35, 0.055, { lp: 1600 }); },

  /* --- towers --- */
  arrow(t)    { _fn(t, 0.07, 0.05, 'highpass', 2500, 5000, 1); _fx(t, 'sine', 1300, 350, 0.06, 0.03); },
  crossbow(t) { _fx(t, 'sine', 160, 70, 0.09, 0.07); _fn(t + 0.01, 0.08, 0.045, 'highpass', 2000, 4500, 1); },
  cannon(t)   { _fx(t, 'sine', 110, 32, 0.5, 0.1); _fn(t, 0.35, 0.06, 'lowpass', 500, 150, 1); },
  frost(t)    {
    for (let i = 0; i < 3; i++) _ding(t + i * 0.05, 2100 + i * 420 + Math.random() * 180, 0.028, 0.25);
    _fn(t, 0.3, 0.015, 'highpass', 6000, null, 1);
  },
  flame(t)    { _fn(t, 0.4, 0.05, 'bandpass', 420, 1400, 0.8); _fx(t, 'sawtooth', 95, 70, 0.35, 0.02, { lp: 300, a: 0.06 }); },
  poison(t)   { _fx(t, 'sine', 210, 430, 0.11, 0.05); _fx(t + 0.09, 'sine', 160, 360, 0.12, 0.045); },
  zap(t)      { _fx(t, 'square', 1900, 220, 0.08, 0.045, { lp: 5000 }); _fn(t, 0.07, 0.035, 'highpass', 3500, null, 2); },
  ballista(t) { _clank(t, 220, 0.5, 0.1); _fx(t + 0.02, 'sine', 130, 55, 0.12, 0.07); _fn(t, 0.1, 0.04, 'bandpass', 900, 400, 1); },
  mint_coin(t){ _ding(t, 1319, 0.035, 0.3); },

  /* --- combat --- */
  melee_hit1(t)  { _clank(t, 510, 1, 0.09); },
  melee_hit2(t)  { _clank(t, 620, 0.9, 0.08); },
  melee_hit3(t)  { _clank(t, 430, 1, 0.1); },
  giant_smash(t) { _fx(t, 'sine', 95, 28, 0.4, 0.1); _fn(t, 0.3, 0.05, 'lowpass', 350, 120, 1); },
  mage_bolt(t)   { _fx(t, 'sawtooth', 850, 1500, 0.09, 0.04, { lp: 3000 }); _fx(t + 0.01, 'sine', 1700, 600, 0.08, 0.025); },
  holy_heal(t)   { _fx(t, 'sine', 523, 784, 0.5, 0.045, { a: 0.12 }); _fx(t, 'sine', 1047, 1568, 0.5, 0.02, { a: 0.15 }); },
  enemy_die1(t)  { _fx(t, 'square', 300, 80, 0.14, 0.05, { lp: 900 }); _fn(t, 0.08, 0.03, 'lowpass', 700, null, 1); },
  enemy_die2(t)  { _fx(t, 'square', 360, 95, 0.12, 0.045, { lp: 1000 }); },
  enemy_die3(t)  { _fx(t, 'square', 250, 70, 0.16, 0.05, { lp: 800 }); _fn(t, 0.1, 0.025, 'lowpass', 500, null, 1); },
  elite_die(t)   { _fx(t, 'square', 190, 45, 0.35, 0.06, { lp: 700 }); _fn(t, 0.3, 0.04, 'lowpass', 400, 140, 1); },
  hero_die(t)    { _fx(t, 'sine', 660, 165, 0.9, 0.06); _fx(t + 0.05, 'sine', 523, 131, 0.85, 0.035); },

  /* --- hero attack signatures --- */
  hero_aldric_atk(t)  { _fn(t, 0.1, 0.04, 'highpass', 3000, 6000, 1); _ding(t + 0.03, 1250, 0.035, 0.3); },
  hero_lyra_atk(t)    { _pluck(t, 420, 0.1, _sfxBus); _fn(t + 0.01, 0.06, 0.035, 'highpass', 2800, 5000, 1); },
  hero_magnus_atk(t)  { _fx(t, 'sawtooth', 480, 980, 0.13, 0.04, { lp: 2500 }); _fn(t, 0.15, 0.03, 'bandpass', 600, 1800, 1); },
  hero_celeste_atk(t) { _ding(t, 1047, 0.04, 0.25); _ding(t + 0.05, 1568, 0.035, 0.3); },
  hero_bjorn_atk(t)   { _fx(t, 'sine', 150, 55, 0.13, 0.08); _fn(t, 0.1, 0.045, 'lowpass', 800, null, 1); },
  hero_nyx_atk(t)     { _fn(t, 0.06, 0.03, 'highpass', 4500, 7000, 2); _fn(t + 0.05, 0.06, 0.025, 'highpass', 5000, 8000, 2); },

  /* --- skills / consumables --- */
  skill_slam(t) {
    _fx(t, 'sine', 130, 26, 0.55, 0.1);
    _fn(t, 0.45, 0.06, 'lowpass', 420, 110, 1);
    _fn(t, 0.05, 0.05, 'highpass', 1500, null, 1);
  },
  skill_arrowstorm(t) {
    for (let i = 0; i < 6; i++) {
      _fn(t + i * 0.07 + Math.random() * 0.04, 0.06, 0.035, 'highpass', 2500 + Math.random() * 1500, 5000, 1);
    }
    _fn(t, 0.7, 0.025, 'bandpass', 700, 1600, 0.7);
  },
  skill_meteor(t) {
    _fx(t, 'sine', 2100, 300, 0.62, 0.04);
    _fx(t + 0.62, 'sine', 100, 28, 0.55, 0.1);
    _fn(t + 0.62, 0.5, 0.06, 'lowpass', 450, 120, 1);
  },
  skill_sanctuary(t) {
    for (const q of [293.7, 440, 587.3]) _fx(t, 'sine', q, q * 1.01, 1.3, 0.035, { a: 0.35 });
    _fn(t + 0.2, 1.0, 0.015, 'highpass', 5000, null, 1);
  },
  skill_warcry(t) {
    _fx(t, 'sawtooth', 145, 105, 0.35, 0.06, { lp: 1200, a: 0.02 });
    _fn(t, 0.3, 0.045, 'bandpass', 650, 500, 4);
    _fn(t, 0.3, 0.035, 'bandpass', 1150, 900, 5);
  },
  skill_shadow(t) {
    _fn(t, 0.25, 0.05, 'bandpass', 260, 900, 1);
    _fn(t + 0.14, 0.25, 0.045, 'bandpass', 480, 160, 1);
    _fx(t, 'sine', 180, 70, 0.35, 0.03);
  },
  consumable_meteor(t) {
    _fx(t, 'sine', 2400, 260, 0.7, 0.05);
    _fx(t + 0.7, 'sine', 110, 24, 0.75, 0.11);
    _fn(t + 0.7, 0.9, 0.07, 'lowpass', 500, 90, 1);
    _fn(t + 0.75, 0.6, 0.04, 'lowpass', 200, 60, 1);
  },
  consumable_heal(t) {
    _fx(t, 'sine', 220, 330, 1.0, 0.06, { a: 0.3 });
    _fx(t, 'sine', 440, 660, 1.0, 0.03, { a: 0.35 });
  },
  consumable_freeze(t) {
    for (let i = 0; i < 4; i++) _ding(t + i * 0.045, 2000 + i * 500, 0.03, 0.22);
    _fn(t, 0.35, 0.02, 'highpass', 6500, null, 1);
  },
};

/* ------------------------------ throttling -------------------------------- */

const THROTTLE_DEFAULT = 100;   // ms
const THROTTLE = {
  ui_click: 60, ui_tab: 60, coin: 60, mint_coin: 80,
  arrow: 60, crossbow: 80, mage_bolt: 70, zap: 80,
  melee_hit1: 60, melee_hit2: 60, melee_hit3: 60,
  enemy_die1: 70, enemy_die2: 70, enemy_die3: 70,
  frost: 100, poison: 100, flame: 120, ballista: 120,
  cannon: 150, build: 150, sell: 150,
  giant_smash: 200, elite_die: 200, upgrade: 200, error: 200, summon: 200,
  chest: 250, leak: 250, holy_heal: 250,
  hero_die: 300, recruit: 300,
  relic_buy: 400, horn_wave: 400, horn_victory: 400,
  boss_roar: 400, boss_die: 400, game_over: 400,
  hero_aldric_atk: 90, hero_lyra_atk: 90, hero_magnus_atk: 90,
  hero_celeste_atk: 90, hero_bjorn_atk: 90, hero_nyx_atk: 90,
  skill_slam: 400, skill_arrowstorm: 400, skill_meteor: 400,
  skill_sanctuary: 400, skill_warcry: 400, skill_shadow: 400,
  consumable_meteor: 400, consumable_heal: 400, consumable_freeze: 400,
};
const _lastPlayed = {};

/* ------------------------------ SFX2 (API) -------------------------------- */

const SFX2 = {
  enabled: true,

  setEnabled(b) { SFX2.enabled = !!b; },

  play(name) {
    try {
      if (!SFX2.enabled) return;
      if (!_ensureAudio()) return;
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      const gap = THROTTLE[name] || THROTTLE_DEFAULT;
      const last = _lastPlayed[name];
      if (last !== undefined && now - last < gap) return;
      _lastPlayed[name] = now;
      const fn = SFXDEFS[name] || _blip;   // unknown names -> soft blip
      fn(_actx.currentTime + 0.001);
    } catch (e) { /* never throw from a sound effect */ }
  },
};
