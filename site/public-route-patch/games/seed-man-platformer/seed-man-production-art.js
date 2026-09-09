'use strict';

/*
 * Seed Man approved-art renderer.
 * Source of truth: approved 2026-09-08 green armored plant-hero showcase.
 * Gameplay state/collision remain owned by simulation. This file only renders.
 */

const SPROUT_ART_VERSION = 'seed-man-approved-atlas-renderer-v4';
const SPROUT_VISUAL_PIPELINE = 'approved-showcase-2026-09-08';
const SPROUT_CHARACTER_CONTRACT = 'green-armored-plant-hero';
const APPROVED_CORE_URL = './approved-art-core-v1.js';

const FRAME_COLS = 5;
const FRAME_ROWS = 2;
const APPROVED_CELLS = Object.freeze({
  idle: Object.freeze([0,0]), run: Object.freeze([1,0]), jump: Object.freeze([2,0]),
  attack: Object.freeze([3,0]), hurt: Object.freeze([4,0]), victory: Object.freeze([0,1]),
  plant: Object.freeze([1,1]), fire: Object.freeze([2,1]),
  electric: Object.freeze([3,1]), ice: Object.freeze([4,1])
});

let approvedSeedManImage=null;
let approvedSeedManReady=false;
let approvedSeedManFailed=false;
let approvedCoreLoading=false;

function approvedSource(){return window.__SEED_MAN_APPROVED_IMAGES__?.['character.seedman.atlas']||'';}

function loadApprovedCore(){
  if(approvedCoreLoading||approvedSource()) return;
  approvedCoreLoading=true;
  const script=document.createElement('script');
  script.src=APPROVED_CORE_URL;
  script.async=false;
  script.dataset.seedManApprovedCoreLoader='v1';
  script.onload=()=>{approvedCoreLoading=false;ensureApprovedSeedManImage();};
  script.onerror=()=>{approvedCoreLoading=false;approvedSeedManFailed=true;console.error('[Seed Man] approved-art-core-v1.js failed to load. Character fallback is disabled.');};
  document.head.appendChild(script);
}

function ensureApprovedSeedManImage(){
  if(approvedSeedManReady||approvedSeedManFailed) return;
  const src=approvedSource();
  if(!src){loadApprovedCore();return;}
  const image=new Image();
  image.decoding='async';
  image.onload=()=>{
    approvedSeedManImage=image;
    approvedSeedManReady=true;
    document.documentElement.dataset.seedManRendererOwner=SPROUT_ART_VERSION;
    document.documentElement.dataset.seedManApprovedCharacter=SPROUT_CHARACTER_CONTRACT;
    document.documentElement.dataset.seedManApprovedArt='ready';
  };
  image.onerror=()=>{
    approvedSeedManFailed=true;
    document.documentElement.dataset.seedManApprovedArt='failed';
    console.error('[Seed Man] approved character atlas failed to decode. Character fallback is disabled.');
  };
  image.src=src;
}

function combatSnapshot(){try{return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()||null;}catch{return null;}}
function activeApprovedPhenotype(){
  const id=combatSnapshot()?.activePhenotype||'';
  if(id==='solar-flare'||id==='fire')return'fire';
  if(id==='static-haze'||id==='electric')return'electric';
  if(id==='frost-resin'||id==='ice')return'ice';
  return'plant';
}
function resolveApprovedPose(){
  if(!player)return'idle';
  if(player.finished||player.state==='finish'||player.state==='victory')return'victory';
  if(player.state==='hurt'||player.state==='shield-bounce')return'hurt';
  if(player.state==='attack'||player.state==='ability')return'attack';
  if(!player.grounded)return'jump';
  if(Math.abs(player.vx||0)>14)return'run';
  return'idle';
}
function chooseApprovedCell(){
  const phenotype=activeApprovedPhenotype();
  const pose=resolveApprovedPose();
  if(phenotype!=='plant')return APPROVED_CELLS[phenotype];
  if(pose==='victory')return APPROVED_CELLS.victory;
  return APPROVED_CELLS[pose]||APPROVED_CELLS.idle;
}
function approvedRect(){
  const [col,row]=chooseApprovedCell();
  const w=approvedSeedManImage.naturalWidth/FRAME_COLS;
  const h=approvedSeedManImage.naturalHeight/FRAME_ROWS;
  return{x:col*w,y:row*h,w,h};
}
function drawApprovedShadow(screenX,screenY){
  if(!player?.grounded)return;
  ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#07120d';ctx.beginPath();ctx.ellipse(screenX+player.width/2,screenY+player.height+3,Math.max(16,player.width*.62),6,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawSeedManProduction(){
  if(!player||!ctx)return;
  ensureApprovedSeedManImage();
  if(!approvedSeedManReady||!approvedSeedManImage)return;
  const rect=approvedRect();
  const screenX=player.x-cameraX;
  const screenY=player.y;
  const facing=(player.facing||(player.vx<0?-1:1))<0?-1:1;
  const targetHeight=Math.max(70,(player.height||58)*1.82);
  const targetWidth=targetHeight*(rect.w/rect.h);
  const centerX=screenX+(player.width||38)/2;
  const feetY=screenY+(player.height||58)+5;
  drawApprovedShadow(screenX,screenY);
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.translate(centerX,feetY);
  ctx.scale(facing,1);
  const pose=resolveApprovedPose();
  if(pose==='run')ctx.rotate(Math.sin((performance.now()||0)*.018)*.025*facing);
  if(pose==='hurt')ctx.globalAlpha=.78+Math.sin((performance.now()||0)*.04)*.18;
  ctx.drawImage(approvedSeedManImage,rect.x,rect.y,rect.w,rect.h,-targetWidth/2,-targetHeight,targetWidth,targetHeight);
  ctx.restore();
}

window.drawSeedManProduction=drawSeedManProduction;
window.drawSeedMan=drawSeedManProduction;
window.__SEED_MAN_PRODUCTION_ART__=Object.freeze({
  version:SPROUT_ART_VERSION,
  pipeline:SPROUT_VISUAL_PIPELINE,
  characterContract:SPROUT_CHARACTER_CONTRACT,
  sourceOfTruth:'approved-showcase-2026-09-08',
  approvedCoreUrl:APPROVED_CORE_URL,
  atlasKey:'character.seedman.atlas',
  fallbackAllowed:false,
  frameGrid:Object.freeze({cols:FRAME_COLS,rows:FRAME_ROWS}),
  cells:APPROVED_CELLS,
  snapshot:()=>({ready:approvedSeedManReady,failed:approvedSeedManFailed,coreLoading:approvedCoreLoading,rendererOwner:document.documentElement.dataset.seedManRendererOwner||''})
});

document.documentElement.dataset.seedManRendererOwner=SPROUT_ART_VERSION;
document.documentElement.dataset.seedManApprovedCharacter=SPROUT_CHARACTER_CONTRACT;
ensureApprovedSeedManImage();
