// ─── UI: crisp 1280x720 overlay (title, menu, HUD, banners) ──────────────────
window.AK = window.AK || {};
(function () {
  const W = 1280, H = 720;
  const SERIF = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
  const EMOJI = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  const PHASES = ['LETTERS', 'WORDS', 'NUMBERS', 'MATH'];
  const PH = {
    LETTERS: { label: 'Letters', name: 'Letters!', c1: '#e0405a', c2: '#6e0c20' },
    WORDS:   { label: 'Words',   name: 'Words!',   c1: '#4a7ff0', c2: '#12286e' },
    NUMBERS: { label: 'Numbers', name: 'Numbers!', c1: '#2fbf78', c2: '#0a4528' },
    MATH:    { label: 'Adding',  name: 'Adding!',  c1: '#a860e6', c2: '#3c1266' },
  };
  const PCOL = ['#ffd84a', '#ff5d6c', '#6fd8ff', '#7dff9a', '#ff8ad8', '#ffffff', '#c28bff', '#ffa94a'];
  const rnd = AK.rng ? AK.rng(7) : Math.random;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOutBack = x => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOutElastic = x => { x = clamp(x, 0, 1); return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
  function darken(hex, f) {
    const n = parseInt(hex.slice(1), 16), c = x => Math.round(x * (1 - f));
    return `rgb(${c(n >> 16 & 255)},${c(n >> 8 & 255)},${c(n & 255)})`;
  }
  const easeOutCubic = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function font(g, px, fam) { g.font = `bold ${Math.round(px)}px ${fam || SERIF}`; }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function goldGrad(g, y0, y1) {
    const q = g.createLinearGradient(0, y0, 0, y1);
    q.addColorStop(0, '#fff8c8'); q.addColorStop(0.3, '#ffd84a'); q.addColorStop(0.55, '#e3a41e');
    q.addColorStop(0.8, '#b06e0a'); q.addColorStop(1, '#f5c850'); return q;
  }
  // Outlined text with a hard drop shadow (no shadowBlur per frame).
  function otext(g, s, x, y, px, fill, o) {
    o = o || {};
    font(g, px, o.fam); g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.miterLimit = 2;
    const lw = o.lw || Math.max(3, px * 0.16);
    if (o.shadow !== false) {
      g.fillStyle = g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = lw;
      g.strokeText(s, x + px * 0.02, y + px * 0.07); g.fillText(s, x + px * 0.02, y + px * 0.07);
    }
    if (lw > 0) { g.lineWidth = lw; g.strokeStyle = o.stroke || '#1e0f05'; g.strokeText(s, x, y); }
    g.fillStyle = fill; g.fillText(s, x, y);
  }
  // Emoji are rasterised once per size (colour glyphs are slow to draw).
  function emoji(g, s, x, y, px) {
    if (!s) return;
    px = Math.round(px);
    const c = once('em' + s + px, () => {
      const d = Math.ceil(px * 1.5), c = mk(d, d), q = c.getContext('2d');
      q.font = `${px}px ${EMOJI}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillText(s, d / 2 + px * 0.03, d / 2 + px * 0.06);
      q.fillStyle = '#000'; q.fillText(s, d / 2, d / 2); return c;
    });
    g.drawImage(c, x - c.width / 2, y - c.height / 2);
  }
  // Generic cached sprite; cleared when it grows too big.
  const sprites = new Map();
  function sprite(key, w, h, fn) {
    let c = sprites.get(key);
    if (!c) { if (sprites.size > 80) sprites.clear(); c = mk(w, h); fn(c.getContext('2d'), c); sprites.set(key, c); }
    return c;
  }
  function dot(g, x, y, r, col) {
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fillStyle = col; g.fill();
    g.lineWidth = Math.max(2, r * 0.28); g.strokeStyle = '#2a1405'; g.stroke();
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
  }

  // ── Shapes: shield, ribbon, crown, sword ───────────────────────────────────
  function shieldPath(g, x, y, w, h) {
    g.beginPath();
    g.moveTo(x, y + h * 0.07);
    g.quadraticCurveTo(x + w * 0.5, y - h * 0.035, x + w, y + h * 0.07);
    g.lineTo(x + w, y + h * 0.48);
    g.bezierCurveTo(x + w, y + h * 0.76, x + w * 0.66, y + h * 0.9, x + w * 0.5, y + h);
    g.bezierCurveTo(x + w * 0.34, y + h * 0.9, x, y + h * 0.76, x, y + h * 0.48);
    g.closePath();
  }
  function drawShield(g, x, y, w, h, c1, c2, o) {
    o = o || {};
    const b = o.rim || Math.max(3, w * 0.055);
    g.save();
    if (o.blur !== 0) { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = o.blur || 16; g.shadowOffsetY = o.sy || 8; }
    shieldPath(g, x, y, w, h); g.fillStyle = '#2a1405'; g.fill();
    g.shadowColor = 'transparent';
    shieldPath(g, x + 2, y + 2, w - 4, h - 4); g.fillStyle = goldGrad(g, y, y + h); g.fill();
    shieldPath(g, x + b, y + b, w - 2 * b, h - 2.3 * b);
    const q = g.createRadialGradient(x + w * 0.42, y + h * 0.3, 2, x + w * 0.5, y + h * 0.45, w * 0.8);
    q.addColorStop(0, c1); q.addColorStop(1, c2); g.fillStyle = q; g.fill();
    if (o.pattern) {
      g.save(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
      for (let i = -h; i < w + h; i += 22) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + h, y + h); g.moveTo(x + i + h, y); g.lineTo(x + i, y + h); g.stroke(); }
      const gl = g.createLinearGradient(0, y, 0, y + h * 0.55);
      gl.addColorStop(0, 'rgba(255,255,255,0.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillRect(x, y, w, h * 0.55);
      g.restore();
      shieldPath(g, x + b + 7, y + b + 7, w - 2 * b - 14, h - 2.3 * b - 16);
      g.strokeStyle = 'rgba(255,225,130,0.75)'; g.lineWidth = 2; g.stroke();
      [[0.1, 0.1], [0.9, 0.1], [0.5, 0.045], [0.03, 0.45], [0.97, 0.45], [0.5, 0.965]].forEach(([u, v]) => {
        g.beginPath(); g.arc(x + w * u + (u < 0.5 ? b * 0.2 : u > 0.5 ? -b * 0.2 : 0), y + h * v, b * 0.32, 0, 6.2832);
        g.fillStyle = '#fff3b8'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#6b4208'; g.stroke();
      });
    }
    shieldPath(g, x + 1.5, y + 1.5, w - 3, h - 3); g.strokeStyle = '#2a1405'; g.lineWidth = o.line || 3; g.stroke();
    g.restore();
  }
  function drawRibbon(g, cx, cy, w, h, col, dark) {
    const x0 = cx - w / 2, x1 = cx + w / 2, t = h * 0.95;
    g.save(); g.lineJoin = 'round';
    for (const s of [-1, 1]) {
      const xe = s < 0 ? x0 : x1;
      g.beginPath();
      g.moveTo(xe - s * h * 0.3, cy - h * 0.15); g.lineTo(xe + s * t, cy - h * 0.15);
      g.lineTo(xe + s * t * 0.62, cy + h * 0.33); g.lineTo(xe + s * t, cy + h * 0.8);
      g.lineTo(xe - s * h * 0.3, cy + h * 0.8); g.closePath();
      g.fillStyle = dark; g.fill(); g.strokeStyle = '#1a0a02'; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.moveTo(xe, cy + h * 0.5); g.lineTo(xe + s * h * 0.001, cy + h * 0.8); g.lineTo(xe - s * h * 0.3, cy + h * 0.8); g.closePath();
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
    }
    const bow = h * 0.14;
    g.beginPath();
    g.moveTo(x0, cy - h / 2); g.quadraticCurveTo(cx, cy - h / 2 - bow, x1, cy - h / 2);
    g.lineTo(x1, cy + h / 2); g.quadraticCurveTo(cx, cy + h / 2 - bow, x0, cy + h / 2); g.closePath();
    g.fillStyle = col; g.fill();
    const sh = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = sh; g.fill();
    g.strokeStyle = '#1a0a02'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,215,110,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0 + 4, cy - h / 2 + 5); g.quadraticCurveTo(cx, cy - h / 2 - bow + 5, x1 - 4, cy - h / 2 + 5);
    g.moveTo(x0 + 4, cy + h / 2 - 5); g.quadraticCurveTo(cx, cy + h / 2 - bow - 5, x1 - 4, cy + h / 2 - 5); g.stroke();
    g.restore();
  }
  function drawCrown(g, cx, cy, w) {
    const h = w * 0.72, x0 = cx - w / 2, y0 = cy - h / 2;
    g.save(); g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x0 + w * 0.04, y0 + h * 0.9);
    g.lineTo(x0 - w * 0.03, y0 + h * 0.28); g.lineTo(x0 + w * 0.26, y0 + h * 0.55);
    g.lineTo(x0 + w * 0.5, y0 + h * 0.06); g.lineTo(x0 + w * 0.74, y0 + h * 0.55);
    g.lineTo(x0 + w * 1.03, y0 + h * 0.28); g.lineTo(x0 + w * 0.96, y0 + h * 0.9); g.closePath();
    g.lineWidth = w * 0.06; g.strokeStyle = '#2a1405'; g.stroke();
    g.fillStyle = goldGrad(g, y0, y0 + h); g.fill();
    rr(g, x0, y0 + h * 0.7, w, h * 0.28, h * 0.07);
    g.stroke(); g.fillStyle = goldGrad(g, y0 + h * 0.6, y0 + h * 1.05); g.fill();
    [[x0 - w * 0.03, y0 + h * 0.28], [x0 + w * 0.5, y0 + h * 0.06], [x0 + w * 1.03, y0 + h * 0.28]].forEach(([x, y]) => {
      g.beginPath(); g.arc(x, y, w * 0.065, 0, 6.2832); g.lineWidth = w * 0.035; g.stroke(); g.fillStyle = '#fff3b0'; g.fill();
    });
    const jy = y0 + h * 0.84;
    [[cx, w * 0.075, '#e8213f'], [cx - w * 0.3, w * 0.055, '#2f6bff'], [cx + w * 0.3, w * 0.055, '#1fbf6a']].forEach(([x, r, c]) => {
      g.beginPath(); g.arc(x, jy, r, 0, 6.2832); g.fillStyle = c; g.fill(); g.lineWidth = w * 0.022; g.stroke();
      g.beginPath(); g.arc(x - r * 0.3, jy - r * 0.35, r * 0.3, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
    });
    g.restore();
  }
  function drawSword(g, x0, x1, y, s) {
    g.save(); g.lineJoin = 'round'; g.strokeStyle = '#1a0a02'; g.lineWidth = 3 * s;
    const gx = x0 + 78 * s;
    g.beginPath(); g.moveTo(gx, y - 10 * s); g.lineTo(x1 - 46 * s, y - 10 * s); g.lineTo(x1, y); g.lineTo(x1 - 46 * s, y + 10 * s); g.lineTo(gx, y + 10 * s); g.closePath();
    const bl = g.createLinearGradient(0, y - 10 * s, 0, y + 10 * s);
    bl.addColorStop(0, '#ffffff'); bl.addColorStop(0.45, '#d5deea'); bl.addColorStop(0.55, '#8a97aa'); bl.addColorStop(1, '#5d6879');
    g.fillStyle = bl; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(70,80,100,0.8)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(gx + 14 * s, y); g.lineTo(x1 - 70 * s, y); g.stroke();
    g.strokeStyle = '#1a0a02'; g.lineWidth = 3 * s;
    rr(g, x0 + 22 * s, y - 7 * s, gx - x0 - 28 * s, 14 * s, 4 * s); g.fillStyle = '#6b3a18'; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(30,12,2,0.8)'; g.lineWidth = 2 * s;
    for (let x = x0 + 30 * s; x < gx - 8 * s; x += 9 * s) { g.beginPath(); g.moveTo(x, y - 6 * s); g.lineTo(x + 5 * s, y + 6 * s); g.stroke(); }
    g.strokeStyle = '#1a0a02'; g.lineWidth = 3 * s;
    rr(g, gx - 9 * s, y - 38 * s, 18 * s, 76 * s, 7 * s); g.fillStyle = goldGrad(g, y - 38 * s, y + 38 * s); g.fill(); g.stroke();
    [y - 40 * s, y + 40 * s].forEach(yy => { g.beginPath(); g.arc(gx, yy, 8 * s, 0, 6.2832); g.fillStyle = '#ffe07a'; g.fill(); g.stroke(); });
    g.beginPath(); g.arc(x0 + 14 * s, y, 15 * s, 0, 6.2832); g.fillStyle = goldGrad(g, y - 15 * s, y + 15 * s); g.fill(); g.stroke();
    g.beginPath(); g.arc(x0 + 14 * s, y, 7 * s, 0, 6.2832); g.fillStyle = '#e8213f'; g.fill(); g.lineWidth = 2 * s; g.stroke();
    g.restore();
  }

  // ── Pre-rendered pieces ────────────────────────────────────────────────────
  const cache = {};
  function once(key, fn) { return cache[key] || (cache[key] = fn()); }

  function buildGoldText(str, px, maxW) {
    const tmp = mk(4, 4).getContext('2d'); font(tmp, px); let tw = tmp.measureText(str).width;
    if (maxW && tw > maxW) { px = Math.floor(px * maxW / tw); font(tmp, px); tw = tmp.measureText(str).width; }
    const pad = Math.ceil(px * 0.45), w = Math.ceil(tw + pad * 2), h = Math.ceil(px * 1.35 + pad);
    const cx = w / 2, cy = h / 2;
    const M = mk(w, h), m = M.getContext('2d');
    font(m, px); m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#fff'; m.fillText(str, cx, cy);
    const off = Math.max(2, px * 0.03);
    const rim = (dx, dy, col) => {
      const c = mk(w, h), q = c.getContext('2d');
      q.fillStyle = col; q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'destination-out'; q.drawImage(M, dx, dy);
      q.globalCompositeOperation = 'destination-in'; q.drawImage(M, 0, 0); return c;
    };
    const hi = rim(off, off, 'rgba(255,255,235,0.95)'), lo = rim(-off, -off, 'rgba(90,40,0,0.85)');
    const C = mk(w, h), g = C.getContext('2d');
    font(g, px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = px * 0.22; g.shadowOffsetY = px * 0.07;
    g.lineWidth = px * 0.22; g.strokeStyle = '#1a0a02'; g.strokeText(str, cx, cy);
    g.shadowColor = 'transparent';
    const br = g.createLinearGradient(0, cy - px * 0.6, 0, cy + px * 0.6);
    br.addColorStop(0, '#fff0a8'); br.addColorStop(0.5, '#c7891c'); br.addColorStop(1, '#6e4208');
    g.lineWidth = px * 0.12; g.strokeStyle = br; g.strokeText(str, cx, cy);
    g.lineWidth = px * 0.035; g.strokeStyle = '#2a1405'; g.strokeText(str, cx, cy);
    g.fillStyle = goldGrad(g, cy - px * 0.48, cy + px * 0.42); g.fillText(str, cx, cy);
    g.drawImage(hi, 0, 0); g.drawImage(lo, 0, 0);
    return { c: C, m: M, w, h };
  }

  function buildParchment(w, h, frame) {
    const pad = 18, c = mk(w + pad * 2, h + pad * 2), g = c.getContext('2d');
    g.translate(pad, pad);
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 16; g.shadowOffsetY = 7;
    rr(g, 0, 0, w, h, 16); g.fillStyle = '#e9d3a0'; g.fill(); g.shadowColor = 'transparent';
    const q = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.65);
    q.addColorStop(0, '#fdf3d6'); q.addColorStop(0.6, '#efdaa8'); q.addColorStop(1, '#c79f5e');
    rr(g, 0, 0, w, h, 16); g.fillStyle = q; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < w * h / 50; i++) { g.fillStyle = `rgba(120,80,30,${rnd() * 0.09})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
    g.strokeStyle = 'rgba(140,95,40,0.12)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd() * 12 - 6, w * 0.7, y + rnd() * 12 - 6, w, y + rnd() * 8 - 4); g.stroke(); }
    g.restore();
    if (frame) {
      rr(g, 5, 5, w - 10, h - 10, 12); g.strokeStyle = goldGrad(g, 0, h); g.lineWidth = 6; g.stroke();
      rr(g, 1.5, 1.5, w - 3, h - 3, 16); g.strokeStyle = '#4a2a0a'; g.lineWidth = 3; g.stroke();
      rr(g, 12, 12, w - 24, h - 24, 7); g.strokeStyle = 'rgba(150,100,25,0.6)'; g.lineWidth = 1.5; g.stroke();
      [[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1]].forEach(([x, y, sx, sy]) => {
        g.save(); g.translate(x, y); g.scale(sx, sy);
        g.strokeStyle = '#8a5a10'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(8, 4); g.bezierCurveTo(22, 2, 28, 10, 22, 16); g.stroke();
        g.beginPath(); g.moveTo(4, 8); g.bezierCurveTo(2, 22, 10, 28, 16, 22); g.stroke();
        g.beginPath(); g.moveTo(0, -6); g.lineTo(6, 0); g.lineTo(0, 6); g.lineTo(-6, 0); g.closePath();
        g.fillStyle = goldGrad(g, -6, 6); g.fill(); g.strokeStyle = '#4a2a0a'; g.lineWidth = 1.5; g.stroke();
        g.restore();
      });
    }
    return c;
  }

  function glowSpr(col) {
    return once('glow' + col, () => {
      const c = mk(128, 128), g = c.getContext('2d'), q = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      q.addColorStop(0, col); q.addColorStop(0.35, col.replace(/[\d.]+\)$/, '0.45)')); q.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = q; g.fillRect(0, 0, 128, 128); return c;
    });
  }
  function starSpr(col) {
    return once('star' + col, () => {
      const c = mk(48, 48), g = c.getContext('2d');
      g.translate(24, 24); g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 19, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = '#2a1405'; g.stroke();
      g.fillStyle = col; g.fill();
      g.beginPath(); g.arc(-4, -5, 4, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
      return c;
    });
  }
  function sparkSpr() {
    return once('spark', () => {
      const c = mk(64, 64), g = c.getContext('2d');
      g.drawImage(glowSpr('rgba(255,230,140,0.9)'), 12, 12, 40, 40);
      g.translate(32, 32); g.fillStyle = '#fffbe6'; g.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 30, a = i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); return c;
    });
  }
  const shade = () => once('shade', () => {
    const c = mk(W, H), g = c.getContext('2d');
    const q = g.createRadialGradient(W / 2, H * 0.45, 120, W / 2, H * 0.5, W * 0.72);
    q.addColorStop(0, 'rgba(10,4,20,0.15)'); q.addColorStop(1, 'rgba(10,4,20,0.7)');
    g.fillStyle = q; g.fillRect(0, 0, W, H); return c;
  });
  const rays = () => once('rays', () => {
    const c = mk(1000, 1000), g = c.getContext('2d');
    g.translate(500, 500);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 500, a, a + Math.PI / 24); g.closePath();
      g.fillStyle = i % 2 ? 'rgba(255,220,110,0.55)' : 'rgba(255,245,200,0.4)'; g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    const q = g.createRadialGradient(0, 0, 30, 0, 0, 500);
    q.addColorStop(0, 'rgba(0,0,0,1)'); q.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = q; g.fillRect(-500, -500, 1000, 1000); return c;
  });

  // Title logo: crown, gold lettering, sword, subtitle ribbon.
  const LOGO_W = 1200, LOGO_H = 350;
  const logo = () => once('logo', () => {
    const c = mk(LOGO_W, LOGO_H), g = c.getContext('2d'), M = mk(LOGO_W, LOGO_H), m = M.getContext('2d');
    const t = buildGoldText('Alphabet Knight', 138, 1080);
    drawSword(g, 120, 1080, 244, 1.05);
    g.drawImage(t.c, LOGO_W / 2 - t.w / 2, 160 - t.h / 2);
    m.drawImage(t.m, LOGO_W / 2 - t.w / 2, 160 - t.h / 2);
    drawCrown(g, LOGO_W / 2, 42, 96);
    drawRibbon(g, LOGO_W / 2, 262, 440, 60, '#b3182f', '#6e0c1c');
    otext(g, 'The Castle Quest', LOGO_W / 2, 258, 40, '#fff1c8', { lw: 7 });
    return { c, M };
  });
  const shineCv = mk(LOGO_W / 2, LOGO_H / 2);

  const menuShield = p => once('ms' + p, () => {
    const c = mk(270, 310), g = c.getContext('2d'), P = PH[p];
    drawShield(g, 20, 16, 230, 270, P.c1, P.c2, { pattern: true, blur: 18, sy: 9 });
    drawPhasePic(g, p, 135, 118, 1);
    drawRibbon(g, 135, 222, 164, 38, '#f3e2b0', '#b08a4c');
    otext(g, P.label, 135, 219, 26, '#3b1f0a', { lw: 0, shadow: false });
    return c;
  });
  const miniShield = on => once('mini' + on, () => {
    const c = mk(28, 32), g = c.getContext('2d');
    if (on) drawShield(g, 2, 2, 24, 28, '#fff2a0', '#d08e12', { blur: 0, rim: 2.5, line: 2 });
    else drawShield(g, 2, 2, 24, 28, 'rgba(90,70,110,0.9)', 'rgba(35,22,50,0.9)', { blur: 0, rim: 2.5, line: 2 });
    return c;
  });
  const TR = { x0: 24, x1: 1088, y: 34 };
  const trailBar = () => once('trail', () => {
    const w = TR.x1 - TR.x0, c = mk(w + 20, 64), g = c.getContext('2d');
    rr(g, 10, 14, w, 40, 20); g.fillStyle = 'rgba(25,12,40,0.55)'; g.fill();
    g.strokeStyle = 'rgba(255,210,100,0.75)'; g.lineWidth = 2.5; g.stroke();
    g.setLineDash([6, 8]); g.strokeStyle = 'rgba(255,230,160,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(40, 34); g.lineTo(w - 40, 34); g.stroke(); g.setLineDash([]);
    return c;
  });
  const CARD = { x: 420, y: 58, w: 440, h: 134 };
  const cardSpr = () => once('card', () => buildParchment(CARD.w, CARD.h, true));
  const scrollSpr = () => once('scroll', () => buildParchment(680, 330, true));
  const toggleSpr = (mode, sel) => once('tg' + mode + sel, () => {
    const c = mk(340, 160), g = c.getContext('2d'), easy = mode === 'easy';
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14; g.shadowOffsetY = 7;
    rr(g, 20, 20, 300, 120, 28); g.fillStyle = '#1a0a02'; g.fill(); g.restore();
    const q = g.createLinearGradient(0, 20, 0, 140);
    if (sel) { q.addColorStop(0, easy ? '#3fd08a' : '#5a8cff'); q.addColorStop(1, easy ? '#0d5a33' : '#15307a'); }
    else { q.addColorStop(0, '#5a5068'); q.addColorStop(1, '#2a2236'); }
    rr(g, 24, 24, 292, 112, 25); g.fillStyle = q; g.fill();
    const gl = g.createLinearGradient(0, 24, 0, 80); gl.addColorStop(0, 'rgba(255,255,255,0.3)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fill();
    rr(g, 21, 21, 298, 118, 28); g.strokeStyle = sel ? goldGrad(g, 20, 140) : '#8a7a5a'; g.lineWidth = sel ? 7 : 4; g.stroke();
    g.beginPath(); g.arc(82, 80, 40, 0, 6.2832); g.fillStyle = sel ? '#fbeec4' : '#b8ae9a'; g.fill();
    g.strokeStyle = '#2a1405'; g.lineWidth = 3; g.stroke();
    if (!sel) g.globalAlpha = 0.7;
    emoji(g, easy ? '👆' : '🔍', 82, 82, 50);
    otext(g, easy ? 'Easy' : 'Learn', 210, 62, 44, sel ? '#fff6d8' : '#d8d0c0', { lw: 7 });
    otext(g, easy ? 'Tap anything' : 'Find the letter', 210, 106, 22, sel ? '#ffe7a0' : '#bdb2a0', { lw: 5 });
    return c;
  });
  const gemSpr = col => once('gem' + col, () => {
    const c = mk(190, 190), g = c.getContext('2d'), cx = 95, cy = 92;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14; g.shadowOffsetY = 8;
    g.beginPath(); g.arc(cx, cy, 78, 0, 6.2832); g.fillStyle = '#1a0a02'; g.fill(); g.restore();
    g.beginPath(); g.arc(cx, cy, 76, 0, 6.2832); g.fillStyle = goldGrad(g, cy - 76, cy + 76); g.fill();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6; g.beginPath(); g.arc(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, 3.2, 0, 6.2832);
      g.fillStyle = '#fff6c8'; g.fill(); g.strokeStyle = '#6b4208'; g.lineWidth = 1.2; g.stroke();
    }
    const q = g.createRadialGradient(cx - 20, cy - 25, 4, cx, cy, 64);
    q.addColorStop(0, '#ffffff'); q.addColorStop(0.2, col); q.addColorStop(0.7, col); q.addColorStop(1, darken(col, 0.55));
    g.beginPath(); g.arc(cx, cy, 62, 0, 6.2832); g.fillStyle = q; g.fill();
    g.strokeStyle = '#2a1405'; g.lineWidth = 3; g.stroke();
    g.save(); g.clip(); g.globalAlpha = 0.18; g.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 64, a, a + Math.PI / 8); g.closePath(); g.fill(); }
    g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx - 18, cy - 32, 30, 14, -0.4, 0, 6.2832); g.fill();
    g.restore();
    g.beginPath(); g.arc(cx, cy, 76, 0, 6.2832); g.strokeStyle = '#2a1405'; g.lineWidth = 3; g.stroke();
    return c;
  });

  // ── Phase pictures (no reading needed) ─────────────────────────────────────
  function drawPhasePic(g, p, cx, cy, s) {
    if (p === 'WORDS') {
      emoji(g, '🐱', cx, cy - 26 * s, 66 * s);
      ['C', 'A', 'T'].forEach((L, i) => otext(g, L, cx + (i - 1) * 40 * s, cy + 46 * s, 50 * s, ['#ffd84a', '#fff3c4', '#fff3c4'][i], { lw: 8 * s }));
    } else if (p === 'MATH') {
      otext(g, '1', cx - 56 * s, cy - 14 * s, 76 * s, '#ffd84a', { lw: 10 * s });
      otext(g, '+', cx, cy - 14 * s, 70 * s, '#ffffff', { lw: 10 * s });
      otext(g, '2', cx + 56 * s, cy - 14 * s, 76 * s, '#7dff9a', { lw: 10 * s });
      dot(g, cx - 56 * s, cy + 50 * s, 11 * s, '#ffd84a');
      dot(g, cx + 42 * s, cy + 50 * s, 11 * s, '#7dff9a'); dot(g, cx + 70 * s, cy + 50 * s, 11 * s, '#7dff9a');
    } else {
      const L = p === 'NUMBERS' ? ['1', '2', '3'] : ['A', 'B', 'C'];
      const C = p === 'NUMBERS' ? ['#7dff9a', '#ffd84a', '#ff8ad8'] : ['#ff7a88', '#ffd84a', '#7ee0ff'];
      L.forEach((ch, i) => {
        g.save(); g.translate(cx + (i - 1) * 56 * s, cy + (i === 1 ? -10 : 4) * s); g.rotate((i - 1) * 0.14);
        otext(g, ch, 0, 0, 84 * s, C[i], { lw: 11 * s }); g.restore();
      });
    }
  }

  // ── Icons ──────────────────────────────────────────────────────────────────
  function castleIcon(g, cx, cy, s, col) {
    g.fillStyle = col;
    const R = (x, y, w, h) => g.fillRect(cx + x * s, cy + y * s, w * s, h * s);
    R(-16, -6, 32, 26); R(-25, -16, 11, 36); R(14, -16, 11, 36);
    R(-25, -22, 4, 6); R(-18, -22, 4, 6); R(14, -22, 4, 6); R(21, -22, 4, 6);
    R(-10, -12, 5, 6); R(-2.5, -12, 5, 6); R(5, -12, 5, 6);
    g.fillStyle = 'rgba(30,15,40,0.9)';
    g.beginPath(); g.moveTo(cx - 5 * s, cy + 20 * s); g.lineTo(cx - 5 * s, cy + 9 * s); g.arc(cx, cy + 9 * s, 5 * s, Math.PI, 0); g.lineTo(cx + 5 * s, cy + 20 * s); g.fill();
  }
  function bellIcon(g, cx, cy, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(cx - 20 * s, cy + 12 * s);
    g.quadraticCurveTo(cx - 13 * s, cy + 6 * s, cx - 13 * s, cy - 4 * s);
    g.quadraticCurveTo(cx - 13 * s, cy - 19 * s, cx, cy - 19 * s);
    g.quadraticCurveTo(cx + 13 * s, cy - 19 * s, cx + 13 * s, cy - 4 * s);
    g.quadraticCurveTo(cx + 13 * s, cy + 6 * s, cx + 20 * s, cy + 12 * s); g.closePath(); g.fill();
    g.beginPath(); g.arc(cx, cy + 16 * s, 5 * s, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(cx, cy - 21 * s, 4 * s, 0, 6.2832); g.fill();
  }
  function arrow(g, cx, cy, s, col) {
    g.beginPath();
    g.moveTo(cx - 22 * s, cy - 9 * s); g.lineTo(cx + 2 * s, cy - 9 * s); g.lineTo(cx + 2 * s, cy - 22 * s);
    g.lineTo(cx + 26 * s, cy); g.lineTo(cx + 2 * s, cy + 22 * s); g.lineTo(cx + 2 * s, cy + 9 * s); g.lineTo(cx - 22 * s, cy + 9 * s); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 7 * s; g.strokeStyle = '#1e0f05'; g.stroke(); g.fillStyle = col; g.fill();
  }
  function check(g, cx, cy, r) {
    g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fillStyle = goldGrad(g, cy - r, cy + r); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#2a1405'; g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.45, cy + r * 0.02); g.lineTo(cx - r * 0.1, cy + r * 0.38); g.lineTo(cx + r * 0.5, cy - r * 0.36);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = r * 0.34; g.strokeStyle = '#155a26'; g.stroke(); g.lineCap = 'butt';
  }

  // ── Layouts (shared by draw and hit) ───────────────────────────────────────
  const HOME = { id: 'home', x: 1110, y: 14, w: 72, h: 72, pad: 6, act: { type: 'home' } };
  const MUTE = { id: 'mute', x: 1194, y: 14, w: 72, h: 72, pad: 6, act: { type: 'mute' } };
  const NEXT = { id: 'next', x: 480, y: 552, w: 320, h: 124, pad: 16, act: { type: 'next' } };
  const AGAIN = { id: 'again', x: 490, y: 540, w: 300, h: 150, pad: 16, act: { type: 'home' } };
  const shields = PHASES.map((p, i) => ({ id: 'ph' + i, p, x: 129 + i * 264, y: 116, w: 230, h: 270, pad: 14, act: { type: 'phase', phase: p } }));
  const toggles = [
    { id: 'easy', mode: 'easy', x: 322, y: 444, w: 300, h: 120, pad: 8, act: { type: 'mode', mode: 'easy' } },
    { id: 'learn', mode: 'learn', x: 658, y: 444, w: 300, h: 120, pad: 8, act: { type: 'mode', mode: 'learn' } },
  ];
  function choiceRects(ch) {
    return ch.map((c, i) => ({ id: 'ch' + i, c, x: 352 + i * 200, y: 538, w: 176, h: 168, pad: 12, act: { type: 'choice', value: c.text } }));
  }
  function buttons(v) {
    if (v.screen === 'menu') return shields.concat(toggles);
    if (v.screen === 'play') return v.mode === 'learn' && v.choices ? [HOME, MUTE].concat(choiceRects(v.choices)) : [HOME, MUTE];
    if (v.screen === 'phaseDone') return [HOME, MUTE, NEXT];
    if (v.screen === 'victory') return [AGAIN];
    return [];
  }
  function inside(b, x, y) { const p = b.pad || 0; return x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p; }

  // ── Animation state ────────────────────────────────────────────────────────
  const S = {
    screen: null, screenT: 0, lastT: 0, state: null, meetT: 0, actT: -99, press: null, pressT: -9,
    hx: -1, hy: -1, card: null, cardT: -9, index: -1, phase: null, word: 0, letterT: -9, lastCorrect: null,
    chKey: '', chT: -9, marker: 0, fillT: [], parts: [], nextFx: 0, mode: null, modeT: -9,
  };
  document.addEventListener('pointermove', e => {
    const c = document.getElementById('ui'); if (!c) return;
    const r = c.getBoundingClientRect(); S.hx = (e.clientX - r.left) / r.width * W; S.hy = (e.clientY - r.top) / r.height * H;
  }, { passive: true });
  window.addEventListener('keydown', () => { S.actT = S.lastT; });

  function pressScale(id, t) {
    if (S.press !== id) return 1;
    const k = (t - S.pressT) / 0.55;
    return k < 1 ? 0.86 + 0.14 * easeOutElastic(k) : 1;
  }
  const hovered = b => inside(b, S.hx, S.hy);

  // ── Particles ──────────────────────────────────────────────────────────────
  function addP(p) { if (S.parts.length < 450) S.parts.push(p); }
  function burst(x, y, n, spd, kinds) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, v = spd * (0.35 + Math.random() * 0.8);
      addP({ k: kinds[i % kinds.length], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.35, g: 420, life: 0, max: 0.9 + Math.random() * 0.9,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 7, s: 0.6 + Math.random() * 0.8, c: PCOL[(Math.random() * PCOL.length) | 0], drag: 1.6 });
    }
  }
  function confetti(n) {
    for (let i = 0; i < n; i++) addP({ k: 'conf', x: Math.random() * W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: 70 + Math.random() * 90,
      g: 30, life: 0, max: 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, s: 0.8 + Math.random() * 0.6, c: PCOL[(Math.random() * PCOL.length) | 0], drag: 0.2, ph: Math.random() * 6 });
  }
  function drawParts(g, dt) {
    const P = S.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt; if (p.life > p.max || p.y > H + 40 || p.y < -300) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const fade = clamp((p.max - p.life) / 0.4, 0, 1) * clamp(p.life / 0.08, 0, 1);
      g.globalAlpha = fade;
      const co = Math.cos(p.rot), si = Math.sin(p.rot);
      if (p.k === 'conf') {
        const f = Math.cos(p.life * 5 + p.ph);
        g.setTransform(co * p.s, si * p.s, -si * p.s * f, co * p.s * f, p.x + Math.sin(p.life * 2 + p.ph) * 12, p.y);
        g.fillStyle = p.c; g.fillRect(-7, -4, 14, 8);
      } else if (p.k === 'star') {
        g.setTransform(co * p.s, si * p.s, -si * p.s, co * p.s, p.x, p.y); g.drawImage(starSpr(p.c), -24, -24);
      } else if (p.k === 'mote') {
        g.globalAlpha = fade * (0.5 + 0.5 * Math.sin(p.life * 2 + p.rot));
        g.setTransform(p.s, 0, 0, p.s, p.x + Math.sin(p.life * 0.8 + p.rot) * 18, p.y); g.drawImage(glowSpr('rgba(255,210,110,0.9)'), -12, -12, 24, 24);
      } else {
        g.globalCompositeOperation = 'lighter';
        g.setTransform(co * p.s, si * p.s, -si * p.s, co * p.s, p.x, p.y); g.drawImage(sparkSpr(), -20, -20, 40, 40);
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  function drawTitle(g, t) {
    const e = t - S.screenT;
    g.drawImage(shade(), 0, 0);
    const L = logo(), y = 245 + Math.sin(t * 1.1) * 5, k = 0.75 + 0.25 * easeOutBack(e / 0.9);
    g.globalAlpha = (0.32 + 0.1 * Math.sin(t * 1.3)) * clamp(e / 0.6, 0, 1);
    g.drawImage(glowSpr('rgba(255,200,90,0.9)'), 640 - 560, y - 230, 1120, 400);
    g.globalAlpha = clamp(e / 0.4, 0, 1);
    g.setTransform(k, 0, 0, k, 640, y);
    g.drawImage(L.c, -LOGO_W / 2, -175);
    const cyc = ((t + 1.5) % 4.5) / 1.2;
    if (cyc < 1) {
      const s = shineCv.getContext('2d'), x = (-250 + cyc * (LOGO_W + 500)) / 2, hw = LOGO_W / 2, hh = LOGO_H / 2;
      s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, hw, hh);
      const q = s.createLinearGradient(x - 55, 0, x + 55, hh * 0.6);
      q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.5, 'rgba(255,255,240,0.95)'); q.addColorStop(1, 'rgba(255,255,255,0)');
      s.fillStyle = q; s.fillRect(Math.max(0, x - 120), 0, 240, hh);
      s.globalCompositeOperation = 'destination-in'; s.drawImage(L.M, 0, 0, hw, hh);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8; g.drawImage(shineCv, -LOGO_W / 2, -175, LOGO_W, LOGO_H);
      g.globalCompositeOperation = 'source-over';
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    // twinkles on the crown and letters
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.7 + i * 0.27) % 1, a = Math.sin(ph * Math.PI);
      g.globalAlpha = a * clamp(e - 1, 0, 1); g.globalCompositeOperation = 'lighter';
      const sx = [640, 245, 1010, 520][i], sy = [y - 150, y - 50, y - 40, y + 16][i], sz = 30 + a * 26;
      g.drawImage(sparkSpr(), sx - sz / 2, sy - sz / 2, sz, sz);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (Math.random() < 0.25) addP({ k: 'mote', x: Math.random() * W, y: H + 10, vx: 0, vy: -25 - Math.random() * 35, g: 0, life: 0, max: 14, rot: Math.random() * 6, vr: 0, s: 0.6 + Math.random() * 1.1, drag: 0 });
    // Tap to play
    const a = clamp((e - 0.8) / 0.5, 0, 1); if (a <= 0) return;
    const pu = 1 + 0.05 * Math.sin(t * 3.4);
    g.globalAlpha = a; g.setTransform(pu, 0, 0, pu, 640, 568);
    g.drawImage(sprite('tap', 540, 132, q => {
      q.translate(270, 66); rr(q, -260, -56, 520, 112, 56); q.fillStyle = 'rgba(30,10,45,0.72)'; q.fill();
      q.strokeStyle = goldGrad(q, -56, 56); q.lineWidth = 5; q.stroke();
      otext(q, 'Tap to play!', 40, 0, 60, '#fff3c4', { lw: 9 });
    }), -270, -66);
    const tap = Math.abs(Math.sin(t * 2.6)), ph = (t * 2.6 / Math.PI) % 1;
    g.globalAlpha = a * (1 - ph) * 0.8; g.beginPath(); g.ellipse(-178, 34, 10 + ph * 34, 4 + ph * 12, 0, 0, 6.2832);
    g.strokeStyle = '#ffe07a'; g.lineWidth = 3; g.stroke();
    g.globalAlpha = a; emoji(g, '👆', -182, 4 - tap * 16, 70);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }

  // ── Menu ───────────────────────────────────────────────────────────────────
  const menuHead = () => once('mhead', () => buildGoldText('Choose your Quest', 54));
  function drawMenu(g, t, v) {
    const e = t - S.screenT;
    g.globalAlpha = 0.85; g.drawImage(shade(), 0, 0); g.globalAlpha = 1;
    const mh = menuHead(), ha = clamp(e / 0.4, 0, 1);
    g.globalAlpha = ha; g.drawImage(mh.c, 640 - mh.w / 2, 58 - mh.h / 2 + (1 - ha) * -20); g.globalAlpha = 1;
    shields.forEach((b, i) => {
      const k = easeOutBack((e - 0.05 - i * 0.08) / 0.55); if (k <= 0) return;
      const bob = Math.sin(t * 1.7 + i * 1.1) * 6, hv = hovered(b);
      const sc = k * (hv ? 1.06 : 1) * pressScale(b.id, t), cx = b.x + b.w / 2, cy = b.y + b.h / 2 + bob;
      if (hv) { g.globalAlpha = 0.5; g.drawImage(glowSpr('rgba(255,215,100,0.9)'), cx - 190, cy - 210, 380, 420); g.globalAlpha = 1; }
      g.setTransform(sc, 0, 0, sc, cx, cy + (1 - k) * 40);
      g.drawImage(menuShield(b.p), -135, -151);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
    if (v.mode !== S.mode) { if (S.mode) S.modeT = t; S.mode = v.mode; }
    toggles.forEach((b, i) => {
      const k = easeOutBack((e - 0.35 - i * 0.08) / 0.5); if (k <= 0) return;
      const sel = v.mode === b.mode, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (sel) { g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2.4); g.drawImage(glowSpr('rgba(255,210,90,0.95)'), cx - 230, cy - 120, 460, 240); g.globalAlpha = 1; }
      const sc = k * (hovered(b) ? 1.05 : 1) * pressScale(b.id, t) * (sel ? 1.03 : 0.97);
      g.setTransform(sc, 0, 0, sc, cx, cy);
      g.drawImage(toggleSpr(b.mode, sel), -170, -80);
      if (sel) { const ck = S.modeT > 0 ? easeOutElastic((t - S.modeT) / 0.6) : 1; g.setTransform(sc * ck, 0, 0, sc * ck, cx + 138 * sc, cy - 52 * sc); check(g, 0, 0, 22); }
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
    g.globalAlpha = clamp((e - 0.8) / 0.5, 0, 1) * 0.8;
    otext(g, 'Keys 1-4 choose, Esc returns here', 640, 694, 19, '#f3e2b0', { lw: 4, shadow: false });
    g.globalAlpha = 1;
  }

  // ── Play HUD ───────────────────────────────────────────────────────────────
  function trackPlay(t, v) {
    const key = v.phase + ':' + v.index;
    if (key !== S.card) {
      if (S.card && v.phase === S.phase && v.index === S.index + 1) {
        S.fillT[S.index] = t;
        burst(640, CARD.y + CARD.h / 2, 26, 520, ['star', 'spark']);
        burst(trailX(S.index, v.total), TR.y, 10, 220, ['spark']);
      }
      if (v.phase !== S.phase) { S.fillT = []; S.marker = v.index; }
      S.card = key; S.cardT = t; S.index = v.index; S.phase = v.phase; S.word = v.wordProgress || 0;
    }
    if ((v.wordProgress || 0) > S.word) { S.letterT = t; S.word = v.wordProgress; }
    if (S.lastCorrect === null) S.lastCorrect = v.lastCorrect;
    if (v.lastCorrect !== S.lastCorrect) { S.lastCorrect = v.lastCorrect; burst(640, CARD.y + CARD.h / 2, 14, 380, ['spark', 'star']); }
    const ck = v.choices ? v.choices.map(c => c.text).join('') : '';
    if (ck !== S.chKey) { S.chKey = ck; S.chT = t; }
  }
  function trailX(i, n) {
    const a = TR.x0 + 46, b = TR.x1 - 92;
    return n <= 1 ? a : a + (b - a) * i / (n - 1);
  }
  function drawTrail(g, t, v, dt) {
    const n = v.total || 0; if (!n) return;
    g.globalAlpha = 0.95; g.drawImage(trailBar(), TR.x0 - 10, TR.y - 34); g.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      const x = trailX(i, n), on = i < v.index, ft = S.fillT[i];
      let s = 1; if (on && ft !== undefined) s = 1 + 0.6 * (1 - easeOutElastic((t - ft) / 0.8));
      g.setTransform(s, 0, 0, s, x, TR.y); g.drawImage(miniShield(on), -14, -16);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    emoji(g, '🏰', TR.x1 - 40, TR.y - 2, 38);
    S.marker += (Math.min(v.index, n) - S.marker) * Math.min(1, dt * 3);
    const m = S.marker, last = trailX(n - 1, n), mx = m <= n - 1 ? trailX(m, n) : last + (TR.x1 - 72 - last) * Math.min(1, m - n + 1);
    const moving = Math.abs(v.index - m) > 0.02, hop = moving ? Math.abs(Math.sin(t * 9)) * 7 : Math.abs(Math.sin(t * 2)) * 2;
    g.setTransform(-1, 0, 0, 1, mx, TR.y - 8 - hop);
    emoji(g, '🏇', 0, 0, 34);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function kindOf(v) {
    if (v.phase === 'WORDS') return 'word';
    if (v.target.math) return 'math';
    if (v.phase === 'NUMBERS' || v.target.count !== undefined) return 'number';
    return 'letter';
  }
  // The card body is cached per item state; only the pulsing parts draw live.
  function buildCard(q, c, T, kind, wp) {
    q.drawImage(cardSpr(), 0, 0);
    q.translate(CARD.w / 2 + 18, CARD.h / 2 + 18);
    const ink = '#3b1f0a', col = T.color || '#e63946';
    c.dyn = {};
    if (kind === 'letter') {
      otext(q, T.text, -58, -8, 92, col, { lw: 12 });
      emoji(q, T.icon, 128, -14, 62);
      otext(q, T.sub, 128, 42, 26, ink, { lw: 0, shadow: false });
    } else if (kind === 'word') {
      const L = T.text.split(''), sp = 74, x0 = -60 - (L.length - 1) * sp / 2;
      L.forEach((ch, i) => {
        const x = x0 + i * sp;
        if (i === wp) c.dyn.cur = { x, ch };
        else if (i < wp) otext(q, ch, x, 2, 70, '#ffd23a', { lw: 10 });
        else otext(q, ch, x, 2, 70, '#e8d6b0', { lw: 9, stroke: '#6b4a2a', shadow: false });
      });
      emoji(q, T.icon, 146, 0, 70);
    } else if (kind === 'number') {
      otext(q, T.text, -128, 0, 104, col, { lw: 13 });
      const n = T.count || 0, per = n > 5 ? Math.ceil(n / 2) : n, rows = n > 5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / per), k = i % per, rowN = r === rows - 1 ? n - per * (rows - 1) : per;
        dot(q, 70 + (k - (rowN - 1) / 2) * 34, (rows === 2 ? -30 + r * 34 : -14), 13, col);
      }
      if (!n) { q.beginPath(); q.arc(70, -14, 22, 0, 6.2832); q.setLineDash([6, 6]); q.lineWidth = 4; q.strokeStyle = '#8a6a40'; q.stroke(); q.setLineDash([]); }
      otext(q, T.sub, 70, 44, 26, ink, { lw: 0, shadow: false });
    } else {
      const M = T.math, parts = [String(M.a), ' ' + (M.op === '-' ? '−' : '+') + ' ', String(M.b), ' = ', '?'];
      font(q, 64); const ws = parts.map(s => q.measureText(s).width), tot = ws.reduce((a, b) => a + b, 0);
      let x = -tot / 2; const xs = [];
      parts.forEach((s, i) => { xs.push(x + ws[i] / 2); x += ws[i]; });
      parts.forEach((s, i) => { if (i < 4) otext(q, s.trim(), xs[i], -22, 64, i === 0 ? '#ff5d6c' : i === 2 ? '#4aa3ff' : '#fff3c4', { lw: 10 }); });
      c.dyn.q = xs[4];
      const group = (n, gx, color, crossFrom) => {
        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / 3), k = i % 3, rowN = Math.min(3, n - r * 3);
          const px = gx + (k - (rowN - 1) / 2) * 19, py = 26 + r * 19, crossed = i >= crossFrom;
          q.globalAlpha = crossed ? 0.45 : 1; dot(q, px, py, 7.5, color); q.globalAlpha = 1;
          if (crossed) { q.strokeStyle = '#1e0f05'; q.lineWidth = 3; q.beginPath(); q.moveTo(px - 7, py - 7); q.lineTo(px + 7, py + 7); q.moveTo(px + 7, py - 7); q.lineTo(px - 7, py + 7); q.stroke(); }
        }
      };
      if (M.op === '-') group(M.a, xs[0], '#ff5d6c', M.a - M.b); // take away: cross out the last b dots of a
      else { group(M.a, xs[0], '#ff5d6c', 99); group(M.b, xs[2], '#4aa3ff', 99); }
    }
  }
  function drawCard(g, t, v) {
    const T = v.target; if (!T) return;
    const kind = kindOf(v), wp = v.wordProgress || 0;
    const c = sprite(`card|${kind}|${T.text}|${T.icon}|${T.sub}|${T.color}|${wp}`, CARD.w + 36, CARD.h + 36, (q, cv) => buildCard(q, cv, T, kind, wp));
    const k = (t - S.cardT) / 0.6, sc = k < 1 ? 0.2 + 0.8 * easeOutElastic(k) : 1;
    const cx = CARD.x + CARD.w / 2, cy = CARD.y + CARD.h / 2;
    g.globalAlpha = clamp(k * 4, 0, 1);
    g.setTransform(sc, 0, 0, sc, cx, cy);
    g.drawImage(c, -CARD.w / 2 - 18, -CARD.h / 2 - 18);
    const d = c.dyn || {};
    if (d.cur) {
      const p = 1 + 0.07 * Math.sin(t * 4), pk = (t - S.letterT) < 0.6 ? easeOutBack((t - S.letterT) / 0.6) : 1, s = sc * p * pk;
      g.setTransform(s, 0, 0, s, cx + d.cur.x * sc, cy + 2 * sc);
      g.drawImage(glowSpr('rgba(255,215,90,0.95)'), -60, -60, 120, 120);
      g.drawImage(sprite('wl|' + d.cur.ch + (T.color || ''), 90, 104, q => {
        q.translate(45, 52); rr(q, -33, -41, 66, 82, 14); q.fillStyle = '#1e0f05'; q.fill();
        rr(q, -30, -38, 60, 76, 12); q.fillStyle = darken(T.color || '#e63946', 0.4); q.fill(); q.lineWidth = 3; q.strokeStyle = '#ffd84a'; q.stroke();
        otext(q, d.cur.ch, 0, 2, 76, '#ffffff', { lw: 10 });
      }), -45, -52);
    }
    if (d.q !== undefined) {
      const s = sc * (1 + 0.1 * Math.sin(t * 4));
      g.setTransform(s, 0, 0, s, cx + d.q * sc, cy - 22 * sc);
      g.drawImage(sprite('qmark', 80, 90, q => otext(q, '?', 40, 45, 68, '#ffd23a', { lw: 10 })), -40, -45);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }
  function cornerSpr(id, muted) {
    return sprite('corner|' + id + muted, 84, 84, q => {
      q.translate(42, 42);
      q.beginPath(); q.arc(0, 0, 34, 0, 6.2832); q.fillStyle = 'rgba(25,10,40,0.6)'; q.fill();
      q.lineWidth = 3; q.strokeStyle = 'rgba(255,215,110,0.9)'; q.stroke();
      if (id === 'home') castleIcon(q, 0, 2, 0.95, '#ffd86a');
      else {
        bellIcon(q, 0, 2, 0.95, muted ? '#b0a080' : '#ffd86a');
        if (muted) {
          q.lineCap = 'round'; q.strokeStyle = '#1e0f05'; q.lineWidth = 9; q.beginPath(); q.moveTo(-22, -22); q.lineTo(22, 22); q.stroke();
          q.strokeStyle = '#ff5d6c'; q.lineWidth = 5; q.stroke();
        }
      }
    });
  }
  function drawCorner(g, t, v) {
    [HOME, MUTE].forEach(b => {
      const s = pressScale(b.id, t) * (hovered(b) ? 1.08 : 1);
      g.globalAlpha = hovered(b) ? 0.95 : 0.72;
      g.setTransform(s, 0, 0, s, b.x + b.w / 2, b.y + b.h / 2);
      g.drawImage(cornerSpr(b.id, b.id === 'mute' && !!v.muted), -42, -42);
      if (v.armed && v.armed[b.id]) { // first tap arms the button; show "tap again"
        g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = `rgba(255,216,74,${0.6 + 0.4 * Math.sin(t * 8)})`;
        g.beginPath(); g.arc(0, 0, 46, 0, 6.2832); g.stroke();
        g.setTransform(1, 0, 0, 1, 0, 0);
        otext(g, 'tap again', b.x + b.w / 2, b.y + b.h + 20, 20, '#fff3c4', { lw: 5 });
      }
    });
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }
  function drawChoices(g, t, v) {
    if (v.mode !== 'learn' || !v.choices) return;
    choiceRects(v.choices).forEach((b, i) => {
      const k = easeOutBack((t - S.chT - i * 0.07) / 0.5); if (k <= 0) return;
      const right = v.hint >= 1 && b.c.text === v.expected, col = b.c.color || '#2471a3';
      const bounce = right ? -Math.abs(Math.sin(t * 3.4)) * 16 : Math.sin(t * 2 + i) * 3;
      const cx = b.x + b.w / 2, cy = b.y + 86 + bounce;
      if (right) { g.globalAlpha = 0.75 + 0.25 * Math.sin(t * 5); g.drawImage(glowSpr('rgba(255,220,90,1)'), cx - 160, cy - 160, 320, 320); g.globalAlpha = 1; }
      const sc = k * (hovered(b) ? 1.07 : 1) * pressScale(b.id, t) * (right ? 1.08 : 1);
      g.setTransform(sc, 0, 0, sc, cx, cy);
      g.drawImage(sprite('gem|' + col + '|' + b.c.text, 190, 190, q => { q.drawImage(gemSpr(col), 0, 0); otext(q, b.c.text, 95, 96, 104, '#ffffff', { lw: 13 }); }), -95, -92);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  }
  const KEY = 30, KGAP = 4, KX = 16, KY = 66;
  const keyRows = digits => (digits ? ['1234567890'] : ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']);
  function drawKeys(g, t, v) {
    if (v.hint < 2 || v.state !== 'MEET' || !v.expected) return;
    const digits = v.phase === 'NUMBERS' || v.phase === 'MATH', rows = keyRows(digits);
    const pw = 10 * (KEY + KGAP) + 20, ph = rows.length * (KEY + KGAP) + 50;
    g.globalAlpha = 0.92;
    g.drawImage(sprite('keys' + digits, pw + 4, ph + 4, q => {
      q.translate(2, 2); rr(q, 0, 0, pw, ph, 14); q.fillStyle = 'rgba(25,10,40,0.78)'; q.fill();
      q.lineWidth = 2.5; q.strokeStyle = 'rgba(255,215,110,0.9)'; q.stroke();
      otext(q, '⌨  Press this key', pw / 2, 18, 17, '#f3e2b0', { lw: 0, shadow: false });
      rows.forEach((row, r) => row.split('').forEach((ch, c) => {
        const x = 10 + r * (KEY + KGAP) * 0.5 + c * (KEY + KGAP), y = 36 + r * (KEY + KGAP);
        rr(q, x, y, KEY, KEY, 6); q.fillStyle = '#3a2a4c'; q.fill(); q.lineWidth = 1.5; q.strokeStyle = '#8a7aa0'; q.stroke();
        otext(q, ch, x + KEY / 2, y + KEY / 2 + 1, 16, '#d8cfe6', { lw: 0, shadow: false });
      }));
    }), KX - 2, KY - 2);
    g.globalAlpha = 1;
    rows.forEach((row, r) => {
      const c = row.indexOf(v.expected); if (c < 0) return;
      const x = KX + 10 + r * (KEY + KGAP) * 0.5 + c * (KEY + KGAP) + KEY / 2, y = KY + 36 + r * (KEY + KGAP) + KEY / 2;
      const p = 0.5 + 0.5 * Math.sin(t * 5), s = 1 + 0.2 * p;
      g.globalAlpha = 0.6 + 0.4 * p; g.drawImage(glowSpr('rgba(255,215,90,1)'), x - 42, y - 42, 84, 84); g.globalAlpha = 1;
      g.setTransform(s, 0, 0, s, x, y);
      g.drawImage(sprite('key|' + v.expected, 40, 40, q => {
        rr(q, 5, 5, KEY, KEY, 6); q.fillStyle = '#ffd84a'; q.fill(); q.lineWidth = 2.5; q.strokeStyle = '#1e0f05'; q.stroke();
        otext(q, v.expected, 20, 21, 20, '#1e0f05', { lw: 0, shadow: false });
      }), -20, -20);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  }
  function drawAttract(g, t, v) {
    if (v.mode !== 'easy' || v.state !== 'MEET') return;
    const idle = t - Math.max(S.meetT, S.actT); if (idle < 4) return;
    const a = clamp((idle - 4) / 0.8, 0, 1) * 0.9, tap = Math.abs(Math.sin(t * 2.6));
    g.globalAlpha = a;
    g.drawImage(sprite('attract', 230, 94, q => {
      rr(q, 5, 5, 220, 84, 42); q.fillStyle = 'rgba(25,10,40,0.6)'; q.fill();
      q.lineWidth = 3; q.strokeStyle = 'rgba(255,215,110,0.85)'; q.stroke();
      otext(q, 'Tap!', 143, 47, 46, '#fff3c4', { lw: 8 });
    }), 525, 599);
    emoji(g, '👆', 578, 646 - tap * 12, 52);
    g.globalAlpha = 1;
  }

  // ── Banners ────────────────────────────────────────────────────────────────
  function drawIntro(g, t, v) {
    const e = t - S.screenT, p = v.phase || 'LETTERS', P = PH[p];
    const out = clamp((2.8 - e) / 0.35, 0, 1);
    g.globalAlpha = 0.8 * clamp(e / 0.3, 0, 1) * out; g.drawImage(shade(), 0, 0);
    g.globalAlpha = out;
    const drop = easeOutBack(e / 0.5), cy = -260 + (350 + 260) * drop, cx = 640;
    const u = easeOutCubic((e - 0.35) / 0.65), sw = 40 + 640 * u, sh = 330;
    if (e > 1.0 && !S.introBurst) { S.introBurst = true; burst(cx, cy, 40, 700, ['star', 'spark', 'star']); }
    g.save();
    g.beginPath(); g.rect(cx - sw / 2, cy - sh / 2 - 30, sw, sh + 60); g.clip();
    g.drawImage(sprite('intro' + p, 716, 366, q => {
      q.drawImage(scrollSpr(), 0, 0);
      drawPhasePic(q, p, 358, 183 - 44, 1.35);
      otext(q, P.name, 358, 183 + 118, 66, P.c1, { lw: 11 });
    }), cx - 358, cy - sh / 2 - 18);
    g.restore();
    const roller = sprite('roller', 60, sh + 80, q => {
      const x = 30, q2 = q.createLinearGradient(x - 20, 0, x + 20, 0);
      q2.addColorStop(0, '#5a3210'); q2.addColorStop(0.45, '#c08040'); q2.addColorStop(1, '#4a280c');
      rr(q, x - 20, 16, 40, sh + 48, 16); q.fillStyle = q2; q.fill(); q.lineWidth = 3; q.strokeStyle = '#1e0f05'; q.stroke();
      [10 + 16 - 6 + 0, sh + 60].forEach(yy => { rr(q, x - 26, yy - 12, 52, 24, 10); q.fillStyle = goldGrad(q, yy - 12, yy + 12); q.fill(); q.stroke(); });
    });
    [-1, 1].forEach(s => g.drawImage(roller, cx + s * (sw / 2 + 6) - 30, cy - sh / 2 - 40));
    const rb = clamp((e - 0.8) / 0.4, 0, 1);
    if (rb > 0) {
      const qn = PHASES.indexOf(p) + 1, s = easeOutBack(rb);
      g.setTransform(s, 0, 0, s, cx, cy - sh / 2 - 26);
      g.drawImage(sprite('qrib' + p, 420, 110, q => {
        drawRibbon(q, 210, 50, 300, 50, P.c1, P.c2);
        otext(q, 'Quest ' + qn + ' of 4', 210, 47, 30, '#fff3c4', { lw: 6 });
      }), -210, -50);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    g.globalAlpha = 1;
  }
  const hooray = () => once('hooray', () => 'Hooray!'.split('').map(ch => buildGoldText(ch, 120)));
  function drawDone(g, t, v) {
    const e = t - S.screenT, p = v.phase || 'LETTERS', P = PH[p];
    g.globalAlpha = 0.75 * clamp(e / 0.4, 0, 1); g.drawImage(shade(), 0, 0); g.globalAlpha = 1;
    if (e < 4 && t > S.nextFx) { S.nextFx = t + 0.75; burst(200 + Math.random() * 880, 150 + Math.random() * 250, 22, 520, ['star', 'spark']); }
    if (Math.random() < (e < 4 ? 0.6 : 0.2)) confetti(1);
    // rays + medallion
    const mk2 = easeOutElastic((e - 0.25) / 0.9), my = 350;
    if (mk2 > 0) {
      g.globalAlpha = 0.55 * clamp(e - 0.25, 0, 1); g.setTransform(Math.cos(t * 0.25) * 0.55, Math.sin(t * 0.25) * 0.55, -Math.sin(t * 0.25) * 0.55, Math.cos(t * 0.25) * 0.55, 640, my);
      g.drawImage(rays(), -500, -500); g.globalAlpha = 1;
      g.setTransform(mk2, 0, 0, mk2, 640, my + Math.sin(t * 1.5) * 5);
      g.drawImage(sprite('medal' + p, 270, 270, q => {
        q.translate(135, 135);
        q.beginPath(); q.arc(0, 0, 128, 0, 6.2832); q.fillStyle = '#1a0a02'; q.fill();
        q.beginPath(); q.arc(0, 0, 124, 0, 6.2832); q.fillStyle = goldGrad(q, -124, 124); q.fill();
        for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; dot(q, Math.cos(a) * 115, Math.sin(a) * 115, 4, '#fff3b8'); }
        const r = q.createRadialGradient(-30, -40, 5, 0, 0, 110); r.addColorStop(0, P.c1); r.addColorStop(1, P.c2);
        q.beginPath(); q.arc(0, 0, 104, 0, 6.2832); q.fillStyle = r; q.fill(); q.lineWidth = 3; q.strokeStyle = '#1a0a02'; q.stroke();
        drawPhasePic(q, p, 0, 0, 1.05);
      }), -135, -135);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    // Hooray banner with bouncing letters
    const bk = easeOutBack(e / 0.6);
    g.setTransform(bk, 0, 0, bk, 640, 132);
    g.drawImage(sprite('hrib' + p, 780, 170, q => drawRibbon(q, 390, 75, 560, 96, P.c1, P.c2)), -390, -65);
    const H2 = hooray(), pad = 54, adv = c => c.w - pad * 2 + 4; let tw = 0; H2.forEach(c => tw += adv(c));
    let x = -tw / 2;
    H2.forEach((c, i) => {
      const y = -Math.abs(Math.sin(t * 3 - i * 0.45)) * 16;
      g.drawImage(c.c, x - pad, y - c.h / 2); x += adv(c);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawBigButton(g, t, NEXT, 'Next', '#2fbf78', '#0a4528', clamp((e - 0.9) / 0.5, 0, 1));
    drawCorner(g, t, v);
  }
  function drawBigButton(g, t, b, label, c1, c2, a) {
    if (a <= 0) return;
    const k = easeOutBack(a), s = k * pressScale(b.id, t) * (hovered(b) ? 1.06 : 1) * (1 + 0.035 * Math.sin(t * 3)), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    g.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3); g.drawImage(glowSpr('rgba(255,210,90,0.95)'), cx - 230, cy - 120, 460, 240); g.globalAlpha = 1;
    g.setTransform(s, 0, 0, s, cx, cy);
    g.drawImage(sprite('btn' + b.id, b.w + 12, b.h + 12, g => {
      g.translate(b.w / 2 + 6, b.h / 2 + 6);
      rr(g, -b.w / 2 - 4, -b.h / 2 - 4, b.w + 8, b.h + 8, 34); g.fillStyle = '#1a0a02'; g.fill();
      rr(g, -b.w / 2, -b.h / 2, b.w, b.h, 30); g.fillStyle = goldGrad(g, -b.h / 2, b.h / 2); g.fill();
      const q = g.createLinearGradient(0, -b.h / 2, 0, b.h / 2); q.addColorStop(0, c1); q.addColorStop(1, c2);
      rr(g, -b.w / 2 + 8, -b.h / 2 + 8, b.w - 16, b.h - 16, 24); g.fillStyle = q; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, -b.w / 2 + 14, -b.h / 2 + 12, b.w - 28, b.h * 0.36, 18); g.fill();
      otext(g, label, -34, 2, 58, '#fff6d8', { lw: 9 });
    }), -b.w / 2 - 6, -b.h / 2 - 6);
    arrow(g, 92 + Math.sin(t * 4) * 6, 2, 1.25, '#ffd84a');
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  const knightText = () => once('knight', () => buildGoldText('You are a true Knight!', 80, 1100));
  function drawVictory(g, t, v) {
    const e = t - S.screenT;
    g.globalAlpha = 0.7 * clamp(e / 0.5, 0, 1); g.drawImage(shade(), 0, 0); g.globalAlpha = 1;
    if (Math.random() < 0.7) confetti(1);
    if (t > S.nextFx) { S.nextFx = t + 1.1; burst(160 + Math.random() * 960, 120 + Math.random() * 300, 20, 500, ['star', 'spark']); }
    const cy = 205, r = t * 0.3, ck = easeOutElastic((e - 0.2) / 1.0);
    g.globalAlpha = 0.7 * clamp(e / 0.8, 0, 1);
    g.setTransform(Math.cos(r) * 0.8, Math.sin(r) * 0.8, -Math.sin(r) * 0.8, Math.cos(r) * 0.8, 640, cy);
    g.drawImage(rays(), -500, -500);
    g.setTransform(Math.cos(-r * 0.7) * 0.5, Math.sin(-r * 0.7) * 0.5, -Math.sin(-r * 0.7) * 0.5, Math.cos(-r * 0.7) * 0.5, 640, cy);
    g.drawImage(rays(), -500, -500);
    g.globalAlpha = 1;
    if (ck > 0) {
      g.setTransform(ck, 0, 0, ck, 640, cy + Math.sin(t * 1.6) * 7);
      g.drawImage(glowSpr('rgba(255,225,120,0.9)'), -170, -150, 340, 300);
      g.drawImage(sprite('crown', 280, 220, q => drawCrown(q, 140, 110, 230)), -140, -110);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.6 + i / 6) % 1, a = Math.sin(ph * Math.PI), an = i * 1.05 + 0.3;
      g.globalAlpha = a; g.globalCompositeOperation = 'lighter';
      const sz = 26 + a * 34; g.drawImage(sparkSpr(), 640 + Math.cos(an) * 170 - sz / 2, cy + Math.sin(an) * 110 - sz / 2, sz, sz);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const K = knightText(), tk = easeOutBack((e - 0.5) / 0.6);
    if (tk > 0) { g.setTransform(tk, 0, 0, tk, 640, 408 + Math.sin(t * 1.2) * 4); g.drawImage(K.c, -K.w / 2, -K.h / 2); g.setTransform(1, 0, 0, 1, 0, 0); }
    const a = clamp((e - 1.2) / 0.5, 0, 1); if (a <= 0) return;
    const b = AGAIN, s = easeOutBack(a) * pressScale(b.id, t) * (hovered(b) ? 1.06 : 1) * (1 + 0.03 * Math.sin(t * 3)), cx = b.x + b.w / 2, sy = b.y;
    g.globalAlpha = 0.4 + 0.2 * Math.sin(t * 3); g.drawImage(glowSpr('rgba(255,210,90,0.95)'), cx - 220, sy - 40, 440, 230); g.globalAlpha = 1;
    g.setTransform(s, 0, 0, s, cx, sy + b.h / 2);
    g.drawImage(sprite('again', b.w + 40, b.h + 40, q => {
      q.translate(b.w / 2 + 20, b.h / 2 + 20);
      drawShield(q, -b.w / 2, -b.h / 2, b.w, b.h, '#e0405a', '#6e0c20', { pattern: true, blur: 14, sy: 6, rim: 9 });
      castleIcon(q, -104, -26, 0.8, '#ffd86a');
      otext(q, 'Play again', 26, -26, 42, '#fff6d8', { lw: 8 });
    }), -b.w / 2 - 20, -b.h / 2 - 20);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function draw(g, t, v) {
    if (!v) return;
    const dt = clamp(t - S.lastT, 0, 0.1); S.lastT = t;
    if (v.screen !== S.screen) {
      S.screen = v.screen; S.screenT = t; S.introBurst = false; S.nextFx = t + 0.2;
      if (v.screen === 'phaseDone') { burst(640, 330, 60, 900, ['star', 'spark', 'star']); confetti(60); }
      if (v.screen === 'victory') { burst(640, 210, 80, 1000, ['star', 'spark', 'star']); confetti(90); }
      if (v.screen === 'menu' || v.screen === 'title') S.parts.length = 0;
    }
    if (v.state !== S.state) { if (v.state === 'MEET') S.meetT = t; S.state = v.state; }
    g.save();
    g.lineCap = 'butt';
    if (v.screen === 'title') drawTitle(g, t);
    else if (v.screen === 'menu') drawMenu(g, t, v);
    else if (v.screen === 'phaseIntro') drawIntro(g, t, v);
    else if (v.screen === 'play') {
      trackPlay(t, v);
      drawTrail(g, t, v, dt);
      drawCard(g, t, v);
      drawKeys(g, t, v);
      drawChoices(g, t, v);
      drawAttract(g, t, v);
      drawCorner(g, t, v);
    } else if (v.screen === 'phaseDone') drawDone(g, t, v);
    else if (v.screen === 'victory') drawVictory(g, t, v);
    drawParts(g, dt);
    g.restore();
  }

  function hit(x, y, v) {
    if (!v) return null;
    S.actT = S.lastT;
    if (v.screen === 'title') { S.press = 'title'; S.pressT = S.lastT; return { type: 'start' }; }
    for (const b of buttons(v)) {
      if (inside(b, x, y)) { S.press = b.id; S.pressT = S.lastT; return Object.assign({}, b.act); }
    }
    return null;
  }

  AK.ui = { draw, hit };
})();
