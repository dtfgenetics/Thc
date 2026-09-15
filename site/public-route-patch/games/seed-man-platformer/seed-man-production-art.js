'use strict';

/*
 * Seed Man approved-art renderer.
 * Source of truth: approved 2026-09-08 green armored plant-hero showcase.
 * Gameplay state/collision remain owned by simulation. This file only renders.
 */

const SPROUT_ART_VERSION = 'seed-man-approved-atlas-renderer-v4';
const SPROUT_ACTION_FEEDBACK = 'seed-man-approved-action-feedback-v2';
const SPROUT_MOTION_RIG = 'seed-man-character-motion-rig-v1';
const SPROUT_VISUAL_PIPELINE = 'approved-showcase-2026-09-08';
const SPROUT_CHARACTER_CONTRACT = 'green-armored-plant-hero';
const APPROVED_CORE_URL = './approved-art-core-v1.js';

const FRAME_COLS = 5;
const FRAME_ROWS = 2;
const APPROVED_CELLS = Object.freeze({
  idle: Object.freeze([0,0]), run: Object.freeze([1,0]), jump: Object.freeze([2,0]), fall: Object.freeze([2,0]),
  attack: Object.freeze([3,0]), ability: Object.freeze([3,0]), hurt: Object.freeze([4,0]), victory: Object.freeze([0,1]),
  plant: Object.freeze([1,1]), fire: Object.freeze([2,1]),
  electric: Object.freeze([3,1]), ice: Object.freeze([4,1])
});
const PHENOTYPE_ACCENTS = Object.freeze({plant:'#c8f36a',fire:'#ff9a4b',electric:'#d6c0ff',ice:'#8fe7ff'});

let approvedSeedManImage=null;
let approvedSeedManReady=false;
let approvedSeedManFailed=false;
let approvedCoreLoading=false;
let previousGrounded=null;
let landingStartedAt=-Infinity;

function timeNow(){return typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():0;}
function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
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
  const snapshot=combatSnapshot();
  const id=snapshot?.phenotypeForm||snapshot?.activePhenotype||'plant';
  return ['plant','fire','electric','ice'].includes(id)?id:'plant';
}
function resolveApprovedPose(){
  const combat=combatSnapshot();
  if((Number(combat?.actionPoseRemaining)||0)>0&&['attack','ability'].includes(combat?.actionPose))return combat.actionPose;
  if(typeof player==='undefined'||!player)return'idle';
  if(player.finished||player.state==='finish'||player.state==='victory')return'victory';
  if(player.state==='hurt')return'hurt';
  if(player.state==='attack'||player.state==='ability')return player.state;
  if(!player.grounded)return Number(player.vy||0)<-20?'jump':'fall';
  if(Math.abs(Number(player.vx||0))>14)return'run';
  return'idle';
}
function chooseApprovedCell(){
  const phenotype=activeApprovedPhenotype();
  const pose=resolveApprovedPose();
  if(phenotype!=='plant')return APPROVED_CELLS[phenotype];
  return APPROVED_CELLS[pose]||APPROVED_CELLS.idle;
}
function approvedRect(){
  const [col,row]=chooseApprovedCell();
  const w=approvedSeedManImage.naturalWidth/FRAME_COLS;
  const h=approvedSeedManImage.naturalHeight/FRAME_ROWS;
  return{x:col*w,y:row*h,w,h};
}
function trackLanding(now){
  const grounded=Boolean(player?.grounded);
  if(previousGrounded===false&&grounded)landingStartedAt=now;
  previousGrounded=grounded;
  return now-landingStartedAt;
}
function motionTransform(pose,state={},now=0,landingAgeMs=Infinity){
  const vx=Number(state.vx)||0;
  const vy=Number(state.vy)||0;
  const speed=clamp(Math.abs(vx)/340,0,1);
  const t=Math.max(0,Number(now)||0)/1000;
  let x=0,y=0,rotation=0,scaleX=1,scaleY=1,alpha=1;

  if(pose==='idle'){
    const breath=Math.sin(t*3.4);
    y=-1.2-breath*1.25;
    scaleX=1-breath*.006;
    scaleY=1+breath*.012;
  }else if(pose==='run'){
    const phase=t*(11+speed*7);
    x=Math.sin(phase)*1.1;
    y=-Math.abs(Math.sin(phase))*4.4;
    rotation=Math.sin(phase)*.047;
    scaleX=1+Math.abs(Math.sin(phase))*.018;
    scaleY=1-Math.abs(Math.sin(phase))*.026;
  }else if(pose==='jump'){
    const rise=clamp(-vy/760,0,1);
    y=-2-rise*2.5;
    rotation=clamp(vx/10000,-.035,.035);
    scaleX=.955-rise*.015;
    scaleY=1.055+rise*.025;
  }else if(pose==='fall'){
    const fall=clamp(vy/820,0,1);
    y=1+fall*1.8;
    rotation=clamp(vx/8500,-.045,.045);
    scaleX=1.035+fall*.035;
    scaleY=.975-fall*.035;
  }else if(pose==='attack'){
    const strike=.5+.5*Math.sin(t*22);
    x=4.5+strike*3.5;
    y=-strike*.8;
    rotation=-.035-strike*.028;
    scaleX=1.035+strike*.028;
    scaleY=.985-strike*.018;
  }else if(pose==='ability'){
    const pulse=.5+.5*Math.sin(t*18);
    x=2.5+pulse*2.5;
    y=-2-pulse*2;
    rotation=.025+pulse*.018;
    scaleX=1.055+pulse*.035;
    scaleY=.965-pulse*.025;
  }else if(pose==='hurt'){
    const flicker=.5+.5*Math.sin(t*34);
    x=-5.5;
    y=-1.5;
    rotation=.09;
    scaleX=.96;
    scaleY=1.025;
    alpha=.68+flicker*.24;
  }else if(pose==='victory'){
    const cheer=Math.sin(t*5.2);
    y=-Math.abs(cheer)*7;
    rotation=cheer*.035;
    scaleX=1-Math.abs(cheer)*.018;
    scaleY=1+Math.abs(cheer)*.032;
  }

  if(Number.isFinite(landingAgeMs)&&landingAgeMs>=0&&landingAgeMs<180){
    const impact=1-landingAgeMs/180;
    y+=2.6*impact;
    scaleX+=.105*impact;
    scaleY-=.125*impact;
  }

  return Object.freeze({x,y,rotation,scaleX,scaleY,alpha});
}
function drawApprovedShadow(screenX,screenY,pose,motion){
  if(!player?.grounded)return;
  const speed=clamp(Math.abs(Number(player.vx)||0)/340,0,1);
  const motionCompression=clamp((1-motion.scaleY)*1.8,-.08,.2);
  ctx.save();
  ctx.globalAlpha=.2+speed*.04;
  ctx.fillStyle='#07120d';
  ctx.beginPath();
  ctx.ellipse(screenX+player.width/2,screenY+player.height+3,Math.max(16,player.width*(.62+motionCompression)),pose==='run'?5.2:6,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}
function drawPhenotypeAura(centerX,feetY,targetWidth,targetHeight,phenotype,pose){
  if(phenotype==='plant')return;
  const accent=PHENOTYPE_ACCENTS[phenotype]||PHENOTYPE_ACCENTS.plant;
  const pulse=.72+Math.sin(timeNow()*.01)*.12;
  ctx.save();
  ctx.globalAlpha=pose==='ability'?.62:.28;
  ctx.strokeStyle=accent;
  ctx.lineWidth=pose==='ability'?5:3;
  ctx.shadowBlur=pose==='ability'?22:13;
  ctx.shadowColor=accent;
  ctx.beginPath();
  ctx.ellipse(centerX,feetY-targetHeight*.48,targetWidth*.54*pulse,targetHeight*.49*pulse,0,0,Math.PI*2);
  ctx.stroke();
  ctx.restore();
}
function drawSeedManProduction(){
  if(typeof player==='undefined'||!player||typeof ctx==='undefined'||!ctx)return;
  ensureApprovedSeedManImage();
  if(!approvedSeedManReady||!approvedSeedManImage)return;
  const rect=approvedRect();
  const screenX=Number(player.x||0)-Number(typeof cameraX==='number'?cameraX:0);
  const screenY=Number(player.y||0);
  const facing=(player.facing||(player.vx<0?-1:1))<0?-1:1;
  const targetHeight=Math.max(70,(Number(player.height)||58)*1.82);
  const targetWidth=targetHeight*(rect.w/rect.h);
  const centerX=screenX+(Number(player.width)||38)/2;
  const feetY=screenY+(Number(player.height)||58)+5;
  const pose=resolveApprovedPose();
  const phenotype=activeApprovedPhenotype();
  const now=timeNow();
  const landingAge=trackLanding(now);
  const motion=motionTransform(pose,player,now,landingAge);
  drawApprovedShadow(screenX,screenY,pose,motion);
  drawPhenotypeAura(centerX,feetY,targetWidth,targetHeight,phenotype,pose);
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.translate(centerX,feetY);
  ctx.scale(facing,1);
  ctx.translate(motion.x,motion.y);
  ctx.rotate(motion.rotation);
  ctx.scale(motion.scaleX,motion.scaleY);
  ctx.globalAlpha=motion.alpha;
  ctx.drawImage(approvedSeedManImage,rect.x,rect.y,rect.w,rect.h,-targetWidth/2,-targetHeight,targetWidth,targetHeight);
  ctx.restore();
}

window.drawSeedManProduction=drawSeedManProduction;
window.drawSeedMan=drawSeedManProduction;
window.__SEED_MAN_PRODUCTION_ART__=Object.freeze({
  version:SPROUT_ART_VERSION,
  actionFeedbackVersion:SPROUT_ACTION_FEEDBACK,
  motionRigVersion:SPROUT_MOTION_RIG,
  pipeline:SPROUT_VISUAL_PIPELINE,
  characterContract:SPROUT_CHARACTER_CONTRACT,
  sourceOfTruth:'approved-showcase-2026-09-08',
  approvedCoreUrl:APPROVED_CORE_URL,
  atlasKey:'character.seedman.atlas',
  fallbackAllowed:false,
  phenotypeForms:Object.freeze(['plant','fire','electric','ice']),
  supportedPoses:Object.freeze(['idle','run','jump','fall','attack','ability','hurt','victory']),
  frameGrid:Object.freeze({cols:FRAME_COLS,rows:FRAME_ROWS}),
  cells:APPROVED_CELLS,
  motionSample:(pose,state={},now=0,landingAgeMs=Infinity)=>motionTransform(pose,state,now,landingAgeMs),
  snapshot:()=>({ready:approvedSeedManReady,failed:approvedSeedManFailed,coreLoading:approvedCoreLoading,rendererOwner:document.documentElement.dataset.seedManRendererOwner||'',actionFeedbackVersion:SPROUT_ACTION_FEEDBACK,motionRigVersion:SPROUT_MOTION_RIG,pose:resolveApprovedPose(),phenotype:activeApprovedPhenotype()})
});

document.documentElement.dataset.seedManRendererOwner=SPROUT_ART_VERSION;
document.documentElement.dataset.seedManApprovedCharacter=SPROUT_CHARACTER_CONTRACT;
document.documentElement.dataset.seedManMotionRig=SPROUT_MOTION_RIG;
ensureApprovedSeedManImage();
