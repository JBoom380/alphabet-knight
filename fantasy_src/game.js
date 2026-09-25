// ─── CORE: renderer, camera, input, state machine ────────────────────────────
(function () {
  const C = AK.config;
  const T = THREE;
  const has = (m, fn) => AK[m] && typeof AK[m][fn] === 'function' && !(AK._broken && AK._broken[m]);
  // A crash inside one module disables that module instead of stopping the game.
  AK._broken = {};
  function guard(m) {
    const mod = AK[m]; if (!mod) return;
    Object.keys(mod).forEach(k => {
      const f = mod[k]; if (typeof f !== 'function') return;
      mod[k] = function () {
        try { return f.apply(mod, arguments); }
        catch (e) { console.error(`[AK.${m}.${k}]`, e); AK._broken[m] = true; }
      };
    });
  }
  ['audio', 'world', 'sky', 'creatures', 'hands', 'ui'].forEach(guard);

  // ── DOM ────────────────────────────────────────────────────────────────────
  const stage = document.getElementById('stage');
  const glCanvas = document.getElementById('gl');
  const pxCanvas = document.getElementById('px');
  const uiCanvas = document.getElementById('ui');
  pxCanvas.width = C.PIX_W; pxCanvas.height = C.PIX_H;
  uiCanvas.width = C.UI_W; uiCanvas.height = C.UI_H;
  const pxCtx = pxCanvas.getContext('2d');
  const uiCtx = uiCanvas.getContext('2d');
  pxCtx.imageSmoothingEnabled = false;

  function fit() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const s = Math.min(ww / 16, wh / 9);
    const w = Math.floor(s * 16), h = Math.floor(s * 9);
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.left = Math.floor((ww - w) / 2) + 'px'; stage.style.top = Math.floor((wh - h) / 2) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  // ── Renderer + pixel post pass ─────────────────────────────────────────────
  const renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(C.PIX_W, C.PIX_H, false);
  renderer.outputColorSpace = T.LinearSRGBColorSpace; // post pass does the sRGB encode itself

  const rt = new T.WebGLRenderTarget(C.PIX_W, C.PIX_H, {
    minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true, type: T.HalfFloatType,
  });
  const postScene = new T.Scene();
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new T.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uFade: { value: 1 }, uLevels: { value: 14.0 }, uRes: { value: new T.Vector2(C.PIX_W, C.PIX_H) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uFade; uniform float uLevels; uniform vec2 uRes;
      varying vec2 vUv;
      float bayer(vec2 p){
        int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)); int i = x + y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
        return 0.0;
      }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = aces(c * 1.05);
        c = pow(c, vec3(1.0/2.2));
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(l), c, 1.18);                       // a little extra saturation
        vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;  // vignette
        c += bayer(gl_FragCoord.xy) / uLevels;            // ordered dither
        c = floor(c * uLevels + 0.5) / uLevels;           // posterise
        gl_FragColor = vec4(c * uFade, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), postMat));

  // ── Scene + camera ─────────────────────────────────────────────────────────
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(62, 16 / 9, 0.1, 900);
  scene.add(camera);
  const torchLight = new T.PointLight(0xffa040, 6, 14, 1.6);
  torchLight.position.set(-0.55, -0.25, -0.6);
  camera.add(torchLight);

  const core = AK.core = {
    THREE: T, scene, camera, renderer, time: 0, dt: 0, camZ: 0, phase: null, state: 'TITLE',
    torchLight, progress: 0,
  };

  // ── Fallbacks so any module can be missing ─────────────────────────────────
  const pathX = z => (has('world', 'pathX') ? AK.world.pathX(z) : 0);
  const heightAt = (x, z) => (has('world', 'heightAt') ? AK.world.heightAt(x, z) : 0);
  const audio = {
    init: () => has('audio', 'init') && AK.audio.init(),
    music: n => has('audio', 'setMusic') && AK.audio.setMusic(n),
    sfx: n => has('audio', 'sfx') && AK.audio.sfx(n),
    speak: (t, o) => (has('audio', 'speak') ? AK.audio.speak(t, o) : fallbackSpeak(t)),
  };
  function fallbackSpeak(text) {
    if (!window.speechSynthesis) return Promise.resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; u.pitch = 1.15;
    speechSynthesis.speak(u);
    return new Promise(r => { u.onend = r; setTimeout(r, 4000); });
  }

  if (has('world', 'init')) AK.world.init(core);
  else {
    const g = new T.Mesh(new T.PlaneGeometry(400, 12000), new T.MeshLambertMaterial({ color: 0x4a8a3a }));
    g.rotation.x = -Math.PI / 2; g.position.z = -5800; scene.add(g);
  }
  if (has('sky', 'init')) AK.sky.init(core);
  else {
    scene.background = new T.Color(0x2a1a4a);
    scene.fog = new T.Fog(0x6a5a8a, 30, 180);
    scene.add(new T.HemisphereLight(0xb0a0ff, 0x304020, 1.2));
    const sun = new T.DirectionalLight(0xffffff, 1.2); sun.position.set(30, 60, 20); scene.add(sun);
  }
  if (has('hands', 'init')) AK.hands.init();

  function fallbackCreature(spec) {
    const group = new T.Group();
    const body = new T.Mesh(new T.SphereGeometry(0.8, 16, 12), new T.MeshLambertMaterial({ color: spec.color }));
    body.position.y = 0.8; group.add(body);
    return { group, height: 1.6, walking: false, update() {}, setProgress() {}, hit() {}, poof() { group.visible = false; return 0.6; }, dispose() {} };
  }

  // ── Game state ─────────────────────────────────────────────────────────────
  // Learn is the default: the child must find the right answer. Easy (any tap strikes) is opt-in from the menu and is remembered.
  function savedMode() { try { return localStorage.getItem('akMode') === 'easy' ? 'easy' : 'learn'; } catch (e) { return 'learn'; } }
  const G = {
    mode: savedMode(), phase: null, index: 0, total: 0, items: [], creature: null, creatureZ: 0,
    wordPos: 0, busy: false, hint: 0, wrongs: 0, meetTime: 0, choices: null,
    stateTime: 0, fade: 1, fadeTarget: 1, lastCorrect: -99, stepT: 0, bob: 0, speed: 0, muted: false,
    screen: 'title', nextPhaseAt: 0, pendingTimers: [], armed: {}, lastWrongSay: -99,
  };
  const MEET_DIST = 4.6, SPAWN_DIST = 30, WALK_SPEED = 4.2, CREATURE_SPEED = 3.2;

  function later(sec, fn) {
    const id = setTimeout(() => { G.pendingTimers = G.pendingTimers.filter(x => x !== id); fn(); }, sec * 1000);
    G.pendingTimers.push(id); return id;
  }
  function clearTimers() { G.pendingTimers.forEach(clearTimeout); G.pendingTimers = []; }

  function setState(s) { core.state = s; G.stateTime = 0; }

  function buildItems(phase) {
    if (phase === 'LETTERS') return C.LETTERS.map((L, i) => ({ kind: 'letter', label: L.k, color: L.color, icon: L.icon, word: L.word, index: i, xEnds: L.xEnds }));
    if (phase === 'WORDS') return C.WORDS.map((W, i) => ({ kind: 'word', label: W.w, color: W.color, icon: W.icon, index: i }));
    if (phase === 'NUMBERS') return C.NUMBERS.map((N, i) => ({ kind: 'number', label: N.k, color: N.color, count: +N.k, name: N.name, index: i }));
    return C.makeMath().map((p, i) => ({ kind: 'math', label: `${p.a}${p.op}${p.b}`, color: C.MATH_COLORS[i % C.MATH_COLORS.length], count: p, ans: String(p.ans), index: i }));
  }

  const item = () => G.items[G.index];
  function expectedKey() {
    const it = item(); if (!it) return null;
    if (it.kind === 'word') return it.label[G.wordPos];
    if (it.kind === 'math') return it.ans;
    return it.label;
  }
  const isDigitPhase = () => G.phase === 'NUMBERS' || G.phase === 'MATH';

  function makeChoices() {
    const right = expectedKey();
    const pool = isDigitPhase() ? '0123456789'.split('') : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const others = pool.filter(k => k !== right).sort(() => Math.random() - 0.5).slice(0, 2);
    const colors = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98'];
    return [right, ...others].sort(() => Math.random() - 0.5).map((k, i) => ({ text: k, color: colors[(G.index + i) % colors.length] }));
  }

  function numWord(d) { return C.NUMBER_WORDS[+d]; }
  function mathSay(p) { return `${numWord(p.a)} ${p.op === '+' ? 'plus' : 'take away'} ${numWord(p.b)}`; }

  // ── Phase flow ─────────────────────────────────────────────────────────────
  const PHASE_SAY = {
    LETTERS: 'Letters! Let\'s go on a quest, brave knight!',
    WORDS: 'Words! Let\'s spell some words!',
    NUMBERS: 'Numbers! Let\'s count!',
    MATH: 'Adding and taking away! You can do it!',
  };
  const PHASE_DONE_SAY = {
    LETTERS: 'You found every letter! Hooray!',
    WORDS: 'You spelled every word! Amazing!',
    NUMBERS: 'You know all your numbers! Wonderful!',
    MATH: 'You solved them all!',
  };

  function startPhase(phase) {
    clearTimers();
    removeCreature();
    G.phase = core.phase = phase;
    G.items = buildItems(phase); G.total = G.items.length; G.index = 0; G.wordPos = 0;
    core.progress = 0;
    G.screen = 'phaseIntro';
    setState('PHASE_INTRO');
    audio.music(phase);
    if (has('sky', 'setMood')) AK.sky.setMood(phase, 3);
    audio.speak(PHASE_SAY[phase]);
    later(2.8, () => { G.screen = 'play'; setState('WALK'); spawnCreature(); });
  }

  function spawnCreature() {
    const it = item(); if (!it) return;
    const spec = { kind: it.kind, label: it.label, color: it.color, icon: it.icon, index: it.index, count: it.count };
    const cr = has('creatures', 'create') ? AK.creatures.create(spec) : fallbackCreature(spec);
    G.creature = cr; G.creatureZ = core.camZ - SPAWN_DIST; G.wordPos = 0; G.hint = 0; G.wrongs = 0;
    cr.walking = true;
    scene.add(cr.group);
    placeCreature();
  }

  function removeCreature() {
    if (!G.creature) return;
    scene.remove(G.creature.group);
    try { G.creature.dispose(); } catch (e) {}
    G.creature = null;
  }

  function placeCreature() {
    const cr = G.creature; if (!cr) return;
    const x = pathX(G.creatureZ);
    cr.group.position.set(x, heightAt(x, G.creatureZ), G.creatureZ);
    const cx = camera.position.x, cz = camera.position.z;
    cr.group.rotation.y = Math.atan2(cx - x, cz - G.creatureZ);
  }

  function onMeet() {
    setState('MEET');
    G.meetTime = core.time;
    G.creature.walking = false;
    G.choices = G.mode === 'learn' ? makeChoices() : null;
    const it = item();
    const learn = G.mode === 'learn';
    if (it.kind === 'letter') audio.speak(learn ? `Find the letter ${it.label}!` : `${it.label}!`);
    else if (it.kind === 'word') audio.speak(`Let's spell ${it.label.toLowerCase()}! ${it.label[0]}!`);
    else if (it.kind === 'number') audio.speak(learn ? `Find the number ${it.name}!` : `${it.name}!`);
    else audio.speak(`${mathSay(it.count)}. How many?`);
  }

  function tryStrike(key) {
    if (core.state !== 'MEET' || G.busy) return;
    const exp = expectedKey();
    if (G.mode === 'learn' && key !== exp) { wrong(key); return; }
    strike();
  }

  function wrong(key) {
    if (has('hands', 'nudge')) AK.hands.nudge();
    audio.sfx('nudge');
    G.wrongs++;
    G.hint = Math.min(2, G.hint + 1);
    const exp = expectedKey();
    const it = item();
    const name = isDigitPhase() ? numWord(exp) : exp;
    const heard = key ? (isDigitPhase() ? numWord(key) : key) : '';
    if (core.time - G.lastWrongSay < 3.5) return; // mashing: sound only, no speech pile-up
    G.lastWrongSay = core.time;
    if (it.kind === 'math') audio.speak(G.wrongs > 2 ? mathSay(it.count) : `Let's count! ${mathSay(it.count)}.`);
    else audio.speak(G.wrongs > 2 ? `${name}!` : `${heard ? heard + '. ' : ''}Find ${name}!`);
  }

  function strike() {
    G.busy = true;
    const it = item();
    const t = has('hands', 'swing') ? AK.hands.swing() : 0.14;
    audio.sfx('swing');
    later(t, () => {
      const cr = G.creature; if (!cr) return;
      cr.hit(); audio.sfx('hit');
      G.lastCorrect = core.time;
      if (it.kind === 'word') {
        const letter = it.label[G.wordPos];
        G.wordPos++;
        cr.setProgress(G.wordPos);
        if (G.wordPos < it.label.length) {
          audio.speak(letter);
          later(0.45, () => { G.busy = false; G.hint = 0; G.wrongs = 0; G.meetTime = core.time; G.choices = G.mode === 'learn' ? makeChoices() : null; });
          return;
        }
        const spelled = it.label.split('').join(', ');
        finishCreature(`${spelled}. ${it.label.toLowerCase()}!`);
      } else if (it.kind === 'letter') {
        finishCreature(it.xEnds ? `${it.word} ends with ${it.label}!` : `${it.label} is for ${it.word}!`);
      } else if (it.kind === 'number') {
        finishCreature(G.mode === 'learn' ? `${it.name}!` : `Yes! ${it.name}!`);
      } else {
        finishCreature(`${mathSay(it.count)} is ${numWord(it.ans)}!`);
      }
    });
  }

  function finishCreature(line) {
    setState('POOF');
    G.choices = null;
    const praise = Math.random() < 0.35 ? ' ' + C.PRAISE[Math.floor(Math.random() * C.PRAISE.length)] : '';
    audio.speak(line + praise);
    later(0.35, () => {
      const cr = G.creature; if (!cr) return;
      const d = cr.poof(); audio.sfx('poof');
      if (has('sky', 'celebrate')) AK.sky.celebrate('small');
      later(Math.max(0.6, d), () => {
        removeCreature();
        G.busy = false;
        G.index++;
        core.progress = G.index / G.total;
        if (G.index >= G.total) { phaseDone(); return; }
        if (core.camZ < -5500) { teleportHome(() => { setState('WALK'); spawnCreature(); }); return; }
        setState('WALK'); spawnCreature();
      });
    });
  }

  function phaseDone() {
    setState('PHASE_DONE');
    G.screen = 'phaseDone';
    if (has('hands', 'cheer')) AK.hands.cheer();
    if (has('sky', 'celebrate')) AK.sky.celebrate('big');
    audio.sfx('fanfare');
    audio.speak(PHASE_DONE_SAY[G.phase]);
    const i = C.PHASES.indexOf(G.phase);
    G.nextPhaseAt = core.time + 7;
    later(7, advanceFromDone);
    if (i === C.PHASES.length - 1) G.nextPhaseAt = core.time + 5;
  }

  function advanceFromDone() {
    if (core.state !== 'PHASE_DONE') return;
    const i = C.PHASES.indexOf(G.phase);
    if (i < C.PHASES.length - 1) startPhase(C.PHASES[i + 1]);
    else victory();
  }

  function victory() {
    clearTimers();
    setState('VICTORY'); G.screen = 'victory';
    audio.music('victory');
    if (has('sky', 'setMood')) AK.sky.setMood('victory', 3);
    if (has('sky', 'celebrate')) AK.sky.celebrate('big');
    if (has('hands', 'cheer')) AK.hands.cheer();
    audio.speak('You are a true knight! The whole kingdom cheers for you!');
  }

  function goMenu() {
    clearTimers(); removeCreature(); G.busy = false;
    G.phase = core.phase = null; G.screen = 'menu'; setState('MENU');
    audio.music('title');
    if (has('sky', 'setMood')) AK.sky.setMood('title', 2);
  }

  function teleportHome(then) {
    G.fadeTarget = 0;
    later(0.6, () => { core.camZ = 0; G.fadeTarget = 1; then(); });
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function view() {
    const it = item();
    let target = null;
    if (it) {
      if (it.kind === 'letter') target = { text: it.label + ' ' + it.label.toLowerCase(), sub: it.word, icon: it.icon, color: it.color };
      else if (it.kind === 'word') target = { text: it.label, sub: it.label[G.wordPos] || '', icon: it.icon, color: it.color };
      else if (it.kind === 'number') target = { text: it.label, sub: it.name, icon: '', color: it.color, count: it.count };
      else target = { text: `${it.count.a} ${it.count.op} ${it.count.b} = ?`, sub: '', icon: '', color: it.color, math: it.count };
    }
    return {
      screen: G.screen, phase: G.phase, mode: G.mode, index: G.index, total: G.total, target,
      choices: core.state === 'MEET' ? G.choices : null, hint: G.hint, wordProgress: G.wordPos,
      armed: { home: core.time - (G.armed.home || -99) < 2, mute: core.time - (G.armed.mute || -99) < 2 },
      muted: G.muted, lastCorrect: G.lastCorrect, fade: G.fade, state: core.state, expected: expectedKey(),
    };
  }

  function doAction(a) {
    if (!a) return false;
    audio.sfx('click');
    if (a.type === 'start') { goMenu(); return true; }
    if (a.type === 'phase') { startPhase(a.phase); return true; }
    if (a.type === 'mode') { G.mode = a.mode; try { localStorage.setItem('akMode', a.mode); } catch (e) {} audio.speak(a.mode === 'easy' ? 'Easy! Tap anything!' : 'Learn! Find the letter!'); return true; }
    if ((a.type === 'home' && core.state !== 'VICTORY') || a.type === 'mute') {
      if (!(core.time - (G.armed[a.type] || -99) < 2)) { G.armed[a.type] = core.time; return true; } // first tap only arms it
      G.armed[a.type] = -99;
    }
    if (a.type === 'home') { goMenu(); return true; }
    if (a.type === 'mute') { G.muted = !G.muted; if (has('audio', 'setMuted')) AK.audio.setMuted(G.muted); return true; }
    if (a.type === 'choice') { tryStrike(a.value); return true; }
    if (a.type === 'next') { if (G.stateTime > 2.5) advanceFromDone(); return true; }
    return false;
  }

  function anyPress(key) {
    audio.init();
    if (core.state === 'TITLE') { audio.sfx('click'); goMenu(); return; }
    if (core.state === 'MENU') return;
    if (core.state === 'MEET') { tryStrike(key); return; }
    if (core.state === 'PHASE_DONE' && G.stateTime > 5) { advanceFromDone(); return; }
  }

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'Escape') { if (core.state !== 'TITLE') goMenu(); return; }
    if (core.state === 'MENU') {
      audio.init();
      const n = '1234'.indexOf(e.key);
      if (n >= 0) startPhase(C.PHASES[n]);
      else if (e.key === 'Enter' || e.key === ' ') startPhase('LETTERS');
      return;
    }
    const k = e.key.length === 1 ? e.key.toUpperCase() : null;
    if (G.mode === 'learn' && core.state === 'MEET' && !(k && /^[A-Z0-9]$/.test(k))) return;
    anyPress(k);
  });

  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    audio.init();
    const r = uiCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * C.UI_W, y = (e.clientY - r.top) / r.height * C.UI_H;
    const a = has('ui', 'hit') ? AK.ui.hit(x, y, view()) : null;
    if (doAction(a)) return;
    if (core.state === 'MEET' && G.mode === 'learn') return; // learn mode needs a choice
    anyPress(null);
  });
  stage.addEventListener('contextmenu', e => e.preventDefault());

  // ── Loop ───────────────────────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    core.dt = dt; core.time += dt; G.stateTime += dt;

    const walking = core.state === 'WALK';
    const cruising = walking || core.state === 'TITLE' || core.state === 'MENU' || core.state === 'PHASE_INTRO';
    const targetSpeed = walking ? WALK_SPEED : cruising ? 1.2 : 0;
    G.speed += (targetSpeed - G.speed) * Math.min(1, dt * 3);
    core.camZ -= G.speed * dt;
    if (cruising && core.camZ < -5800 && core.state !== 'WALK') core.camZ = 0;

    if (walking) {
      G.stepT += dt;
      if (G.stepT > 0.6) { G.stepT = 0; audio.sfx('step'); }
    }

    // creature approach
    if (G.creature) {
      if (core.state === 'WALK') {
        G.creatureZ += CREATURE_SPEED * dt;
        if (G.creatureZ >= core.camZ - MEET_DIST) { G.creatureZ = core.camZ - MEET_DIST; onMeet(); }
      }
      G.creature.update(dt, core.time);
    }

    // hints grow gently with time in learn mode
    if (core.state === 'MEET' && G.mode === 'learn' && !G.busy) {
      const waited = core.time - G.meetTime;
      if (waited > 9 && G.hint < 1) G.hint = 1;
      if (waited > 18 && G.hint < 2) G.hint = 2;
    }

    // camera
    G.bob += G.speed * dt * 2.2;
    const z = core.camZ, x = pathX(z);
    const eye = heightAt(x, z) + 1.65 + Math.sin(G.bob * 2) * 0.035 * Math.min(1, G.speed / 2);
    camera.position.set(x + Math.sin(G.bob) * 0.03, eye, z);
    const lz = z - 10, lx = pathX(lz);
    let ly = heightAt(lx, lz) + 1.45;
    if (G.creature && core.state !== 'WALK') ly = heightAt(x, z) + 1.35;
    camera.lookAt(lx, ly, lz);
    placeCreature();

    // modules
    if (has('world', 'update')) AK.world.update(dt, core);
    if (has('sky', 'update')) AK.sky.update(dt, core);
    const flick = AK.hands && typeof AK.hands.flicker === 'number' ? AK.hands.flicker : 0.8 + Math.sin(core.time * 17) * 0.1;
    torchLight.intensity = 4.5 + flick * 3;

    // fade
    G.fade += (G.fadeTarget - G.fade) * Math.min(1, dt * 5);
    postMat.uniforms.uFade.value = G.fade;

    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);

    pxCtx.clearRect(0, 0, C.PIX_W, C.PIX_H);
    if (has('hands', 'draw') && core.state !== 'TITLE' && core.state !== 'MENU') {
      AK.hands.draw(pxCtx, core.time, { walking, speed: G.speed, state: core.state });
    }
    uiCtx.clearRect(0, 0, C.UI_W, C.UI_H);
    if (has('ui', 'draw')) AK.ui.draw(uiCtx, core.time, view());

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── Debug hooks ────────────────────────────────────────────────────────────
  AK.debug = {
    go(phase, mode) { if (mode) G.mode = mode; G.busy = false; startPhase(phase || 'LETTERS'); clearTimers(); G.screen = 'play'; setState('WALK'); spawnCreature(); },
    meet() { if (!G.creature) spawnCreature(); G.creatureZ = core.camZ - MEET_DIST; onMeet(); },
    strike() { if (core.state === 'MEET') strike(); },
    screen(name) { G.screen = name; if (name === 'menu') setState('MENU'); if (name === 'victory') setState('VICTORY'); if (name === 'phaseDone') setState('PHASE_DONE'); },
    walkTo(z) { core.camZ = z; },
    G, view,
  };
})();
