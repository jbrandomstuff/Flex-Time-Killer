import {
  GRAVITY,GROUND_Y,MOVE_SPEED,JUMP_FORCE,KNOCKBACK_FORCE,MAX_HP,ATTACKS,BLOCK_DAMAGE_MULT,
  BLOCK_STUN,BLOCK_SPECIAL_FLAT_BONUS,CANVAS_W,FIGHTER,COMBO_KNOCKBACK_THRESHOLD,COMBO_KNOCKBACK_HITSTUN,
  SPECIAL,DISTANT_ATTACK,DOUBLE_JUMP,POSITION_SWITCH,FLYING_KICK,KICK_COMBO,FIREBALL,
} from './constants.js';

export const STATE = {
  IDLE:'idle',WALK:'walk',JUMP:'jump',BLOCK:'block',
  ATTACK_SWORD:'attack_sword',ATTACK_KICK:'attack_kick',
  HITSTUN:'hitstun',BLOCKSTUN:'blockstun',KO:'ko',
  FROZEN:'frozen',CHARGING:'charging',CHARGING_KICK:'charging_kick',
  DASH_KICK:'dash_kick',
};

export class Player {
  constructor(x,facingRight,color,faceImgSrc){
    this.startX=x;this.x=x;this.y=GROUND_Y;this.vx=0;this.vy=0;
    this.facingRight=facingRight;this.color=color;
    this.faceImg=new Image();this.faceImg.src=faceImgSrc;
    this.hp=MAX_HP;this.wins=0;this.state=STATE.IDLE;this.stateTimer=0;
    this.attackFrame=0;this.attackData=null;this.hitConnected=false;this.flashTimer=0;
    this.moveSpeed=MOVE_SPEED;this.swordVariation=0;this.kickVariation=0;
    this.consecutiveHitsReceived=0;this.consecutiveHitsDealt=0;this.attackHistory=[];
    this.jumpsUsed=0;this.maxJumps=2;
    this.chargeFrames=0;this.isCharging=false;
    this.kickChargeFrames=0;this.isChargingKick=false;
    this.dashKickTarget=null;
    this.dashKickHit=false;
    this.specialCharge=0;this.specialActive=false;this.specialTimer=0;this.specialName='';
    this.specialActivatedAt=0;
    this.consecutiveKicks=0;
    this.consecutiveFireballs=0;
    this.fireballCooldownTimer=0;
    this.stats=this.freshStats();this.aiName='';this.displayName='';this.specialLabel='';
  }
  freshStats(){return{damageTaken:0,kickDamageDealt:0,swordDamageDealt:0,blockedSpecial:false,usedSpecial:false,jumpCount:0};}
  resetStats(){this.stats=this.freshStats();}
  reset(){
    this.x=this.startX;this.y=GROUND_Y;this.vx=0;this.vy=0;this.hp=MAX_HP;
    this.state=STATE.IDLE;this.stateTimer=0;this.attackFrame=0;this.attackData=null;
    this.hitConnected=false;this.flashTimer=0;this.consecutiveHitsReceived=0;
    this.consecutiveHitsDealt=0;this.attackHistory=[];this.jumpsUsed=0;
    this.chargeFrames=0;this.isCharging=false;
    this.kickChargeFrames=0;this.isChargingKick=false;
    this.dashKickTarget=null;this.dashKickHit=false;
    this.specialActive=false;this.specialTimer=0;this.specialActivatedAt=0;this.specialName='';
    this.consecutiveKicks=0;
    this.consecutiveFireballs=0;this.fireballCooldownTimer=0;
  }
  get isGrounded(){return this.y>=GROUND_Y;}
  get isAttacking(){return this.state===STATE.ATTACK_SWORD||this.state===STATE.ATTACK_KICK;}
  get isDashing(){return this.state===STATE.DASH_KICK;}
  get isStunned(){return this.state===STATE.HITSTUN||this.state===STATE.BLOCKSTUN;}
  get isFrozen(){return this.state===STATE.FROZEN;}
  get canAct(){return!this.isAttacking&&!this.isStunned&&this.state!==STATE.KO&&!this.isFrozen&&this.state!==STATE.CHARGING&&this.state!==STATE.CHARGING_KICK&&!this.isDashing;}
  get hitboxActive(){if(!this.attackData)return false;return this.attackFrame>=this.attackData.startup&&this.attackFrame<this.attackData.startup+this.attackData.active;}

  getHitbox(){
    if(!this.hitboxActive)return null;
    let r=this.attackData.range;
    // Guangchi special: +25% range on ALL attacks (sword + kick)
    if(this.specialActive&&this.specialName==='ABALONE MOTIVATION'){
      r=Math.round(r*SPECIAL.playerRangeMult);
    }
    return{x:this.facingRight?this.x:this.x-r,y:this.y-50,w:r,h:45};
  }
  getHurtbox(){return{x:this.x-FIGHTER.hurtboxW/2,y:this.y-FIGHTER.hurtboxH,w:FIGHTER.hurtboxW,h:FIGHTER.hurtboxH};}

  getKickComboDamage(){
    const idx=Math.min(this.consecutiveKicks,KICK_COMBO.kickDamages.length-1);
    return KICK_COMBO.kickDamages[idx];
  }

  startAttack(type){
    if(!this.canAct)return;
    if(type==='sword'){
      this.state=STATE.ATTACK_SWORD;this.attackData={...ATTACKS.sword};this.swordVariation=(this.swordVariation+1)%3;
      this.consecutiveKicks=0;
    }
    else{
      this.state=STATE.ATTACK_KICK;this.attackData={...ATTACKS.kick};this.kickVariation=(this.kickVariation+1)%3;
      this.attackData.damage=this.getKickComboDamage();
    }
    if(this.specialActive&&this.specialName==='ABALONE MOTIVATION')this.attackData.damage=Math.round(this.attackData.damage*SPECIAL.playerDamageMult);
    if(this.specialActive&&this.specialName==='REDBULL RECHARGE'){
      const m=SPECIAL.redbullAttackSpeedMult;
      this.attackData.startup=Math.max(1,Math.round(this.attackData.startup*m));
      this.attackData.active=Math.max(2,Math.round(this.attackData.active*m));
      this.attackData.recovery=Math.max(1,Math.round(this.attackData.recovery*m));
    }
    this.attackFrame=0;this.hitConnected=false;
    this.attackHistory.push(type);if(this.attackHistory.length>3)this.attackHistory.shift();
  }

  startDashKick(opponent){
    if(this.state!==STATE.CHARGING_KICK&&!this.canAct)return false;
    this.state=STATE.DASH_KICK;
    this.dashKickTarget=opponent;
    this.dashKickHit=false;
    this.facingRight=this.x<opponent.x;
    this.consecutiveKicks=0;
    return true;
  }

  checkPositionSwitchCombo(){
    if(this.attackHistory.length<3)return false;
    const l=this.attackHistory.slice(-3);
    for(const c of POSITION_SWITCH.combos){if(l[0]===c[0]&&l[1]===c[1]&&l[2]===c[2]){this.attackHistory=[];return true;}}
    return false;
  }
  checkConsecutiveSwitch(){if(this.consecutiveHitsDealt>=POSITION_SWITCH.consecutiveThreshold){this.consecutiveHitsDealt=0;return true;}return false;}

  releaseCharge(){const f=this.chargeFrames>=DISTANT_ATTACK.chargeTime;this.chargeFrames=0;this.isCharging=false;this.state=STATE.IDLE;return f;}
  releaseKickCharge(){const f=this.kickChargeFrames>=FLYING_KICK.chargeTime;this.kickChargeFrames=0;this.isChargingKick=false;this.state=STATE.IDLE;return f;}

  canFireball(){
    if(this.fireballCooldownTimer>0)return false;
    return true;
  }
  onFireball(){
    this.consecutiveFireballs++;
    if(this.consecutiveFireballs>=FIREBALL.maxConsecutive){
      this.fireballCooldownTimer=FIREBALL.cooldown;
      this.consecutiveFireballs=0;
    }
    this.consecutiveKicks=0;
  }

  activateSpecial(name,globalFrame){
    if(this.specialCharge<SPECIAL.maxCharge)return false;
    this.specialActive=true;
    this.specialTimer=name==='ABALONE MOTIVATION'?SPECIAL.playerDuration:SPECIAL.aiDuration;
    this.specialName=name;this.specialCharge=0;this.stats.usedSpecial=true;
    this.specialActivatedAt=globalFrame||0;
    return true;
  }

  addSpecialCharge(d){
    if(this.specialActive)return;
    this.specialCharge=Math.min(this.specialCharge+d,SPECIAL.maxCharge);
  }

  freeze(duration){this.state=STATE.FROZEN;this.stateTimer=duration;this.vx=0;}

  applyHit(attackData,fromRight,attackerSpecialActive){
    if(this.isCharging||this.state===STATE.CHARGING){this.chargeFrames=0;this.isCharging=false;}
    if(this.isChargingKick||this.state===STATE.CHARGING_KICK){this.kickChargeFrames=0;this.isChargingKick=false;}
    if(this.isDashing){this.state=STATE.IDLE;this.dashKickTarget=null;}
    this.consecutiveKicks=0;

    // Guangchi special defense: take 50% less damage
    let dmg=attackData.damage;
    if(this.specialActive&&this.specialName==='ABALONE MOTIVATION'){
      dmg=Math.round(dmg*SPECIAL.playerDefenseMult);
    }

    if(this.isFrozen){this.hp-=dmg;this.stats.damageTaken+=dmg;this.flashTimer=8;if(this.hp<=0){this.hp=0;this.state=STATE.KO;}return'hit';}
    if(this.state===STATE.BLOCK){
      this.state=STATE.BLOCKSTUN;this.stateTimer=BLOCK_STUN;
      let blockMult=BLOCK_DAMAGE_MULT;
      if(attackData.blockPenetration)blockMult=BLOCK_DAMAGE_MULT+attackData.blockPenetration*(1-BLOCK_DAMAGE_MULT);
      let blockDmg=attackData.type==='flyingkick'?FLYING_KICK.blockDamage:Math.round(dmg*blockMult);
      if(attackerSpecialActive&&attackData.type!=='flyingkick')blockDmg+=BLOCK_SPECIAL_FLAT_BONUS;
      this.hp-=blockDmg;this.consecutiveHitsReceived=0;
      if(attackerSpecialActive)this.stats.blockedSpecial=true;return'blocked';
    }
    this.consecutiveHitsReceived++;
    const isCombo=this.consecutiveHitsReceived>=COMBO_KNOCKBACK_THRESHOLD;
    this.state=STATE.HITSTUN;this.stateTimer=isCombo?COMBO_KNOCKBACK_HITSTUN:attackData.hitstun;
    this.hp-=dmg;this.stats.damageTaken+=dmg;this.flashTimer=8;
    if(isCombo){this.vx=fromRight?-KNOCKBACK_FORCE:KNOCKBACK_FORCE;this.consecutiveHitsReceived=0;}
    if(this.hp<=0){this.hp=0;this.state=STATE.KO;}
    return isCombo?'combo_knockback':'hit';
  }

  update(input,opponent){
    if(this.canAct)this.facingRight=this.x<opponent.x;
    if(this.specialActive){this.specialTimer--;if(this.specialTimer<=0){this.specialActive=false;this.specialName='';}}
    if(this.fireballCooldownTimer>0)this.fireballCooldownTimer--;
    switch(this.state){
      case STATE.IDLE:case STATE.WALK:this.handleMovement(input);this.handleActions(input);break;
      case STATE.JUMP:
        this.handleAirMovement(input);this.handleAirActions(input);
        if(input.up&&!input._up_prev&&this.jumpsUsed<this.maxJumps){this.vy=DOUBLE_JUMP.force;this.jumpsUsed++;this.stats.jumpCount++;}
        break;
      case STATE.BLOCK:if(!input.down)this.state=STATE.IDLE;this.vx*=0.8;break;
      case STATE.CHARGING:this.chargeFrames++;this.vx*=0.9;if(!input.rawAttackA)this.releaseCharge();break;
      case STATE.CHARGING_KICK:this.kickChargeFrames++;this.vx*=0.9;if(!input.rawAttackB)this.releaseKickCharge();break;
      case STATE.DASH_KICK:
        if(this.dashKickTarget){
          const dir=this.facingRight?1:-1;
          this.vx=dir*FLYING_KICK.dashSpeed;
          this.vy=-1;
          const tDist=Math.abs(this.x-this.dashKickTarget.x);
          if(tDist<35&&!this.dashKickHit){this.dashKickHit=true;this.stateTimer=4;}
          if(this.dashKickHit){this.stateTimer--;this.vx*=0.7;if(this.stateTimer<=0){this.state=STATE.IDLE;this.dashKickTarget=null;}}
          if(this.x<10||this.x>CANVAS_W-10){this.state=STATE.IDLE;this.dashKickTarget=null;this.vx=0;}
        }else{this.state=STATE.IDLE;}
        break;
      case STATE.ATTACK_SWORD:case STATE.ATTACK_KICK:
        this.attackFrame++;
        if(this.attackFrame>=this.attackData.startup+this.attackData.active+this.attackData.recovery){
          this.state=this.isGrounded?STATE.IDLE:STATE.JUMP;this.attackData=null;this.attackFrame=0;}
        this.vx*=0.85;break;
      case STATE.HITSTUN:case STATE.BLOCKSTUN:
        this.stateTimer--;if(this.stateTimer<=0){this.state=this.isGrounded?STATE.IDLE:STATE.JUMP;this.consecutiveHitsReceived=0;}
        this.vx*=0.88;break;
      case STATE.FROZEN:this.stateTimer--;this.vx=0;if(this.stateTimer<=0)this.state=STATE.IDLE;break;
      case STATE.KO:this.vx*=0.9;break;
    }
    this.x+=this.vx;this.vy+=GRAVITY;this.y+=this.vy;
    if(this.y>=GROUND_Y){this.y=GROUND_Y;this.vy=0;this.jumpsUsed=0;if(this.state===STATE.JUMP)this.state=STATE.IDLE;}
    if(this.x<15){this.x=15;this.vx=0;}if(this.x>CANVAS_W-15){this.x=CANVAS_W-15;this.vx=0;}
    if(this.flashTimer>0)this.flashTimer--;
  }
  handleMovement(input){
    let mv=false;
    if(input.left){this.vx=-this.moveSpeed;mv=true;}else if(input.right){this.vx=this.moveSpeed;mv=true;}else this.vx*=0.7;
    if(input.up&&this.isGrounded){this.vy=JUMP_FORCE;this.state=STATE.JUMP;this.jumpsUsed=1;this.stats.jumpCount++;return;}
    if(input.down){this.state=STATE.BLOCK;return;}
    this.state=mv?STATE.WALK:STATE.IDLE;
  }
  handleActions(input){if(input.attackA)this.startAttack('sword');else if(input.attackB)this.startAttack('kick');}
  handleAirMovement(input){if(input.left)this.vx=-this.moveSpeed*0.7;else if(input.right)this.vx=this.moveSpeed*0.7;}
  handleAirActions(input){if(input.attackA)this.startAttack('sword');else if(input.attackB)this.startAttack('kick');}
}
