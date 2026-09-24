// ─── CREATURES: toy-like sign bearers that giggle into butterflies ───────────
(function () {
  const T = THREE, PI = Math.PI, TAU = PI * 2;
  const rnd = Math.random;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, k) { const A = rgb(a), B = rgb(b); return hex(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)); }
  function lum(a) { const [r, g, b] = rgb(a); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function ink(a) { const l = lum(a); return l > 0.62 ? mix(a, '#000000', 0.42) : l > 0.5 ? mix(a, '#000000', 0.22) : a; }
  const RAINBOW = ['#ff4f7b', '#ff9a2e', '#ffe14d', '#59e07a', '#3fc6ff', '#8f7bff', '#ff7bd5', '#7bf0e6'];
  const FONT = "Georgia, 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif";
  const NUMFONT = "'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif"; // lining digits
  const EMOJI = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";

  // ── Geometry helpers ───────────────────────────────────────────────────────
  const _q = new T.Quaternion(), _e = new T.Euler(), UP = new T.Vector3(0, 1, 0);
  function mx(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    return new T.Matrix4().compose(new T.Vector3(x, y, z), _q.clone().setFromEuler(_e.set(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  }
  function mxDir(d, dist, sx, sy, sz) { // place along a unit direction, +Y pointing outward
    return new T.Matrix4().compose(d.clone().multiplyScalar(dist), new T.Quaternion().setFromUnitVectors(UP, d), new T.Vector3(sx, sy, sz));
  }
  function merge(list) {
    let n = 0;
    const qs = list.map(([g, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); q.applyMatrix4(m); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    qs.forEach(q => { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; q.dispose(); });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    return g;
  }
  function fib(n) { // evenly spread unit directions
    const out = [], ga = PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y); out.push(new T.Vector3(Math.cos(ga * i) * r, y, Math.sin(ga * i) * r)); }
    return out;
  }
  const inFace = d => d.z > 0.25 && d.y < 0.62 && d.y > -0.7;

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function canvasTex(cv, mip = true) {
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 1;
    t.magFilter = T.LinearFilter; t.minFilter = mip ? T.LinearMipmapLinearFilter : T.LinearFilter; t.generateMipmaps = mip;
    return t;
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); c.fill(); }
  function star(c, x, y, R, r, n = 5) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, q = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    c.closePath();
  }
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    c.closePath();
  }

  // ── Shared resources (built once, never disposed) ──────────────────────────
  let S = null;
  function shared() {
    if (S) return S;
    S = { faces: {} };
    const gm = new T.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, T.RedFormat);
    gm.minFilter = gm.magFilter = T.NearestFilter; gm.generateMipmaps = false; gm.needsUpdate = true;
    S.gradient = gm;
    const g = S.geo = {
      sph: new T.SphereGeometry(1, 20, 14),
      hemi: new T.SphereGeometry(1, 20, 8, 0, TAU, 0, PI / 2),
      cyl: new T.CylinderGeometry(1, 1, 1, 14),
      cone: new T.ConeGeometry(1, 1, 14),
      tor: new T.TorusGeometry(1, 0.3, 8, 22),
      halfTor: new T.TorusGeometry(1, 0.24, 8, 14, PI),
      box: new T.BoxGeometry(1, 1, 1),
      quad: new T.PlaneGeometry(1, 1),
      face: new T.SphereGeometry(1.03, 18, 12, PI / 2 - 0.85, 1.7, PI / 2 - 0.62, 1.24),
    };
    // crown: band + five points with pearls
    const cr = [[g.cyl, mx(0, 0, 0, 1, 0.45, 1)]];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU, s = Math.sin(a) * 0.82, c = Math.cos(a) * 0.82;
      cr.push([g.cone, mx(s, 0.47, c, 0.3, 0.6, 0.3)], [g.sph, mx(s, 0.8, c, 0.14, 0.14, 0.14)]);
    }
    cr.push([g.sph, mx(0, 0.02, 0.98, 0.2, 0.2, 0.12)]);
    g.crown = merge(cr);
    // pumpkin: ribbed sphere
    const pk = new T.SphereGeometry(1, 26, 16), pa = pk.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = 0.88 + 0.12 * Math.pow(Math.abs(Math.sin(4 * Math.atan2(z, x))), 0.45);
      pa.setXYZ(i, x * k, y * (0.94 + 0.06 * k), z * k);
    }
    pk.computeVertexNormals(); g.pumpkin = pk;
    // ghost skirt with a wavy hem
    const gs = new T.CylinderGeometry(1, 1.22, 1, 26, 3, false), ga = gs.attributes.position;
    for (let i = 0; i < ga.count; i++) if (ga.getY(i) < -0.49) ga.setY(i, -0.5 + 0.1 * Math.sin(7 * Math.atan2(ga.getZ(i), ga.getX(i))));
    gs.computeVertexNormals(); g.ghost = gs;
    // yeti fluff tufts
    const fl = [];
    fib(40).forEach((d, i) => { if (inFace(d) || d.y < -0.35) return; const s = 0.3 + (i % 3) * 0.06; fl.push([g.sph, mx(d.x * 0.92, d.y * 0.92, d.z * 0.92, s, s, s)]); });
    g.fluff = merge(fl);
    // hedgehog quills (back and sides only)
    const sp = [];
    fib(70).forEach(d => { if (d.z > 0.05 || d.y < -0.55) return; sp.push([g.cone, mxDir(d, 1.05, 0.2, 0.85, 0.2)]); });
    fib(24).forEach(d => { if (d.z > 0.05 || d.y < 0.1) return; sp.push([g.cone, mxDir(d, 1.05, 0.18, 0.7, 0.18)]); });
    g.quills = merge(sp);
    // mushroom spots on a unit hemisphere cap
    const sps = [];
    [[0, 1.2], [1.3, 0.55], [2.5, 0.8], [3.6, 0.5], [4.7, 0.75], [5.6, 0.45], [0.6, 0.45], [2.0, 0.35]].forEach(([az, el]) => {
      const d = new T.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
      sps.push([g.sph, mxDir(d, 0.98, 0.22, 0.06, 0.22)]);
    });
    g.spots = merge(sps);
    // unicorn mane: two interleaved tuft strands
    const ma = [], mb = [];
    for (let i = 0; i < 9; i++) {
      const el = 1.25 - i * 0.3, az = (i % 2 ? 0.35 : -0.25) + PI;
      const d = new T.Vector3(Math.cos(el) * Math.sin(az) * 0.4, Math.sin(el), Math.cos(el) * Math.cos(az) * 0.9 + 0.35).normalize();
      const s = 0.36 - i * 0.012;
      (i % 2 ? mb : ma).push([g.sph, mx(d.x * 0.95, d.y * 0.95, d.z * 0.95, s, s, s)]);
    }
    ma.push([g.sph, mx(-0.2, 0.9, 0.55, 0.3, 0.26, 0.26, 0, 0, 0.4)]);
    mb.push([g.sph, mx(0.18, 0.95, 0.45, 0.26, 0.22, 0.24, 0, 0, -0.4)]);
    g.maneA = merge(ma); g.maneB = merge(mb);
    // golem flower buds, dragon crest
    g.buds = merge([[g.sph, mx(-0.42, 0.92, 0.25, 0.17, 0.17, 0.17)], [g.sph, mx(0.34, 0.98, 0.18, 0.15, 0.15, 0.15)], [g.sph, mx(0.02, 1.08, -0.22, 0.19, 0.19, 0.19)],
      [g.cyl, mx(-0.42, 0.8, 0.25, 0.03, 0.2, 0.03)], [g.cyl, mx(0.34, 0.86, 0.18, 0.03, 0.2, 0.03)], [g.cyl, mx(0.02, 0.96, -0.22, 0.03, 0.2, 0.03)]]);
    g.crest = merge([[g.cone, mx(0, 1.0, 0.1, 0.13, 0.32, 0.13, 0.2)], [g.cone, mx(0, 0.93, -0.3, 0.12, 0.3, 0.12, -0.5)], [g.cone, mx(0, 0.68, -0.68, 0.11, 0.26, 0.11, -1.1)]]);
    // particles: a 4-cell atlas (star, sparkle, heart, dot) drawn white, tinted per particle
    const at = canvas(128, 32), c = at.getContext('2d');
    c.lineJoin = 'round';
    star(c, 16, 17, 14, 6); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = '#8a5a00'; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(48, 1); c.quadraticCurveTo(50, 14, 63, 16); c.quadraticCurveTo(50, 18, 48, 31); c.quadraticCurveTo(46, 18, 33, 16); c.quadraticCurveTo(46, 14, 48, 1); c.fill();
    heart(c, 80, 16, 11); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#7a1f3d'; c.stroke();
    c.fillStyle = '#fff'; ell(c, 112, 16, 10, 10);
    const atlas = canvasTex(at);
    S.ptMat = new T.ShaderMaterial({
      uniforms: { map: { value: atlas }, uScale: { value: 225 } },
      vertexShader: `attribute float size; attribute float alpha; attribute float cell; attribute vec3 pcol;
        uniform float uScale; varying vec3 vC; varying float vA; varying float vCell;
        void main(){ vC = pcol; vA = alpha; vCell = cell; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = alpha > 0.0 ? max(1.0, size * uScale / -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vCell;
        void main(){ vec4 t = texture2D(map, vec2((gl_PointCoord.x + vCell) * 0.25, 1.0 - gl_PointCoord.y));
          float a = t.a * vA; if (a < 0.35) discard; gl_FragColor = vec4(vC * t.rgb * 1.5, 1.0); }`,
      transparent: false, depthWrite: false,
    });
    // butterfly wings (white, tinted by instance colour)
    const bf = canvas(64, 64), b = bf.getContext('2d');
    b.lineWidth = 3; b.strokeStyle = '#2a1830'; b.fillStyle = '#ffffff';
    [[-1], [1]].forEach(([s]) => {
      b.beginPath(); b.ellipse(32 + s * 15, 22, 15, 17, s * 0.5, 0, TAU); b.fill(); b.stroke();
      b.beginPath(); b.ellipse(32 + s * 11, 44, 10, 12, -s * 0.4, 0, TAU); b.fill(); b.stroke();
    });
    b.fillStyle = '#d8d8d8'; [[-1], [1]].forEach(([s]) => { ell(b, 32 + s * 17, 22, 5, 6); ell(b, 32 + s * 11, 45, 3.5, 4); });
    b.fillStyle = '#ffffff'; [[-1], [1]].forEach(([s]) => ell(b, 32 + s * 17, 22, 2.5, 3));
    b.fillStyle = '#2a1830'; ell(b, 32, 33, 3.5, 17);
    b.beginPath(); b.moveTo(31, 17); b.quadraticCurveTo(27, 6, 22, 4); b.moveTo(33, 17); b.quadraticCurveTo(37, 6, 42, 4); b.lineWidth = 2; b.stroke();
    S.bfMat = new T.MeshBasicMaterial({ map: canvasTex(bf), alphaTest: 0.5, side: T.DoubleSide });
    S.confMat = new T.MeshBasicMaterial({ side: T.DoubleSide });
    return S;
  }

  // ── Faces: open / blink / happy textures, cached by style ──────────────────
  function faceSet(o) {
    const key = JSON.stringify(o);
    if (S.faces[key]) return S.faces[key];
    const mk = mode => {
      const cv = canvas(128, 96), c = cv.getContext('2d');
      const ey = o.ey || 46, ex = o.ex || 25, es = (o.es || 1) * 1.12, my = o.my || 72, cx = 64;
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (o.cheek !== false) { c.fillStyle = '#ff86a8'; ell(c, cx - ex - 9, my - 5, 11, 7); ell(c, cx + ex + 9, my - 5, 11, 7); }
      [-1, 1].forEach(s => {
        const x = cx + s * ex, y = ey;
        if (mode === 'open') {
          c.fillStyle = '#1b0f2e'; ell(c, x, y, 12.5 * es, 16.5 * es);
          c.save(); c.beginPath(); c.ellipse(x, y, 12.5 * es, 16.5 * es, 0, 0, TAU); c.clip();
          c.fillStyle = o.iris || '#6b4fd8'; ell(c, x, y + 11 * es, 12 * es, 9 * es);
          c.restore();
          c.fillStyle = '#ffffff'; ell(c, x - 4 * es, y - 6.5 * es, 5.5 * es, 6 * es); ell(c, x + 5 * es, y + 6 * es, 2.6 * es, 2.6 * es);
          if (o.lash) { c.strokeStyle = '#1b0f2e'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + s * 10 * es, y - 10 * es); c.lineTo(x + s * 17 * es, y - 15 * es); c.stroke(); }
        } else if (mode === 'blink') {
          c.strokeStyle = '#1b0f2e'; c.lineWidth = 4.5; c.beginPath(); c.arc(x, y - 3, 10 * es, 0.15 * PI, 0.85 * PI); c.stroke();
        } else {
          c.strokeStyle = '#1b0f2e'; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 11 * es, y + 5); c.lineTo(x, y - 7); c.lineTo(x + 11 * es, y + 5); c.stroke();
        }
      });
      const mw = (o.mw || 1);
      if (mode === 'happy') {
        c.fillStyle = '#6e1b3a'; c.beginPath(); c.arc(cx, my - 4, 11 * mw, 0, PI); c.closePath(); c.fill();
        c.save(); c.clip(); c.fillStyle = '#ff7f9e'; ell(c, cx, my + 6, 8 * mw, 6); c.restore();
      } else {
        c.strokeStyle = '#3a1428'; c.lineWidth = 3.5; c.beginPath(); c.arc(cx, my - 9, 9 * mw, 0.22 * PI, 0.78 * PI); c.stroke();
      }
      return canvasTex(cv);
    };
    return (S.faces[key] = { open: mk('open'), blink: mk('blink'), happy: mk('happy') });
  }

  // ── Sign painting ──────────────────────────────────────────────────────────
  const SIGN = { letter: [2.0, 1.3, 512], word: [2.7, 1.25, 768], number: [2.2, 1.3, 640], math: [2.6, 1.45, 768] };

  function frame(c, W, H) {
    const u = W / 512, r = H * 0.15;
    c.clearRect(0, 0, W, H);
    rr(c, 2 * u, 2 * u, W - 4 * u, H - 4 * u, r); c.fillStyle = '#2a150a'; c.fill();
    rr(c, 9 * u, 9 * u, W - 18 * u, H - 18 * u, r - 7 * u);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe98a'); g.addColorStop(0.45, '#f0b429'); g.addColorStop(1, '#b8760e');
    c.fillStyle = g; c.fill();
    rr(c, 19 * u, 19 * u, W - 38 * u, H - 38 * u, r - 16 * u); c.fillStyle = '#5a3212'; c.fill();
    rr(c, 23 * u, 23 * u, W - 46 * u, H - 46 * u, r - 19 * u);
    const p = c.createRadialGradient(W / 2, H * 0.45, H * 0.15, W / 2, H / 2, W * 0.62);
    p.addColorStop(0, '#fffaea'); p.addColorStop(1, '#f0d9a2'); c.fillStyle = p; c.fill();
    c.fillStyle = '#fff3b0'; c.strokeStyle = '#6a3e0c'; c.lineWidth = 2 * u;
    [[W * 0.5, 14 * u], [W * 0.5, H - 14 * u]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 5.5 * u, 0, TAU); c.fill(); c.stroke(); });
    return 23 * u; // inner inset
  }
  function glyph(c, txt, x, base, f, fill, glow, font) {
    c.font = `bold ${f}px ${font || FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    if (glow) { c.save(); c.shadowColor = glow.color; c.shadowBlur = glow.blur; c.fillStyle = glow.color; c.fillText(txt, x, base); c.fillText(txt, x, base); c.restore(); }
    c.lineWidth = f * 0.09; c.strokeStyle = '#22100a'; c.strokeText(txt, x, base);
    const g = c.createLinearGradient(0, base - f * 0.72, 0, base); g.addColorStop(0, mix(fill, '#ffffff', 0.32)); g.addColorStop(1, fill);
    c.fillStyle = g; c.fillText(txt, x, base);
  }
  function capRatio(c, txt, font) { c.font = `bold 100px ${font || FONT}`; const m = c.measureText(txt); return { a: (m.actualBoundingBoxAscent || 70) / 100, w: m.width / 100 }; }
  function badge(c, x, y, r, icon) {
    c.fillStyle = '#2a150a'; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.fill();
    c.fillStyle = '#f0b429'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = '#fffaea'; c.beginPath(); c.arc(x, y, r * 0.84, 0, TAU); c.fill();
    if (icon) { c.font = `${Math.round(r * 1.12)}px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(icon, x, y + r * 0.08); }
  }
  function dotPattern(n) { // dice-like positions on a 3x3 grid (-1..1)
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
      7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]], 8: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
      9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] };
    return P[n] || [];
  }
  function dot(c, x, y, r, col) {
    c.fillStyle = '#22100a'; c.beginPath(); c.arc(x, y, r + Math.max(2.5, r * 0.16), 0, TAU); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; ell(c, x - r * 0.32, y - r * 0.36, r * 0.3, r * 0.24, -0.5);
  }
  function basket(c, x, y, s) {
    c.lineJoin = 'round'; c.lineWidth = s * 0.06; c.strokeStyle = '#3a200c';
    c.beginPath(); c.arc(x, y - s * 0.1, s * 0.42, PI, 0); c.lineWidth = s * 0.08; c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.55, y - s * 0.1); c.lineTo(x + s * 0.55, y - s * 0.1); c.lineTo(x + s * 0.4, y + s * 0.45); c.lineTo(x - s * 0.4, y + s * 0.45); c.closePath();
    c.fillStyle = '#c98a45'; c.fill(); c.lineWidth = s * 0.05; c.stroke();
    c.strokeStyle = '#8a5424'; c.lineWidth = s * 0.03;
    for (let i = 1; i < 3; i++) { const yy = y - s * 0.1 + i * s * 0.18; c.beginPath(); c.moveTo(x - s * 0.52 + i * 0.05 * s, yy); c.lineTo(x + s * 0.52 - i * 0.05 * s, yy); c.stroke(); }
  }

  function paintSign(st, age) {
    const { c, W, H, kind, spec } = st;
    const ins = frame(c, W, H), iw = W - ins * 2, ih = H - ins * 2, fill = ink(spec.color || '#c0392b');
    if (kind === 'letter') {
      const U = String(spec.label || 'A').toUpperCase(), L = U.toLowerCase();
      const cr = capRatio(c, U), lr = capRatio(c, L);
      let f = ih * 0.84 / cr.a, fl = f * 0.74;
      const gap = f * 0.12, tot = cr.w * f + gap + lr.w * fl, avail = iw * 0.92;
      if (tot > avail) { f *= avail / tot; fl *= avail / tot; }
      const wU = cr.w * f, wL = lr.w * fl, x0 = W / 2 - (wU + gap + wL) / 2 - iw * 0.02, base = H / 2 + cr.a * f / 2;
      glyph(c, U, x0 + wU / 2, base, f, fill);
      glyph(c, L, x0 + wU + gap + wL / 2, base, fl, fill);
      if (spec.icon) badge(c, W - ins - ih * 0.2, ins + ih * 0.21, ih * 0.19, spec.icon);
    } else if (kind === 'word') {
      const w = String(spec.label || 'CAT').toUpperCase(), br = ih * 0.2;
      const left = ins + ih * 0.3, avail = W - ins - ih * 0.12 - left;
      const cr = capRatio(c, 'H'); let f = ih * 0.74 / cr.a;
      c.font = `bold ${f}px ${FONT}`;
      const ws = w.split('').map(ch => c.measureText(ch).width), gap = f * 0.06;
      const tot = ws.reduce((a, b) => a + b, 0) + gap * (w.length - 1);
      const k = Math.min(1, avail / tot); f *= k;
      let x = left + (avail - tot * k) / 2;
      const base = H / 2 + cr.a * f / 2 + ih * 0.03, pulse = 0.5 + 0.5 * Math.sin(age * 5.2);
      w.split('').forEach((ch, i) => {
        const cw = ws[i] * k, cx = x + cw / 2;
        if (i < st.prog) {
          glyph(c, ch, cx, base, f, '#f5b400');
          c.fillStyle = '#ffe14d'; c.strokeStyle = '#6a3e0c'; c.lineWidth = 3; star(c, cx + cw * 0.36, base - cr.a * f - f * 0.02, f * 0.13, f * 0.06); c.fill(); c.stroke();
        } else if (i === st.prog) {
          const s = 1 + 0.06 * pulse;
          glyph(c, ch, cx, base + f * 0.02 * pulse, f * s, fill, { color: `rgba(255,${190 + 50 * pulse | 0},40,1)`, blur: f * (0.12 + 0.16 * pulse) });
          c.fillStyle = '#f5b400'; c.strokeStyle = '#6a3e0c'; c.lineWidth = 3;
          rr(c, cx - cw * 0.38, base + f * 0.07, cw * 0.76, f * 0.07, f * 0.035); c.fill(); c.stroke();
        } else {
          glyph(c, ch, cx, base, f, '#6a4a3a');
        }
        x += cw + gap * k;
      });
      if (spec.icon) badge(c, br + 8, br + 8, br, spec.icon);
    } else if (kind === 'number') {
      const n = Math.max(0, Math.min(9, +spec.label || 0)), cr = capRatio(c, String(n), NUMFONT);
      const f = ih * 0.84 / cr.a, nx = ins + iw * 0.27, base = H / 2 + cr.a * f / 2;
      glyph(c, String(n), nx, base, f, fill, null, NUMFONT);
      const bx = ins + iw * 0.7, by = H / 2, bs = ih * 0.84;
      c.fillStyle = 'rgba(120,80,30,0.13)'; rr(c, bx - bs / 2, by - bs / 2, bs, bs, bs * 0.16); c.fill();
      if (n === 0) basket(c, bx, by, bs * 0.9);
      else { const sp = bs * 0.31, r = n > 6 ? bs * 0.115 : n > 3 ? bs * 0.135 : bs * 0.16; dotPattern(n).forEach(([dx, dy]) => dot(c, bx + dx * sp, by + dy * sp, r, spec.color)); }
    } else {
      const p = spec.count && typeof spec.count === 'object' ? spec.count : parseMath(spec.label);
      const parts = [String(p.a), p.op === '-' ? '−' : '+', String(p.b), '=', '?'];
      const cr = capRatio(c, '8', NUMFONT); let f = ih * 0.6 / cr.a;
      c.font = `bold ${f}px ${NUMFONT}`;
      const gap = f * 0.22, ws = parts.map(s => c.measureText(s).width);
      const tot = ws.reduce((a, b) => a + b, 0) + gap * 4, k = Math.min(1, iw * 0.94 / tot); f *= k;
      let x = W / 2 - tot * k / 2; const base = ins + ih * 0.06 + cr.a * f, xs = [];
      const colA = ink(spec.color || '#e63946'), colB = pickOther(spec.color || '#e63946');
      parts.forEach((s, i) => {
        const cw = ws[i] * k, cx = x + cw / 2; xs.push(cx);
        const col = i === 0 ? colA : i === 2 ? colB : i === 4 ? '#8a3ad0' : '#4a2f22';
        glyph(c, s, cx, base, i === 1 || i === 3 ? f * 0.9 : f, col, i === 4 ? { color: 'rgba(255,220,60,1)', blur: f * 0.22 } : null, NUMFONT);
        x += cw + gap * k;
      });
      // dots in rows of three, top-aligned under each number
      const sp = Math.min(ih * 0.19, (xs[2] - xs[0]) / 3.05), r = sp * 0.4, dy0 = base + ih * 0.08 + r;
      // take away: one group of a dots with the last b crossed out; plus: two groups
      const groups = p.op === '-' ? [[p.a, xs[0], spec.color, p.a - p.b]] : [[p.a, xs[0], spec.color, 99], [p.b, xs[2], colB, 99]];
      groups.forEach(([n, cx, col, crossFrom]) => {
        for (let j = 0; j < Math.min(9, n); j++) {
          const row = Math.floor(j / 3), inRow = Math.min(3, n - row * 3), cI = j % 3;
          const px = cx + (cI - (inRow - 1) / 2) * sp, py = dy0 + row * sp * 0.95;
          if (j >= crossFrom) {
            c.globalAlpha = 0.4; dot(c, px, py, r, col); c.globalAlpha = 1;
            c.strokeStyle = '#2a1508'; c.lineWidth = Math.max(3, r * 0.35); c.lineCap = 'round';
            c.beginPath(); c.moveTo(px - r, py - r); c.lineTo(px + r, py + r); c.moveTo(px + r, py - r); c.lineTo(px - r, py + r); c.stroke();
          } else dot(c, px, py, r, col);
        }
      });
    }
    st.tex.needsUpdate = true;
  }
  function parseMath(l) { const m = /^(\d+)\s*([+\-])\s*(\d+)$/.exec(String(l || '1+1')) || [0, 1, '+', 1]; return { a: +m[1], op: m[2], b: +m[3] }; }
  function pickOther(a) {
    const [r, , b] = rgb(a);
    return b > r ? '#ff7a1a' : '#1f9ed1';
  }

  // ── Designs ────────────────────────────────────────────────────────────────
  // Each builds a body on b.root and returns { head, faceOn, face, feet, gait, paw, wig, anim, float, after }.
  const DESIGNS = [
    function slime(b) {
      const { P, M, A, hy, R } = b, m = M(A, { glow: 0.32 });
      P('sph', m, [0, 0.5, 0], [0.78, 0.52, 0.66]);
      P('sph', m, [0, 1.05, 0], [0.62, 0.62, 0.56]);
      const head = P('sph', m, [0, hy - 0.02, 0], [R * 1.18, R * 1.02, R * 1.05]);
      P('sph', M('#ffffff', { basic: 1 }), [-0.52, 0.52, 0.64], [0.2, 0.12, 0.08], [0, 0, 0.7], head);
      const crown = P('crown', M('#ffcc33', { glow: 0.3 }), [0.06, hy + R * 0.98, -0.02], 0.27, [0.1, 0, -0.2]);
      const feet = [P('sph', m, [-0.3, 0.09, 0.32], [0.21, 0.12, 0.18]), P('sph', m, [0.3, 0.09, 0.32], [0.21, 0.12, 0.18])];
      return { head, feet, gait: 'hop', paw: m, face: { iris: mix(A, '#ffffff', 0.25) },
        wig: [{ o: crown, ax: 'z', amp: 0.07, f: 2.6, base: -0.2 }] };
    },
    function golem(b) {
      const { P, M, A, hy, R, top } = b, stone = M('#aab0bf'), moss = M('#5dbf48');
      P('sph', stone, [0, 0.85, 0], [0.62, 0.72, 0.55]);
      const head = P('sph', stone, [0, hy, 0], [R * 1.15, R * 0.98, R * 1.02]);
      P('hemi', moss, [0, 0.36, -0.04], [1.05, 0.6, 1.05], null, head);
      const buds = P('buds', M(A, { glow: 0.3 }), null, null, null, head);
      P('sph', stone, [-R * 1.55, top - 0.02, -0.1], [0.34, 0.3, 0.3]);
      P('sph', moss, [R * 1.55, top + 0.08, -0.1], [0.3, 0.2, 0.28]);
      P('sph', stone, [R * 1.55, top - 0.04, -0.1], [0.34, 0.28, 0.3]);
      const feet = [P('box', stone, [-0.27, 0.1, 0.32], [0.28, 0.2, 0.3]), P('box', stone, [0.27, 0.1, 0.32], [0.28, 0.2, 0.3])];
      return { head, feet, gait: 'stomp', paw: stone, face: { iris: '#2f8f5a' },
        wig: [{ o: buds, ax: 'z', amp: 0.06, f: 2.2 }] };
    },
    function mushroom(b) {
      const { P, M, A, hy, R } = b, cream = M('#fff0d6');
      P('cyl', cream, [0, 0.8, 0], [0.42, 1.3, 0.4]);
      const head = P('sph', cream, [0, hy - 0.06, 0], [R * 1.02, R * 0.96, R * 0.96]);
      const cap = P('hemi', M(A, { glow: 0.22 }), [0, hy + 0.1, 0], [0.8, 0.56, 0.76], [-0.1, 0, 0.1]);
      P('spots', M('#ffffff', { glow: 0.35 }), null, null, null, cap);
      P('cyl', M('#f3dcb4'), [0, 0, 0], [0.97, 0.04, 0.97], null, cap);
      const feet = [P('sph', cream, [-0.26, 0.09, 0.32], [0.18, 0.11, 0.22]), P('sph', cream, [0.26, 0.09, 0.32], [0.18, 0.11, 0.22])];
      return { head, feet, gait: 'hop', paw: cream, face: { iris: '#b0542a' },
        wig: [{ o: cap, ax: 'z', amp: 0.06, f: 1.8, base: 0.1 }] };
    },
    function owlKnight(b) {
      const { P, M, A, hy, R, top } = b, body = M(A), dark = M(mix(A, '#1a1030', 0.3)), steel = M('#c6d0dc', { glow: 0.22 });
      P('sph', body, [0, 0.9, 0], [0.62, 0.75, 0.55]);
      const head = P('sph', body, [0, hy, 0], [R * 1.18, R * 1.06, R * 1.0]);
      const disc = P('sph', M(mix(A, '#fff6e4', 0.72)), [0, -0.06, 0.2], [0.86, 0.76, 0.86], null, head);
      P('hemi', steel, [0, 0.52, -0.08], [0.82, 0.62, 0.82], null, head);
      P('tor', M('#8894a4'), [0, 0.54, -0.08], [0.8, 0.8, 0.5], [PI / 2, 0, 0], head);
      const plume = P('sph', M('#ff5a7e', { glow: 0.25 }), [0, 1.2, -0.25], [0.16, 0.36, 0.28], [-0.5, 0, 0], head);
      const tl = P('cone', dark, [-0.74, 0.62, 0], [0.18, 0.45, 0.18], [0, 0, 0.75], head);
      const tr = P('cone', dark, [0.74, 0.62, 0], [0.18, 0.45, 0.18], [0, 0, -0.75], head);
      P('cone', M('#ffab2e'), [0, -0.3, 1.06], [0.13, 0.26, 0.12], [PI * 0.62, 0, 0], head);
      const wl = P('sph', dark, [-R * 1.4, top + 0.02, -0.05], [0.19, 0.44, 0.34], [0, 0, 0.45]);
      const wr = P('sph', dark, [R * 1.4, top + 0.02, -0.05], [0.19, 0.44, 0.34], [0, 0, -0.45]);
      const orange = M('#ffab2e');
      const feet = [P('sph', orange, [-0.24, 0.08, 0.32], [0.17, 0.09, 0.2]), P('sph', orange, [0.24, 0.08, 0.32], [0.17, 0.09, 0.2])];
      return { head, faceOn: disc, feet, gait: 'waddle', paw: dark, face: { iris: '#e0901a', es: 1.08, ey: 44, my: 76 },
        wig: [{ o: tl, ax: 'z', amp: 0.12, f: 3.1, base: 0.75 }, { o: tr, ax: 'z', amp: -0.12, f: 3.1, base: -0.75 },
          { o: wl, ax: 'z', amp: 0.15, f: 2.4, base: 0.45 }, { o: wr, ax: 'z', amp: -0.15, f: 2.4, base: -0.45 }, { o: plume, ax: 'x', amp: 0.12, f: 2, base: -0.5 }] };
    },
    function babyDragon(b) {
      const { P, M, A, hy, R, top } = b, body = M(A), light = M(mix(A, '#fff4c2', 0.62)), wing = M(mix(A, '#1a1030', 0.18));
      P('sph', body, [0, 0.9, 0], [0.62, 0.72, 0.55]);
      const head = P('sph', body, [0, hy, 0], [R * 1.2, R * 1.0, R * 1.04]);
      P('crest', light, null, null, null, head);
      const horn = M('#fff0c8');
      P('cone', horn, [-0.45, 0.95, -0.1], [0.18, 0.6, 0.18], [-0.2, 0, 0.45], head);
      P('cone', horn, [0.45, 0.95, -0.1], [0.18, 0.6, 0.18], [-0.2, 0, -0.45], head);
      const el = P('cone', wing, [-0.98, 0.25, -0.2], [0.18, 0.45, 0.12], [0, 0, 1.25], head);
      const er = P('cone', wing, [0.98, 0.25, -0.2], [0.18, 0.45, 0.12], [0, 0, -1.25], head);
      const wl = P('sph', wing, [-R * 1.45, top + 0.2, -0.25], [0.08, 0.36, 0.5], [0, 0.5, 0.75]);
      const wr = P('sph', wing, [R * 1.45, top + 0.2, -0.25], [0.08, 0.36, 0.5], [0, -0.5, -0.75]);
      const feet = [P('sph', body, [-0.26, 0.09, 0.32], [0.18, 0.11, 0.22]), P('sph', body, [0.26, 0.09, 0.32], [0.18, 0.11, 0.22])];
      return { head, feet, gait: 'waddle', paw: light, face: { iris: '#2aa37a', ey: 44 },
        wig: [{ o: wl, ax: 'z', amp: 0.3, f: 7, base: 0.75 }, { o: wr, ax: 'z', amp: -0.3, f: 7, base: -0.75 },
          { o: el, ax: 'z', amp: 0.1, f: 3, base: 1.25 }, { o: er, ax: 'z', amp: -0.1, f: 3, base: -1.25 }] };
    },
    function yeti(b) {
      const { P, M, A, hy, R } = b, fur = M('#eef4ff', { glow: 0.22 });
      P('sph', fur, [0, 0.9, 0], [0.66, 0.75, 0.58]);
      const head = P('sph', fur, [0, hy, 0], [R * 1.14, R * 1.04, R * 1.04]);
      P('fluff', fur, null, null, null, head);
      const hat = M(A, { glow: 0.2 });
      P('hemi', hat, [0, 0.46, -0.06], [0.98, 0.8, 0.98], [-0.12, 0, 0], head);
      P('tor', M(mix(A, '#ffffff', 0.4)), [0, 0.5, -0.06], [0.96, 0.96, 0.9], [PI / 2 - 0.12, 0, 0], head);
      const pom = P('sph', M('#ffffff', { glow: 0.35 }), [0, 1.3, -0.2], 0.26, null, head);
      const feet = [P('sph', fur, [-0.28, 0.1, 0.32], [0.22, 0.13, 0.25]), P('sph', fur, [0.28, 0.1, 0.32], [0.22, 0.13, 0.25])];
      return { head, feet, gait: 'stomp', paw: fur, face: { iris: '#3b8fe0' },
        wig: [{ o: pom, ax: 'x', amp: 0.1, f: 3, base: 0, pos: 1 }] };
    },
    function frogPrince(b) {
      const { P, M, A, hy, R } = b, skin = M(mix(A, '#5fd35f', 0.55), { glow: 0.2 }), light = M(mix(A, '#fffbe0', 0.55));
      P('sph', skin, [0, 0.75, 0], [0.7, 0.62, 0.6]);
      const head = P('sph', skin, [0, hy - 0.08, 0], [R * 1.34, R * 0.88, R * 1.06]);
      P('sph', skin, [-0.42, 0.62, 0.3], [0.4, 0.5, 0.4], null, head);
      P('sph', skin, [0.42, 0.62, 0.3], [0.4, 0.5, 0.4], null, head);
      const crown = P('crown', M('#ffcc33', { glow: 0.3 }), [0, hy - 0.08 + R * 0.95, -0.08], 0.16, [-0.1, 0, 0.08]);
      const feet = [P('sph', light, [-0.3, 0.07, 0.34], [0.26, 0.07, 0.24]), P('sph', light, [0.3, 0.07, 0.34], [0.26, 0.07, 0.24])];
      return { head, feet, gait: 'hop', paw: light, face: { iris: '#e0a020', ey: 30, ex: 30, my: 70, mw: 1.8 },
        wig: [{ o: crown, ax: 'z', amp: 0.08, f: 2.4, base: 0.08 }] };
    },
    function pumpkinImp(b) {
      const { P, M, A, hy, R } = b, orange = M('#ff8a1c', { glow: 0.22 }), green = M('#4f9a2b');
      P('sph', M(A), [0, 0.85, 0], [0.55, 0.65, 0.5]);
      const head = P('pumpkin', orange, [0, hy, 0], [R * 1.3, R * 1.0, R * 1.12]);
      P('cyl', green, [0.08, 1.02, 0], [0.13, 0.36, 0.13], [0, 0, -0.25], head);
      const leaf = P('sph', M('#77d04a'), [0.42, 0.98, 0.08], [0.32, 0.06, 0.18], [0.2, 0, -0.35], head);
      const hat = P('cone', M(A, { glow: 0.22 }), [-0.22, hy + R * 0.95, 0.02], [0.2, 0.44, 0.2], [0, 0, 0.35]);
      P('tor', M('#ffcc33'), [0, -0.42, 0], [1.02, 1.02, 0.8], [PI / 2, 0, 0], hat);
      P('sph', M('#ffffff', { glow: 0.35 }), [0, 0.55, 0], [0.42, 0.18, 0.42], null, hat);
      const feet = [P('sph', green, [-0.25, 0.09, 0.32], [0.18, 0.11, 0.22]), P('sph', green, [0.25, 0.09, 0.32], [0.18, 0.11, 0.22])];
      return { head, feet, gait: 'hop', paw: orange, face: { iris: '#c0561a' },
        wig: [{ o: leaf, ax: 'z', amp: 0.2, f: 3.2, base: -0.35 }, { o: hat, ax: 'z', amp: 0.08, f: 2.1, base: 0.35 }] };
    },
    function ghost(b) {
      const { P, M, A, hy, R } = b, wht = M('#f6f2ff', { glow: 0.38 });
      const head = P('sph', wht, [0, hy, 0], [R * 1.14, R * 1.1, R * 1.04]);
      const hem = 0.1, sk = hy - hem;
      P('ghost', wht, [0, hem + sk / 2, 0], [R * 1.14, sk, R * 1.04]);
      const bow = M(A, { glow: 0.25 });
      const bl = P('sph', bow, [-0.62, 0.78, 0.2], [0.26, 0.18, 0.12], [0, 0, 0.5], head);
      const br = P('sph', bow, [-0.18, 0.95, 0.2], [0.26, 0.18, 0.12], [0, 0, 0.9], head);
      P('sph', bow, [-0.42, 0.88, 0.25], 0.12, null, head);
      return { head, gait: 'float', float: 0.2, paw: wht, face: { iris: '#5aa0ff', ey: 44 },
        wig: [{ o: bl, ax: 'z', amp: 0.12, f: 2.5, base: 0.5 }, { o: br, ax: 'z', amp: -0.12, f: 2.5, base: 0.9 }],
        after(st, pivot, SW, SH) {
          const lan = new T.Group(); lan.position.set(SW / 2 + 0.02, -SH * 0.3 - 0.02, 0.08); pivot.add(lan);
          P('cyl', M('#5a4a6a'), [0, -0.12, 0], [0.012, 0.25, 0.012], null, lan);
          P('box', M('#5a4a6a'), [0, -0.3, 0], [0.2, 0.05, 0.2], null, lan);
          P('box', M('#5a4a6a'), [0, -0.56, 0], [0.22, 0.05, 0.22], null, lan);
          P('sph', M(mix(A, '#ffe066', 0.7), { basic: 1 }), [0, -0.43, 0], [0.12, 0.15, 0.12], null, lan);
          st.wig.push({ o: lan, ax: 'z', amp: 0.18, f: 2.2 });
        } };
    },
    function hedgehog(b) {
      const { P, M, A, hy, R } = b, face = M('#f3d2a8'), quill = M('#7b4a2a');
      P('sph', quill, [0, 0.85, 0], [0.6, 0.7, 0.55]);
      const head = P('sph', face, [0, hy, 0], [R * 1.1, R * 1.0, R * 1.04]);
      P('quills', quill, null, null, null, head);
      P('sph', face, [0, -0.2, 0.9], [0.24, 0.18, 0.26], null, head);
      P('sph', M('#2a1a22'), [0, -0.15, 1.15], [0.09, 0.08, 0.07], null, head);
      P('sph', face, [-0.62, 0.62, 0.3], [0.17, 0.17, 0.08], [0, 0.4, 0], head);
      P('sph', face, [0.62, 0.62, 0.3], [0.17, 0.17, 0.08], [0, -0.4, 0], head);
      const cap = P('sph', M(A, { glow: 0.22 }), [0.12, 0.86, 0.02], [0.72, 0.26, 0.68], [0, 0, -0.22], head);
      const fea = P('cone', M('#ffffff', { glow: 0.3 }), [0.62, 0.35, 0], [0.12, 1.5, 0.08], [0, 0, -1.0], cap);
      const feet = [P('sph', quill, [-0.25, 0.08, 0.32], [0.17, 0.1, 0.21]), P('sph', quill, [0.25, 0.08, 0.32], [0.17, 0.1, 0.21])];
      return { head, feet, gait: 'waddle', paw: face, face: { iris: '#8a4a1a', my: 82, ey: 42 },
        wig: [{ o: fea, ax: 'z', amp: 0.15, f: 2.8, base: -1.0 }] };
    },
    function unicorn(b) {
      const { P, M, A, hy, R } = b, coat = M('#fff5fb', { glow: 0.25 });
      P('sph', coat, [0, 0.85, 0], [0.58, 0.7, 0.55]);
      const head = P('sph', coat, [0, hy, 0], [R * 1.06, R * 1.08, R * 1.04]);
      P('cone', M('#ffd24a', { glow: 0.35 }), [0, 1.3, 0.3], [0.19, 0.85, 0.19], [0.3, 0, 0], head);
      P('tor', M('#fff3b0'), [0, 1.08, 0.24], [0.15, 0.15, 0.15], [PI / 2 + 0.3, 0, 0], head);
      const el = P('cone', coat, [-0.5, 0.9, -0.1], [0.15, 0.4, 0.1], [0, 0, 0.4], head);
      const er = P('cone', coat, [0.5, 0.9, -0.1], [0.15, 0.4, 0.1], [0, 0, -0.4], head);
      const mane = P('maneA', M(A, { glow: 0.25 }), null, null, null, head);
      P('maneB', M(mix(A, '#ffffff', 0.5), { glow: 0.25 }), null, null, null, head);
      const hoof = M('#ff9ec7');
      const feet = [P('sph', hoof, [-0.24, 0.09, 0.32], [0.15, 0.11, 0.18]), P('sph', hoof, [0.24, 0.09, 0.32], [0.15, 0.11, 0.18])];
      return { head, feet, gait: 'trot', paw: coat, face: { iris: '#e0489a', lash: 1 },
        wig: [{ o: el, ax: 'z', amp: 0.14, f: 3.4, base: 0.4 }, { o: er, ax: 'z', amp: -0.14, f: 3.4, base: -0.4 }, { o: mane, ax: 'y', amp: 0.05, f: 2 }] };
    },
    function teapot(b) {
      const { P, M, A, hy, R } = b, pot = M(A, { glow: 0.2 }), gold = M('#ffcc33', { glow: 0.3 });
      P('sph', pot, [0, 0.8, 0], [0.6, 0.7, 0.55]);
      const head = P('sph', pot, [0, hy - 0.06, 0], [R * 1.3, R * 1.02, R * 1.16]);
      P('sph', M(mix(A, '#ffffff', 0.45)), [0, 0.82, 0], [0.64, 0.26, 0.64], null, head);
      P('sph', gold, [0, 1.12, 0], 0.17, null, head);
      P('cone', pot, [1.05, 0.12, 0.1], [0.19, 0.8, 0.19], [0, 0, -0.95], head);
      P('halfTor', pot, [-1.0, 0.05, 0], [0.42, 0.5, 0.5], [0, 0, PI / 2], head);
      const steam = M('#ffffff', { glow: 0.45 });
      const puffs = [P('sph', steam, [0, 0, 0], 0.08), P('sph', steam, [0, 0, 0], 0.06)];
      const feet = [P('sph', gold, [-0.25, 0.08, 0.3], [0.16, 0.09, 0.2]), P('sph', gold, [0.25, 0.08, 0.3], [0.16, 0.09, 0.2])];
      const sx = R * 1.3 * 1.45, sy = hy + 0.35;
      return { head, feet, gait: 'waddle', paw: pot, face: { iris: mix(A, '#1a1030', 0.3) },
        anim(age) { puffs.forEach((p, i) => { const k = (age * 0.6 + i * 0.5) % 1; p.position.set(sx + k * 0.12 + Math.sin(age * 3 + i) * 0.04, sy + k * 0.45, 0.05); p.scale.setScalar((0.07 + k * 0.08) * (1 - k * k)); }); } };
    },
    function bumblebee(b) {
      const { P, M, A, hy, R, top } = b, yel = M('#ffd23f', { glow: 0.25 }), blk = M('#2a2233');
      P('sph', yel, [0, 0.9, 0], [0.6, 0.72, 0.55]);
      const head = P('sph', yel, [0, hy, 0], [R * 1.12, R * 1.02, R * 1.02]);
      P('tor', blk, [0, -0.62, -0.05], [0.8, 0.8, 1.2], [PI / 2, 0, 0], head);
      const ants = [-1, 1].map(s => {
        const g = new T.Group(); g.position.set(s * 0.32, 0.82, 0.1); g.rotation.z = -s * 0.35; head.add(g);
        P('cyl', blk, [0, 0.28, 0], [0.04, 0.56, 0.04], null, g);
        P('sph', M(A, { glow: 0.3 }), [0, 0.6, 0], 0.13, null, g);
        return g;
      });
      P('sph', M(A, { glow: 0.2 }), [-0.12, 0.86, -0.05], [0.84, 0.24, 0.78], [0, 0, 0.25], head);
      const wing = M('#dff4ff', { glow: 0.5, op: 0.8 });
      const wl = P('sph', wing, [-R * 1.35, top + 0.36, -0.25], [0.05, 0.46, 0.3], [0.3, 0, 0.8]);
      const wr = P('sph', wing, [R * 1.35, top + 0.36, -0.25], [0.05, 0.46, 0.3], [0.3, 0, -0.8]);
      return { head, gait: 'float', float: 0.22, paw: blk, face: { iris: '#6b3fc0' },
        wig: [{ o: ants[0], ax: 'z', amp: 0.18, f: 3.3, base: 0.35 }, { o: ants[1], ax: 'z', amp: -0.18, f: 3.1, base: -0.35 },
          { o: wl, ax: 'z', amp: 0.28, f: 22, base: 0.8 }, { o: wr, ax: 'z', amp: -0.28, f: 22, base: -0.8 }] };
    },
  ];
  const NAMES = DESIGNS.map(f => f.name);
  const KIND_OFF = { letter: 0, word: 4, number: 8, math: 11 };
  const SCALE = 1.12; // whole creature + sign

  // ── Particles (Points) ─────────────────────────────────────────────────────
  function makeFx(parent) {
    const N = 240, geo = new T.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), cell = new Float32Array(N);
    const A = (arr, n) => new T.BufferAttribute(arr, n).setUsage(T.DynamicDrawUsage);
    geo.setAttribute('position', A(pos, 3)); geo.setAttribute('pcol', A(col, 3)); geo.setAttribute('size', A(size, 1));
    geo.setAttribute('alpha', A(alpha, 1)); geo.setAttribute('cell', A(cell, 1));
    const pts = new T.Points(geo, S.ptMat); pts.frustumCulled = false; pts.renderOrder = 5; pts.visible = false;
    parent.add(pts);
    const ps = [], tmp = new T.Color();
    let alive = 0, was = true;
    return {
      pts, geo,
      emit(o) {
        const p = { x: o.x, y: o.y, z: o.z, vx: o.vx, vy: o.vy, vz: o.vz, life: 0, max: o.life, size: o.size, g: o.g || 0, drag: o.drag || 0, cell: o.cell, tw: o.tw || 0, grow: o.grow || 0 };
        tmp.set(o.color); p.r = tmp.r; p.gg = tmp.g; p.b = tmp.b;
        if (ps.length < N) ps.push(p);
      },
      update(dt) {
        alive = 0;
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i]; p.life += dt;
          if (p.life >= p.max) { ps.splice(i, 1); continue; }
          p.vy -= p.g * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
        for (let i = 0; i < N; i++) {
          const p = ps[i];
          if (!p) { alpha[i] = 0; continue; }
          alive++;
          const k = p.life / p.max;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          col[i * 3] = p.r; col[i * 3 + 1] = p.gg; col[i * 3 + 2] = p.b;
          const tw = p.tw ? 0.65 + 0.35 * Math.sin(p.life * p.tw + i) : 1;
          size[i] = p.size * Math.min(1, p.life * 14) * (p.grow ? 1 + k * p.grow : 1) * tw * (k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.8 : 1);
          alpha[i] = k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.6 : 1;
          cell[i] = p.cell;
        }
        pts.visible = alive > 0;
        if (alive || was) ['position', 'pcol', 'size', 'alpha', 'cell'].forEach(n => { geo.attributes[n].needsUpdate = true; });
        was = alive > 0;
      },
    };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  function create(spec) {
    shared();
    spec = spec || {};
    const kind = SIGN[spec.kind] ? spec.kind : 'letter';
    const nD = DESIGNS.length;
    const di = spec.design != null ? ((spec.design % nD) + nD) % nD : ((((spec.index | 0) * 5 + KIND_OFF[kind]) % nD) + nD) % nD;
    const A = spec.color || '#e63946';
    const [SW, SH, CW] = SIGN[kind];
    const SB = 0.26, top = SB + SH, R = 0.56, hy = top + 0.4, SZ = 0.7;

    const group = new T.Group(), scaler = new T.Group(), root = new T.Group(), fxg = new T.Group();
    scaler.scale.setScalar(SCALE); group.add(scaler); scaler.add(root); scaler.add(fxg);
    const mats = [], toon = [], mc = {};
    function M(col, o = {}) {
      const key = col + '|' + (o.basic ? 1 : 0) + '|' + (o.op || 1) + '|' + (o.glow == null ? '' : o.glow);
      if (mc[key]) return mc[key];
      let m;
      if (o.basic) m = new T.MeshBasicMaterial({ color: col });
      else {
        m = new T.MeshToonMaterial({ color: col, gradientMap: S.gradient });
        m.userData.e0 = new T.Color(col).multiplyScalar(o.glow == null ? 0.16 : o.glow);
        m.emissive.copy(m.userData.e0); toon.push(m);
      }
      if (o.op) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
      mats.push(m); return (mc[key] = m);
    }
    function P(geo, mat, p, s, r, parent) {
      const m = new T.Mesh(typeof geo === 'string' ? S.geo[geo] : geo, mat);
      if (p) m.position.set(p[0], p[1], p[2]);
      if (s != null) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
      if (r) m.rotation.set(r[0], r[1], r[2]);
      (parent || root).add(m); return m;
    }

    const D = DESIGNS[di]({ P, M, A, hy, R, top, root, spec });
    const st = { wig: D.wig || [] };

    // face
    const faces = faceSet(D.face || {});
    const faceMat = new T.MeshToonMaterial({ map: faces.open, gradientMap: S.gradient, alphaTest: 0.5, emissive: 0x2a2a2a });
    faceMat.emissiveMap = faces.open; mats.push(faceMat);
    const faceMesh = P('face', faceMat, null, null, null, D.faceOn || D.head);
    let faceMode = 'open';
    function setFace(m) { if (m === faceMode) return; faceMode = m; faceMat.map = faceMat.emissiveMap = faces[m]; }

    // sign
    const CH = Math.round(CW * SH / SW), cv = canvas(CW, CH);
    const sign = { c: cv.getContext('2d'), W: CW, H: CH, kind, spec, prog: 0, tex: null };
    sign.tex = canvasTex(cv);
    paintSign(sign, 0);
    const signMat = new T.MeshBasicMaterial({ map: sign.tex, alphaTest: 0.5, side: T.DoubleSide, color: 0xf2f2f2 });
    mats.push(signMat);
    const pivot = new T.Group(); pivot.position.set(0, SB + SH / 2, SZ); root.add(pivot);
    const board = new T.Mesh(S.geo.quad, signMat); board.scale.set(SW, SH, 1); pivot.add(board);
    const pawM = D.paw || M(A);
    const paws = [-1, 1].map(s => P('sph', pawM, [s * (SW / 2 - 0.03), -SH * 0.3, 0.07], [0.15, 0.14, 0.12], null, pivot));
    if (D.after) D.after(st, pivot, SW, SH);

    const bodyParts = root.children.filter(o => o !== pivot);
    const feet = (D.feet || []).map(f => ({ o: f, y: f.position.y, z: f.position.z }));
    const headY = D.head.position.y, floatH = D.float || 0;
    const fx = makeFx(fxg);

    // ── State ──
    let age = rnd() * 10, walkT = 0, walkAmt = 1, nextBlink = 1.5 + rnd() * 2, blinkUntil = -1;
    let hitT = 9, happyUntil = -1, flashOn = false, poofT = -1, redrawT = 0, burst = false, signGone = false;
    let flies = null, conf = null;
    const HIT = 0.45, POOF = 1.5;
    const wOff = rnd() * TAU;
    const m4 = new T.Matrix4(), qv = new T.Quaternion(), ev = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3();

    function setFlash(k) {
      if (k <= 0 && !flashOn) return;
      flashOn = k > 0;
      toon.forEach(m => { m.emissive.copy(m.userData.e0); if (k > 0) m.emissive.r += k, m.emissive.g += k, m.emissive.b += k; });
    }

    function startBurst() {
      burst = true;
      bodyParts.forEach(o => { o.visible = false; }); paws.forEach(o => { o.visible = false; });
      const cy = hy * 0.62, cells = [0, 0, 1, 1, 2, 3];
      for (let i = 0; i < 70; i++) {
        const a = rnd() * TAU, e = (rnd() - 0.3) * PI * 0.8, sp = 1.4 + rnd() * 2.6;
        const dx = Math.cos(e) * Math.cos(a), dy = Math.sin(e), dz = Math.cos(e) * Math.sin(a) * 0.6 + 0.3;
        fx.emit({ x: dx * 0.45, y: cy + dy * hy * 0.45, z: dz * 0.3, vx: dx * sp, vy: dy * sp + 1.6, vz: dz * sp * 0.6,
          life: 0.7 + rnd() * 0.7, size: 0.1 + rnd() * 0.16, g: 2.2, drag: 1.6, cell: cells[i % 6], tw: i % 3 ? 14 : 0,
          color: i % 5 === 0 ? '#ffffff' : i % 4 === 0 ? '#ffe14d' : RAINBOW[i % RAINBOW.length] });
      }
      fx.emit({ x: 0, y: cy + 0.2, z: 0.4, vx: 0, vy: 0, vz: 0, life: 0.28, size: 1.1, cell: 1, grow: 0.5, color: '#fffbe0' });
      fx.emit({ x: 0, y: hy, z: 0.3, vx: 0, vy: 0, vz: 0, life: 0.26, size: 1.0, cell: 1, grow: 0.8, color: '#fff0a0' });
      // confetti + butterflies
      const nc = 44;
      conf = new T.InstancedMesh(S.geo.quad, S.confMat, nc); conf.frustumCulled = false;
      conf.userData.p = [];
      for (let i = 0; i < nc; i++) {
        const a = rnd() * TAU, sp = 1.2 + rnd() * 2.4;
        conf.userData.p.push({ x: (rnd() - 0.5) * 0.8, y: cy + (rnd() - 0.3) * hy * 0.7, z: 0.2, vx: Math.cos(a) * sp, vy: 2 + rnd() * 2.8, vz: Math.sin(a) * sp * 0.4 + 0.5,
          rx: rnd() * 6, ry: rnd() * 6, sx: 5 + rnd() * 8, sy: 4 + rnd() * 8 });
        conf.setColorAt(i, new T.Color(RAINBOW[i % RAINBOW.length]));
      }
      fxg.add(conf);
      const nb = 8;
      flies = new T.InstancedMesh(S.geo.quad, S.bfMat, nb); flies.frustumCulled = false; flies.userData.p = [];
      for (let i = 0; i < nb; i++) {
        const s = i % 2 ? 1 : -1;
        flies.userData.p.push({ x: s * (0.1 + rnd() * 0.4), y: hy * (0.35 + rnd() * 0.6), z: 0.3 + rnd() * 0.3, vx: s * (0.4 + rnd() * 0.9), vy: 1.1 + rnd() * 1.3, vz: 0.2 + rnd() * 0.5,
          ph: rnd() * TAU, fl: 17 + rnd() * 6, sz: 0.3 + rnd() * 0.12, wob: 1.8 + rnd() * 1.6 });
        flies.setColorAt(i, new T.Color(RAINBOW[(i * 3) % RAINBOW.length]));
      }
      fxg.add(flies);
    }

    function updateInstanced(dt) {
      const tp = poofT - 0.12;
      if (conf) {
        conf.userData.p.forEach((p, i) => {
          p.vy -= 3.2 * dt; const d = Math.max(0, 1 - 2.2 * dt); p.vx *= d; p.vy *= d; p.vz *= d;
          p.x += p.vx * dt + Math.sin(tp * 6 + i) * 0.3 * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.sx * dt; p.ry += p.sy * dt;
          const s = tp > 1.1 ? Math.max(0, 1 - (tp - 1.1) / 0.28) : 1;
          m4.compose(pv.set(p.x, p.y, p.z), qv.setFromEuler(ev.set(p.rx, p.ry, 0)), sv.set(0.07 * s, 0.11 * s, 1));
          conf.setMatrixAt(i, m4);
        });
        conf.instanceMatrix.needsUpdate = true;
      }
      if (flies) {
        flies.userData.p.forEach((p, i) => {
          p.x += (p.vx + Math.sin(tp * p.wob + p.ph) * 0.9) * dt; p.y += p.vy * dt * (0.8 + 0.4 * Math.sin(tp * 5 + p.ph)); p.z += p.vz * dt;
          const grow = Math.min(1, tp * 5), fade = tp > 1.12 ? Math.max(0, 1 - (tp - 1.12) / 0.25) : 1;
          const flap = 0.22 + 0.78 * Math.abs(Math.cos(tp * p.fl + p.ph)), s = p.sz * grow * fade;
          m4.compose(pv.set(p.x, p.y, p.z), qv.setFromEuler(ev.set(-0.25, Math.sin(tp * 2 + p.ph) * 0.4, Math.sin(tp * p.wob + p.ph) * 0.35 - p.vx * 0.2)), sv.set(s * flap, s, 1));
          flies.setMatrixAt(i, m4);
          if (fade > 0 && fade < 1 && rnd() < dt * 12) fx.emit({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.2, vz: 0, life: 0.3, size: 0.12, cell: 1, color: '#ffffff' });
        });
        flies.instanceMatrix.needsUpdate = true;
      }
    }

    const creature = {
      group, walking: false, design: NAMES[di],
      height: (top + 0.9 + floatH) * SCALE,
      update(dt, t) {
        dt = Math.min(dt || 0.016, 0.05); age += dt;
        // blink + face
        if (age > nextBlink) { blinkUntil = age + 0.13; nextBlink = age + 2 + rnd() * 3; }
        setFace(age < happyUntil || poofT >= 0 ? 'happy' : age < blinkUntil ? 'blink' : 'open');
        // gait
        walkAmt += ((creature.walking ? 1 : 0) - walkAmt) * Math.min(1, dt * 6);
        if (creature.walking) walkT += dt;
        let y = floatH, rz = 0, sx = 1, sy = 1 + Math.sin(age * 2.4 + wOff) * 0.02, l0 = 0, l1 = 0;
        const w = walkAmt, gait = D.gait;
        if (gait === 'hop') {
          const ph = (walkT * 2.1) % 1, c = ph < 0.14 ? 1 - ph / 0.14 : ph > 0.88 ? (ph - 0.88) / 0.12 : 0;
          y += Math.sin(ph * PI) * 0.3 * w; sy += (-0.16 * c + 0.07 * Math.sin(ph * PI)) * w; sx += 0.12 * c * w;
          rz = Math.sin(walkT * 2.1 * PI) * 0.05 * w;
        } else if (gait === 'waddle') {
          const s = Math.sin(walkT * 8.5); rz = s * 0.13 * w; y += Math.abs(s) * 0.06 * w; l0 = Math.max(0, s) * 0.13 * w; l1 = Math.max(0, -s) * 0.13 * w;
        } else if (gait === 'stomp') {
          const s = Math.sin(walkT * 6.5); rz = s * 0.06 * w; y += Math.abs(Math.cos(walkT * 6.5)) * 0.05 * w; sy -= Math.abs(s) * 0.03 * w;
          l0 = Math.max(0, s) * 0.18 * w; l1 = Math.max(0, -s) * 0.18 * w;
        } else if (gait === 'trot') {
          const s = Math.sin(walkT * 11); y += Math.abs(s) * 0.12 * w; rz = s * 0.05 * w; l0 = Math.max(0, s) * 0.12 * w; l1 = Math.max(0, -s) * 0.12 * w;
        } else {
          y += Math.sin(age * 2.3 + wOff) * 0.06 + Math.sin(walkT * 6) * 0.05 * w; rz = Math.sin(age * 1.6) * 0.05 + Math.sin(walkT * 3) * 0.06 * w;
        }
        let ry = 0;
        if (hitT < HIT) {
          hitT += dt; const k = Math.min(1, hitT / HIT), e = Math.sin(k * PI * 3) * (1 - k);
          sy *= 1 - 0.22 * e; sx *= 1 + 0.2 * e; ry = Math.sin(k * PI * 4) * 0.45 * (1 - k); rz += Math.sin(k * PI * 6) * 0.08 * (1 - k);
          setFlash(Math.max(0, 1 - k * 2.4) * 1.1);
        } else setFlash(0);
        // poof
        if (poofT >= 0) {
          poofT += dt;
          if (!burst) { const k = Math.min(1, poofT / 0.12); sx *= 1 + 0.28 * k; sy *= 1 + 0.2 * k; if (poofT >= 0.12) startBurst(); }
          if (!signGone) {
            const k = smooth((poofT - 0.05) / 0.7);
            pivot.rotation.y = k * k * 16; pivot.scale.setScalar(Math.max(0.001, 1 - k)); pivot.position.y = SB + SH / 2 + k * 0.5;
            if (poofT > 0.75) {
              signGone = true; pivot.visible = false;
              const py = SB + SH / 2 + 0.5;
              fx.emit({ x: 0, y: py, z: SZ, vx: 0, vy: 0, vz: 0, life: 0.3, size: 0.7, cell: 1, grow: 0.4, color: '#fff3a0' });
              for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; fx.emit({ x: 0, y: py, z: SZ, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 + 0.5, vz: 0.3, life: 0.5 + rnd() * 0.3, size: 0.14, cell: i % 2 ? 1 : 0, g: 1, drag: 2, tw: 16, color: i % 3 ? '#ffe14d' : '#ffffff' }); }
            }
          }
          if (burst) updateInstanced(dt);
        }
        root.position.y = y; root.rotation.z = rz; root.rotation.y = ry; root.scale.set(sx, sy, sx);
        // idle life
        const hd = D.head;
        hd.position.y = headY + Math.sin(age * 2.4 + wOff + 0.6) * 0.012;
        hd.rotation.z = Math.sin(age * 1.3 + wOff) * 0.07 + rz * 0.4;
        hd.rotation.x = Math.sin(age * 0.9) * 0.04;
        st.wig.forEach(o => { o.o.rotation[o.ax] = (o.base || 0) + o.amp * Math.sin(age * o.f + (o.ph || 0) + wOff) * (1 + w * 0.6); });
        if (D.anim) D.anim(age);
        feet.forEach((f, i) => { f.o.position.y = f.y + (i ? l1 : l0); f.o.position.z = f.z + (i ? l1 : l0) * 0.4; });
        if (poofT < 0) {
          pivot.rotation.z = Math.sin(age * 1.7 + wOff) * 0.03 - rz * 0.5;
          pivot.rotation.x = Math.sin(age * 1.2) * 0.025;
          paws.forEach((p, i) => { p.position.y = -SH * 0.3 + Math.sin(age * 1.7 + i * 2) * 0.015; });
        }
        // animated word sign (next letter glows)
        if (kind === 'word' && poofT < 0 && sign.prog < String(spec.label || '').length) {
          redrawT -= dt; if (redrawT <= 0) { redrawT = 0.1; paintSign(sign, age); }
        }
        fx.update(dt);
      },
      setProgress(n) {
        if (kind !== 'word') return;
        sign.prog = Math.max(0, n | 0); paintSign(sign, age); redrawT = 0.1;
      },
      hit() {
        hitT = 0; happyUntil = age + 0.75;
        const ix = SW * 0.18, iy = SB + SH * 0.8, iz = SZ + 0.1;
        for (let i = 0; i < 16; i++) {
          const a = rnd() * TAU, sp = 1.8 + rnd() * 2;
          fx.emit({ x: ix, y: iy, z: iz, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1.2, vz: 0.4 + rnd() * 0.6, life: 0.5 + rnd() * 0.3,
            size: i % 3 ? 0.2 + rnd() * 0.08 : 0.14, g: 3.5, drag: 1.4, cell: i % 3 ? 0 : 1, tw: i % 3 ? 0 : 18, color: i % 3 ? '#ffd83a' : '#ffffff' });
        }
        fx.emit({ x: ix, y: iy, z: iz, vx: 0, vy: 0, vz: 0, life: 0.22, size: 0.8, cell: 1, grow: 0.5, color: '#ffffff' });
      },
      poof() {
        if (poofT < 0) { poofT = 0; happyUntil = age + 9; }
        return POOF;
      },
      dispose() {
        mats.forEach(m => m.dispose());
        sign.tex.dispose(); fx.geo.dispose();
        if (conf) conf.dispose(); if (flies) flies.dispose();
      },
    };
    creature.update(0.016, 0);
    return creature;
  }

  window.AK = window.AK || {};
  AK.creatures = { create, DESIGNS: NAMES };
})();
