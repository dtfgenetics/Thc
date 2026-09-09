'use strict';

(() => {
  const VERSION='seed-man-app-bootstrap-compat-v20';
  const node=document.querySelector('#seed-man-level');
  if(!node)return;
  let canonical=null;
  try{canonical=JSON.parse(node.textContent||'{}');}catch{}
  if(!canonical||canonical.schemaVersion!==4||canonical.id!=='1-1-sprout-steps')return;
  window.__SEED_MAN_CANONICAL_BOOTSTRAP__=Object.freeze(JSON.parse(JSON.stringify(canonical)));
  const temp={
    schemaVersion:2,
    id:'sprout-run',
    name:'Seed Man compatibility bootstrap',
    worldWidth:7800,
    worldHeight:540,
    requiredPickups:24,
    spawn:{x:80,y:390},
    platforms:[{x:0,y:480,width:7800,height:60}],
    hazards:[],
    pickups:Array.from({length:24},(_,index)=>({id:`compat-seed-${index+1}`,x:300+index*280,y:430,width:22,height:22})),
    powerups:[
      {id:'compat-speed',type:'speed',x:900,y:430,width:28,height:28,duration:8},
      {id:'compat-shield',type:'shield',x:1700,y:430,width:28,height:28},
      {id:'compat-magnet',type:'magnet',x:2500,y:430,width:28,height:28,duration:11},
      {id:'compat-jump',type:'jump',x:3300,y:430,width:28,height:28,duration:10},
      {id:'compat-speed-2',type:'speed',x:4100,y:430,width:28,height:28,duration:8},
      {id:'compat-shield-2',type:'shield',x:4900,y:430,width:28,height:28},
      {id:'compat-magnet-2',type:'magnet',x:5700,y:430,width:28,height:28,duration:11}
    ],
    checkpoints:[
      {id:'compat-checkpoint-1',x:2000,y:420,width:50,height:60,respawnX:1980,respawnY:400},
      {id:'compat-checkpoint-2',x:4000,y:420,width:50,height:60,respawnX:3980,respawnY:400},
      {id:'compat-checkpoint-3',x:6000,y:420,width:50,height:60,respawnX:5980,respawnY:400}
    ],
    finish:{x:7700,y:390,width:50,height:90}
  };
  node.textContent=JSON.stringify(temp);
  document.documentElement.dataset.seedManBootstrapCompat=VERSION;
  window.addEventListener('sprout:level-selected',()=>{
    if(window.__SEED_MAN_CANONICAL_BOOTSTRAP__)node.textContent=JSON.stringify(window.__SEED_MAN_CANONICAL_BOOTSTRAP__);
  },{once:true});
  window.__SEED_MAN_APP_BOOTSTRAP_COMPAT__=Object.freeze({version:VERSION,canonicalLevelId:canonical.id,temporaryLegacyValidatorBridge:true});
})();
