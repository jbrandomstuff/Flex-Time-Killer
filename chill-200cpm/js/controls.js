// ============================================================
// CONTROLS — Keyboard + touch input for maze game
// Simplified from Loading Fighters (no special, no hold-to-charge)
// ============================================================

const state = {
  left:false, right:false, up:false, down:false,
  attackA:false, attackB:false, start:false, select:false,
  _attackA_prev:false, _attackB_prev:false,
  _start_prev:false, _select_prev:false,
};

export function justPressed(key) {
  return state[key] && !state['_'+key+'_prev'];
}

export function updatePrev() {
  state._attackA_prev = state.attackA;
  state._attackB_prev = state.attackB;
  state._start_prev = state.start;
  state._select_prev = state.select;
}

export function getInput() { return {...state}; }

const keyMap = {
  'KeyA':'left', 'KeyD':'right', 'KeyW':'up', 'KeyS':'down',
  'KeyJ':'attackA', 'KeyK':'attackB',
  'Enter':'start', 'Escape':'select',
};

function onKD(e) { const a=keyMap[e.code]; if(a){e.preventDefault();state[a]=true;} }
function onKU(e) { const a=keyMap[e.code]; if(a){e.preventDefault();state[a]=false;} }

function bindTouch(el, action) {
  const on=e=>{e.preventDefault();state[action]=true;};
  const off=e=>{e.preventDefault();state[action]=false;};
  el.addEventListener('touchstart',on,{passive:false});
  el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});
  el.addEventListener('mousedown',on);
  el.addEventListener('mouseup',off);
  el.addEventListener('mouseleave',off);
}

export function initControls() {
  window.addEventListener('keydown',onKD);
  window.addEventListener('keyup',onKU);
  ['up','down','left','right'].forEach(d=>{
    const el=document.querySelector(`[data-dir="${d}"]`);
    if(el) bindTouch(el,d);
  });
  const bA=document.querySelector('[data-btn="A"]');
  const bB=document.querySelector('[data-btn="B"]');
  if(bA) bindTouch(bA,'attackA');
  if(bB) bindTouch(bB,'attackB');
  const bSt=document.querySelector('[data-btn="start"]');
  const bSe=document.querySelector('[data-btn="select"]');
  if(bSt) bindTouch(bSt,'start');
  if(bSe) bindTouch(bSe,'select');
}
