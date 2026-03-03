import {
  CANVAS_W,CANVAS_H,GROUND_Y,MAX_HP,ROUNDS_TO_WIN,ROUND_TIME,MOVE_SPEED,
  AI_LEVELS,SHAKE,COLORS,SPECIAL,VLS,DISTANT_ATTACK,FLYING_KICK,POSITION_SWITCH,
  AI_GUANGCHI_NAMES,AI_XULUV_NAMES,LEVEL_HP,TOTAL_FIGHTS,FIREBALL,ATTACKS,
  NO_DAMAGE_ENGAGE_TIME,HELP,
} from './constants.js';
import { initControls,getInput,justPressed,justReleased,updatePrev,getHoldA,getHoldB } from './controls.js';
import { Player,STATE } from './player.js';
import { AI } from './ai.js';
import {
  render,spawnParticles,triggerShake,setBgImage,
  projectiles,addProjectile,addFireball,showSpecialSplash,
  startSwitchAnim,isSwitching,updateSwitchAnim,
} from './renderer.js';
import {
  initAudio,bgmPlay,bgmPause,bgmStop,toggleMute,
  playSword,playKick,playVLS,playSpecial,playP1Win,playP2Win,
} from './audio.js';

const canvas=document.getElementById('gameCanvas');
canvas.width=CANVAS_W;canvas.height=CANVAS_H;
const ctx=canvas.getContext('2d');

// Mute button + Special bar tap (canvas coords)
const MUTE_BTN={x:CANVAS_W/2-20,y:44,w:40,h:18};
const SPEC_BAR={x:5,y:16,w:165,h:50};
function handleCanvasTap(cx,cy){
  if(cx>=MUTE_BTN.x&&cx<=MUTE_BTN.x+MUTE_BTN.w&&cy>=MUTE_BTN.y&&cy<=MUTE_BTN.y+MUTE_BTN.h){
    const m=toggleMute();if(m)bgmPause();else if(gameState==='fighting')bgmPlay();return true;
  }
  if(cx>=SPEC_BAR.x&&cx<=SPEC_BAR.x+SPEC_BAR.w&&cy>=SPEC_BAR.y&&cy<=SPEC_BAR.y+SPEC_BAR.h){
    if(gameState==='fighting'&&p1.specialCharge>=SPECIAL.maxCharge&&!p1.specialActive){
      const spName=selectedChar==='guangchi'?'ABALONE MOTIVATION':'REDBULL RECHARGE';
      p1.activateSpecial(spName,globalFrame);
      showSpecialSplash(spName+'!',selectedChar==='guangchi'?COLORS.hiviz:'#f80');triggerShake(10,5);playSpecial();
    }
    return true;
  }
  return false;
}
canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();handleCanvasTap((e.clientX-r.left)*(CANVAS_W/r.width),(e.clientY-r.top)*(CANVAS_H/r.height));});
canvas.addEventListener('touchstart',e=>{const t=e.touches[0];if(!t)return;const r=canvas.getBoundingClientRect();const cx=(t.clientX-r.left)*(CANVAS_W/r.width),cy=(t.clientY-r.top)*(CANVAS_H/r.height);if(handleCanvasTap(cx,cy))e.preventDefault();},{passive:false});

const bgImg=new Image();bgImg.src='assets/background.jpg';bgImg.onload=()=>setBgImage(bgImg);
document.getElementById('frameImg').src='assets/zebraframe.png';

// Helper NPC face images
const teachjoyFace=new Image();teachjoyFace.src='assets/teachjoy-face.jpg';
const leanbooFace=new Image();leanbooFace.src='assets/leanboo-face.jpg';

let gameState='title',stateData={},stateTimer=0;
let currentFight=0,roundNum=1,roundTimer=ROUND_TIME,frameCount=0,globalFrame=0;
let vlsGuaranteedUsed=false,vlsCooldownTimer=0;
let vlsTriggerCount=0;
let vlsLastTriggerPlayer='';
let vlsCrossLockoutTimer=0;
let currentMaxHP=MAX_HP;
// No-damage auto-engage timer
let noDamageTimer=0;
let lastP1Hp=0,lastP2Hp=0;
// Help mechanic
let helpFirstTriggered=false; // has player used help at least once this round?
let helpAvailable=false; // first manual trigger (A+B prompt)
let helpAutoReady=false; // auto-trigger ready after cooldown
let helpCooldownTimer=0; // 4s cooldown after each help use
let helpHpSnapshot={p1:0,p2:0}; // HP when popup triggered
let healEffect={active:false,timer:0,amount:0}; // heal visual effect
// AI special per-round cap
let aiSpecialUsesThisRound=0;

// Character select
let selectedChar='guangchi';
let p1BaseName='GUANGCHI',p2BaseName='XULUV';
let p1DisplayName='GUANGCHI TOP LOADER';
let aiLevelNames=AI_XULUV_NAMES;

const p1=new Player(150,true,COLORS.p1,'assets/playerface.png');
const p2=new Player(350,false,COLORS.p2,'assets/aiface.png');
p2.aiName=AI_XULUV_NAMES[0].toUpperCase();
const ai=new AI(0);

function setupCharacter(choice){
  selectedChar=choice;
  if(choice==='guangchi'){
    p1.color=COLORS.p1;p1.faceImg.src='assets/playerface.png';
    p2.color=COLORS.p2;p2.faceImg.src='assets/aiface.png';
    p1BaseName='GUANGCHI';p2BaseName='XULUV';
    p1DisplayName='GUANGCHI TOP LOADER';p1.displayName=p1DisplayName;
    p1.specialLabel='ABALONE MOTIVATION';
    aiLevelNames=AI_XULUV_NAMES;
  }else{
    p1.color=COLORS.p2;p1.faceImg.src='assets/aiface.png';
    p2.color=COLORS.p1;p2.faceImg.src='assets/playerface.png';
    p1BaseName='XULUV';p2BaseName='GUANGCHI';
    p1DisplayName='XULUV';p1.displayName=p1DisplayName;
    p1.specialLabel='REDBULL RECHARGE';
    aiLevelNames=AI_GUANGCHI_NAMES;
  }
}

function goToState(s,d={}){gameState=s;stateData=d;stateTimer=0;}

function startNewGame(){
  currentFight=0;p1.wins=0;p2.wins=0;p1.specialCharge=0;p2.specialCharge=0;
  p1.resetStats();p2.resetStats();ai.setLevel(0);
  p2.aiName=aiLevelNames[0].toUpperCase();
  goToState('fightIntro',{opponentName:aiLevelNames[0].toUpperCase(),fightNum:1,opColor:p2.color});
}

function startFight(){
  p1.wins=0;p2.wins=0;roundNum=1;ai.setLevel(currentFight);
  p2.aiName=aiLevelNames[currentFight].toUpperCase();
  currentMaxHP=LEVEL_HP[currentFight]||MAX_HP;
  p1.specialCharge=0;p2.specialCharge=0;p1.resetStats();p2.resetStats();startRound();
}

function startRound(){
  p1.reset();p2.reset();
  p1.hp=currentMaxHP;p2.hp=currentMaxHP;
  p1.startX=150;p2.startX=350;p1.x=150;p2.x=350;
  roundTimer=ROUND_TIME;frameCount=0;
  vlsGuaranteedUsed=false;vlsCooldownTimer=0;
  vlsTriggerCount=0;vlsLastTriggerPlayer='';vlsCrossLockoutTimer=0;
  noDamageTimer=0;lastP1Hp=currentMaxHP;lastP2Hp=currentMaxHP;
  helpFirstTriggered=false;helpAvailable=false;helpAutoReady=false;helpCooldownTimer=0;
  aiSpecialUsesThisRound=0;
  ai.thinkTimer=0;ai.noDamageForced=false;ai.consecutiveFireballs=0;ai.fireballCooldownTimer=0;projectiles.length=0;
  bgmPause();
  goToState('roundIntro',{roundNum,timer:90,duration:90});
}

function endRound(winner){
  const wName=winner==='p1'?p1BaseName:p2.aiName;
  const wColor=winner==='p1'?p1.color:p2.color;
  if(winner==='p1'){p1.wins++;playP1Win();}else{p2.wins++;playP2Win();}
  bgmPause();
  goToState('roundEnd',{winner,winnerName:wName,winnerColor:wColor});
}

function afterRoundEnd(){
  if(p1.wins>=ROUNDS_TO_WIN){currentFight++;if(currentFight>=TOTAL_FIGHTS)goToState('victory');
    else goToState('fightIntro',{opponentName:aiLevelNames[currentFight].toUpperCase(),fightNum:currentFight+1,opColor:p2.color});}
  else if(p2.wins>=ROUNDS_TO_WIN){goToState('gameOver',{});}
  else{roundNum++;startRound();}
}

// VLS
function checkVLS(){
  if(vlsCooldownTimer>0){vlsCooldownTimer--;return false;}
  if(vlsCrossLockoutTimer>0){vlsCrossLockoutTimer--;return false;}
  if(vlsTriggerCount>=VLS.maxPerRound)return false;
  if(p1.hp<=0||p2.hp<=0)return false;
  const lowerHp=Math.min(p1.hp,p2.hp),gap=Math.abs(p1.hp-p2.hp);
  let shouldTrigger=false,isGuaranteed=false;
  if(gap>VLS.hpGapThreshold){
    if(!p1.specialActive&&!p2.specialActive){
      const p1SpecDur=p1.lastSpecialName==='ABALONE MOTIVATION'?SPECIAL.playerDuration:SPECIAL.aiDuration;
      const p2SpecDur=p2.lastSpecialName==='ABALONE MOTIVATION'?SPECIAL.playerDuration:SPECIAL.aiDuration;
      const specialEndedRecently=(p1.specialActivatedAt>0&&!p1.specialActive&&(globalFrame-p1.specialActivatedAt)<(p1SpecDur+VLS.specialBlockWindow))
        ||(p2.specialActivatedAt>0&&!p2.specialActive&&(globalFrame-p2.specialActivatedAt)<(p2SpecDur+VLS.specialBlockWindow));
      if(!specialEndedRecently)shouldTrigger=true;
    }
  }
  if(!vlsGuaranteedUsed&&lowerHp<=VLS.guaranteedHpThreshold&&lowerHp>0&&gap>VLS.guaranteedGapThreshold){
    shouldTrigger=true;isGuaranteed=true;vlsGuaranteedUsed=true;
  }
  if(shouldTrigger){
    const vlsLeader=p1.hp>p2.hp?'p1':'p2';
    const leaderName=p1.hp>p2.hp?p1BaseName:p2BaseName;
    const leaderColor=p1.hp>p2.hp?p1.color:p2.color;
    const freezeDur=isGuaranteed?VLS.guaranteedFreezeDuration:VLS.freezeDuration;
    vlsTriggerCount++;vlsLastTriggerPlayer=vlsLeader;
    triggerShake(SHAKE.vlsDuration,SHAKE.vlsIntensity);
    bgmPause();playVLS();
    goToState('vls',{leaderName,leaderColor,vlsLeader,freezeDur,isGuaranteed});return true;
  }
  return false;
}

function doPositionSwitch(){if(isSwitching())return;startSwitchAnim(p1,p2);triggerShake(8,4);}
function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

let jumpSwitchUsed=false;
function checkJumpOver(){
  if(p1.isGrounded){jumpSwitchUsed=false;return;}
  if(jumpSwitchUsed)return;
  const ps=p1.facingRight;
  const crossed=ps?(p1.x>p2.x-10):(p1.x<p2.x+10);
  if(crossed&&Math.abs(p1.x-p2.x)<50){jumpSwitchUsed=true;doPositionSwitch();}
}

function checkHit(atk,def){
  if(!atk.hitboxActive||atk.hitConnected)return;
  const hb=atk.getHitbox(),hr=def.getHurtbox();
  if(!hb||!hr||!rectsOverlap(hb,hr))return;
  atk.hitConnected=true;
  const fromRight=atk.x>def.x;
  const result=def.applyHit(atk.attackData,fromRight,atk.specialActive);
  const dmg=atk.attackData.damage;
  if(atk.attackData.type==='kick')playKick();else playSword();
  if(atk===p1){if(atk.attackData.type==='kick')p1.stats.kickDamageDealt+=dmg;else p1.stats.swordDamageDealt+=dmg;}
  atk.addSpecialCharge(dmg);
  if(atk.specialActive&&atk.specialName==='REDBULL RECHARGE'&&result!=='blocked'){
    atk.hp=Math.min(atk.hp+Math.round(dmg*SPECIAL.redbullLifesteal),currentMaxHP);
  }
  if(result!=='blocked'){
    if(atk.attackData.type==='kick'){atk.consecutiveKicks++;}else{atk.consecutiveKicks=0;}
  }else{atk.consecutiveKicks=0;}
  if(result==='hit'||result==='combo_knockback'){atk.consecutiveHitsDealt++;def.consecutiveHitsDealt=0;}
  const isSpecialHit=atk.specialActive;
  const isKickComboFinisher=atk.attackData.type==='kick'&&atk.consecutiveKicks>=5&&result!=='blocked';
  if(isKickComboFinisher){
    spawnParticles(def.x,def.y-30,'combo');spawnParticles(def.x,def.y-20,'hit');
    triggerShake(SHAKE.comboDuration,SHAKE.comboIntensity);
    atk.consecutiveKicks=0;
  }else if(result==='combo_knockback'){spawnParticles(def.x,def.y-30,'combo');triggerShake(SHAKE.comboDuration,SHAKE.comboIntensity);}
  else if(result==='hit'){spawnParticles(def.x,def.y-30,'hit');if(isSpecialHit){spawnParticles(def.x,def.y-30,'hit');spawnParticles(def.x,def.y-20,'combo');}
    triggerShake(isSpecialHit?SHAKE.hitDuration+3:SHAKE.hitDuration,isSpecialHit?SHAKE.hitIntensity+2:SHAKE.hitIntensity);}
  else{spawnParticles(def.x+(fromRight?10:-10),def.y-25,'block');}
  if(atk===p1&&result!=='blocked'){if(p1.checkPositionSwitchCombo())doPositionSwitch();else if(p1.checkConsecutiveSwitch())doPositionSwitch();}
}

function checkDashKick(atk,def){
  if(!atk.isDashing||atk.dashKickHit)return;
  const dist=Math.abs(atk.x-def.x);
  if(dist<35){
    if(!def.isGrounded)return;
    atk.dashKickHit=true;atk.stateTimer=12;
    const fromRight=atk.x>def.x;
    let dmg=FLYING_KICK.damage;
    if(atk.specialActive&&atk.specialName==='ABALONE MOTIVATION')dmg=Math.round(dmg*SPECIAL.playerDamageMult);
    const fakeData={damage:dmg,hitstun:FLYING_KICK.hitstun,type:'flyingkick'};
    const result=def.applyHit(fakeData,fromRight,atk.specialActive);
    atk.addSpecialCharge(dmg);
    if(atk.specialActive&&atk.specialName==='REDBULL RECHARGE'&&result!=='blocked'){atk.hp=Math.min(atk.hp+Math.round(dmg*SPECIAL.redbullLifesteal),currentMaxHP);}
    if(atk===p1)p1.stats.kickDamageDealt+=dmg;
    atk.consecutiveKicks=0;
    playKick();spawnParticles(def.x,def.y-30,'flyingkick');triggerShake(8,5);
  }
}

function checkProjectiles(){
  for(let i=projectiles.length-1;i>=0;i--){
    const proj=projectiles[i],target=proj.owner===p1?p2:p1;
    const hr=target.getHurtbox();
    if(proj.x>hr.x&&proj.x<hr.x+hr.w&&proj.y>hr.y&&proj.y<hr.y+hr.h){
      const fromRight=proj.owner.x>target.x;
      const hitstun=proj.type==='fireball'?FIREBALL.hitstun:DISTANT_ATTACK.hitstun;
      target.applyHit({damage:proj.damage,hitstun,type:proj.type||'distant'},fromRight,proj.owner.specialActive);
      proj.owner.addSpecialCharge(proj.damage);
      if(proj.owner.specialActive&&proj.owner.specialName==='REDBULL RECHARGE'){proj.owner.hp=Math.min(proj.owner.hp+Math.round(proj.damage*SPECIAL.redbullLifesteal),currentMaxHP);}
      if(proj.owner===p1)p1.stats.swordDamageDealt+=proj.damage;
      proj.owner.consecutiveKicks=0;
      playSword();
      spawnParticles(target.x,target.y-30,proj.type==='fireball'?'fireball':'distant');
      triggerShake(3,2);
      projectiles.splice(i,1);
    }
  }
}

// Player fireball: tap A when beyond contact range (Lv3+)
function tryPlayerFireball(){
  if(currentFight<2)return false;
  const dist=Math.abs(p1.x-p2.x);
  if(dist<=ATTACKS.sword.range)return false;
  if(!p1.canFireball())return false;
  const dir=p1.facingRight?1:-1;
  let dmg=FIREBALL.damage;
  if(p1.specialActive&&p1.specialName==='ABALONE MOTIVATION')dmg=Math.round(dmg*SPECIAL.playerDamageMult);
  addFireball(p1.x,p1.y,dir,dmg,p1);
  p1.onFireball();
  p1.consecutiveKicks=0;
  return true;
}

// === HELP MECHANIC ===
function checkHelpAvailable(){
  // Help availability by level:
  // Lv1-2: Round 3 only (deciding round)
  // Lv3-5: All rounds
  let roundAllowed=false;
  if(currentFight>=2){
    // Lv3-5: all rounds
    roundAllowed=true;
  }else{
    // Lv1-2: round 3 only (deciding round)
    roundAllowed=(p1.wins===1&&p2.wins===1);
  }
  if(!roundAllowed)return false;
  if(helpFirstTriggered)return false;
  if(roundTimer>HELP.timerThreshold)return false;
  if(p1.hp>HELP.playerHpThreshold)return false;
  if(p2.hp<HELP.aiHpThreshold)return false;
  return true;
}

function getHelperName(){
  return selectedChar==='guangchi'?'TEACH JOY':'LEAN BOO';
}
function getHelperFace(){
  return selectedChar==='guangchi'?teachjoyFace:leanbooFace;
}

function updateFighting(){
  const input=getInput();
  globalFrame++;
  if(justPressed('start')){bgmPause();goToState('paused');return;}
  if(justPressed('select')){bgmPause();goToState('instructions');return;}
  frameCount++;if(frameCount%60===0&&roundTimer>0)roundTimer--;
  if(isSwitching()){updateSwitchAnim(p1,p2);updatePrev();return;}

  // No-damage auto-engage
  if(p1.hp!==lastP1Hp||p2.hp!==lastP2Hp){
    noDamageTimer=0;ai.noDamageForced=false;lastP1Hp=p1.hp;lastP2Hp=p2.hp;
  }else{
    noDamageTimer++;
    if(noDamageTimer>=NO_DAMAGE_ENGAGE_TIME)ai.noDamageForced=true;
  }

  // Special
  if(justPressed('special')&&p1.specialCharge>=SPECIAL.maxCharge&&!p1.specialActive){
    const spName=selectedChar==='guangchi'?'ABALONE MOTIVATION':'REDBULL RECHARGE';
    p1.activateSpecial(spName,globalFrame);
    showSpecialSplash(spName+'!',selectedChar==='guangchi'?COLORS.hiviz:'#f80');triggerShake(10,5);playSpecial();
  }

  // === INPUT SYSTEM: instant tap + hold-to-charge ===
  // Taps fire immediately via justPressed. Charging enters when held past threshold + player canAct.
  const holdA = getHoldA();
  const holdB = getHoldB();

  // Build player input with justPressed for taps, raw state for charging
  const p1Input = {...input};
  p1Input.attackA = false;
  p1Input.attackB = false;
  p1Input.rawAttackA = input.attackA;
  p1Input.rawAttackB = input.attackB;

  // --- TAP A: instant sword or fireball ---
  if(justPressed('attackA') && p1.canAct && !p1.isAttacking){
    if(!tryPlayerFireball()){
      p1Input.attackA = true; // normal sword
    }
  }

  // --- TAP B: instant kick ---
  if(justPressed('attackB') && p1.canAct && !p1.isAttacking){
    p1Input.attackB = true;
  }

  // --- HOLD A → enter charging (distant slash) ---
  // Enter charging after a small hold threshold (distinguishes tap from hold intent)
  // and player is free to act (not in attack recovery, stun, etc.)
  const CHARGE_ENTRY_A = 15; // ~0.25s to confirm hold intent
  if(input.attackA && holdA >= CHARGE_ENTRY_A && p1.canAct && !p1.isCharging && p1.state !== STATE.CHARGING){
    p1.isCharging = true;
    p1.state = STATE.CHARGING;
    p1.chargeFrames = 0;
  }

  // --- HOLD B → enter charging kick (flying kick) ---
  const CHARGE_ENTRY_B = 15;
  if(input.attackB && holdB >= CHARGE_ENTRY_B && p1.canAct && !p1.isChargingKick && p1.state !== STATE.CHARGING_KICK){
    p1.isChargingKick = true;
    p1.state = STATE.CHARGING_KICK;
    p1.kickChargeFrames = 0;
  }

  // --- Release A from charging → fire distant slash if charged enough ---
  if(!input.attackA && p1.state === STATE.CHARGING){
    if(p1.chargeFrames >= DISTANT_ATTACK.chargeTime){
      const dir = p1.facingRight ? 1 : -1;
      let dmg = DISTANT_ATTACK.damage;
      if(p1.specialActive && p1.specialName === 'ABALONE MOTIVATION') dmg = Math.round(dmg * SPECIAL.playerDamageMult);
      addProjectile(p1.x, p1.y, dir, dmg, p1);
    }
    p1.chargeFrames = 0; p1.isCharging = false; p1.state = STATE.IDLE;
  }

  // --- Release B from charging kick → fire flying kick if charged enough ---
  if(!input.attackB && p1.state === STATE.CHARGING_KICK){
    if(p1.kickChargeFrames >= FLYING_KICK.chargeTime){
      p1.startDashKick(p2);
    }
    p1.kickChargeFrames = 0; p1.isChargingKick = false;
    if(p1.state === STATE.CHARGING_KICK) p1.state = STATE.IDLE;
  }

  // Check help availability
  helpAvailable=checkHelpAvailable();
  // First trigger: both A+B pressed simultaneously (manual)
  if(helpAvailable&&input.attackA&&input.attackB){
    helpHpSnapshot={p1:p1.hp,p2:p2.hp};
    bgmPause();
    goToState('helpChoice');
    updatePrev();
    return;
  }
  // Auto-trigger system: after first help use, 4s cooldown then auto-popup if behind
  if(helpFirstTriggered&&helpCooldownTimer>0)helpCooldownTimer--;
  if(helpFirstTriggered&&helpCooldownTimer<=0&&!helpAutoReady)helpAutoReady=true;
  if(helpAutoReady&&p1.hp<p2.hp){
    helpHpSnapshot={p1:p1.hp,p2:p2.hp};
    helpAutoReady=false;
    bgmPause();
    goToState('helpChoice');
    updatePrev();
    return;
  }

  // Set P1 move speed (Redbull Recharge boost)
  const isP1SpecialSpeed=p1.specialActive&&p1.specialName==='REDBULL RECHARGE';
  p1.moveSpeed=MOVE_SPEED*(isP1SpecialSpeed?SPECIAL.aiSpeedMult:1);

  p1.update(p1Input,p2);

  // AI
  const aiIn=ai.getInput(p2,p1,currentMaxHP);
  const aiSpecialCap=AI_LEVELS[currentFight].aiSpecialMaxPerRound||0;
  if(aiIn.special&&p2.specialCharge>=SPECIAL.maxCharge&&!p2.specialActive&&currentFight>=SPECIAL.aiMinLevel&&aiSpecialUsesThisRound<aiSpecialCap){
    const aiSpName=selectedChar==='guangchi'?'REDBULL RECHARGE':'ABALONE MOTIVATION';
    p2.activateSpecial(aiSpName,globalFrame);
    aiSpecialUsesThisRound++;
    showSpecialSplash(aiSpName+'!',selectedChar==='guangchi'?'#f80':COLORS.hiviz);triggerShake(10,5);playSpecial();
  }
  if(aiIn.fireball&&p2.canAct&&currentFight>=2){
    const dir=p2.facingRight?1:-1;let dmg=FIREBALL.damage;
    if(p2.specialActive&&p2.specialName==='ABALONE MOTIVATION')dmg=Math.round(dmg*SPECIAL.playerDamageMult);
    addFireball(p2.x,p2.y,dir,dmg,p2);
  }
  if(aiIn.distantSlash&&p2.canAct){
    const dir=p2.facingRight?1:-1;let dmg=DISTANT_ATTACK.damage;
    if(p2.specialActive&&p2.specialName==='ABALONE MOTIVATION')dmg=Math.round(dmg*SPECIAL.playerDamageMult);
    addProjectile(p2.x,p2.y,dir,dmg,p2);
  }
  if(aiIn.flyingKick&&p2.canAct)p2.startDashKick(p1);
  const isAiSpecialSpeed=p2.specialActive&&p2.specialName==='REDBULL RECHARGE';
  p2.moveSpeed=AI_LEVELS[currentFight].moveSpeed*(isAiSpecialSpeed?SPECIAL.aiSpeedMult:1);
  p2.update(aiIn,p1);
  checkHit(p1,p2);checkHit(p2,p1);checkDashKick(p1,p2);checkDashKick(p2,p1);checkProjectiles();
  // Push apart
  if(!p1.isDashing&&!isSwitching()){
    const overlap=30-Math.abs(p1.x-p2.x);
    if(overlap>0&&p1.isGrounded&&p2.isGrounded){
      const push=overlap/2+1;
      if(p1.x<p2.x){p1.x-=push;p2.x+=push;}
      else if(p1.x>p2.x){p1.x+=push;p2.x-=push;}
      else{p1.x-=push;p2.x+=push;}
    }
  }
  checkJumpOver();
  if(checkVLS())return;
  if(p1.state===STATE.KO){endRound('p2');return;}
  if(p2.state===STATE.KO){endRound('p1');return;}
  if(roundTimer<=0)endRound(p1.hp>=p2.hp?'p1':'p2');
}

function update(){
  switch(gameState){
    case 'title':if(justPressed('start'))goToState('charSelect');break;
    case 'charSelect':
      if(justPressed('attackA')){setupCharacter('guangchi');startNewGame();}
      if(justPressed('attackB')){setupCharacter('xuluv');startNewGame();}
      break;
    case 'fightIntro':stateTimer++;if(stateTimer>120||justPressed('start'))startFight();break;
    case 'roundIntro':stateData.timer--;if(stateData.timer<=0){bgmPlay();goToState('fighting');}break;
    case 'fighting':updateFighting();break;
    case 'vls':
      stateTimer++;
      if(stateTimer>=VLS.popupDuration){
        const leader=stateData.vlsLeader==='p1'?p1:p2;
        leader.freeze(stateData.freezeDur);
        vlsCooldownTimer=VLS.cooldown;
        vlsCrossLockoutTimer=VLS.crossLockout;
        bgmPlay();goToState('fighting');
      }
      break;
    // === HELP STATES ===
    case 'helpChoice':
      // "DO YOU NEED HELP?" — wait for A (yes) or B (no)
      if(justPressed('attackA')){
        helpFirstTriggered=true;helpCooldownTimer=240;helpAutoReady=false;
        const name=getHelperName();
        goToState('helpNpcIntro',{helperName:name,helperFace:getHelperFace(),helperColor:p1.color});
      }
      if(justPressed('attackB')){
        helpFirstTriggered=true;helpCooldownTimer=240;helpAutoReady=false;
        // Heal: +50% of current HP at snapshot
        const healAmt=Math.round(helpHpSnapshot.p1*HELP.healMultiplier + helpHpSnapshot.p2*HELP.healMultiplier);
        p1.hp=Math.min(p1.hp+healAmt,currentMaxHP);
        // Trigger heal visual effect
        healEffect={active:true,timer:HELP.healEffectDuration,amount:healAmt};
        spawnParticles(p1.x,p1.y-40,'heal');
        triggerShake(6,3);
        bgmPlay();goToState('fighting');
      }
      break;
    case 'helpNpcIntro':
      // "OK, X is coming" — show for 2 seconds
      stateTimer++;
      if(stateTimer>=HELP.popupDuration){
        // NPC starts off-screen behind opponent
        const npcStartX=p2.facingRight?-60:CANVAS_W+60;
        goToState('helpNpcAnim',{
          ...stateData,
          npcX:npcStartX,
          npcY:GROUND_Y,
          npcTargetX:p2.x,
          phase:'approach', // approach → strike → impact → exit
          phaseTimer:0,
          impactDone:false,
          npcSwordAngle:0,
        });
      }
      break;
    case 'helpNpcAnim':{
      // Multi-phase dramatic NPC attack
      stateTimer++;
      stateData.phaseTimer++;
      const targetX=stateData.npcTargetX;
      
      // FAILSAFE: if animation runs too long, force exit
      if(stateTimer>=480){ // 8 seconds max
        if(!stateData.impactDone){
          const dmgAmt=Math.round(helpHpSnapshot.p2*HELP.damageMultiplier);
          p2.hp=Math.max(0,p2.hp-dmgAmt);
          if(p2.hp<=0){p2.hp=0;p2.state=STATE.KO;}
          triggerShake(12,8);
        }
        bgmPlay();goToState('fighting');break;
      }
      
      if(stateData.phase==='approach'){
        // NPC slides in fast toward opponent
        const speed=10;
        if(stateData.npcX<targetX-15)stateData.npcX+=speed;
        else if(stateData.npcX>targetX+15)stateData.npcX-=speed;
        else stateData.phase='strike';
        if(stateData.phaseTimer>=HELP.npcApproachDuration)stateData.phase='strike';
        if(stateData.phase==='strike'){stateData.phaseTimer=0;stateData.strikeCount=0;stateData.strikeHits=0;}
      }
      else if(stateData.phase==='strike'){
        // 3 rapid slashes, each 30 frames
        const slashDuration=30;
        const slashFrame=stateData.phaseTimer%slashDuration;
        const currentSlash=Math.floor(stateData.phaseTimer/slashDuration);
        // Sword angle cycles: wind up then slash down for each strike
        const windUp=slashFrame/slashDuration;
        // Alternate slash directions for visual variety
        if(currentSlash%2===0){
          stateData.npcSwordAngle=windUp<0.6?windUp*4.0:4.0-(windUp-0.6)*8.0;
        }else{
          stateData.npcSwordAngle=windUp<0.6?-windUp*3.5:-3.5+(windUp-0.6)*7.0;
        }
        // Hit moment at 60% through each slash
        if(slashFrame===Math.round(slashDuration*0.6)&&stateData.strikeHits<3){
          stateData.strikeHits++;
          playSword();
          spawnParticles(p2.x+((Math.random()-0.5)*20),p2.y-35,'hit');
          triggerShake(5+stateData.strikeHits*2, 3+stateData.strikeHits);
        }
        if(currentSlash>=3){
          stateData.phase='impact';stateData.phaseTimer=0;
        }
      }
      else if(stateData.phase==='impact'){
        // Big final blow: damage, massive particles, screen effects
        if(!stateData.impactDone){
          stateData.impactDone=true;
          stateData.npcSwordAngle=3.5;
          const dmgAmt=Math.round(helpHpSnapshot.p2*HELP.damageMultiplier);
          p2.hp=Math.max(0,p2.hp-dmgAmt);
          if(p2.hp<=0){p2.hp=0;p2.state=STATE.KO;}
          // Massive particle burst
          for(let i=0;i<3;i++){
            spawnParticles(p2.x,p2.y-40,'combo');
            spawnParticles(p2.x+((Math.random()-0.5)*30),p2.y-30,'hit');
          }
          spawnParticles(p2.x,p2.y-20,'flyingkick');
          triggerShake(20,12);
          playSword();
        }
        // Hit-freeze for dramatic pause
        if(stateData.phaseTimer>=HELP.npcImpactDuration){
          stateData.phase='exit';stateData.phaseTimer=0;
        }
      }
      else if(stateData.phase==='exit'){
        // NPC slides out
        const exitDir=stateData.npcX<CANVAS_W/2?-8:8;
        stateData.npcX+=exitDir;
        if(stateData.phaseTimer>=HELP.npcExitDuration||stateData.npcX<-60||stateData.npcX>CANVAS_W+60){
          bgmPlay();goToState('fighting');
        }
      }
      break;
    }
    case 'roundEnd':stateTimer++;if(stateTimer>100||justPressed('start'))afterRoundEnd();break;
    case 'gameOver':if(justPressed('start'))startNewGame();break;
    case 'victory':if(justPressed('start'))goToState('title');break;
    case 'paused':if(justPressed('start')){bgmPlay();goToState('fighting');}if(justPressed('select'))goToState('instructions');break;
    case 'instructions':if(justPressed('select')||justPressed('start')){bgmPlay();goToState('paused');}break;
  }
  updatePrev();
}

function gameLoop(){
  try{
    update();
    if(healEffect.active){healEffect.timer--;if(healEffect.timer<=0)healEffect.active=false;}
    render(ctx,p1,p2,roundTimer,roundNum,gameState,stateData,currentMaxHP,currentFight,helpAvailable,healEffect);
  }catch(e){
    console.error('Game loop error:',e);
    // Recover: if stuck in help animation, force back to fighting
    if(gameState==='helpNpcAnim'||gameState==='helpNpcIntro'||gameState==='helpChoice'){
      projectiles.length=0;bgmPlay();goToState('fighting');
    }
  }
  requestAnimationFrame(gameLoop);
}
initControls();initAudio();gameLoop();
