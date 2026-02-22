// ============================================================
// AUDIO — Background music + sound effects
// Web Audio API for SFX (no GC lag), HTML5 Audio for BGM
// ============================================================

let bgm = null;
let muted = false;

// Web Audio API context + master gain
let audioCtx = null;
let masterGain = null;
const sfxBuffers = {};   // name → { buffer: AudioBuffer, vol: number }

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (muted) {
    masterGain.gain.value = 0;
    bgm.volume = 0;
  } else {
    masterGain.gain.value = 1;
    bgm.volume = 0.28;
  }
  return muted;
}

// Ensure AudioContext is resumed (browsers require user gesture)
function ensureCtx() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// Fetch + decode a single audio file into a buffer
async function loadBuffer(name, src, vol) {
  try {
    const resp = await fetch(src);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    sfxBuffers[name] = { buffer: audioBuf, vol };
  } catch (e) {
    console.warn(`[audio] Failed to load ${src}:`, e);
  }
}

export function initAudio() {
  // BGM stays on HTML5 Audio (single long-running instance, no GC issue)
  bgm = new Audio('assets/bgm.mp3');
  bgm.loop = true;
  bgm.volume = 0.28;

  // Create Web Audio context + master gain node
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  // Pre-load all SFX into buffers (non-blocking)
  loadBuffer('sword',   'assets/sword.wav',   0.025);
  loadBuffer('kick',    'assets/kick.wav',     0.025);
  loadBuffer('vls',     'assets/VLS.wav',      0.035);
  loadBuffer('special', 'assets/special.wav',  0.03);
  loadBuffer('p1win',   'assets/p1win.wav',    0.03);
  loadBuffer('p2win',   'assets/p2win.wav',    0.03);
}

function playSfx(name) {
  ensureCtx();
  if (muted) return;
  const entry = sfxBuffers[name];
  if (!entry || !entry.buffer) return;

  // BufferSourceNodes are lightweight, designed to be one-shot & disposable
  const source = audioCtx.createBufferSource();
  source.buffer = entry.buffer;

  // Per-sound gain for individual volume levels
  const gain = audioCtx.createGain();
  gain.gain.value = entry.vol / 0.03; // normalize relative to ~0.03 base
  source.connect(gain);
  gain.connect(masterGain);

  source.start(0);
}

// === BGM controls ===
export function bgmPlay() {
  ensureCtx();
  if (muted) return;
  if (bgm.paused) bgm.play().catch(() => {});
}

export function bgmPause() {
  if (!bgm.paused) bgm.pause();
}

export function bgmStop() {
  bgm.pause();
  bgm.currentTime = 0;
}

// === SFX triggers (same API as before — no changes needed in main.js) ===
export function playSword()   { playSfx('sword'); }
export function playKick()    { playSfx('kick'); }
export function playVLS()     { playSfx('vls'); }
export function playSpecial() { playSfx('special'); }
export function playP1Win()   { playSfx('p1win'); }
export function playP2Win()   { playSfx('p2win'); }
