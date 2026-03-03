// ============================================================
// MAIN — Game loop & state machine for Chill 200CPM
// v21: Tighter snapshots, additional speed 0.95×, Lv4 common/uncommon reduced,
//      Lv5 uncommon T4 reduced, coffee budgets reduced,
//      home icon 90% + 4s timed relocation
// ============================================================

import { CANVAS_W, CANVAS_H, HUD_H, MAZE_H, CPM, COLORS, PLAYER_SPEED,
         OBJECTS, WAVE_TEMPLATES, ROUND_CAPS, DIFFICULTY,
         LATE_BONUS, FLEX_BONUS, MUTE_BTN, DENSITY_WAVE,
         TIER4_DISTANCE_BIAS, HOME_ICON, VILLAIN, VILLAIN_COUNTS, LOW_CPM,
         ADDITIONAL_VILLAIN_SPEED,
         POWERUP_TYPES, POWERUP_DEFS, POWERUP_CAPS, POWERUP_SPAWN,
         QM_OUTCOMES, QM_EFFECTS, WARNING_MESSAGES } from './constants.js';
import { LEVELS, findPlayerStart, findVillainStart } from './mazes.js';
import { initControls, updatePrev, justPressed, getInput } from './controls.js';
import { initRenderer, renderMazeCache, clearCanvas, drawBackground, drawHUD,
         drawPlayer, drawVillain, drawChaserVillain, drawObject, drawHomeIcon,
         drawPowerup, drawCoffeeAura, drawActiveEffectText,
         drawTitleScreen, drawLevelIntro,
         drawPauseOverlay, drawInstructions, drawGameOver, drawPickupPopup,
         drawWarningFlash, drawMuteButton,
         drawBelow90Choice, drawBelow90Followup,
         drawRoundComplete, drawVictoryScreen,
         drawWarningScreen, drawPowerupActivation,
         drawPowerupTutorial } from './renderer.js';
import { initAudio, isMuted, toggleMute, unlockBGM,
         bgmPlay, bgmPause, bgmStop,
         stopAllSFX, resumeAudioOnGesture,
         startVictoryLoop, stopVictoryLoop,
         playPickup, playWarning, playChaser, playBelow90,
         playHomeIcon, playRoundLose, playRoundWin, playVictory,
         playABUse } from './audio.js';

// ---- Game state ----
const STATES = {
  TITLE:'title', LEVEL_INTRO:'intro', PLAYING:'playing',
  PAUSED:'paused', INSTRUCTIONS:'instructions',
  ROUND_COMPLETE:'roundComplete',
  GAME_OVER:'gameOver', VICTORY:'victory',
  BELOW90_CHOICE:'below90Choice', BELOW90_FOLLOWUP:'below90Followup',
  WARNING_SCREEN:'warningScreen',
  POWERUP_ACTIVATION:'powerupActivation',
  POWERUP_TUTORIAL:'powerupTutorial', // v19: first pickup tutorial (Lv1 R1 only)
};
let gameState = STATES.TITLE;
let prevStateBeforePause = null;

let currentLevel = 0;
let currentRound = 0;
let roundTimer = 0;
let cpm = CPM.starting;
let warnings = 0;
let introTimer = 0;
const INTRO_DURATION = 120;

// ---- Peak CPM + Home icon (Round 2 win condition) ----
let peakCpm = 0;
let homeIcon = null;
let homeIconSpawned = false;
let homeIconSfxPlayed = false;
let homeIconRelocTimer = 0; // v21: timed relocation countdown

// ---- Game Over / Round Complete state ----
let gameOverReason = '';
let winReason = '';       // 'timer', 'highCpm', 'homeIcon'
let completedRound = 0;   // which round was just completed (0 or 1)
let completedLevel = 0;   // v20: which level was just completed (0-4)
let roundCompleteSfxPlayed = false;
let gameOverSfxPlayed = false;

// ---- Victory particles ----
let victoryParticles = [];
let victorySfxPlayed = false;

// ---- Player movement (grid-based, GBA style) ----
let player = {
  r: 0, c: 0,
  targetR: 0, targetC: 0,
  moveProgress: 0,
  moving: false,
  facingR: 0, facingC: 0,
};

// ---- Villain system ----
let villains = [];
let chaser = null;

// Below-90 CPM threshold tracking
let cpmWasAboveThreshold = true;
let cpmCrossCount = 0;
let below90SfxPlayed = false;

// Warning system
let warningFlashTimer = 0;
const WARNING_FLASH_DURATION = 20;
let warningCooldownTimer = 0;

// ---- Wave-based object spawning system ----
let objects = [];
let frameCount = 0;
const CLEANUP_INTERVAL = 30;

let commonWaveTimer = 0;
let uncommonWaveTimer = 0;
let lateBonusTimer = 0;
let densityWaveTimer = 0; // v15: density wave system

let lateBonusT3Left = 0;
let lateBonusT4Left = 0;
let lateBonusActive = false;

let tierBudget = [0, 0, 0, 0];

let pathCells = [];

// ---- Power-up system ----
let powerups = [];             // Power-up items on maze floor
let powerupBudget = [0,0,0,0]; // [coffee, extraTag, camera, question] remaining
let powerupSpawnTimer = 0;
let questionMark = null;       // { r, c, visible, timer, outcome }
let playerSlotA = null;        // { type: 'coffee'|'extraTag'|'camera'|'question', outcome?: string }
let playerSlotB = null;
let activeCoffee = null;       // { framesLeft: N }
let activeDecayPenalty = null;  // { framesLeft: N }
let managersVanished = null;    // { framesLeft: N }
let latePowerupActive = false;
let latePowerupTimer = 0;
let powerupActivationData = null; // { header, headerColor, subtext, subtextColor, subtext2, subtext2Color, effect }
let pendingWarningCount = 0;     // For WARNING_SCREEN state
let powerupTutorialShown = false; // v19: triggers once on first Lv1 R1 power-up pickup

// ---- CPM decay system ----
let decayPerSecond = 0;
let graceFrames = 0;
let roundStartTimer = 0;

// ---- Pickup animation ----
let pickupPopup = null;

function getMaze() {
  return LEVELS[currentLevel].rounds[currentRound];
}

function getCellSize() {
  const maze = getMaze();
  return {
    w: CANVAS_W / maze[0].length,
    h: MAZE_H / maze.length,
  };
}

function cellToPixel(r, c) {
  const cs = getCellSize();
  return {
    x: c * cs.w + cs.w / 2,
    y: HUD_H + r * cs.h + cs.h / 2,
  };
}

function getPlayerPixel() {
  if (!player.moving || player.moveProgress >= 1) {
    return cellToPixel(player.r, player.c);
  }
  const cs = getCellSize();
  const t = player.moveProgress;
  const fromX = player.c * cs.w + cs.w / 2;
  const fromY = HUD_H + player.r * cs.h + cs.h / 2;
  const toX = player.targetC * cs.w + cs.w / 2;
  const toY = HUD_H + player.targetR * cs.h + cs.h / 2;
  return {
    x: fromX + (toX - fromX) * t,
    y: fromY + (toY - fromY) * t,
  };
}

function getVillainPixel(v) {
  if (!v.moving || v.moveProgress >= 1) {
    return cellToPixel(v.r, v.c);
  }
  const cs = getCellSize();
  const t = v.moveProgress;
  const fromX = v.c * cs.w + cs.w / 2;
  const fromY = HUD_H + v.r * cs.h + cs.h / 2;
  const toX = v.targetC * cs.w + cs.w / 2;
  const toY = HUD_H + v.targetR * cs.h + cs.h / 2;
  return {
    x: fromX + (toX - fromX) * t,
    y: fromY + (toY - fromY) * t,
  };
}

function entityRadius() {
  const cs = getCellSize();
  return Math.min(cs.w, cs.h) * 0.35;
}

function objectRadius() {
  const cs = getCellSize();
  return Math.min(cs.w, cs.h) * 0.2;
}

function isWalkable(maze, r, c) {
  if (r < 0 || r >= maze.length || c < 0 || c >= maze[0].length) return false;
  return maze[r][c] === 0;
}

// ---- Player movement ----
function tryMove(dr, dc) {
  const maze = getMaze();
  const nextR = player.r + dr;
  const nextC = player.c + dc;
  if (!isWalkable(maze, nextR, nextC)) return false;

  player.targetR = nextR;
  player.targetC = nextC;
  player.moveProgress = 0;
  player.moving = true;
  player.facingR = dr;
  player.facingC = dc;
  return true;
}

function updatePlayerMovement() {
  if (!player.moving) return;
  const cs = getCellSize();
  const dist = (player.facingR !== 0) ? cs.h : cs.w;
  let speed = PLAYER_SPEED;
  // Coffee effect boosts player
  if (activeCoffee && activeCoffee.framesLeft > 0) {
    speed *= POWERUP_DEFS.coffee.playerSpeedMult;
  }
  // QM watch broken slows player (v16)
  if (activeDecayPenalty && activeDecayPenalty.framesLeft > 0) {
    speed *= QM_EFFECTS.decayPenalty.speedMult;
  }
  const step = speed / dist;
  player.moveProgress += step;

  if (player.moveProgress >= 1) {
    player.moveProgress = 1;
    player.r = player.targetR;
    player.c = player.targetC;
    player.moving = false;
  }
}

// ============================================================
// WARNING SYSTEM — centralized with cooldown
// ============================================================

function tryAddWarning() {
  if (warningCooldownTimer > 0) return false;
  warnings++;
  warningFlashTimer = WARNING_FLASH_DURATION;
  warningCooldownTimer = Math.round(VILLAIN.warningCooldown * 60);
  playWarning();

  // Home icon relocation on warning (Round 2 only)
  if (homeIcon && currentRound === 1) {
    relocateHomeIcon();
    homeIconRelocTimer = HOME_ICON.relocationInterval; // v21: reset timed relocation
  }

  return true;
}

// ============================================================
// HOME ICON RELOCATION
// ============================================================

function relocateHomeIcon() {
  if (!homeIcon) return;
  const maze = getMaze();
  const rows = maze.length;
  const cols = maze[0].length;
  const pMidR = rows / 2;
  const pMidC = cols / 2;
  const playerAbove = player.r < pMidR;
  const playerLeft = player.c < pMidC;

  const available = pathCells.filter(p =>
    !(p.r === player.r && p.c === player.c) &&
    !(p.r === homeIcon.r && p.c === homeIcon.c)
  );
  if (available.length === 0) return;

  const homeIsOppositeR = playerAbove ? (homeIcon.r >= pMidR) : (homeIcon.r < pMidR);
  const homeIsOppositeC = playerLeft ? (homeIcon.c >= pMidC) : (homeIcon.c < pMidC);
  const homeIsInOppositeQuadrant = homeIsOppositeR && homeIsOppositeC;

  let candidates;

  if (!homeIsInOppositeQuadrant) {
    candidates = available.filter(p => {
      const oppR = playerAbove ? (p.r >= pMidR) : (p.r < pMidR);
      const oppC = playerLeft ? (p.c >= pMidC) : (p.c < pMidC);
      return oppR && oppC;
    });
  } else {
    candidates = available.filter(p => {
      const sameQuadR = playerAbove ? (p.r >= pMidR) : (p.r < pMidR);
      const sameQuadC = playerLeft ? (p.c >= pMidC) : (p.c < pMidC);
      const inPlayerQuad = !sameQuadR && !sameQuadC;
      const inHomeQuad = sameQuadR && sameQuadC;
      return !inPlayerQuad && !inHomeQuad;
    });
  }

  if (!candidates || candidates.length === 0) {
    candidates = available.filter(p => {
      const inPlayerQuad = (playerAbove ? (p.r < pMidR) : (p.r >= pMidR)) &&
                           (playerLeft ? (p.c < pMidC) : (p.c >= pMidC));
      return !inPlayerQuad;
    });
  }
  if (!candidates || candidates.length === 0) candidates = available;

  candidates.sort((a, b) => {
    const distA = Math.abs(a.r - player.r) + Math.abs(a.c - player.c);
    const distB = Math.abs(b.r - player.r) + Math.abs(b.c - player.c);
    return distB - distA;
  });
  const topCount = Math.max(1, Math.floor(candidates.length * 0.2));
  const pool = candidates.slice(0, topCount);
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  homeIcon = { r: chosen.r, c: chosen.c };
  updateGuardianTarget();
}

// ============================================================
// BFS PATHFINDING
// ============================================================

function bfsPath(maze, fromR, fromC, toR, toC) {
  if (fromR === toR && fromC === toC) return [];
  const rows = maze.length;
  const cols = maze[0].length;
  const visited = new Uint8Array(rows * cols);
  const parent = new Int16Array(rows * cols).fill(-1);
  const queue = [];

  const idx = (r, c) => r * cols + c;
  visited[idx(fromR, fromC)] = 1;
  queue.push(idx(fromR, fromC));

  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  let head = 0;
  let found = false;

  while (head < queue.length) {
    const cur = queue[head++];
    const cr = (cur / cols) | 0;
    const cc = cur % cols;

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = idx(nr, nc);
      if (visited[ni] || maze[nr][nc] !== 0) continue;
      visited[ni] = 1;
      parent[ni] = cur;
      if (nr === toR && nc === toC) { found = true; break; }
      queue.push(ni);
    }
    if (found) break;
  }

  if (!found) return [];

  const path = [];
  let cur = idx(toR, toC);
  while (cur !== idx(fromR, fromC)) {
    const cr = (cur / cols) | 0;
    const cc = cur % cols;
    path.push({ r: cr, c: cc });
    cur = parent[cur];
  }
  path.reverse();
  return path;
}

// ============================================================
// VILLAIN AI
// ============================================================

function createVillain(r, c, isPrimary, speedMult, snapshotSec) {
  const interval = snapshotSec || VILLAIN.snapshotInterval;
  return {
    r, c,
    targetR: r, targetC: c,
    moveProgress: 0,
    moving: false,
    path: [],
    pathIndex: 0,
    snapshotTimer: Math.round(interval * 60) + Math.floor(Math.random() * 60),
    snapshotInterval: interval,
    visible: true,
    respawnTimer: 0,
    isPrimary,
    speedMult,
    isGuardian: false,
    guardianFlip: false,
    snapshotCount: 0,
    // Patrol state (primary only)
    patrolDir: null,    // {dr, dc} current patrol direction
    patrolSteps: 0,     // steps taken in current direction
    patrolMaxSteps: 0,  // max steps before reversing (2-3)
  };
}

function createChaser(r, c) {
  return {
    r, c,
    targetR: r, targetC: c,
    moveProgress: 0,
    moving: false,
    path: [],
    pathIndex: 0,
    snapshotTimer: 1,
    visible: true,
    respawnTimer: 0,
    isPrimary: false,
    speedMult: VILLAIN.chaser.speedMult,
    lifeTimer: Math.round(VILLAIN.chaser.lifespan * 60),
    isChaser: true,
    isGuardian: false,
    guardianFlip: false,
    snapshotCount: 0,
  };
}

function findVillainStarts(maze, count) {
  const positions = [];
  const center = findVillainStart(maze);
  positions.push(center);

  if (count <= 1) return positions;

  const rows = maze.length;
  const cols = maze[0].length;
  const allPaths = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (maze[r][c] === 0) allPaths.push({ r, c });

  for (let i = 1; i < count; i++) {
    let best = null;
    let bestMinDist = -1;
    for (const cell of allPaths) {
      if (cell.r >= rows - 2 && cell.c <= 2) continue;
      let minDist = Infinity;
      for (const p of positions) {
        const d = Math.abs(cell.r - p.r) + Math.abs(cell.c - p.c);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = cell;
      }
    }
    positions.push(best || { r: Math.floor(rows / 4), c: Math.floor(cols / 4) });
  }

  return positions;
}

function findOppositeQuadrantCell(maze) {
  const rows = maze.length;
  const cols = maze[0].length;
  const pMidR = rows / 2;
  const pMidC = cols / 2;
  const playerAbove = player.r < pMidR;
  const playerLeft = player.c < pMidC;

  let candidates = pathCells.filter(p => {
    const oppR = playerAbove ? (p.r >= pMidR) : (p.r < pMidR);
    const oppC = playerLeft ? (p.c >= pMidC) : (p.c < pMidC);
    return oppR && oppC;
  });

  if (candidates.length === 0) {
    candidates = pathCells.filter(p =>
      playerAbove ? (p.r >= pMidR) : (p.r < pMidR)
    );
  }
  if (candidates.length === 0) candidates = [...pathCells];
  candidates = candidates.filter(p => !(p.r === player.r && p.c === player.c));
  if (candidates.length === 0) return pathCells[0];

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function findCellNearHomeIcon() {
  if (!homeIcon) return { r: player.r, c: player.c };
  const maze = getMaze();
  const rows = maze.length;
  const cols = maze[0].length;
  const candidates = [];

  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const nr = homeIcon.r + dr;
      const nc = homeIcon.c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && maze[nr][nc] === 0) {
        candidates.push({ r: nr, c: nc });
      }
    }
  }

  if (candidates.length === 0) return { r: homeIcon.r, c: homeIcon.c };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function updateGuardianTarget() {
  // Called when home icon moves — guardian will pick up new position on next snapshot
}

function getVillainTarget(v) {
  if (v.isGuardian && homeIcon && currentRound === 1) {
    v.snapshotCount++;
    if (v.snapshotCount % 2 === 0) {
      return findCellNearHomeIcon();
    }
  }
  return { r: player.r, c: player.c };
}

function updateVillainMovement(v) {
  const maze = getMaze();
  const cs = getCellSize();

  if (!v.visible) {
    v.respawnTimer--;
    if (v.respawnTimer <= 0) {
      const cell = findOppositeQuadrantCell(maze);
      v.r = cell.r;
      v.c = cell.c;
      v.targetR = cell.r;
      v.targetC = cell.c;
      v.moveProgress = 0;
      v.moving = false;
      v.path = [];
      v.pathIndex = 0;
      v.snapshotTimer = 1;
      v.visible = true;
    }
    return;
  }

  v.snapshotTimer--;
  if (v.snapshotTimer <= 0) {
    const interval = v.isChaser ? VILLAIN.chaser.snapshotInterval : (v.snapshotInterval || VILLAIN.snapshotInterval);
    v.snapshotTimer = Math.round(interval * 60);
    const target = getVillainTarget(v);
    v.path = bfsPath(maze, v.r, v.c, target.r, target.c);
    v.pathIndex = 0;
    // Clear patrol state — BFS path takes over
    v.patrolDir = null;
    v.patrolSteps = 0;
  }

  if (v.moving) {
    const dr = v.targetR - v.r;
    const dc = v.targetC - v.c;
    const dist = (dr !== 0) ? cs.h : cs.w;
    let speed = VILLAIN.baseSpeed * v.speedMult;
    // Coffee effect slows villains
    if (activeCoffee && activeCoffee.framesLeft > 0) {
      speed *= POWERUP_DEFS.coffee.villainSpeedMult;
    }
    const step = speed / dist;
    v.moveProgress += step;

    if (v.moveProgress >= 1) {
      v.moveProgress = 1;
      v.r = v.targetR;
      v.c = v.targetC;
      v.moving = false;
    }
    return;
  }

  if (v.path.length > 0 && v.pathIndex < v.path.length) {
    const next = v.path[v.pathIndex];
    if (isWalkable(maze, next.r, next.c) &&
        Math.abs(next.r - v.r) + Math.abs(next.c - v.c) === 1) {
      v.targetR = next.r;
      v.targetC = next.c;
      v.moveProgress = 0;
      v.moving = true;
      v.pathIndex++;
      // Clear patrol when following BFS path
      v.patrolDir = null;
      v.patrolSteps = 0;
    } else {
      v.path = [];
      v.pathIndex = 0;
    }
  } else if (v.isPrimary) {
    // Primary villain patrols back and forth when BFS path exhausted
    const dirs = [{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1}];

    if (!v.patrolDir) {
      // Pick a random walkable direction to start patrol
      const walkable = dirs.filter(d => isWalkable(maze, v.r + d.dr, v.c + d.dc));
      if (walkable.length > 0) {
        v.patrolDir = walkable[Math.floor(Math.random() * walkable.length)];
        v.patrolSteps = 0;
        v.patrolMaxSteps = 2 + Math.floor(Math.random() * 2); // 2-3
      }
    }

    if (v.patrolDir) {
      const nextR = v.r + v.patrolDir.dr;
      const nextC = v.c + v.patrolDir.dc;

      if (v.patrolSteps >= v.patrolMaxSteps || !isWalkable(maze, nextR, nextC)) {
        // Reverse direction
        v.patrolDir = { dr: -v.patrolDir.dr, dc: -v.patrolDir.dc };
        v.patrolSteps = 0;
        v.patrolMaxSteps = 2 + Math.floor(Math.random() * 2);
        // Check if reverse is walkable, if not pick new random
        const revR = v.r + v.patrolDir.dr;
        const revC = v.c + v.patrolDir.dc;
        if (!isWalkable(maze, revR, revC)) {
          const walkable = dirs.filter(d => isWalkable(maze, v.r + d.dr, v.c + d.dc));
          if (walkable.length > 0) {
            v.patrolDir = walkable[Math.floor(Math.random() * walkable.length)];
          } else {
            v.patrolDir = null; // Stuck — stop patrolling
          }
        }
      }

      // Move one cell in patrol direction
      if (v.patrolDir) {
        const pr = v.r + v.patrolDir.dr;
        const pc = v.c + v.patrolDir.dc;
        if (isWalkable(maze, pr, pc)) {
          v.targetR = pr;
          v.targetC = pc;
          v.moveProgress = 0;
          v.moving = true;
          v.patrolSteps++;
        }
      }
    }
  }
}

function isVillainContactingPlayer(v) {
  if (!v.visible) return false;

  const pr = player.moving && player.moveProgress >= 0.7 ? player.targetR : player.r;
  const pc = player.moving && player.moveProgress >= 0.7 ? player.targetC : player.c;
  const vr = v.moving && v.moveProgress >= 0.7 ? v.targetR : v.r;
  const vc = v.moving && v.moveProgress >= 0.7 ? v.targetC : v.c;

  return pr === vr && pc === vc;
}

function handleVillainContact(v) {
  if (!tryAddWarning()) return;

  v.visible = false;
  v.moving = false;
  v.path = [];
  v.pathIndex = 0;
  v.respawnTimer = Math.round(VILLAIN.disappearDuration * 60);

  // Transition to warning screen
  pendingWarningCount = warnings;
  bgmPause();
  gameState = STATES.WARNING_SCREEN;
}

function updateVillains() {
  for (let i = 0; i < villains.length; i++) {
    updateVillainMovement(villains[i]);
    if (villains[i].visible && isVillainContactingPlayer(villains[i])) {
      handleVillainContact(villains[i]);
    }
  }
}

function updateChaser() {
  if (!chaser) return;

  chaser.lifeTimer--;
  if (chaser.lifeTimer <= 0) {
    chaser = null;
    return;
  }

  updateVillainMovement(chaser);

  if (chaser && chaser.visible && isVillainContactingPlayer(chaser)) {
    if (tryAddWarning()) {
      pendingWarningCount = warnings;
      bgmPause();
      chaser = null;
      gameState = STATES.WARNING_SCREEN;
    }
  }
}

// ---- Below-90 CPM threshold system ----
function updateCPMThreshold() {
  const isBelow = cpm < VILLAIN.cpmThreshold;

  if (cpmWasAboveThreshold && isBelow) {
    cpmCrossCount++;

    if (cpmCrossCount === 1) {
      // First crossing: show choice screen instead of auto-warning
      playBelow90();
      bgmPause();
      gameState = STATES.BELOW90_CHOICE;
      return; // exit update — game is now paused on choice screen
    } else {
      // Second+ crossing: spawn chaser (if none active)
      if (!chaser) {
        const maze = getMaze();
        const cell = findOppositeQuadrantCell(maze);
        chaser = createChaser(cell.r, cell.c);
        playChaser();
      }
    }
  }

  // v18: re-arm only when CPM recovers to rearmThreshold (150), not trigger threshold (90)
  if (isBelow) {
    cpmWasAboveThreshold = false;
  } else if (cpm >= VILLAIN.cpmRearmThreshold) {
    cpmWasAboveThreshold = true;
  }
}

// ---- Object helpers ----

function cachePaths() {
  const maze = getMaze();
  pathCells = [];
  for (let r = 0; r < maze.length; r++)
    for (let c = 0; c < maze[0].length; c++)
      if (maze[r][c] === 0) pathCells.push({ r, c });
}

function cellDist(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function findSpawnCell(tier) {
  const maze = getMaze();
  const occupied = new Set();
  occupied.add(player.r + ',' + player.c);
  for (const v of villains) {
    if (v.visible) occupied.add(v.r + ',' + v.c);
  }
  if (chaser && chaser.visible) occupied.add(chaser.r + ',' + chaser.c);
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i].dead) occupied.add(objects[i].r + ',' + objects[i].c);
  }

  let candidates = pathCells.filter(p => !occupied.has(p.r + ',' + p.c));
  if (candidates.length === 0) return null;

  if (tier === 3) {
    const maxDist = getMaze().length + getMaze()[0].length;
    const halfDist = maxDist * TIER4_DISTANCE_BIAS;
    const nearby = candidates.filter(p => cellDist(p.r, p.c, player.r, player.c) <= halfDist);
    if (nearby.length > 0) candidates = nearby;
  }

  if (tier >= 2) {
    const sameT = [];
    for (let i = 0; i < objects.length; i++) {
      if (!objects[i].dead && objects[i].tier === tier) sameT.push(objects[i]);
    }
    if (sameT.length > 0) {
      candidates.sort((a, b) => {
        const distA = Math.min(...sameT.map(o => cellDist(a.r, a.c, o.r, o.c)));
        const distB = Math.min(...sameT.map(o => cellDist(b.r, b.c, o.r, o.c)));
        return distB - distA;
      });
      candidates = candidates.slice(0, Math.max(1, Math.floor(candidates.length / 3)));
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function findHomeIconCell() {
  const maze = getMaze();
  const rows = maze.length;
  const cols = maze[0].length;

  const pMidR = rows / 2;
  const pMidC = cols / 2;
  const playerAbove = player.r < pMidR;
  const playerLeft = player.c < pMidC;

  let candidates = pathCells.filter(p => {
    const oppR = playerAbove ? (p.r >= pMidR) : (p.r < pMidR);
    const oppC = playerLeft ? (p.c >= pMidC) : (p.c < pMidC);
    return oppR && oppC;
  });

  if (candidates.length === 0) {
    candidates = pathCells.filter(p =>
      playerAbove ? (p.r >= pMidR) : (p.r < pMidR)
    );
  }
  if (candidates.length === 0) candidates = [...pathCells];

  const vRef = villains.length > 0 ? villains[0] : { r: Math.floor(maze.length/2), c: Math.floor(cols/2) };
  candidates = candidates.filter(p =>
    !(p.r === player.r && p.c === player.c) &&
    !(p.r === vRef.r && p.c === vRef.c)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const distA = cellDist(a.r, a.c, vRef.r, vRef.c);
    const distB = cellDist(b.r, b.c, vRef.r, vRef.c);
    return distA - distB;
  });
  const topCount = Math.max(1, Math.floor(candidates.length * 0.3));
  const pool = candidates.slice(0, topCount);

  return pool[Math.floor(Math.random() * pool.length)];
}

function updateHomeIcon() {
  if (currentRound !== 1 || homeIconSpawned) return;

  const elapsed = roundStartTimer - roundTimer;
  const threshold = roundStartTimer * HOME_ICON.timerThreshold;

  if (elapsed >= threshold) {
    const cell = findHomeIconCell();
    if (cell) {
      homeIcon = { r: cell.r, c: cell.c };
      homeIconSpawned = true;
      homeIconRelocTimer = HOME_ICON.relocationInterval; // v21: start timed relocation
      if (!homeIconSfxPlayed) {
        playHomeIcon();
        homeIconSfxPlayed = true;
      }

      for (let i = 1; i < villains.length; i++) {
        if (!villains[i].isPrimary) {
          villains[i].isGuardian = true;
          villains[i].snapshotCount = 0;
          break;
        }
      }
    }
  }
}

function checkHomeIconPickup() {
  if (!homeIcon) return false;
  const pr = player.moving && player.moveProgress >= 0.7 ? player.targetR : player.r;
  const pc = player.moving && player.moveProgress >= 0.7 ? player.targetC : player.c;
  return pr === homeIcon.r && pc === homeIcon.c;
}

function calcLingerFrames(tier) {
  const tierDef = OBJECTS[tier];
  if (tierDef.lingerFixed !== undefined) {
    return tierDef.lingerFixed * 60;
  }
  const lingerMult = DIFFICULTY[currentLevel].lingerMult;
  const base = tierDef.lingerMin + Math.random() * (tierDef.lingerMax - tierDef.lingerMin);
  let frames = Math.round(base * lingerMult * 60);
  // v19: T3 linger bonus for Lv4-5
  if (tier === 2 && DIFFICULTY[currentLevel].t3LingerBonus) {
    frames += DIFFICULTY[currentLevel].t3LingerBonus;
  }
  return frames;
}

function spawnObject(tier) {
  if (tierBudget[tier] <= 0) return false;
  const cell = findSpawnCell(tier);
  if (!cell) return false;

  const tierDef = OBJECTS[tier];
  objects.push({
    r: cell.r, c: cell.c,
    tier: tier,
    color: tierDef.color,
    value: tierDef.value,
    spawnFrame: frameCount,
    lingerFrames: calcLingerFrames(tier),
    dead: false,
  });
  tierBudget[tier]--;
  return true;
}

function spawnWave(contents) {
  for (const [tier, count] of contents) {
    for (let i = 0; i < count; i++) {
      spawnObject(tier);
    }
  }
}

function updateWaves() {
  const template = WAVE_TEMPLATES[currentLevel];

  commonWaveTimer--;
  if (commonWaveTimer <= 0) {
    spawnWave(template.common.contents);
    commonWaveTimer = Math.round(template.common.interval * 60);
  }

  uncommonWaveTimer--;
  if (uncommonWaveTimer <= 0) {
    spawnWave(template.uncommon.contents);
    uncommonWaveTimer = Math.round(template.uncommon.interval * 60);
  }

  const lateConfig = LATE_BONUS[currentLevel];
  if (lateConfig.threshold > 0 && roundTimer <= lateConfig.threshold) {
    if (!lateBonusActive) {
      lateBonusActive = true;
      lateBonusTimer = 1;
    }
    lateBonusTimer--;
    if (lateBonusTimer <= 0) {
      if (lateBonusT3Left > 0) {
        spawnBonusObject(2);
        lateBonusT3Left--;
      }
      if (lateBonusT4Left > 0) {
        spawnBonusObject(3);
        lateBonusT4Left--;
      }
      lateBonusTimer = Math.round(lateConfig.interval * 60);
    }
  }
}

function spawnBonusObject(tier) {
  const cell = findSpawnCell(tier);
  if (!cell) return;

  const tierDef = OBJECTS[tier];
  objects.push({
    r: cell.r, c: cell.c,
    tier: tier,
    color: tierDef.color,
    value: tierDef.value,
    spawnFrame: frameCount,
    lingerFrames: calcLingerFrames(tier),
    dead: false,
  });
}

// v15: Density wave system — separate unlimited budget spawns (Lv3-5)
function spawnDensityObject(tier) {
  const cell = findSpawnCell(tier);
  if (!cell) return;

  const tierDef = OBJECTS[tier];
  objects.push({
    r: cell.r, c: cell.c,
    tier: tier,
    color: tierDef.color,
    value: tierDef.value,
    spawnFrame: frameCount,
    lingerFrames: calcLingerFrames(tier),
    dead: false,
  });
}

function updateDensityWave() {
  if (currentLevel < DENSITY_WAVE.minLevel) return;

  // v16: Only fire density waves after 50% of initial timer elapsed
  const elapsed = roundStartTimer - roundTimer;
  if (elapsed < roundStartTimer * DENSITY_WAVE.startPct) return;

  densityWaveTimer--;
  if (densityWaveTimer <= 0) {
    for (const [tier, count] of DENSITY_WAVE.contents) {
      for (let i = 0; i < count; i++) {
        spawnDensityObject(tier);
      }
    }
    densityWaveTimer = DENSITY_WAVE.interval;
  }
}

function markExpiredObjects() {
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i].dead && (frameCount - objects[i].spawnFrame) >= objects[i].lingerFrames) {
      objects[i].dead = true;
    }
  }
}

function cleanupDeadObjects() {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].dead) objects.splice(i, 1);
  }
}

function updateObjects() {
  markExpiredObjects();
  if (frameCount % CLEANUP_INTERVAL === 0) {
    cleanupDeadObjects();
  }
  updateWaves();
  updateDensityWave(); // v15: density wave system
}

function checkPickups() {
  const pr = player.moving && player.moveProgress >= 0.7 ? player.targetR : player.r;
  const pc = player.moving && player.moveProgress >= 0.7 ? player.targetC : player.c;

  for (let i = 0; i < objects.length; i++) {
    if (!objects[i].dead && objects[i].r === pr && objects[i].c === pc) {
      cpm += objects[i].value;
      pickupPopup = { value: objects[i].value, color: objects[i].color, frame: 0 };
      objects[i].dead = true;
      playPickup();
      const gp = (cpm < LOW_CPM.threshold) ? LOW_CPM.gracePeriod : CPM.gracePeriod;
      graceFrames = Math.round(gp * 60);
    }
  }
}

function updateCPMDecay() {
  if (graceFrames > 0) {
    graceFrames--;
    return;
  }
  let mult = (cpm < LOW_CPM.threshold) ? LOW_CPM.decayMult : 1;
  // Decay penalty from QM
  if (activeDecayPenalty && activeDecayPenalty.framesLeft > 0 && cpm >= LOW_CPM.threshold) {
    mult *= QM_EFFECTS.decayPenalty.mult;
  }
  cpm -= (decayPerSecond * mult) / 60;
  if (cpm < 0) cpm = 0;
}

// ============================================================
// POWER-UP SYSTEM
// ============================================================

function getPowerupTypeOrder() {
  return [POWERUP_TYPES.COFFEE, POWERUP_TYPES.EXTRA_TAG, POWERUP_TYPES.CAMERA];
}

function findPowerupSpawnCell() {
  const occupied = new Set();
  occupied.add(player.r + ',' + player.c);
  for (const v of villains) {
    if (v.visible) occupied.add(v.r + ',' + v.c);
  }
  if (chaser && chaser.visible) occupied.add(chaser.r + ',' + chaser.c);
  for (const obj of objects) {
    if (!obj.dead) occupied.add(obj.r + ',' + obj.c);
  }
  for (const pu of powerups) {
    if (!pu.dead) occupied.add(pu.r + ',' + pu.c);
  }
  if (questionMark) occupied.add(questionMark.r + ',' + questionMark.c);

  let candidates = pathCells.filter(p => !occupied.has(p.r + ',' + p.c));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function calcPowerupLingerFrames() {
  const lingerMult = DIFFICULTY[currentLevel].lingerMult;
  const base = POWERUP_SPAWN.lingerMin + Math.random() * (POWERUP_SPAWN.lingerMax - POWERUP_SPAWN.lingerMin);
  return Math.round(base * lingerMult * 60);
}

function pickWeightedPowerupType() {
  // Only types with remaining budget
  const types = getPowerupTypeOrder();
  const budgetIdx = { coffee: 0, extraTag: 1, camera: 2 };
  const available = types.filter(t => powerupBudget[budgetIdx[t]] > 0);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function spawnPowerup() {
  const onScreen = powerups.filter(p => !p.dead).length;
  if (onScreen >= POWERUP_SPAWN.maxOnScreen) return;

  const type = pickWeightedPowerupType();
  if (!type) return;

  const cell = findPowerupSpawnCell();
  if (!cell) return;

  const budgetIdx = { coffee: 0, extraTag: 1, camera: 2 };
  powerupBudget[budgetIdx[type]]--;

  powerups.push({
    r: cell.r, c: cell.c,
    type,
    spawnFrame: frameCount,
    lingerFrames: calcPowerupLingerFrames(),
    dead: false,
  });
}

function pickQMOutcome() {
  let eligible = [...QM_OUTCOMES];
  // Reroll camera if 0 warnings
  if (warnings === 0) {
    eligible = eligible.filter(o => o !== 'camera');
  }
  // Reroll timerExtend in Round 1
  if (currentRound === 0) {
    eligible = eligible.filter(o => o !== 'timerExtend');
  }
  if (eligible.length === 0) eligible = ['coffee']; // fallback
  return eligible[Math.floor(Math.random() * eligible.length)];
}

function spawnQuestionMark() {
  if (questionMark) return;
  // Don't spawn if player already has one in a slot
  if ((playerSlotA && playerSlotA.type === POWERUP_TYPES.QUESTION) ||
      (playerSlotB && playerSlotB.type === POWERUP_TYPES.QUESTION)) return;
  if (powerupBudget[3] <= 0) return;

  const cell = findPowerupSpawnCell();
  if (!cell) return;

  powerupBudget[3]--;
  questionMark = {
    r: cell.r, c: cell.c,
    visible: true,
    timer: POWERUP_SPAWN.question.visibleDuration,
    outcome: pickQMOutcome(),
  };
}

function updateQuestionMark() {
  if (!questionMark) return;
  // Don't cycle if it's been picked up (held flag not needed — questionMark is nulled on pickup)
  questionMark.timer--;
  if (questionMark.timer <= 0) {
    if (questionMark.visible) {
      // Switch to hidden
      questionMark.visible = false;
      questionMark.timer = POWERUP_SPAWN.question.hiddenDuration;
    } else {
      // Reappear in new cell with new outcome
      const cell = findPowerupSpawnCell();
      if (cell) {
        questionMark.r = cell.r;
        questionMark.c = cell.c;
      }
      questionMark.visible = true;
      questionMark.timer = POWERUP_SPAWN.question.visibleDuration;
      questionMark.outcome = pickQMOutcome();
    }
  }
}

function updatePowerupSpawning() {
  const elapsed = roundStartTimer - roundTimer;
  const firstSpawnTime = roundStartTimer * POWERUP_SPAWN.firstSpawnPct;
  const qmFirstSpawnTime = roundStartTimer * POWERUP_SPAWN.question.firstSpawnPct;

  // Regular power-ups
  if (elapsed >= firstSpawnTime) {
    powerupSpawnTimer--;
    if (powerupSpawnTimer <= 0) {
      spawnPowerup();
      powerupSpawnTimer = POWERUP_SPAWN.spawnInterval;
    }
  }

  // Question Mark
  if (elapsed >= qmFirstSpawnTime && powerupBudget[3] > 0) {
    if (!questionMark) {
      // Check player isn't holding one
      const held = (playerSlotA && playerSlotA.type === POWERUP_TYPES.QUESTION) ||
                   (playerSlotB && playerSlotB.type === POWERUP_TYPES.QUESTION);
      if (!held) spawnQuestionMark();
    }
  }

  updateQuestionMark();

  // Mark expired power-ups
  for (let i = 0; i < powerups.length; i++) {
    if (!powerups[i].dead && (frameCount - powerups[i].spawnFrame) >= powerups[i].lingerFrames) {
      powerups[i].dead = true;
    }
  }
  // Cleanup dead
  if (frameCount % CLEANUP_INTERVAL === 0) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      if (powerups[i].dead) powerups.splice(i, 1);
    }
  }

  // Late-round bonus power-ups (Lv3+, last 10s, all budgets exhausted)
  if (currentLevel >= POWERUP_SPAWN.lateBonus.minLevel &&
      roundTimer <= POWERUP_SPAWN.lateBonus.threshold) {
    const allExhausted = powerupBudget.every(b => b <= 0);
    if (allExhausted) {
      if (!latePowerupActive) {
        latePowerupActive = true;
        latePowerupTimer = 1;
      }
      latePowerupTimer--;
      if (latePowerupTimer <= 0) {
        // Spawn 1 coffee + 1 QM regardless of budget
        const c1 = findPowerupSpawnCell();
        if (c1) {
          powerups.push({
            r: c1.r, c: c1.c,
            type: POWERUP_TYPES.COFFEE,
            spawnFrame: frameCount,
            lingerFrames: calcPowerupLingerFrames(),
            dead: false,
          });
        }
        if (!questionMark) {
          const c2 = findPowerupSpawnCell();
          if (c2) {
            questionMark = {
              r: c2.r, c: c2.c,
              visible: true,
              timer: POWERUP_SPAWN.question.visibleDuration,
              outcome: pickQMOutcome(),
            };
          }
        }
        latePowerupTimer = POWERUP_SPAWN.lateBonus.interval;
      }
    }
  }
}

function checkPowerupPickups() {
  const pr = player.moving && player.moveProgress >= 0.7 ? player.targetR : player.r;
  const pc = player.moving && player.moveProgress >= 0.7 ? player.targetC : player.c;

  // Check regular power-ups
  for (let i = 0; i < powerups.length; i++) {
    if (powerups[i].dead) continue;
    if (powerups[i].r === pr && powerups[i].c === pc) {
      if (!playerSlotA) {
        playerSlotA = { type: powerups[i].type };
        powerups[i].dead = true;
        playPickup();
        // v19: Tutorial trigger on first power-up pickup (Lv1 R1 only)
        if (!powerupTutorialShown && currentLevel === 0 && currentRound === 0) {
          powerupTutorialShown = true;
          bgmPause();
          gameState = STATES.POWERUP_TUTORIAL;
          return;
        }
      } else if (!playerSlotB) {
        playerSlotB = { type: powerups[i].type };
        powerups[i].dead = true;
        playPickup();
        // v20: Tutorial trigger on slot B too
        if (!powerupTutorialShown && currentLevel === 0 && currentRound === 0) {
          powerupTutorialShown = true;
          bgmPause();
          gameState = STATES.POWERUP_TUTORIAL;
          return;
        }
      }
      // Both full = pass over (no pickup)
    }
  }

  // Check question mark
  if (questionMark && questionMark.visible) {
    if (questionMark.r === pr && questionMark.c === pc) {
      if (!playerSlotA) {
        playerSlotA = { type: POWERUP_TYPES.QUESTION, outcome: questionMark.outcome };
        questionMark = null;
        playPickup();
        // v19: Tutorial trigger for QM too
        if (!powerupTutorialShown && currentLevel === 0 && currentRound === 0) {
          powerupTutorialShown = true;
          bgmPause();
          gameState = STATES.POWERUP_TUTORIAL;
          return;
        }
      } else if (!playerSlotB) {
        playerSlotB = { type: POWERUP_TYPES.QUESTION, outcome: questionMark.outcome };
        questionMark = null;
        playPickup();
        // v20: Tutorial trigger on slot B too (QM)
        if (!powerupTutorialShown && currentLevel === 0 && currentRound === 0) {
          powerupTutorialShown = true;
          bgmPause();
          gameState = STATES.POWERUP_TUTORIAL;
          return;
        }
      }
    }
  }
}

function getActivationScreenData(type, outcome) {
  if (type === POWERUP_TYPES.COFFEE) {
    return { header: 'Coffee activated!', headerColor: '#4f4', subtext: 'You have more energy now!', subtextColor: '#ccc' };
  }
  if (type === POWERUP_TYPES.EXTRA_TAG) {
    return { header: 'Extra Tag activated!', headerColor: '#4f4', subtext: 'Is busy and volume is high!', subtextColor: '#ccc' };
  }
  if (type === POWERUP_TYPES.CAMERA) {
    return { header: 'You reported a dangerous hazard!', headerColor: '#4f4', subtext: 'Manager is happy and removed one warning!', subtextColor: '#ccc' };
  }
  if (type === POWERUP_TYPES.QUESTION) {
    switch (outcome) {
      case 'coffee':
        return { header: 'Surprise!', headerColor: '#4f4', subtext: "It's a coffee! You have more energy now!", subtextColor: '#ccc' };
      case 'extraTag':
        return { header: 'Surprise!', headerColor: '#4f4', subtext: 'Is busy and volume is high!', subtextColor: '#ccc' };
      case 'camera':
        return { header: 'Surprise!', headerColor: '#4f4', subtext: 'You reported a dangerous hazard!', subtextColor: '#ccc', subtext2: 'One warning removed!', subtext2Color: '#ccc' };
      case 'decayPenalty':
        return { header: 'Uh oh!', headerColor: '#f44', subtext: 'Your watch is not working properly!', subtextColor: '#f44', subtext2: 'CPM drops quicker and you feel slow!', subtext2Color: '#ccc' };
      case 'timerExtend':
        return { header: 'Bad news!', headerColor: '#f44', subtext: 'Today is busy! 30s flex!', subtextColor: '#fff' };
      case 'managersVanish':
        return { header: 'Surprise!', headerColor: '#4f4', subtext: 'Managers are in a meeting!', subtextColor: '#ccc' };
      default:
        return { header: 'Surprise!', headerColor: '#4f4', subtext: '', subtextColor: '#ccc' };
    }
  }
  return { header: 'Activated!', headerColor: '#4f4', subtext: '', subtextColor: '#ccc' };
}

function tryActivatePowerup(slot) {
  const item = slot === 'A' ? playerSlotA : playerSlotB;
  if (!item) return false;

  // Camera with 0 warnings = silent, do nothing
  if (item.type === POWERUP_TYPES.CAMERA && warnings === 0) return false;
  // QM camera outcome with 0 warnings — should have been rerolled, but safety check
  if (item.type === POWERUP_TYPES.QUESTION && item.outcome === 'camera' && warnings === 0) return false;

  const outcome = item.type === POWERUP_TYPES.QUESTION ? item.outcome : null;
  const screenData = getActivationScreenData(item.type, outcome);

  // Determine which SFX to play
  if (item.type === POWERUP_TYPES.QUESTION && item.outcome === 'decayPenalty') {
    playWarning(); // Villain_contact.wav for negative outcome
  } else {
    playABUse();
  }

  // Store activation data for the screen
  powerupActivationData = {
    ...screenData,
    effectType: item.type,
    effectOutcome: outcome,
  };

  // Clear the slot
  if (slot === 'A') playerSlotA = null;
  else playerSlotB = null;

  bgmPause();
  gameState = STATES.POWERUP_ACTIVATION;
  return true;
}

function applyPowerupEffect(data) {
  const type = data.effectType;
  const outcome = data.effectOutcome;

  const effectToApply = type === POWERUP_TYPES.QUESTION ? outcome : type;

  switch (effectToApply) {
    case POWERUP_TYPES.COFFEE:
    case 'coffee':
      activeCoffee = { framesLeft: POWERUP_DEFS.coffee.effectDuration };
      break;

    case POWERUP_TYPES.EXTRA_TAG:
    case 'extraTag': {
      // Instant burst of objects
      const burst = POWERUP_DEFS.extraTag.burst;
      const burstLinger = POWERUP_DEFS.extraTag.burstLinger;
      const burstLingerT1T2 = POWERUP_DEFS.extraTag.burstLingerT1T2; // v19: +1.5s for T1/T2
      // Prioritize higher tiers: T4→T3→T2→T1
      const tiers = [
        { tier: 3, count: burst.t4 },
        { tier: 2, count: burst.t3 },
        { tier: 1, count: burst.t2 },
        { tier: 0, count: burst.t1 },
      ];
      for (const { tier, count } of tiers) {
        for (let i = 0; i < count; i++) {
          const cell = findSpawnCell(tier);
          if (!cell) break; // No cells left, skip remaining
          const tierDef = OBJECTS[tier];
          const linger = (tier <= 1) ? burstLingerT1T2 : burstLinger; // v19: T1/T2 get longer linger
          objects.push({
            r: cell.r, c: cell.c,
            tier, color: tierDef.color, value: tierDef.value,
            spawnFrame: frameCount,
            lingerFrames: linger,
            dead: false,
          });
        }
      }
      break;
    }

    case POWERUP_TYPES.CAMERA:
    case 'camera':
      warnings = Math.max(0, warnings - 1);
      break;

    case 'decayPenalty':
      activeDecayPenalty = { framesLeft: QM_EFFECTS.decayPenalty.duration };
      break;

    case 'timerExtend':
      roundTimer += QM_EFFECTS.timerExtend.seconds;
      roundStartTimer += QM_EFFECTS.timerExtend.seconds;
      break;

    case 'managersVanish':
      managersVanished = { framesLeft: QM_EFFECTS.managersVanish.duration };
      // Hide all villains
      for (const v of villains) {
        if (v.visible) {
          v.visible = false;
          v.moving = false;
          v.path = [];
          v.pathIndex = 0;
          v.respawnTimer = QM_EFFECTS.managersVanish.duration;
        }
      }
      if (chaser) {
        chaser = null; // just remove the chaser
      }
      break;
  }
}

function updateActiveEffects() {
  // Coffee countdown
  if (activeCoffee) {
    activeCoffee.framesLeft--;
    if (activeCoffee.framesLeft <= 0) activeCoffee = null;
  }

  // Decay penalty countdown
  if (activeDecayPenalty) {
    activeDecayPenalty.framesLeft--;
    if (activeDecayPenalty.framesLeft <= 0) activeDecayPenalty = null;
  }

  // Managers vanished countdown
  if (managersVanished) {
    managersVanished.framesLeft--;
    if (managersVanished.framesLeft <= 0) {
      managersVanished = null;
      // Villains reappear at opposite quadrant is handled by their normal respawnTimer
    }
  }
}

function getActiveEffectText() {
  if (activeDecayPenalty && activeDecayPenalty.framesLeft > 0) {
    return 'Your watch is working very slowly';
  }
  if (managersVanished && managersVanished.framesLeft > 0) {
    return 'Managers in meeting...';
  }
  return null;
}

// ---- Round advancement ----
function advanceRound(reason) {
  winReason = reason || 'timer';
  completedRound = currentRound;
  completedLevel = currentLevel; // v20: track level for custom Lv5 R2 messages
  roundCompleteSfxPlayed = false;
  bgmPause();

  gameState = STATES.ROUND_COMPLETE;
}

function proceedAfterRoundComplete() {
  currentRound++;
  if (currentRound >= 2) {
    currentRound = 0;
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
      victorySfxPlayed = false;
      victoryParticles = [];
      gameState = STATES.VICTORY;
      return;
    }
  }
  gameState = STATES.LEVEL_INTRO;
  introTimer = INTRO_DURATION;
}

function startRound() {
  const maze = getMaze();

  renderMazeCache(maze);

  const pStart = findPlayerStart(maze);
  player.r = pStart.r;
  player.c = pStart.c;
  player.targetR = pStart.r;
  player.targetC = pStart.c;
  player.moveProgress = 0;
  player.moving = false;
  player.facingR = 0;
  player.facingC = -1;

  // ---- Spawn villains ----
  const villainCount = VILLAIN_COUNTS[currentLevel][currentRound];
  const starts = findVillainStarts(maze, villainCount);
  villains = [];
  for (let i = 0; i < villainCount; i++) {
    const isPrimary = (i === 0);
    const speedMult = isPrimary ? DIFFICULTY[currentLevel].villainSpeed : ADDITIONAL_VILLAIN_SPEED;
    const snapshotSec = VILLAIN.snapshotIntervals[Math.min(i, VILLAIN.snapshotIntervals.length - 1)];
    villains.push(createVillain(starts[i].r, starts[i].c, isPrimary, speedMult, snapshotSec));
  }

  chaser = null;

  cpmWasAboveThreshold = true;
  cpmCrossCount = 0;
  below90SfxPlayed = false;

  warningFlashTimer = 0;
  warningCooldownTimer = 0;

  cpm = CPM.starting;
  warnings = 0;
  roundTimer = LEVELS[currentLevel].timer;
  roundStartTimer = roundTimer;

  peakCpm = CPM.starting;
  homeIcon = null;
  homeIconSpawned = false;
  homeIconSfxPlayed = false;
  homeIconRelocTimer = 0; // v21: reset timed relocation

  const levelDifficulty = DIFFICULTY[currentLevel];
  decayPerSecond = CPM.starting / (levelDifficulty.decayFactor * roundTimer);
  graceFrames = 0;

  objects = [];
  frameCount = 0;
  pickupPopup = null;

  const caps = ROUND_CAPS[currentLevel];
  tierBudget = [Infinity, Infinity, caps[0], caps[1]];

  const lateConfig = LATE_BONUS[currentLevel];
  lateBonusT3Left = lateConfig.t3Reserve;
  lateBonusT4Left = lateConfig.t4Reserve;
  lateBonusActive = false;
  lateBonusTimer = 0;

  const template = WAVE_TEMPLATES[currentLevel];
  commonWaveTimer = 1;
  uncommonWaveTimer = Math.round(template.uncommon.interval * 60);
  densityWaveTimer = DENSITY_WAVE.interval; // v15: density wave init

  // Power-up system reset
  powerups = [];
  const puCaps = POWERUP_CAPS[currentLevel];
  powerupBudget = [puCaps[0], puCaps[1], puCaps[2], puCaps[3]];
  powerupSpawnTimer = POWERUP_SPAWN.spawnInterval;
  questionMark = null;
  playerSlotA = null;
  playerSlotB = null;
  activeCoffee = null;
  activeDecayPenalty = null;
  managersVanished = null;
  latePowerupActive = false;
  latePowerupTimer = 0;
  powerupActivationData = null;
  pendingWarningCount = 0;

  cachePaths();
}

// ============================================================
// VICTORY PARTICLES (fireworks)
// ============================================================

const FIREWORK_COLORS = ['#f44','#4f4','#44f','#fc6','#f6f','#6cf','#d4ff00','#fff'];

function spawnFirework() {
  const cx = 50 + Math.random() * (CANVAS_W - 100);
  const cy = 40 + Math.random() * (CANVAS_H - 120);
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  const count = 12 + Math.floor(Math.random() * 10);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 1 + Math.random() * 2.5;
    victoryParticles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.008 + Math.random() * 0.012,
      color,
      size: 1.5 + Math.random() * 2,
    });
  }
}

function updateVictoryParticles() {
  for (let i = victoryParticles.length - 1; i >= 0; i--) {
    const p = victoryParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03; // gravity
    p.life -= p.decay;
    if (p.life <= 0) {
      victoryParticles.splice(i, 1);
    }
  }

  // Spawn new fireworks periodically
  if (Math.random() < 0.08) {
    spawnFirework();
  }
}

// ============================================================
// MUTE BUTTON (canvas tap detection)
// ============================================================

function setupCanvasTap() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  function handleTap(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    // Check mute button
    if (cx >= MUTE_BTN.x && cx <= MUTE_BTN.x + MUTE_BTN.w &&
        cy >= MUTE_BTN.y && cy <= MUTE_BTN.y + MUTE_BTN.h) {
      const m = toggleMute();
      if (m) bgmPause();
      else if (gameState === STATES.PLAYING || gameState === STATES.INSTRUCTIONS) bgmPlay();
      unlockBGM();
      e.preventDefault();
    }
  }

  canvas.addEventListener('click', handleTap);
  canvas.addEventListener('touchstart', handleTap, { passive: false });
}

// ---- Game loop ----
function update() {
  const input = getInput();

  switch (gameState) {
    case STATES.TITLE:
      if (justPressed('start') || justPressed('attackA')) {
        unlockBGM();
        resumeAudioOnGesture();
        currentLevel = 0;
        currentRound = 0;
        gameState = STATES.LEVEL_INTRO;
        introTimer = INTRO_DURATION;
      }
      if (justPressed('select')) {
        unlockBGM();
        resumeAudioOnGesture();
        prevStateBeforePause = STATES.TITLE;
        gameState = STATES.INSTRUCTIONS;
      }
      break;

    case STATES.LEVEL_INTRO:
      introTimer--;
      if (introTimer <= 0 || justPressed('start') || justPressed('attackA')) {
        resumeAudioOnGesture();
        startRound();
        gameState = STATES.PLAYING;
        bgmPlay();
      }
      break;

    case STATES.PLAYING: {
      // ---- Player movement ----
      updatePlayerMovement();

      if (!player.moving) {
        let dr = 0, dc = 0;
        if (input.right) { dr = 0; dc = 1; }
        if (input.left)  { dr = 0; dc = -1; }
        if (input.down)  { dr = 1; dc = 0; }
        if (input.up)    { dr = -1; dc = 0; }

        if (dr !== 0 || dc !== 0) {
          tryMove(dr, dc);
        }
      }

      // ---- Object lifecycle ----
      frameCount++;
      updateObjects();
      checkPickups();

      // ---- Power-up system ----
      updatePowerupSpawning();
      checkPowerupPickups();
      updateActiveEffects();

      // ---- Power-up activation (A/B buttons) ----
      if (justPressed('attackA') && playerSlotA) {
        if (tryActivatePowerup('A')) break;
      }
      if (justPressed('attackB') && playerSlotB) {
        if (tryActivatePowerup('B')) break;
      }

      // ---- Villain AI ----
      updateVillains();
      updateChaser();

      // If state changed to WARNING_SCREEN, bail out
      if (gameState !== STATES.PLAYING) break;

      // ---- Below-90 CPM threshold check ----
      updateCPMThreshold();
      // If state changed to BELOW90_CHOICE, bail out of PLAYING update
      if (gameState !== STATES.PLAYING) break;

      // ---- Warning cooldown countdown ----
      if (warningCooldownTimer > 0) warningCooldownTimer--;

      // ---- Warning flash countdown ----
      if (warningFlashTimer > 0) warningFlashTimer--;

      // ---- CPM decay ----
      updateCPMDecay();

      // ---- Win condition: 400 CPM instant clear ----
      if (cpm >= CPM.winThreshold) {
        advanceRound('highCpm');
        break;
      }

      // ---- Win condition: Home icon (Round 2 only) ----
      updateHomeIcon();
      // v21: timed home icon relocation every 4s
      if (homeIcon && homeIconSpawned) {
        homeIconRelocTimer--;
        if (homeIconRelocTimer <= 0) {
          relocateHomeIcon();
          homeIconRelocTimer = HOME_ICON.relocationInterval;
        }
      }
      if (checkHomeIconPickup()) {
        advanceRound('homeIcon');
        break;
      }

      // ---- Lose condition: CPM drops to 0 ----
      if (cpm <= 0) {
        cpm = 0;
        gameOverReason = 'cpm';
        gameOverSfxPlayed = false;
        bgmPause();
        gameState = STATES.GAME_OVER;
        break;
      }

      // ---- Lose condition: 3 warnings ----
      if (warnings >= VILLAIN.warningMax) {
        gameOverReason = 'warnings';
        gameOverSfxPlayed = false;
        bgmPause();
        gameState = STATES.GAME_OVER;
        break;
      }

      // ---- Timer countdown ----
      roundTimer -= 1 / 60;
      if (roundTimer <= 0) {
        roundTimer = 0;
        advanceRound('timer');
        break;
      }

      // Pause
      if (justPressed('start')) {
        prevStateBeforePause = STATES.PLAYING;
        bgmPause();
        gameState = STATES.PAUSED;
      }
      // Instructions
      if (justPressed('select')) {
        prevStateBeforePause = STATES.PLAYING;
        gameState = STATES.INSTRUCTIONS;
      }
      break;
    }

    case STATES.BELOW90_CHOICE:
      if (justPressed('attackA')) {
        resumeAudioOnGesture();
        // A: Warning
        tryAddWarning();
        gameState = STATES.BELOW90_FOLLOWUP;
      } else if (justPressed('attackB')) {
        resumeAudioOnGesture();
        // B: 15s flex — add time to round timer
        roundTimer += FLEX_BONUS;
        roundStartTimer += FLEX_BONUS;
        gameState = STATES.BELOW90_FOLLOWUP;
      }
      // Update the above-threshold tracker so it doesn't re-trigger immediately
      cpmWasAboveThreshold = false;
      break;

    case STATES.BELOW90_FOLLOWUP:
      if (justPressed('attackA')) {
        stopAllSFX();
        resumeAudioOnGesture();
        bgmPlay();
        gameState = STATES.PLAYING;
      }
      break;

    case STATES.WARNING_SCREEN:
      if (justPressed('attackA')) {
        stopAllSFX();
        resumeAudioOnGesture();
        if (warnings >= VILLAIN.warningMax) {
          gameOverReason = 'warnings';
          gameOverSfxPlayed = false;
          gameState = STATES.GAME_OVER;
        } else {
          bgmPlay();
          gameState = STATES.PLAYING;
        }
      }
      break;

    case STATES.POWERUP_ACTIVATION:
      if (justPressed('attackA')) {
        stopAllSFX();
        resumeAudioOnGesture();
        if (powerupActivationData) {
          applyPowerupEffect(powerupActivationData);
          powerupActivationData = null;
        }
        bgmPlay();
        gameState = STATES.PLAYING;
      }
      break;

    case STATES.POWERUP_TUTORIAL: // v19: first power-up pickup tutorial
      if (justPressed('attackA')) {
        resumeAudioOnGesture();
        bgmPlay();
        gameState = STATES.PLAYING;
      }
      break;

    case STATES.ROUND_COMPLETE:
      if (!roundCompleteSfxPlayed) {
        playRoundWin();
        roundCompleteSfxPlayed = true;
      }
      if (justPressed('attackA')) {
        stopAllSFX();
        resumeAudioOnGesture();
        proceedAfterRoundComplete();
      }
      break;

    case STATES.PAUSED:
      if (justPressed('start')) {
        resumeAudioOnGesture();
        const dest = prevStateBeforePause || STATES.PLAYING;
        gameState = dest;
        if (dest === STATES.PLAYING) bgmPlay();
      }
      if (justPressed('select')) {
        gameState = STATES.INSTRUCTIONS;
      }
      break;

    case STATES.GAME_OVER:
      if (!gameOverSfxPlayed) {
        playRoundLose();
        gameOverSfxPlayed = true;
      }
      if (justPressed('start')) {
        stopAllSFX();
        resumeAudioOnGesture();
        bgmStop(); // v19: restart BGM from beginning on retry
        currentLevel = 0;
        currentRound = 0;
        gameState = STATES.LEVEL_INTRO;
        introTimer = INTRO_DURATION;
      }
      break;

    case STATES.INSTRUCTIONS:
      if (justPressed('select') || justPressed('start')) {
        resumeAudioOnGesture();
        const dest = prevStateBeforePause || STATES.PLAYING;
        gameState = dest;
        if (dest === STATES.PLAYING) bgmPlay();
      }
      break;

    case STATES.VICTORY:
      if (!victorySfxPlayed) {
        startVictoryLoop(); // v19: loop victory fanfare with ~1s gap
        victorySfxPlayed = true;
        // Spawn initial burst of fireworks
        for (let i = 0; i < 5; i++) spawnFirework();
      }
      updateVictoryParticles();
      if (justPressed('start')) {
        stopVictoryLoop(); // v19: stop the loop
        stopAllSFX();
        resumeAudioOnGesture();
        gameState = STATES.TITLE;
      }
      break;
  }

  updatePrev();
}

// ---- Render helpers for game scene ----
function renderGameScene() {
  clearCanvas();
  drawBackground();

  // Draw objects (skip dead)
  objects.forEach(obj => {
    if (obj.dead) return;
    const pos = cellToPixel(obj.r, obj.c);
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 300 + obj.r * 3 + obj.c * 7);
    drawObject(pos.x, pos.y, objectRadius() * pulse, obj.color);
  });

  // Draw power-ups on maze floor
  powerups.forEach(pu => {
    if (pu.dead) return;
    const pos = cellToPixel(pu.r, pu.c);
    drawPowerup(pos.x, pos.y, entityRadius(), pu.type, true);
  });

  // Draw question mark (if visible)
  if (questionMark && questionMark.visible) {
    const qp = cellToPixel(questionMark.r, questionMark.c);
    drawPowerup(qp.x, qp.y, entityRadius(), POWERUP_TYPES.QUESTION, true);
  }

  // Draw home icon (Round 2)
  if (homeIcon) {
    const hp = cellToPixel(homeIcon.r, homeIcon.c);
    drawHomeIcon(hp.x, hp.y, entityRadius());
  }

  // Draw villains (main)
  for (const v of villains) {
    if (!v.visible) continue;
    const vp = getVillainPixel(v);
    drawVillain(vp.x, vp.y, entityRadius(), COLORS.villain);
  }

  // Draw chaser villain (with pulsing glow effect)
  if (chaser && chaser.visible) {
    const cp = getVillainPixel(chaser);
    drawChaserVillain(cp.x, cp.y, entityRadius());
  }

  // Draw player (interpolated position)
  const pp = getPlayerPixel();

  // Coffee aura (draw before player so it's behind)
  if (activeCoffee && activeCoffee.framesLeft > 0) {
    drawCoffeeAura(pp.x, pp.y, entityRadius());
  }

  drawPlayer(pp.x, pp.y, entityRadius(), !!(activeCoffee && activeCoffee.framesLeft > 0));

  // HUD
  const lv = LEVELS[currentLevel];
  drawHUD({
    cpm,
    levelName: `LV${currentLevel + 1} - ${lv.name.toUpperCase()}`,
    roundName: lv.roundNames[currentRound],
    timer: roundTimer,
    timerTotal: roundStartTimer,
    warnings,
    powerA: playerSlotA,
    powerB: playerSlotB,
  });

  // Mute button (below HUD)
  drawMuteButton();

  // Active effect indicator text
  const effectText = getActiveEffectText();
  if (effectText) drawActiveEffectText(effectText);

  // Pickup popup (after HUD so it's on top)
  if (pickupPopup) {
    pickupPopup.frame++;
    if (pickupPopup.frame > 60) {
      pickupPopup = null;
    } else {
      drawPickupPopup(pickupPopup);
    }
  }

  // Warning flash overlay
  if (warningFlashTimer > 0) {
    const alpha = warningFlashTimer / WARNING_FLASH_DURATION;
    drawWarningFlash(alpha);
  }
}

function render() {
  switch (gameState) {
    case STATES.TITLE:
      drawTitleScreen();
      break;

    case STATES.LEVEL_INTRO: {
      const lv = LEVELS[currentLevel];
      drawLevelIntro(currentLevel + 1, lv.name, lv.roundNames[currentRound]);
      break;
    }

    case STATES.PLAYING:
      renderGameScene();
      break;

    case STATES.PAUSED:
      renderGameScene();
      drawPauseOverlay();
      break;

    case STATES.BELOW90_CHOICE:
      renderGameScene();
      drawBelow90Choice();
      break;

    case STATES.BELOW90_FOLLOWUP:
      renderGameScene();
      drawBelow90Followup();
      break;

    case STATES.WARNING_SCREEN:
      renderGameScene();
      drawWarningScreen(pendingWarningCount);
      break;

    case STATES.POWERUP_ACTIVATION:
      renderGameScene();
      if (powerupActivationData) {
        drawPowerupActivation(
          powerupActivationData.header,
          powerupActivationData.headerColor,
          powerupActivationData.subtext,
          powerupActivationData.subtextColor,
          powerupActivationData.subtext2 || null,
          powerupActivationData.subtext2Color || null,
        );
      }
      break;

    case STATES.POWERUP_TUTORIAL: // v19: power-up tutorial screen
      renderGameScene();
      drawPowerupTutorial();
      break;

    case STATES.ROUND_COMPLETE:
      renderGameScene();
      drawRoundComplete(completedRound, winReason, completedLevel);
      break;

    case STATES.INSTRUCTIONS:
      drawInstructions();
      break;

    case STATES.GAME_OVER: {
      const lvGO = LEVELS[currentLevel];
      drawGameOver(gameOverReason, currentLevel + 1, lvGO.name);
      break;
    }

    case STATES.VICTORY:
      drawVictoryScreen(victoryParticles);
      break;
  }
}

function gameLoop() {
  try {
    update();
    render();
  } catch (e) {
    console.error('[gameLoop]', e);
  }
  requestAnimationFrame(gameLoop);
}

// ---- Init ----
function init() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) { console.error('No canvas found'); return; }
  initRenderer(canvas);
  initControls();
  initAudio();
  setupCanvasTap();

  const frameImg = document.getElementById('frameImg');
  if (frameImg) frameImg.src = 'assets/zebraframe.png';

  gameLoop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
