// ============================================================
// AUDIO — Background music + sound effects
// ============================================================

const sfx = {};
let bgm = null;
let audioReady = false;
let muted = false;

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (muted) {
    bgm.volume = 0;
  } else {
    bgm.volume = 0.28;
  }
  return muted;
}

export function initAudio() {
  bgm = new Audio('assets/bgm.mp3');
  bgm.loop = true;
  bgm.volume = 0.28;

  sfx.sword = loadSfx('assets/sword.wav', 0.025);
  sfx.kick = loadSfx('assets/kick.wav', 0.025);
  sfx.vls = loadSfx('assets/VLS.wav', 0.035);
  sfx.special = loadSfx('assets/special.wav', 0.03);
  sfx.p1win = loadSfx('assets/p1win.wav', 0.03);
  sfx.p2win = loadSfx('assets/p2win.wav', 0.03);
}

const sfxVol = {};

function loadSfx(src, vol) {
  const a = new Audio(src);
  a.volume = vol;
  sfxVol[src] = vol;
  a._src = src;
  return a;
}

function playSfx(name) {
  ensureReady();
  if (muted) return;
  const s = sfx[name];
  if (!s) return;
  const a = new Audio(s._src);
  a.volume = sfxVol[s._src] || s.volume;
  a.play().catch(() => {});
}

function ensureReady() {
  if (audioReady) return;
  audioReady = true;
  // Browsers require user gesture — BGM will start on first interaction
}

// === BGM controls ===
export function bgmPlay() {
  ensureReady();
  if (muted) return;
  if (bgm.paused) bgm.play().catch(() => {});
}

export function bgmPause() {
  if (!bgm.paused) bgm.pause();
  // Does NOT reset — resumes from same position
}

export function bgmStop() {
  bgm.pause();
  bgm.currentTime = 0;
}

// === SFX triggers (called from main.js) ===
export function playSword() { playSfx('sword'); }
export function playKick() { playSfx('kick'); }
export function playVLS() { playSfx('vls'); }
export function playSpecial() { playSfx('special'); }
export function playP1Win() { playSfx('p1win'); }
export function playP2Win() { playSfx('p2win'); }
