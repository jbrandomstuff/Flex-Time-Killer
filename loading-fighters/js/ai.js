import { AI_LEVELS, SPECIAL, CANVAS_W, FIREBALL } from './constants.js';
import { STATE } from './player.js';

export class AI {
  constructor(level=0){
    this.setLevel(level);
    this.thinkTimer=0;this.comboQueue=[];this.strafeDir=0;this.engageTimer=0;this.farTimer=0;
    this.noDamageForced=false; // set by main.js when 15s no-damage triggers
    // Fireball tracking (same cooldown as player)
    this.consecutiveFireballs=0;
    this.fireballCooldownTimer=0;
  }
  setLevel(level){
    this.level=Math.min(level,AI_LEVELS.length-1);this.config=AI_LEVELS[this.level];
    this.comboQueue=[];this.farTimer=0;
    this.consecutiveFireballs=0;this.fireballCooldownTimer=0;
  }

  getInput(self,opponent,currentMaxHP){
    const input={left:false,right:false,up:false,down:false,attackA:false,attackB:false,special:false,distantSlash:false,flyingKick:false,fireball:false};
    if(self.state===STATE.KO||self.state===STATE.FROZEN)return input;
    const cfg=this.config;
    const dist=Math.abs(self.x-opponent.x);
    const opRight=self.x<opponent.x;
    const sRange=60,dRange=80;
    const hpRatio=self.hp/(currentMaxHP||300);
    const distantChance=this.level>=2?0.03*(this.level-1):0;

    // Fireball cooldown tick
    if(this.fireballCooldownTimer>0)this.fireballCooldownTimer--;

    this.thinkTimer++;
    if(this.thinkTimer<cfg.reactionTime)return input;

    // === NO-DAMAGE FORCED ENGAGE (set by main.js) ===
    if(this.noDamageForced){
      input.right=opRight;input.left=!opRight;
      if(dist<sRange){
        if(Math.random()<0.6)input.attackA=true;else input.attackB=true;
      }
      if(Math.random()<0.05)input.up=true;
      this.thinkTimer=0;return input;
    }

    // === SPECIAL ACTIVE: always rush + always attack ===
    if(self.specialActive){
      input.right=opRight;input.left=!opRight;
      if(dist<sRange){
        if(Math.random()<0.6)input.attackA=true;else input.attackB=true;
        if(Math.random()<cfg.comboSkill)this.comboQueue.push('kick','sword');
      }
      if(Math.random()<0.08)input.up=true;
      this.thinkTimer=0;return input;
    }

    // Execute queued combo — BUT clear if opponent moved out of range
    if(this.comboQueue.length>0&&self.canAct){
      if(dist>sRange+20){
        // Opponent escaped — clear combo, approach instead
        this.comboQueue=[];
      }else{
        const next=this.comboQueue.shift();
        if(next==='sword')input.attackA=true;else if(next==='kick')input.attackB=true;else if(next==='block')input.down=true;
        this.thinkTimer=Math.floor(cfg.reactionTime*0.3);return input;
      }
    }

    // Special
    if(self.specialCharge>=SPECIAL.maxCharge&&!self.specialActive&&Math.random()<cfg.specialUseChance){
      input.special=true;this.thinkTimer=0;return input;
    }

    // Block incoming
    if(opponent.isAttacking&&dist<dRange&&Math.random()<cfg.blockChance){
      input.down=true;
      if(Math.random()<cfg.punishAbility*0.5)this.comboQueue.push('sword');
      return input;
    }

    // Punish whiffs
    if(opponent.isAttacking&&!opponent.hitboxActive&&dist<sRange+20&&Math.random()<cfg.punishAbility){
      if(dist>45){input.right=opRight;input.left=!opRight;}
      input.attackA=true;
      if(Math.random()<cfg.comboSkill)this.comboQueue.push('kick','sword');
      this.thinkTimer=0;return input;
    }

    // === MID HP (17%-50%): approach if player isn't coming to us ===
    if(hpRatio>=0.17&&hpRatio<=0.50&&dist>sRange){
      const playerApproaching=(opRight&&opponent.vx>0.5)||(!opRight&&opponent.vx<-0.5);
      if(!playerApproaching){
        input.right=opRight;input.left=!opRight;
        if(dist<sRange+15&&Math.random()<cfg.aggression*0.6)input.attackA=true;
        if(Math.random()<cfg.jumpChance)input.up=true;
        this.thinkTimer=0;return input;
      }
    }

    // Low HP — still aggressive, slight caution
    if(hpRatio<0.17&&Math.random()<cfg.retreatSkill){
      if(Math.random()<0.25){
        input.left=opRight;input.right=!opRight;
        if(dist<45)input.attackB=true;
      } else {
        if(dist<sRange){input.attackA=Math.random()>0.5;input.attackB=!input.attackA;
          if(Math.random()<cfg.comboSkill)this.comboQueue.push('kick','sword');}
        else{input.right=opRight;input.left=!opRight;}
      }
      this.thinkTimer=0;return input;
    }

    // === FIREBALL (Lv3+, tap-A equivalent at distance) ===
    if(this.level>=2&&dist>sRange&&dist<250&&self.canAct&&this.fireballCooldownTimer<=0){
      // Fireball chance scales with level
      const fbChance=0.02+this.level*0.015;
      if(Math.random()<fbChance){
        input.fireball=true;
        this.consecutiveFireballs++;
        if(this.consecutiveFireballs>=FIREBALL.maxConsecutive){
          this.fireballCooldownTimer=FIREBALL.cooldown;
          this.consecutiveFireballs=0;
        }
        this.thinkTimer=0;return input;
      }
    }

    // Distant attacks (hold A) — level 3+ uses ranged attacks at medium-far distance
    if(distantChance>0&&dist>80&&dist<250&&self.canAct){
      if(Math.random()<distantChance*1.5){
        input.distantSlash=true;this.thinkTimer=0;return input;
      }
      if(Math.random()<distantChance*0.5&&dist>120){
        input.flyingKick=true;this.thinkTimer=0;return input;
      }
    }

    // Track time spent far apart. If 6s passes, force approach.
    if(dist>100){this.farTimer++;}else{this.farTimer=0;}
    const forcedApproach=this.farTimer>=360; // 6 seconds at 60fps

    // Approach bias
    if(dist>sRange&&(Math.random()<cfg.approachBias||forcedApproach)){
      input.right=opRight;input.left=!opRight;
      if(dist<sRange+20&&Math.random()<cfg.aggression*0.6)input.attackA=true;
      if(Math.random()<cfg.jumpChance)input.up=true;
      if(forcedApproach)this.farTimer=300; // keep pushing but allow brief pauses
      this.thinkTimer=0;return input;
    }

    // Attack in range
    if(dist<sRange&&self.canAct&&Math.random()<cfg.aggression){
      if(Math.random()<cfg.comboSkill){
        const combos=[['kick','kick','sword'],['sword','kick'],['kick','sword','kick'],['sword','sword']];
        const combo=combos[Math.floor(Math.random()*combos.length)];
        input.attackA=combo[0]==='sword';input.attackB=combo[0]==='kick';
        this.comboQueue.push(...combo.slice(1));
      }else{
        if(Math.random()<cfg.attackMix)input.attackB=true;else input.attackA=true;
      }
      this.thinkTimer=0;return input;
    }

    // Spacing
    if(Math.random()<cfg.spacingSkill){
      this.engageTimer--;
      if(this.engageTimer<=0){
        this.engageTimer=10+Math.floor(Math.random()*20);
        if(dist>70)this.strafeDir=opRight?1:-1;
        else if(dist<35)this.strafeDir=opRight?-1:1;
        else this.strafeDir=Math.random()<0.3?0:(Math.random()<0.5?1:-1);
      }
      if(this.strafeDir===1)input.right=true;else if(this.strafeDir===-1)input.left=true;
      if(Math.random()<cfg.jumpChance*2){input.up=true;if(dist<50&&Math.random()<0.3){input.right=!opRight;input.left=opRight;}}
    }

    // Fallback approach
    if(!input.left&&!input.right&&!input.attackA&&!input.attackB&&!input.down&&dist>50){
      if(Math.random()<cfg.approachBias*0.5){input.right=opRight;input.left=!opRight;}
    }

    // Wall escape
    if((self.x<40||self.x>CANVAS_W-40)&&Math.random()<0.35){
      input.up=true;input.right=self.x<CANVAS_W/2;input.left=self.x>=CANVAS_W/2;
    }

    return input;
  }
}
