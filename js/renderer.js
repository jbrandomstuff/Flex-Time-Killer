import { CANVAS_W,CANVAS_H,GROUND_Y,MAX_HP,COLORS,FIGHTER,PARTICLE,SPECIAL,DISTANT_ATTACK,FLYING_KICK,POSITION_SWITCH,TOTAL_FIGHTS,FIREBALL } from './constants.js';
import { STATE } from './player.js';
import { isMuted } from './audio.js';

const particles=[];
export function spawnParticles(x,y,type){
  const c=type==='combo'?{n:12,s:6,l:20,sz:4,col:'#f80'}
    :type==='hit'?{n:8,s:4,l:15,sz:3,col:COLORS.hit}
    :type==='distant'?{n:6,s:3,l:12,sz:2,col:COLORS.distant}
    :type==='flyingkick'?{n:15,s:7,l:25,sz:5,col:COLORS.flyingKick}
    :type==='fireball'?{n:10,s:5,l:18,sz:4,col:COLORS.fireball}
    :type==='heal'?{n:16,s:3,l:30,sz:4,col:'#4f4'}
    :{n:5,s:2,l:10,sz:2,col:COLORS.block};
  for(let i=0;i<c.n;i++){const a=Math.random()*Math.PI*2,sp=Math.random()*c.s+1;particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:c.l+Math.random()*5,maxLife:c.l,size:c.sz+Math.random()*2,color:c.col});}
}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life--;if(p.life<=0)particles.splice(i,1);}}
function renderParticles(ctx){for(const p of particles){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1;}

let shakeTimer=0,shakeIntensity=0;
export function triggerShake(d,i){shakeTimer=d;shakeIntensity=i;}
let bgImage=null;
export function setBgImage(img){bgImage=img;}

export const projectiles=[];
export function addProjectile(x,y,dir,damage,owner){
  projectiles.push({x,y:y-30,vx:dir*DISTANT_ATTACK.speed,life:DISTANT_ATTACK.travelTime,damage,owner,type:'distant'});
}
export function addFireball(x,y,dir,damage,owner){
  projectiles.push({x,y:y-30,vx:dir*FIREBALL.speed,life:FIREBALL.travelTime,damage,owner,type:'fireball'});
}
function updateProjectiles(){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx;p.life--;if(p.life<=0||p.x<-20||p.x>CANVAS_W+20)projectiles.splice(i,1);}}
function renderProjectiles(ctx){
  for(const p of projectiles){
    const alpha=Math.min(1,p.life/30);ctx.save();ctx.globalAlpha=alpha;
    if(p.type==='fireball'){
      const r=6+Math.sin(animTime*0.3)*2;
      ctx.fillStyle='#f80';ctx.shadowColor='#f60';ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ff0';ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(p.x,p.y,r*0.5,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=alpha*0.4;ctx.fillStyle='#f60';
      for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(p.x-p.vx*i*2,p.y,r*(1-i*0.2),0,Math.PI*2);ctx.fill();}
    }else{
      ctx.strokeStyle=COLORS.distant;ctx.lineWidth=3;ctx.shadowColor=COLORS.distant;ctx.shadowBlur=10;
      ctx.beginPath();ctx.moveTo(p.x-p.vx*2,p.y-5);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-p.vx*2,p.y+5);ctx.stroke();
      ctx.globalAlpha=alpha*0.3;ctx.beginPath();ctx.moveTo(p.x-p.vx*6,p.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    }
    ctx.restore();
  }
}

let splashText='',splashTimer=0,splashColor='';
export function showSpecialSplash(text,color){splashText=text;splashTimer=80;splashColor=color;}
function renderSplash(ctx){
  if(splashTimer<=0)return;splashTimer--;const p=splashTimer/80;ctx.save();
  if(p>0.85){ctx.globalAlpha=(p-0.85)/0.15;ctx.fillStyle=splashColor;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);}
  ctx.globalAlpha=p*0.4;ctx.strokeStyle=splashColor;ctx.lineWidth=2;
  for(let i=0;i<20;i++){const angle=(i/20)*Math.PI*2,r1=60+Math.random()*20,r2=150+Math.random()*50;
    ctx.beginPath();ctx.moveTo(CANVAS_W/2+Math.cos(angle)*r1,CANVAS_H/2+Math.sin(angle)*r1*0.6);ctx.lineTo(CANVAS_W/2+Math.cos(angle)*r2,CANVAS_H/2+Math.sin(angle)*r2*0.6);ctx.stroke();}
  ctx.globalAlpha=p*0.7;ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillRect(0,CANVAS_H/2-35,CANVAS_W,50);
  ctx.fillStyle=splashColor;ctx.globalAlpha=p*0.3;
  ctx.beginPath();ctx.moveTo(0,CANVAS_H/2-35);ctx.lineTo(CANVAS_W,CANVAS_H/2-45);ctx.lineTo(CANVAS_W,CANVAS_H/2-40);ctx.lineTo(0,CANVAS_H/2-30);ctx.fill();
  ctx.beginPath();ctx.moveTo(0,CANVAS_H/2+20);ctx.lineTo(CANVAS_W,CANVAS_H/2+10);ctx.lineTo(CANVAS_W,CANVAS_H/2+15);ctx.lineTo(0,CANVAS_H/2+25);ctx.fill();
  ctx.globalAlpha=p;const scale=1+(1-p)*0.3;ctx.translate(CANVAS_W/2,CANVAS_H/2-10);ctx.scale(scale,scale);
  ctx.font='bold 22px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillText(splashText,2,2);
  ctx.shadowColor=splashColor;ctx.shadowBlur=25;ctx.fillStyle=splashColor;ctx.fillText(splashText,0,0);
  ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.globalAlpha=p*0.6;ctx.fillText(splashText,0,0);ctx.restore();
}

let switchAnim={active:false,timer:0,duration:POSITION_SWITCH.animDuration,p1StartX:0,p2StartX:0,p1EndX:0,p2EndX:0};
export function startSwitchAnim(p1,p2){switchAnim.active=true;switchAnim.timer=0;switchAnim.p1StartX=p1.x;switchAnim.p2StartX=p2.x;switchAnim.p1EndX=p2.x;switchAnim.p2EndX=p1.x;}
export function isSwitching(){return switchAnim.active;}
export function updateSwitchAnim(p1,p2){if(!switchAnim.active)return;switchAnim.timer++;const t=switchAnim.timer/switchAnim.duration,ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;p1.x=switchAnim.p1StartX+(switchAnim.p1EndX-switchAnim.p1StartX)*ease;p2.x=switchAnim.p2StartX+(switchAnim.p2EndX-switchAnim.p2StartX)*ease;if(switchAnim.timer>=switchAnim.duration)switchAnim.active=false;}

let animTime=0;

function outlineText(ctx,text,x,y){ctx.save();ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.lineJoin='round';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();}

export function render(ctx,p1,p2,roundTimer,roundNum,gameState,stateData,currentMaxHP,currentFight,helpAvailable,healEffect){
  const maxHP=currentMaxHP||MAX_HP;
  const fightLevel=(currentFight||0)+1;
  animTime++;updateParticles();updateProjectiles();ctx.save();
  if(shakeTimer>0){ctx.translate((Math.random()-0.5)*shakeIntensity*2,(Math.random()-0.5)*shakeIntensity*2);shakeTimer--;}
  if(bgImage){
    ctx.drawImage(bgImage,0,0,CANVAS_W,CANVAS_H);
    ctx.fillStyle='rgba(255,140,40,0.12)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  }
  else{ctx.fillStyle='#1a1008';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);}
  ctx.strokeStyle='rgba(212,226,15,0.2)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,GROUND_Y+20);ctx.lineTo(CANVAS_W,GROUND_Y+20);ctx.stroke();ctx.setLineDash([]);
  if(p1.specialActive)drawSpecialAura(ctx,p1,true);if(p2.specialActive)drawSpecialAura(ctx,p2,false);
  if(p1.isFrozen)drawFreezeEffect(ctx,p1);if(p2.isFrozen)drawFreezeEffect(ctx,p2);
  drawFighter(ctx,p1);drawFighter(ctx,p2);

  renderProjectiles(ctx);renderParticles(ctx);

  // Heal effect overlay
  if(healEffect&&healEffect.active){
    drawHealEffect(ctx,healEffect,p1);
  }
  drawHUD(ctx,p1,p2,roundTimer,roundNum,maxHP,fightLevel,helpAvailable);
  if(p1.state===STATE.CHARGING)drawChargeBar(ctx,p1,'A',DISTANT_ATTACK.chargeTime);
  if(p1.state===STATE.CHARGING_KICK)drawChargeBar(ctx,p1,'B',FLYING_KICK.chargeTime);
  renderSplash(ctx);
  switch(gameState){
    case 'title':drawTitle(ctx);break;case 'charSelect':drawCharSelect(ctx);break;
    case 'fightIntro':drawFightIntro(ctx,stateData);break;case 'roundIntro':drawRoundIntro(ctx,stateData);break;
    case 'roundEnd':drawRoundEnd(ctx,stateData);break;case 'gameOver':drawGameOver(ctx);break;
    case 'victory':drawVictory(ctx);break;case 'paused':drawPaused(ctx);break;
    case 'instructions':drawInstructions(ctx);break;case 'vls':drawVLS(ctx,stateData);break;
    case 'helpChoice':drawHelpChoice(ctx);break;
    case 'helpNpcIntro':drawHelpNpcIntro(ctx,stateData);break;
    case 'helpNpcAnim':drawHelpNpcAnimOverlay(ctx,stateData);break;
  }
  // Draw NPC ON TOP of overlay so it's visible during helpNpcAnim
  if(gameState==='helpNpcAnim'&&stateData.helperFace){
    drawNPC(ctx,stateData.npcX,stateData.npcY||GROUND_Y,p1.color,stateData.helperFace,
      stateData.npcX<p2.x,stateData.phase,stateData.npcSwordAngle||0);
  }
  ctx.restore();
}

function drawSpecialAura(ctx,player,isP1){
  ctx.save();const isAbalone=player.specialName==='ABALONE MOTIVATION';const col=isAbalone?[212,226,15]:[255,120,0];const t=animTime;
  const grad=ctx.createLinearGradient(player.x,player.y+20,player.x,player.y-80);
  grad.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},0)`);grad.addColorStop(0.5,`rgba(${col[0]},${col[1]},${col[2]},0.15)`);grad.addColorStop(1,`rgba(${col[0]},${col[1]},${col[2]},0)`);
  ctx.fillStyle=grad;ctx.fillRect(player.x-25,player.y-80,50,100);
  for(let i=0;i<4;i++){const r=15+i*10+Math.sin(t*0.08+i)*6;ctx.globalAlpha=0.3-i*0.06+Math.sin(t*0.1)*0.05;ctx.strokeStyle=`rgb(${col[0]},${col[1]},${col[2]})`;ctx.lineWidth=2.5-i*0.4;ctx.beginPath();ctx.ellipse(player.x,player.y-25,r,r*1.4,0,0,Math.PI*2);ctx.stroke();}
  for(let i=0;i<5;i++){const px=player.x-15+Math.sin(t*0.05+i*1.3)*20,py=player.y-((t*2+i*40)%80);ctx.globalAlpha=0.4*(1-(t*2+i*40)%80/80);ctx.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fill();}ctx.restore();
}
function drawFreezeEffect(ctx,p){ctx.save();ctx.globalAlpha=0.3+Math.sin(animTime*0.1)*0.1;ctx.fillStyle='#88f';ctx.beginPath();ctx.ellipse(p.x,p.y-20,30,50,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#aaf';for(let i=0;i<6;i++){const a=animTime*0.03+i*1.05;ctx.fillRect(p.x+Math.cos(a)*22-2,p.y-30+Math.sin(a)*35-2,4,4);}ctx.restore();}
function drawChargeBar(ctx,player,label,maxFrames){
  const frames=label==='A'?player.chargeFrames:player.kickChargeFrames;const ratio=Math.min(1,frames/maxFrames),bx=player.x-20,by=player.y-100;
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bx,by,40,5);ctx.fillStyle=ratio>=1?'#fff':label==='A'?COLORS.distant:COLORS.flyingKick;ctx.fillRect(bx,by,40*ratio,5);
  ctx.font='bold 8px Orbitron, monospace';ctx.textAlign='center';ctx.fillStyle=ratio>=1?'#fff':'#888';ctx.fillText(ratio>=1?'RELEASE!':label==='A'?'SLASH':'KICK',player.x,by-4);
}

// ===== FIGHTER =====
function drawFighter(ctx,player){
  const{x,y,facingRight,color,state,attackFrame,attackData,flashTimer,faceImg}=player;
  const dir=facingRight?1:-1,t=animTime;ctx.save();

  // Guangchi special: +25% scale on entire body
  const isAbaloneSpecial=player.specialActive&&player.specialName==='ABALONE MOTIVATION';
  if(isAbaloneSpecial){
    const sc=SPECIAL.playerScaleMult;
    ctx.translate(x,y);ctx.scale(sc,sc);ctx.translate(-x,-y);
  }

  if(flashTimer>0&&flashTimer%2===0)ctx.globalAlpha=0.4;
  if(state===STATE.KO){ctx.translate(x,y);ctx.rotate(dir*0.5);ctx.translate(-x,-y);ctx.globalAlpha=0.7;}
  if(player.isFrozen)ctx.globalAlpha=0.55;
  const bodyColor=player.specialActive?(player.specialName==='ABALONE MOTIVATION'?'#8f8':'#fa8'):color;

  // Shadow
  ctx.save();ctx.globalAlpha=0.25;ctx.fillStyle='rgba(0,0,0,1)';
  ctx.beginPath();ctx.ellipse(x,y+2,22,5,0,0,Math.PI*2);ctx.fill();ctx.restore();

  let bodyTilt=0,hipY=y,lLegAngle=0,rLegAngle=0,lKneeBend=0.4,rKneeBend=0.4;
  let lArmAngle=0.3,rArmAngle=-0.3,swordAngle=0.4*dir;
  let breathe=Math.sin(t*0.06)*1.5,kickDraw=null;
  let backElbow=0.6,swordElbow=0.5;

  switch(state){
    case STATE.IDLE:
      hipY=y+breathe;lLegAngle=0.12;rLegAngle=-0.12;lKneeBend=0.35;rKneeBend=0.35;
      // Arms extended visibly away from body
      lArmAngle=0.4+Math.sin(t*0.04)*0.05;backElbow=0.6;
      rArmAngle=0.45*dir;swordElbow=0.6;
      swordAngle=(0.7+Math.sin(t*0.03)*0.08)*dir;break;
    case STATE.WALK:{
      const wc=Math.sin(t*0.15);hipY=y+Math.abs(wc)*-2;bodyTilt=wc*0.04*dir;
      lLegAngle=wc*0.5;rLegAngle=-wc*0.5;
      lKneeBend=0.4+wc*0.15;rKneeBend=0.4-wc*0.15;
      // Arms extended during walk too
      lArmAngle=-wc*0.3+0.2;rArmAngle=0.35*dir+wc*0.1;
      swordAngle=(0.65+Math.cos(t*0.15)*0.1)*dir;break;}
    case STATE.JUMP:
      lLegAngle=-0.3;rLegAngle=0.25;lKneeBend=0.6;rKneeBend=0.5;
      lArmAngle=-0.5;rArmAngle=0.3*dir;swordAngle=0.8*dir;bodyTilt=-0.05*dir;break;
    case STATE.BLOCK:
      hipY=y+8;lLegAngle=0.35;rLegAngle=-0.35;lKneeBend=0.6;rKneeBend=0.6;
      lArmAngle=-0.8*dir;swordAngle=-0.3*dir;bodyTilt=-0.1*dir;break;
    case STATE.DASH_KICK:
      bodyTilt=0.3*dir;hipY=y-8;lLegAngle=-0.5;rLegAngle=0;lKneeBend=0.3;rKneeBend=0.3;
      swordAngle=0.2*dir;lArmAngle=-0.8;rArmAngle=0.4;kickDraw={type:'front',p:0.8};break;
    case STATE.ATTACK_SWORD:if(attackData){const s=attackData.startup,a=attackData.active,v=player.swordVariation;
      if(attackFrame<s){const p=attackFrame/s;
        if(v===0){bodyTilt=-0.15*dir*p;swordAngle=(-1.0-p*0.5)*dir;}
        else if(v===1){bodyTilt=-0.1*dir*p;swordAngle=(-0.5-p*1.0)*dir;hipY=y+3*p;}
        else{bodyTilt=0.05*dir*p;swordAngle=-1.5*dir*p;hipY=y-2*p;}
        rArmAngle=-0.6*p;swordElbow=0.3;}
      else if(attackFrame<s+a){const p=(attackFrame-s)/a;
        if(v===0){bodyTilt=0.15*dir;swordAngle=(-1.5+p*3.0)*dir;}
        else if(v===1){bodyTilt=0.1*dir;swordAngle=(-1.5+p*2.5)*dir*0.6;}
        else{bodyTilt=-0.05*dir;swordAngle=(p*2.8-1.5)*dir;}
        rArmAngle=0.3;swordElbow=0.6;}
      else{const r=attackData.recovery,p=(attackFrame-s-a)/r;bodyTilt=(0.12-p*0.12)*dir;swordAngle=(1.2-p*0.8)*dir;rArmAngle=0.3-p*0.3;}}break;
    case STATE.ATTACK_KICK:if(attackData){const s=attackData.startup,a=attackData.active,v=player.kickVariation;swordAngle=0.3*dir;
      if(attackFrame<s){const p=attackFrame/s;
        if(v===0){bodyTilt=-0.08*dir*p;rLegAngle=-0.5*p;hipY=y+2;}
        else if(v===1){bodyTilt=-0.15*dir*p;rLegAngle=-0.3*p;lLegAngle=0.3*p;hipY=y+4*p;}
        else{bodyTilt=0.1*dir*p;rLegAngle=-0.8*p;hipY=y-2*p;}}
      else if(attackFrame<s+a){const p=(attackFrame-s)/a;
        if(v===0){bodyTilt=0.12*dir;kickDraw={type:'front',p};lLegAngle=0.25;}
        else if(v===1){bodyTilt=0.2*dir;kickDraw={type:'round',angle:(-0.5+p*2.2)*dir,p};hipY=y+2;lLegAngle=0.35;}
        else{bodyTilt=-0.05*dir;kickDraw={type:'crescent',angle:-1.5+p*2.0,p};hipY=y-3;lLegAngle=0.15;}}
      else{const r=attackData.recovery,p=(attackFrame-s-a)/r;bodyTilt=(0.1-p*0.1)*dir;rLegAngle=0.5-p*0.5;lLegAngle=0.2-p*0.05;}}break;
    case STATE.CHARGING:{const pulse=Math.sin(t*0.15)*0.05;bodyTilt=-0.05*dir+pulse;hipY=y+2;swordAngle=(-1.2+Math.sin(t*0.2)*0.1)*dir;rArmAngle=-0.5;break;}
    case STATE.CHARGING_KICK:{const pulse=Math.sin(t*0.12)*0.06;bodyTilt=0.1*dir+pulse;hipY=y+4;rLegAngle=-0.6+Math.sin(t*0.15)*0.1;lLegAngle=0.3;swordAngle=0.2*dir;break;}
    case STATE.HITSTUN:{const wb=Math.sin(t*0.3)*0.15;bodyTilt=-0.2*dir+wb;hipY=y+3;lLegAngle=0.2;rLegAngle=-0.3;lArmAngle=0.5;rArmAngle=-0.4;swordAngle=-0.5*dir;break;}
    case STATE.BLOCKSTUN:{const wb=Math.sin(t*0.25)*0.08;bodyTilt=-0.12*dir+wb;hipY=y+6;lLegAngle=0.3;rLegAngle=-0.3;swordAngle=-0.2*dir;break;}
    case STATE.FROZEN:hipY=y+4;lLegAngle=0.15;rLegAngle=-0.15;swordAngle=0.2*dir;break;
    case STATE.KO:hipY=y+10;lLegAngle=0.6;rLegAngle=-0.2;lArmAngle=0.8;rArmAngle=-0.6;swordAngle=-0.8*dir;break;
  }
  const torso=FIGHTER.torsoLen,leg=FIGHTER.legLen,arm=FIGHTER.armLen;
  const thigh=leg*0.55,shin=leg*0.55;
  const upperArm=arm*0.6,forearm=arm*0.5;
  const hx=x,hy=hipY;
  const sx=hx+Math.sin(bodyTilt)*torso,sy=hy-Math.cos(bodyTilt)*torso;
  ctx.strokeStyle=bodyColor;ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(hx,hy);ctx.stroke();

  // === LEGS with knees ===
  const lla=bodyTilt+lLegAngle*dir;
  const lKneeX=hx+Math.sin(lla)*thigh, lKneeY=hy+Math.cos(lla)*thigh;
  const lFootA=lla-lKneeBend*dir;
  const lFootX=lKneeX+Math.sin(lFootA)*shin, lFootY=lKneeY+Math.cos(lFootA)*shin;
  ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(lKneeX,lKneeY);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lKneeX,lKneeY);ctx.lineTo(lFootX,lFootY);ctx.stroke();
  ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(lFootX,lFootY);ctx.lineTo(lFootX+dir*6,lFootY+2);ctx.stroke();

  if(kickDraw){drawKickLeg(ctx,hx,hy,dir,kickDraw,leg,bodyColor);}
  else{
    const rla=bodyTilt+rLegAngle*dir;
    const rKneeX=hx+Math.sin(rla)*thigh, rKneeY=hy+Math.cos(rla)*thigh;
    const rFootA=rla-rKneeBend*dir;
    const rFootX=rKneeX+Math.sin(rFootA)*shin, rFootY=rKneeY+Math.cos(rFootA)*shin;
    ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(rKneeX,rKneeY);ctx.stroke();
    ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(rKneeX,rKneeY);ctx.lineTo(rFootX,rFootY);ctx.stroke();
    ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(rFootX,rFootY);ctx.lineTo(rFootX+dir*6,rFootY+2);ctx.stroke();
  }

  // === BACK ARM with elbow ===
  const bla=bodyTilt+lArmAngle;
  const bElbowX=sx+Math.sin(bla)*upperArm, bElbowY=sy+Math.cos(bla)*upperArm;
  const bHandA=bla+backElbow*dir;
  const bHandX=bElbowX+Math.sin(bHandA)*forearm, bHandY=bElbowY+Math.cos(bHandA)*forearm;
  ctx.globalAlpha=(flashTimer>0&&flashTimer%2===0)?0.3:0.65;ctx.strokeStyle=bodyColor;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(bElbowX,bElbowY);ctx.stroke();
  ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(bElbowX,bElbowY);ctx.lineTo(bHandX,bHandY);ctx.stroke();

  // === SWORD ARM with elbow ===
  ctx.globalAlpha=(flashTimer>0&&flashTimer%2===0)?0.4:1;ctx.strokeStyle=bodyColor;
  const sla=bodyTilt+rArmAngle;
  const sElbowX=sx+Math.sin(sla)*upperArm*0.8, sElbowY=sy+Math.cos(sla)*upperArm*0.5;
  const sHandA=sla+swordElbow*dir;
  const sHandX=sElbowX+Math.sin(sHandA)*forearm*0.6, sHandY=sElbowY+Math.cos(sHandA)*forearm*0.3;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sElbowX,sElbowY);ctx.stroke();
  ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(sElbowX,sElbowY);ctx.lineTo(sHandX,sHandY);ctx.stroke();

  // === SWORD ===
  let sLen=FIGHTER.swordLen;
  if(isAbaloneSpecial)sLen=Math.round(sLen*SPECIAL.playerSwordLenMult);
  const sEndX=sHandX+Math.sin(swordAngle)*sLen,sEndY=sHandY-Math.cos(swordAngle)*sLen;
  const swinging=state===STATE.ATTACK_SWORD&&player.hitboxActive;
  const hLen=6;
  const hEndX=sHandX+Math.sin(swordAngle)*hLen,hEndY=sHandY-Math.cos(swordAngle)*hLen;
  ctx.strokeStyle='#630';ctx.lineWidth=3.5;
  ctx.beginPath();ctx.moveTo(sHandX,sHandY);ctx.lineTo(hEndX,hEndY);ctx.stroke();
  const ga=swordAngle+Math.PI/2;
  ctx.strokeStyle='#a80';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(hEndX+Math.cos(ga)*5,hEndY+Math.sin(ga)*5);ctx.lineTo(hEndX-Math.cos(ga)*5,hEndY-Math.sin(ga)*5);ctx.stroke();
  ctx.strokeStyle=swinging?COLORS.swordFlash:'#ccd';ctx.lineWidth=swinging?4:3;
  ctx.beginPath();ctx.moveTo(hEndX,hEndY);ctx.lineTo(sEndX,sEndY);ctx.stroke();
  const bladeDir={x:Math.sin(swordAngle),y:-Math.cos(swordAngle)};
  ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(hEndX+bladeDir.x*4+Math.cos(ga)*1,hEndY+bladeDir.y*4+Math.sin(ga)*1);
  ctx.lineTo(sEndX-bladeDir.x*3+Math.cos(ga)*1,sEndY-bladeDir.y*3+Math.sin(ga)*1);ctx.stroke();
  ctx.fillStyle=swinging?'#fff':'#dde';ctx.beginPath();ctx.arc(sEndX,sEndY,1.5,0,Math.PI*2);ctx.fill();
  if(swinging){ctx.save();ctx.globalAlpha=0.25;ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(hEndX,hEndY);ctx.lineTo(sEndX,sEndY);ctx.stroke();ctx.restore();}

  if(state===STATE.BLOCK){ctx.strokeStyle='rgba(212,226,15,0.5)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(sx+dir*15,sy+15,20,-Math.PI*0.5,Math.PI*0.5);ctx.stroke();ctx.globalAlpha=0.2+Math.sin(t*0.1)*0.1;ctx.fillStyle=COLORS.hiviz;ctx.beginPath();ctx.arc(sx+dir*15,sy+15,18,-Math.PI*0.5,Math.PI*0.5);ctx.fill();ctx.globalAlpha=1;}
  if(state===STATE.DASH_KICK){ctx.save();ctx.globalAlpha=0.3;ctx.strokeStyle=COLORS.flyingKick;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-dir*50,y-5);ctx.lineTo(x,y-5);ctx.stroke();ctx.globalAlpha=0.15;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(x-dir*80,y);ctx.lineTo(x,y);ctx.stroke();ctx.restore();}

  // === HEAD ===
  const headR=FIGHTER.headRadius;
  const hs=headR*2,headX=sx,headY=sy-headR-2;
  ctx.save();
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.closePath();ctx.clip();
  if(faceImg&&faceImg.complete&&faceImg.naturalWidth>0){
    ctx.globalAlpha=player.isFrozen?0.5:1;
    // Center-crop: scale to fill the circle, centering on the emoji
    const imgW=faceImg.naturalWidth, imgH=faceImg.naturalHeight;
    const minDim=Math.min(imgW,imgH);
    // Crop to square from center, then scale to fill head
    const dSize=headR*2.6; // slightly larger than circle to ensure full coverage
    const sx=(imgW-minDim)/2, sy=(imgH-minDim)/2; // center crop source
    if(!facingRight){ctx.translate(headX,headY);ctx.scale(-1,1);ctx.translate(-headX,-headY);}
    ctx.drawImage(faceImg, sx,sy,minDim,minDim, headX-dSize/2,headY-dSize/2,dSize,dSize);
    ctx.globalAlpha=1;
  }else{ctx.font=`${hs}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('\u{1F610}',headX,headY);}
  ctx.restore();
  ctx.strokeStyle=bodyColor;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

// === NPC helper (dramatic multi-phase attack) ===
function drawNPC(ctx,nx,ny,color,faceImg,facingRight,phase,npcSwordAngle){
  const dir=facingRight?1:-1,t=animTime;ctx.save();
  const bodyColor=color;
  const torso=FIGHTER.torsoLen,leg=FIGHTER.legLen,arm=FIGHTER.armLen;
  const thigh=leg*0.55,shin=leg*0.55;
  const hx=nx,hy=ny;
  // Phase-based pose
  let bodyTilt=0,lLegAngle=0,rLegAngle=0,swordAngle=0.5*dir;
  if(phase==='approach'){
    const wc=Math.sin(t*0.25);bodyTilt=0.15*dir;lLegAngle=wc*0.6;rLegAngle=-wc*0.6;
    swordAngle=(-0.8+Math.sin(t*0.1)*0.2)*dir;
  }else if(phase==='strike'){
    bodyTilt=0.25*dir;swordAngle=(npcSwordAngle||0)*dir;lLegAngle=0.3;rLegAngle=-0.4;
  }else if(phase==='impact'){
    bodyTilt=0.3*dir;swordAngle=1.8*dir;lLegAngle=0.2;rLegAngle=-0.2;
  }else{
    const wc=Math.sin(t*0.2);bodyTilt=wc*0.04*dir;lLegAngle=wc*0.5;rLegAngle=-wc*0.5;swordAngle=0.4*dir;
  }
  const sx=hx+Math.sin(bodyTilt)*torso,sy=hy-Math.cos(bodyTilt)*torso;
  // Body glow during approach/strike
  if(phase==='approach'||phase==='strike'){
    ctx.save();ctx.globalAlpha=0.3+Math.sin(t*0.15)*0.15;ctx.strokeStyle=bodyColor;ctx.lineWidth=8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(hx,hy);ctx.stroke();ctx.restore();
  }
  ctx.strokeStyle=bodyColor;ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(hx,hy);ctx.stroke();
  // Legs
  const lla=bodyTilt+lLegAngle*dir;
  const lKneeX=hx+Math.sin(lla)*thigh,lKneeY=hy+Math.cos(lla)*thigh;
  ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(lKneeX,lKneeY);ctx.stroke();
  const lFootA=lla-0.4*dir;
  const lFootX=lKneeX+Math.sin(lFootA)*shin,lFootY=lKneeY+Math.cos(lFootA)*shin;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lKneeX,lKneeY);ctx.lineTo(lFootX,lFootY);ctx.stroke();
  const rla=bodyTilt+rLegAngle*dir;
  const rKneeX=hx+Math.sin(rla)*thigh,rKneeY=hy+Math.cos(rla)*thigh;
  ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(rKneeX,rKneeY);ctx.stroke();
  const rFootA=rla-0.4*dir;
  const rFootX=rKneeX+Math.sin(rFootA)*shin,rFootY=rKneeY+Math.cos(rFootA)*shin;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(rKneeX,rKneeY);ctx.lineTo(rFootX,rFootY);ctx.stroke();
  // Sword arm with dramatic strike effects
  const sLen=FIGHTER.swordLen*1.2;
  const sArmAngle=bodyTilt+0.3*dir;
  const sElbowX=sx+Math.sin(sArmAngle)*arm*0.5,sElbowY=sy+Math.cos(sArmAngle)*arm*0.3;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sElbowX,sElbowY);ctx.stroke();
  const sEndX=sElbowX+Math.sin(swordAngle)*sLen,sEndY=sElbowY-Math.cos(swordAngle)*sLen;
  const isStriking=phase==='strike'||phase==='impact';
  if(isStriking){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=8;ctx.globalAlpha=0.4;ctx.shadowColor='#fff';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(sElbowX,sElbowY);ctx.lineTo(sEndX,sEndY);ctx.stroke();ctx.restore();}
  ctx.strokeStyle=isStriking?'#fff':COLORS.swordFlash;ctx.lineWidth=isStriking?4:3;
  ctx.beginPath();ctx.moveTo(sElbowX,sElbowY);ctx.lineTo(sEndX,sEndY);ctx.stroke();
  if(phase==='strike'&&npcSwordAngle>1.5){ctx.save();ctx.globalAlpha=0.3;ctx.strokeStyle='#fff';ctx.lineWidth=12;const prevAngle=(npcSwordAngle-1.5)*dir;const pEndX=sElbowX+Math.sin(prevAngle)*sLen,pEndY=sElbowY-Math.cos(prevAngle)*sLen;ctx.beginPath();ctx.moveTo(pEndX,pEndY);ctx.quadraticCurveTo(sElbowX+dir*20,sElbowY-20,sEndX,sEndY);ctx.stroke();ctx.restore();}
  // Back arm
  ctx.strokeStyle=bodyColor;ctx.globalAlpha=0.65;
  const bArmAngle=bodyTilt-Math.sin(t*0.2)*0.3;
  const bElbowX=sx+Math.sin(bArmAngle)*arm*0.5,bElbowY=sy+Math.cos(bArmAngle)*arm*0.5;
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(bElbowX,bElbowY);ctx.stroke();
  ctx.globalAlpha=1;
  // Head with helper face
  const headR=FIGHTER.headRadius;
  const headX=sx,headY=sy-headR-2;
  ctx.save();
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.closePath();ctx.clip();
  if(faceImg&&faceImg.complete&&faceImg.naturalWidth>0){
    // Center-crop: same as drawFighter
    const imgW=faceImg.naturalWidth, imgH=faceImg.naturalHeight;
    const minDim=Math.min(imgW,imgH);
    const dSize=headR*3.5;
    const sx=(imgW-minDim)/2, sy=(imgH-minDim)/2;
    if(!facingRight){ctx.translate(headX,headY);ctx.scale(-1,1);ctx.translate(-headX,-headY);}
    ctx.drawImage(faceImg, sx,sy,minDim,minDim, headX-dSize/2,headY-dSize/2,dSize,dSize);
  }
  ctx.restore();
  ctx.strokeStyle=bodyColor;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

// === HEAL EFFECT ===
function drawHealEffect(ctx,healEffect,player){
  const t=healEffect.timer;const maxT=90;const p=t/maxT;
  ctx.save();
  // Green pulse aura
  const pulseR=25+Math.sin((maxT-t)*0.15)*10+(1-p)*30;
  ctx.globalAlpha=p*0.3;ctx.strokeStyle='#4f4';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(player.x,player.y-25,pulseR,pulseR*1.3,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=p*0.12;ctx.fillStyle='#4f4';
  ctx.beginPath();ctx.ellipse(player.x,player.y-25,pulseR-5,pulseR*1.2,0,0,Math.PI*2);ctx.fill();
  // Rising green sparkles
  for(let i=0;i<4;i++){
    const px=player.x-15+Math.sin((maxT-t)*0.08+i*1.7)*20;
    const py=player.y-((maxT-t)*1.5+i*20)%80;
    ctx.globalAlpha=p*0.6;ctx.fillStyle='#4f4';
    ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill();
  }
  // Floating +HP text that rises and fades
  const textY=player.y-60-(1-p)*50;
  ctx.globalAlpha=p;ctx.font='bold 16px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.lineJoin='round';
  ctx.strokeText('+'+healEffect.amount+' HP',player.x,textY);
  ctx.fillStyle='#4f4';ctx.shadowColor='#4f4';ctx.shadowBlur=10;
  ctx.fillText('+'+healEffect.amount+' HP',player.x,textY);
  ctx.restore();
}

function drawKickLeg(ctx,hx,hy,dir,kick,legLen,bodyColor){
  ctx.save();const ext=legLen+10;const thigh=legLen*0.55,shin=legLen*0.55;
  if(kick.type==='front'){
    const kx=hx+dir*ext*0.9,ky=hy-5;const midX=hx+dir*15,midY=hy+10;
    ctx.strokeStyle='#fa0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(midX,midY);ctx.stroke();
    ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(midX,midY);ctx.lineTo(kx,ky);ctx.stroke();
    ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(kx,ky);ctx.lineTo(kx+dir*8,ky-2);ctx.stroke();
    ctx.globalAlpha=0.5;ctx.fillStyle='#fa0';ctx.beginPath();ctx.arc(kx+dir*4,ky,7,0,Math.PI*2);ctx.fill();}
  else if(kick.type==='round'){
    const a=kick.angle,kx=hx+Math.sin(a)*ext,ky=hy-Math.cos(a)*ext*0.5+5;
    const midA=a*0.4,midX=hx+Math.sin(midA)*thigh,midY=hy+Math.cos(midA)*thigh*0.6;
    ctx.strokeStyle='#f80';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(midX,midY);ctx.stroke();
    ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(midX,midY);ctx.lineTo(kx,ky);ctx.stroke();
    ctx.globalAlpha=0.2;ctx.strokeStyle='#ff0';ctx.lineWidth=8;ctx.beginPath();ctx.arc(hx,hy,ext*0.8,-Math.PI*0.3,a,a>0);ctx.stroke();
    ctx.globalAlpha=0.5;ctx.fillStyle='#f80';ctx.beginPath();ctx.arc(kx,ky,8,0,Math.PI*2);ctx.fill();}
  else{
    const a=kick.angle,kx=hx+dir*Math.cos(a)*ext*0.6,ky=hy-Math.sin(Math.abs(a))*ext*0.9-5;
    const midX=hx+dir*8,midY=hy-15;
    ctx.strokeStyle='#fc0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(midX,midY);ctx.stroke();
    ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(midX,midY);ctx.lineTo(kx,ky);ctx.stroke();
    ctx.globalAlpha=0.15;ctx.strokeStyle='#ff0';ctx.lineWidth=6;ctx.beginPath();ctx.arc(hx,hy-10,ext*0.7,Math.PI*0.5,-a);ctx.stroke();
    ctx.globalAlpha=0.5;ctx.fillStyle='#fc0';ctx.beginPath();ctx.arc(kx,ky,7,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

// ===== HUD =====
function drawHUD(ctx,p1,p2,roundTimer,roundNum,maxHP,fightLevel,helpAvailable){
  const gap=10;
  ctx.font='bold 14px Rajdhani, sans-serif';ctx.textBaseline='top';
  ctx.textAlign='left';ctx.fillStyle=p1.color;
  const p1Name=p1.displayName||'GUANGCHI TOP LOADER';
  outlineText(ctx,p1Name,gap,3);
  const p1NameW=ctx.measureText(p1Name).width;
  drawWinStars(ctx,gap+p1NameW+4,3,p1.wins,true);
  ctx.textAlign='right';ctx.fillStyle=p2.color;
  const p2Name=p2.aiName||'XULUV';
  outlineText(ctx,p2Name,CANVAS_W-gap,3);
  const p2NameW=ctx.measureText(p2Name).width;
  drawWinStars(ctx,CANVAS_W-gap-p2NameW-4,3,p2.wins,false);
  const barW=155,barH=10,barY=19;
  drawBar(ctx,gap,barY,barW,barH,p1.hp/maxHP,p1.color,true);drawBar(ctx,CANVAS_W-gap-barW,barY,barW,barH,p2.hp/maxHP,p2.color,false);
  const specBarH=6,specBarY=barY+barH+2;
  const p1f=p1.specialCharge>=SPECIAL.maxCharge,p2f=p2.specialCharge>=SPECIAL.maxCharge;
  drawBar(ctx,gap,specBarY,barW,specBarH,p1.specialCharge/SPECIAL.maxCharge,COLORS.specialBar.p1,true,p1.specialActive||p1f);
  drawBar(ctx,CANVAS_W-gap-barW,specBarY,barW,specBarH,p2.specialCharge/SPECIAL.maxCharge,COLORS.specialBar.p2,false,p2.specialActive||p2f);
  if(p1f&&!p1.specialActive){
    const flash=Math.sin(animTime*0.2);const flash2=Math.sin(animTime*0.35);
    const tapX=gap+barW/2,tapY=specBarY+specBarH+14;
    ctx.save();ctx.globalAlpha=0.4+flash*0.3;ctx.fillStyle=COLORS.hiviz;ctx.shadowColor=COLORS.hiviz;ctx.shadowBlur=20;ctx.fillRect(tapX-38,tapY-14,76,26);ctx.restore();
    ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(tapX-35,tapY-12,70,22);
    ctx.strokeStyle=COLORS.hiviz;ctx.lineWidth=2;ctx.strokeRect(tapX-35,tapY-12,70,22);
    ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(tapX-33,tapY-10,66,18);
    ctx.font='bold 18px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=flash2>0?'#fff':COLORS.hiviz;ctx.shadowColor=COLORS.hiviz;ctx.shadowBlur=15;
    ctx.fillText('TAP!',tapX,tapY);ctx.shadowBlur=0;
    ctx.globalAlpha=0.4+flash*0.3;ctx.fillStyle='#fff';ctx.fillText('TAP!',tapX,tapY);ctx.globalAlpha=1;
  }
  if(p1.specialActive){ctx.font='bold 7px Orbitron, monospace';ctx.textAlign='left';ctx.fillStyle=COLORS.hiviz;const s=(Math.random()-0.5)*2;ctx.fillText(p1.specialName||'SPECIAL',gap+s,specBarY+specBarH+2+s);}
  if(p2.specialActive){ctx.font='bold 7px Orbitron, monospace';ctx.textAlign='right';ctx.fillStyle='#f80';const s=(Math.random()-0.5)*2;ctx.fillText(p2.specialName||'SPECIAL',CANVAS_W-gap+s,specBarY+specBarH+2+s);}

  // === HELP PROMPT: flashing "Press A+B" below special bar ===
  if(helpAvailable){
    const flash=Math.sin(animTime*0.2);
    if(flash>-0.3){ // visible most of the time, flickers off briefly
      const helpX=gap+barW/2,helpY=specBarY+specBarH+42;
      ctx.save();
      ctx.font='bold 14px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.globalAlpha=0.6+flash*0.4;
      ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.lineJoin='round';
      ctx.strokeText('Press A+B',helpX,helpY);
      ctx.fillStyle=flash>0.3?'#fff':'#ff0';
      ctx.shadowColor='#ff0';ctx.shadowBlur=12;
      ctx.fillText('Press A+B',helpX,helpY);
      ctx.restore();
    }
  }

  // Timer box
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(CANVAS_W/2-22,2,44,22);ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.strokeRect(CANVAS_W/2-22,2,44,22);
  ctx.font='bold 16px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=roundTimer<=10?'#f44':COLORS.timer;ctx.fillText(String(roundTimer),CANVAS_W/2,3);
  // Level display
  ctx.font='bold 9px Orbitron, monospace';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#fff';
  ctx.save();ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.lineJoin='round';
  ctx.strokeText('LV.'+fightLevel,CANVAS_W/2+24,6);ctx.fillText('LV.'+fightLevel,CANVAS_W/2+24,6);ctx.restore();
  // Round text with 1px black border
  ctx.font='bold 18px Rajdhani, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.save();ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.lineJoin='round';
  ctx.strokeText('ROUND '+roundNum,CANVAS_W/2,25);
  ctx.fillStyle='#fff';ctx.fillText('ROUND '+roundNum,CANVAS_W/2,25);ctx.restore();
  // Mute button
  const mbx=CANVAS_W/2-20,mby=44,mbw=40,mbh=18;ctx.fillStyle=isMuted()?'rgba(80,0,0,0.7)':'rgba(0,60,0,0.7)';ctx.fillRect(mbx,mby,mbw,mbh);ctx.strokeStyle=isMuted()?'#f44':COLORS.hiviz;ctx.lineWidth=1.5;ctx.strokeRect(mbx,mby,mbw,mbh);ctx.fillStyle=isMuted()?'#f66':'#fff';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(isMuted()?'\u{1F507}':'\u{1F50A}',mbx+mbw/2,mby+mbh/2);
}
function drawBar(ctx,x,y,w,h,ratio,color,leftFill,glowing=false){ratio=Math.max(0,Math.min(1,ratio));ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(x,y,w,h);const fw=w*ratio;ctx.fillStyle=color;if(leftFill)ctx.fillRect(x+w-fw,y,fw,h);else ctx.fillRect(x,y,fw,h);ctx.strokeStyle=glowing?color:'#555';ctx.lineWidth=glowing?2:1;ctx.strokeRect(x,y,w,h);if(glowing){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=8;ctx.strokeRect(x,y,w,h);ctx.restore();}}
function drawWinStars(ctx,x,y,w,l){ctx.save();ctx.font='bold 12px sans-serif';ctx.textAlign=l?'left':'right';ctx.textBaseline='top';ctx.fillStyle=COLORS.hiviz;let str='';for(let i=0;i<w;i++)str+='\u2605';if(str)ctx.fillText(str,x,y);ctx.restore();}

// ===== OVERLAYS =====
function ov(ctx){ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);}
function bk(ctx,text,x,y,font,color){if(Math.sin(Date.now()*0.005)>0){ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);}}
function drawTitle(ctx){ov(ctx);ctx.font='bold 28px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS.hiviz;ctx.fillText('FLEX TIME',CANVAS_W/2,CANVAS_H/2-28);ctx.fillText('KILLER',CANVAS_W/2,CANVAS_H/2+8);bk(ctx,'PRESS START',CANVAS_W/2,CANVAS_H/2+50,'bold 12px Rajdhani, sans-serif','#aaa');}

function drawCharSelect(ctx){
  ov(ctx);const cx=CANVAS_W/2,cy=CANVAS_H/2;
  ctx.font='bold 18px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS.hiviz;
  ctx.fillText('CHOOSE YOUR FIGHTER',cx,cy-70);
  ctx.fillStyle='rgba(68,170,255,0.15)';ctx.fillRect(30,cy-40,180,90);ctx.strokeStyle=COLORS.p1;ctx.lineWidth=2;ctx.strokeRect(30,cy-40,180,90);
  ctx.font='bold 14px Orbitron, monospace';ctx.fillStyle=COLORS.p1;ctx.fillText('GUANGCHI',120,cy-15);
  ctx.font='bold 10px Rajdhani, sans-serif';ctx.fillStyle='#aaa';ctx.fillText('TOP LOADER',120,cy+5);
  ctx.font='bold 16px Rajdhani, sans-serif';ctx.fillStyle='#fff';ctx.fillText('[ A ]',120,cy+30);
  ctx.fillStyle='rgba(255,68,68,0.15)';ctx.fillRect(CANVAS_W-210,cy-40,180,90);ctx.strokeStyle=COLORS.p2;ctx.lineWidth=2;ctx.strokeRect(CANVAS_W-210,cy-40,180,90);
  ctx.font='bold 14px Orbitron, monospace';ctx.fillStyle=COLORS.p2;ctx.fillText('XULUV',CANVAS_W-120,cy-15);
  ctx.font='bold 10px Rajdhani, sans-serif';ctx.fillStyle='#aaa';ctx.fillText('THE CHALLENGER',CANVAS_W-120,cy+5);
  ctx.font='bold 16px Rajdhani, sans-serif';ctx.fillStyle='#fff';ctx.fillText('[ B ]',CANVAS_W-120,cy+30);
}

function drawFightIntro(ctx,d){ov(ctx);ctx.font='bold 12px Rajdhani, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#aaa';ctx.fillText('NEXT CHALLENGER',CANVAS_W/2,CANVAS_H/2-40);ctx.font='bold 18px Orbitron, monospace';ctx.fillStyle=d.opColor||COLORS.p2;ctx.fillText(d.opponentName||'XULUV',CANVAS_W/2,CANVAS_H/2-5);ctx.font='bold 12px Rajdhani, sans-serif';ctx.fillStyle='#888';ctx.fillText('FIGHT '+(d.fightNum||1)+' / '+TOTAL_FIGHTS,CANVAS_W/2,CANVAS_H/2+25);}
function drawRoundIntro(ctx,d){ov(ctx);ctx.font='bold 32px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS.hiviz;const p=d.timer/d.duration;if(p>0.6)ctx.fillText('ROUND '+d.roundNum,CANVAS_W/2,CANVAS_H/2);else if(p>0.2)ctx.fillText('FIGHT!',CANVAS_W/2,CANVAS_H/2);}
function drawRoundEnd(ctx,d){ov(ctx);ctx.font='bold 24px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=d.winnerColor||'#fff';ctx.fillText(d.winnerName,CANVAS_W/2,CANVAS_H/2-10);ctx.font='bold 12px Rajdhani, sans-serif';ctx.fillStyle='#aaa';ctx.fillText('WINS THE ROUND',CANVAS_W/2,CANVAS_H/2+16);}
function drawGameOver(ctx){ov(ctx);ctx.font='bold 28px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f44';ctx.fillText('GAME OVER',CANVAS_W/2,CANVAS_H/2-20);bk(ctx,'PRESS START TO RETRY',CANVAS_W/2,CANVAS_H/2+15,'bold 11px Rajdhani, sans-serif','#aaa');}
function drawVictory(ctx){ov(ctx);ctx.font='bold 28px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS.hiviz;ctx.fillText('VICTORY!',CANVAS_W/2,CANVAS_H/2-20);ctx.font='bold 12px Rajdhani, sans-serif';ctx.fillStyle='#aaa';ctx.fillText('ALL CHALLENGERS DEFEATED',CANVAS_W/2,CANVAS_H/2+10);bk(ctx,'PRESS START',CANVAS_W/2,CANVAS_H/2+38,'bold 11px Rajdhani, sans-serif','#aaa');}
function drawPaused(ctx){ov(ctx);ctx.font='bold 28px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS.hiviz;ctx.fillText('PAUSED',CANVAS_W/2,CANVAS_H/2-10);bk(ctx,'PRESS START TO RESUME',CANVAS_W/2,CANVAS_H/2+25,'bold 11px Rajdhani, sans-serif','#aaa');}

function drawInstructions(ctx){
  ov(ctx);const cx=CANVAS_W/2;let y=15;
  ctx.font='bold 18px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=COLORS.hiviz;ctx.fillText('HOW TO PLAY',cx,y);y+=28;
  ctx.font='bold 13px Rajdhani, sans-serif';ctx.fillStyle='#ddd';ctx.fillText('\u2014 MOBILE \u2014',cx,y);y+=18;
  ctx.font='12px Rajdhani, sans-serif';ctx.fillStyle='#ccc';
  ['D-PAD \u25C4\u25BA Move  |  \u25B2 Jump (x2)  |  \u25BC Block',
   'A: Sword (close) / Fireball (far, Lv3+)  |  B: Kick',
   'Hold A: Distant Slash (1s)  |  Hold B: Flying Kick (2s)',
   '5 kicks in a row = bonus damage!',
   'TAP special bar when full  |  Flying kick dodged by jump',
   'START: Pause  |  SELECT: This screen',
  ].forEach(l=>{ctx.fillText(l,cx,y);y+=15;});
  y+=8;ctx.font='bold 13px Rajdhani, sans-serif';ctx.fillStyle='#ddd';ctx.fillText('\u2014 DESKTOP \u2014',cx,y);y+=18;
  ctx.font='12px Rajdhani, sans-serif';ctx.fillStyle='#ccc';
  ['A/D Move  |  W Jump (x2)  |  S Block',
   'J: Sword / Fireball  |  K: Kick',
   'Hold J: Distant Slash (1s)  |  Hold K: Flying Kick (2s)',
   'SPACE: Special  |  ENTER: Pause  |  ESC: This screen',
  ].forEach(l=>{ctx.fillText(l,cx,y);y+=15;});
  y+=10;bk(ctx,'PRESS SELECT / ESC TO CLOSE',cx,y,'bold 11px Rajdhani, sans-serif',COLORS.hiviz);
}

function drawVLS(ctx,d){
  const vlsCol=d.leaderColor||'#f44';
  ctx.fillStyle='rgba(20,0,0,0.8)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);const t=animTime,cx=CANVAS_W/2,cy=CANVAS_H/2;
  ctx.save();for(let i=0;i<16;i++){const angle=(i/16)*Math.PI*2+t*0.02,len=80+Math.sin(t*0.1+i)*20;ctx.globalAlpha=0.15+Math.sin(t*0.15+i*0.5)*0.08;ctx.strokeStyle=vlsCol;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*30,cy+Math.sin(angle)*20);ctx.lineTo(cx+Math.cos(angle)*len,cy+Math.sin(angle)*len*0.7);ctx.stroke();}ctx.restore();
  const pulse=40+Math.sin(t*0.12)*15;ctx.save();ctx.globalAlpha=0.2;ctx.strokeStyle=vlsCol;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,pulse,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,pulse+15,0,Math.PI*2);ctx.stroke();ctx.restore();
  const shk=3;const vlsText=d.leaderName+' TO VLS!';
  ctx.font='bold 36px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillText(vlsText,cx+3+(Math.random()-0.5)*shk,cy-8+3+(Math.random()-0.5)*shk);
  ctx.fillStyle=vlsCol;ctx.fillText(vlsText,cx+(Math.random()-0.5)*shk,cy-8+(Math.random()-0.5)*shk);
  ctx.font='bold 10px Rajdhani, sans-serif';ctx.fillStyle='#888';
  const freezeSec=d.isGuaranteed?'1 SECOND':'3 SECONDS';
  ctx.fillText('FROZEN FOR '+freezeSec,cx,cy+30);
}

// ===== HELP MECHANIC OVERLAYS =====
function drawHelpChoice(ctx){
  ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  const cx=CANVAS_W/2,cy=CANVAS_H/2;
  const flash=Math.sin(animTime*0.15);
  // Title
  ctx.font='bold 28px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.save();ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.lineJoin='round';
  ctx.strokeText('DO YOU NEED',cx,cy-45);ctx.strokeText('HELP?',cx,cy-10);
  ctx.fillStyle=flash>0?'#ff0':'#fa0';
  ctx.fillText('DO YOU NEED',cx,cy-45);ctx.fillText('HELP?',cx,cy-10);ctx.restore();
  // Options
  ctx.font='bold 16px Orbitron, monospace';
  ctx.fillStyle='#4f4';ctx.fillText('YES: PRESS A',cx,cy+30);
  ctx.fillStyle='#f44';ctx.fillText('NO: PRESS B',cx,cy+55);
}

function drawHelpNpcIntro(ctx,d){
  ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  const cx=CANVAS_W/2,cy=CANVAS_H/2;
  ctx.font='bold 22px Orbitron, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#fff';ctx.fillText('OK,',cx,cy-25);
  ctx.fillStyle=d.helperColor||'#4af';
  ctx.fillText(d.helperName+' IS COMING',cx,cy+10);
}

function drawHelpNpcAnimOverlay(ctx,d){
  ctx.save();
  // Phase-based screen effects
  if(d.phase==='approach'){
    // Darkening overlay, dramatic zoom feel
    ctx.globalAlpha=0.35;ctx.fillStyle='#000';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    // Speed lines from edges
    ctx.globalAlpha=0.15;ctx.strokeStyle=d.helperColor||'#4af';ctx.lineWidth=2;
    for(let i=0;i<8;i++){
      const ly=20+i*35;
      ctx.beginPath();ctx.moveTo(0,ly);ctx.lineTo(40+Math.random()*30,ly+(Math.random()-0.5)*10);ctx.stroke();
      ctx.beginPath();ctx.moveTo(CANVAS_W,ly);ctx.lineTo(CANVAS_W-40-Math.random()*30,ly+(Math.random()-0.5)*10);ctx.stroke();
    }
  }else if(d.phase==='strike'){
    ctx.globalAlpha=0.4;ctx.fillStyle='#000';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    // Flash on each of the 3 slash hit moments
    const slashDuration=30;
    const slashFrame=d.phaseTimer%slashDuration;
    const hitFrame=Math.round(slashDuration*0.6);
    // Flash around hit moment (3 frames before and after)
    const distFromHit=Math.abs(slashFrame-hitFrame);
    if(distFromHit<4&&d.strikeHits>0){
      ctx.globalAlpha=0.25*(1-distFromHit/4);ctx.fillStyle='#fff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }
    // Slash trails
    if(d.strikeHits>0){
      const ox=d.npcTargetX||CANVAS_W/2,oy=(d.npcY||GROUND_Y)-30;
      ctx.globalAlpha=0.12*d.strikeHits;ctx.strokeStyle=d.helperColor||'#4af';ctx.lineWidth=2;
      for(let i=0;i<d.strikeHits*3;i++){
        const a=Math.random()*Math.PI*2,r=15+Math.random()*25;
        ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+Math.cos(a)*r,oy+Math.sin(a)*r);ctx.stroke();
      }
    }
  }else if(d.phase==='impact'){
    // Bright white flash that fades
    const impactP=d.phaseTimer/90;
    ctx.globalAlpha=0.3;ctx.fillStyle='#000';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    if(impactP<0.2){ctx.globalAlpha=0.6*(1-impactP/0.2);ctx.fillStyle='#fff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);}
    // Impact burst lines from opponent position
    if(impactP<0.4){
      ctx.globalAlpha=0.5*(1-impactP/0.4);ctx.strokeStyle='#fff';ctx.lineWidth=3;
      for(let i=0;i<14;i++){
        const a=(i/14)*Math.PI*2;const r1=20;const r2=70+impactP*150;
        const ox=d.npcTargetX||CANVAS_W/2,oy=(d.npcY||GROUND_Y)-30;
        ctx.beginPath();ctx.moveTo(ox+Math.cos(a)*r1,oy+Math.sin(a)*r1);ctx.lineTo(ox+Math.cos(a)*r2,oy+Math.sin(a)*r2);ctx.stroke();
      }
    }
  }else if(d.phase==='exit'){
    ctx.globalAlpha=Math.max(0,0.25-d.phaseTimer*0.003);ctx.fillStyle='#000';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  }
  ctx.restore();
}
