// ─── CONFIG: shared content tables ───────────────────────────────────────────
window.AK = window.AK || {};

AK.config = {
  // Internal pixel-art resolution for the 3D view and the hands layer.
  PIX_W: 480, PIX_H: 270,
  // Crisp UI layer resolution (letterboxed 16:9).
  UI_W: 1280, UI_H: 720,

  LETTERS: [
    { k: 'A', word: 'Apple',     icon: '🍎', color: '#e63946' },
    { k: 'B', word: 'Bear',      icon: '🐻', color: '#f4a261' },
    { k: 'C', word: 'Cat',       icon: '🐱', color: '#2a9d8f' },
    { k: 'D', word: 'Dog',       icon: '🐶', color: '#e9c46a' },
    { k: 'E', word: 'Elephant',  icon: '🐘', color: '#a8dadc' },
    { k: 'F', word: 'Fish',      icon: '🐟', color: '#457b9d' },
    { k: 'G', word: 'Grapes',    icon: '🍇', color: '#f77f00' },
    { k: 'H', word: 'Horse',     icon: '🐴', color: '#c77dff' },
    { k: 'I', word: 'Ice cream', icon: '🍦', color: '#7b2d8b' },
    { k: 'J', word: 'Juice',     icon: '🧃', color: '#00b4d8' },
    { k: 'K', word: 'Key',       icon: '🔑', color: '#e76f51' },
    { k: 'L', word: 'Lion',      icon: '🦁', color: '#52b788' },
    { k: 'M', word: 'Moon',      icon: '🌙', color: '#ff006e' },
    { k: 'N', word: 'Nose',      icon: '👃', color: '#fb5607' },
    { k: 'O', word: 'Owl',       icon: '🦉', color: '#8338ec' },
    { k: 'P', word: 'Penguin',   icon: '🐧', color: '#3a86ff' },
    { k: 'Q', word: 'Queen',     icon: '👸', color: '#06d6a0' },
    { k: 'R', word: 'Rabbit',    icon: '🐰', color: '#ef233c' },
    { k: 'S', word: 'Sun',       icon: '☀️', color: '#4361ee' },
    { k: 'T', word: 'Tree',      icon: '🌳', color: '#f72585' },
    { k: 'U', word: 'Umbrella',  icon: '☂️', color: '#7209b7' },
    { k: 'V', word: 'Violin',    icon: '🎻', color: '#3f37c9' },
    { k: 'W', word: 'Whale',     icon: '🐳', color: '#4895ef' },
    { k: 'X', word: 'Fox',       icon: '🦊', color: '#4cc9f0', xEnds: true },
    { k: 'Y', word: 'Yarn',      icon: '🧶', color: '#b5179e' },
    { k: 'Z', word: 'Zebra',     icon: '🦓', color: '#560bad' },
  ],

  WORDS: [
    { w: 'CAT', icon: '🐱', color: '#e63946' },
    { w: 'DOG', icon: '🐶', color: '#f4a261' },
    { w: 'PIG', icon: '🐷', color: '#ff9fb2' },
    { w: 'BEE', icon: '🐝', color: '#ffd700' },
    { w: 'SUN', icon: '☀️', color: '#ffb703' },
    { w: 'HAT', icon: '🎩', color: '#8b5cf6' },
    { w: 'FOX', icon: '🦊', color: '#ff6b35' },
    { w: 'CUP', icon: '☕', color: '#06d6a0' },
    { w: 'HEN', icon: '🐔', color: '#fb8500' },
    { w: 'COW', icon: '🐮', color: '#2ec4b6' },
    { w: 'BOX', icon: '📦', color: '#c68b59' },
    { w: 'BED', icon: '🛏️', color: '#6c63ff' },
  ],

  NUMBERS: [
    { k: '0', name: 'zero',  color: '#f72585' },
    { k: '1', name: 'one',   color: '#7209b7' },
    { k: '2', name: 'two',   color: '#3a0ca3' },
    { k: '3', name: 'three', color: '#4361ee' },
    { k: '4', name: 'four',  color: '#4cc9f0' },
    { k: '5', name: 'five',  color: '#06d6a0' },
    { k: '6', name: 'six',   color: '#118ab2' },
    { k: '7', name: 'seven', color: '#ffd166' },
    { k: '8', name: 'eight', color: '#ef233c' },
    { k: '9', name: 'nine',  color: '#8338ec' },
  ],

  NUMBER_WORDS: ['zero','one','two','three','four','five','six','seven','eight','nine'],

  MATH_COUNT: 10,
  MATH_COLORS: ['#e63946','#f4a261','#2a9d8f','#e9c46a','#457b9d','#f77f00','#52b788','#ff006e','#8338ec','#3a86ff'],

  PRAISE: ['Great job!', 'Hooray!', 'You did it!', 'Wonderful!', 'Amazing!', 'Well done, brave knight!', 'Yay!'],

  PHASES: ['LETTERS', 'WORDS', 'NUMBERS', 'MATH'],
};

// Small addition and subtraction problems whose answers are single digits 1-9.
AK.config.makeMath = function () {
  const probs = [];
  for (let a = 1; a <= 5; a++) for (let b = 1; b <= 4; b++) if (a + b <= 9) probs.push({ a, op: '+', b, ans: a + b });
  for (let a = 2; a <= 6; a++) for (let b = 1; b < a; b++) probs.push({ a, op: '-', b, ans: a - b });
  for (let i = probs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [probs[i], probs[j]] = [probs[j], probs[i]]; }
  return probs.slice(0, AK.config.MATH_COUNT);
};

// Seeded PRNG so worlds and creatures are reproducible.
AK.rng = function (seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
