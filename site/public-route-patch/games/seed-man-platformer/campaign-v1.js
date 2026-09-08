'use strict';

const SPROUT_CAMPAIGN_RUNTIME_VERSION='seed-man-campaign-20-v1';
const SPROUT_PROGRESS_KEY='dtf-seed-man-campaign-20-v1';

const SPROUT_CAMPAIGN_MANIFEST=Object.freeze({
  schemaVersion:3,id:'sprout-run-campaign',title:'Seed Man: Grow. Fight. Restore.',defaultLevelId:'1-1-sprout-steps',levelCount:20,finalBoss:'blight-king',worlds:[
    {id:'world-01',title:'Greenhouse Valley',visualWorldKey:'greenhouse-valley',order:1,levels:[['1-1-sprout-steps','Sprout Steps'],['1-2-sunny-glade','Sunny Glade'],['1-3-waterfall-way','Waterfall Way'],['1-4-greenhouse-hub','Greenhouse Hub','overgrown-guardian']]},
    {id:'world-02',title:'Forest Ruins',visualWorldKey:'forest-ruins',order:2,levels:[['2-1-mossy-paths','Mossy Paths'],['2-2-broken-bridges','Broken Bridges'],['2-3-hollow-trunk','Hollow Trunk'],['2-4-temple-of-trees','Temple of Trees','ancient-dryad']]},
    {id:'world-03',title:'Desert Canyon',visualWorldKey:'desert-canyon',order:3,levels:[['3-1-red-rock-run','Red Rock Run'],['3-2-canyon-cliffs','Canyon Cliffs'],['3-3-dusty-winds','Dusty Winds'],['3-4-sun-spire','Sun Spire','scorchroot-titan']]},
    {id:'world-04',title:'Frozen Peaks',visualWorldKey:'frozen-peak',order:4,levels:[['4-1-icy-pass','Icy Pass'],['4-2-crystal-caverns','Crystal Caverns'],['4-3-frozen-bridges','Frozen Bridges'],['4-4-glacier-gate','Glacier Gate','frostbite-colossus']]},
    {id:'world-05',title:'Eco City',visualWorldKey:'eco-city',order:5,levels:[['5-1-toxic-outskirts','Toxic Outskirts'],['5-2-industrial-zone','Industrial Zone'],['5-3-reactor-core','Reactor Core','eco-sentinel'],['5-4-the-last-seed','The Last Seed','blight-king']]}
  ].map(world=>Object.freeze({...world,levels:Object.freeze(world.levels.map((row,index)=>Object.freeze({id:row[0],title:row[1],boss:row[2]||null,order:(world.order-1)*4+index+1,status:'playable',visualWorldKey:world.visualWorldKey,worldId:world.id,worldTitle:world.title,worldOrder:world.order,finalBoss:row[2]==='blight-king',phases:row[2]==='blight-king'?4:undefined})))}))
});

const LEVEL_META=Object.freeze({
'1-1-sprout-steps':{length:6200,checkpoints:2,enemies:['sproutling','root-crawler'],hazards:['spikes'],mechanic:'run-double-jump'},
'1-2-sunny-glade':{length:6800,checkpoints:2,enemies:['sproutling','root-crawler','toxic-spore'],hazards:['spikes','toxic-slime'],mechanic:'moving-platforms'},
'1-3-waterfall-way':{length:7200,checkpoints:3,enemies:['sproutling','drone-bot','sky-wasp'],hazards:['waterfall-gap'],mechanic:'springs'},
'1-4-greenhouse-hub':{length:5200,checkpoints:2,enemies:['thorn-beetle','spike-plant'],hazards:['spikes'],mechanic:'arena-lock'},
'2-1-mossy-paths':{length:7000,checkpoints:2,enemies:['root-crawler','toxic-spore','spike-plant'],hazards:['thorn-pits'],mechanic:'vine-platforms'},
'2-2-broken-bridges':{length:7600,checkpoints:3,enemies:['root-crawler','sky-wasp','thorn-beetle'],hazards:['falling-bridges'],mechanic:'collapsing-platforms'},
'2-3-hollow-trunk':{length:7800,checkpoints:3,enemies:['toxic-spore','bone-weed','shadow-root'],hazards:['spore-cloud'],mechanic:'teleport-roots'},
'2-4-temple-of-trees':{length:5600,checkpoints:2,enemies:['spike-plant','shadow-root'],hazards:['root-cage'],mechanic:'arena-lock'},
'3-1-red-rock-run':{length:7400,checkpoints:2,enemies:['thorn-beetle','drone-bot'],hazards:['lava','rockfall'],mechanic:'heat-updraft'},
'3-2-canyon-cliffs':{length:8000,checkpoints:3,enemies:['sky-wasp','thorn-beetle','sludge-monster'],hazards:['falling-rocks'],mechanic:'moving-platforms'},
'3-3-dusty-winds':{length:8200,checkpoints:3,enemies:['sky-wasp','bone-weed','drone-bot'],hazards:['sandstorm'],mechanic:'wind-zones'},
'3-4-sun-spire':{length:5800,checkpoints:2,enemies:['thorn-beetle','sludge-monster'],hazards:['lava'],mechanic:'arena-lock'},
'4-1-icy-pass':{length:7600,checkpoints:2,enemies:['root-crawler','sky-wasp','drone-bot'],hazards:['ice-spikes'],mechanic:'slippery-ground'},
'4-2-crystal-caverns':{length:8200,checkpoints:3,enemies:['toxic-spore','bone-weed','drone-bot'],hazards:['falling-icicles'],mechanic:'crystal-bounce'},
'4-3-frozen-bridges':{length:8400,checkpoints:3,enemies:['sky-wasp','thorn-beetle','shadow-root'],hazards:['breakaway-ice'],mechanic:'collapsing-platforms'},
'4-4-glacier-gate':{length:6000,checkpoints:2,enemies:['spike-plant','shadow-root'],hazards:['freeze-floor'],mechanic:'arena-lock'},
'5-1-toxic-outskirts':{length:8000,checkpoints:3,enemies:['toxic-spore','drone-bot','sludge-monster'],hazards:['toxic-slime','electric-floor'],mechanic:'conveyor-platforms'},
'5-2-industrial-zone':{length:8600,checkpoints:3,enemies:['drone-bot','thorn-beetle','shadow-root'],hazards:['laser-grid','crusher'],mechanic:'timed-doors'},
'5-3-reactor-core':{length:6800,checkpoints:2,enemies:['drone-bot','spike-plant','sludge-monster'],hazards:['energy-beam','electric-floor'],mechanic:'arena-lock'},
'5-4-the-last-seed':{length:7200,checkpoints:3,enemies:['shadow-root','drone-bot','sludge-monster'],hazards:['pollution-wave','toxic-slime'],mechanic:'final-gauntlet'}
});

function flatCampaignLevels(){return SPROUT_CAMPAIGN_MANIFEST.worlds.flatMap(w=>w.levels);}
function readProgress(){try{return JSON.parse(localStorage.getItem(SPROUT_PROGRESS_KEY)||'{}')}catch{return{}}}
function writeProgress(value){try{localStorage.setItem(SPROUT_PROGRESS_KEY,JSON.stringify(value))}catch{}}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

function generatedPlatforms(width,order,boss){
  const platforms=[];const hazards=[];let x=0;let segment=0;
  const gapBase=82+Math.min(44,order*2);
  const arenaStart=boss?width-980:width;
  while(x<arenaStart){
    const segW=Math.min(520+(segment%3)*70,arenaStart-x);
    platforms.push({x,y:480,width:segW,height:60,kind:'ground'});
    if(segment%2===0){platforms.push({x:x+Math.min(150,segW*.28),y:365-(segment%3)*38,width:170+(segment%2)*30,height:24,kind:'platform'});}
    if(segment%3===1){platforms.push({x:x+Math.min(280,segW*.5),y:285+(segment%2)*45,width:150,height:22,kind:'platform'});}
    x+=segW;
    if(x<arenaStart-160){const gap=gapBase+(segment%3)*16;hazards.push({x,y:500,width:gap,height:40,kind:'hazard'});x+=gap;}
    segment+=1;
  }
  if(boss){platforms.push({x:arenaStart,y:480,width:width-arenaStart,height:60,kind:'boss-arena'});}
  return{platforms,hazards};
}
function generatedPickups(width,order,boss){
  const count=18+Math.min(12,Math.floor(order/2));const pickups=[];const end=boss?width-1100:width-220;
  for(let i=0;i<count;i+=1){const t=(i+1)/(count+1);pickups.push({id:`seed-${order}-${i+1}`,x:180+t*(end-260),y:300-(i%3)*48,width:22,height:22});}
  return pickups;
}
function generatedPowerups(width,order){
  const types=['speed','shield','magnet','jump'];return types.map((type,i)=>({id:`power-${order}-${type}`,type,x:Math.round(width*(.2+i*.18)),y:330-(i%2)*55,width:28,height:28,duration:type==='shield'?undefined:10}));
}
function generatedCheckpoints(width,count,order,boss){
  const limit=boss?width-1150:width-380;return Array.from({length:count},(_,i)=>{const x=Math.round(limit*((i+1)/(count+1)));return{id:`checkpoint-${order}-${i+1}`,x,y:420,width:50,height:60,respawnX:Math.max(40,x-20),respawnY:400};});
}
function generatedMechanicZones(width,meta,order){
  if(!meta.mechanic||['run-double-jump','arena-lock','final-gauntlet'].includes(meta.mechanic))return[];
  return Array.from({length:3},(_,i)=>({id:`mechanic-${order}-${i+1}`,type:meta.mechanic,x:Math.round(width*(.25+i*.2)),y:260,width:260,height:220}));
}
function buildLevel(entry){
  const meta=LEVEL_META[entry.id];if(!meta)throw new Error(`Missing 20-level metadata: ${entry.id}`);
  const width=meta.length;const layout=generatedPlatforms(width,entry.order,entry.boss);const pickups=generatedPickups(width,entry.order,entry.boss);
  const boss=entry.boss?{id:entry.boss,name:entry.boss.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' '),x:width-620,y:382,width:entry.finalBoss?190:145,height:entry.finalBoss?150:105,arenaStartX:width-980,arenaEndX:width-100,requiredHits:entry.finalBoss?12:4+entry.worldOrder,phases:entry.finalBoss?4:Math.min(3,entry.worldOrder),finalBoss:Boolean(entry.finalBoss)}:null;
  return{schemaVersion:3,id:entry.id,name:entry.title,levelNumber:entry.order,world:entry.visualWorldKey,visualWorldKey:entry.visualWorldKey,worldTitle:entry.worldTitle,worldWidth:width,worldHeight:540,requiredPickups:pickups.length,spawn:{x:80,y:390},platforms:layout.platforms,hazards:layout.hazards,pickups,powerups:generatedPowerups(width,entry.order),checkpoints:generatedCheckpoints(width,meta.checkpoints,entry.order,entry.boss),mechanicZones:generatedMechanicZones(width,meta,entry.order),enemyPool:[...meta.enemies],hazardTypes:[...meta.hazards],mechanic:meta.mechanic,boss,finish:{x:width-90,y:390,width:50,height:90}};
}

let activeLevelId=SPROUT_CAMPAIGN_MANIFEST.defaultLevelId;
function campaignEntry(id){return flatCampaignLevels().find(e=>e.id===id)||null;}
function syncCampaignDataNode(candidate){const node=document.querySelector('#seed-man-level');if(node)node.textContent=JSON.stringify(candidate);}
function updateCampaignHud(entry){
  document.documentElement.dataset.sproutCampaign=SPROUT_CAMPAIGN_MANIFEST.id;document.documentElement.dataset.sproutCampaignLevels='20';document.documentElement.dataset.seedManWorld=entry.visualWorldKey;document.documentElement.dataset.seedManLevel=entry.id;
  const marker=document.querySelector('#seed-ui-release-marker');if(marker)marker.textContent=`LIVE UI · LEVEL ${entry.order}/20 · ${entry.worldTitle.toUpperCase()}`;
}
function selectLevel(id,{announce=true}={}){
  const entry=campaignEntry(id);if(!entry)throw new Error(`Unknown Seed Man level: ${id}`);const candidate=buildLevel(entry);activeLevelId=id;
  try{level=candidate;}catch(error){console.error('Unable to assign Seed Man level.',error);return null;}
  syncCampaignDataNode(candidate);updateCampaignHud(entry);
  if(typeof reset==='function')reset();
  if(announce)window.dispatchEvent(new CustomEvent('sprout:level-selected',{detail:{levelId:id,level:{...entry},levelData:candidate}}));
  return{...entry};
}
function completeLevel(id){
  const levels=flatCampaignLevels();const index=levels.findIndex(e=>e.id===id);if(index<0)return;const progress=readProgress();const completed=new Set(progress.completed||[]);completed.add(id);const next=levels[index+1]?.id||null;writeProgress({completed:[...completed],lastLevelId:id,nextLevelId:next,finished:!next,updatedAt:Date.now()});syncLevelSelect();
}
function ensureLevelSelect(){
  if(document.querySelector('#seed-man-level-select'))return;const shell=document.querySelector('.game-shell');if(!shell)return;
  const wrap=document.createElement('section');wrap.id='seed-man-level-select';wrap.className='seed-level-select';wrap.setAttribute('aria-label','Seed Man campaign levels');
  const title=document.createElement('div');title.className='seed-level-select__title';title.innerHTML='<strong>20-Level Campaign</strong><span>Greenhouse Valley → Forest Ruins → Desert Canyon → Frozen Peaks → Eco City</span>';wrap.append(title);
  const grid=document.createElement('div');grid.className='seed-level-select__grid';for(const entry of flatCampaignLevels()){const b=document.createElement('button');b.type='button';b.dataset.levelId=entry.id;b.textContent=`${entry.order}. ${entry.title}`;b.addEventListener('click',()=>selectLevel(entry.id));grid.append(b);}wrap.append(grid);shell.before(wrap);
  const style=document.createElement('style');style.textContent='.seed-level-select{max-width:1120px;margin:0 auto 14px;padding:12px;border:1px solid rgba(117,255,104,.22);border-radius:14px;background:#07160fe8;color:#eef7ea}.seed-level-select__title{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:9px}.seed-level-select__title strong{color:#9cff70;font:900 14px system-ui}.seed-level-select__title span{color:#a9b9ae;font:700 10px system-ui}.seed-level-select__grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.seed-level-select button{min-height:38px;border:1px solid #335a43;border-radius:8px;background:#10291d;color:#e9f5e8;font:800 10px system-ui;cursor:pointer}.seed-level-select button[data-active="true"]{border-color:#8cff65;box-shadow:0 0 15px #63ff5533;color:#bfff9e}.seed-level-select button[data-complete="true"]:after{content:" ✓";color:#9cff70}@media(max-width:760px){.seed-level-select__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.seed-level-select__title{display:block}.seed-level-select__title span{display:block;margin-top:4px}}';document.head.append(style);
}
function syncLevelSelect(){const progress=readProgress();const completed=new Set(progress.completed||[]);document.querySelectorAll('#seed-man-level-select [data-level-id]').forEach(b=>{b.dataset.active=String(b.dataset.levelId===activeLevelId);b.dataset.complete=String(completed.has(b.dataset.levelId));});}

window.__SPROUT_CAMPAIGN__=Object.freeze({version:SPROUT_CAMPAIGN_RUNTIME_VERSION,campaignId:SPROUT_CAMPAIGN_MANIFEST.id,title:SPROUT_CAMPAIGN_MANIFEST.title,levelCount:20,finalBoss:'blight-king',worlds:SPROUT_CAMPAIGN_MANIFEST.worlds,listLevels:()=>flatCampaignLevels().map(e=>({...e})),getLevel:(id=activeLevelId)=>campaignEntry(id),get activeLevelId(){return activeLevelId;},selectLevel,buildLevel,completeLevel});

window.addEventListener('load',()=>setTimeout(()=>{
  ensureLevelSelect();const progress=readProgress();const target=campaignEntry(progress.nextLevelId)?progress.nextLevelId:SPROUT_CAMPAIGN_MANIFEST.defaultLevelId;selectLevel(target,{announce:true});syncLevelSelect();
  if(typeof finishGame==='function'&&!finishGame.__campaign20Wrapped){const base=finishGame;const wrapped=function(){const id=activeLevelId;base();completeLevel(id);};wrapped.__campaign20Wrapped=true;try{finishGame=wrapped;}catch{}}
},0),{once:true});
