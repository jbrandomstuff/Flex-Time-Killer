const state = {
  left:false,right:false,up:false,down:false,
  attackA:false,attackB:false,start:false,select:false,special:false,
  attackA_holdFrames:0, attackB_holdFrames:0,
  _attackA_prev:false,_attackB_prev:false,_start_prev:false,
  _select_prev:false,_special_prev:false,_up_prev:false,
};
let specialQueued=false;
export function justPressed(key){if(key==='special'&&specialQueued)return true;return state[key]&&!state['_'+key+'_prev'];}
export function justReleased(key){return!state[key]&&state['_'+key+'_prev'];}
export function updatePrev(){
  state._attackA_prev=state.attackA;state._attackB_prev=state.attackB;
  state._start_prev=state.start;state._select_prev=state.select;
  state._special_prev=state.special;state._up_prev=state.up;
  specialQueued=false;
  if(state.attackA)state.attackA_holdFrames++;else state.attackA_holdFrames=0;
  if(state.attackB)state.attackB_holdFrames++;else state.attackB_holdFrames=0;
}
export function getInput(){return{...state};}
export function getHoldA(){return state.attackA_holdFrames;}
export function getHoldB(){return state.attackB_holdFrames;}
const keyMap={'KeyA':'left','KeyD':'right','KeyW':'up','KeyS':'down','KeyJ':'attackA','KeyK':'attackB','Enter':'start','Escape':'select','Space':'special'};
function onKD(e){const a=keyMap[e.code];if(a){e.preventDefault();state[a]=true;}}
function onKU(e){const a=keyMap[e.code];if(a){e.preventDefault();state[a]=false;}}
function bindTouch(el,action){
  const on=e=>{e.preventDefault();state[action]=true;},off=e=>{e.preventDefault();state[action]=false;};
  el.addEventListener('touchstart',on,{passive:false});el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});el.addEventListener('mousedown',on);el.addEventListener('mouseup',off);el.addEventListener('mouseleave',off);
}
function bindSpecialBar(el){
  const fire=e=>{e.preventDefault();e.stopPropagation();state.special=true;specialQueued=true;setTimeout(()=>{state.special=false;},100);};
  el.addEventListener('touchstart',fire,{passive:false});el.addEventListener('mousedown',fire);
}
export function initControls(){
  window.addEventListener('keydown',onKD);window.addEventListener('keyup',onKU);
  ['up','down','left','right'].forEach(d=>{const el=document.querySelector(`[data-dir="${d}"]`);if(el)bindTouch(el,d);});
  const bA=document.querySelector('[data-btn="A"]'),bB=document.querySelector('[data-btn="B"]');
  if(bA)bindTouch(bA,'attackA');if(bB)bindTouch(bB,'attackB');
  const bSt=document.querySelector('[data-btn="start"]'),bSe=document.querySelector('[data-btn="select"]');
  if(bSt)bindTouch(bSt,'start');if(bSe)bindTouch(bSe,'select');
  const sp=document.getElementById('specialBarTouch');if(sp)bindSpecialBar(sp);
}
