// ─── SKY: dome, clouds, far lands, castle, mist, lights, particles, celebrations ───
(function () {
  const T = THREE;
  const TAU = Math.PI * 2;
  const CASTLE_AZ = 0.26;            // radians right of -Z
  const CASTLE_D0 = 440, CASTLE_D1 = 360;
  let core, camera;
  let dome, far, castle, flags, wins, mist, fly, spark, fw, birds, dragon, wingN, wingF;
  let hemi, sun, amb;
  const U = {};                       // shared uniforms
  const S = { restore: 0, back: 'title', mood: 'title', mt: 1, md: 1, prog: 0, flash: -1, nextFlash: 9, sparkT: 99, dragonT: -1, slot: 0, bq: [], vic: 0, shoot: 0, fwOff: 0 };
  const tmpV = new T.Vector3(), tmpV2 = new T.Vector3();

  // ── Moods ──────────────────────────────────────────────────────────────────
  const CK = ['zen', 'mid', 'hor', 'glow', 'cDark', 'cLight', 'rim', 'sun', 'fog', 'hemiSky', 'hemiGnd', 'dirCol', 'amb', 'light', 'haze', 'mist', 'win', 'fire', 'bird'];
  const VK = ['sunDir', 'glowDir'];
  const UK = ['mistAmt', 'hazeK', 'gold', 'winOn', 'winI', 'fireAmt', 'embers', 'birds'];
  const STORM = {
    zen: 0x0e0628, mid: 0x2a1866, hor: 0x8c78c8, glow: 0xa8f040, cDark: 0x1a1040, cLight: 0x6448b8, rim: 0xc0ff40, sun: 0xfff0c0,
    fog: 0x9888c8, hemiSky: 0xece6ff, hemiGnd: 0x4a7a2a, dirCol: 0xfff2d8, amb: 0x40305a, light: 0xffffff, haze: 0x7a6cc0, mist: 0xd0c4f0,
    win: 0xffa030, fire: 0xffd060, bird: 0x2a1830,
    sunDir: [0.3, 0.25, -1], glowDir: [-0.1, 0.1, -1],
    cover: 0.38, cloud: 1, rimAmt: 1, glowAmt: 1, sunSize: 0.0, sunAmt: 0, moon: 0, stars: 0, aurora: 0, rainbow: 0, rays: 0,
    fogNear: 45, fogFar: 190, hemiI: 1.55, dirI: 1.7, ambI: 0.35, fireAmt: 0.45, embers: 0, birds: 0, gold: 0, winOn: 0.55, winI: 1,
    mistAmt: 1, storm: 1, hazeK: 1,
  };
  const MOODS = {
    LETTERS: STORM,
    title: Object.assign({}, STORM, { glow: 0xd8f050, rim: 0xe8ff80, cover: 0.46, winOn: 0.7 }),
    WORDS: Object.assign({}, STORM, {
      zen: 0x2a2468, mid: 0xc4507c, hor: 0xffb468, glow: 0xffc860, cDark: 0x6a2a5c, cLight: 0xf08a78, rim: 0xffe890, sun: 0xffd890,
      fog: 0xe8a488, hemiSky: 0xffe0b8, hemiGnd: 0x4a7020, dirCol: 0xffc080, amb: 0x503040, light: 0xffc0a8, haze: 0xdc9a92, mist: 0xffd0b0,
      bird: 0x3a1830, sunDir: [0.32, 0.07, -1], glowDir: [0.32, 0.07, -1],
      cover: 0.5, sunSize: 0.06, sunAmt: 1, rays: 1, storm: 0, birds: 1, fireAmt: 0.5, dirI: 1.8, hemiI: 1.5,
    }),
    NUMBERS: Object.assign({}, STORM, {
      zen: 0x040822, mid: 0x0c1850, hor: 0x2c3e84, glow: 0x3070c0, cDark: 0x0a0e30, cLight: 0x283468, rim: 0x90b0ff, sun: 0xf4f0ff,
      fog: 0x243468, hemiSky: 0xa8c0ff, hemiGnd: 0x2a5a2a, dirCol: 0xb0c8ff, amb: 0x202850, light: 0x7a88c8, haze: 0x2e4078, mist: 0x5a6cb0,
      win: 0xffb040, sunDir: [-0.45, 0.42, -1], glowDir: [-0.45, 0.42, -1],
      cover: 0.58, glowAmt: 0.5, sunSize: 0.075, sunAmt: 1, moon: 1, stars: 1, aurora: 1, storm: 0,
      fogNear: 35, fogFar: 170, hemiI: 1.35, dirI: 1.0, ambI: 0.4, fireAmt: 1.3, embers: 1, winOn: 0.8, winI: 1.2,
    }),
    MATH: Object.assign({}, STORM, {
      zen: 0x5a64c0, mid: 0xf09ec4, hor: 0xffd6b4, glow: 0xfff0c0, cDark: 0xb87aa8, cLight: 0xffd8e4, rim: 0xfff6d8, sun: 0xfff0d0,
      fog: 0xf0c4cc, hemiSky: 0xfff0f4, hemiGnd: 0x4a7a2a, dirCol: 0xffd8c0, amb: 0x604050, light: 0xffd0d8, haze: 0xe4b4cc, mist: 0xfff2f6,
      bird: 0x5a3050, sunDir: [-0.5, 0.05, -1], glowDir: [-0.5, 0.05, -1],
      cover: 0.54, glowAmt: 0.8, sunSize: 0.05, sunAmt: 1, rays: 0.6, storm: 0, birds: 1, fireAmt: 0.3, hemiI: 1.65, dirI: 1.6, winOn: 0.3,
    }),
    victory: Object.assign({}, STORM, {
      zen: 0x1c48d0, mid: 0x5a9cff, hor: 0xffe4c8, glow: 0xffe890, cDark: 0xb49ae8, cLight: 0xfff8ff, rim: 0xfff0b0, sun: 0xfff8e0,
      fog: 0xdcdcf8, hemiSky: 0xffffff, hemiGnd: 0x4a8a2a, dirCol: 0xfff4e0, amb: 0x605070, light: 0xfff0e0, haze: 0xb8c0f0, mist: 0xe8ecff,
      win: 0xffd060, sunDir: [0.4, 0.55, -1], glowDir: [0.0, 0.3, -1],
      cover: 0.5, glowAmt: 0.6, rainbow: 1, storm: 0, gold: 1, winOn: 1.01, winI: 1.6, fireAmt: 0.8, hemiI: 1.8, dirI: 2.0, rimAmt: 0.6, mistAmt: 0.6,
    }),
  };
  function toMood(src) {
    const m = {};
    for (const k in src) {
      if (CK.includes(k)) m[k] = new T.Color(src[k]);
      else if (VK.includes(k)) m[k] = new T.Vector3().fromArray(src[k]).normalize();
      else m[k] = src[k];
    }
    return m;
  }
  const M = {};
  let cur, from, to;
  function copyMood(dst, src) {
    for (const k in src) {
      if (src[k].isColor || src[k].isVector3) dst[k].copy(src[k]); else dst[k] = src[k];
    }
  }

  // ── Shared GLSL ────────────────────────────────────────────────────────────
  const NOISE = `
    float h13(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
    float bfbm(vec3 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 4; i++){ float n = vn(p); s += a*(i < 2 ? n : 1.0 - abs(2.0*n - 1.0)); p = p*2.1 + vec3(1.7,9.2,3.1); a *= 0.42; } return s; }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a*vn(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s*1.14; }
  `;

  // ── Sky dome ───────────────────────────────────────────────────────────────
  const DOME_FS = `
    varying vec3 vDir;
    uniform float uTime, uCover, uCloud, uRimAmt, uGlowAmt, uSunSize, uSunAmt, uMoon, uStars, uAurora, uRainbow, uRays, uFlash;
    uniform vec3 uZen, uMid, uHor, uGlow, uCDark, uCLight, uRim, uSunCol, uFogCol, uSunDir, uGlowDir, uFlashDir;
    uniform vec4 uShoot[3];
    ${NOISE}
    vec3 hsv(float h){ return clamp(abs(mod(h*6.0 + vec3(0,4,2), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
    void main(){
      vec3 dir = normalize(vDir);
      float el = dir.y, az = atan(dir.x, -dir.z);
      vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.3, el));
      col = mix(col, uZen, smoothstep(0.3, 0.9, el));
      float g = max(dot(dir, uGlowDir), 0.0), ga = acos(clamp(g, -1.0, 1.0));
      float glowM = exp(-ga*ga*28.0) * 1.1 + exp(-ga*ga*5.0) * 0.3 + exp(-max(el, 0.0) * 16.0) * 0.25;
      // sun rays
      float sd = dot(dir, uSunDir);
      if (uRays > 0.01) {
        vec3 sx = normalize(cross(uSunDir, vec3(0,1,0))), sy = cross(sx, uSunDir);
        float ang = atan(dot(dir, sy), dot(dir, sx));
        float r = vn(vec3(ang*7.0, uTime*0.08, 0.0));
        glowM += uRays * smoothstep(0.55, 0.8, r) * pow(max(sd, 0.0), 10.0) * 0.9;
      }
      col = mix(col, uGlow * 1.15, clamp(uGlowAmt * glowM, 0.0, 1.0));
      // stars
      if (uStars > 0.01) {
        vec3 p = dir * 95.0; vec3 i = floor(p), f = fract(p);
        float h = h13(i);
        if (h > 0.84) {
          vec3 c = vec3(h13(i+3.1), h13(i+7.7), h13(i+1.3))*0.5 + 0.25;
          float tw = 0.55 + 0.45*sin(uTime*(1.0 + h*2.0) + h*60.0);
          float big = step(0.975, h);
          col += vec3(0.95, 0.95, 1.2) * smoothstep(0.34 + big*0.2, 0.0, length(f - c)) * tw * (1.5 + big*2.0) * uStars * smoothstep(0.02, 0.2, el);
        }
      }
      // aurora
      if (uAurora > 0.01) {
        vec3 acc = vec3(0.0);
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float c = 0.3 + fk*0.13 + 0.06*sin(az*2.3 + uTime*0.18 + fk*2.0) + 0.035*sin(az*5.7 - uTime*0.27 + fk);
          float up = smoothstep(c - 0.02, c, el) * exp(-max(el - c, 0.0) * (11.0 - fk*3.0));
          float stripes = 0.3 + 0.7*vn(vec3(az*30.0 + uTime*0.4, fk*5.0, uTime*0.25)) * (0.6 + 0.4*sin(az*9.0 - uTime*0.5 + fk*3.0));
          float fade = smoothstep(1.4, 0.2, abs(az + 0.35 - fk*0.7));
          acc += mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.3, 1.0), clamp((el - c)*5.0 + fk*0.3, 0.0, 1.0)) * up * stripes * fade;
        }
        col += acc * uAurora * 0.75;
      }
      // sun or moon
      if (uSunAmt > 0.01) {
        float a = acos(clamp(sd, -1.0, 1.0));
        float disk = smoothstep(uSunSize, uSunSize*0.9, a);
        vec3 sc = uSunCol * 2.2;
        if (uMoon > 0.5) {
          float cr = vn(dir*55.0) * 0.6 + vn(dir*140.0) * 0.4;
          sc = mix(uSunCol*1.6, uSunCol*1.0, smoothstep(0.5, 0.62, cr));
          sc *= 0.8 + 0.3*smoothstep(uSunSize, 0.0, a);
        }
        vec3 halo = uSunCol * (exp(-a*9.0)*0.35 + exp(-a*28.0)*0.5);
        col = mix(col + halo*uSunAmt, sc, disk*uSunAmt);
      }
      // clouds (three drifting layers, far to near)
      if (uCloud > 0.001) {
        vec2 uv = dir.xz / (max(el, 0.0) + 0.14);
        float hz = smoothstep(0.0, 0.3, el);
        vec2 lo = normalize(uGlowDir.xz + 1e-4) * 0.3;
        float gm = exp(-ga*ga*7.0);
        float fl = uFlash * pow(max(dot(dir, uFlashDir), 0.0), 10.0);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float sc = 1.1 - fi*0.25;
          float cov = uCover + 0.04 - fi*0.035;
          float tt = uTime*0.015 + fi*3.1;
          vec2 q = uv*sc + vec2(uTime*(0.005 + fi*0.004), uTime*0.002) + fi*17.3;
          vec2 w = vec2(vn(vec3(q*0.6, tt)), vn(vec3(q*0.6 + 5.7, tt))) - 0.5;
          q += w*0.55;
          float d = bfbm(vec3(q, tt*1.6));
          float dl = bfbm(vec3(q + lo, tt*1.6));
          float a = smoothstep(cov, cov + 0.025, d) * uCloud * smoothstep(-0.01, 0.03, el);
          float thick = smoothstep(cov, cov + 0.22, d);
          float lit = clamp((d - dl)*11.0 + 0.1, 0.0, 1.0);
          float edge = 1.0 - smoothstep(cov + 0.01, cov + 0.035, d);
          vec3 body = mix(uCDark, uCLight, clamp(lit*0.9 + (1.0 - thick)*0.25, 0.0, 1.0));
          body = mix(body, uHor*0.85, (1.0 - hz)*(0.45 - fi*0.12));
          float rg = clamp(0.25 + 1.7*gm + 0.3*(1.0 - hz), 0.0, 1.8);
          vec3 rim = mix(uCLight*1.3, uRim, clamp(rg, 0.0, 1.0)) * (lit*(1.0 - thick*0.6)*1.0 + (1.0 - thick)*gm*0.7 + edge*(0.25 + lit)*0.8) * rg * uRimAmt;
          vec3 lc = body + rim + uGlow * fl * (0.6 + thick) * 2.0;
          col = mix(col, lc, a);
        }
      }
      // rainbow
      if (uRainbow > 0.01) {
        float ra = acos(clamp(dot(dir, normalize(vec3(0.0, -0.3, -1.0))), -1.0, 1.0));
        float x = (ra - 0.64) / 0.12;
        if (x > 0.0 && x < 1.0) {
          float idx = floor(x*7.0);
          vec3 rb = mix(hsv((idx/6.0)*0.8), vec3(1.0), 0.18) * 1.5;
          col = mix(col, rb, uRainbow * 0.75 * smoothstep(-0.02, 0.08, el));
        }
      }
      // shooting stars
      for (int k = 0; k < 3; k++) {
        vec4 s = uShoot[k]; float age = uTime - s.z;
        if (age > 0.0 && age < 1.3) {
          vec2 dv = vec2(cos(s.w), sin(s.w)); vec2 rel = vec2(az, el) - s.xy;
          float along = dot(rel, dv), perp = abs(rel.x*dv.y - rel.y*dv.x), tail = age*0.75 - along;
          if (along > 0.0 && tail > 0.0 && tail < 0.22)
            col += vec3(1.0, 0.92, 0.6) * 3.0 * (1.0 - tail/0.22) * smoothstep(0.007, 0.0, perp) * smoothstep(1.3, 0.9, age);
        }
      }
      col = mix(col, uFogCol, smoothstep(0.0, -0.05, el));
      gl_FragColor = vec4(col, 1.0);
    }`;

  function buildDome(scene) {
    Object.assign(U, {
      uTime: { value: 0 }, uFlash: { value: 0 }, uFlashDir: { value: new T.Vector3(0, 0.3, -1).normalize() },
      uShoot: { value: [new T.Vector4(0, 0, -99, 0), new T.Vector4(0, 0, -99, 0), new T.Vector4(0, 0, -99, 0)] },
    });
    const du = {
      uTime: U.uTime, uFlash: U.uFlash, uFlashDir: U.uFlashDir, uShoot: U.uShoot,
      uZen: { value: cur.zen }, uMid: { value: cur.mid }, uHor: { value: cur.hor }, uGlow: { value: cur.glow },
      uCDark: { value: cur.cDark }, uCLight: { value: cur.cLight }, uRim: { value: cur.rim }, uSunCol: { value: cur.sun },
      uFogCol: { value: cur.fog }, uSunDir: { value: cur.sunDir }, uGlowDir: { value: cur.glowDir },
      uCover: { value: 0 }, uCloud: { value: 1 }, uRimAmt: { value: 1 }, uGlowAmt: { value: 1 }, uSunSize: { value: 0 }, uSunAmt: { value: 0 },
      uMoon: { value: 0 }, uStars: { value: 0 }, uAurora: { value: 0 }, uRainbow: { value: 0 }, uRays: { value: 0 },
    };
    U.dome = du;
    dome = new T.Mesh(new T.SphereGeometry(820, 48, 24), new T.ShaderMaterial({
      uniforms: du, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: DOME_FS,
    }));
    dome.renderOrder = -10; dome.frustumCulled = false;
    scene.add(dome);
  }

  // ── Geometry builder (position + rgb/haze + kind) ──────────────────────────
  function Builder() { this.p = []; this.c = []; this.k = []; }
  Builder.prototype.v = function (x, y, z, col, haze, kind) { this.p.push(x, y, z); this.c.push(col.r, col.g, col.b, haze); this.k.push(kind || 0); };
  Builder.prototype.tri = function (a, b, c, ca, cb, cc, haze, kind) {
    this.v(a[0], a[1], a[2], ca, haze, kind); this.v(b[0], b[1], b[2], cb || ca, haze, kind); this.v(c[0], c[1], c[2], cc || ca, haze, kind);
  };
  const LDIR = new T.Vector3(-0.55, 0.55, 0.62).normalize();
  const _c = new T.Color(), _n = new T.Vector3();
  Builder.prototype.geo = function (g, m, col, haze, kind, o) {
    o = o || {};
    const ng = g.index ? g.toNonIndexed() : g.clone();
    ng.applyMatrix4(m); ng.computeVertexNormals();
    const P = ng.attributes.position, N = ng.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      _n.set(N.getX(i), N.getY(i), N.getZ(i));
      const l = (o.flat ? 1 : 0.5 + 0.62 * Math.max(0, _n.dot(LDIR))) + (o.top ? o.top * Math.max(0, _n.y) : 0);
      _c.copy(col).multiplyScalar(l);
      this.v(P.getX(i), P.getY(i), P.getZ(i), _c, haze, kind);
    }
    ng.dispose();
  };
  Builder.prototype.build = function () {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aCol', new T.Float32BufferAttribute(this.c, 4));
    g.setAttribute('aKind', new T.Float32BufferAttribute(this.k, 1));
    return g;
  };
  const mtx = new T.Matrix4(), q = new T.Quaternion(), sv = new T.Vector3(), pv = new T.Vector3(), ev = new T.Euler();
  function M4(x, y, z, sx, sy, sz, rx, ry, rz) {
    ev.set(rx || 0, ry || 0, rz || 0); q.setFromEuler(ev);
    return mtx.compose(pv.set(x, y, z), q, sv.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz));
  }
  function noise1(rand, period) {
    const v = new Float32Array(period); for (let i = 0; i < period; i++) v[i] = rand();
    return x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return v[((i % period) + period) % period] * (1 - s) + v[(((i + 1) % period) + period) % period] * s; };
  }

  // ── Far lands material ─────────────────────────────────────────────────────
  function farMaterial() {
    return new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uLight: { value: cur.light }, uHaze: { value: cur.haze }, uMist: { value: cur.mist },
        uMistAmt: U.mistAmt, uHazeK: U.hazeK, uGold: U.gold },
      vertexShader: `
        attribute vec4 aCol; attribute float aKind; varying vec4 vCol; varying float vKind; varying vec3 vP;
        void main(){ vCol = aCol; vKind = aKind; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime, uMistAmt, uHazeK, uGold; uniform vec3 uLight, uHaze, uMist;
        varying vec4 vCol; varying float vKind; varying vec3 vP;
        void main(){
          vec3 c = vCol.rgb * uLight;
          if (vKind > 0.5 && vKind < 1.5) {                 // waterfall
            float s = step(0.5, fract(vP.y*0.09 + uTime*1.4 + vP.x*0.05));
            c = mix(vec3(0.55, 0.65, 0.95), vec3(0.95, 0.97, 1.0), s) * mix(uLight, vec3(1.0), 0.4);
          }
          if (vKind > 1.5) c = mix(c, vec3(1.0, 0.5, 0.06) * (0.45 + vCol.r*6.0), uGold);   // castle glows gold
          c = mix(c, uHaze, clamp(vCol.a * uHazeK, 0.0, 1.0));
          float m = (1.0 - smoothstep(-8.0, 10.0, vP.y)) * uMistAmt * (0.3 + vCol.a*0.6);
          c = mix(c, uMist, clamp(m, 0.0, 0.95));
          gl_FragColor = vec4(c, 1.0);
        }`,
      fog: false,
    });
  }

  // ── Far lands: mountains, ridges with waterfalls, forested hills ───────────
  function buildLands(rand) {
    const B = new Builder();
    const tree = (x, y, z, h, w, col, haze) => {
      // flat pine silhouette facing the centre, two stacked tiers
      const r = Math.hypot(x, z), tx = -z / r * w, tz = x / r * w;
      B.tri([x - tx, y, z - tz], [x + tx, y, z + tz], [x, y + h, z], col, null, null, haze);
      B.tri([x - tx * 0.75, y + h * 0.35, z - tz * 0.75], [x + tx * 0.75, y + h * 0.35, z + tz * 0.75], [x, y + h * 1.12, z], col, null, null, haze);
    };
    const ring = (R, N, hf, colTop, colBot, haze, opt) => {
      opt = opt || {};
      const hs = [];
      for (let i = 0; i <= N; i++) hs.push(hf(i / N * TAU, i));
      const cT = new T.Color(), cB = new T.Color();
      for (let i = 0; i < N; i++) {
        const a0 = i / N * TAU, a1 = (i + 1) / N * TAU;
        const x0 = Math.sin(a0) * R, z0 = -Math.cos(a0) * R, x1 = Math.sin(a1) * R, z1 = -Math.cos(a1) * R;
        const h0 = hs[i], h1 = hs[i + 1];
        const slope = (h1 - h0) / (R * TAU / N);
        const lit = 1 + Math.max(-0.35, Math.min(0.45, -slope * (opt.facet || 0.8)));
        const band = opt.bands ? (0.82 + 0.3 * rand()) : 1;
        cT.copy(colTop).multiplyScalar(lit * band); cB.copy(colBot).multiplyScalar(band);
        const y0 = opt.base || -20;
        B.tri([x0, y0, z0], [x1, y0, z1], [x1, h1, z1], cB, cB, cT, haze);
        B.tri([x0, y0, z0], [x1, h1, z1], [x0, h0, z0], cB, cT, cT, haze);
      }
      return hs;
    };
    // far snowy mountains
    const n1 = noise1(rand, 9), n2 = noise1(rand, 23), n3 = noise1(rand, 61);
    ring(770, 260, a => { const u = a / TAU; return 25 + 105 * Math.pow(n1(u * 9), 1.6) + 30 * n2(u * 23) + 9 * n3(u * 61); },
      new T.Color(0x8c88d8), new T.Color(0x44449a), 0.44, { facet: 1.4, bands: true });
    // mid cliffs with waterfalls
    const m1 = noise1(rand, 7), m2 = noise1(rand, 29), m3 = noise1(rand, 83);
    const midH = a => { const u = a / TAU; let h = 14 + 62 * Math.pow(m1(u * 7), 1.3) + 16 * m2(u * 29) + 5 * m3(u * 83);
      const d = Math.abs(((a - CASTLE_AZ + Math.PI) % TAU + TAU) % TAU - Math.PI); return h * (0.55 + 0.45 * Math.min(1, d / 0.35)); };
    ring(560, 240, midH, new T.Color(0x4c4ca8), new T.Color(0x24246a), 0.24, { facet: 1.8, bands: true, base: -25 });
    [-0.62, -0.38, 0.42, 0.7, -1.05, 1.1].forEach(a => {
      const h = midH((a + TAU) % TAU); if (h < 30) return;
      const R = 556, x = Math.sin(a) * R, z = -Math.cos(a) * R, w = 4.5, tx = -z / R * w, tz = x / R * w;
      const top = h * 0.85, white = new T.Color(1, 1, 1);
      B.tri([x - tx, -5, z - tz], [x + tx, -5, z + tz], [x + tx, top, z + tz], white, null, null, 0.2, 1);
      B.tri([x - tx, -5, z - tz], [x + tx, top, z + tz], [x - tx, top, z - tz], white, null, null, 0.2, 1);
    });
    // forested hills (dip where the road valley leads to the castle)
    const f1 = noise1(rand, 13), f2 = noise1(rand, 41);
    const dip = (a, w) => { const d = Math.abs(((a - CASTLE_AZ + Math.PI) % TAU + TAU) % TAU - Math.PI); return 0.12 + 0.88 * Math.min(1, Math.pow(d / w, 2)); };
    const forH = a => { const u = a / TAU; return (6 + 26 * f1(u * 13) + 7 * f2(u * 41)) * dip(a, 0.3); };
    const fcol = new T.Color(0x1f4a44), tcol = new T.Color(0x143630);
    ring(330, 200, forH, new T.Color(0x2c6050), new T.Color(0x1a3a3c), 0.3, { facet: 1.2 });
    for (let a = 0; a < TAU; a += 0.011 + rand() * 0.01) {
      const h = forH(a), R = 328 - rand() * 4;
      if (h > 7) tree(Math.sin(a) * R, h - 3 - rand() * 4, -Math.cos(a) * R, 8 + rand() * 7, 2.6 + rand() * 1.6, rand() < 0.5 ? tcol : fcol, 0.3);
    }
    // near side hills
    const s1 = noise1(rand, 11), s2 = noise1(rand, 37);
    const nearH = a => { const u = a / TAU; return (4 + 16 * s1(u * 11) + 5 * s2(u * 37)) * dip(a, 0.55); };
    ring(225, 160, nearH, new T.Color(0x2e6a3c), new T.Color(0x1c4030), 0.22, { facet: 1.0 });
    const tn = new T.Color(0x123a2a);
    for (let a = 0; a < TAU; a += 0.014 + rand() * 0.016) {
      const h = nearH(a), R = 223 - rand() * 3;
      if (h > 5) tree(Math.sin(a) * R, h - 3 - rand() * 3, -Math.cos(a) * R, 7 + rand() * 6, 2.2 + rand() * 1.2, tn, 0.22);
    }
    return B.build();
  }

  // ── The castle ─────────────────────────────────────────────────────────────
  function buildCastle(rand) {
    const B = new Builder(), W = [], F = [];
    const wall = new T.Color(0x1a1a46), wallD = new T.Color(0x121236), roof = new T.Color(0x26245c), trim = new T.Color(0x222254);
    const hillG = new T.Color(0x4f9a44), hillD = new T.Color(0x21503a);
    const HY = 50;                                    // hill top height (castle floor)
    // hill: squashed half sphere, bright meadow front, dark forest skirts
    const hg = new T.SphereGeometry(1, 36, 14, 0, TAU, 0, Math.PI / 2);
    const hp = hg.attributes.position, hc = [];
    B.geo(hg, M4(0, -10, 0, 190, HY + 12, 120), hillG, 0.22, 0, { top: 0.15 });
    // recolour hill: darker low and on the far sides
    const n0 = B.p.length / 3 - hg.toNonIndexed().attributes.position.count;
    for (let i = n0; i < B.p.length / 3; i++) {
      const x = B.p[i * 3], y = B.p[i * 3 + 1];
      const side = Math.min(1, Math.abs(x) / 190), low = 1 - Math.min(1, (y + 4) / 30);
      const k = Math.min(1, side * 1.1 + low * 0.5);
      B.c[i * 4] = B.c[i * 4] * (1 - k) + hillD.r * k; B.c[i * 4 + 1] = B.c[i * 4 + 1] * (1 - k) + hillD.g * k; B.c[i * 4 + 2] = B.c[i * 4 + 2] * (1 - k) + hillD.b * k;
    }
    const hillZ = (x, y) => { const s = 1 - (x / 190) ** 2 - ((y + 10) / (HY + 12)) ** 2; return s > 0 ? 120 * Math.sqrt(s) : 0; };
    // winding path
    const path = [[-8, -4], [56, 8], [-46, 20], [30, 32], [-4, 42], [0, HY]];
    const pc = new T.Color(0xd8c89a);
    for (let s = 0; s < path.length - 1; s++) {
      const [ax, ay] = path[s], [bx, by] = path[s + 1];
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8;
        const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
        const z0 = hillZ(x0, y0) + 1.2, z1 = hillZ(x1, y1) + 1.2, w = 2.2;
        B.tri([x0, y0 - w, z0], [x1, y1 - w, z1], [x1, y1 + w, z1], pc, null, null, 0.3);
        B.tri([x0, y0 - w, z0], [x1, y1 + w, z1], [x0, y0 + w, z0], pc, null, null, 0.3);
      }
    }
    // pine forest on the hill skirts
    const tc = new T.Color(0x15342c), tc2 = new T.Color(0x1d4436);
    for (let i = 0; i < 260; i++) {
      const x = (rand() * 2 - 1) * 215, y = -6 + rand() * 36;
      const side = Math.abs(x) / 190;
      if (side < 0.42 && y > 2 + rand() * 6) continue;           // leave the front meadow open
      const z = Math.max(hillZ(x, y), 0) + 3 + rand() * 4;
      if (Math.abs(x) > 190 && y > 6) continue;
      const h = 9 + rand() * 8, w = 3 + rand() * 2, c = rand() < 0.5 ? tc : tc2;
      B.tri([x - w, y, z], [x + w, y, z], [x, y + h, z], c, null, null, 0.3);
      B.tri([x - w * 0.7, y + h * 0.4, z + 0.3], [x + w * 0.7, y + h * 0.4, z + 0.3], [x, y + h * 1.15, z + 0.3], c, null, null, 0.3);
    }
    // parts
    const cyl = new T.CylinderGeometry(1, 1, 1, 10, 1), cone = new T.ConeGeometry(1, 1, 10, 1), box = new T.BoxGeometry(1, 1, 1);
    const winOn = () => rand();
    const addWin = (x, y, z, size, kind) => { W.push(x, y, z, winOn(), rand(), size || 2, kind || 0); };
    const tower = (x, z, r, h, roofH, o) => {
      o = o || {};
      const y = HY;
      B.geo(cyl, M4(x, y + h / 2, z, r, h, r), wall, 0.12, 2);
      B.geo(cyl, M4(x, y + h + 1.2, z, r + 1.1, 2.6, r + 1.1), trim, 0.2, 2);
      B.geo(cone, M4(x, y + h + 2.5 + roofH / 2, z, r * 1.28, roofH, r * 1.28), roof, 0.2, 2, { top: 0.3 });
      const tipY = y + h + 2.5 + roofH;
      B.geo(box, M4(x, tipY + 3.5, z, 0.7, 7, 0.7), wallD, 0.2, 2, { flat: true });
      F.push(x, tipY + 6.4, z, rand() * 6, rand() < 0.5 ? 0 : 1, o.flag || 1);
      const nw = Math.max(2, Math.floor(h / 13));
      for (let i = 0; i < nw; i++) {
        const a = (rand() - 0.5) * 1.6, wy = y + h * (0.3 + 0.62 * (i + rand() * 0.6) / nw);
        addWin(x + Math.sin(a) * (r + 0.4), wy, z + Math.cos(a) * (r + 0.4), rand() < 0.25 ? 3 : 2);
      }
      if (o.bart) {                                  // little side turrets
        [-1, 1].forEach(sd => {
          const bx = x + sd * (r + 1.4), by = y + h * 0.78;
          B.geo(cyl, M4(bx, by, z + 1, 2.1, 9, 2.1), wall, 0.2, 2);
          B.geo(cone, M4(bx, by + 4.5 + 5, z + 1, 2.6, 10, 2.6), roof, 0.2, 2, { top: 0.3 });
          addWin(bx, by, z + 3.3, 2);
        });
      }
    };
    const wallSeg = (x0, z0, x1, z1, h, t) => {
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
      B.geo(box, M4((x0 + x1) / 2, HY + h / 2, (z0 + z1) / 2, L, h, t, 0, ang, 0), wall, 0.2, 2);
      for (let s = 2; s < L - 1; s += 5) {           // merlons
        const f = s / L;
        B.geo(box, M4(x0 + dx * f, HY + h + 1.6, z0 + dz * f, 2.6, 3.2, t + 0.4, 0, ang, 0), wall, 0.2, 2);
      }
    };
    // curtain walls
    wallSeg(-52, 26, -14, 26, 22, 4); wallSeg(14, 26, 52, 26, 22, 4);
    wallSeg(-52, 26, -52, -30, 22, 4); wallSeg(52, 26, 52, -30, 22, 4); wallSeg(-52, -30, 52, -30, 26, 4);
    for (let x = -46; x <= 46; x += 7) if (Math.abs(x) > 16) addWin(x + rand() * 2, HY + 11 + rand() * 6, 28.3, 2);
    // keep
    B.geo(box, M4(0, HY + 30, -8, 34, 60, 26), wall, 0.2, 2);
    B.geo(box, M4(0, HY + 62, -8, 36, 4, 28), trim, 0.2, 2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (rand() < 0.8) addWin(-12 + c * 6, HY + 14 + r * 11, 5.3, 2);
    // gatehouse
    B.geo(box, M4(0, HY + 16, 28, 22, 32, 10), wall, 0.2, 2);
    for (let s = -9; s <= 9; s += 4.5) B.geo(box, M4(s, HY + 33.5, 28, 2.6, 3.2, 10.4), wall, 0.2, 2);
    B.geo(box, M4(0, HY + 6, 33.2, 8, 12, 0.6), new T.Color(0x120c24), 0.1, 2, { flat: true });
    W.push(0, HY + 6, 34.5, 0, 0, 16, 1);            // gate glow
    addWin(-5, HY + 22, 33.3, 3); addWin(5, HY + 22, 33.3, 3);
    tower(-13, 29, 5.5, 40, 22, { bart: false });
    tower(13, 29, 5.5, 40, 22);
    // corner towers
    tower(-52, 26, 7.5, 44, 28, { bart: true }); tower(52, 26, 7.5, 48, 30, { bart: true });
    tower(-52, -30, 7, 50, 30); tower(52, -30, 7, 46, 28);
    // inner spires
    tower(0, -12, 8, 88, 42, { bart: true });
    tower(-22, -2, 6, 70, 32, { bart: true }); tower(23, -4, 6, 64, 30, { bart: true });
    tower(-13, -22, 5, 80, 34); tower(15, -22, 5, 76, 32);
    tower(-36, 8, 5, 54, 26); tower(36, 10, 5.5, 58, 28);
    tower(-30, -20, 4, 62, 26); tower(33, -18, 4, 60, 26);
    const body = new T.Mesh(B.build(), farMaterial());
    // windows (points)
    const wg = new T.BufferGeometry(), wp = [], wa = [];
    for (let i = 0; i < W.length; i += 7) { wp.push(W[i], W[i + 1], W[i + 2]); wa.push(W[i + 3], W[i + 4], W[i + 5], W[i + 6]); }
    wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3));
    wg.setAttribute('aW', new T.Float32BufferAttribute(wa, 4));
    wins = new T.Points(wg, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uOn: U.winOn, uWin: U.winI, uWinCol: { value: cur.win }, uGold: U.gold },
      vertexShader: `
        attribute vec4 aW; uniform float uTime, uOn, uWin; varying float vI; varying float vK;
        void main(){
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          float on = aW.w > 0.5 ? 1.0 : step(aW.x, uOn);
          vI = on * (0.8 + 0.2*sin(uTime*(1.2 + aW.y*2.0) + aW.y*20.0)) * uWin; vK = aW.w;
          gl_PointSize = vI > 0.02 ? aW.z : 0.0;
        }`,
      fragmentShader: `
        uniform vec3 uWinCol; uniform float uGold; varying float vI; varying float vK;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float g = vK > 0.5 ? exp(-dot(d, d)*9.0) : 1.0;
          gl_FragColor = vec4(uWinCol * vI * (vK > 0.5 ? 1.6 + uGold : 3.0) * g, 1.0);
        }`,
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false,
    }));
    // pennants
    const fp = [], fa = [], fc = [];
    const fcols = [new T.Color(0xff3a5a), new T.Color(0xffc830)];
    for (let i = 0; i < F.length; i += 6) {
      const x = F[i], y = F[i + 1], z = F[i + 2], ph = F[i + 3], col = fcols[F[i + 4]], L = 15, H = 2.6, N = 5;
      for (let s = 0; s < N; s++) {
        const u0 = s / N, u1 = (s + 1) / N, h0 = H * (1 - u0), h1 = H * (1 - u1);
        const q = [[x + L * u0, y - h0, z, u0], [x + L * u1, y - h1, z, u1], [x + L * u1, y + h1 * 0.3, z, u1], [x + L * u0, y + h0 * 0.3, z, u0]];
        [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(j => { fp.push(q[j][0], q[j][1], q[j][2]); fa.push(q[j][3], ph); fc.push(col.r, col.g, col.b); }));
      }
    }
    const fg = new T.BufferGeometry();
    fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3));
    fg.setAttribute('aF', new T.Float32BufferAttribute(fa, 2));
    fg.setAttribute('color', new T.Float32BufferAttribute(fc, 3));
    flags = new T.Mesh(fg, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uLight: { value: cur.light }, uHaze: { value: cur.haze } },
      vertexShader: `
        attribute vec2 aF; attribute vec3 color; uniform float uTime; varying vec3 vC;
        void main(){
          vec3 p = position; float u = aF.x;
          p.z += sin(uTime*3.2 + u*5.0 + aF.y) * u * 3.0;
          p.y += sin(uTime*2.6 + u*4.0 + aF.y) * u * 1.2;
          vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform vec3 uLight, uHaze; varying vec3 vC; void main(){ gl_FragColor = vec4(mix(vC * mix(uLight, vec3(1.0), 0.5), uHaze, 0.15), 1.0); }',
      side: T.DoubleSide, fog: false,
    }));
    castle = new T.Group();
    castle.add(body, wins, flags);
    [cyl, cone, box, hg].forEach(g => g.dispose());
    return castle;
  }

  // ── Mist banks ─────────────────────────────────────────────────────────────
  function buildMist() {
    const p = [], uv = [], m = [];
    [[195, -8, 16, 0.2], [262, -8, 20, 0.5], [300, -8, 22, 0.8], [385, -10, 26, 0.35], [480, -10, 30, 0.65], [640, -12, 34, 0.9]].forEach(([R, y0, h, seed]) => {
      const g = new T.CylinderGeometry(R, R, h, 96, 1, true, Math.PI - 2.0, 4.0).toNonIndexed();
      g.translate(0, y0 + h / 2, 0);
      const P = g.attributes.position, UV = g.attributes.uv;
      for (let i = 0; i < P.count; i++) { p.push(P.getX(i), P.getY(i), P.getZ(i)); uv.push(UV.getX(i), UV.getY(i)); m.push(seed, R * 4.0); }
      g.dispose();
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('aM', new T.Float32BufferAttribute(m, 2));
    mist = new T.Mesh(g, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMist: { value: cur.mist }, uMistAmt: U.mistAmt },
      vertexShader: 'attribute vec2 aM; varying vec2 vUv; varying vec2 vM; void main(){ vUv = uv; vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime, uMistAmt; uniform vec3 uMist; varying vec2 vUv; varying vec2 vM;
        ${NOISE}
        void main(){
          float x = vUv.x * vM.y + uTime * (1.5 + vM.x * 2.0);
          float n = vn(vec3(x*0.012, vUv.y*1.4 + vM.x*9.0, uTime*0.02)) * 0.65 + vn(vec3(x*0.04, vUv.y*3.0 + vM.x*5.0, 0.0)) * 0.35;
          float prof = 1.0 - smoothstep(0.1, 0.95, vUv.y);
          float a = smoothstep(0.25, 0.7, n*0.6 + prof*0.55) * prof;
          a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          gl_FragColor = vec4(uMist * (0.95 + 0.1*n), clamp(a * 0.8 * uMistAmt, 0.0, 0.85));
        }`,
      transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
    }));
    mist.renderOrder = 1;
    return mist;
  }

  // ── Fireflies, golden motes, embers ────────────────────────────────────────
  function buildFly(rand) {
    const N = 140, p = [], a = [];
    for (let i = 0; i < N; i++) {
      p.push((rand() * 2 - 1) * 16, 0.3 + rand() * 4.5, -rand() * 44 + 4);
      a.push(rand(), 0.5 + rand(), i % 3 === 0 ? 1 : 0, 1 + rand() * 1.5);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('aS', new T.Float32BufferAttribute(a, 4));
    fly = new T.Points(g, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCam: { value: new T.Vector3() }, uFire: U.fireAmt, uEmber: U.embers, uCol: { value: cur.fire } },
      vertexShader: `
        attribute vec4 aS; uniform float uTime, uFire, uEmber; uniform vec3 uCam; varying float vI; varying float vT;
        void main(){
          vec3 p = position; float ph = aS.x * 6.2832;
          if (aS.z < 0.5) {
            p += vec3(sin(uTime*0.5*aS.y + ph)*1.6, sin(uTime*0.8*aS.y + ph*1.7)*0.5, cos(uTime*0.45*aS.y + ph*0.7)*1.6);
            vI = uFire * smoothstep(0.1, 0.9, sin(uTime*1.7*aS.y + ph*3.0)*0.5 + 0.5);
          } else {
            p.y = mod(p.y + uTime*(0.5 + aS.y*0.5), 7.0);
            p.x += sin(uTime*1.1 + ph)*0.6;
            vI = uEmber * smoothstep(7.0, 3.0, p.y) * (0.6 + 0.4*sin(uTime*6.0 + ph));
          }
          vT = aS.z;
          vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 16.0, 32.0) - 16.0, uCam.y - 1.65 + p.y, uCam.z + mod(p.z - uCam.z + 40.0, 44.0) - 40.0);
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          float dist = -mv.z;
          vI *= smoothstep(42.0, 18.0, dist) * smoothstep(0.8, 2.0, dist);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vI > 0.03 ? clamp(aS.w * 14.0 / dist, 1.0, 3.0) : 0.0;
        }`,
      fragmentShader: `
        uniform vec3 uCol; varying float vI; varying float vT;
        void main(){ vec3 c = vT > 0.5 ? vec3(1.0, 0.45, 0.12) : uCol; gl_FragColor = vec4(c * vI * 2.5, 1.0); }`,
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false,
    }));
    fly.frustumCulled = false;
    return fly;
  }

  // ── Celebration: sky sparkles ──────────────────────────────────────────────
  function buildSpark(rand) {
    const N = 160, p = [], a = [];
    for (let i = 0; i < N; i++) {
      const az = (rand() * 2 - 1) * 0.85, el = 0.05 + rand() * 0.5, R = 160;
      p.push(Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, -Math.cos(az) * Math.cos(el) * R);
      a.push(rand() * 1.1, 0.5 + rand() * 0.5, rand(), 2 + Math.floor(rand() * 3));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('aS', new T.Float32BufferAttribute(a, 4));
    spark = new T.Points(g, new T.ShaderMaterial({
      uniforms: { uT: { value: 99 } },
      vertexShader: `
        attribute vec4 aS; uniform float uT; varying float vI; varying float vH;
        void main(){
          float age = (uT - aS.x) / aS.y;
          vI = age > 0.0 && age < 1.0 ? sin(age*3.1416) : 0.0;
          vH = aS.z;
          vec3 p = position + vec3(0.0, -age*6.0, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vI > 0.02 ? aS.w + 2.0 : 0.0;
        }`,
      fragmentShader: `
        varying float vI; varying float vH;
        void main(){
          vec2 d = abs(gl_PointCoord - 0.5);
          float s = step(min(d.x, d.y), 0.12) * step(max(d.x, d.y), 0.5) + step(max(d.x, d.y), 0.2);
          vec3 c = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 1.0, 0.9), vH);
          gl_FragColor = vec4(c * 2.5 * vI * min(s, 1.0), 1.0);
        }`,
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false,
    }));
    spark.visible = false; spark.frustumCulled = false;
    return spark;
  }

  // ── Celebration: fireworks ─────────────────────────────────────────────────
  const NB = 8;
  function buildFireworks(rand) {
    const per = 110, p = [], a = [];
    for (let b = 0; b < NB; b++) for (let i = 0; i < per; i++) {
      const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u);
      p.push(Math.cos(th) * s, u, Math.sin(th) * s);
      a.push(b, 0.7 + rand() * 0.3, rand(), i < 8 ? 1 : 0);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('aS', new T.Float32BufferAttribute(a, 4));
    const bursts = [], cols = [];
    for (let i = 0; i < NB; i++) { bursts.push(new T.Vector4(0, 0, 0, -99)); cols.push(new T.Color()); }
    U.bursts = bursts; U.bcols = cols;
    fw = new T.Points(g, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uB: { value: bursts }, uC: { value: cols } },
      vertexShader: `
        attribute vec4 aS; uniform float uTime; uniform vec4 uB[${NB}]; uniform vec3 uC[${NB}]; varying vec3 vC;
        void main(){
          int bi = int(aS.x + 0.5); vec4 b = uB[bi]; float age = uTime - b.w;
          vec3 p = b.xyz; float I = 0.0;
          if (age > -0.9 && age < 0.0) {                 // rising rocket trail (a few points)
            p.y += age * 60.0 - aS.z * 6.0; I = aS.w * 0.8;
          } else if (age >= 0.0 && age < 2.8) {
            float r = 58.0 * aS.y * (1.0 - exp(-age*2.4));
            p += position * r + vec3(0.0, -4.0*age*age, 0.0);
            I = smoothstep(0.0, 0.2, age) * (1.0 - smoothstep(1.3, 2.8, age)) * (0.75 + 0.25*sin(age*9.0 + aS.z*30.0));
          }
          vC = mix(uC[bi], vec3(1.0, 0.95, 0.8), aS.z*0.3) * I * 2.4;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = I > 0.02 ? (aS.z > 0.6 ? 3.0 : 2.0) : 0.0;
        }`,
      fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false,
    }));
    fw.visible = false; fw.frustumCulled = false;
    return fw;
  }
  const FW_COLS = [0xff5a8a, 0xffd23a, 0x5ae0ff, 0x8aff6a, 0xc07aff, 0xff9a3a, 0xffffff, 0x6aa8ff];
  function burst(when) {
    const i = S.slot++ % NB, b = U.bursts[i];
    const cd = castleDist() + 30, az = CASTLE_AZ + (Math.random() * 2 - 1) * 0.16;
    b.set(Math.sin(az) * cd, 150 + Math.random() * 90, -Math.cos(az) * cd, when);
    U.bcols[i].setHex(FW_COLS[Math.floor(Math.random() * FW_COLS.length)]);
    fw.visible = true; S.fwOff = when + 3.2;
  }

  // ── Birds ──────────────────────────────────────────────────────────────────
  function buildBirds(rand) {
    const p = [], a = [];
    for (let i = 0; i < 11; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      p.push(-row * 5 + rand() * 1.5, (i ? side * row * 3.2 : 0) * 0.5 + rand(), side * row * 2);
      a.push(rand() * 6.28, 0.8 + rand() * 0.4);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('aB', new T.Float32BufferAttribute(a, 2));
    birds = new T.Points(g, new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uBirds: U.birds, uCol: { value: cur.bird } },
      vertexShader: `
        attribute vec2 aB; uniform float uTime, uBirds; varying float vF;
        void main(){
          float t = uTime * 7.0;
          vec3 c = vec3(mod(t, 520.0) - 260.0, 58.0 + sin(uTime*0.25)*8.0, -210.0);
          vec3 p = c + position * 2.2 + vec3(0.0, sin(uTime*1.3 + aB.x)*1.2, 0.0);
          vF = sin(uTime*7.0*aB.y + aB.x);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uBirds > 0.05 ? 6.0 : 0.0;
        }`,
      fragmentShader: `
        uniform vec3 uCol; uniform float uBirds; varying float vF;
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float y = vF > 0.0 ? -0.55*abs(p.x) + 0.15 : 0.35*abs(p.x) - 0.1;
          if (abs(p.y - y) > 0.26 || abs(p.x) > 0.95) discard;
          gl_FragColor = vec4(uCol, uBirds);
        }`,
      transparent: true, depthWrite: false, fog: false,
    }));
    birds.frustumCulled = false;
    return birds;
  }

  // ── Friendly dragon ────────────────────────────────────────────────────────
  function bakeMesh(parts, side) {
    const p = [], c = [], L = new T.Vector3(0.35, 0.8, 0.55).normalize();
    parts.forEach(([g, m, hex, glow]) => {
      const ng = g.index ? g.toNonIndexed() : g.clone(); ng.applyMatrix4(m); ng.computeVertexNormals();
      const P = ng.attributes.position, N = ng.attributes.normal, col = new T.Color(hex);
      for (let i = 0; i < P.count; i++) {
        _n.set(N.getX(i), N.getY(i), N.getZ(i));
        const l = glow ? 1 : 0.58 + 0.5 * Math.max(0, _n.dot(L)) + 0.12 * Math.max(0, _n.z);
        p.push(P.getX(i), P.getY(i), P.getZ(i)); c.push(col.r * l, col.g * l, col.b * l);
      }
      ng.dispose();
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    return new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: side || T.FrontSide }));
  }
  function buildDragon() {
    const sph = new T.SphereGeometry(1, 14, 10), cone = new T.ConeGeometry(1, 1, 8);
    const m = (x, y, z, sx, sy, sz, rx, ry, rz) => M4(x, y, z, sx, sy, sz, rx, ry, rz).clone();
    const G = 0x62d86a, GL = 0x9cf09a, BELLY = 0xffe39a, PUR = 0xb070e8, WHITE = 0xffffff, INK = 0x1c1830;
    const parts = [
      [sph, m(0, 0, 0, 2.3, 1.7, 1.7), G], [sph, m(0.35, -0.5, 0.2, 1.8, 1.15, 1.45), BELLY],
      [sph, m(2.7, 1.25, 0, 1.45, 1.35, 1.35), G], [sph, m(3.85, 0.9, 0, 0.95, 0.72, 0.85), GL],
      [sph, m(4.55, 1.1, 0.35, 0.12, 0.12, 0.12), INK], [sph, m(4.55, 1.1, -0.35, 0.12, 0.12, 0.12), INK],
      [sph, m(3.15, 1.75, 0.8, 0.55, 0.6, 0.45), WHITE, 1], [sph, m(3.15, 1.75, -0.8, 0.55, 0.6, 0.45), WHITE, 1],
      [sph, m(3.45, 1.78, 1.05, 0.3, 0.36, 0.26), INK, 1], [sph, m(3.45, 1.78, -1.05, 0.3, 0.36, 0.26), INK, 1],
      [sph, m(3.55, 1.92, 1.22, 0.1, 0.1, 0.1), WHITE, 1], [sph, m(3.55, 1.92, -1.22, 0.1, 0.1, 0.1), WHITE, 1],
      [sph, m(3.4, 0.9, 1.05, 0.32, 0.22, 0.2), 0xff90b0, 1], [sph, m(3.4, 0.9, -1.05, 0.32, 0.22, 0.2), 0xff90b0, 1],
      [cone, m(2.3, 2.75, 0.55, 0.28, 0.9, 0.28, 0, 0, 0.45), BELLY], [cone, m(2.3, 2.75, -0.55, 0.28, 0.9, 0.28, 0, 0, 0.45), BELLY],
      [sph, m(-2.3, -0.2, 0, 1.1, 0.85, 0.85), G], [sph, m(-3.5, -0.1, 0, 0.75, 0.55, 0.55), G], [sph, m(-4.4, 0.15, 0, 0.5, 0.38, 0.38), G],
      [cone, m(-5.1, 0.35, 0, 0.55, 0.9, 0.2, 0, 0, 1.2), PUR],
      [sph, m(1.2, -1.45, 0.8, 0.45, 0.5, 0.45), G], [sph, m(-0.9, -1.4, 0.8, 0.45, 0.5, 0.45), G],
      [sph, m(1.2, -1.45, -0.8, 0.45, 0.5, 0.45), G], [sph, m(-0.9, -1.4, -0.8, 0.45, 0.5, 0.45), G],
    ];
    [[-1.4, 1.35], [-0.2, 1.7], [1.0, 1.72], [-2.5, 0.75], [-3.6, 0.55]].forEach(([x, y]) => parts.push([cone, m(x, y + 0.2, 0, 0.3, 0.7, 0.3, 0, 0, 0.35), PUR]));
    const body = bakeMesh(parts);
    // wing: scalloped membrane, span along +Y from the root
    const sh = new T.Shape();
    sh.moveTo(0.9, 0); sh.lineTo(1.9, 2.6); sh.lineTo(1.4, 5.2); sh.lineTo(0.5, 4.0); sh.lineTo(-0.3, 4.4);
    sh.lineTo(-0.7, 2.9); sh.lineTo(-1.6, 2.7); sh.lineTo(-1.5, 0);
    const wg = new T.ShapeGeometry(sh);
    const wingMesh = () => { const w = bakeMesh([[wg, m(0, 0, 0, 1, 1, 1), PUR, 1]], T.DoubleSide);
      const cc = w.geometry.attributes.color, pp = w.geometry.attributes.position;
      for (let i = 0; i < cc.count; i++) { const k = 0.8 + 0.12 * pp.getY(i); cc.setXYZ(i, cc.getX(i) * k, cc.getY(i) * k, cc.getZ(i) * k); }
      return w; };
    dragon = new T.Group();
    dragon.add(body);
    wingN = new T.Group(); wingN.position.set(0.3, 1.1, 0.7); wingN.add(wingMesh());
    wingF = new T.Group(); wingF.position.set(0.3, 1.1, -0.7); wingF.add(wingMesh());
    dragon.add(wingN, wingF);
    dragon.scale.setScalar(2.1);
    dragon.visible = false;
    [sph, cone].forEach(g => g.dispose());
    return dragon;
  }
  const DR = { dur: 9.0 };
  function dragonPos(s, out) {           // flight path in far-group space: in from the left, a loop, then past the castle
    const z = -85, y0 = 12, lx = -38, R = 13;
    if (s < 2.4) return out.set(-120 + s * 34, y0 + Math.sin(s * 1.3) * 3, z);
    if (s < 4.8) { const th = -Math.PI / 2 + (s - 2.4) / 2.4 * TAU; return out.set(lx + Math.cos(th) * R, y0 + R + Math.sin(th) * R, z); }
    const k = s - 4.8; return out.set(lx + k * 36, y0 + 1 + Math.sin(k * 1.4) * 3 + k * 1.5, z);
  }

  // ── Lights + fog ───────────────────────────────────────────────────────────
  function buildLights(scene) {
    hemi = new T.HemisphereLight(0xffffff, 0x446622, 1.5);
    sun = new T.DirectionalLight(0xffffff, 1.7); sun.position.set(-30, 70, 45);
    amb = new T.AmbientLight(0x403050, 0.3);
    scene.add(hemi, sun, sun.target, amb);
    scene.fog = new T.Fog(0x9888c8, 45, 190);
    scene.background = new T.Color(0x9888c8);
  }

  function castleDist() { return CASTLE_D0 + (CASTLE_D1 - CASTLE_D0) * S.prog; }

  // ── Public API ─────────────────────────────────────────────────────────────
  function init(c) {
    core = c; camera = c.camera;
    const scene = c.scene, rand = AK.rng ? AK.rng(9187) : Math.random;
    for (const k in MOODS) M[k] = toMood(MOODS[k]);
    cur = toMood(MOODS.title); from = toMood(MOODS.title); to = M.title;
    UK.forEach(k => { U[k] = { value: cur[k] }; });
    buildDome(scene);
    buildLights(scene);
    far = new T.Group();
    const lands = new T.Mesh(buildLands(rand), farMaterial());
    lands.frustumCulled = false;
    far.add(lands);
    far.add(buildCastle(rand));
    castle.traverse(o => { o.frustumCulled = false; });
    far.add(buildMist());
    far.add(buildSpark(rand), buildFireworks(rand), buildBirds(rand), buildDragon());
    scene.add(far);
    scene.add(buildFly(rand));
    castle.position.set(Math.sin(CASTLE_AZ) * CASTLE_D0, 0, -Math.cos(CASTLE_AZ) * CASTLE_D0);
    apply();
  }

  function apply() {
    const d = U.dome;
    d.uCover.value = cur.cover; d.uCloud.value = cur.cloud; d.uRimAmt.value = cur.rimAmt; d.uGlowAmt.value = cur.glowAmt;
    d.uSunSize.value = cur.sunSize; d.uSunAmt.value = cur.sunAmt; d.uMoon.value = cur.moon; d.uStars.value = cur.stars;
    d.uAurora.value = cur.aurora; d.uRainbow.value = cur.rainbow; d.uRays.value = cur.rays;
    for (let i = 0; i < UK.length; i++) U[UK[i]].value = cur[UK[i]];
    const sc = core.scene;
    sc.fog.color.copy(cur.fog); sc.fog.near = cur.fogNear; sc.fog.far = cur.fogFar; sc.background.copy(cur.fog);
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGnd); hemi.intensity = cur.hemiI;
    sun.color.copy(cur.dirCol); sun.intensity = cur.dirI;
    amb.color.copy(cur.amb); amb.intensity = cur.ambI;
    birds.visible = cur.birds > 0.02;
  }

  function setMood(name, seconds) {
    if (!M[name]) return;
    copyMood(from, cur); to = M[name]; S.mood = name;
    S.md = Math.max(0.001, seconds || 0); S.mt = 0;
    if (!(seconds > 0)) { copyMood(cur, to); S.mt = S.md; apply(); }
  }

  function update(dt, c) {
    const t = c.time;
    U.uTime.value = t;
    // mood tween
    if (S.mt < S.md) {
      S.mt = Math.min(S.md, S.mt + dt);
      let e = S.mt / S.md; e = e * e * (3 - 2 * e);
      for (const k in to) {
        const a = from[k], b = to[k];
        if (b.isColor) cur[k].lerpColors(a, b, e);
        else if (b.isVector3) cur[k].lerpVectors(a, b, e).normalize();
        else cur[k] = a + (b - a) * e;
      }
      apply();
    }
    // follow the camera
    const cp = camera.position;
    dome.position.copy(cp);
    far.position.set(cp.x, cp.y - 1.65, cp.z);
    fly.material.uniforms.uCam.value.copy(cp);
    S.prog += ((c.progress || 0) - S.prog) * Math.min(1, dt * 0.6);
    const D = castleDist();
    castle.position.set(Math.sin(CASTLE_AZ) * D, 0, -Math.cos(CASTLE_AZ) * D);
    // soft lightning glow in the storm (slow swell, never a strobe)
    if (cur.storm > 0.5) {
      S.nextFlash -= dt;
      if (S.nextFlash <= 0 && S.flash < 0) {
        S.flash = 0; S.nextFlash = 15 + Math.random() * 12;
        U.uFlashDir.value.set((Math.random() * 2 - 1) * 0.8, 0.15 + Math.random() * 0.3, -1).normalize();
      }
    }
    if (S.flash >= 0) {
      S.flash += dt;
      const k = S.flash / 1.6;
      U.uFlash.value = k < 1 ? Math.pow(Math.sin(k * Math.PI), 2) * 0.9 : 0;
      if (k >= 1) S.flash = -1;
    }
    if (S.restore && t >= S.restore) { S.restore = 0; if (to === M._tmp) setMood(S.back, 2.5); }
    // sparkles
    if (spark.visible) { S.sparkT += dt; spark.material.uniforms.uT.value = S.sparkT; if (S.sparkT > 2.4) spark.visible = false; }
    // fireworks queue (bursts at least 0.4 s apart)
    while (S.bq.length && S.bq[0] <= t) { S.bq.shift(); burst(t + 0.9); }
    if (S.mood === 'victory' && S.mt >= S.md) { S.vic -= dt; if (S.vic <= 0) { S.vic = 1.4 + Math.random(); burst(t + 0.9); } }
    if (fw.visible && t > S.fwOff && !S.bq.length) fw.visible = false;
    // dragon
    if (S.dragonT >= 0) {
      S.dragonT += dt;
      const s = S.dragonT;
      if (s > DR.dur) { S.dragonT = -1; dragon.visible = false; }
      else {
        dragonPos(s, tmpV); dragonPos(s + 0.05, tmpV2);
        dragon.position.copy(tmpV);
        dragon.rotation.set(0, -0.5, Math.atan2(tmpV2.y - tmpV.y, tmpV2.x - tmpV.x), 'XYZ');
        const f = Math.sin(s * TAU * 1.1);
        wingN.rotation.x = 0.75 + f * 0.6; wingF.rotation.x = -(0.75 + f * 0.6);
      }
    }
  }

  function celebrate(kind) {
    const t = core.time;
    spark.visible = true; S.sparkT = 0;
    const sh = U.uShoot.value;
    for (let i = 0; i < 2; i++) sh[i].set(-0.7 + Math.random() * 0.9, 0.35 + Math.random() * 0.2, t + i * 0.5, -0.45 - Math.random() * 0.3);
    if (kind === 'big') {
      for (let i = 0; i < 7; i++) S.bq.push(t + 0.3 + i * 0.85 + Math.random() * 0.3);
      S.dragonT = 0; dragon.visible = true;
      if (S.mood !== 'victory') {
        const back = S.mood; M._tmp = M._tmp || toMood(MOODS.victory);
        copyMood(M._tmp, M[back]); M._tmp.rainbow = 1;
        setMood('_tmp', 1.2); S.mood = back;
        S.restore = t + 7.5; S.back = back;
      }
    }
  }

  AK.sky = { init, update, setMood, celebrate, _dbg: { S, U } };
})();
