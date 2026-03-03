// ============================================================
// RENDERER — Canvas drawing for Chill 200CPM
// v16: Blue tint all levels, boosted entity saturation,
//      coffee/camera standalone icons (no square),
//      HUD slots show full icons, coffee effect brighter player,
//      mug shape for coffee, camera without box
// ============================================================

import { CANVAS_W, CANVAS_H, HUD_H, MAZE_H, COLORS, BG_TINT,
         WALL_LINE_WIDTH, WALL_GLOW_BLUR, WALL_INSET, MUTE_BTN,
         POWERUP_TYPES, POWERUP_DEFS, WARNING_MESSAGES } from './constants.js';
import { isMuted } from './audio.js';

let ctx = null;
let bgImage = null;
let bgLoaded = false;
let mazeCache = null;
let mazeCacheCtx = null;

// Character images
let playerImg = null;
let playerImgLoaded = false;
let villainImg = null;
let villainImgLoaded = false;

export function initRenderer(canvas) {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx = canvas.getContext('2d');

  // Create offscreen canvas for maze caching
  mazeCache = document.createElement('canvas');
  mazeCache.width = CANVAS_W;
  mazeCache.height = CANVAS_H;
  mazeCacheCtx = mazeCache.getContext('2d');

  bgImage = new Image();
  bgImage.onload = () => { bgLoaded = true; };
  bgImage.src = 'assets/background.png';

  // Load character images
  playerImg = new Image();
  playerImg.onload = () => { playerImgLoaded = true; };
  playerImg.src = 'assets/player.png';

  villainImg = new Image();
  villainImg.onload = () => { villainImgLoaded = true; };
  villainImg.src = 'assets/villain.png';
}

export function getCtx() { return ctx; }

// ---- Pre-render maze + background to offscreen canvas (called once per round) ----
export function renderMazeCache(mazeGrid) {
  const oc = mazeCacheCtx;
  oc.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background
  if (bgLoaded) {
    const stretchW = CANVAS_W * 1.2;
    oc.drawImage(bgImage, 0, HUD_H, stretchW, MAZE_H);
  } else {
    oc.fillStyle = '#1a1a2a';
    oc.fillRect(0, HUD_H, CANVAS_W, MAZE_H);
  }
  // Navy/blue tint overlay
  oc.fillStyle = BG_TINT;
  oc.fillRect(0, HUD_H, CANVAS_W, MAZE_H);

  // Maze walls
  const rows = mazeGrid.length;
  const cols = mazeGrid[0].length;
  const cellW = CANVAS_W / cols;
  const cellH = MAZE_H / rows;
  const inset = WALL_INSET;

  oc.save();
  oc.translate(0, HUD_H);

  oc.strokeStyle = COLORS.wallStroke;
  oc.lineWidth = WALL_LINE_WIDTH;
  oc.lineCap = 'round';
  oc.shadowColor = COLORS.wallGlow;
  oc.shadowBlur = WALL_GLOW_BLUR;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mazeGrid[r][c] !== 1) continue;

      const x = c * cellW;
      const y = r * cellH;

      const top  = (r === 0)       || (r > 0       && mazeGrid[r-1][c] === 1);
      const bot  = (r === rows-1)  || (r < rows-1  && mazeGrid[r+1][c] === 1);
      const left = (c === 0)       || (c > 0       && mazeGrid[r][c-1] === 1);
      const right= (c === cols-1)  || (c < cols-1  && mazeGrid[r][c+1] === 1);

      if (!top) {
        oc.beginPath(); oc.moveTo(x+inset,y+inset); oc.lineTo(x+cellW-inset,y+inset); oc.stroke();
      }
      if (!bot) {
        oc.beginPath(); oc.moveTo(x+inset,y+cellH-inset); oc.lineTo(x+cellW-inset,y+cellH-inset); oc.stroke();
      }
      if (!left) {
        oc.beginPath(); oc.moveTo(x+inset,y+inset); oc.lineTo(x+inset,y+cellH-inset); oc.stroke();
      }
      if (!right) {
        oc.beginPath(); oc.moveTo(x+cellW-inset,y+inset); oc.lineTo(x+cellW-inset,y+cellH-inset); oc.stroke();
      }

      // Corner connectors
      if (!top && left && c !== 0)        { oc.beginPath(); oc.moveTo(x,y+inset);           oc.lineTo(x+inset,y+inset);           oc.stroke(); }
      if (!top && right && c !== cols-1)   { oc.beginPath(); oc.moveTo(x+cellW-inset,y+inset); oc.lineTo(x+cellW,y+inset);         oc.stroke(); }
      if (!bot && left && c !== 0)         { oc.beginPath(); oc.moveTo(x,y+cellH-inset);     oc.lineTo(x+inset,y+cellH-inset);     oc.stroke(); }
      if (!bot && right && c !== cols-1)   { oc.beginPath(); oc.moveTo(x+cellW-inset,y+cellH-inset); oc.lineTo(x+cellW,y+cellH-inset); oc.stroke(); }
      if (!left && top && r !== 0)         { oc.beginPath(); oc.moveTo(x+inset,y);           oc.lineTo(x+inset,y+inset);           oc.stroke(); }
      if (!left && bot && r !== rows-1)    { oc.beginPath(); oc.moveTo(x+inset,y+cellH-inset); oc.lineTo(x+inset,y+cellH);         oc.stroke(); }
      if (!right && top && r !== 0)        { oc.beginPath(); oc.moveTo(x+cellW-inset,y);     oc.lineTo(x+cellW-inset,y+inset);     oc.stroke(); }
      if (!right && bot && r !== rows-1)   { oc.beginPath(); oc.moveTo(x+cellW-inset,y+cellH-inset); oc.lineTo(x+cellW-inset,y+cellH); oc.stroke(); }
    }
  }

  oc.restore();
}

// ---- Draw cached maze + background (1 drawImage call per frame) ----
export function drawBackground() {
  ctx.drawImage(mazeCache, 0, 0);
}

// ---- Circular image entity (used for player + villains) ----
function drawCircularImage(img, imgLoaded, px, py, radius, glowColor, fallbackColor, borderColor) {
  ctx.save();

  // Outer colored ring (radius + 2)
  ctx.beginPath();
  ctx.arc(px, py, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = borderColor || '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner black ring (radius + 1)
  ctx.beginPath();
  ctx.arc(px, py, radius + 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'transparent';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Clip to circle and draw image
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (imgLoaded && img) {
    ctx.drawImage(img, px - radius, py - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  ctx.restore();
}

// ---- Player (circular image) — v16: coffeeActive = brighter player ----
export function drawPlayer(px, py, radius, coffeeActive) {
  if (coffeeActive) {
    drawCircularImage(playerImg, playerImgLoaded, px, py, radius,
      COLORS.playerCoffeeGlow, COLORS.playerCoffee, COLORS.playerCoffeeBorder);
  } else {
    drawCircularImage(playerImg, playerImgLoaded, px, py, radius,
      COLORS.player, COLORS.player, COLORS.playerBorder);
  }
}

// ---- Villain (circular image, with optional glow color override) ----
export function drawVillain(vx, vy, radius, glowColor) {
  const glow = glowColor || COLORS.villain;
  drawCircularImage(villainImg, villainImgLoaded, vx, vy, radius, glow, COLORS.villain, COLORS.villainBorder);
}

// ---- Chaser villain with pulsing glow/flash effect ----
export function drawChaserVillain(vx, vy, radius) {
  ctx.save();

  // Pulsing outer glow ring (orange, breathing)
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 150));
  const glowRadius = radius + 6 + 3 * Math.sin(Date.now() / 200);

  ctx.beginPath();
  ctx.arc(vx, vy, glowRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 136, 0, ${pulse * 0.7})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#f80';
  ctx.shadowBlur = 12 + 6 * Math.sin(Date.now() / 150);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner pulsing fill glow
  ctx.beginPath();
  ctx.arc(vx, vy, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 100, 0, ${pulse * 0.2})`;
  ctx.fill();

  ctx.restore();

  // Draw the villain image on top
  drawCircularImage(villainImg, villainImgLoaded, vx, vy, radius, '#f80', COLORS.chaser, '#fa0');
}

// ---- Mute button (inside HUD bar) ----
export function drawMuteButton() {
  const m = isMuted();
  const { x, y, w, h } = MUTE_BTN;
  ctx.fillStyle = m ? 'rgba(80,0,0,0.7)' : 'rgba(0,60,0,0.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = m ? '#f44' : COLORS.hiviz;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = m ? '#f66' : '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m ? '\u{1F507}' : '\u{1F50A}', x + w / 2, y + h / 2);
}

// ---- HUD (top 32px bar) ----
export function drawHUD(state) {
  const { cpm, levelName, roundName, timer, timerTotal, warnings, powerA, powerB } = state;

  // Background bar
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);

  // Accent line
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillRect(0, HUD_H - 1, CANVAS_W, 1);

  ctx.shadowBlur = 0;
  ctx.textBaseline = 'middle';
  const midY = HUD_H / 2;

  // ---- LEFT: CPM + Warnings ----
  let cpmColor;
  const cpmVal = Math.floor(cpm);
  if (cpmVal < 100) cpmColor = '#f44';
  else if (cpmVal < 300) cpmColor = '#d4ff00';
  else cpmColor = '#4f4';

  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.fillStyle = cpmColor;
  ctx.textAlign = 'left';
  ctx.fillText(`CPM:${cpmVal}`, 6, midY);

  // Warnings
  ctx.font = 'bold 12px Orbitron, monospace';
  ctx.fillStyle = COLORS.warning;
  ctx.fillText(`\u26A0${warnings}/3`, 110, midY);

  // ---- CENTER: Level + Round name ----
  ctx.textAlign = 'center';

  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = '#ccc';
  ctx.fillText(levelName, CANVAS_W / 2 + 15, midY - 7);

  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 6;
  ctx.fillText(roundName, CANVAS_W / 2 + 15, midY + 8);
  ctx.shadowBlur = 0;

  // ---- RIGHT: Power-ups (horizontal A | B) + Timer ring ----

  // Power-up slot helper (v16: full icons instead of letter abbreviations)
  const slotSize = 14; // icon box size (similar to mute button)
  const slotFontSize = 12; // label size (similar to CPM counter)
  const slotY = midY;
  const slotAx = CANVAS_W - 80; // A slot X
  const slotBx = CANVAS_W - 52; // B slot X (next to A)

  function drawSlotHorizontal(label, slot, cx, cy) {
    // Label
    ctx.font = `bold ${slotFontSize}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#888';
    ctx.fillText(label, cx - slotSize / 2 - 5, cy);

    if (slot && slot.type) {
      const iconCx = cx + 4;
      const iconSize = slotSize * 0.55;

      if (slot.type === POWERUP_TYPES.COFFEE) {
        // Mini mug
        drawCoffeeMug(iconCx, cy, iconSize);
      } else if (slot.type === POWERUP_TYPES.CAMERA) {
        // Mini camera
        drawCameraIcon(iconCx, cy, iconSize);
      } else if (slot.type === POWERUP_TYPES.EXTRA_TAG) {
        // Mini green/white tag rectangle
        const tw = iconSize * 1.4;
        const th = iconSize * 1.1;
        const tx = iconCx - tw / 2;
        const ty = cy - th / 2;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = POWERUP_DEFS.extraTag.color;
        ctx.shadowBlur = 3;
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = POWERUP_DEFS.extraTag.color;
        ctx.fillRect(tx, ty, tw / 2, th / 2);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tx, ty, tw, th);
      } else if (slot.type === POWERUP_TYPES.QUESTION) {
        // Mini white square with "?"
        const qs = iconSize * 1.3;
        const qx = iconCx - qs / 2;
        const qy = cy - qs / 2;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 3;
        ctx.fillRect(qx, qy, qs, qs);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(6, qs * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', iconCx, cy + 1);
      }
    } else {
      ctx.font = `bold ${slotFontSize - 2}px Orbitron, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#555';
      ctx.fillText('---', cx + 4, cy);
    }
  }

  drawSlotHorizontal('A', powerA, slotAx, slotY);
  drawSlotHorizontal('B', powerB, slotBx, slotY);

  // Circular progress timer ring
  const ringRadius = 10;
  const ringX = CANVAS_W - 13;
  const ringY = midY;
  const remaining = Math.max(0, timer) / (timerTotal || 1);

  let ringColor;
  if (remaining > 0.6) ringColor = '#f44';
  else if (remaining > 0.3) ringColor = '#fc6';
  else ringColor = '#4f4';

  // Background ring (dark)
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Progress arc — CLOCKWISE drain
  if (remaining > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle - remaining * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle, true);
    ctx.strokeStyle = ringColor;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 4;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Pulse when under 30%
  if (remaining <= 0.3) {
    const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringRadius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(68, 255, 68, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Seconds inside ring
  ctx.font = 'bold 8px Orbitron, monospace';
  ctx.fillStyle = ringColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.ceil(timer).toString(), ringX, ringY + 1);
}

// ---- Pickup popup (+X floating text next to CPM) ----
export function drawPickupPopup(popup) {
  if (!popup) return;
  const t = popup.frame / 60;
  const alpha = 1 - t * t;
  const yOff = -14 * t;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = 'bold 12px Orbitron, monospace';
  ctx.fillStyle = popup.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = popup.color;
  ctx.shadowBlur = 5;
  ctx.fillText(`+${popup.value}`, 82, HUD_H / 2 + yOff);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Warning flash overlay (brief red flash when warning triggered) ----
export function drawWarningFlash(alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255, 30, 30, 0.35)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Collectible object (glowing rounded square) ----
export function drawObject(ox, oy, radius, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;

  const s = radius * 1.6;
  const r = s * 0.2;
  const x = ox - s / 2;
  const y = oy - s / 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + s - r, y);
  ctx.quadraticCurveTo(x + s, y, x + s, y + r);
  ctx.lineTo(x + s, y + s - r);
  ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
  ctx.lineTo(x + r, y + s);
  ctx.quadraticCurveTo(x, y + s, x, y + s - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // White core glow
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.4;
  const gs = s * 0.3;
  ctx.fillRect(ox - gs / 2, oy - gs / 2, gs, gs);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Power-up icon on maze floor ----
// ---- Draw coffee cup with saucer (white fill, brown outline, no steam) ----
function drawCoffeeMug(px, py, size, alpha) {
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;

  const outlineColor = '#c84';
  const fillColor = '#fff';
  const lw = Math.max(1.2, size * 0.1);

  // Cup dimensions — wider, shorter shape (side-on teacup)
  const cw = size * 1.1;       // cup width
  const ch = size * 0.85;      // cup height
  const cx = px - cw / 2;      // cup left
  const cy = py - ch / 2 - size * 0.08; // cup top (shifted up to make room for saucer)
  const br = cw * 0.18;        // corner radius

  // Glow
  ctx.shadowColor = outlineColor;
  ctx.shadowBlur = 5;

  // Cup body (rounded rect — white fill, brown stroke)
  ctx.beginPath();
  ctx.moveTo(cx + br, cy);
  ctx.lineTo(cx + cw - br, cy);
  ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + br);
  ctx.lineTo(cx + cw, cy + ch - br);
  ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - br, cy + ch);
  ctx.lineTo(cx + br, cy + ch);
  ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - br);
  ctx.lineTo(cx, cy + br);
  ctx.quadraticCurveTo(cx, cy, cx + br, cy);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lw;
  ctx.stroke();

  // Handle (arc on the right side)
  const hx = cx + cw;
  const hy = cy + ch * 0.25;
  const hr = cw * 0.25;
  ctx.beginPath();
  ctx.arc(hx, hy + hr, hr, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lw;
  ctx.stroke();

  // Saucer (ellipse under the cup)
  const sw = cw * 1.5;         // saucer wider than cup
  const sh = ch * 0.2;         // saucer thin
  const sx = px;                // center aligned
  const sy = cy + ch + sh * 0.4;
  ctx.beginPath();
  ctx.ellipse(sx, sy, sw / 2, sh / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();

  ctx.restore();
}

// ---- Draw camera icon (standalone, no square) ----
function drawCameraIcon(px, py, size, alpha) {
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;

  const w = size * 1.6;
  const h = size * 1.2;
  const bx = px - w / 2;
  const by = py - h / 2;

  // Camera body
  ctx.fillStyle = '#888';
  ctx.shadowColor = '#888';
  ctx.shadowBlur = 6;
  const br = w * 0.12;
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + w - br, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + br);
  ctx.lineTo(bx + w, by + h - br);
  ctx.quadraticCurveTo(bx + w, by + h, bx + w - br, by + h);
  ctx.lineTo(bx + br, by + h);
  ctx.quadraticCurveTo(bx, by + h, bx, by + h - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Lens (circle)
  const lensR = Math.min(w, h) * 0.28;
  ctx.beginPath();
  ctx.arc(px, py + h * 0.05, lensR, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py + h * 0.05, lensR * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#5af';
  ctx.fill();

  // Flash bump (small rect on top)
  ctx.fillStyle = '#aaa';
  const fw = w * 0.2;
  const fh = h * 0.18;
  ctx.fillRect(px - fw / 2 + w * 0.15, by - fh * 0.5, fw, fh);

  ctx.restore();
}

export function drawPowerup(px, py, radius, type, visible) {
  if (visible === false) return; // for QM hidden phase
  ctx.save();

  const s = radius * 1.3;

  if (type === POWERUP_TYPES.QUESTION) {
    // Flashing opacity like home icon
    const flashCycle = Math.floor(Date.now() / 250) % 2;
    ctx.globalAlpha = flashCycle === 0 ? 1.0 : 0.4;

    // White rounded square
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    const qs = s * 1.6;
    const qr = qs * 0.2;
    const qx = px - qs / 2;
    const qy = py - qs / 2;
    ctx.beginPath();
    ctx.moveTo(qx + qr, qy);
    ctx.lineTo(qx + qs - qr, qy);
    ctx.quadraticCurveTo(qx + qs, qy, qx + qs, qy + qr);
    ctx.lineTo(qx + qs, qy + qs - qr);
    ctx.quadraticCurveTo(qx + qs, qy + qs, qx + qs - qr, qy + qs);
    ctx.lineTo(qx + qr, qy + qs);
    ctx.quadraticCurveTo(qx, qy + qs, qx, qy + qs - qr);
    ctx.lineTo(qx, qy + qr);
    ctx.quadraticCurveTo(qx, qy, qx + qr, qy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bold black "?"
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.max(8, s * 1.2)}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', px, py + 1);
  } else if (type === POWERUP_TYPES.EXTRA_TAG) {
    // Rectangle 5:4 landscape with green/white quadrant
    ctx.shadowColor = POWERUP_DEFS.extraTag.color;
    ctx.shadowBlur = 6;
    const tw = s * 1.8;
    const th = s * 1.4;
    const tx = px - tw / 2;
    const ty = py - th / 2;

    // White base
    ctx.fillStyle = '#fff';
    ctx.fillRect(tx, ty, tw, th);

    // Top-left green quadrant
    ctx.fillStyle = POWERUP_DEFS.extraTag.color;
    ctx.fillRect(tx, ty, tw / 2, th / 2);

    // Border
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.strokeRect(tx, ty, tw, th);
  } else if (type === POWERUP_TYPES.COFFEE) {
    // v16: Standalone mug shape (no square)
    drawCoffeeMug(px, py, s, 0.9);
  } else if (type === POWERUP_TYPES.CAMERA) {
    // v16: Standalone camera icon (no square)
    drawCameraIcon(px, py, s, 0.9);
  }

  ctx.restore();
}

// ---- Coffee active aura (pulsing yellow glow ring) ----
export function drawCoffeeAura(px, py, radius) {
  ctx.save();
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 180));
  const glowR = radius + 5 + 3 * Math.sin(Date.now() / 220);

  ctx.beginPath();
  ctx.arc(px, py, glowR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 0, ${pulse * 0.6})`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 10 + 5 * Math.sin(Date.now() / 180);
  ctx.stroke();

  // Inner warm glow
  ctx.beginPath();
  ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 230, 80, ${pulse * 0.15})`;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---- Active effect indicator text (v14: 5× larger, highly visible) ----
export function drawActiveEffectText(text) {
  if (!text) return;
  ctx.save();
  const alpha = 0.55 + 0.35 * Math.sin(Date.now() / 350);
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 18px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const x = CANVAS_W / 2;
  const y = HUD_H + 8;

  // v15: Neon border — dark outer stroke for contrast + colored glow
  ctx.strokeStyle = '#500';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);

  // Neon glow layer
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#f80';
  ctx.fillText(text, x, y);

  // Bright inner pass for neon pop
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Clear full canvas ----
export function clearCanvas() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ---- Title screen ----
export function drawTitleScreen() {
  clearCanvas();
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (bgLoaded) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bgImage, 0, 0, CANVAS_W * 1.2, CANVAS_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG_TINT;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 28px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 15;
  ctx.fillText('CHILL 200CPM', CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.shadowBlur = 0;

  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Keep high CPM. Survive. Clock Out.', CANVAS_W / 2, CANVAS_H / 2);

  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('PRESS START', CANVAS_W / 2, CANVAS_H / 2 + 50);
  ctx.globalAlpha = 1;
}

// ---- Pause screen ----
export function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 5, 20, 0.75)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 24px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 12;
  ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.shadowBlur = 0;

  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Press Start to resume', CANVAS_W / 2, CANVAS_H / 2 + 25);
}

// ---- Instructions screen ----
export function drawInstructions() {
  ctx.fillStyle = 'rgba(0, 5, 20, 0.92)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 16px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 8;
  ctx.fillText('HOW TO PLAY', CANVAS_W / 2, 30);
  ctx.shadowBlur = 0;

  ctx.textAlign = 'left';
  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#ccc';
  const lines = [
    'D-PAD \u2014 Move through corridors',
    'A \u2014 Use Power-Up A',
    'B \u2014 Use Power-Up B',
    'START \u2014 Pause',
    'SELECT \u2014 Instructions',
    '',
    'Collect objects to keep your CPM above 0.',
    'CPM starts at 200 and decays over time.',
    'Reach 400 CPM to instantly clear the round.',
    'Avoid managers \u2014 3 warnings = round lost!',
    '',
    'Round 2: Reach the HOME icon to clear!',
    '  (Appears after 85% of timer elapsed)',
    'Survive the timer to advance.',
    '5 levels (Mon-Fri), 2 rounds each.',
  ];
  const startY = 60;
  lines.forEach((line, i) => {
    ctx.fillStyle = line === '' ? 'transparent' : (i < 5 ? '#aaa' : '#888');
    ctx.fillText(line, 30, startY + i * 18);
  });

  ctx.textAlign = 'center';
  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press Select to close', CANVAS_W / 2, CANVAS_H - 20);
  ctx.globalAlpha = 1;
}

// ---- Home icon (Round 2 win condition) ----
export function drawHomeIcon(hx, hy, radius) {
  ctx.save();

  const flashCycle = Math.floor(Date.now() / 250) % 2;
  const alpha = flashCycle === 0 ? 1.0 : 0.4;
  ctx.globalAlpha = alpha;

  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 12;

  const s = radius * 1.3;

  // House body (white square)
  ctx.fillStyle = '#fff';
  ctx.fillRect(hx - s * 0.6, hy - s * 0.15, s * 1.2, s * 0.9);

  // Roof (red triangle)
  ctx.fillStyle = '#e33';
  ctx.shadowColor = '#f44';
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.85, hy - s * 0.15);
  ctx.lineTo(hx, hy - s * 1.0);
  ctx.lineTo(hx + s * 0.85, hy - s * 0.15);
  ctx.closePath();
  ctx.fill();

  // Door (dark rectangle)
  ctx.fillStyle = '#422';
  ctx.shadowBlur = 0;
  ctx.fillRect(hx - s * 0.15, hy + s * 0.15, s * 0.3, s * 0.55);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Below-90 CPM Choice Screen ----
export function drawBelow90Choice() {
  ctx.fillStyle = 'rgba(0, 5, 20, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Warning header
  ctx.font = 'bold 16px Orbitron, monospace';
  ctx.fillStyle = '#f80';
  ctx.shadowColor = '#f80';
  ctx.shadowBlur = 10;
  ctx.fillText('YOUR CPM IS BELOW 90', CANVAS_W / 2, CANVAS_H / 2 - 55);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.fillStyle = '#ccc';
  ctx.fillText('CHOOSE:', CANVAS_W / 2, CANVAS_H / 2 - 25);

  // Option A
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.fillStyle = '#f44';
  const aFlash = 0.7 + 0.3 * Math.sin(Date.now() / 300);
  ctx.globalAlpha = aFlash;
  ctx.fillText('A: WARNING', CANVAS_W / 2, CANVAS_H / 2 + 10);
  ctx.globalAlpha = 1;

  // Option B
  ctx.fillStyle = '#4f4';
  const bFlash = 0.7 + 0.3 * Math.sin(Date.now() / 300 + Math.PI);
  ctx.globalAlpha = bFlash;
  ctx.fillText('B: 15s FLEX', CANVAS_W / 2, CANVAS_H / 2 + 40);
  ctx.globalAlpha = 1;
}

// ---- Below-90 Follow-up Warning Screen ----
export function drawBelow90Followup() {
  ctx.fillStyle = 'rgba(0, 5, 20, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Wrap the warning text manually
  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#f80';
  ctx.shadowColor = '#f80';
  ctx.shadowBlur = 6;
  ctx.fillText('Next time, there will be no', CANVAS_W / 2, CANVAS_H / 2 - 30);
  ctx.fillText('choice and shift manager will', CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.fillText('come looking for you.', CANVAS_W / 2, CANVAS_H / 2 + 10);
  ctx.shadowBlur = 0;

  // "Press A to continue" — subtle
  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press A to continue', CANVAS_W / 2, CANVAS_H / 2 + 50);
  ctx.globalAlpha = 1;
}

// ---- Warning Contact Screen (paused, themed message) ----
export function drawWarningScreen(warningCount) {
  ctx.fillStyle = 'rgba(40, 0, 0, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Warning header
  ctx.font = 'bold 22px Orbitron, monospace';
  ctx.fillStyle = '#f44';
  ctx.shadowColor = '#f44';
  ctx.shadowBlur = 12;
  ctx.fillText(`WARNING ${warningCount}/3`, CANVAS_W / 2, CANVAS_H / 2 - 50);
  ctx.shadowBlur = 0;

  // Themed message
  const msg = WARNING_MESSAGES[warningCount] || '';
  // Word wrap for long messages
  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = '#f80';
  const words = msg.split(' ');
  let lines = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(test).width > CANVAS_W - 60) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineH = 18;
  const startY = CANVAS_H / 2 - 10 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, startY + i * lineH);
  });

  // "Press A to continue"
  const promptY = startY + lines.length * lineH + 25;
  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press A to continue', CANVAS_W / 2, promptY);
  ctx.globalAlpha = 1;
}

// ---- Power-up Activation Screen ----
export function drawPowerupActivation(header, headerColor, subtext, subtextColor, subtext2, subtext2Color) {
  ctx.fillStyle = 'rgba(0, 10, 5, 0.88)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header
  ctx.font = 'bold 16px Orbitron, monospace';
  ctx.fillStyle = headerColor || '#4f4';
  ctx.shadowColor = headerColor || '#4f4';
  ctx.shadowBlur = 10;
  ctx.fillText(header, CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.shadowBlur = 0;

  // Subtext line 1
  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = subtextColor || '#ccc';
  ctx.fillText(subtext || '', CANVAS_W / 2, CANVAS_H / 2 - 5);

  // Subtext line 2 (optional)
  if (subtext2) {
    ctx.fillStyle = subtext2Color || '#ccc';
    ctx.fillText(subtext2, CANVAS_W / 2, CANVAS_H / 2 + 18);
  }

  // "Press A to continue"
  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press A to continue', CANVAS_W / 2, CANVAS_H / 2 + 55);
  ctx.globalAlpha = 1;
}

// ---- Power-Up Tutorial Screen (v19, Lv1 R1 first pickup only) ----
export function drawPowerupTutorial() {
  ctx.fillStyle = 'rgba(0, 5, 20, 0.92)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header — "YOU GOT SOMETHING SPECIAL!"
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 8;
  ctx.fillText('YOU GOT SOMETHING SPECIAL!', CANVAS_W / 2, 28);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '9px Orbitron, monospace';
  ctx.fillStyle = '#ccc';
  ctx.fillText('It is stored in A / B Slots.', CANVAS_W / 2, 48);
  ctx.fillText('Press A or B to activate!', CANVAS_W / 2, 62);

  // Power-up entries — icon on left, name + description on right
  const iconX = 70;      // center x for icons
  const nameX = 110;     // left edge for name text
  const descX = 110;     // left edge for description
  const iconSize = 10;   // icon render size
  const startY = 90;     // first row y
  const rowH = 48;       // spacing between rows

  ctx.textAlign = 'left';

  // --- Coffee ---
  const coffeeY = startY;
  drawCoffeeMug(iconX, coffeeY, iconSize, 1.0);
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = '#c84';
  ctx.fillText('Coffee', nameX, coffeeY - 6);
  ctx.font = '9px Orbitron, monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('It makes you move faster!', descX, coffeeY + 10);

  // --- Extra Tag ---
  const etY = startY + rowH;
  // Draw ET icon (green/white rectangle)
  ctx.save();
  ctx.shadowColor = POWERUP_DEFS.extraTag.color;
  ctx.shadowBlur = 4;
  const etw = iconSize * 1.8;
  const eth = iconSize * 1.4;
  const etx = iconX - etw / 2;
  const ety = etY - eth / 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(etx, ety, etw, eth);
  ctx.fillStyle = POWERUP_DEFS.extraTag.color;
  ctx.fillRect(etx, ety, etw / 2, eth / 2);
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.strokeRect(etx, ety, etw, eth);
  ctx.restore();
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = POWERUP_DEFS.extraTag.color;
  ctx.fillText('Extra Tag', nameX, etY - 6);
  ctx.font = '9px Orbitron, monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('You have an extra tag so more', descX, etY + 8);
  ctx.fillText('CPM chances!', descX, etY + 20);

  // --- Report (Camera) ---
  const camY = startY + rowH * 2;
  drawCameraIcon(iconX, camY, iconSize, 1.0);
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Report', nameX, camY - 6);
  ctx.font = '9px Orbitron, monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Report hazards to remove', descX, camY + 8);
  ctx.fillText('your warnings!', descX, camY + 20);

  // --- Question Mark ---
  const qmY = startY + rowH * 3;
  // Draw QM icon (white square with ?)
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 4;
  const qs = iconSize * 1.6;
  const qr = qs * 0.2;
  const qx = iconX - qs / 2;
  const qy = qmY - qs / 2;
  ctx.beginPath();
  ctx.moveTo(qx + qr, qy);
  ctx.lineTo(qx + qs - qr, qy);
  ctx.quadraticCurveTo(qx + qs, qy, qx + qs, qy + qr);
  ctx.lineTo(qx + qs, qy + qs - qr);
  ctx.quadraticCurveTo(qx + qs, qy + qs, qx + qs - qr, qy + qs);
  ctx.lineTo(qx + qr, qy + qs);
  ctx.quadraticCurveTo(qx, qy + qs, qx, qy + qs - qr);
  ctx.lineTo(qx, qy + qr);
  ctx.quadraticCurveTo(qx, qy, qx + qr, qy);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(8, iconSize * 1.2)}px Orbitron, monospace`;
  ctx.fillText('?', iconX, qmY + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('???', nameX, qmY - 6);
  ctx.font = '9px Orbitron, monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Who knows what could happen...?', descX, qmY + 10);

  // "Press A to continue"
  ctx.textAlign = 'center';
  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press A to continue', CANVAS_W / 2, CANVAS_H - 18);
  ctx.globalAlpha = 1;
}

// ---- Round Complete Screen ----
// winReason: 'timer', 'highCpm', 'homeIcon'
// v20: added level param for Lv5 R2 custom messages
export function drawRoundComplete(round, winReason, level) {
  ctx.fillStyle = 'rgba(0, 10, 5, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const isLv5R2 = (level === 4 && round === 1);

  // Main message
  let msg1 = '';
  let msg2 = '';

  if (round === 0) {
    // Round 1
    if (winReason === 'highCpm') {
      msg1 = 'Wow your CPM is very high!';
      msg2 = 'You can go on break early.';
    } else {
      msg1 = 'You did good!';
      msg2 = 'Have your break now.';
    }
  } else if (isLv5R2) {
    // v20: Level 5 Round 2 — custom messages that flow into victory screen
    if (winReason === 'highCpm') {
      msg1 = 'Your CPM is unreal!';
      msg2 = 'You earned this weekend!';
    } else if (winReason === 'homeIcon') {
      msg1 = 'Hehehe, you are very sneaky and';
      msg2 = 'manage to leave early without';
    } else {
      msg1 = 'The week is DONE!';
      msg2 = 'Time to clock out!';
    }
  } else {
    // Round 2 (Lv1-4)
    if (winReason === 'highCpm') {
      msg1 = 'Wow! Your CPM is very high!';
      msg2 = 'You deserve an early out today!';
    } else if (winReason === 'homeIcon') {
      msg1 = 'Hehehe, you are very sneaky and';
      msg2 = 'manage to leave early without';
    } else {
      msg1 = 'The day is over!';
      msg2 = 'See you tomorrow!';
    }
  }

  // v14: Consistent bold yellow formatting for sneaky message block
  if (round === 1 && winReason === 'homeIcon') {
    // All three lines: bold 13px, yellow with glow
    ctx.font = 'bold 13px Orbitron, monospace';
    ctx.fillStyle = COLORS.hiviz;
    ctx.shadowColor = COLORS.hiviz;
    ctx.shadowBlur = 10;
    ctx.fillText(msg1, CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.fillText(msg2, CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.fillText('managers catching you!', CANVAS_W / 2, CANVAS_H / 2 + 14);
    ctx.shadowBlur = 0;

    // v20: "Have a great weekend!" for Lv5, "See you tomorrow!" for others
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ccc';
    const sneakyEndMsg = isLv5R2 ? 'Have a great weekend!' : 'See you tomorrow!';
    ctx.fillText(sneakyEndMsg, CANVAS_W / 2, CANVAS_H / 2 + 38);
  } else {
    // Standard formatting for non-sneaky messages
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillStyle = COLORS.hiviz;
    ctx.shadowColor = COLORS.hiviz;
    ctx.shadowBlur = 10;
    ctx.fillText(msg1, CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.shadowBlur = 0;

    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ccc';
    ctx.fillText(msg2, CANVAS_W / 2, CANVAS_H / 2 - 5);
  }

  // "Press A to continue"
  const yPos = (round === 1 && winReason === 'homeIcon') ? CANVAS_H / 2 + 68 : CANVAS_H / 2 + 40;
  ctx.font = '12px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press A to continue', CANVAS_W / 2, yPos);
  ctx.globalAlpha = 1;
}

// ---- Game Over screen ----
export function drawGameOver(reason, levelNum, levelName) {
  clearCanvas();

  if (bgLoaded) {
    ctx.globalAlpha = 0.15;
    ctx.drawImage(bgImage, 0, 0, CANVAS_W * 1.2, CANVAS_H);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(40, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 28px Orbitron, monospace';
  ctx.fillStyle = '#f44';
  ctx.shadowColor = '#f44';
  ctx.shadowBlur = 15;
  ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 55);
  ctx.shadowBlur = 0;

  // Custom messages
  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = '#ccc';
  if (reason === 'cpm') {
    ctx.fillText('Your CPM dropped to 0!', CANVAS_W / 2, CANVAS_H / 2 - 15);
    ctx.fillText('You are getting a disciplinary meeting.', CANVAS_W / 2, CANVAS_H / 2 + 5);
    ctx.fillText('Come back to work next week!', CANVAS_W / 2, CANVAS_H / 2 + 25);
  } else {
    ctx.fillText('You got three warnings!', CANVAS_W / 2, CANVAS_H / 2 - 15);
    ctx.fillText('Your shifts are cancelled', CANVAS_W / 2, CANVAS_H / 2 + 5);
    ctx.fillText('for this week.', CANVAS_W / 2, CANVAS_H / 2 + 25);
  }

  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#666';
  ctx.fillText(`LV${levelNum} - ${levelName.toUpperCase()}`, CANVAS_W / 2, CANVAS_H / 2 + 50);

  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('PRESS START TO RETRY', CANVAS_W / 2, CANVAS_H / 2 + 75);
  ctx.globalAlpha = 1;
}

// ---- Victory screen with fireworks effect ----
// particles array managed by caller (main.js)
export function drawVictoryScreen(particles) {
  clearCanvas();

  if (bgLoaded) {
    ctx.globalAlpha = 0.2;
    ctx.drawImage(bgImage, 0, 0, CANVAS_W * 1.2, CANVAS_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG_TINT;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Draw firework particles
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Shaking text effect
  const shake = 2 * Math.sin(Date.now() / 50);
  const shakeY = 1.5 * Math.cos(Date.now() / 60);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 20px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 20;
  ctx.fillText('YEEESSS!', CANVAS_W / 2 + shake, CANVAS_H / 2 - 50 + shakeY);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  ctx.fillText('YOU COMPLETED THE WEEK!', CANVAS_W / 2 + shake * 0.5, CANVAS_H / 2 - 20 + shakeY * 0.5);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 10;
  ctx.fillText('ENJOY YOUR DAYS OFF!', CANVAS_W / 2 + shake * 0.3, CANVAS_H / 2 + 15 + shakeY * 0.3);
  ctx.shadowBlur = 0;

  // "Press Start to play again"
  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#888';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('Press Start to play again', CANVAS_W / 2, CANVAS_H / 2 + 60);
  ctx.globalAlpha = 1;
}

// ---- Level intro screen ----
export function drawLevelIntro(levelNum, levelName, roundName) {
  clearCanvas();
  if (bgLoaded) {
    ctx.globalAlpha = 0.2;
    ctx.drawImage(bgImage, 0, 0, CANVAS_W * 1.2, CANVAS_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG_TINT;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 22px Orbitron, monospace';
  ctx.fillStyle = COLORS.hiviz;
  ctx.shadowColor = COLORS.hiviz;
  ctx.shadowBlur = 10;
  ctx.fillText(`LV${levelNum} - ${levelName.toUpperCase()}`, CANVAS_W / 2, CANVAS_H / 2 - 25);
  ctx.shadowBlur = 0;

  ctx.font = '13px Orbitron, monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(roundName, CANVAS_W / 2, CANVAS_H / 2 + 10);

  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('GET READY...', CANVAS_W / 2, CANVAS_H / 2 + 45);
}
