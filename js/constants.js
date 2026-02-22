export const CANVAS_W = 500;
export const CANVAS_H = 320;
export const GRAVITY = 0.6;
export const GROUND_Y = 240;
export const MOVE_SPEED = 3;
export const JUMP_FORCE = -10;
export const KNOCKBACK_FORCE = 6;
export const FIGHTER = { headRadius:20, torsoLen:36, legLen:32, armLen:20, swordLen:44, hurtboxW:44, hurtboxH:95 };
export const MAX_HP = 300;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;
export const COMBO_KNOCKBACK_THRESHOLD = 8;
export const COMBO_KNOCKBACK_HITSTUN = 20;
export const ATTACKS = {
  sword: { damage:12, startup:6, active:5, recovery:13, range:55, hitstun:8, type:'sword' },
  kick:  { damage:6,  startup:4, active:4, recovery:5,  range:45, hitstun:5, type:'kick', blockPenetration:0.5 },
};
export const DISTANT_ATTACK = { chargeTime:35, travelTime:60, damage:3, speed:5, hitstun:4, type:'distant' };
export const FLYING_KICK = { chargeTime:70, dashSpeed:10, damage:24, hitstun:10, type:'flyingkick', blockDamage:6 };
export const DOUBLE_JUMP = { force:-8.5 };
export const BLOCK_DAMAGE_MULT = 0.2;
export const BLOCK_SPECIAL_FLAT_BONUS = 2;
export const BLOCK_STUN = 6;
export const FIREBALL = { damage:6, speed:5, travelTime:60, hitstun:5, type:'fireball', maxConsecutive:3, cooldown:180 };
export const KICK_COMBO = { kickDamages:[6,9,12,15,18], resetOnMiss:true };
export const SPECIAL = {
  maxCharge:300,
  playerDuration:420, playerDamageMult:1.8,
  playerSwordLenMult:1.25,
  playerRangeMult:1.25,
  playerDefenseMult:0.5,
  playerScaleMult:1.25,
  aiDuration:300, aiSpeedMult:4.5,
  aiMinLevel:2,
  redbullAttackSpeedMult:0.5,
  redbullLifesteal:0.5,
};
export const VLS = {
  hpGapThreshold:150, popupDuration:120,
  freezeDuration:180, guaranteedFreezeDuration:60,
  cooldown:900, crossLockout:300, specialBlockWindow:120,
  guaranteedHpThreshold:80, guaranteedGapThreshold:5, maxPerRound:4,
};
export const HELP = {
  timerThreshold:70, playerHpThreshold:120, aiHpThreshold:150,
  npcAnimDuration:470, popupDuration:120,
  healMultiplier:0.5, damageMultiplier:0.5,
  // NPC attack phases (frames)
  npcApproachDuration:90,   // slide in
  npcStrikeDuration:90,     // 3 rapid slashes (~1.5s)
  npcImpactDuration:90,     // final blow + effects (~1.5s)
  npcExitDuration:80,       // slide out
  // Heal visual
  healEffectDuration:90,
};
export const LEVEL_HP = [150, 300, 450, 600, 750];
export const TOTAL_FIGHTS = 5;
export const POSITION_SWITCH = { combos:[['sword','sword','kick'],['kick','kick','sword']], consecutiveThreshold:8, animDuration:30 };
export const COLORS = { p1:'#4af',p2:'#f44',hiviz:'#d4e20f',sword:'#ddd',swordFlash:'#fff',kick:'#fa0',
  hpBar:{p1:'#4af',p2:'#f44'},specialBar:{p1:'#d4e20f',p2:'#f80'},timer:'#d4e20f',hit:'#ff0',block:'#aaa',distant:'#8cf',flyingKick:'#f60',fireball:'#f80' };
export const PARTICLE = { hitCount:8,blockCount:5,hitSpeed:4,blockSpeed:2,hitLife:15,blockLife:10,hitSize:3,blockSize:2 };
export const SHAKE = { hitDuration:5,hitIntensity:3,comboDuration:12,comboIntensity:8,vlsDuration:15,vlsIntensity:6 };
export const AI_XULUV_NAMES = [
  'Xuluv','Xuluv after 1 redbull','Xuluv after 2 redbulls','Xuluv after 3 redbulls','Xuluv after 4 redbulls',
];
export const AI_GUANGCHI_NAMES = [
  'Guangchi','Guangchi after 1 abalone','Guangchi after 2 abalones','Guangchi after 3 abalones','Guangchi after 4 abalones',
];
export const AI_LEVELS = [
  { reactionTime:16,aggression:0.30,blockChance:0.15,attackMix:0.50,punishAbility:0.15,moveSpeed:1.8,jumpChance:0.01,specialUseChance:0,spacingSkill:0.15,retreatSkill:0.02,comboSkill:0.10,approachBias:0.25,aiSpecialMaxPerRound:0 },
  { reactionTime:8,aggression:0.35,blockChance:0.25,attackMix:0.45,punishAbility:0.30,moveSpeed:2.2,jumpChance:0.02,specialUseChance:0,spacingSkill:0.28,retreatSkill:0.03,comboSkill:0.22,approachBias:0.35,aiSpecialMaxPerRound:0 },
  { reactionTime:6,aggression:0.40,blockChance:0.35,attackMix:0.35,punishAbility:0.50,moveSpeed:2.75,jumpChance:0.04,specialUseChance:0.40,spacingSkill:0.50,retreatSkill:0.05,comboSkill:0.49,approachBias:0.40,aiSpecialMaxPerRound:1 },
  { reactionTime:4,aggression:0.50,blockChance:0.45,attackMix:0.34,punishAbility:0.50,moveSpeed:3.5,jumpChance:0.05,specialUseChance:0.60,spacingSkill:0.50,retreatSkill:0.05,comboSkill:0.49,approachBias:0.48,aiSpecialMaxPerRound:2 },
  { reactionTime:3,aggression:0.65,blockChance:0.50,attackMix:0.19,punishAbility:0.74,moveSpeed:4.0,jumpChance:0.08,specialUseChance:0.80,spacingSkill:0.74,retreatSkill:0.08,comboSkill:0.74,approachBias:0.52,isBoss:true,aiSpecialMaxPerRound:3 },
];
export const NO_DAMAGE_ENGAGE_TIME = 900;
