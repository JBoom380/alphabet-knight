// ─── AUDIO: medieval canticle music, magical sfx, gentle voice ───────────────
// Everything is synthesised at runtime with the Web Audio API. No files, no network.
// Crash-safety: no onended callbacks; every loop section plays into its own GainNode
// bus that is disconnected by setTimeout after its notes end; a look-ahead scheduler
// (250 ms tick, 2 s horizon) never bursts after a background tab wakes up.
window.AK = window.AK || {};
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const LOOK = 2.0, TICK = 250, FADE = 1.5, TAIL = 5, CAP = 64, DUCK = 0.355; // DUCK = -9 dB
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

  // ── Modes (degree 0 = tonic; 7 = octave) ───────────────────────────────────
  const MODE = { dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11] };
  const dm = (mode, root, d) => root + 12 * Math.floor(d / 7) + mode[((d % 7) + 7) % 7];

  // ── Per-context caches (buffers, waves) ────────────────────────────────────
  const store = new WeakMap();
  function cacheOf(ctx) { let c = store.get(ctx); if (!c) store.set(ctx, c = { buf: new Map(), wave: {} }); return c; }
  // Baked instrument buffers use 32 kHz (half the memory and CPU); an LRU keeps the cache small.
  function mkBuf(ctx, key, secs, fill, ch, rate) {
    const c = cacheOf(ctx).buf, hit = c.get(key);
    if (hit) { c.delete(key); c.set(key, hit); return hit; }
    const sr = rate ? Math.min(rate, ctx.sampleRate) : ctx.sampleRate, b = ctx.createBuffer(ch || 1, Math.max(1, Math.floor(secs * sr)), sr);
    for (let k = 0; k < (ch || 1); k++) fill(b.getChannelData(k), sr, k);
    c.set(key, b); if (c.size > 96) c.delete(c.keys().next().value);
    return b;
  }
  const BSR = 32000;
  function normalize(d, peak) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; }
  function fadeEnds(d, sr, fin, fout) {
    const a = Math.floor(fin * sr), b = Math.floor(fout * sr);
    for (let i = 0; i < a && i < d.length; i++) d[i] *= i / a;
    for (let i = 0; i < b && i < d.length; i++) d[d.length - 1 - i] *= i / b;
  }
  // RBJ biquad over an array (for baking noise colours into buffers).
  function biq(d, sr, type, f, q) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
    }
    return d;
  }
  const white = (n, seed) => { const r = rng(seed), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; return d; };
  const noiseBuf = ctx => mkBuf(ctx, 'noise', 2, (d) => d.set(white(d.length, 99)));

  // ── Baked instruments: Karplus-Strong lute + harp ──────────────────────────
  function ksBuf(ctx, m, kind) {
    const harp = kind === 'harp';
    return mkBuf(ctx, kind + m, harp ? 2.8 : 1.7, (y, sr) => {
      const f = hz(m), dec = (harp ? 2.6 : 1.35) * clamp(Math.sqrt(220 / f), 0.45, 1.5);
      const D = sr / f - 0.5, E = Math.max(2, Math.round(D)), g = Math.pow(0.001, 1 / (dec * f));
      const r = rng(m * 131 + (harp ? 7 : 3)), x = new Float32Array(E), a = harp ? 0.62 : 0.42;
      let lp = 0; for (let i = 0; i < E; i++) { lp += a * ((r() * 2 - 1) - lp); x[i] = lp; }
      const pp = Math.max(1, Math.round(E * (harp ? 0.13 : 0.24))), xc = x.slice();
      for (let i = pp; i < E; i++) x[i] = xc[i] - xc[i - pp];               // pluck position
      const at = q => { if (q < 0) return 0; const k = q | 0, fr = q - k; return y[k] + (y[k + 1] - y[k]) * fr; };
      for (let i = 0; i < y.length; i++) y[i] = (i < E ? x[i] : 0) + g * 0.5 * (at(i - D) + at(i - D - 1));
      biq(y, sr, 'lp', harp ? 6500 : 3600, 0.7);
      normalize(y, 0.5); fadeEnds(y, sr, 0.001, 0.3);
    }, 1, BSR);
  }

  // ── Baked bells + chimes (inharmonic partials, slow beating pairs) ─────────
  const BELL = [[0.5, .35, 1.3], [1, 1, 1], [1.19, .4, .7], [1.5, .3, .6], [2, .45, .5], [2.51, .25, .35], [2.66, .2, .3], [3.01, .16, .25], [4.17, .1, .18], [5.43, .05, .12]];
  const CHIME = [[1, 1, 1], [2.76, .35, .45], [5.4, .15, .22], [8.93, .06, .12]];
  function bellBuf(ctx, m, kind) {
    const P = kind === 'chime' ? CHIME : BELL, base = kind === 'chime' ? 1.5 : 3.0;
    return mkBuf(ctx, kind + m, base + 0.3, (d, sr) => {
      const f0 = hz(m), sc = clamp(Math.sqrt(700 / f0), 0.4, 1.6) * base;
      P.forEach(([ratio, amp, t]) => [1, 1.0021].forEach((det, j) => {
        const f = f0 * ratio * det; if (f > sr * 0.45) return;
        const w = 2 * Math.PI * f / sr, c2 = 2 * Math.cos(w), k = Math.exp(-6.9 / (t * sc * sr));
        let s1 = Math.sin(-w), s2 = Math.sin(-2 * w), e = amp * (j ? 0.45 : 1);
        for (let i = 0; i < d.length && e > 1e-5; i++) { const s = c2 * s1 - s2; s2 = s1; s1 = s; d[i] += s * e; e *= k; }
      }));
      const n = biq(white(Math.floor(sr * 0.004), m), sr, 'hp', 3000, 0.7);  // mallet tick
      for (let i = 0; i < n.length; i++) d[i] += n[i] * 0.15 * (1 - i / n.length);
      normalize(d, 0.5); fadeEnds(d, sr, 0.0015, 0.2);
    }, 1, BSR);
  }

  // ── Baked percussion: frame drum, tabor, rim, zils, steps, woodblock ───────
  function drumBuf(ctx, kind) {
    return mkBuf(ctx, 'dr' + kind, kind === 'D' ? 0.9 : 0.45, (d, sr) => {
      const n = d.length, nz = white(n, kind.charCodeAt(0) * 17);
      if (kind === 'D') {
        let ph = 0; const sk = biq(nz.slice(), sr, 'lp', 900, 0.7);
        for (let i = 0; i < n; i++) {
          const t = i / sr; ph += 2 * Math.PI * (60 + 46 * Math.exp(-t * 26)) / sr;
          d[i] = Math.sin(ph) * Math.exp(-t * 6.5) + 0.3 * Math.sin(ph * 1.58) * Math.exp(-t * 14) + sk[i] * 0.5 * Math.exp(-t * 45);
        }
      } else if (kind === 'T') {
        let ph = 0; const sn = biq(nz.slice(), sr, 'bp', 3200, 0.8);
        for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * (160 + 40 * Math.exp(-t * 30)) / sr; d[i] = Math.sin(ph) * Math.exp(-t * 18) + sn[i] * 1.6 * Math.exp(-t * 20); }
      } else if (kind === 't') {
        const sn = biq(nz.slice(), sr, 'bp', 2100, 1.4);
        for (let i = 0; i < n; i++) { const t = i / sr; d[i] = 0.6 * Math.sin(2 * Math.PI * 470 * t) * Math.exp(-t * 55) + sn[i] * 2.2 * Math.exp(-t * 70); }
      } else if (kind === 'z') {
        const hi = biq(nz.slice(), sr, 'hp', 6000, 0.7);
        for (let i = 0; i < n; i++) {
          const t = i / sr; let s = 0; [4210, 5930, 7340, 9120].forEach((f, j) => { s += Math.sin(2 * Math.PI * f * t + j) * Math.exp(-t * (10 + j * 3)); });
          d[i] = s * 0.25 + hi[i] * 0.3 * Math.exp(-t * 28);
        }
      } else if (kind[0] === 's') {  // cobblestone steps, 4 variants
        const v = +kind[1], lo = biq(nz.slice(), sr, 'lp', 520 + v * 110, 0.8), cl = biq(nz.slice(), sr, 'bp', 2300 + v * 400, 2);
        for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lo[i] * 2.2 * Math.exp(-t * 38) + cl[i] * 0.9 * Math.exp(-t * 120) + 0.4 * Math.sin(2 * Math.PI * (80 + v * 7) * t) * Math.exp(-t * 40); }
      } else if (kind === 'wood') {
        const cl = biq(nz.slice(), sr, 'bp', 3000, 1.5);
        for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 1080 * t) * Math.exp(-t * 55) + 0.45 * Math.sin(2 * Math.PI * 1790 * t) * Math.exp(-t * 80) + cl[i] * Math.exp(-t * 300); }
      }
      normalize(d, 0.5); fadeEnds(d, sr, 0.0008, 0.05);
    }, 1, BSR);
  }

  // ── Reverb impulse: 3.5 s stone hall, darkening tail, early reflections ────
  function impulse(ctx) {
    return mkBuf(ctx, 'ir', 3.5, (d, sr, ch) => {
      const r = rng(ch ? 991 : 373), pre = Math.floor(0.02 * sr); let lp = 0;
      for (let i = pre; i < d.length; i++) {
        const t = (i - pre) / sr, a = 0.06 + 0.6 * Math.exp(-t * 1.8);
        lp += a * ((r() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * 1.97);
      }
      [0.009, 0.017, 0.026, 0.038, 0.049, 0.064, 0.081].forEach((x, k) => {
        const i = pre + Math.floor((x + (ch ? 0.0031 : 0)) * sr); if (i < d.length) d[i] += (r() > 0.5 ? 1 : -1) * 0.5 * (1 - k * 0.1);
      });
      fadeEnds(d, sr, 0, 0.25);
    }, 2);
  }

  // ── Live voices ────────────────────────────────────────────────────────────
  const WAVES = { rec: [0, 1, .09, .15, .03, .05, .015, .02], shawm: [0, 1, .75, .6, .5, .42, .34, .26, .2, .15, .11, .08, .06, .04] };
  function wave(ctx, name) {
    const c = cacheOf(ctx).wave; if (c[name]) return c[name];
    const im = Float32Array.from(WAVES[name]);
    return (c[name] = ctx.createPeriodicWave(new Float32Array(im.length), im));
  }
  function outTo(g, node, pan) {
    if (pan && g.ctx.createStereoPanner) { const p = g.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(g.out); }
    else node.connect(g.out);
  }
  function play(g, t, buf, lv, pan, rate) {
    const c = g.ctx, s = c.createBufferSource(), v = c.createGain();
    s.buffer = buf; if (rate) s.playbackRate.value = rate; v.gain.value = lv;
    s.connect(v); outTo(g, v, pan); s.start(t);
  }
  const PLUCK = {
    lute: (g, t, m, lv, pan) => play(g, t, ksBuf(g.ctx, m, 'lute'), lv, pan),
    harp: (g, t, m, lv, pan) => play(g, t, ksBuf(g.ctx, m, 'harp'), lv, pan),
    bell: (g, t, m, lv, pan) => play(g, t, bellBuf(g.ctx, m, 'bell'), lv, pan),
    chime: (g, t, m, lv, pan) => play(g, t, bellBuf(g.ctx, m, 'chime'), lv, pan),
  };
  const DLV = { D: .4, d: .22, T: .24, t: .16, z: .08 };
  const drum = (g, t, k, lv, pan) => play(g, t, drumBuf(g.ctx, k === 'd' ? 'D' : k), lv, pan);

  // Choir formants (F, gain, Q): "aah", "ooh", "oh".
  const VOW = { ah: [[760, 1, 7], [1150, .55, 9], [2800, .16, 14]], oo: [[340, 1, 5], [640, .35, 7], [2600, .05, 14]], oh: [[480, 1, 6], [820, .5, 8], [2700, .08, 14]] };
  function formants(c, vowel, input, out, mul) {
    (VOW[vowel] || VOW.ah).forEach(([f, a, q]) => {
      const b = c.createBiquadFilter(), k = c.createGain();
      b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; k.gain.value = a * mul;
      input.connect(b); b.connect(k); k.connect(out);
    });
  }
  // A sung chord: 3 detuned saws per note, two vibrato LFOs, breath, formant bank, slow swell.
  function choir(g, t, dur, ms, vowel, lv, pan) {
    const c = g.ctx, env = c.createGain(), sum = c.createGain(), stop = t + dur + 3.5;
    const att = clamp(dur * 0.35, 0.35, 1.4);
    const lfos = [4.6, 5.5].map((f, i) => {
      const o = c.createOscillator(), d = c.createGain();
      o.frequency.value = f + Math.random() * 0.4; d.gain.setValueAtTime(0, t); d.gain.linearRampToValueAtTime(10 + i * 3, t + 1.2);
      o.connect(d); o.start(t); o.stop(stop); return d;
    });
    ms.forEach((m, i) => [-11, 0, 10].forEach((dt, k) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = dt + (Math.random() - 0.5) * 6;
      lfos[(i + k) % 2].connect(o.detune); o.connect(sum); o.start(t); o.stop(stop);
    }));
    const br = c.createBufferSource(), bg = c.createGain();
    br.buffer = noiseBuf(c); br.loop = true; bg.gain.value = 0.05; br.connect(bg); bg.connect(sum); br.start(t, Math.random()); br.stop(stop);
    sum.gain.value = 1 / Math.sqrt(ms.length * 3);
    formants(c, vowel, sum, env, 0.45);
    const lp = c.createBiquadFilter(), lg = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 380; lg.gain.value = 0.07;
    sum.connect(lp); lp.connect(lg); lg.connect(env);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(lv * 0.8, t + att);
    env.gain.linearRampToValueAtTime(lv, t + Math.max(att + 0.1, dur * 0.6));
    env.gain.setTargetAtTime(0, t + dur, 0.45);
    outTo(g, env, pan);
  }

  // Legato phrase voices: one oscillator set glides through all notes of a phrase.
  const LEAD = {
    recorder: { w: 'rec', lp: 4200, glide: .012, vib: 9, vr: 5.3, att: .016, dip: .4, rel: .06, chiff: .45 },
    shawm: { w: 'shawm', lp: 1800, glide: .02, vib: 7, vr: 5.7, att: .025, dip: .55, rel: .08, chiff: .15, dual: 6 },
    brass: { w: 'sawtooth', lp: 1100, glide: .015, vib: 5, vr: 5, att: .03, dip: .35, rel: .1, blat: 1, dual: 5 },
    cantor: { w: 'sawtooth', glide: .05, vib: 16, vr: 5, att: .07, dip: .8, rel: .22, dual: 9, form: 1 },
  };
  const LEAD_LV = { recorder: .11, shawm: .08, brass: .09, cantor: .2 };
  function lead(g, inst, notes, lv, pan, vowel) {
    const c = g.ctx, I = LEAD[inst]; if (!I || !notes.length) return;
    const t0 = notes[0].t, last = notes[notes.length - 1], end = last.t + last.d, stop = end + I.rel * 8 + 0.2;
    lv *= LEAD_LV[inst];
    const env = c.createGain(), src = c.createGain(), vo = c.createGain();
    const lfo = c.createOscillator(), vg = c.createGain();
    lfo.frequency.value = I.vr * (0.95 + Math.random() * 0.1); vg.gain.value = 0; lfo.connect(vg); lfo.start(t0); lfo.stop(stop);
    const dets = I.dual ? [-I.dual, I.dual] : [0];
    const oscs = dets.map(dt => {
      const o = c.createOscillator();
      if (WAVES[I.w]) o.setPeriodicWave(wave(c, I.w)); else o.type = I.w;
      o.detune.value = dt; vg.connect(o.detune); o.connect(src); o.start(t0); o.stop(stop); return o;
    });
    src.gain.value = 1 / dets.length;
    let filt = null;
    if (I.form) formants(c, vowel || 'ah', src, env, 2.6);
    else { filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = I.lp; filt.Q.value = I.blat ? 2 : 0.7; src.connect(filt); filt.connect(env); }
    let cg = null;
    if (I.chiff) {
      const ns = c.createBufferSource(), bp = c.createBiquadFilter(); cg = c.createGain();
      ns.buffer = noiseBuf(c); ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9; cg.gain.value = 0;
      ns.connect(bp); bp.connect(cg); cg.connect(vo); ns.start(t0, Math.random()); ns.stop(stop);
    }
    env.gain.setValueAtTime(0, t0);
    notes.forEach((n, i) => {
      const f = hz(n.m), nx = notes[i + 1], a = lv * (i === 0 ? 1 : 0.9);
      oscs.forEach(o => (i === 0 ? o.frequency.setValueAtTime(f, t0) : o.frequency.setTargetAtTime(f, n.t - 0.004, I.glide)));
      env.gain.setTargetAtTime(a, n.t, I.att);
      if (nx) env.gain.setTargetAtTime(a * I.dip, Math.max(n.t + 0.02, n.t + n.d - 0.045), 0.012);
      const depth = I.vib * (n.d > 0.45 ? 1 : 0.35);
      vg.gain.setValueAtTime(depth * 0.25, n.t); vg.gain.linearRampToValueAtTime(depth, n.t + Math.min(0.45, n.d * 0.8));
      if (cg) { cg.gain.setValueAtTime(0, n.t); cg.gain.linearRampToValueAtTime(lv * I.chiff, n.t + 0.008); cg.gain.setTargetAtTime(0, n.t + 0.01, 0.018); }
      if (filt && I.blat) { filt.frequency.setTargetAtTime(I.lp * 2.3, n.t, 0.02); filt.frequency.setTargetAtTime(I.lp, n.t + 0.07, 0.12); }
    });
    env.gain.setTargetAtTime(0, end - 0.03, I.rel);
    env.connect(vo); outTo(g, vo, pan);
  }

  // Hurdy-gurdy / organetto drone on open fifths; lives as long as its theme.
  function drone(g, t, root, lv) {
    const c = g.ctx, env = c.createGain(), sum = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.9;
    const fl = c.createOscillator(), fg = c.createGain(); fl.frequency.value = 0.07; fg.gain.value = 170; fl.connect(fg); fg.connect(lp.frequency);
    const wl = c.createOscillator(), wg = c.createGain(); wl.frequency.value = 0.19; wg.gain.value = 0.08; wl.connect(wg); wg.connect(sum.gain);
    const f0 = hz(root);
    const oscs = [[f0, -4, 'sawtooth', .5], [f0, 4, 'sawtooth', .5], [f0 * 1.5, 0, 'sawtooth', .35], [f0 * 2, 3, 'triangle', .5]].map(([f, dt, ty, a]) => {
      const o = c.createOscillator(), k = c.createGain(); o.type = ty; o.frequency.value = f; o.detune.value = dt; k.gain.value = a;
      o.connect(k); k.connect(sum); o.start(t); return o;
    });
    [fl, wl].forEach(o => { o.start(t); oscs.push(o); });
    sum.connect(lp); lp.connect(env); env.connect(g.out);
    env.gain.setValueAtTime(0, t); env.gain.setTargetAtTime(lv, t, 1.0);
    return {
      level(v, at) { env.gain.setTargetAtTime(lv * v, Math.max(at, t + 0.05), 1.2); },   // never two setTargets at one time (Chrome jumps)
      stop(at) { env.gain.cancelScheduledValues(at); env.gain.setTargetAtTime(0, at, 0.3); oscs.forEach(o => o.stop(at + 2.5)); },
      kill() { [env, sum, lp].forEach(n => { try { n.disconnect(); } catch (e) { } }); },
    };
  }

  // ── Music: original tunes. Melody tokens are "degree,beats"; r = rest ──────
  // Accompaniment patterns: [degree offset from chord root, velocity] per grid slot.
  const PAT = {
    walk: [[-7, 1], [2, .45], [4, .55], [2, .4], [-3, .8], [4, .45], [7, .5], [4, .4]],
    proc: [[-7, .9], [-3, .5], [0, .55], [2, .5], [4, .55], [7, .5], [4, .45], [2, .45]],
    lull: [[-7, .8], [0, .5], [2, .5], [4, .55], [7, .5], [4, .45]],
    est: [[-7, 1], [2, .45], [4, .45], [-3, .85], [2, .45], [4, .45]],
    dance: [[-7, 1], [0, .4], [2, .5], [-3, .8], [4, .5], [2, .4]],
  };
  const THEMES = {
    // Majestic processional, D Dorian, 66 bpm, 4/4. Cantor + choir + drone.
    title: {
      mode: MODE.dor, root: 62, bpm: 66, bar: 4, droneLv: .05,
      mel: {
        A: '0,2 1,1 2,1 | 4,3 3,1 | 2,1 1,1 2,1 0,1 | 1,4 | 2,2 4,1 5,1 | 4,2 3,1 2,1 | 1,1 2,1 1,1 -1,1 | 0,4',
        B: '4,2 5,1 6,1 | 7,3 6,1 | 5,1 4,1 5,1 6,1 | 4,4 | 7,2 6,1 5,1 | 4,1 5,1 4,1 2,1 | 3,1 2,1 1,1 2,1 | 1,2 0,2',
      },
      ch: { A: [0, 2, 0, 6, 3, 4, 6, 0], B: [4, 0, 3, 4, 3, 2, 6, 0] },
      form: ['A1', 'B1', 'A2', 'B2'],
      sec: {
        A1: { m: 'A', lead: [['cantor', -12, 1, 'oo']], pad: 'oo', padLv: .5, acc: ['harp', 'proc', -12, .3], drum: 'd-------', bells: 'phrase', drone: 1 },
        B1: { m: 'B', lead: [['recorder', 0, .75]], pad: 'ah', padLv: .45, acc: ['harp', 'proc', -12, .35], drum: 'd---t---', drone: .8 },
        A2: { m: 'A', lead: [['cantor', -12, .9, 'ah'], ['recorder', 0, .35]], pad: 'ah', padLv: .5, acc: ['harp', 'proc', 0, .25], drum: 'd---t---', bells: 'phrase', drone: 1 },
        B2: { m: 'B', lead: [['harp', 0, .5], ['recorder', 0, .45]], pad: 'oo', padLv: .5, acc: ['lute', 'proc', -12, .3], drum: 'd-------', bells: 'twinkle', drone: .9 },
      },
    },
    // Pilgrim's walking song, A Dorian, 104 bpm, 4/4. Recorder + lute + drum.
    LETTERS: {
      mode: MODE.dor, root: 69, bpm: 104, bar: 4, droneLv: .04,
      mel: {
        A: '0,1 2,.5 3,.5 4,1 4,1 | 5,1 4,.5 3,.5 4,2 | 2,1 3,.5 4,.5 5,1 3,1 | 4,3 r,1 | 7,1 6,.5 5,.5 4,1 5,1 | 4,1 3,.5 2,.5 3,2 | 2,1 1,1 2,1 3,.5 1,.5 | 0,3 r,1',
        B: '4,1 5,1 6,1 7,1 | 8,1.5 7,.5 6,1 4,1 | 5,1 6,.5 5,.5 4,1 3,1 | 4,2 2,2 | 3,1 4,.5 5,.5 6,1 5,1 | 4,1 5,.5 4,.5 3,1 2,1 | 1,1 2,1 3,1 1,1 | 0,4',
        C: '7,2 4,2 | 6,2 3,2 | 5,2 4,1 3,1 | 4,4',
      },
      ch: { A: [0, 3, 3, 4, 3, 6, 6, 0], B: [4, 6, 3, 0, 3, 2, 6, 0], C: [0, 6, 3, 4] },
      form: ['A1', 'B1', 'A2', 'C1'],
      sec: {
        A1: { m: 'A', lead: [['recorder', 0, .85]], acc: ['lute', 'walk', -12, .5], drum: 'D-t-D-t-', drone: .7 },
        B1: { m: 'B', lead: [['shawm', 0, .6]], pad: 'ah', padLv: .28, acc: ['lute', 'walk', -12, .5], drum: 'D-t-D-tt', drone: .8 },
        A2: { m: 'A', lead: [['recorder', 0, .75], ['lute', -12, .45]], acc: ['harp', 'walk', -12, .35], drum: 'D-tzD-tt', bells: 'phrase', drone: .7 },
        C1: { m: 'C', lead: [['bell', 0, .3]], acc: ['lute', 'walk', -12, .5], drum: 'D---D-t-', drone: 1 },
      },
    },
    // Golden-sunset estampie, F Lydian, 6/8 (eighth = 174), lilting.
    WORDS: {
      mode: MODE.lyd, root: 65, bpm: 174, bar: 6, droneLv: .045,
      mel: {
        A: '4,2 5,1 4,2 2,1 | 3,2 4,1 5,3 | 4,2 2,1 3,2 1,1 | 2,3 0,3 | 4,2 5,1 6,2 7,1 | 8,2 7,1 5,3 | 4,2 5,1 3,2 1,1 | 0,5 r,1',
        B: '7,3 6,2 5,1 | 4,2 5,1 6,3 | 5,2 4,1 2,2 4,1 | 5,5 r,1 | 2,2 3,1 4,2 5,1 | 6,2 5,1 4,3 | 3,2 2,1 1,2 2,1 | 0,5 r,1',
      },
      ch: { A: [0, 1, 2, 0, 4, 1, 1, 0], B: [5, 4, 5, 1, 0, 4, 1, 0] },
      form: ['A1', 'B1', 'A2', 'B2'],
      sec: {
        A1: { m: 'A', lead: [['recorder', 0, .8]], acc: ['lute', 'est', -12, .5], drum: 'd-t-t-', drone: .8 },
        B1: { m: 'B', lead: [['shawm', 0, .55]], pad: 'ah', padLv: .28, acc: ['lute', 'est', -12, .5], drum: 'D-tD-t', drone: .9 },
        A2: { m: 'A', lead: [['cantor', -12, .9, 'ah'], ['harp', 0, .3]], pad: 'oo', padLv: .32, acc: ['lute', 'est', -12, .45], drum: 'd-t-t-', bells: 'phrase', drone: .8 },
        B2: { m: 'B', lead: [['recorder', 0, .7], ['lute', -12, .4]], acc: ['harp', 'est', -12, .4], drum: 'D-tD-t', bells: 'twinkle', drone: .9 },
      },
    },
    // Starry-night lullaby canticle, A Aeolian, 56 bpm, 3/4. Harp + soft choir.
    NUMBERS: {
      mode: MODE.aeo, root: 69, bpm: 56, bar: 3, droneLv: .035,
      mel: {
        A: '4,2 3,1 | 2,2 1,1 | 2,1 3,1 2,1 | 1,3 | 5,2 4,1 | 3,2 2,1 | 1,1.5 2,.5 1,1 | 0,3',
        B: '7,2 6,1 | 5,1 6,1 7,1 | 9,2 8,1 | 7,3 | 6,2 5,1 | 4,1 5,1 6,1 | 3,1 4,1 2,1 | 1,1 0,2',
      },
      ch: { A: [0, 2, 5, 4, 5, 3, 6, 0], B: [0, 5, 2, 5, 6, 2, 3, 0] },
      form: ['A1', 'B1', 'A2'],
      sec: {
        A1: { m: 'A', lead: [['cantor', -12, .85, 'oo']], pad: 'oo', padLv: .3, acc: ['harp', 'lull', -12, .45], bells: 'twinkle', drone: .7 },
        B1: { m: 'B', lead: [['recorder', 0, .5]], pad: 'oo', padLv: .3, acc: ['harp', 'lull', -12, .45], bells: 'twinkle', drone: .6 },
        A2: { m: 'A', lead: [['harp', 0, .5], ['cantor', -12, .6, 'oh']], pad: 'ah', padLv: .28, acc: ['harp', 'lull', -12, .35], bells: 'twinkle', drone: .7 },
      },
    },
    // Gentle saltarello, C Mixolydian, 6/8 (eighth = 204). Playful.
    MATH: {
      mode: MODE.mix, root: 72, bpm: 204, bar: 6, droneLv: .04,
      mel: {
        A: '0,1 2,1 4,1 4,2 2,1 | 3,1 4,1 5,1 4,2 2,1 | 1,2 3,1 2,2 0,1 | 1,2 2,1 1,2 r,1 | 0,1 2,1 4,1 7,2 6,1 | 5,1 6,1 5,1 4,2 3,1 | 2,2 3,1 1,2 -1,1 | 0,5 r,1',
        B: '4,2 4,1 5,2 6,1 | 7,2 6,1 5,2 4,1 | 3,2 3,1 4,2 5,1 | 4,5 r,1 | 7,1 6,1 5,1 6,1 5,1 4,1 | 3,1 2,1 3,1 4,2 r,1 | 2,1 3,1 1,1 -1,2 1,1 | 0,5 r,1',
      },
      ch: { A: [0, 3, 6, 4, 0, 3, 6, 0], B: [4, 0, 3, 0, 5, 3, 6, 0] },
      form: ['A1', 'B1', 'A2', 'B2'],
      sec: {
        A1: { m: 'A', lead: [['lute', -12, .55], ['recorder', 0, .45]], acc: ['lute', 'dance', -24, .4], drum: 'D-tD-t', drone: .6 },
        B1: { m: 'B', lead: [['recorder', 0, .7]], acc: ['harp', 'dance', -24, .4], drum: 'D-tDtt', bells: 'phrase', drone: .7 },
        A2: { m: 'A', lead: [['shawm', -12, .55], ['harp', 0, .3]], acc: ['lute', 'dance', -24, .45], drum: 'D-tD-z', drone: .6 },
        B2: { m: 'B', lead: [['cantor', -12, .8, 'ah'], ['recorder', 0, .35]], pad: 'ah', padLv: .28, acc: ['lute', 'dance', -24, .4], drum: 'D--D-t', bells: 'twinkle', drone: .8 },
      },
    },
    // Fanfare-hymn then a loopable celebration, D Mixolydian, 112 bpm, 4/4.
    victory: {
      mode: MODE.mix, root: 74, bpm: 112, bar: 4, droneLv: .045,
      mel: {
        F: '0,.5 0,.5 4,1 7,2 | 4,.5 4,.5 7,1 9,2 | 8,1 7,1 6,1 8,1 | 7,4',
        H: '0,.5 0,.5 0,1 4,2 | 0,.5 0,.5 4,1 5,2 | 4,1 4,1 3,1 4,1 | 4,4',
        A: '7,2 6,1 7,1 | 9,2 7,2 | 8,1 7,1 6,1 5,1 | 4,4 | 5,1 6,1 7,1 8,1 | 9,2 8,1 7,1 | 6,1 4,1 5,1 6,1 | 7,4',
        B: '4,1 4,.5 5,.5 6,1 4,1 | 7,1.5 6,.5 5,1 4,1 | 3,1 3,.5 4,.5 5,1 3,1 | 4,2 2,2 | 4,1 5,.5 6,.5 7,1 8,1 | 9,1 8,.5 7,.5 6,1 7,1 | 5,1 6,1 4,1 1,1 | 0,4',
      },
      ch: { F: [0, 0, 6, 0], A: [0, 5, 6, 0, 3, 5, 6, 0], B: [0, 3, 3, 0, 6, 0, 1, 0] },
      intro: ['F0'], form: ['A1', 'B1', 'A2', 'B2'],
      sec: {
        F0: { m: 'F', lead: [['brass', -12, .8], ['brass', -12, .5, null, 'H']], pad: 'ah', padLv: .5, drum: ['D--rD--r', 'D--rD--r', 'D-t-D-t-', 'rrrrD---'], bells: 'phrase', drone: .6 },
        A1: { m: 'A', lead: [['cantor', -12, 1, 'ah']], pad: 'ah', padLv: .5, acc: ['harp', 'proc', -24, .4], drum: 'D---D-t-', bells: 'phrase', drone: 1 },
        B1: { m: 'B', lead: [['recorder', -12, .8]], acc: ['lute', 'walk', -24, .5], drum: 'D-t-D-tt', bells: 'twinkle', drone: .8 },
        A2: { m: 'A', lead: [['brass', -12, .5], ['cantor', -12, .7, 'oh']], pad: 'ah', padLv: .45, acc: ['harp', 'proc', -24, .4], drum: 'D-t-D-t-', bells: 'phrase', drone: 1 },
        B2: { m: 'B', lead: [['shawm', -12, .55], ['harp', 0, .3]], acc: ['lute', 'walk', -24, .5], drum: 'D-tzD-tt', bells: 'twinkle', drone: .8 },
      },
    },
  };

  function parse(s) {
    const out = []; let b = 0;
    (s || '').split(/[\s|]+/).forEach(tok => {
      if (!tok) return; const [a, d] = tok.split(','), dur = parseFloat(d);
      if (a !== 'r') out.push({ b, d: dur, deg: parseFloat(a) });
      b += dur;
    });
    return out;
  }
  const normRoot = r => (r >= 4 ? r - 7 : r);
  const padBase = th => th.root - (th.root >= 69 ? 24 : 12);
  const droneRoot = th => th.root - 24 - (th.root >= 70 ? 12 : 0);

  // Build every event of one section (times in seconds from the section start).
  function buildSection(th, key, rep) {
    const S = th.sec[key], sb = 60 / th.bpm, barS = th.bar * sb, chords = th.ch[S.m], bars = chords.length;
    const r = rng(hash(key) + rep * 977 + th.root), ev = [], needs = [];
    const add = (t, d, fn, prio) => ev.push({ t: Math.max(0, t), d, fn, prio: prio || 1 });
    const hum = () => (r() - 0.5) * 0.014;
    // melody lines
    (S.lead || []).forEach(([inst, oct, lv, vow, mkey], li) => {
      const mel = parse(th.mel[mkey || S.m]), pan = li ? (li % 2 ? -0.28 : 0.28) : 0.05;
      const ns = mel.map(n => ({ t: n.b * sb, d: n.d * sb, m: dm(th.mode, th.root + oct, n.deg), b: n.b }));
      if (PLUCK[inst]) { ns.forEach(n => { needs.push([inst, n.m]); const v = lv * (0.9 + r() * 0.2); add(n.t + hum(), 3, (g, T) => PLUCK[inst](g, T, n.m, v, pan)); }); return; }
      let ph = [];
      const flush = () => {
        if (!ph.length) return; const p = ph; ph = [];
        const d = p[p.length - 1].t + p[p.length - 1].d - p[0].t;
        add(p[0].t, d, (g, T) => lead(g, inst, p.map(n => ({ t: T + n.t - p[0].t, d: n.d, m: n.m })), lv, pan, vow), 3);
      };
      ns.forEach(n => {
        const pv = ph[ph.length - 1];
        if (pv && (n.t > pv.t + pv.d + 0.001 || n.b % (4 * th.bar) === 0)) {
          if (n.t <= pv.t + pv.d + 0.001) pv.d -= Math.min(0.15, pv.d * 0.25);   // breathe at the phrase line
          flush();
        }
        ph.push({ t: n.t, d: n.d, m: n.m });
      });
      flush();
    });
    // choir pad: one sung chord per run of equal chords
    if (S.pad) {
      for (let i = 0; i < bars;) {
        let j = i + 1; while (j < bars && chords[j] === chords[i]) j++;
        const rt = normRoot(chords[i]), ms = [rt, rt + 4, rt + 7, rt + 9].map(d => dm(th.mode, padBase(th), d)), dur = (j - i) * barS;
        add(i * barS, dur, (g, T) => choir(g, T, dur + 0.25, ms, S.pad, S.padLv, 0), 2);
        i = j;
      }
    }
    // plucked accompaniment
    if (S.acc) {
      const [inst, pat, oct, lv] = S.acc, P = PAT[pat], step = barS / P.length;
      for (let b = 0; b < bars; b++) {
        const rt = normRoot(chords[b]), cad = b === bars - 1;
        P.forEach(([o, v], k) => {
          if (cad && k % (P.length / 2)) return;        // cadence bar: just the two strong beats
          const m = dm(th.mode, th.root - 12 + oct, rt + o); needs.push([inst, m]); const vv = lv * v * (0.88 + r() * 0.24), pan = k % 2 ? 0.3 : -0.3;
          add(b * barS + k * step + hum(), 3, (g, T) => PLUCK[inst](g, T, m, vv, pan));
        });
      }
    }
    // frame drum / tabor
    if (S.drum) {
      for (let b = 0; b < bars; b++) {
        const p = Array.isArray(S.drum) ? S.drum[b % S.drum.length] : S.drum, step = barS / p.length;
        [...p].forEach((ch, k) => {
          const t = b * barS + k * step;
          if (ch === 'r') { for (let q = 0; q < 3; q++) add(t + q * step / 3, .5, (g, T) => drum(g, T, 't', .1 + q * .04, 0.1)); }
          else if (DLV[ch]) { const v = DLV[ch] * (0.85 + r() * 0.3); add(t + hum(), .8, (g, T) => drum(g, T, ch, v, ch === 'z' ? 0.35 : -0.05)); }
        });
      }
    }
    // bells: phrase bells or starry twinkles
    if (S.bells === 'phrase') {
      for (let b = 0; b < bars; b += 4) {
        add(b * barS, 4, (g, T) => PLUCK.bell(g, T, th.root + 12, .28, -0.3));
        add(b * barS + barS / 2, 4, (g, T) => PLUCK.bell(g, T, dm(th.mode, th.root + 12, 4), .18, 0.3));
      }
    }
    if (S.bells === 'twinkle') {
      for (let b = 0; b < bars; b++) for (let q = 0; q < 2; q++) {
        let m = dm(th.mode, th.root + 12, [0, 1, 2, 4, 5, 7][Math.floor(r() * 6)]); if (m > 100) m -= 12; needs.push(['chime', m]);
        const t = b * barS + Math.floor(r() * th.bar * 2) * sb / 2, v = 0.05 + r() * 0.06, pan = (r() * 2 - 1) * 0.7;
        add(t, 2, (g, T) => PLUCK.chime(g, T, m, v, pan));
      }
    }
    ev.sort((a, b) => a.t - b.t);
    if (S.bells === 'phrase') needs.push(['bell', th.root + 12], ['bell', dm(th.mode, th.root + 12, 4)]);
    if (S.drum) needs.push(['drum', 'D'], ['drum', 't'], ['drum', 'z'], ['drum', 'T']);
    return { len: bars * barS, ev, needs };
  }

  // One theme's look-ahead player: sections chain back to back, each on its own bus.
  function player(E, name) {
    const th = THEMES[name], c = E.ctx, P = { name, dead: false, buses: [] };
    const t0 = c.currentTime + 0.08, order = (th.intro || []).concat(th.form), loop0 = (th.intro || []).length;
    P.gain = c.createGain(); P.gain.gain.setValueAtTime(0, t0); P.gain.gain.linearRampToValueAtTime(1, t0 + FADE); P.gain.connect(E.musicIn);
    P.drone = drone({ ctx: c, out: P.gain }, t0, droneRoot(th), th.droneLv * 1.8);
    let si = 0, rep = 0, next = t0, cur = null;
    if (!E.offline) {   // bake this theme's buffers in small idle slices, first use first
      const seen = {}, list = [];
      order.forEach(k => buildSection(th, k, 0).needs.forEach(n => { const id = n.join(); if (!seen[id]) { seen[id] = 1; list.push(n); } }));
      const step = () => {
        if (P.dead || !list.length) return;
        const [k, m] = list.shift();
        if (k === 'drum') drumBuf(c, m); else if (k === 'lute' || k === 'harp') ksBuf(c, m, k); else bellBuf(c, m, k);
        setTimeout(step, 30);
      };
      setTimeout(step, 30);
    }
    P.pump = h => {
      if (P.dead) return;
      for (let guard = 0; guard < 8; guard++) {
        if (!cur) {
          if (next > h) return;
          const key = order[si]; if (++si >= order.length) { si = loop0; rep++; }
          const st = E.offline ? next : Math.max(next, c.currentTime + 0.05);   // resync after a long stall
          const sec = buildSection(th, key, rep), bus = c.createGain();
          bus.connect(P.gain); P.buses.push(bus);
          cur = { t0: st, len: sec.len, ev: sec.ev, i: 0, g: { ctx: c, out: bus }, bus };
          P.drone.level(th.sec[key].drone == null ? 1 : th.sec[key].drone, st);
          E.stats.sections.push(key); if (E.stats.sections.length > 16) E.stats.sections.shift();
        }
        const now = c.currentTime;
        while (cur.i < cur.ev.length && cur.t0 + cur.ev[cur.i].t < h) {
          const e = cur.ev[cur.i++], T = cur.t0 + e.t;
          if (!E.offline && T < now - 0.02) { E.stats.skipped++; continue; }   // never burst stale notes
          E.curT = T;
          if (E.allow(T, T + e.d + 1, e.prio)) e.fn(cur.g, T);
        }
        if (cur.i < cur.ev.length) return;
        next = cur.t0 + cur.len;
        const bus = cur.bus; cur = null;
        E.later(() => { try { bus.disconnect(); } catch (e) { } P.buses = P.buses.filter(b => b !== bus); }, (next + TAIL - c.currentTime) * 1000);
      }
    };
    P.stop = () => {
      if (P.dead) return; P.dead = true;
      const now = c.currentTime, gg = P.gain.gain;
      gg.cancelScheduledValues(now); gg.setValueAtTime(gg.value, now); gg.linearRampToValueAtTime(0, now + FADE);
      P.drone.stop(now + FADE);
      E.later(() => {
        P.buses.forEach(b => { try { b.disconnect(); } catch (e) { } }); P.buses = [];
        P.drone.kill(); try { P.gain.disconnect(); } catch (e) { }
      }, (FADE + 0.4) * 1000);
    };
    return P;
  }

  // ── Sound effects (all soft, bright and friendly) ──────────────────────────
  function tone(g, t, type, f0, f1, dur, lv, pan) {
    const c = g.ctx, o = c.createOscillator(), v = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(lv, t + 0.01); v.gain.setTargetAtTime(0, t + 0.012, dur / 3.5);
    o.connect(v); outTo(g, v, pan); o.start(t); o.stop(t + dur + 0.3);
    return o;
  }
  function noiseThrough(g, t, dur, type, q, lv, pan) {
    const c = g.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain();
    s.buffer = noiseBuf(c); s.loop = true; f.type = type; f.Q.value = q; v.gain.value = 0;
    s.connect(f); f.connect(v); outTo(g, v, pan); s.start(t, Math.random() * 1.5); s.stop(t + dur);
    return { f: f.frequency, v: v.gain };
  }
  let stepN = 0;
  const SFX = {
    swing(g, t) {
      const n = noiseThrough(g, t, 0.45, 'bandpass', 1.5, 0, 0.2);
      n.f.setValueAtTime(450, t); n.f.exponentialRampToValueAtTime(2800, t + 0.11); n.f.exponentialRampToValueAtTime(650, t + 0.3);
      n.v.setValueAtTime(0, t); n.v.linearRampToValueAtTime(0.5, t + 0.08); n.v.setTargetAtTime(0, t + 0.1, 0.07);
    },
    hit(g, t) {
      const c = g.ctx, o = tone(g, t, 'triangle', 700, 330, 0.24, 0.32, 0);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 22; lg.gain.setValueAtTime(45, t); lg.gain.setTargetAtTime(0, t, 0.09);
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.5);
      tone(g, t, 'sine', 1400, 660, 0.12, 0.08, 0);
      PLUCK.bell(g, t + 0.035, 91, 0.3, 0.15); PLUCK.chime(g, t + 0.07, 98, 0.18, -0.15);
    },
    poof(g, t) {
      const c = g.ctx, w = noiseThrough(g, t, 0.5, 'lowpass', 0.8, 0, 0);
      w.f.value = 850; w.v.setValueAtTime(0, t); w.v.linearRampToValueAtTime(0.35, t + 0.02); w.v.setTargetAtTime(0, t + 0.03, 0.08);
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21].forEach((s, i) => PLUCK.chime(g, t + 0.05 + i * 0.042, 76 + s, 0.17 - i * 0.008, i % 2 ? 0.45 : -0.45));
      const sh = noiseThrough(g, t, 1.5, 'highpass', 0.7, 0, 0); sh.f.value = 6500;
      sh.v.setValueAtTime(0, t); sh.v.linearRampToValueAtTime(0.1, t + 0.15); sh.v.setTargetAtTime(0, t + 0.2, 0.3);
      const l = c.createOscillator(), lg = c.createGain(); l.type = 'square'; l.frequency.value = 19; lg.gain.value = 0.05;
      l.connect(lg); lg.connect(sh.v); l.start(t); l.stop(t + 1.5);
    },
    nudge(g, t) {   // gentle, questioning "boop-boop?"
      tone(g, t, 'sine', 262, 262, 0.18, 0.26, -0.1); tone(g, t, 'triangle', 262, 262, 0.18, 0.08, -0.1);
      tone(g, t + 0.22, 'sine', 220, 294, 0.3, 0.26, 0.1); tone(g, t + 0.22, 'triangle', 220, 294, 0.3, 0.08, 0.1);
    },
    step(g, t) { const k = stepN++; play(g, t, drumBuf(g.ctx, 's' + (k % 4)), 0.1 + Math.random() * 0.03, k % 2 ? 0.12 : -0.12, 0.92 + Math.random() * 0.16); },
    cheer(g, t) {
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24].forEach((s, i) => PLUCK.harp(g, t + i * 0.045, 67 + s, 0.34 - i * 0.012, -0.5 + i * 0.1));
      PLUCK.chime(g, t + 0.52, 91, 0.12, 0.4);
    },
    click(g, t) { play(g, t, drumBuf(g.ctx, 'wood'), 0.3, 0); },
    fanfare(g, t) {
      const ts = [0, 0.14, 0.28, 0.42, 1.0, 1.2, 1.4], ds = [0.13, 0.13, 0.13, 0.55, 0.19, 0.19, 1.45];
      const mk = ms => ms.map((m, i) => ({ t: t + ts[i], d: ds[i], m }));
      lead(g, 'brass', mk([62, 62, 62, 69, 67, 69, 74]), 3.2, 0.12);
      lead(g, 'brass', mk([57, 57, 57, 62, 59, 62, 66]), 2.2, -0.15);
      lead(g, 'brass', [{ t: t + 1.4, d: 1.45, m: 50 }], 2.0, 0);
      let x = t + 0.42, dt = 0.11;
      while (x < t + 1.36) { play(g, x, drumBuf(g.ctx, 't'), 0.12 + (x - t) * 0.08, 0.1); x += dt; dt = Math.max(0.04, dt * 0.88); }
      play(g, t, drumBuf(g.ctx, 'D'), 0.35, 0); play(g, t + 1.4, drumBuf(g.ctx, 'D'), 0.55, 0); play(g, t + 1.4, drumBuf(g.ctx, 'z'), 0.18, 0.3);
      PLUCK.bell(g, t + 1.4, 86, 0.25, -0.2); PLUCK.chime(g, t + 1.55, 93, 0.14, 0.3);
    },
    sparkle(g, t) { const p = Math.random() - 0.5; PLUCK.chime(g, t, 96, 0.13, p); PLUCK.chime(g, t + 0.07, 103, 0.09, -p); },
    whoosh(g, t) {
      const c = g.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain();
      s.buffer = noiseBuf(c); s.loop = true; f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.35); f.frequency.exponentialRampToValueAtTime(450, t + 0.85);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.32, t + 0.3); v.gain.setTargetAtTime(0, t + 0.35, 0.15);
      s.connect(f); f.connect(v);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + 0.9); v.connect(p); p.connect(g.out); }
      else v.connect(g.out);
      s.start(t, Math.random()); s.stop(t + 1.1);
    },
  };

  // ── Engine: master chain + reverb + music/sfx buses (works on any context) ─
  function makeEngine(ctx, dest, offline) {
    const E = { ctx, offline, voices: [], cur: null, curT: 0, stats: { notes: 0, skipped: 0, capped: 0, sections: [] } };
    const G = () => ctx.createGain();
    E.master = G(); E.master.connect(dest);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.03; glue.release.value = 0.3;
    const pre = G(); pre.connect(glue); glue.connect(lim); lim.connect(E.master);
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
    const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), rg = G();
    hp.type = 'highpass'; hp.frequency.value = 190; lp.type = 'lowpass'; lp.frequency.value = 5200; rg.gain.value = 0.85;
    conv.connect(hp); hp.connect(lp); lp.connect(rg); rg.connect(pre);
    E.musicIn = G(); const mv = G(); mv.gain.value = 0.5; E.duckG = G();
    E.musicIn.connect(mv); mv.connect(E.duckG); E.duckG.connect(pre);
    const ms = G(); ms.gain.value = 0.42; E.duckG.connect(ms); ms.connect(conv);
    E.sfxIn = G(); E.sfxIn.gain.value = 0.9; E.sfxIn.connect(pre);
    const ss = G(); ss.gain.value = 0.28; E.sfxIn.connect(ss); ss.connect(conv);

    E.later = (fn, ms2) => { if (!offline) setTimeout(fn, Math.max(0, ms2)); };
    E.allow = (T, end, prio) => {
      if (E.voices.length >= CAP * 0.75) E.voices = E.voices.filter(x => x > T);
      if (E.voices.length >= CAP && prio < 3) { E.stats.capped++; return false; }
      E.voices.push(end); E.stats.notes++; return true;
    };
    E.music = name => {
      name = THEMES[name] ? name : null;
      if ((E.cur ? E.cur.name : null) === name) return;
      if (E.cur) E.cur.stop();
      E.cur = name ? player(E, name) : null;
      if (E.cur) E.cur.pump(ctx.currentTime + LOOK);
    };
    E.tick = () => { if (E.cur) E.cur.pump(ctx.currentTime + LOOK); };
    E.sfx = (name, at) => {
      const fn = SFX[name]; if (!fn) return;
      const t = at == null ? ctx.currentTime + 0.01 : at;
      if (E.allow(t, t + 1.5, name === 'step' ? 1 : 3)) fn({ ctx, out: E.sfxIn }, t);
    };
    const hold = (p, now) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); } };
    E.duck = on => { const p = E.duckG.gain, now = ctx.currentTime; hold(p, now); p.setTargetAtTime(on ? DUCK : 1, on ? now : now + 0.25, on ? 0.07 : 0.45); };
    E.mute = on => { const p = E.master.gain, now = ctx.currentTime; hold(p, now); p.setTargetAtTime(on ? 0 : 1, now, 0.04); };
    return E;
  }

  // ── Speech: warmest English voice, ducking, Chrome guards ──────────────────
  const PREF = ['Aria', 'Jenny', 'Natural', 'Samantha', 'Karen', 'Moira', 'Google UK English Female', 'Zira', 'Libby', 'Sonia', 'Serena', 'Tessa', 'Google US English'];
  const SS = window.speechSynthesis || null;
  let voice = null, keep = 0, duckN = 0;
  const badVoice = {}, live = new Set();
  function pickVoice() {
    if (!SS) return null;
    let vs = (SS.getVoices() || []).filter(v => !badVoice[v.name]);
    const en = vs.filter(v => /^en([-_]|$)/i.test(v.lang || '')); if (en.length) vs = en;
    if (navigator.onLine === false) { const loc = vs.filter(v => v.localService); if (loc.length) vs = loc; }
    for (const p of PREF) { const v = vs.find(x => x.name && x.name.indexOf(p) >= 0); if (v) return v; }
    return vs.find(v => /en[-_](US|GB|AU|IE|CA|NZ)/i.test(v.lang || '')) || vs[0] || null;
  }
  if (SS) {
    const on = () => { voice = pickVoice(); };
    if (SS.addEventListener) SS.addEventListener('voiceschanged', on); else SS.onvoiceschanged = on;
    on();
  }
  function duck(on) {
    duckN = Math.max(0, duckN + (on ? 1 : -1));
    if (E && ((on && duckN === 1) || (!on && duckN === 0))) E.duck(on);
  }
  function speak(text, opts) {
    opts = opts || {};
    if (!SS || !text || isMuted) return Promise.resolve();
    const rate = opts.rate || 0.88, pitch = opts.pitch || 1.1;
    let cancelled = false;
    if (opts.interrupt !== false && (SS.speaking || SS.pending)) { SS.cancel(); cancelled = true; }
    if (!voice) voice = pickVoice();
    return new Promise(res => {
      let done = false, started = false, tries = 0; const mine = [];
      const fin = () => {
        if (done) return; done = true; clearTimeout(to);
        mine.forEach(u => live.delete(u)); duck(false);
        if (!live.size && keep) { clearInterval(keep); keep = 0; }
        res();
      };
      const to = setTimeout(fin, (String(text).length * 0.09 + 1.5) * (0.88 / rate) * 1000 + 400);
      const go = v => {
        if (done) return;
        const u = new SpeechSynthesisUtterance(text);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        u.rate = rate; u.pitch = pitch; u.volume = 1;
        u.onstart = () => { started = true; };
        u.onend = fin;
        u.onerror = e => {
          const er = e && e.error;
          if (!started && v && !v.localService && !tries++ && er !== 'interrupted' && er !== 'canceled') {
            badVoice[v.name] = 1; voice = pickVoice(); go(voice && voice !== v ? voice : null);   // network voice failed: retry local
          } else fin();
        };
        mine.push(u); live.add(u); SS.speak(u);
      };
      duck(true);
      if (!keep) keep = setInterval(() => { if (SS.paused) SS.resume(); }, 4000);   // Chrome stall guard
      if (cancelled) setTimeout(() => go(voice), 40); else go(voice);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  let E = null, pending = null, isMuted = false, timer = 0;
  const api = {
    init() {
      if (!AC) return;
      if (!E) {
        let ctx; try { ctx = new AC(); } catch (e) { return; }
        E = makeEngine(ctx, ctx.destination, false);
        E.master.gain.value = isMuted ? 0 : 1;
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);   // iOS unlock
        if (SS && !isMuted) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; SS.speak(u); } catch (e) { } }
        timer = setInterval(() => E.tick(), TICK);
        document.addEventListener('visibilitychange', () => { if (E) E.tick(); });
        if (pending) E.music(pending);
      }
      if (E.ctx.state !== 'running' && E.ctx.resume) { try { E.ctx.resume().catch(() => { }); } catch (e) { } }
      if (!voice) voice = pickVoice();
    },
    setMusic(name) { if (!E) { pending = name; return; } E.music(name); },
    sfx(name) { if (E && !isMuted) E.sfx(name); },
    speak,
    setMuted(b) {
      isMuted = !!b;
      if (E) E.mute(isMuted);
      if (isMuted && SS) SS.cancel();
    },
    // Test hook: render a theme or an sfx into any (Offline)AudioContext.
    _render(ctx, name, seconds, at) {
      const X = api._last = makeEngine(ctx, ctx.destination, true);
      if (THEMES[name]) { X.music(name); X.cur.pump(seconds); }
      else X.sfx(name, at == null ? 0.05 : at);
      return X;
    },
    _T: THEMES, _sfx: Object.keys(SFX), _bake: { ks: ksBuf, bell: bellBuf, drum: drumBuf, ir: impulse },
    _state() { return E ? { ctx: E.ctx.state, music: E.cur && E.cur.name, voices: E.voices.length, stats: E.stats, voice: voice && voice.name } : null; },
  };
  Object.defineProperty(api, 'muted', { get: () => isMuted, enumerable: true });
  AK.audio = api;
})();
