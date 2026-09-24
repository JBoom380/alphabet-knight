// ─── WORLD: terrain, cobble road, vegetation, villages (streamed chunks) ─────
window.AK = window.AK || {};
(function () {
  const T = THREE;
  const CH = 60, NS = 7, AHEAD = 262, BEHIND = 45;   // chunk length, slots, stream window
  const VC = 330, V0 = 100;                           // village cell length, first offset
  const RH = 0.85;                                    // unit gable height of a house
  const U = { time: { value: 0 } };
  let scene = null, lastZ = 0;

  // ── Math + noise ───────────────────────────────────────────────────────────
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash2(x, z) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.03 + 17, z * 2.03 + 9) * 0.3 + vnoise(x * 4.1 + 3, z * 4.1 + 41) * 0.15;

  // ── Path + height ──────────────────────────────────────────────────────────
  function pathX(z) { return 6.5 * Math.sin(z * 0.0161 + 0.5) + 4 * Math.sin(z * 0.0303 + 1.7) + 1.5 * Math.sin(z * 0.0476 + 4); }
  function pathD(z) { return 6.5 * 0.0161 * Math.cos(z * 0.0161 + 0.5) + 4 * 0.0303 * Math.cos(z * 0.0303 + 1.7) + 1.5 * 0.0476 * Math.cos(z * 0.0476 + 4); }
  const roadY = z => 2.4 * Math.sin(z * 0.0071 + 1.1) + 1.1 * Math.sin(z * 0.019 + 0.3);
  const vCenter = k => (k === 0 ? -112 : -(k * VC + V0 + hash2(k, 11) * 110));
  const vHalf = k => 40 + hash2(k, 12) * 26;
  const hasMill = k => k === 0 || hash2(k, 4) < 0.4;
  const kOf = z => Math.floor((-z - V0) / VC);
  function villageW(z) {
    const k0 = kOf(z); let w = 0;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const t = 1 - sstep(vHalf(k), vHalf(k) + 45, Math.abs(z - vCenter(k)));
      if (t > w) w = t;
    }
    return w;
  }
  function forestM(x, z, d, vw) {
    let f = sstep(0.32, 0.52, vnoise(x * 0.011 + 40, z * 0.011 + 3)) + sstep(60, 130, d) * 0.5;
    f *= sstep(14, 24, d) * (1 - vw * (d < 60 ? 1 : 0.4));
    return clamp(f, 0, 1);
  }
  // streams cross the road under small stone bridges, away from villages
  // stream k sits in the open gap between village k and village k + 1
  const sZ = k => 2 * Math.round((vCenter(k) - vHalf(k) + vCenter(k + 1) + vHalf(k + 1)) / 4);
  const hasStream = k => k >= 0 && hash2(k, 21) < 0.7 && (vCenter(k) - vHalf(k)) - (vCenter(k + 1) + vHalf(k + 1)) > 105;
  function streamNear(z) { // z of the nearest stream, or NaN
    const k = kOf(z);
    for (let j = k - 1; j <= k + 1; j++) if (hasStream(j) && Math.abs(z - sZ(j)) < 40) return sZ(j);
    return NaN;
  }
  const nearS = (z, r) => { const s = streamNear(z); return s === s && Math.abs(z - s) < r; };
  function streamDip(z, d) {
    const s = streamNear(z); if (s !== s) return 0;
    const t = Math.abs(z - s);
    return t > 6 ? 0 : 2.6 * (1 - sstep(1.4, 5.8, t)) * (1 - sstep(30, 60, d));
  }
  function tH(x, z) { return baseH(x, z) - streamDip(z, Math.abs(x - pathX(z))); }
  function heightAt(x, z) { return Math.abs(x - pathX(z)) < 3 ? roadY(z) : tH(x, z); }
  function baseH(x, z) {
    const p = pathX(z), d = Math.abs(x - p), base = roadY(z);
    if (d < 4.5) return base;
    const vw = villageW(z);
    const side = x > p ? 1 : 0;
    const riseK = 0.05 + 0.14 * vnoise(z * 0.006 + side * 31.7, side * 13.1);
    const hills = (fbm(x * 0.016, z * 0.016) - 0.42) * 30 * sstep(4.5, 30, d);
    const rise = Math.min(d - 4.5, 120) * riseK;
    const bumps = (vnoise(x * 0.11, z * 0.11) - 0.5) * 1.3;
    return base + ((hills + rise) * (1 - 0.8 * vw) + bumps) * sstep(4.5, 12, d);
  }

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, wrapS, wrapT) {
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.LinearMipmapLinearFilter;
    t.wrapS = wrapS || T.ClampToEdgeWrapping; t.wrapT = wrapT || T.ClampToEdgeWrapping; t.anisotropy = 4;
    return t;
  }
  function rrect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  }

  // ── Cobblestone road texture (4.4 m wide, tiles along the road) ────────────
  function cobbleTex() {
    const S = 192, E = 21, c = cv(S, S), g = c.getContext('2d'), R = AK.rng(1234);
    for (let y = 0; y < S; y += 3) { const l = 2 + R() * 10, r = S - 2 - R() * 10; g.fillStyle = '#76583a'; g.fillRect(l | 0, y, (r - l) | 0, 3); }
    for (let k = 0; k < 600; k++) {
      const x = R() < 0.5 ? 2 + R() * 22 : S - 24 + R() * 22, y = R() * S;
      g.fillStyle = ['#5f9a34', '#4a7f2a', '#8f6c45', '#a88a64', '#6fae3c'][k % 5]; g.fillRect(x | 0, y | 0, 2, 2);
    }
    for (let y = 0; y < S; y += 2) { const l = E - 5 + R() * 3, r = S - E + 5 - R() * 3; g.fillStyle = '#3b3126'; g.fillRect(l | 0, y, (r - l) | 0, 2); }
    for (let k = 0; k < 1100; k++) {
      g.fillStyle = R() < 0.55 ? '#4f8a2c' : '#3a6a24'; g.fillRect((E - 4 + R() * (S - 2 * E + 8)) | 0, (R() * S) | 0, 2, 2);
    }
    const BASE = ['#d2b98f', '#c3a87e', '#dcc79f', '#b69c74', '#cbb189', '#ad936d', '#d8c09a'];
    const rows = 12, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh; let x = E - 4 + R() * 6 - (r % 2) * 5;
      while (x < S - E - 3) {
        let w = 12 + R() * 9; if (x + w > S - E + 4) w = S - E + 4 - x; if (w < 7) break;
        const ix = x + 1.3, iy = y0 + 1.3 + (R() - 0.5) * 1.2, iw = w - 2.6, ih = rh - 2.8, rad = Math.min(iw, ih) * 0.48;
        g.fillStyle = '#5c4a36'; rrect(g, ix + 0.8, iy + 1.4, iw, ih, rad);
        const b = BASE[(R() * BASE.length) | 0];
        g.fillStyle = b; rrect(g, ix, iy, iw, ih - 0.6, rad);
        g.fillStyle = 'rgba(120,96,70,0.55)'; rrect(g, ix + iw * 0.35, iy + ih * 0.5, iw * 0.62, ih * 0.45, rad * 0.8);
        g.fillStyle = b; rrect(g, ix + 1, iy + 1, iw * 0.8, ih * 0.6, rad * 0.9);
        g.fillStyle = 'rgba(255,248,226,0.75)'; rrect(g, ix + 2, iy + 1.6, iw * 0.42, ih * 0.28, rad * 0.6);
        if (R() < 0.18) { g.fillStyle = '#5d8f33'; g.fillRect((ix + iw - 5) | 0, (iy + ih - 5) | 0, 3, 3); }
        x += w;
      }
    }
    return tex(c, T.ClampToEdgeWrapping, T.RepeatWrapping);
  }

  // ── Timber-frame wall atlas: [front v0 | end v0] / [front v1 | end v1] ──────
  function wallAtlas() {
    const S = 256, c = cv(S, S), g = c.getContext('2d'), e = cv(S, S), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    const BEAM = '#4a2b18', R = AK.rng(99);
    function plinth(ox, oy, y0, w) {
      g.fillStyle = '#6d675d'; g.fillRect(ox, oy + y0, w, 128 - y0);
      for (let y = y0 + 1, row = 0; y < 128; y += 7, row++) {
        for (let x = -(row % 2) * 6; x < w; x += 12) {
          g.fillStyle = ['#a39d91', '#948e82', '#b3ada1'][(R() * 3) | 0];
          g.fillRect(ox + Math.max(0, x) + 1, oy + y, Math.min(11, w - x - 1) - (x < 0 ? -x : 0), 5);
          g.fillStyle = '#c4beb2'; g.fillRect(ox + Math.max(0, x) + 1, oy + y, 4, 1);
        }
      }
    }
    function window1(ox, oy, cx, cy, w, h, shut) {
      const x = ox + cx - w / 2, y = oy + cy - h / 2;
      if (shut) { g.fillStyle = shut; g.fillRect(x - 6, y, 5, h); g.fillRect(x + w + 1, y, 5, h); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 4, y, 1, h); g.fillRect(x + w + 3, y, 1, h); }
      g.fillStyle = BEAM; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = '#ffb040'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ffe28a'; g.fillRect(x, y, w / 2 - 1, h / 2 - 1);
      g.fillStyle = BEAM; g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + h / 2 - 1, w, 2);
      ge.fillStyle = '#ff9a2e'; ge.fillRect(x, y, w, h); ge.fillStyle = '#ffd070'; ge.fillRect(x, y, w / 2 - 1, h / 2 - 1);
      ge.fillStyle = '#000'; ge.fillRect(x + w / 2 - 1, y, 2, h); ge.fillRect(x, y + h / 2 - 1, w, 2);
      g.fillStyle = '#6b3f1f'; g.fillRect(x - 3, y + h + 2, w + 6, 4);
      for (let k = 0; k < w + 4; k += 3) { g.fillStyle = ['#e8364a', '#ff7ab8', '#ffd23a', '#e8364a'][(k / 3) % 4 | 0]; g.fillRect(x - 2 + k, y + h, 2, 2); }
    }
    function brace(ox, oy, x0, y0, x1, y1) { g.strokeStyle = BEAM; g.lineWidth = 4; g.beginPath(); g.moveTo(ox + x0, oy + y0); g.lineTo(ox + x1, oy + y1); g.stroke(); }
    function xBrace(ox, oy, x, y, w, h) { brace(ox, oy, x, y, x + w, y + h); brace(ox, oy, x + w, y, x, y + h); }
    function speckle(ox, oy, w, h, col) { for (let k = 0; k < 140; k++) { g.fillStyle = col; g.fillRect(ox + ((R() * w) | 0), oy + ((R() * h) | 0), 2, 1); } }
    for (let v = 0; v < 2; v++) {
      const oy = v * 128, cream = v ? '#f7f1e4' : '#f1e2c2', shut = v ? '#3f7fa0' : '#4f8a3a';
      // front: y_unit 1 -> row 0, y_unit 0 -> row 95, -0.35 -> row 128
      let ox = 0;
      g.fillStyle = cream; g.fillRect(ox, oy, 128, 90); speckle(ox, oy, 128, 88, v ? '#e6ddcc' : '#e2d0ac');
      plinth(ox, oy, 88, 128);
      const B = (x, y, w, h) => { g.fillStyle = BEAM; g.fillRect(ox + x, oy + y, w, h); };
      B(0, 0, 128, 5); B(0, 42, 128, 5); B(0, 83, 128, 6);
      [0, 41, 82, 123].forEach(x => B(x, 0, 5, 89));
      if (v === 0) {
        window1(ox, oy, 23, 23, 16, 16, shut); xBrace(ox, oy, 46, 5, 36, 37); window1(ox, oy, 105, 23, 16, 16, shut);
        brace(ox, oy, 5, 83, 41, 47); window1(ox, oy, 105, 64, 16, 14, shut);
      } else {
        xBrace(ox, oy, 5, 5, 36, 37); window1(ox, oy, 64, 23, 18, 16, shut); xBrace(ox, oy, 87, 5, 36, 37);
        window1(ox, oy, 23, 64, 16, 14, shut); brace(ox, oy, 87, 47, 123, 83);
      }
      // door (lower middle bay)
      const dx = ox + 54, dy = oy + 56;
      g.fillStyle = BEAM; rrect(g, dx - 2, dy - 2, 24, 42, 10);
      g.fillStyle = v ? '#7a4424' : '#8a5a2a'; rrect(g, dx, dy, 20, 40, 9);
      g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 4; k < 20; k += 5) g.fillRect(dx + k, dy + 3, 1, 37);
      g.fillStyle = '#2a2320'; g.fillRect(dx + 1, dy + 12, 18, 2); g.fillRect(dx + 1, dy + 28, 18, 2);
      g.fillStyle = '#ffd24a'; g.fillRect(dx + 15, dy + 21, 3, 3);
      g.fillStyle = '#ffb040'; g.fillRect(dx + 7, dy + 5, 6, 4); ge.fillStyle = '#ff9a2e'; ge.fillRect(dx + 7, dy + 5, 6, 4);
      // end wall: y_unit = 1.85 - r * 2.2 / 128 ; y=1 -> r 49.5, y=0 -> r 107.6
      ox = 128;
      g.fillStyle = cream; g.fillRect(ox, oy, 128, 102); speckle(ox, oy, 128, 100, v ? '#e6ddcc' : '#e2d0ac');
      plinth(ox, oy, 101, 128);
      const E = (x, y, w, h) => { g.fillStyle = BEAM; g.fillRect(ox + x, oy + y, w, h); };
      E(0, 47, 128, 5); E(0, 75, 128, 4); E(0, 97, 128, 5); E(62, 0, 5, 101);
      [0, 123].forEach(x => E(x, 47, 5, 55));
      brace(ox, oy, 64, 10, 22, 48); brace(ox, oy, 64, 10, 106, 48);
      g.fillStyle = BEAM; g.beginPath(); g.arc(ox + 64, oy + 31, 7, 0, 7); g.fill();
      g.fillStyle = '#ffb040'; g.beginPath(); g.arc(ox + 64, oy + 31, 5, 0, 7); g.fill();
      ge.fillStyle = '#ff9a2e'; ge.beginPath(); ge.arc(ox + 64, oy + 31, 5, 0, 7); ge.fill();
      if (v === 0) { window1(ox, oy, 33, 64, 16, 12, shut); xBrace(ox, oy, 67, 79, 56, 18); window1(ox, oy, 95, 64, 16, 12, shut); }
      else { xBrace(ox, oy, 5, 52, 57, 23); window1(ox, oy, 95, 64, 16, 12, shut); brace(ox, oy, 5, 97, 62, 79); }
    }
    return [tex(c), tex(e)];
  }

  // ── Bridge side (stone with an open arch) + water ripples ─────────────────
  function bridgeTex() {
    const W = 128, H = 48, c = cv(W, H), g = c.getContext('2d'), R = AK.rng(55);
    g.fillStyle = '#6f6a60'; g.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < H; y += 8, row++) for (let x = -(row % 2) * 7; x < W; x += 14) {
      g.fillStyle = ['#aaa497', '#9a9488', '#b9b3a5', '#8e887c'][(R() * 4) | 0]; g.fillRect(x + 1, y + 1, 12, 6);
      g.fillStyle = '#cfc9bb'; g.fillRect(x + 1, y + 1, 5, 1);
      if (R() < 0.15) { g.fillStyle = '#5e9a3a'; g.fillRect(x + 2, y + 1, 6, 2); }
    }
    g.fillStyle = '#5a554c'; g.fillRect(0, 0, W, 3);
    g.fillStyle = '#8a8478'; g.beginPath(); g.ellipse(64, H, 40, 34, 0, Math.PI, 0); g.fill();
    g.strokeStyle = '#4a463e'; g.lineWidth = 1;
    for (let a = 0; a <= 12; a++) { const t = Math.PI + a / 12 * Math.PI; g.beginPath(); g.moveTo(64 + Math.cos(t) * 33, H + Math.sin(t) * 27); g.lineTo(64 + Math.cos(t) * 40, H + Math.sin(t) * 34); g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.ellipse(64, H, 33, 27, 0, Math.PI, 0); g.fill();
    g.globalCompositeOperation = 'source-over';
    return tex(c);
  }
  function waterTex() {
    const S = 64, c = cv(S, S), g = c.getContext('2d'), R = AK.rng(66);
    g.fillStyle = '#2f7fc0'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 40; k++) { g.fillStyle = k % 3 ? '#4fa2e0' : '#1f5f9a'; g.fillRect((R() * S) | 0, (R() * S) | 0, 6 + ((R() * 10) | 0), 2); }
    for (let k = 0; k < 14; k++) { g.fillStyle = '#c8ecff'; g.fillRect((R() * S) | 0, (R() * S) | 0, 3 + ((R() * 5) | 0), 1); }
    return tex(c, T.RepeatWrapping, T.RepeatWrapping);
  }

  // ── Roof tiles (tinted per house) ──────────────────────────────────────────
  function roofTex() {
    const S = 64, c = cv(S, S), g = c.getContext('2d');
    g.fillStyle = '#8f8580'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 4; r++) for (let k = -1; k < 5; k++) {
      const x = k * 16 + (r % 2) * 8, y = r * 16;
      g.fillStyle = '#f2ebe4'; rrect(g, x + 1, y, 14, 15, 6);
      g.fillStyle = '#c9bdb4'; rrect(g, x + 1, y + 9, 14, 6, 5);
      g.fillStyle = '#fffaf4'; g.fillRect(x + 3, y + 2, 5, 2);
    }
    return tex(c, T.RepeatWrapping, T.RepeatWrapping);
  }

  // ── Geometry helpers ───────────────────────────────────────────────────────
  function M(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  }
  function lumpy(g0, amt, seed) {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.round(x * 97), b = Math.round(y * 97), c = Math.round(z * 97);
      p.setXYZ(i, x + (hash2(a + c * 1013, b + seed) - 0.5) * amt, y + (hash2(b + a * 733, c + seed * 7) - 0.5) * amt, z + (hash2(c + b * 571, a + seed * 13) - 0.5) * amt);
    }
    return g;
  }
  // parts: [geometry, colour (hex | fn(ny, cy, R) -> hex), matrix?, jitter?]
  function merge(parts, seed) {
    const gs = []; let n = 0;
    for (const [g0, col, m, jit] of parts) {
      const g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
      gs.push([g, col, jit || 0]); n += g.attributes.position.count;
    }
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), c = new T.Color(), R = AK.rng(seed || n);
    const a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3();
    let o = 0;
    for (const [g, col, jit] of gs) {
      const p = g.attributes.position.array, cnt = g.attributes.position.count;
      P.set(p, o * 3);
      for (let f = 0; f < cnt; f += 3) {
        const i = f * 3;
        a.set(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]);
        b.set(p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]);
        d.crossVectors(a, b).normalize();
        const cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3;
        c.set(typeof col === 'function' ? col(d.y, cy, R) : col);
        if (jit) c.multiplyScalar(1 + (R() - 0.5) * jit);
        for (let k = 0; k < 3; k++) { const j = (o + f + k) * 3; C[j] = c.r; C[j + 1] = c.g; C[j + 2] = c.b; }
      }
      o += cnt;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(P, 3));
    geo.setAttribute('color', new T.BufferAttribute(C, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // ── Vegetation + prop geometry ─────────────────────────────────────────────
  function geoPine() {
    const tier = base => (ny, cy, R) => (ny < -0.5 ? 0x173a22 : R() < 0.25 ? base - 0x040a06 : base);
    return merge([
      [new T.CylinderGeometry(0.14, 0.22, 1.4, 5, 1, true), 0x5a3a22, M(0, 0.7, 0)],
      [new T.ConeGeometry(1.65, 2.5, 7), tier(0x1e5530), M(0, 2.0, 0)],
      [new T.ConeGeometry(1.25, 2.2, 7, 1, true), tier(0x24633a), M(0, 3.15, 0, 1, 1, 1, 0, 0.45, 0)],
      [new T.ConeGeometry(0.82, 1.9, 7, 1, true), tier(0x2d7444), M(0, 4.2, 0, 1, 1, 1, 0, 0.9, 0)],
    ], 5);
  }
  function geoTree() {
    const leaf = (ny, cy, R) => (ny > 0.55 ? (R() < 0.3 ? 0x9ad64a : 0x7cc43e) : ny > -0.15 ? (R() < 0.25 ? 0x68b236 : 0x55a02f) : 0x3b7a26);
    return merge([
      [new T.CylinderGeometry(0.17, 0.27, 2.4, 5, 1, true), 0x6b4a2c, M(0, 1.2, 0)],
      [lumpy(new T.IcosahedronGeometry(1.55, 1), 0.3, 1), leaf, M(0, 3.1, 0)],
      [lumpy(new T.IcosahedronGeometry(1.15, 0), 0.25, 2), leaf, M(1.0, 2.7, 0.3)],
      [lumpy(new T.IcosahedronGeometry(1.1, 0), 0.25, 3), leaf, M(-0.9, 2.8, -0.4)],
      [lumpy(new T.IcosahedronGeometry(1.0, 0), 0.2, 4), leaf, M(0.1, 4.1, 0.2)],
    ], 7);
  }
  function geoBush(bloom) {
    const f = (ny, cy, R) => (ny > 0.5 ? 0x4f9a36 : ny > -0.2 ? 0x3c8430 : 0x2a6424);
    const parts = [
      [lumpy(new T.IcosahedronGeometry(0.8, 0), 0.2, 5), f, M(0, 0.5, 0, 1, 0.82, 1)],
      [lumpy(new T.IcosahedronGeometry(0.56, 0), 0.16, 6), f, M(0.6, 0.38, 0.25, 1, 0.85, 1)],
    ];
    if (bloom) { // blossom specks sitting on the leaf surface
      const R = AK.rng(bloom & 0xffff), dot = new T.OctahedronGeometry(0.075, 0);
      for (let k = 0; k < 26; k++) {
        const big = k < 17, a = R() * 6.3, e = R() * 1.3 - 0.15, r = big ? 0.8 : 0.56;
        const cx = big ? 0 : 0.6, cy = big ? 0.5 : 0.38, cz = big ? 0 : 0.25;
        parts.push([dot, k % 5 ? bloom : 0xffffff, M(cx + Math.cos(a) * Math.cos(e) * r * 0.97, cy + Math.sin(e) * r * 0.8, cz + Math.sin(a) * Math.cos(e) * r * 0.97)]);
      }
    }
    return merge(parts, bloom ? 11 : 9);
  }
  function geoRock() {
    return merge([[lumpy(new T.DodecahedronGeometry(0.6, 0), 0.22, 8), (ny, cy, R) => (ny > 0.55 ? 0x5e9a3a : [0x9a968c, 0x86827a, 0xb0aca2][(R() * 3) | 0]), M(0, 0.25, 0, 1, 0.75, 1)]], 3);
  }
  function geoGrass() {
    const R = AK.rng(21), P = [], C = [], lo = new T.Color(0x2c6a20), hi = new T.Color(0x9ad852), hi2 = new T.Color(0xc4e86a);
    for (let b = 0; b < 6; b++) {
      const a = b / 6 * Math.PI * 2 + R() * 0.7, h = 0.3 + R() * 0.32, lean = 0.1 + R() * 0.14, r0 = 0.05;
      const cx = Math.cos(a), sz = Math.sin(a), px = -sz * 0.05, pz = cx * 0.05;
      P.push(cx * r0 - px, 0, sz * r0 - pz, cx * r0 + px, 0, sz * r0 + pz, cx * (r0 + lean), h, sz * (r0 + lean));
      const t = R() < 0.3 ? hi2 : hi;
      C.push(lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, t.r, t.g, t.b);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit like the meadow
    return g;
  }
  function geoFlower() {
    return merge([
      [new T.OctahedronGeometry(0.11, 0), 0xffffff, M(0, 0.26, 0, 1, 0.7, 1)],
    ], 2);
  }
  function geoFence() {
    return merge([
      [new T.BoxGeometry(0.15, 1.0, 0.15), 0x6e4a2a, M(-1.25, 0.5, 0)], [new T.BoxGeometry(0.15, 1.0, 0.15), 0x6e4a2a, M(1.25, 0.5, 0)],
      [new T.BoxGeometry(2.7, 0.1, 0.07), 0x946638, M(0, 0.42, 0)], [new T.BoxGeometry(2.7, 0.1, 0.07), 0x946638, M(0, 0.8, 0)],
    ], 3);
  }
  function geoBarrel() {
    return merge([[new T.CylinderGeometry(0.36, 0.33, 0.9, 8, 6), (ny, cy) => (ny > 0.9 ? 0xa87a48 : (cy > 0.12 && cy < 0.2) || (cy > 0.7 && cy < 0.78) ? 0x3a2e28 : 0x8c5a30), M(0, 0.45, 0)]], 4);
  }
  function geoHay() {
    const s = (ny, cy, R) => (R() < 0.3 ? 0xd9ab35 : ny > 0.4 ? 0xf0cc5a : 0xe2b940);
    return merge([[new T.CylinderGeometry(0.95, 1.05, 1.0, 8), s, M(0, 0.5, 0)], [new T.ConeGeometry(1.0, 0.9, 8), s, M(0, 1.45, 0)]], 6);
  }
  function geoWell() {
    return merge([
      [new T.CylinderGeometry(1.0, 1.1, 0.85, 10), (ny, cy, R) => (ny > 0.9 ? 0xb8b2a6 : [0x9a948a, 0x8a8478, 0xaaa498][(R() * 3) | 0]), M(0, 0.42, 0)],
      [new T.CylinderGeometry(0.82, 0.82, 0.06, 10), 0x2f6c9a, M(0, 0.84, 0)],
      [new T.BoxGeometry(0.14, 1.9, 0.14), 0x6e4a2a, M(-0.92, 1.3, 0)], [new T.BoxGeometry(0.14, 1.9, 0.14), 0x6e4a2a, M(0.92, 1.3, 0)],
      [new T.BoxGeometry(2.3, 0.08, 1.1), 0xb8402a, M(0, 2.45, 0.4, 1, 1, 1, 0.62, 0, 0)],
      [new T.BoxGeometry(2.3, 0.08, 1.1), 0xa03422, M(0, 2.45, -0.4, 1, 1, 1, -0.62, 0, 0)],
      [new T.CylinderGeometry(0.06, 0.06, 1.9, 5), 0x4a3020, M(0, 1.7, 0, 1, 1, 1, 0, 0, Math.PI / 2)],
      [new T.CylinderGeometry(0.16, 0.13, 0.25, 6), 0x7a5230, M(0.2, 1.3, 0)],
    ], 12);
  }
  function geoStall() {
    const parts = [
      [new T.BoxGeometry(2.5, 0.9, 1.0), 0x9a6a3c, M(0, 0.45, 0)],
      [new T.BoxGeometry(2.6, 0.08, 1.1), 0xb8844c, M(0, 0.92, 0)],
    ];
    [[-1.2, 0.55], [1.2, 0.55], [-1.2, -0.55], [1.2, -0.55]].forEach(([x, z]) => parts.push([new T.BoxGeometry(0.1, z > 0 ? 2.1 : 2.5, 0.1), 0x6e4a2a, M(x, z > 0 ? 1.05 : 1.25, z)]));
    const fruit = [0xe8302a, 0xff9a20, 0x7cc43e, 0xffd23a, 0xb04ad0];
    for (let k = 0; k < 10; k++) parts.push([new T.IcosahedronGeometry(0.13, 0), fruit[k % 5], M(-1.0 + (k % 5) * 0.5, 1.04, k < 5 ? 0.2 : -0.18)]);
    for (let j = 0; j < 7; j += 2) parts.push([new T.BoxGeometry(0.4, 0.05, 1.6), 0xf7efdc, M(-1.2 + j * 0.4, 2.3, 0, 1, 1, 1, 0.32, 0, 0)]);
    return merge(parts, 13);
  }
  function geoAwning() {
    const parts = [];
    for (let j = 1; j < 7; j += 2) parts.push([new T.BoxGeometry(0.4, 0.05, 1.6), 0xffffff, M(-1.2 + j * 0.4, 2.3, 0, 1, 1, 1, 0.32, 0, 0)]);
    for (let j = 0; j < 7; j++) parts.push([new T.BoxGeometry(0.38, 0.22, 0.04), j % 2 ? 0xffffff : 0xffffff, M(-1.2 + j * 0.4, 1.95, 0.76)]);
    return merge(parts, 14);
  }
  function geoPole() {
    return merge([[new T.CylinderGeometry(0.06, 0.08, 4.3, 5), 0x5a3a22, M(0, 2.15, 0)], [new T.IcosahedronGeometry(0.15, 0), 0xffd24a, M(0, 4.38, 0)]], 15);
  }
  function geoCloth() {
    const g = new T.PlaneGeometry(1.6, 0.95, 8, 2); g.translate(0.8, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setY(i, y * (1 - 0.35 * x / 1.6));
      if (x > 1.59 && Math.abs(y) < 0.01) p.setX(i, 1.25);
    }
    g.computeVertexNormals();
    return g;
  }
  function geoWall() {
    const parts = [], R = AK.rng(31), grey = [0xa8a296, 0x938d82, 0xb8b2a4, 0x878177];
    const f = (ny, cy, R2) => (ny > 0.6 && R2() < 0.6 ? 0x5e9a3a : grey[(R2() * 4) | 0]);
    for (let x = -1.2; x < 1.15; x += 0.6) parts.push([lumpy(new T.BoxGeometry(0.58, 0.36, 0.55), 0.08, (x * 10) | 0), f, M(x + 0.3, 0.16, 0, 1, 1, 1, 0, (R() - 0.5) * 0.2, 0)]);
    for (let x = -0.95; x < 1.0; x += 0.65) parts.push([lumpy(new T.BoxGeometry(0.6, 0.3, 0.48), 0.08, (x * 10 + 50) | 0), f, M(x, 0.48, 0, 1, 1, 1, 0, (R() - 0.5) * 0.3, 0)]);
    return merge(parts, 17);
  }
  function geoChimney() {
    return merge([[new T.BoxGeometry(1, 1, 1), (ny, cy, R) => [0x9a8e80, 0x8a7e70, 0xaa9e8e][(R() * 3) | 0], M(0, 0.5, 0)], [new T.BoxGeometry(1.3, 0.16, 1.3), 0x4a443c, M(0, 1.0, 0)]], 16);
  }
  function geoBridge() { const g = new T.PlaneGeometry(11.5, 4.3); g.translate(0, -2.15, 0); return g; }
  function geoWater() {
    const g = new T.PlaneGeometry(150, 6.5, 1, 1); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 24, uv.getY(i));
    return g;
  }
  function geoSmoke() { return new T.IcosahedronGeometry(0.5, 0); }

  // House body: x -0.5..0.5 (long axis), z -0.5..0.5 (front +z), y -0.35..1, gables to 1+RH.
  function geoHouse(v) {
    const P = [], UV = [];
    const fu = (fx, fy, px) => [(px + fx * 128) / 256, 1 - (v * 128 + (1 - fy) * 128) / 256];
    const front = y => (y + 0.35) / 1.35, end = y => (y + 0.35) / (1.35 + RH);
    function tri(a, b, c) { P.push(...a[0], ...b[0], ...c[0]); UV.push(...a[1], ...b[1], ...c[1]); }
    function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }
    const Fv = (x, y, z, fx) => [[x, y, z], fu(fx, front(y), 0)];
    const Ev = (x, y, z, fx) => [[x, y, z], fu(fx, end(y), 128)];
    quad(Fv(-0.5, -0.35, 0.5, 0), Fv(0.5, -0.35, 0.5, 1), Fv(0.5, 1, 0.5, 1), Fv(-0.5, 1, 0.5, 0));
    quad(Fv(0.5, -0.35, -0.5, 0), Fv(-0.5, -0.35, -0.5, 1), Fv(-0.5, 1, -0.5, 1), Fv(0.5, 1, -0.5, 0));
    quad(Ev(0.5, -0.35, 0.5, 0), Ev(0.5, -0.35, -0.5, 1), Ev(0.5, 1, -0.5, 1), Ev(0.5, 1, 0.5, 0));
    tri(Ev(0.5, 1, 0.5, 0), Ev(0.5, 1, -0.5, 1), Ev(0.5, 1 + RH, 0, 0.5));
    quad(Ev(-0.5, -0.35, -0.5, 0), Ev(-0.5, -0.35, 0.5, 1), Ev(-0.5, 1, 0.5, 1), Ev(-0.5, 1, -0.5, 0));
    tri(Ev(-0.5, 1, -0.5, 0), Ev(-0.5, 1, 0.5, 1), Ev(-0.5, 1 + RH, 0, 0.5));
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
    g.computeVertexNormals();
    return g;
  }
  function geoRoof() {
    const dz = 0.64, dy = RH * dz / 0.5, L = Math.hypot(dz, dy), th = 0.07, ang = Math.atan2(dy, dz);
    const nx = dz / L, ny = dy / L; // slab normal (y, z) = (nx, ny)
    const out = [];
    [1, -1].forEach(s => {
      const b = new T.BoxGeometry(1.2, th, L).toNonIndexed();
      const uv = b.attributes.uv, nrm = b.attributes.normal, col = [];
      for (let i = 0; i < uv.count; i++) {
        const top = nrm.getY(i) > 0.5;
        uv.setXY(i, uv.getX(i) * (top ? 3.5 : 0.1), uv.getY(i) * (top ? 3 : 0.1));
        const k = top ? 1 : 0.42; col.push(k, k, k);
      }
      b.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      b.applyMatrix4(M(0, 1 + RH - dy / 2 + nx * th / 2, s * (dz / 2 + ny * th / 2 * 0), 1, 1, 1, s * ang, 0, 0));
      out.push(b);
    });
    const cap = new T.BoxGeometry(1.24, 0.1, 0.16).toNonIndexed();
    cap.setAttribute('color', new T.Float32BufferAttribute(new Array(cap.attributes.position.count * 3).fill(0.55), 3));
    cap.applyMatrix4(M(0, 1 + RH + 0.04, 0));
    out.push(cap);
    let n = 0; out.forEach(g => (n += g.attributes.position.count));
    const P = new Float32Array(n * 3), UV = new Float32Array(n * 2), C = new Float32Array(n * 3);
    let o = 0;
    out.forEach(g => { P.set(g.attributes.position.array, o * 3); UV.set(g.attributes.uv.array, o * 2); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2)); g.setAttribute('color', new T.BufferAttribute(C, 3));
    g.computeVertexNormals();
    return g;
  }

  // ── Materials with wind (vertex shader) ────────────────────────────────────
  function sway(mat, amp, y0) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.time; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uY0 = { value: y0 };
      sh.vertexShader = 'uniform float uTime; uniform float uAmp; uniform float uY0;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float hh = max(0.0, position.y - uY0);
        float ph = uTime * 1.6 + ip.x * 0.37 + ip.z * 0.23;
        transformed.x += (sin(ph) + 0.4 * sin(ph * 2.3)) * uAmp * hh;
        transformed.z += cos(ph * 0.8) * uAmp * 0.6 * hh;`);
    };
    mat.customProgramCacheKey = () => 'ak-sway';
    return mat;
  }
  function flutter(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float k = position.x / 1.6;
        transformed.z += sin(uTime * 5.0 - position.x * 3.2 + ip.x + ip.z) * 0.24 * k;
        transformed.y += sin(uTime * 3.3 - position.x * 2.1 + ip.z) * 0.06 * k;`);
    };
    mat.customProgramCacheKey = () => 'ak-flutter';
    return mat;
  }

  // ── Instance pools (one draw call per kind; chunks keep their own lists and
  //    the pools are packed densely after each chunk build) ─────────────────
  const pools = {}, poolNames = [];
  const _m = new T.Matrix4(), _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3(), _e = new T.Euler();
  const _c = new T.Color(), WHITE = new T.Color(1, 1, 1);
  let cur = null; // the chunk being built
  function pool(name, geo, mat, cap) {
    const m = new T.InstancedMesh(geo, mat, cap * NS);
    m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0;
    m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * NS * 3).fill(1), 3);
    scene.add(m);
    pools[name] = { m, cap }; poolNames.push(name);
  }
  function put(name, x, y, z, ry, sx, sy, sz, col, rx, rz) {
    const L = cur.inst[name]; if (!L || L.n >= pools[name].cap) return false;
    _e.set(rx || 0, ry, rz || 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s); _m.toArray(L.mat, L.n * 16);
    const c = col || WHITE; L.col[L.n * 3] = c.r; L.col[L.n * 3 + 1] = c.g; L.col[L.n * 3 + 2] = c.b;
    L.n++; return true;
  }
  const tint = (hex, v) => _c.set(hex).multiplyScalar(v);
  function pack() {
    for (const name of poolNames) {
      const P = pools[name], im = P.m.instanceMatrix, ic = P.m.instanceColor; let n = 0;
      for (const ch of chunks) {
        const L = ch.inst[name]; if (!L.n || ch.i === null) continue;
        im.array.set(L.mat.subarray(0, L.n * 16), n * 16); ic.array.set(L.col.subarray(0, L.n * 3), n * 3); n += L.n;
      }
      P.m.count = n; im.needsUpdate = true; ic.needsUpdate = true;
    }
  }

  // ── Village layout (deterministic per village cell k) ──────────────────────
  const villages = new Map();
  const ROOFS = [0xc23b22, 0xc23b22, 0xb8321e, 0x8f2c1f, 0x8f2c1f, 0xd4622f, 0x7a88a8, 0x6a7898];
  const BANNER = [0xe63946, 0x3a86ff, 0xffc300, 0x8338ec, 0x06d6a0, 0xff6b9a];
  const collide = (occ, x, z, r) => occ.some(o => (o[0] - x) ** 2 + (o[1] - z) ** 2 < (o[2] + r) ** 2);
  function millPos(k, out) {
    const zc = vCenter(k), side = hash2(k * 3 + 1, 50) < 0.5 ? -1 : 1, z = zc + vHalf(k) * 0.35, x = pathX(z) + side * (31 + hash2(k, 6) * 10);
    out = out || []; out[0] = x; out[1] = z; out[2] = side; return out;
  }
  function roadRot(z, side) { return (side < 0 ? Math.PI / 2 : -Math.PI / 2) + Math.atan(pathD(z)); }
  function village(k) {
    if (villages.has(k)) return villages.get(k);
    const R = AK.rng(k * 7919 + 1234), zc = vCenter(k), hl = vHalf(k);
    const V = { houses: [], props: [], occ: [] };
    if (hasMill(k)) { const [mx, mz] = millPos(k); V.occ.push([mx, mz, 7]); }
    const n = 5 + Math.floor(R() * 8);
    for (let tries = 0; V.houses.length < n && tries < 90; tries++) {
      const side = R() < 0.5 ? -1 : 1, z = zc + (R() * 2 - 1) * hl;
      const W = 5.6 + R() * 3.6, D = 4.2 + R() * 1.6, H = R() < 0.2 ? 4.3 : 2.8 + R() * 1.1, gable = R() < 0.16;
      const d = Math.max(8 + Math.pow(R(), 1.4) * 22, (gable ? W : D) / 2 + 5.8), r = Math.max(W, D) * 0.6;
      const x = pathX(z) + side * d;
      if (collide(V.occ, x, z, r + 1.2)) continue;
      const rot = roadRot(z, side) + (R() - 0.5) * 0.3 + (gable ? Math.PI / 2 : 0);
      const cs = Math.cos(rot), sn = Math.sin(rot);
      let y = heightAt(x, z);
      for (let q = 0; q < 4; q++) { const lx = (q & 1 ? 0.5 : -0.5) * W, lz = (q & 2 ? 0.5 : -0.5) * D; y = Math.min(y, heightAt(x + lx * cs + lz * sn, z - lx * sn + lz * cs)); }
      const h = { x, y: y - 0.05, z, rot, W, D, H, v: R() < 0.5 ? 0 : 1, roof: ROOFS[(R() * ROOFS.length) | 0], tint: 0.9 + R() * 0.12, chim: R() < 0.85, cs: R() < 0.5 ? 1 : -1, ph: R() };
      V.houses.push(h); V.occ.push([x, z, r]);
      if (R() < 0.6) { // barrels by the house
        const bx = x + (0.5 * W + 0.8) * cs * h.cs + (0.5 * D) * sn, bz = z - (0.5 * W + 0.8) * sn * h.cs + (0.5 * D) * cs;
        for (let b = 0; b < 1 + R() * 3; b++) V.props.push({ t: 'barrel', x: bx + (R() - 0.5) * 1.4, z: bz + (R() - 0.5) * 1.4, rot: R() * 6, s: 0.9 + R() * 0.25 });
      }
    }
    const put1 = (t, side, d, z, r, extra) => {
      const x = pathX(z) + side * d; if (collide(V.occ, x, z, r)) return false;
      V.occ.push([x, z, r]); V.props.push(Object.assign({ t, x, z, rot: roadRot(z, side), s: 1 }, extra)); return true;
    };
    put1('well', R() < 0.5 ? -1 : 1, 6.6, zc + (R() - 0.5) * 12, 1.6);
    for (let s = 0; s < 1 + R() * 2; s++) put1('stall', R() < 0.5 ? -1 : 1, 5.4, zc + (R() * 2 - 1) * hl * 0.7, 1.7, { col: BANNER[(R() * BANNER.length) | 0] });
    for (let f = 0; f < 2; f++) {
      const side = R() < 0.5 ? -1 : 1; let z = zc + (R() * 2 - 1) * hl;
      for (let j = 0, m = 4 + R() * 6; j < m; j++, z -= 2.65) {
        const x = pathX(z) + side * 4.9; if (collide(V.occ, x, z, 1.2)) continue;
        V.props.push({ t: 'fence', x, z, rot: Math.PI / 2 + Math.atan(pathD(z)), s: 1 });
      }
    }
    for (let j = 0, m = 2 + R() * 3; j < m; j++) {
      const side = R() < 0.5 ? -1 : 1, z = zc + (R() < 0.5 ? -1 : 1) * (hl * 0.7 + R() * 25);
      put1('hay', side, 11 + R() * 22, z, 1.4, { rot: R() * 6, s: 0.85 + R() * 0.3 });
    }
    [zc + hl + 6, zc - hl - 6].forEach((z, j) => [-1, 1].forEach(side => {
      V.props.push({ t: 'banner', x: pathX(z) + side * 3.2, z, rot: side < 0 ? Math.PI : 0, s: 1, col: BANNER[(k * 2 + j + (side > 0 ? 1 : 0)) % BANNER.length] });
    }));
    for (let j = 0, m = 7 + R() * 8, tries = 0; j < m && tries < 60; tries++) {
      const side = R() < 0.5 ? -1 : 1, z = zc + (R() * 2 - 1) * (hl + 15), d = 7 + R() * 30;
      if (put1('tree', side, d, z, 2.2, { rot: R() * 6, s: 0.8 + R() * 0.55 })) j++;
    }
    for (let j = 0; j < 10; j++) put1('bush', R() < 0.5 ? -1 : 1, 6 + R() * 18, zc + (R() * 2 - 1) * hl, 0.9, { rot: R() * 6, s: 0.8 + R() * 0.5, b: R() });
    villages.set(k, V);
    if (villages.size > 10) villages.delete(villages.keys().next().value);
    return V;
  }

  // ── Chunks: terrain + road meshes per slot, instances in the pools ───────
  const UC = (() => { const a = [0, 1, 1.8, 2.4, 3, 3.8, 5, 6.5, 8, 10, 12.5, 15, 18, 22, 26, 31, 37, 44, 52, 62, 74, 88, 105, 125, 150, 180]; const r = []; for (let j = a.length - 1; j > 0; j--) r.push(-a[j]); return r.concat(a); })();
  const NC = UC.length, NR = CH / 2 + 1, RC = [-2.2, -1.1, 0, 1.1, 2.2], RR = CH + 1;
  const chunks = [];
  const COL = {};
  let mats = null;

  function gridIndex(nr, nc) {
    const idx = [];
    for (let r = 0; r < nr - 1; r++) for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    return idx;
  }
  function makeChunk() {
    const tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.BufferAttribute(new Float32Array(NR * NC * 3), 3));
    tg.setAttribute('normal', new T.BufferAttribute(new Float32Array(NR * NC * 3), 3));
    tg.setAttribute('color', new T.BufferAttribute(new Float32Array(NR * NC * 3), 3));
    tg.setIndex(gridIndex(NR, NC)); tg.boundingSphere = new T.Sphere(new T.Vector3(), 230);
    const rg = new T.BufferGeometry();
    rg.setAttribute('position', new T.BufferAttribute(new Float32Array(RR * RC.length * 3), 3));
    rg.setAttribute('normal', new T.BufferAttribute(new Float32Array(RR * RC.length * 3), 3));
    rg.setAttribute('uv', new T.BufferAttribute(new Float32Array(RR * RC.length * 2), 2));
    rg.setIndex(gridIndex(RR, RC.length)); rg.boundingSphere = new T.Sphere(new T.Vector3(), 45);
    const ch = { i: null, terrain: new T.Mesh(tg, mats.terrain), road: new T.Mesh(rg, mats.road), chim: new Float32Array(40 * 4), nChim: 0, inst: {} };
    for (const name of poolNames) { const c = pools[name].cap; ch.inst[name] = { mat: new Float32Array(c * 16), col: new Float32Array(c * 3), n: 0 }; }
    ch.terrain.visible = ch.road.visible = false;
    scene.add(ch.terrain); scene.add(ch.road);
    return ch;
  }
  function lerpC(o, a, b, t) { o[0] = a.r + (b.r - a.r) * t; o[1] = a.g + (b.g - a.g) * t; o[2] = a.b + (b.b - a.b) * t; }
  const _tc = [0, 0, 0], _tc2 = [0, 0, 0];
  function buildTerrain(ch, z0) {
    const g = ch.terrain.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, Cc = g.attributes.color.array;
    for (let r = 0; r < NR; r++) {
      const z = z0 - r * 2, p = pathX(z), vw = villageW(z);
      for (let c = 0; c < NC; c++) {
        const u = UC[c], x = p + u, d = Math.abs(u), j = (r * NC + c) * 3;
        const h = tH(x, z);
        P[j] = x; P[j + 1] = h - (d < 2 ? 0.16 : 0); P[j + 2] = z;
        const e = d > 30 ? 3 : 1;
        let nx = tH(x - e, z) - tH(x + e, z), nz = tH(x, z - e) - tH(x, z + e), ny = 2 * e;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        N[j] = nx; N[j + 1] = ny; N[j + 2] = nz;
        // meadow colour
        const n = fbm(x * 0.016, z * 0.016), pg = vnoise(x * 0.05 + 7, z * 0.05);
        const k = clamp(0.5 + (n - 0.45) * 1.5 + (pg - 0.5) * 0.7 - (1 - ny) * 2.2, 0, 1);
        if (k < 0.5) lerpC(_tc, COL.hollow, COL.mid, k * 2); else lerpC(_tc, COL.mid, COL.top, (k - 0.5) * 2);
        const fm = forestM(x, z, d, vw);
        if (fm > 0) { lerpC(_tc2, { r: _tc[0], g: _tc[1], b: _tc[2] }, COL.forest, fm * 0.85); _tc[0] = _tc2[0]; _tc[1] = _tc2[1]; _tc[2] = _tc2[2]; }
        const yl = sstep(0.66, 0.8, vnoise(x * 0.035 + 9, z * 0.035)) * (1 - fm) * 0.6;
        if (yl > 0) { _tc[0] += (COL.yellow.r - _tc[0]) * yl; _tc[1] += (COL.yellow.g - _tc[1]) * yl; _tc[2] += (COL.yellow.b - _tc[2]) * yl; }
        const dt = 1 - sstep(2.2, 3.5, d);
        if (dt > 0) { _tc[0] += (COL.dirt.r - _tc[0]) * dt; _tc[1] += (COL.dirt.g - _tc[1]) * dt; _tc[2] += (COL.dirt.b - _tc[2]) * dt; }
        const wet = streamDip(z, d) / 2.6;
        if (wet > 0) { const w = Math.min(1, wet * 1.4); _tc[0] += (COL.mud.r - _tc[0]) * w; _tc[1] += (COL.mud.g - _tc[1]) * w; _tc[2] += (COL.mud.b - _tc[2]) * w; }
        Cc[j] = _tc[0]; Cc[j + 1] = _tc[1]; Cc[j + 2] = _tc[2];
      }
    }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.color.needsUpdate = true;
    g.boundingSphere.center.set(pathX(z0 - CH / 2), roadY(z0 - CH / 2), z0 - CH / 2);
    // road ribbon
    const rg = ch.road.geometry, RP = rg.attributes.position.array, RN = rg.attributes.normal.array, RU = rg.attributes.uv.array;
    for (let r = 0; r < RR; r++) {
      const z = z0 - r, p = pathX(z);
      for (let c = 0; c < RC.length; c++) {
        const u = RC[c], j = r * RC.length + c;
        RP[j * 3] = p + u; RP[j * 3 + 1] = heightAt(p + u, z) + 0.03 + 0.06 * (1 - (u / 2.2) ** 2); RP[j * 3 + 2] = z;
        RN[j * 3] = -u * 0.02; RN[j * 3 + 1] = 1; RN[j * 3 + 2] = 0;
        RU[j * 2] = (u + 2.2) / 4.4; RU[j * 2 + 1] = -z / 4.4;
      }
    }
    rg.attributes.position.needsUpdate = rg.attributes.normal.needsUpdate = rg.attributes.uv.needsUpdate = true;
    rg.boundingSphere.center.set(pathX(z0 - CH / 2), roadY(z0 - CH / 2), z0 - CH / 2);
    ch.terrain.visible = ch.road.visible = true;
  }

  const FLOWERS = [0xff5fa2, 0xffd23a, 0xffffff, 0xc58cff, 0xff4a4a, 0x6fb6ff, 0xffa53a];
  function buildChunk(ch, i, slot) {
    ch.i = i; ch.nChim = 0; ch.bridgeZ = NaN;
    const z0 = -i * CH, z1 = z0 - CH, R = AK.rng((Math.imul(i, 2654435761) ^ 0x5bd1e995) >>> 0);
    buildTerrain(ch, z0);
    cur = ch; for (const name of poolNames) ch.inst[name].n = 0;
    const inC = z => z <= z0 && z > z1;
    // village content overlapping this chunk
    const occ = [];
    const mills = [];
    for (let k = kOf(z0) - 1; k <= kOf(z1) + 1; k++) {
      if (hasMill(k)) mills.push(millPos(k));
      const zc = vCenter(k), hl = vHalf(k);
      if (zc - hl - 45 > z0 || zc + hl + 45 < z1) continue;
      const V = village(k);
      V.occ.forEach(o => { if (o[1] < z0 + 20 && o[1] > z1 - 20) occ.push(o); });
      for (const h of V.houses) {
        if (!inC(h.z)) continue;
        put(h.v ? 'houseB' : 'houseA', h.x, h.y, h.z, h.rot, h.W, h.H, h.D, tint(0xffffff, h.tint));
        put('roof', h.x, h.y, h.z, h.rot, h.W, h.H, h.D, tint(h.roof, 0.92 + h.tint * 0.08));
        if (h.chim) {
          const cs = Math.cos(h.rot), sn = Math.sin(h.rot), lx = 0.28 * h.W * h.cs, lz = -0.2 * h.D;
          const cx = h.x + lx * cs + lz * sn, cz = h.z - lx * sn + lz * cs;
          const yb = h.y + h.H * (1 + RH * (1 - 0.4)) - 0.4, yt = h.y + h.H * (1 + RH) + 0.9;
          put('chimney', cx, yb, cz, h.rot, 0.62, yt - yb, 0.62);
          if (ch.nChim < 40) { const o = ch.nChim * 4; ch.chim[o] = cx; ch.chim[o + 1] = yt + 0.2; ch.chim[o + 2] = cz; ch.chim[o + 3] = h.ph; ch.nChim++; }
        }
      }
      for (const q of V.props) {
        if (!inC(q.z)) continue;
        const y = heightAt(q.x, q.z);
        if (q.t === 'barrel') put('barrel', q.x, y, q.z, q.rot, q.s, q.s, q.s);
        else if (q.t === 'well') put('well', q.x, y - 0.05, q.z, q.rot, 1, 1, 1);
        else if (q.t === 'stall') { put('stall', q.x, y, q.z, q.rot, 1, 1, 1); put('awning', q.x, y, q.z, q.rot, 1, 1, 1, tint(q.col, 1)); }
        else if (q.t === 'fence') put('fence', q.x, y - 0.05, q.z, q.rot, 1, 1, 1);
        else if (q.t === 'hay') put('hay', q.x, y - 0.1, q.z, q.rot, q.s, q.s, q.s);
        else if (q.t === 'banner') { put('pole', q.x, y, q.z, 0, 1, 1, 1); put('cloth', q.x, y + 3.75, q.z, q.rot, 1, 1, 1, tint(q.col, 1)); }
        else if (q.t === 'tree') put('tree', q.x, y - 0.1, q.z, q.rot, q.s, q.s * (0.9 + (q.s % 0.2)), q.s, tint(0xffffff, 0.9 + (q.rot % 0.2)));
        else if (q.t === 'bush') put(q.b < 0.3 ? 'bushL' : q.b < 0.5 ? 'bushW' : 'bushG', q.x, y - 0.1, q.z, q.rot, q.s, q.s, q.s);
      }
    }
    for (const zsb of [streamNear(z0 - CH / 2), streamNear(z0 - 5), streamNear(z1 + 5)]) {
      if (zsb !== zsb || !inC(zsb) || cur.bridgeZ === zsb) continue;
      cur.bridgeZ = zsb;
      const p = pathX(zsb), rot = Math.PI / 2 + Math.atan(pathD(zsb)), yb = roadY(zsb);
      put('water', p, yb - 1.45, zsb, 0, 1, 1, 1);
      [-1, 1].forEach(side => {
        put('bridge', p + side * 2.3, yb + 0.12, zsb, rot, 1, 1, 1);
        for (let t = -3.6; t <= 3.7; t += 2.4) { const z = zsb + t; put('wall', pathX(z) + side * 2.45, yb + 0.05, z, Math.PI / 2 + Math.atan(pathD(z)), 1, 1.1, 0.85); }
      });
    }
    const nearMill = (x, z, r) => mills.some(m => (m[0] - x) ** 2 + (m[1] - z) ** 2 < r * r);
    const vwMid = villageW(z0 - CH / 2);
    // pine forests on the slopes
    for (let t = 0; t < 1300; t++) {
      const z = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, d = 13 + Math.pow(R(), 1.1) * 150, x = pathX(z) + side * d;
      const fm = forestM(x, z, d, villageW(z)) + (d < 26 ? 0.03 : 0);
      if (R() > fm || nearMill(x, z, 9) || (d < 45 && collide(occ, x, z, 1.5)) || (d < 62 && nearS(z, 7))) continue;
      const s = 0.75 + R() * 0.9 + (R() < 0.15 ? 0.9 : 0);
      put('pine', x, heightAt(x, z) - 0.25, z, R() * 6.3, s * (0.9 + R() * 0.25), s, s * (0.9 + R() * 0.25), tint(0xffffff, 0.8 + R() * 0.4));
    }
    // round trees along the road outside the forests
    for (let t = 0; t < 12; t++) {
      const z = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, d = 7 + R() * 28, x = pathX(z) + side * d;
      if (forestM(x, z, d, 0) > 0.3 || collide(occ, x, z, 2.2) || nearMill(x, z, 8) || nearS(z, 8)) continue;
      const s = 0.75 + R() * 0.6; put('tree', x, heightAt(x, z) - 0.1, z, R() * 6.3, s, s * (0.85 + R() * 0.3), s, tint(0xffffff, 0.85 + R() * 0.25));
    }
    // bushes near the road
    for (let t = 0; t < 46; t++) {
      const z = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, d = 3.4 + Math.pow(R(), 1.3) * 18, x = pathX(z) + side * d;
      if (collide(occ, x, z, 1) || nearS(z, 6.5)) continue;
      const b = R(), s = (0.5 + R() * 0.35) * (1 + clamp((d - 4) / 8, 0, 1) * 0.7);
      put(b < 0.2 ? 'bushL' : b < 0.32 ? 'bushW' : 'bushG', x, heightAt(x, z) - 0.12, z, R() * 6.3, s, s * (0.8 + R() * 0.4), s, tint(0xffffff, 0.85 + R() * 0.3));
    }
    // mossy boulders
    for (let t = 0; t < 12; t++) {
      const z = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, d = 3.2 + Math.pow(R(), 1.3) * 60, x = pathX(z) + side * d;
      if (collide(occ, x, z, 1.5) || nearS(z, 7)) continue;
      const s = (0.5 + R() * 0.8) * (1 + d / 40);
      put('rock', x, heightAt(x, z) - 0.15 * s, z, R() * 6.3, s * (0.8 + R() * 0.5), s * (0.7 + R() * 0.5), s * (0.8 + R() * 0.5), null, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4);
    }
    // grass tufts
    for (let t = 0; t < 560; t++) {
      const z = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, d = 2.05 + Math.pow(R(), 1.8) * 16, x = pathX(z) + side * d;
      const s = 0.55 + R() * 0.55;
      if (nearS(z, 4.8)) continue;
      put('grass', x, heightAt(x, z) - 0.03, z, R() * 6.3, s, s * (0.8 + R() * 0.5), s, tint(0xffffff, 0.8 + R() * 0.35));
    }
    // flower patches
    for (let t = 0; t < 8; t++) {
      const zc = z0 - R() * CH, side = R() < 0.5 ? -1 : 1, dc = 3.5 + R() * 22, col = FLOWERS[(R() * FLOWERS.length) | 0], mixed = R() < 0.35;
      for (let f = 0, m = 18 + R() * 22; f < m; f++) {
        const a = R() * 6.3, rr = Math.sqrt(R()) * 3, z = zc + Math.sin(a) * rr, d = dc + Math.cos(a) * rr;
        if (d < 2.4 || !inC(z) || nearS(z, 6)) continue;
        const x = pathX(z) + side * d, s = 0.8 + R() * 0.6;
        put('flower', x, heightAt(x, z) - 0.02, z, R() * 6.3, s, s, s, tint(mixed ? FLOWERS[(R() * FLOWERS.length) | 0] : col, 1));
      }
    }
    // low dry-stone walls on open stretches
    if (vwMid < 0.1 && R() < 0.5) {
      const side = R() < 0.5 ? -1 : 1; let z = z0 - R() * 25;
      for (let j = 0, m = 6 + R() * 12; j < m && inC(z) && !nearS(z, 8); j++, z -= 2.35) {
        const x = pathX(z) + side * 3.45;
        put('wall', x, heightAt(x, z) - 0.08, z, Math.PI / 2 + Math.atan(pathD(z)), 1, 0.9 + R() * 0.3, 1);
      }
    }
    // a lone farmhouse between villages
    if (vwMid < 0.05 && R() < 0.35 && !nearS(z0 - 30, 45)) {
      const side = R() < 0.5 ? -1 : 1, z = z0 - 10 - R() * 40, d = 15 + R() * 14, x = pathX(z) + side * d;
      const W = 6 + R() * 2, D = 4.5, H = 3, rot = roadRot(z, side), y = heightAt(x, z) - 0.3;
      put('houseA', x, y, z, rot, W, H, D, tint(0xffffff, 0.95)); put('roof', x, y, z, rot, W, H, D, tint(ROOFS[(R() * 8) | 0], 1));
      put('hay', x + side * 7, heightAt(x + side * 7, z + 4) - 0.1, z + 4, 0, 1, 1, 1);
      put('hay', x + side * 6, heightAt(x + side * 6, z - 5) - 0.1, z - 5, 1, 0.9, 0.9, 0.9);
    }
  }

  // ── Windmills (two pooled groups) ──────────────────────────────────────────
  const mills = [], _mp = [0, 0, 0];
  function makeMill() {
    const grp = new T.Group();
    const body = merge([
      [new T.CylinderGeometry(2.7, 2.9, 1.4, 8), (ny, cy, R) => [0x9a948a, 0x8a8478, 0xaaa498][(R() * 3) | 0], M(0, 0.7, 0)],
      [new T.CylinderGeometry(1.7, 2.5, 7.5, 8), (ny, cy, R) => (cy > 4.2 && cy < 4.6 ? 0x4a2b18 : 0xf1e2c2), M(0, 5.1, 0)],
      [new T.ConeGeometry(2.3, 2.8, 8), (ny, cy, R) => (R() < 0.3 ? 0xa03422 : 0xc23b22), M(0, 10.2, 0)],
      [new T.BoxGeometry(1.2, 2.0, 0.3), 0x6b3f1f, M(0, 2.2, 2.35, 1, 1, 1, -0.09, 0, 0)],
      [new T.BoxGeometry(0.8, 0.8, 0.3), 0xffb040, M(0, 6.0, 1.95, 1, 1, 1, -0.1, 0, 0)],
    ], 41);
    grp.add(new T.Mesh(body, mats.vegFlat));
    const sails = new T.Group(); sails.position.set(0, 8.3, 2.4);
    const parts = [[new T.IcosahedronGeometry(0.45, 0), 0x4a2b18]];
    for (let j = 0; j < 4; j++) {
      const a = j * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      parts.push([new T.BoxGeometry(0.24, 6.2, 0.16), 0x5a3a22, M(-sa * 3.1, ca * 3.1, 0, 1, 1, 1, 0, 0, a)]);
      parts.push([new T.BoxGeometry(1.4, 4.6, 0.06), (ny, cy, R) => (R() < 0.5 ? 0xf7efdc : 0xe8dcc4), M(-sa * 3.6 + ca * 0.8, ca * 3.6 + sa * 0.8, 0.1, 1, 1, 1, 0, 0, a)]);
    }
    sails.add(new T.Mesh(merge(parts, 43), mats.vegFlat));
    grp.add(sails); grp.visible = false; scene.add(grp);
    return { grp, sails, k: null };
  }

  // ── Chimney smoke (one instanced mesh) ─────────────────────────────────────
  let smoke = null, wTex = null;
  const SMOKE_CAP = 96;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(core) {
    scene = core.scene;
    ['hollow:0x2f6e26', 'mid:0x55a733', 'top:0x8fd14a', 'forest:0x2c5c24', 'yellow:0xb9dc4a', 'dirt:0x8a6a44', 'mud:0x5a4a32'].forEach(s => {
      const [k, v] = s.split(':'); COL[k] = new T.Color(+v);
    });
    const [wallTex, emTex] = wallAtlas();
    wTex = waterTex();
    mats = {
      terrain: new T.MeshLambertMaterial({ vertexColors: true }),
      road: new T.MeshLambertMaterial({ map: cobbleTex(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      vegFlat: new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      tree: sway(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.03, 1.8),
      grass: sway(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }), 0.35, 0),
      house: new T.MeshLambertMaterial({ map: wallTex, emissiveMap: emTex, emissive: 0xffffff, emissiveIntensity: 1.5 }),
      roof: new T.MeshLambertMaterial({ map: roofTex(), vertexColors: true, flatShading: true }),
      cloth: flutter(new T.MeshLambertMaterial({ side: T.DoubleSide })),
      water: new T.MeshLambertMaterial({ map: wTex, emissive: 0x16406a, emissiveIntensity: 0.6 }),
      bridge: new T.MeshLambertMaterial({ map: bridgeTex(), alphaTest: 0.5, side: T.DoubleSide }),
      smoke: new T.MeshLambertMaterial({ color: 0xf4f0ea, flatShading: true, transparent: true, opacity: 0.82, depthWrite: false }),
    };
    pool('pine', geoPine(), mats.vegFlat, 300);
    pool('tree', geoTree(), mats.tree, 40);
    pool('bushG', geoBush(0), mats.vegFlat, 50);
    pool('bushL', geoBush(0xc9a0ee), mats.vegFlat, 20);
    pool('bushW', geoBush(0xf6f2ff), mats.vegFlat, 16);
    pool('rock', geoRock(), mats.vegFlat, 14);
    pool('grass', geoGrass(), mats.grass, 560);
    pool('flower', geoFlower(), mats.vegFlat, 300);
    pool('houseA', geoHouse(0), mats.house, 14);
    pool('houseB', geoHouse(1), mats.house, 14);
    pool('roof', geoRoof(), mats.roof, 26);
    pool('chimney', geoChimney(), mats.vegFlat, 26);
    pool('fence', geoFence(), mats.vegFlat, 44);
    pool('barrel', geoBarrel(), mats.vegFlat, 22);
    pool('hay', geoHay(), mats.vegFlat, 10);
    pool('well', geoWell(), mats.vegFlat, 2);
    pool('stall', geoStall(), mats.vegFlat, 4);
    pool('awning', geoAwning(), mats.vegFlat, 4);
    pool('pole', geoPole(), mats.vegFlat, 8);
    pool('cloth', geoCloth(), mats.cloth, 8);
    pool('wall', geoWall(), mats.vegFlat, 34);
    pool('water', geoWater(), mats.water, 1);
    pool('bridge', geoBridge(), mats.bridge, 2);
    smoke = new T.InstancedMesh(geoSmoke(), mats.smoke, SMOKE_CAP);
    smoke.frustumCulled = false; smoke.instanceMatrix.setUsage(T.DynamicDrawUsage); smoke.count = 0; scene.add(smoke);
    for (let s = 0; s < NS; s++) chunks.push(makeChunk());
    mills.push(makeMill(), makeMill());
    lastZ = core.camZ;
    stream(core.camZ, true);
  }

  // ── Streaming ──────────────────────────────────────────────────────────────
  function stream(cz, all) {
    const iA = Math.floor(-(cz + BEHIND) / CH), iB = Math.floor(-(cz - AHEAD) / CH), ic = Math.floor(-cz / CH);
    let built = 0;
    for (let o = 0; o <= iB - iA; o++) {
      for (let s = 0; s < 2; s++) {
        const i = s ? ic - o : ic + o;
        if (i < iA || i > iB || (s && o === 0)) continue;
        const slot = ((i % NS) + NS) % NS, ch = chunks[slot];
        if (ch.i === i) continue;
        if (!all && built >= 1 && i !== ic) return;
        buildChunk(ch, i, slot); built++;
      }
    }
    if (built) pack();
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt, core) {
    U.time.value += dt;
    wTex.offset.x = U.time.value * 0.35 % 1; wTex.offset.y = Math.sin(U.time.value * 0.8) * 0.04;
    const cz = core.camZ, jump = Math.abs(cz - lastZ) > 30; lastZ = cz;
    stream(cz, jump);
    // windmills
    const k0 = kOf(cz);
    let used = 0;
    for (let k = k0 - 1; k <= k0 + 2 && used < mills.length; k++) {
      if (!hasMill(k)) continue;
      millPos(k, _mp); const mx = _mp[0], mz = _mp[1], side = _mp[2];
      if (mz > cz + 60 || mz < cz - 320) continue;
      const m = mills[used++];
      if (m.k !== k) {
        m.k = k; m.grp.position.set(mx, heightAt(mx, mz) - 0.3, mz);
        m.grp.rotation.y = side < 0 ? Math.PI / 2 - 0.5 : -Math.PI / 2 + 0.5;
      }
      m.grp.visible = true;
      m.sails.rotation.z -= dt * 0.7;
    }
    for (let j = used; j < mills.length; j++) { mills[j].grp.visible = false; mills[j].k = null; }
    // chimney smoke
    let n = 0; const t0 = U.time.value * 0.23;
    for (let s = 0; s < NS && n < SMOKE_CAP; s++) {
      const ch = chunks[s];
      for (let c = 0; c < ch.nChim && n < SMOKE_CAP; c++) {
        const o = c * 4, x = ch.chim[o], y = ch.chim[o + 1], z = ch.chim[o + 2];
        if (z > cz + 25 || z < cz - 170) continue;
        for (let j = 0; j < 4 && n < SMOKE_CAP; j++) {
          const t = (t0 + ch.chim[o + 3] + j * 0.25) % 1;
          const sc = (0.3 + t * 1.1) * (t < 0.75 ? 1 : (1 - t) * 4);
          _p.set(x + t * 1.8 + Math.sin(t * 6 + j) * 0.25, y + t * 3.6, z - t * 0.8);
          _e.set(t * 2, j, 0); _q.setFromEuler(_e); _s.set(sc, sc, sc);
          _m.compose(_p, _q, _s); smoke.setMatrixAt(n++, _m);
        }
      }
    }
    smoke.count = n; smoke.instanceMatrix.needsUpdate = true;
  }

  AK.world = { init, pathX, heightAt, update };
})();
