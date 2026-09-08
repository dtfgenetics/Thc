'use strict';

/* Approved Seed Man visual renderer. Simulation owns state/collision; this file owns visuals. */
const SPROUT_ART_VERSION='seed-man-approved-production-v4';
const SPROUT_VISUAL_PIPELINE='approved-showcase-master-atlas-v1';
const SPROUT_CHARACTER_CONTRACT='green-armored-plant-hero';
const APPROVED_ATLAS_URL='./assets/approved/seed-man-approved-master-atlas-v1.webp';

const APPROVED_WORLD_RECTS=Object.freeze({
  'greenhouse-valley':[0,498,320,180],
  'forest-ruins':[320,498,320,180],
  'desert-canyon':[640,498,320,180],
  'frozen-peak':[960,498,320,180],
  'frozen-peaks':[960,498,320,180],
  'eco-city':[1280,498,320,180]
});
const APPROVED_PLAYER_RECTS=Object.freeze({
  idle:[28,158,88,108],walk:[174,158,110,108],run:[174,158,110,108],jump:[326,156,106,112],'double-jump':[326,156,106,112],fall:[326,156,106,112],land:[28,158,88,108],attack:[442,154,170,114],ability:[442,154,170,114],hurt:[621,156,112,112],hit:[621,156,112,112],finish:[26,322,105,124],victory:[26,322,105,124],plant:[145,322,180,124],fire:[310,322,175,124],electric:[450,322,185,124],ice:[595,322,195,124]
});
const APPROVED_PLATFORM_RECTS=Object.freeze({grass:[12,692,66,74],dirt:[101,692,68,74],stone:[192,692,68,74],metal:[282,692,68,74],ice:[373,692,68,74],sand:[464,692,68,74]});

const approvedAtlas=new Image();
approvedAtlas.decoding='async';
let approvedAtlasReady=false;
let approvedAtlasFailed=false;
let approvedInstalls=0;

function approvedPlayer(){try{return typeof player!=='undefined'?player:null;}catch{return null;}}
function approvedWorldKey(){
  try{
    const direct=level?.visualWorldKey||level?.world;
    if(direct&&APPROVED_WORLD_RECTS[direct])return direct;
    const id=String(level?.id||'');
    if(id.startsWith('2-'))return'forest-ruins';
    if(id.startsWith('3-'))return'desert-canyon';
    if(id.startsWith('4-'))return'frozen-peak';
    if(id.startsWith('5-'))return'eco-city';
  }catch{}
  return'greenhouse-valley';
}
function approvedPhenotype(){
  try{
    const snap=window.__SPROUT_COMBAT_BROWSER__?.snapshot?.();
    if(!snap?.activePhenotype||Number(snap.phenotypeRemaining)<=0)return null;
    if(snap.activePhenotype==='solar-flare'||snap.activePhenotype==='fire')return'fire';
    if(snap.activePhenotype==='static-haze'||snap.activePhenotype==='electric')return'electric';
    if(snap.activePhenotype==='frost-resin'||snap.activePhenotype==='ice')return'ice';
    return'plant';
  }catch{return null;}
}
function approvedPose(){
  const s=approvedPlayer();if(!s)return'idle';
  if(s.finished||s.state==='finish')return'victory';
  if(s.state==='hurt'||s.state==='shield-bounce')return'hurt';
  if(s.state==='attack'||s.state==='ability')return'attack';
  if(!s.grounded)return Number(s.vy||0)<-20?'jump':'fall';
  if(Math.abs(Number(s.vx||0))>14)return'run';
  return'idle';
}
function approvedCover(rect,dx,dy,dw,dh){
  const[sx,sy,sw,sh]=rect;const sr=sw/sh,dr=dw/dh;let x=sx,y=sy,w=sw,h=sh;
  if(sr>dr){w=sh*dr;x=sx+(sw-w)/2;}else{h=sw/dr;y=sy+(sh-h)/2;}
  ctx.drawImage(approvedAtlas,x,y,w,h,dx,dy,dw,dh);
}
function drawApprovedBackground(){
  if(typeof ctx==='undefined'||!ctx||typeof canvas==='undefined'||!canvas)return;
  if(!approvedAtlasReady){ctx.fillStyle='#06150e';ctx.fillRect(0,0,canvas.width,canvas.height);return;}
  const rect=APPROVED_WORLD_RECTS[approvedWorldKey()]||APPROVED_WORLD_RECTS['greenhouse-valley'];
  approvedCover(rect,0,0,canvas.width,canvas.height);
  ctx.save();ctx.globalAlpha=.11;const cam=typeof cameraX==='number'?cameraX:0;const offset=-((cam*.07)%canvas.width);approvedCover(rect,offset,0,canvas.width,canvas.height);approvedCover(rect,offset+canvas.width,0,canvas.width,canvas.height);ctx.restore();
}
function approvedTileKey(){const w=approvedWorldKey();if(w==='desert-canyon')return'sand';if(w==='frozen-peak'||w==='frozen-peaks')return'ice';if(w==='eco-city')return'metal';if(w==='forest-ruins')return'dirt';return'grass';}
function approvedTilePlatform(rect,crop){
  const[sx,sy,sw,sh]=crop;const cam=typeof cameraX==='number'?cameraX:0;const start=Number(rect.x)-cam;const end=start+Number(rect.width);
  for(let x=start;x<end;x+=64){const w=Math.min(64,end-x);if(x+w<0||x>canvas.width)continue;ctx.drawImage(approvedAtlas,sx,sy,sw,sh,Math.round(x),Number(rect.y),w,Number(rect.height));}
}
function drawApprovedPlatforms(){
  if(typeof ctx==='undefined'||!ctx||!approvedAtlasReady||typeof level==='undefined'||!level)return;
  const crop=APPROVED_PLATFORM_RECTS[approvedTileKey()]||APPROVED_PLATFORM_RECTS.grass;
  for(const p of level.platforms||[])approvedTilePlatform(p,crop);
  const wk=approvedWorldKey();
  for(const h of level.hazards||[]){const cam=typeof cameraX==='number'?cameraX:0;const x=Math.round(Number(h.x)-cam);ctx.save();ctx.fillStyle=wk==='frozen-peak'?'#9eeaff':wk==='eco-city'?'#8dff63':'#ff713f';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;for(let px=x;px<x+Number(h.width);px+=20){ctx.beginPath();ctx.moveTo(px,Number(h.y)+Number(h.height));ctx.lineTo(px+10,Number(h.y));ctx.lineTo(px+20,Number(h.y)+Number(h.height));ctx.fill();}ctx.restore();}
}
function drawApprovedSeedMan(){
  const s=approvedPlayer();if(!approvedAtlasReady||typeof ctx==='undefined'||!ctx||!s)return;
  const key=approvedPhenotype()||approvedPose();const crop=APPROVED_PLAYER_RECTS[key]||APPROVED_PLAYER_RECTS.idle;const[sx,sy,sw,sh]=crop;
  const cam=typeof cameraX==='number'?cameraX:0;const cx=Number(s.x||0)-cam+Number(s.width||34)/2;const feet=Number(s.y||0)+Number(s.height||46)+8;const h=approvedPhenotype()?86:80;const w=h*(sw/sh);const facing=Number(s.vx||0)<-1?-1:1;
  ctx.save();ctx.translate(cx,feet);ctx.scale(facing,1);if(key==='hurt')ctx.globalAlpha=.72+Math.abs(Math.sin(performance.now()*.03))*.25;ctx.drawImage(approvedAtlas,sx,sy,sw,sh,-w/2,-h,w,h);ctx.restore();
  if(s.power?.shieldCharges>0||s.power?.invulnerableTimer>0){ctx.save();ctx.strokeStyle='#7ceaffcc';ctx.lineWidth=2.5;ctx.shadowBlur=12;ctx.shadowColor='#7ceaff';ctx.beginPath();ctx.ellipse(cx,Number(s.y)+Number(s.height||46)/2,w*.43,h*.45,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

function installSeedManProductionRenderer(){
  try{
    if(typeof drawSeedMan!=='function'||typeof drawBackground!=='function'||typeof drawPlatforms!=='function')return false;
    drawSeedMan=drawApprovedSeedMan;drawBackground=drawApprovedBackground;drawPlatforms=drawApprovedPlatforms;
    window.drawSeedManProduction=drawApprovedSeedMan;
    approvedInstalls+=1;
    document.documentElement.dataset.seedManRendererOwner='seed-man-production-v1';
    document.documentElement.dataset.seedManVisualPipeline=SPROUT_VISUAL_PIPELINE;
    document.documentElement.dataset.seedManCharacterContract=SPROUT_CHARACTER_CONTRACT;
    document.documentElement.dataset.seedManApprovedArt=approvedAtlasReady?'ready':approvedAtlasFailed?'failed':'loading';
    window.__SPROUT_ART__=Object.freeze({version:SPROUT_ART_VERSION,renderer:'approved-atlas-2d',visualPipeline:SPROUT_VISUAL_PIPELINE,characterContract:SPROUT_CHARACTER_CONTRACT,authoritative:true,atlas:APPROVED_ATLAS_URL,phenotypeForms:Object.freeze(['plant','fire','electric','ice']),worlds:Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peak','eco-city'])});
    return true;
  }catch(error){console.error('Seed Man approved production renderer install failed.',error);return false;}
}

approvedAtlas.addEventListener('load',()=>{approvedAtlasReady=true;approvedAtlasFailed=false;installSeedManProductionRenderer();},{once:true});
approvedAtlas.addEventListener('error',()=>{approvedAtlasReady=false;approvedAtlasFailed=true;document.documentElement.dataset.seedManApprovedArt='failed';const status=document.querySelector('#load-status');if(status){status.dataset.state='error';status.textContent='Approved Seed Man artwork failed to load. Reload to retry.';}console.error('Approved Seed Man production atlas failed to load:',APPROVED_ATLAS_URL);},{once:true});
approvedAtlas.src=APPROVED_ATLAS_URL;
installSeedManProductionRenderer();
window.addEventListener('DOMContentLoaded',installSeedManProductionRenderer,{once:true});
window.addEventListener('load',installSeedManProductionRenderer,{once:true});
window.addEventListener('sprout:level-selected',installSeedManProductionRenderer);
window.__SEED_MAN_APPROVED_ART_RUNTIME__=Object.freeze({version:SPROUT_ART_VERSION,sourceOfTruth:'approved-showcase-2026-09-08',snapshot:()=>({ready:approvedAtlasReady,failed:approvedAtlasFailed,installs:approvedInstalls,world:approvedWorldKey(),pose:approvedPose(),phenotype:approvedPhenotype(),rendererOwner:document.documentElement.dataset.seedManRendererOwner}),reinstall:installSeedManProductionRenderer});
