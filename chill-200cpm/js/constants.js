// ============================================================
// CONSTANTS — Chill 200CPM tunable values
// v21: Lv4 common wave -1T1, Lv4-5 uncommon T4 reduced,
//      snapshots tightened, additional speed 0.95×, coffee budgets reduced,
//      home icon 90% + 4s timed relocation
// ============================================================

export const CANVAS_W = 500;
export const CANVAS_H = 320;
export const HUD_H = 32;
export const MAZE_H = CANVAS_H - HUD_H; // 288px playable area

// Wall rendering
export const WALL_LINE_WIDTH = 2.5;
export const WALL_GLOW_BLUR = 5;
export const WALL_INSET = 1.0;

// Background overlay — stronger blue tint (v16: 0.50 opacity, all levels)
export const BG_TINT = 'rgba(0, 30, 80, 0.50)';

// Colors — v16: boosted player/villain saturation for blue BG visibility
export const COLORS = {
  hiviz: '#d4ff00',
  hudBg: 'rgba(10, 10, 15, 0.92)',
  hudAccent: '#d4ff00',
  wallStroke: 'rgba(255, 255, 255, 1.0)',
  wallGlow: '#ffffff',
  player: '#ffff00',
  playerBorder: '#ffff33',
  villain: '#ff2200',
  villainBorder: '#ff9933',
  chaser: '#ff8800',
  // Coffee active — brighter player (v16)
  playerCoffee: '#ffffaa',
  playerCoffeeBorder: '#ffffcc',
  playerCoffeeGlow: '#ffffdd',
  timer: '#f44',
  warning: '#f80',
  cpmText: '#d4ff00',
  objects: {
    tier1: '#6f6',
    tier2: '#6cf',
    tier3: '#fc6',
    tier4: '#f6f',
  },
  powerups: {
    coffee: '#c84',
    extraTag: '#4cf',
  },
};

// CPM scoring
export const CPM = {
  starting: 200,
  decayFactor: 0.80,
  gracePeriod: 0.3,
  winThreshold: 400,
};

// Object tiers (tier index 0-3) — v16: T1/T2 linger -1s
export const OBJECTS = [
  { value: 5,  color: '#6f6', lingerMin: 9,  lingerMax: 11 },
  { value: 10, color: '#6cf', lingerMin: 6,  lingerMax: 8 },
  { value: 25, color: '#fc6', lingerMin: 5,  lingerMax: 7 },
  { value: 50, color: '#f6f', lingerFixed: 5 },
];

// ---- Wave-based spawn system ----
// v21: Lv4 common 4T1→3T1, Lv4 T4 2→1, Lv5 T4 3→2
export const WAVE_TEMPLATES = [
  { common: { interval: 4.5, contents: [[0,3],[1,1]] }, uncommon: { interval: 10, contents: [[2,1]] } },
  { common: { interval: 4.5, contents: [[0,3],[1,1]] }, uncommon: { interval: 8, contents: [[2,1]] } },
  { common: { interval: 4.5, contents: [[0,3],[1,2]] }, uncommon: { interval: 7, contents: [[2,3],[3,1]] } },
  { common: { interval: 4.5, contents: [[0,3],[1,2]] }, uncommon: { interval: 6, contents: [[2,3],[3,1]] } },
  { common: { interval: 4.5, contents: [[0,6],[1,4]] }, uncommon: { interval: 6, contents: [[2,4],[3,2]] } },
];

// Per-round caps
export const ROUND_CAPS = [
  [3,  0], [6,  2], [9,  5], [12, 7], [18, 10],
];

// Late-round bonus
export const LATE_BONUS = [
  { threshold: 0,  interval: 5, t3Reserve: 0, t4Reserve: 0 },
  { threshold: 12, interval: 5, t3Reserve: 4, t4Reserve: 2 },
  { threshold: 12, interval: 5, t3Reserve: 6, t4Reserve: 3 },
  { threshold: 18, interval: 5, t3Reserve: 6, t4Reserve: 3 },
  { threshold: 18, interval: 5, t3Reserve: 7, t4Reserve: 4 },
];

// Tier 4 distance bias
export const TIER4_DISTANCE_BIAS = 0.5;

// ---- Villain system ----
export const VILLAIN = {
  warningMax: 3,
  warningCooldown: 3,
  disappearDuration: 5,
  snapshotInterval: 2.0, // v21: 2.5→2.0s (primary villain)
  baseSpeed: 2.5,
  snapshotIntervals: [2.0, 3.5, 4.5, 5.5], // v21: tightened 0.5s each
  chaser: {
    snapshotInterval: 1.5,
    speedMult: 1.25,
    lifespan: 7, // v16: +1s (was 6)
  },
  cpmThreshold: 90,
  cpmRearmThreshold: 111, // v19: must recover to 111 before below-90 can re-trigger (was 150)
};

// Villain count per level per round
export const VILLAIN_COUNTS = [
  [1, 1], [1, 1], [1, 2], [2, 3], [3, 4],
];

// ---- Power-up system ----
export const POWERUP_TYPES = {
  COFFEE: 'coffee',
  EXTRA_TAG: 'extraTag',
  CAMERA: 'camera',
  QUESTION: 'question',
};

export const POWERUP_DEFS = {
  coffee: {
    color: '#c84',
    effectDuration: 7 * 60, // 420 frames (v16: 7s, was 8s)
    playerSpeedMult: 1.5,
    villainSpeedMult: 0.67, // -33% villain speed
  },
  extraTag: {
    color: '#12FFBE',
    burst: { t1: 16, t2: 7, t3: 2, t4: 2 }, // v16: rebalanced (was 15/4/3/2)
    burstLinger: 5 * 60, // 300 frames — T3/T4 linger (v14: +2s from 3s)
    burstLingerT1T2: 6.5 * 60, // 390 frames — v19: T1/T2 get +1.5s extra
  },
  camera: {
    color: '#888',
    // Removes 1 warning. Can't activate with 0 warnings (silent).
  },
  question: {
    color: '#fff',
    // Random outcome — see QM_OUTCOMES
  },
};

// Per-level power-up budget caps: [coffee, extraTag, camera, question]
// v21: coffee reduced (2/4/3/5/8 → 1/2/3/4/6)
export const POWERUP_CAPS = [
  [1, 1, 0, 0], // Lv1 (v21: coffee 2→1)
  [2, 1, 0, 1], // Lv2 (v21: coffee 4→2)
  [3, 1, 1, 2], // Lv3
  [4, 2, 2, 3], // Lv4 (v21: coffee 5→4)
  [6, 3, 3, 4], // Lv5 (v21: coffee 8→6)
];

// Power-up spawning rules
export const POWERUP_SPAWN = {
  maxOnScreen: 3, // Coffee/ExtraTag/Camera combined
  spawnInterval: 5 * 60, // 300 frames (5s)
  firstSpawnPct: 0.10, // After 10% of timer elapsed
  lingerMin: 8, // v15: +2s (was 6-8s)
  lingerMax: 10,
  question: {
    maxOnScreen: 1,
    visibleDuration: 3 * 60, // 180 frames (v16: 3s, was 2s)
    hiddenDuration: 3 * 60, // 180 frames (v16: 3s, was 2s)
    firstSpawnPct: 0.25, // After 25% timer elapsed
  },
  lateBonus: {
    threshold: 10, // Last 10 seconds
    interval: 2 * 60, // Respawn every 2s
    minLevel: 2, // Lv3+ only (index 2+)
  },
};

// Question Mark outcomes
export const QM_OUTCOMES = ['coffee', 'extraTag', 'camera', 'decayPenalty', 'timerExtend', 'managersVanish'];

export const QM_EFFECTS = {
  decayPenalty: { mult: 1.25, duration: 5 * 60, speedMult: 0.60 }, // v18: +25% decay AND -40% player speed (was -25%)
  timerExtend: { seconds: 30 }, // +30s (BAD — extends shift)
  managersVanish: { duration: 7 * 60 }, // v15b: 7s (was 5s) — all managers disappear
};

// Warning screen messages (1-indexed by warning count)
export const WARNING_MESSAGES = [
  '', // placeholder for index 0
  'Your stacking is very bad! You have 1 warning!',
  'Why you do not close the cage!? You have 2 warnings!',
  'Your break last time was too long! You have 3 warnings!',
];

// Difficulty scaling per level (index 0-4)
// v20: Lv5 speed 1.5→1.425 (-5%), T3 linger bonus Lv4-5 +1.5s, Lv3-5 decay ×0.95
export const DIFFICULTY = [
  { villainSpeed: 0.506, lingerMult: 1.0,  decayFactor: 0.567, t3LingerBonus: 0 },
  { villainSpeed: 0.709, lingerMult: 0.95, decayFactor: 0.433, t3LingerBonus: 0 },
  { villainSpeed: 0.911, lingerMult: 0.85, decayFactor: 0.344, t3LingerBonus: 0 },
  { villainSpeed: 1.114, lingerMult: 0.75, decayFactor: 0.330, t3LingerBonus: 1.5 * 60 },
  { villainSpeed: 1.425, lingerMult: 0.65, decayFactor: 0.283, t3LingerBonus: 1.5 * 60 },
];

// Player movement
export const PLAYER_SPEED = 2.5;

// Additional (non-primary) villain speed multiplier — v21: 0.9→0.95
export const ADDITIONAL_VILLAIN_SPEED = 0.95;

// Home icon (Round 2 win condition)
// v21: threshold 85→90%, timed relocation every 4s
export const HOME_ICON = {
  timerThreshold: 0.90,
  relocationInterval: 4 * 60, // 240 frames (4s)
};

// Low CPM safety net — v20: threshold 50→60
export const LOW_CPM = {
  threshold: 60,
  decayMult: 0.5,
  gracePeriod: 1.0,
};

// Below-90 flex time bonus (seconds)
export const FLEX_BONUS = 15;

// Mute button position (centered between warning counter and level/round title)
// v15b: repositioned to x:163 (between v14's 148 and v15's 179)
export const MUTE_BTN = { x: 163, y: 9, w: 28, h: 14 };

// ---- Density wave system (Lv3-5 only) ----
// v16: Nerfed — 2T1+1T2 only, 15s interval, starts after 50% timer
export const DENSITY_WAVE = {
  interval: 15 * 60, // 900 frames (15s)
  contents: [[0, 2], [1, 1]], // 2×T1, 1×T2 (removed T3)
  minLevel: 2, // Index 2 = Level 3+
  startPct: 0.50, // Only fires after 50% of initial timer elapsed
};
