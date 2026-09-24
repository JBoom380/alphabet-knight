// ─── HANDS: first-person torch (left) and sword (right), pixel art ───────────
(function () {
  window.AK = window.AK || {};
  const W = 480, H = 270, DEG = Math.PI / 180;
  const HM = AK.hands = { flicker: 0.8 };

  // ── Colour + pixel helpers (init time) ─────────────────────────────────────
  const hex = h => { const n = parseInt(h.slice(1), 16); return ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };
  const ramp = a => a.map(hex);
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (B4[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mod = (a, n) => ((a % n) + n) % n;
  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  const lit = (nx, ny, nz, L) => Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
  const hsh = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // Ramp lookup: hard pixel-art bands, ordered dither only in a narrow strip at each band edge.
  function tone(r, l, x, y) {
    const f = clamp(l, 0, 1) * (r.length - 1); let i = f | 0;
    if (((f - i) - 0.5) * 9 + 0.5 > bay(x, y)) i++;
    return r[Math.min(i, r.length - 1)];
  }
  const toneH = (r, l) => r[Math.round(clamp(l, 0, 1) * (r.length - 1))];   // hard bands (skin)

  const SKIN = ramp(['#5e2a1c', '#9a4c34', '#cf7d52', '#eea877', '#ffd3a4']);
  const LEATH = ramp(['#3a1d0c', '#643616', '#8f5226', '#b8763c', '#d99b5c']);
  const STRAP = ramp(['#2a140a', '#4c2812', '#74401e', '#9a5c2e']);
  const TAN = ramp(['#4a2a12', '#7e5028', '#b0804a', '#d8ac6c', '#f0d096']);
  const BRASS = ramp(['#5e340a', '#a06a18', '#d6a632', '#ffdc72', '#fff6c8']);
  const CLOTH = ramp(['#141c46', '#223780', '#3254b4', '#5580dc']);
  const WOOD = ramp(['#2e160a', '#502a14', '#76421e', '#9a5e30']);
  const IRON = ramp(['#22242e', '#454a5a', '#767d90', '#b0b7c6', '#e2e6f0']);
  const CHAR = ramp(['#1a100a', '#2e1f16', '#4a3222', '#654630']);
  const EMBR = ramp(['#5a1406', '#a02c0a', '#e05a16', '#ff9a28', '#ffd060']);
  const GRIP = ramp(['#2a1308', '#4a2812', '#744020', '#a0643a']);
  const GEM = ramp(['#10286a', '#2466cc', '#5ec8ff', '#e6fbff']);
  const ST = ramp(['#1e2436', '#4e5a74', '#7a8aa4', '#a6b6cc', '#dce6f2', '#ffffff']);
  const O_SKIN = hex('#3a160e'), O_LEATH = hex('#26120a'), O_STEEL = hex('#151a28'), O_BRASS = hex('#2e1804'), O_WOOD = hex('#22120a'), O_CHAR = hex('#0e0806');

  // ── Painter: layered shapes with automatic 1 px outlines ──────────────────
  // T = affine map from pixel centre to layer coords: u = T0*x + T1*y + T2, v = T3*x + T4*y + T5. Pixels with |v| >= vmax are skipped.
  function paint(w, h, T, layers, vmax) {
    const n = w * h, d = new Uint32Array(n), m = new Uint8Array(n), U = new Float64Array(n), V = new Float64Array(n), ok = new Uint8Array(n);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      const px = x + 0.5, py = y + 0.5, v = T[3] * px + T[4] * py + T[5];
      U[i] = T[0] * px + T[1] * py + T[2]; V[i] = v; ok[i] = v > -vmax && v < vmax ? 1 : 0;
    }
    const out = [];
    layers.forEach((L, li) => {
      const id = li + 1, f = L[0];
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) { if (!ok[i]) continue; const c = f(U[i], V[i], x, y); if (c) { d[i] = c; m[i] = id; } }
      if (!L[1]) return;
      out.length = 0;
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
        if (m[i] === id) continue;
        if ((x > 0 && m[i - 1] === id) || (x < w - 1 && m[i + 1] === id) || (y > 0 && m[i - w] === id) || (y < h - 1 && m[i + w] === id)) out.push(i);
      }
      for (const i of out) { d[i] = L[1]; m[i] = id; }
    });
    return { d, w, h };
  }
  function toCanvas(p) {
    const cv = document.createElement('canvas'); cv.width = p.w; cv.height = p.h;
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.d.buffer), p.w, p.h), 0, 0);
    return cv;
  }

  // Capsule test: sets the 3D-ish normal (CNX, CNY, CNZ), the length along (CA) and the cross fraction (CS).
  let CA = 0, CS = 0, CNX = 0, CNY = 0, CNZ = 1;
  function cyl(x, y, ax, ay, bx, by, r0, r1) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const px = x - ax, py = y - ay, a = px * ux + py * uy, t = clamp(a / len, 0, 1);
    const r = r0 + (r1 - r0) * t, cx = ax + ux * len * t, cy = ay + uy * len * t;
    const ex = x - cx, ey = y - cy, dd = ex * ex + ey * ey;
    if (dd > r * r) return false;
    CA = a; CS = (px * -uy + py * ux) / r;
    CNX = ex / r; CNY = ey / r; CNZ = Math.sqrt(Math.max(0, 1 - CNX * CNX - CNY * CNY));
    return true;
  }

  // ── Arms (built once; local origin = centre of the fist) ──────────────────
  const LA = norm3(-0.5, -0.62, 0.6);
  function forearm(xm, Y, x, y, torch) {
    if (!cyl(xm, Y, 13, 4, 13 + 0.6 * 170, 4 + 0.8 * 170, 11, 24)) return 0;
    const a = CA; let l = 0.1 + 0.9 * lit(CNX, CNY, CNZ, LA);
    if (a < 13) return toneH(SKIN, l);
    if (a < 72) {
      const rim = a < 16.5 || a > 68.5;
      if (rim) l += 0.14;
      if ((a > 16.5 && a < 17.6) || (a > 67.4 && a < 68.5)) l -= 0.32;
      if (!torch) {
        const s1 = a > 27 && a < 33, s2 = a > 52 && a < 58;
        if (s1 || s2) {
          if (CS > -0.66 && CS < -0.12) {                       // brass buckle
            const inner = CS > -0.5 && CS < -0.28 && ((s1 && a > 28.6 && a < 31.4) || (s2 && a > 53.6 && a < 56.4));
            return inner ? tone(STRAP, l * 0.6, x, y) : tone(BRASS, l + 0.1, x, y);
          }
          return tone(STRAP, l + (a < 28 || (a > 52 && a < 53) ? -0.2 : 0.05), x, y);
        }
        if (!rim && CS > -0.85 && CS < 0.85) {                   // tooled diamond pattern
          const g1 = mod(a * 0.2 + CS * 2.4, 1), g2 = mod(a * 0.2 - CS * 2.4, 1);
          if (g1 < 0.11 || g2 < 0.11) l -= 0.24; else if (g1 < 0.2 || g2 < 0.2) l += 0.08;
        }
      } else {
        const lace = mod(a + CS * 7, 9), lace2 = mod(a - CS * 7, 9);   // criss-cross lacing
        if (CS > -0.45 && CS < 0.45 && (lace < 1.6 || lace2 < 1.6)) return tone(BRASS, l * 0.7 + 0.15, x, y);
        if (Math.abs(CS) > 0.45 && Math.abs(CS) < 0.58) l -= 0.25;
      }
      if ((Math.abs(a - 19.5) < 0.6 || Math.abs(a - 65.5) < 0.6) && ((x + y) & 1)) l += 0.22;   // stitches
      return tone(LEATH, l, x, y);
    }
    if (a < 77) return tone(BRASS, l, x, y);
    return tone(CLOTH, l + Math.sin(a * 0.2 + CS * 2.6) * 0.14, x, y);
  }
  function backOfHand(xm, Y, x, y) {
    if (xm < -9 || xm > 19 || Y < -12 || Y > 14) return 0;
    const nx = (xm - 5) / 12.5, ny = (Y - 1) / 11.5, q = nx * nx + ny * ny;
    if (q > 1) return 0;
    let l = 0.12 + 0.88 * lit(nx, ny, Math.sqrt(1 - q), LA);
    if (Math.abs(xm - 1) < 0.9 && Y > -7 && Y < 9 && ((Y + 40) % 5 < 1.2)) l -= 0.2;   // knuckle creases
    return toneH(SKIN, l);
  }
  function finger(k) {
    const yk = -7.2 + k * 4.9;
    return (xm, Y, x, y) => {
      if (xm < -16 || xm > 9 || Y < yk - 5 || Y > yk + 6) return 0;
      if (!cyl(xm, Y, -10.5 + k * 0.6, yk, 4, yk + 0.6, 3.7, 3.9)) return 0;
      let l = 0.14 + 0.86 * lit(CNX, CNY, CNZ, LA);
      if (CA < 1.2) l += 0.06;
      return toneH(SKIN, l);
    };
  }
  function thumb(xm, Y, x, y) {
    if (xm < -12 || xm > 16 || Y < -17 || Y > -2) return 0;
    if (!cyl(xm, Y, 11, -7.5, -7, -11.2, 4.4, 3.7)) return 0;
    let l = 0.2 + 0.8 * lit(CNX, CNY, CNZ, LA);
    if (CA > 15 && CNY < -0.2) return toneH(SKIN, 0.95);   // thumbnail sheen
    return toneH(SKIN, l);
  }

  // ── Torch (left sprite coordinates, leaning 16° toward the centre) ────────
  const TA = 16 * DEG, TD = [Math.sin(TA), -Math.cos(TA)], TN = [Math.cos(TA), Math.sin(TA)];
  const LT = norm3(0.3, -0.55, 0.78), T_TOP = 86;
  function shaftFn(X, Y, x, y) {
    const u = X * TD[0] + Y * TD[1], v = X * TN[0] + Y * TN[1];
    if (u < -38 || u > 58) return 0;
    const band = (u > 22 && u < 26.5) || (u > 50.5 && u < 56);
    let r = 4.8 - 0.8 * (u + 38) / 96; if (band) r += 1;
    if (v < -r || v > r) return 0;
    const cs = v / r, nz = Math.sqrt(1 - cs * cs);
    const l = 0.12 + 0.88 * lit(cs * TN[0], cs * TN[1], nz, LT);
    if (band) {
      if (Math.abs(cs + 0.2) < 0.25 && Math.abs(u - (u < 40 ? 24.2 : 53.2)) < 0.8) return IRON[4];
      return tone(IRON, l, x, y);
    }
    const p1 = mod(u + cs * 7, 11), p2 = mod(u - cs * 7 + 5.5, 11);
    if (u < 49 && (p1 < 2.3 || p2 < 2.3)) return (p1 < 0.75 || p2 < 0.75) ? tone(STRAP, l * 0.5, x, y) : tone(TAN, l * 0.95 + 0.05, x, y);
    return tone(WOOD, l + (hsh(Math.round(u / 4), Math.round(cs * 2)) - 0.5) * 0.2, x, y);
  }
  function headFn(X, Y, x, y) {
    const u = X * TD[0] + Y * TD[1], v = X * TN[0] + Y * TN[1];
    if (u < 54 || u > T_TOP + 1) return 0;
    let r = 5.6 + 4.4 * Math.pow(clamp((u - 54) / 28, 0, 1), 0.55);
    if (u > 83) r *= Math.sqrt(Math.max(0, 1 - ((u - 83) / 4) ** 2)) * 0.25 + 0.75;
    if (v < -r || v > r) return 0;
    const cs = v / r, nz = Math.sqrt(1 - cs * cs);
    let l = 0.1 + 0.8 * lit(cs * TN[0], cs * TN[1], nz, LT);
    if (mod(u - 54 - cs * 3, 5) < 1.3) l -= 0.3;
    const hot = (u - 74) / 12;
    if (hot > 0 && hot + (bay(x, y) - 0.5) * 0.45 > 0.28) return tone(EMBR, clamp(hot * 1.1 + l * 0.35 - Math.abs(cs) * 0.3, 0, 1), x, y);
    if (u > 60 && hsh(x, y) < 0.035) return hsh(y, x) < 0.5 ? hex('#ff8a20') : hex('#ffc848');
    return tone(CHAR, l, x, y);
  }

  const HS = 1.45, TS = 1.2;   // hand scale, torch scale
  function buildArm(mir, torch) {
    const x0 = mir > 0 ? -40 : -128, x1 = mir > 0 ? 128 : 58, y0 = torch ? -Math.ceil((T_TOP + 3) * TS) : -34, y1 = 150;
    const layers = [], sc = f => (X, Y, x, y) => f(X * mir / HS, Y / HS, x, y);
    if (torch) layers.push([(X, Y, x, y) => shaftFn(X / TS, Y / TS, x, y), O_WOOD], [(X, Y, x, y) => headFn(X / TS, Y / TS, x, y), O_CHAR]);
    layers.push([sc((xm, Y, x, y) => forearm(xm, Y, x, y, torch)), O_LEATH]);
    layers.push([sc(backOfHand), O_SKIN]);
    for (let k = 3; k >= 0; k--) layers.push([sc(finger(k)), O_SKIN]);
    layers.push([sc(thumb), O_SKIN]);
    const cv = toCanvas(paint(x1 - x0, y1 - y0, [1, 0, x0, 0, 1, y0], layers, 1e9));
    return { cv, ox: -x0, oy: -y0 };
  }

  // ── Sword (local u = along the blade from the fist, v = across) ──────────
  const GS = 9, U0 = 17 + GS, UT = 162 + GS, UTIP = 190 + GS, PU = -27;   // GS: guard sits above the big fist
  const halfW = u => (u < UT ? 7 - 2 * (u - U0) / (UT - U0) : 5 * (UTIP - u) / (UTIP - UT));
  const LS = norm3(-0.55, 0.55, 0.63);  // (v, u, z): light from the upper left
  function gripFn(u, v, x, y) {
    if (u < PU - 9 || u > U0 - 5) return 0;
    const pd = Math.hypot(u - PU, v);
    if (pd < 6) return tone(BRASS, 0.1 + 0.9 * lit(v / 6, (u - PU) / 6, Math.sqrt(Math.max(0, 1 - pd * pd / 36)), LS) + (pd < 1.8 ? 0.25 : 0), x, y);
    const cd = Math.hypot(u - PU + 6.5, v);
    if (cd < 2.7) return tone(BRASS, 0.35 + 0.4 * (-v / 2.7), x, y);
    if (u > PU + 5 && u < PU + 8.5 && Math.abs(v) < 4.3) return tone(BRASS, 0.6 - v * 0.1 + (u > PU + 7.5 ? 0.2 : 0), x, y);
    if (u < PU + 5 || Math.abs(v) > 3.4) return 0;
    const cs = v / 3.4; let l = 0.15 + 0.85 * lit(cs, 0, Math.sqrt(1 - cs * cs), LS);
    if (mod(u + v * 0.9, 3.6) < 1.2) l -= 0.34;
    return tone(GRIP, l, x, y);
  }
  function bladeFn(u, v, x, y) {
    if (u < U0 - 1 || u > UTIP) return 0;
    const hw = halfW(Math.max(u, U0));
    if (v < -hw || v > hw) return 0;
    if (v < -hw + 1.3) return ST[5];
    if (v > hw - 1.3) return ST[1];
    if (u > UT - 2) return v < 0 ? ST[4] : ST[2];
    const streak = Math.abs(u - 104 - GS + v * 1.8) < 5 || Math.abs(u - 50 - GS + v * 1.8) < 2.4;
    if (u > U0 + 4 && u < U0 + 120) {
      if (Math.abs(v - 0.45) < 0.75) return streak ? ST[3] : ST[2];
      if (v < -0.3 && v > -1.35) return ST[5];
    }
    if (v < 0) return streak ? ST[4] : ST[3];
    return streak ? ST[3] : ST[2];
  }
  function guardFn(u, v, x, y) {
    u = 13 + (u - GS - 13) / 1.2; v /= 1.2;
    if (u < 4 || u > 24) return 0;
    const av = Math.abs(v), sg = v < 0 ? -1 : 1;
    const cu = u - 18, cv = av - 21.2, cd = Math.hypot(cu, cv);
    if (cd < 4.7 && cd > 2 && !(cu > 0.5 && cv < 0)) return tone(BRASS, 0.5 + 0.35 * (cu / cd) - 0.25 * (cv / cd) * sg * 0.5 - 0.15 * sg, x, y);
    if (cd <= 2 && cd > 0) return tone(BRASS, 0.2, x, y);
    const e = av / 21.2;
    const lug = Math.abs(u - 13.3) / 8.2 + av / 6.4 < 1;
    if (lug || (av < 21.2 && u > 10.6 + e * 0.9 && u < 15.9 - e * 0.9)) {
      const gd = (u - 13.6) * (u - 13.6) + v * v;
      if (gd < 7.5) return tone(GEM, clamp(0.9 - (u - 13.6 < 0 ? 0.35 : 0) - (v > 0 ? 0.25 : 0) + (gd < 1.2 && v < 0 ? 0.4 : 0), 0, 1), x, y);
      if (gd < 11) return tone(BRASS, 0.15, x, y);
      return tone(BRASS, clamp(0.25 + 0.6 * (u - 10.6) / 5.4 - 0.2 * v / 21, 0, 1), x, y);
    }
    return 0;
  }

  const A0 = -132, A1 = 18, AS = 2, NA = ((A1 - A0) / AS | 0) + 1;
  // Frames live in one atlas. Idle-range frames bake in init; the rest bake in small background chunks
  // (and on demand if a swing needs one first).
  const SF = [], SREADY = new Uint8Array(NA), bakeQ = [];
  let ATLAS = null, ACTX = null;
  function layoutSword() {
    const AW = 2048; let cx = 0, cy = 0, rowH = 0;
    for (let i = 0; i < NA; i++) {
      const a = (A0 + i * AS) * DEG, dx = Math.sin(a), dy = -Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const cu of [PU - 10, UTIP + 3]) for (const cv of [-30, 30]) {
        const px = cu * dx + cv * nx, py = cu * dy + cv * ny;
        mnx = Math.min(mnx, px); mxx = Math.max(mxx, px); mny = Math.min(mny, py); mxy = Math.max(mxy, py);
      }
      const ox = Math.ceil(-mnx) + 2, oy = Math.ceil(-mny) + 2, w = Math.ceil(mxx) + ox + 2, h = Math.ceil(mxy) + oy + 2;
      if (cx + w > AW) { cx = 0; cy += rowH; rowH = 0; }
      SF.push({ sx: cx, sy: cy, w, h, ox, oy, T: [dx, dy, -ox * dx - oy * dy, nx, ny, -ox * nx - oy * ny] });
      cx += w; rowH = Math.max(rowH, h);
    }
    ATLAS = document.createElement('canvas'); ATLAS.width = AW; ATLAS.height = cy + rowH;
    ACTX = ATLAS.getContext('2d');
  }
  function bakeFrame(i) {
    if (SREADY[i]) return;
    const f = SF[i], p = paint(f.w, f.h, f.T, [[gripFn, O_LEATH], [bladeFn, O_STEEL], [guardFn, O_BRASS]], 31);
    ACTX.putImageData(new ImageData(new Uint8ClampedArray(p.d.buffer), p.w, p.h), f.sx, f.sy);
    SREADY[i] = 1;
  }
  function bakeSome() {
    const t0 = performance.now();
    while (bakeQ.length && performance.now() - t0 < 5) bakeFrame(bakeQ.shift());
    if (bakeQ.length) setTimeout(bakeSome, 30);
  }
  function buildSword() {
    layoutSword();
    for (let i = 0; i < NA; i++) bakeQ.push(i);
    bakeQ.sort((p, q) => Math.abs(A0 + p * AS + 16) - Math.abs(A0 + q * AS + 16));
    for (let k = 0; k < 12; k++) bakeFrame(bakeQ.shift());   // -28° .. -4°: idle, ready, nudge
    setTimeout(bakeSome, 200);
  }

  // ── Small baked extras: glow halo, question mark ─────────────────────────
  let GLOW = null, QM = null, RARM = null, LARM = null;
  function buildGlow() {
    const R = 50, S = R * 2, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - R, (y + 0.5 - R) * 1.15) / R; if (d >= 1) continue;
      const k = (1 - d) * (1 - d);
      if (k * 1.3 > bay(x, y)) { g.fillStyle = d < 0.35 ? 'rgba(255,190,90,0.55)' : d < 0.65 ? 'rgba(255,140,50,0.42)' : 'rgba(240,90,30,0.32)'; g.fillRect(x, y, 1, 1); }
    }
    return cv;
  }
  function buildQM() {
    const rows = ['.####.', '##..##', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..', '..##..'];
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 12;
    const g = cv.getContext('2d'), on = (x, y) => rows[y] && rows[y][x] === '#';
    g.fillStyle = '#3a2208';
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= 6; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 6; x++) if (on(x, y)) { g.fillStyle = !on(x, y - 1) ? '#fff6c0' : on(x + 1, y) ? '#ffd23a' : '#e8a020'; g.fillRect(x + 1, y + 1, 1, 1); }
    return cv;
  }

  // ── Fire: smoothed cellular fire with a scrolling cooling map (flame tongues) ──
  const FW = 36, FH = 66, F = new Float32Array(FW * (FH + 2)), CH = 128, COOL = new Float32Array(FW * CH);
  const FPAL = new Uint32Array(40);
  let fireCv = null, fireCtx = null, fireImg = null, firePix = null, fireAcc = 0, fireSum = 0, fireAvg = 1, coolOff = 0;
  let seed = 0x9e3779b9 | 0;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  function buildFire() {
    const stops = [[0, 0], [3, '#5a1008'], [6, '#a81e0c'], [10, '#dc3c18'], [15, '#f8661c'], [21, '#ff9a26'], [27, '#ffc63c'], [32, '#ffe878'], [36, '#fffbe0']];
    for (let i = 0; i < 40; i++) { let c = 0; for (const s of stops) if (i >= s[0]) c = s[1]; FPAL[i] = c ? hex(c) : 0; }
    for (let i = 0; i < COOL.length; i++) COOL[i] = rnd();          // tileable blurred noise
    const tmp = new Float32Array(COOL.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < CH; y++) for (let x = 0; x < FW; x++) {
        const xl = (x + FW - 1) % FW, xr = (x + 1) % FW, yu = (y + CH - 1) % CH, yd = (y + 1) % CH;
        tmp[y * FW + x] = (COOL[y * FW + x] * 2 + COOL[y * FW + xl] + COOL[y * FW + xr] + COOL[yu * FW + x] + COOL[yd * FW + x]) / 6;
      }
      COOL.set(tmp);
    }
    let mn = 1, mx = 0; for (const v of COOL) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    for (let i = 0; i < COOL.length; i++) COOL[i] = Math.pow((COOL[i] - mn) / (mx - mn), 1.5);
  }
  function fireStep(boost, wind) {
    const cx = (FW - 1) / 2, hw = 10.5 + boost * 3;
    for (let r = FH; r < FH + 2; r++) for (let x = 0; x < FW; x++) {       // hot source rows below the visible grid
      const d = Math.abs(x - cx) / hw;
      F[r * FW + x] = d < 1 ? (1 - d * d * 0.45) * (1.05 + rnd() * 0.4) : 0;
    }
    coolOff = (coolOff + 1) % CH;
    const cs = 0.052 - boost * 0.02;
    let sum = 0;
    for (let y = 0; y < FH; y++) {
      const row = y * FW, below = row + FW, cr = ((y + coolOff) % CH) * FW, wx = Math.round(Math.sin(y * 0.28 - coolOff * 0.45) * 0.62 + (rnd() < wind ? 0.6 : 0));
      for (let x = 0; x < FW; x++) {
        const xs = clamp(x + wx, 0, FW - 1), xl = xs > 0 ? xs - 1 : 0, xr = xs < FW - 1 ? xs + 1 : xs;
        const e = Math.abs(x - cx) / cx;
        let v = (F[below + xl] + F[below + xs] * 2 + F[below + xr] + F[below + FW + xs]) * 0.2;
        v -= COOL[cr + x] * cs + e * e * 0.05;
        if (v < 0) v = 0;
        F[row + x] = v; sum += v;
      }
    }
    fireSum = sum;
  }
  function fireRender() {
    for (let i = 0, n = FW * FH; i < n; i++) { const k = (F[i] * 38) | 0; firePix[i] = FPAL[k > 39 ? 39 : k]; }
    fireCtx.putImageData(fireImg, 0, 0);
  }

  // ── Particles (preallocated pools) ────────────────────────────────────────
  const NE = 72, ex = new Float32Array(NE), ey = new Float32Array(NE), evx = new Float32Array(NE), evy = new Float32Array(NE), el = new Float32Array(NE), em = new Float32Array(NE), es = new Float32Array(NE);
  let eNext = 0, eAcc = 0;
  function ember(x, y, boost) {
    const i = eNext; eNext = (eNext + 1) % NE;
    ex[i] = x; ey[i] = y; evx[i] = (rnd() - 0.5) * 12; evy[i] = -(24 + rnd() * 30) * (1 + boost * 0.6);
    em[i] = el[i] = 0.7 + rnd() * 1.1; es[i] = rnd() * 6.28;
  }
  const NS = 110, sx = new Float32Array(NS), sy = new Float32Array(NS), svx = new Float32Array(NS), svy = new Float32Array(NS), sl = new Float32Array(NS), sm = new Float32Array(NS), sc = new Uint8Array(NS);
  const SCOL = ['#ffe066', '#ff8ad8', '#7ff0ff', '#ffffff', '#b7ff7a'];
  let sNext = 0;
  function star(x, y, vx, vy, life) {
    const i = sNext; sNext = (sNext + 1) % NS;
    sx[i] = x; sy[i] = y; svx[i] = vx; svy[i] = vy; sm[i] = sl[i] = life; sc[i] = (rnd() * SCOL.length) | 0;
  }
  function sparkle(ctx, x, y, r, col) {
    x |= 0; y |= 0;
    ctx.fillStyle = col; ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1);
    if (r >= 3) { ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
  }

  // ── Crisp polygon fill for the slash smear (scanline, integer rows) ───────
  const QX = new Float64Array(4), QY = new Float64Array(4);
  function quad(ctx) {
    let y0 = Math.min(QY[0], QY[1], QY[2], QY[3]), y1 = Math.max(QY[0], QY[1], QY[2], QY[3]);
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H, Math.ceil(y1));
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5; let mn = 1e9, mx = -1e9;
      for (let e = 0; e < 4; e++) {
        const ax = QX[e], ay = QY[e], bx = QX[(e + 1) & 3], by = QY[(e + 1) & 3];
        if ((yc - ay) * (yc - by) > 0 || ay === by) continue;
        const xx = ax + (yc - ay) * (bx - ax) / (by - ay);
        if (xx < mn) mn = xx; if (xx > mx) mx = xx;
      }
      if (mx > mn) { const a = Math.round(mn), b = Math.round(mx); if (b > a) ctx.fillRect(a, y, b - a, 1); }
    }
  }

  // ── Animation state ──────────────────────────────────────────────────────
  let lastT = -1, ph = 0, bRx = 402, bRy = 233, bRa = -18, bLx = 60, bLy = 205;
  let swT = -1, nuT = -1, chT = -1, chEnd = -9, clock = 0, flick = 0.8, glintT = 1.5;
  let swBx = 0, swBy = 0, swBa = 0, curRx = 402, curRy = 226, curRa = -18;
  let PX = 0, PY = 0, PA = 0;
  const ease = k => k * k * (3 - 2 * k);
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const easeBack = k => { const c = 1.9; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
  const SW_WIND = 0.06, SW_HIT = 0.22, SW_END = 0.45;
  const MX = 318, MY = 190, EX = 292, EY = 238, EA = -124, WA = 14;
  function sweepAt(k) {                 // k in [SW_WIND, SW_HIT]; the fast slash
    const s = clamp((k - SW_WIND) / (SW_HIT - SW_WIND), 0, 1), e = ease(s), i = 1 - e;
    const wx = swBx + 10, wy = swBy - 12;
    PX = i * i * wx + 2 * i * e * MX + e * e * EX;
    PY = i * i * wy + 2 * i * e * MY + e * e * EY;
    PA = WA + (EA - WA) * e;
  }
  function cheerK() {
    if (chT < 0) return 0;
    if (chT < 0.35) return easeBack(chT / 0.35);
    if (chT < 2.3) return 1;
    if (chT < 2.85) return 1 - ease((chT - 2.3) / 0.55);
    return 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  HM.init = function () {
    buildFire();
    fireCv = document.createElement('canvas'); fireCv.width = FW; fireCv.height = FH;
    fireCtx = fireCv.getContext('2d');
    fireImg = fireCtx.createImageData(FW, FH); firePix = new Uint32Array(fireImg.data.buffer);
    RARM = buildArm(1, false); LARM = buildArm(-1, true);
    buildSword(); GLOW = buildGlow(); QM = buildQM();
    for (let i = 0; i < 50; i++) fireStep(0, 0);
    fireAvg = fireSum || 1; fireRender();
  };

  HM.swing = function () {
    swT = 0; swBx = curRx; swBy = curRy; swBa = curRa; nuT = -1;
    return 0.14;
  };
  HM.nudge = function () { if (swT < 0) nuT = 0; };
  let burst = 0;
  HM.cheer = function () { chT = 0; burst = 1; };

  HM.draw = function (ctx, t, s) {
    if (!RARM) return;
    let dt = lastT < 0 ? 0.016 : t - lastT; lastT = t;
    if (!(dt > 0)) dt = 0; else if (dt > 0.1) dt = 0.1;
    clock += dt;
    ctx.imageSmoothingEnabled = false;
    const st = s ? s.state : 'WALK', spd = clamp(((s && s.speed) || 0) / 3.5, 0, 1.3), wk = Math.min(1, spd);

    // base pose per state, smoothed
    let tRx = 402, tRy = 233, tRa = -18;
    if (st === 'MEET') { tRx = 396; tRy = 226; tRa = -10; }
    const kf = 1 - Math.exp(-dt * 7);
    bRx += (tRx - bRx) * kf; bRy += (tRy - bRy) * kf; bRa += (tRa - bRa) * kf;
    bLx += (60 - bLx) * kf; bLy += (205 - bLy) * kf;

    // figure-8 walk bob (hands out of phase) or idle breathing
    ph += dt * 6.5 * spd;
    const br = Math.sin(clock * 1.7), idle = 1 - wk;
    let rx = bRx + Math.sin(ph) * 4.5 * wk + Math.sin(clock * 0.9) * 0.6 * idle;
    let ry = bRy + Math.cos(2 * ph) * 3.2 * wk + br * 1.4 * idle;
    let ra = bRa;
    let lx = bLx + Math.cos(ph) * 4 * wk + Math.sin(clock * 0.8 + 1) * 0.6 * idle;
    let ly = bLy - Math.cos(2 * ph) * 3.2 * wk + Math.sin(clock * 1.7 + 0.6) * 1.4 * idle;

    // cheer: both hands high
    if (chT >= 0) { chT += dt; if (chT > 2.85) { chT = -1; chEnd = clock; } }
    if (st === 'VICTORY' && chT < 0 && clock - chEnd > 1.4) HM.cheer();
    const ck = cheerK();
    if (ck) { rx += (378 - rx) * ck; ry += (214 - ry) * ck; ra += (0 - ra) * ck; lx += (74 - lx) * ck; ly += (170 - ly) * ck; }

    // nudge: gentle "hmm" wobble
    let qmK = -1;
    if (nuT >= 0) {
      nuT += dt; const k = nuT / 0.5;
      if (k < 1) { const w = Math.sin(k * Math.PI * 3) * (1 - k) * 8; ra += w; rx += w * 0.3; }
      if (nuT < 0.95) qmK = nuT / 0.95; else nuT = -1;
    }

    // swing: wind up, fast slash, smooth return
    let smear = false;
    if (swT >= 0) {
      swT += dt;
      const k = swT;
      if (k < SW_WIND) { const e = easeOut(k / SW_WIND); rx = swBx + 10 * e; ry = swBy - 12 * e; ra = swBa + (WA - swBa) * e; }
      else if (k < SW_HIT) { sweepAt(k); rx = PX; ry = PY; ra = PA; }
      else if (k < SW_END) { const e = ease((k - SW_HIT) / (SW_END - SW_HIT)); rx = EX + (rx - EX) * e; ry = EY + (ry - EY) * e; ra = EA + (ra - EA) * e; }
      else swT = -1;
      if (swT >= 0) { ly += Math.sin(Math.PI * Math.min(1, k / SW_END)) * 9; lx -= Math.sin(Math.PI * Math.min(1, k / SW_END)) * 3; }
      smear = swT >= SW_WIND && swT < SW_HIT + 0.09;
    }
    curRx = rx; curRy = ry; curRa = ra;

    // fire simulation (40 Hz fixed step)
    const boost = ck;
    fireAcc += dt; let stepped = false, n = 0;
    while (fireAcc > 0.022 && n < 3) { fireAcc -= 0.022; n++; fireStep(boost, 0.08 + wk * 0.3); stepped = true; }
    if (fireAcc > 0.1) fireAcc = 0;
    if (stepped) {
      fireRender();
      fireAvg += (fireSum - fireAvg) * 0.02;
      flick += (clamp(0.6 + (fireSum / fireAvg - 1) * 3 + boost * 0.3, 0, 1) - flick) * 0.25;
    }
    HM.flicker = flick;

    const Lx = Math.round(lx), Ly = Math.round(ly), Rx = Math.round(rx), Ry = Math.round(ry);
    const fbx = Lx + Math.round(T_TOP * TS * TD[0]), fby = Ly + Math.round(T_TOP * TS * TD[1]) + 2;

    // glow halo behind everything
    ctx.globalAlpha = 0.45 + flick * 0.4 + boost * 0.15;
    ctx.drawImage(GLOW, fbx - 50, fby - 64);
    ctx.globalAlpha = 1;

    // slash smear (behind the blade)
    if (smear) drawSmear(ctx, swT);

    // sword frame + glint
    const ai = clamp(Math.round((ra - A0) / AS), 0, NA - 1), f = SF[ai], aq = (A0 + ai * AS) * DEG;
    if (!SREADY[ai]) bakeFrame(ai);
    ctx.drawImage(ATLAS, f.sx, f.sy, f.w, f.h, Rx - f.ox, Ry - f.oy, f.w, f.h);
    const dx = Math.sin(aq), dy = -Math.cos(aq), nx = Math.cos(aq), ny = Math.sin(aq);
    const gPer = ck > 0.5 ? 0.9 : 3.4;
    glintT += dt; if (glintT > gPer) glintT = 0;
    if (glintT < 0.55 && swT < 0) drawGlint(ctx, U0 + (glintT / 0.55) * (UTIP - U0 + 10), Rx, Ry, dx, dy, nx, ny);

    // arms
    ctx.drawImage(RARM.cv, Rx - RARM.ox, Ry - RARM.oy);
    ctx.drawImage(LARM.cv, Lx - LARM.ox, Ly - LARM.oy);

    // live flame
    ctx.drawImage(fireCv, fbx - (FW >> 1), fby - FH + 4);

    // embers
    eAcc += dt * (7 + boost * 30 + wk * 3);
    while (eAcc > 1) { eAcc -= 1; ember(fbx + (rnd() - 0.5) * 12, fby - 10 - rnd() * 22, boost); }
    for (let i = 0; i < NE; i++) {
      if (el[i] <= 0) continue;
      el[i] -= dt;
      evx[i] += (Math.sin(clock * 4 + es[i]) * 26 - wk * 16) * dt;
      ex[i] += evx[i] * dt; ey[i] += evy[i] * dt; evy[i] *= 1 - dt * 0.4;
      const fr = el[i] / em[i];
      ctx.fillStyle = fr > 0.78 ? '#fff6c8' : fr > 0.52 ? '#ffc640' : fr > 0.28 ? '#ff7a1c' : '#b82a14';
      ctx.fillRect(ex[i] | 0, ey[i] | 0, 1, fr > 0.85 ? 2 : 1);
    }

    // tip sparkles during the slash and while cheering
    const tipX = Rx + dx * UTIP, tipY = Ry + dy * UTIP;
    if (smear && swT < SW_HIT) for (let i = 0; i < 5; i++) { const u = UTIP - rnd() * 40; star(Rx + dx * u + (rnd() - 0.5) * 10, Ry + dy * u + (rnd() - 0.5) * 10, (rnd() - 0.5) * 90 - dx * 30, (rnd() - 0.5) * 90 - 20, 0.4 + rnd() * 0.5); }
    if (ck > 0.8 && rnd() < dt * 22) { const u = U0 + rnd() * (UTIP - U0); star(Rx + dx * u + (rnd() - 0.5) * 16, Ry + dy * u, (rnd() - 0.5) * 20, -10 - rnd() * 20, 0.5 + rnd() * 0.5); }
    for (let i = 0; i < NS; i++) {
      if (sl[i] <= 0) continue;
      sl[i] -= dt; sx[i] += svx[i] * dt; sy[i] += svy[i] * dt; svx[i] *= 1 - dt * 2.5; svy[i] = svy[i] * (1 - dt * 2.5) + 12 * dt;
      const fr = sl[i] / sm[i], r = fr > 0.7 ? 3 : fr > 0.4 ? 2 : fr > 0.15 ? 1 : 0;
      if (fr < 0.3 && ((i + (clock * 12 | 0)) & 1)) continue;   // twinkle out
      sparkle(ctx, sx[i], sy[i], r, SCOL[sc[i]]);
    }
    if (burst && chT > 0.3) {
      burst = 0;
      for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, v = 40 + rnd() * 80; star(tipX, tipY, Math.cos(a) * v, Math.sin(a) * v * 0.8 - 10, 0.7 + rnd() * 0.8); }
      for (let i = 0; i < 12; i++) ember(fbx + (rnd() - 0.5) * 16, fby - 20 - rnd() * 20, 1);
    }
    if (ck > 0.3) {
      const r = 4 + Math.round((Math.sin(clock * 9) * 0.5 + 0.5) * 4 * ck);
      sparkle(ctx, tipX, tipY - 2, r, '#fff1a0');
    }
    if (qmK >= 0) {
      ctx.globalAlpha = qmK < 0.7 ? 1 : 1 - (qmK - 0.7) / 0.3;
      ctx.drawImage(QM, Math.round(tipX + 10), Math.round(tipY + 6 - qmK * 10 - (qmK < 0.15 ? (0.15 - qmK) * 30 : 0)));
      ctx.globalAlpha = 1;
    }
  };

  function drawGlint(ctx, gu, px, py, dx, dy, nx, ny) {   // a bright diagonal shine band that runs up the blade
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 9; k++) {
      ctx.globalAlpha = k < 4 ? 1 : 0.85 - (k - 4) * 0.17;
      for (let v = -6; v <= 6; v++) {
        const u = gu - k + v * 0.7; if (u < U0 + 2 || u > UTIP - 3) continue;
        const hw = halfW(u) - 1.2; if (v < -hw || v > hw) continue;
        ctx.fillRect(Math.floor(px + u * dx + v * nx), Math.floor(py + u * dy + v * ny), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    const u = Math.min(gu, UTIP - 3), hw = halfW(u);
    if (gu > U0 + 6) sparkle(ctx, px + u * dx - hw * nx, py + u * dy - hw * ny, gu > UTIP - 16 ? 5 : 3, '#dff4ff');
  }

  // Slash smear: a crescent swept by the blade over the last 0.09 s. It tapers toward the tip as it ages.
  const SMN = 18, SMP = new Float64Array((SMN + 1) * 4), SMA = new Float64Array(SMN + 1);
  const SMB = [[0, 1, '#4cc4ff', 0.55], [0.3, 0.97, '#b4f4ff', 0.85], [0.8, 0.975, '#ffffff', 1]];
  function drawSmear(ctx, k) {
    const k1 = Math.min(k, SW_HIT), k0 = Math.max(SW_WIND, k - 0.09);
    if (k1 <= k0 + 0.002) return;
    for (let i = 0; i <= SMN; i++) {
      const kk = k0 + (k1 - k0) * i / SMN; sweepAt(kk);
      const o = i * 4; SMP[o] = PX; SMP[o + 1] = PY; SMP[o + 2] = Math.sin(PA * DEG); SMP[o + 3] = -Math.cos(PA * DEG);
      SMA[i] = clamp((k - kk) / 0.09, 0, 1);
    }
    for (let b = 0; b < 3; b++) {
      const B = SMB[b]; ctx.fillStyle = B[2];
      for (let i = 0; i < SMN; i++) {
        const age = (SMA[i] + SMA[i + 1]) * 0.5;
        const a = B[3] * (1 - age * (b === 2 ? 2.2 : b === 1 ? 1.3 : 1));
        if (a <= 0.03) continue;
        ctx.globalAlpha = a;
        for (let j = 0; j < 2; j++) {
          const o = (i + j) * 4, ag = SMA[i + j], rin = 96 + ag * 78, rout = UTIP + 4;
          const r0 = rin + (rout - rin) * B[0], r1 = rin + (rout - rin) * B[1];
          const q0 = j === 0 ? 0 : 1, q1 = j === 0 ? 3 : 2;
          QX[q0] = SMP[o] + SMP[o + 2] * r0; QY[q0] = SMP[o + 1] + SMP[o + 3] * r0;
          QX[q1] = SMP[o] + SMP[o + 2] * r1; QY[q1] = SMP[o + 1] + SMP[o + 3] * r1;
        }
        quad(ctx);
      }
    }
    ctx.globalAlpha = 1;
  }
})();
