# Alphabet Knight: High Fantasy Edition. Shared build contract

Every builder reads this file first. Do not change another module's file. Do not change `game.js`, `config.js`, `dev.html`, `build.py` or this file. If you need a contract change, say so in your final report.

## Goal
A first-person, pixel-art, 3D high-fantasy rebuild of Alphabet Knight for children aged 2 to 5. Reference look: a first-person view down a cobblestone road. The left hand holds a burning torch and the right hand holds a sword. The world has green hills, round bushes, dark pine forests, timber-frame houses with red roofs, rolling mist banks, and a huge dark castle with lit windows on a far hill. The sky is a purple storm with green light at the cloud edges. Everything reads as chunky pixel art (low internal resolution, nearest-neighbour upscale, palette-quantised with ordered dithering). The goal is to amaze the user: rich, alive, animated, beautiful.

Audience rules (non-negotiable):
- Players are ages 2 to 5. Nothing scary. Creatures are cute, round, big-eyed, friendly. When struck they giggle and burst into sparkles, stars and butterflies. Nothing dies, nothing bleeds. No sudden loud sounds. No flashing faster than 3 Hz. Lightning, if any, is a soft slow glow, never a strobe.
- Big, high-contrast shapes. The target letter/number must be readable at a glance.
- No fail state, no timers, no score loss.

## Files and load order (classic scripts, no modules, no network, no CDN)
All code attaches to the global `window.AK`. The global `THREE` (r186) is loaded first.

1. `vendor/three.global.js`  (done)
2. `config.js`  (done) content tables: `AK.config`, `AK.rng(seed)`
3. `audio.js`  -> `AK.audio`
4. `world_ground.js` -> `AK.world`
5. `world_sky.js` -> `AK.sky`
6. `creatures.js` -> `AK.creatures`
7. `hands.js` -> `AK.hands`
8. `ui.js` -> `AK.ui`
9. `game.js`  (core, done) owns the loop, renderer, camera, input, and the state machine

`dev.html` loads them with `<script src>` (works from file://). `build.py` inlines everything into `../fantasy.html` (one file, works offline).
Rules: vanilla JS, ES2020, no external libraries except THREE, no network requests, no `fetch`, no image files. Generate every texture procedurally (canvas or DataTexture). Emoji may be drawn with `ctx.fillText` on 2D canvases.
Every module must tolerate the absence of every other module (core checks `if (AK.x && AK.x.fn)`).

## Colour pipeline
Do not set `renderer.toneMapping`. The core renders the scene into a linear HalfFloat target. The post pass applies ACES tone mapping, the sRGB encode, a small saturation boost, the vignette, the 4x4 Bayer dither and a 14-level posterise. Write colours as normal hex values (THREE converts them to linear). Set `texture.colorSpace = THREE.SRGBColorSpace` on every canvas texture. Because the image is posterised, use strong value contrast and bold colour blocks. Fine gradients band into pixel steps, and this is the intended look.
Core wraps every public module function in try/catch. A throw disables only that module and logs `[AK.module.fn]` to the console.

## Screen layers (stacked, all letterboxed to 16:9 and scaled to fill the window)
- `#gl` WebGL canvas. The scene renders to a 480x270 render target. A post pass (core) applies palette quantisation + 4x4 Bayer dither and a vignette. It is then shown pixelated.
- `#px` 2D canvas, 480x270, pixelated. First-person hands (`AK.hands`). Same pixel size as the 3D view.
- `#ui` 2D canvas, 1280x720, crisp. All UI and text (`AK.ui`).

## World coordinates
Units are metres. +Y is up. The player walks toward -Z. The road centre line is `AK.world.pathX(z)`. Ground height is `AK.world.heightAt(x, z)`. The camera stands at `(pathX(z), heightAt(pathX(z), z) + 1.65, z)` and looks down the road. The playable road runs from z = +20 to z = -6000. Walk speed is about 3.5 m/s. When the camera passes z = -5800 the core resets it to z = 0 (a fade hides the jump). Keep content ahead of the camera for at least 250 m. Fog (set by `AK.sky`) hides everything past about 180 m except the sky, the far mountains and the castle.

## Core object `AK.core` (created by game.js before any module `init`)
```
AK.core = {
  THREE, scene, camera,           // PerspectiveCamera fov 62, near 0.1, far 900
  renderer,                        // WebGLRenderer on #gl
  time,                            // seconds since start
  dt,                              // seconds this frame (clamped to 0.05)
  camZ,                            // current camera z
  phase,                           // 'LETTERS' | 'WORDS' | 'NUMBERS' | 'MATH' | null
  state,                           // see state machine
  torchLight,                      // PointLight carried by the player (core flickers it with AK.hands.flicker)
}
```

## Module contracts

### AK.audio (audio.js)
```
init()                       // call from a user gesture; creates AudioContext. Safe to call twice.
setMusic(name)               // 'title' | 'LETTERS' | 'WORDS' | 'NUMBERS' | 'MATH' | 'victory' | null. Crossfade 1.5 s.
sfx(name)                    // 'swing' | 'hit' | 'poof' | 'nudge' | 'step' | 'cheer' | 'click' | 'fanfare' | 'sparkle' | 'whoosh'
speak(text, opts)            // speechSynthesis. opts {rate, pitch, interrupt:true}. Ducks the music while speaking.
                             // Returns a Promise that resolves when speech ends (or after a timeout if no speech).
setMuted(bool); muted        // property
```
Music is a medieval canticle style: modal (Dorian, Mixolydian, Aeolian), a drone on open fifths, a sung choir pad ("aah" through formant filters), a plucked lute or harp, soft hand drum and bells. There is a generated convolution reverb for a stone-hall feel. Each phase has its own original melody and mood. It must loop seamlessly. Mix quietly under speech. Crash-safety rule from the old game: never use `onended` callbacks. Schedule each loop into one per-loop GainNode bus and `disconnect()` it with `setTimeout` after the loop ends. Schedule with a look-ahead so that a background tab does not cause gaps or pile-ups.

### AK.world (world_ground.js)
```
init(core)                    // build terrain, road, vegetation, village, props into core.scene
pathX(z) -> number            // gentle S-curves, max |x| about 12, smooth
heightAt(x, z) -> number      // rolling hills; the road corridor (|x - pathX| < 5) is nearly flat
update(dt, core)              // animate: grass/leaves sway, chimney smoke, windmill sails, banners, streams
```

### AK.sky (world_sky.js)
```
init(core)                    // sky dome, clouds, far mountains, castle, mist banks, fog, main lights, fireflies
update(dt, core)              // keep the sky, mountains and castle centred on the camera so they look infinitely far
setMood(name, seconds)        // 'LETTERS' purple storm (reference) | 'WORDS' golden sunset | 'NUMBERS' starry night + aurora |
                              // 'MATH' rosy dawn | 'title' | 'victory'. Smoothly tween colours, fog and lights.
celebrate(kind)               // 'small' after each creature (a shimmer of sparkles in the sky)
                              // 'big' at phase end: rainbow arcs across the sky + fireworks + a friendly dragon fly-by
```
The castle is the destination. It sits on the far horizon ahead of the player and grows slightly as the phase progresses (`core.progress` 0..1).

### AK.creatures (creatures.js)
```
create(spec) -> creature
  spec = { kind: 'letter'|'word'|'number'|'math', label: 'A' | 'CAT' | '7' | '3+4',
           color: '#hex', icon: '🍎', index: n, count: n (numbers: n dots; math: {a, op, b}) }
creature = {
  group,                // THREE.Group; core adds it to the scene and sets its position/rotation
  height,               // metres, so core can frame it
  update(dt, t),        // idle bob, blink, walk cycle when creature.walking === true
  walking,              // core sets this
  setProgress(n),       // words: letters already struck (highlight them); others: ignore
  hit(),                // squash, flash, stars, giggle wiggle (about 0.4 s)
  poof() -> seconds,    // burst into sparkles + butterflies + confetti; hide the body; return the duration
  dispose(),
}
```
Each creature carries a large sign in front of its body (shield, banner or scroll) with the label drawn big on a canvas texture. Letters show upper and lower case, for example "A a". Words show the word with the next letter to strike glowing, plus the icon. Numbers show the numeral plus that many dots or apples. Math shows "3 + 4" with dot groups under each number to count. Creature designs vary by index (slime, mossy stone golem, mushroom sprite, owl knight, baby dragon, fluffy yeti, frog prince, pumpkin imp, and more). All are cute, chunky, and toy-like, and they read clearly at 480x270.

### AK.hands (hands.js)
```
init()
draw(ctx, t, s)            // ctx is the 480x270 #px canvas; s = { walking, speed, state }
swing() -> seconds          // slash from upper right to lower left with a smear; returns the time to impact (about 0.14 s)
nudge()                     // gentle "not that one" sword wobble
cheer()                     // raise sword and torch high (celebration)
flicker                     // number 0..1 updated each draw; core uses it for the torch light intensity
```
Pixel-art first-person torch (left) and sword (right), as in the reference. The hands have leather bracers, and the torch has a wrapped wooden shaft with iron bands. The flame is a live animated pixel fire with rising embers. The sword has a glint that travels up the blade. Walking bob. Everything must be drawn procedurally with fillRect at pixel scale. No image files.

### AK.ui (ui.js)
```
draw(ctx, t, view)     // ctx is the 1280x720 #ui canvas; view is described below
hit(x, y, view) -> action | null   // x, y in 1280x720 space
```
`view = { screen: 'title'|'menu'|'play'|'phaseIntro'|'phaseDone'|'victory', phase, mode: 'easy'|'learn',
          index, total, target: {text, sub, icon, color}, choices: [{text, color}]|null, hint: 0|1|2,
          wordProgress, muted, lastCorrect: time, fade: 0..1 }`

Actions: `{type:'start'}`, `{type:'phase', phase}`, `{type:'mode', mode}`, `{type:'choice', value}`, `{type:'home'}`, `{type:'mute'}`.

- Title: huge game name in gold with a gentle shine, "Tap to play" with a pulsing hand icon.
- Menu: four huge shield buttons with a picture: ABC, CAT+cat emoji, 123, 1+2. Then a big two-choice toggle: Easy (a hand icon: "tap anything") and Learn (a magnifier icon: "find the letter"). Parents can read the labels, and toddlers read the pictures.
- Play HUD: a progress trail across the top (small shields that fill with gold as the player advances, with a knight marker). A big target card at the top centre with the letter, the icon and the word. In Learn mode, three big choice buttons at the bottom (the correct answer plus two others, shuffled). Hint 1 makes the correct button glow and bounce. Hint 2 also shows a small keyboard map with the key lit. Home (castle icon) and mute (bell icon) buttons are small in the top-right corner.
- phaseIntro and phaseDone are big celebratory banners. Victory is "You are a true Knight!" with a crown, stars and "Play again".
- Ornate medieval style: gold filigree, parchment, deep jewel colours, serif display font (Georgia or 'Palatino Linotype', bold). All tap targets are at least 120 px in 1280x720 space.

## State machine (core)
TITLE -> MENU -> PHASE_INTRO -> WALK -> MEET -> (STRIKE ...) -> POOF -> WALK ... -> PHASE_DONE -> next phase intro, or VICTORY after MATH.
- Easy mode: any key, click or tap during MEET strikes.
- Learn mode: the correct key or a tap on the correct choice strikes. A wrong answer gives `nudge` + a gentle spoken hint + a higher hint level. Never punish.
- Letters take 1 strike. Words take one strike per letter. Numbers take 1 strike. Math takes 1 strike (the answer digit).

## Testing
`python tools/shot.py <out.png> [--wait ms] [--eval "js"] [--html dev.html]` opens the page in headless Chrome at 1280x720. It prints console errors and saves a screenshot. Debug hooks from core: `AK.debug.go(phase, mode)` starts a phase immediately. `AK.debug.meet()` skips to the next creature. `AK.debug.strike()` strikes. `AK.debug.screen(name)` forces a UI screen. Look at your screenshots with the Read tool and iterate until the result looks stunning.
