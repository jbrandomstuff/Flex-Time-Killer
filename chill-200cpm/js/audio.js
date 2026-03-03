// ============================================================
// AUDIO — Background music + sound effects for Chill 200CPM
// v15: Non-pickup SFX -25% (warning, chaser, below90, homeIcon,
//      roundLose, roundWin, victory, abUse)
// Web Audio API for SFX (no GC lag), HTML5 Audio for BGM
// ============================================================

let bgm = null;
let muted = false;
let bgmUnlocked = false;

// Web Audio API context + master gain
let audioCtx = null;
let masterGain = null;
const sfxBuffers = {};   // name → { buffer: AudioBuffer, vol: number }
const sfxDefs = [];      // { name, src, vol } — stored for hard reset re-decode

// Active SFX source tracking — for stopping on transitions
let activeSources = [];

export function isMuted() { return muted; }

export function toggleMute() {
  if (!masterGain || !bgm) return muted;

  muted = !muted;
  if (muted) {
    masterGain.gain.value = 0;
    bgm.volume = 0;
  } else {
    masterGain.gain.value = 1;
    bgm.volume = 0.15;
  }
  return muted;
}

// Ensure AudioContext is resumed (browsers require user gesture)
function ensureCtx() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// Hard reset: recreate AudioContext if in a bad state
async function hardResetAudioCtx() {
  if (!audioCtx) return;

  try {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
  } catch (e) { /* ignore */ }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  masterGain.gain.value = muted ? 0 : 1;

  activeSources = [];

  // Re-decode all buffers
  for (const def of sfxDefs) {
    await loadBuffer(def.name, def.src, def.vol);
  }
}

// Unlock BGM for browser autoplay policy — call once from any user gesture
export function unlockBGM() {
  if (bgmUnlocked || !bgm) return;
  bgm.play().then(() => {
    bgm.pause();
    bgm.currentTime = 0;
    bgmUnlocked = true;
  }).catch(() => {});
  ensureCtx();
}

// Resume audio on user gesture — call from A/Start presses on transitions
export function resumeAudioOnGesture() {
  ensureCtx();
  if (audioCtx && audioCtx.state !== 'running' && audioCtx.state !== 'suspended') {
    hardResetAudioCtx();
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
  // BGM stays on HTML5 Audio
  bgm = new Audio('assets/bgm.mp3');
  bgm.loop = true;
  bgm.volume = 0.15;

  // Create Web Audio context + master gain node
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  // Define all SFX (stored for hard reset re-decode)
  sfxDefs.length = 0;
  sfxDefs.push(
    { name: 'pickup',    src: 'assets/Catching_objects.wav',  vol: 0.00625 }, // unchanged
    { name: 'warning',   src: 'assets/Villain_contact.wav',   vol: 0.01875 }, // v15: -25%
    { name: 'chaser',    src: 'assets/Chaser_spawn.wav',      vol: 0.0225 },  // v15: -25%
    { name: 'below90',   src: 'assets/Below-90_choice.wav',   vol: 0.0225 },  // v15: -25%
    { name: 'homeIcon',  src: 'assets/Home_icon_appears.wav', vol: 0.01875 }, // v15: -25%
    { name: 'roundLose', src: 'assets/Round_lose.wav',        vol: 0.0225 },  // v15: -25%
    { name: 'roundWin',  src: 'assets/Round_win_sound.wav',   vol: 0.0225 },  // v15: -25%
    { name: 'victory',   src: 'assets/Victory_fanfare.wav',   vol: 0.02625 }, // v15: -25%
    { name: 'abUse',     src: 'assets/AB_Use.wav',            vol: 0.0225 },  // v15: -25%
  );

  // Pre-load all SFX into buffers (non-blocking)
  for (const def of sfxDefs) {
    loadBuffer(def.name, def.src, def.vol);
  }

  // Handle visibility changes (tab switch, backgrounding)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    // Tab visible again — resume context
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  });
}

function playSfx(name) {
  if (muted) return;
  if (!audioCtx || !masterGain) return;

  // v20: If context is suspended, resume and retry after a short delay
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      playSfxImmediate(name);
    }).catch(() => {});
    return;
  }
  // If context is in a bad state, skip (hard reset on next user gesture)
  if (audioCtx.state !== 'running') return;

  playSfxImmediate(name);
}

// v20: extracted so playSfx can call it after resume completes
function playSfxImmediate(name) {
  if (muted) return;
  if (!audioCtx || audioCtx.state !== 'running') return;

  const entry = sfxBuffers[name];
  if (!entry || !entry.buffer) return;

  const source = audioCtx.createBufferSource();
  source.buffer = entry.buffer;

  const gain = audioCtx.createGain();
  gain.gain.value = entry.vol / 0.03;
  source.connect(gain);
  gain.connect(masterGain);

  // Track active source for cleanup on transitions
  const sourceEntry = { source, gain };
  activeSources.push(sourceEntry);

  source.onended = () => {
    const idx = activeSources.indexOf(sourceEntry);
    if (idx >= 0) activeSources.splice(idx, 1);
  };

  source.start(0);
}

// Stop all active SFX — call on state transitions to prevent bleed
export function stopAllSFX() {
  for (const entry of activeSources) {
    try {
      entry.source.stop();
    } catch (e) { /* already stopped */ }
  }
  activeSources = [];
}

// === BGM controls ===
export function bgmPlay() {
  ensureCtx();
  if (muted) return;
  if (bgm && bgm.paused) bgm.play().catch(() => {});
}

export function bgmPause() {
  if (bgm && !bgm.paused) bgm.pause();
}

export function bgmStop() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

// === SFX triggers ===
export function playPickup()    { playSfx('pickup'); }
export function playWarning()   { playSfx('warning'); }
export function playChaser()    { playSfx('chaser'); }
export function playBelow90()   { playSfx('below90'); }
export function playHomeIcon()  { playSfx('homeIcon'); }
export function playRoundLose() { playSfx('roundLose'); }
export function playRoundWin()  { playSfx('roundWin'); }
export function playVictory()   { playSfx('victory'); }
export function playABUse()     { playSfx('abUse'); }

// === Victory loop (v19) ===
// Loops the victory fanfare with ~1s gap between plays
let victoryLoopActive = false;
let victoryLoopTimeout = null;

function playVictoryLoop() {
  if (!victoryLoopActive) return;
  if (muted) {
    // If muted, keep checking every 500ms
    victoryLoopTimeout = setTimeout(playVictoryLoop, 500);
    return;
  }
  if (!audioCtx || !masterGain || audioCtx.state !== 'running') {
    victoryLoopTimeout = setTimeout(playVictoryLoop, 500);
    return;
  }
  const entry = sfxBuffers['victory'];
  if (!entry || !entry.buffer) return;

  const source = audioCtx.createBufferSource();
  source.buffer = entry.buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = entry.vol / 0.03;
  source.connect(gain);
  gain.connect(masterGain);

  const sourceEntry = { source, gain };
  activeSources.push(sourceEntry);

  source.onended = () => {
    const idx = activeSources.indexOf(sourceEntry);
    if (idx >= 0) activeSources.splice(idx, 1);
    // Schedule next play after ~1s gap
    if (victoryLoopActive) {
      victoryLoopTimeout = setTimeout(playVictoryLoop, 1000);
    }
  };

  source.start(0);
}

export function startVictoryLoop() {
  victoryLoopActive = true;
  victoryLoopTimeout = null;
  playVictoryLoop();
}

export function stopVictoryLoop() {
  victoryLoopActive = false;
  if (victoryLoopTimeout) {
    clearTimeout(victoryLoopTimeout);
    victoryLoopTimeout = null;
  }
}
