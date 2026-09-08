'use strict';

(() => {
  const VERSION = 'seed-man-sprite-runtime-v2';
  const ATLAS_VERSION = 'seed-man-authored-atlas-v2';
  const FRAME = 256;
  const ATLAS_URL = './assets/seed-man/seed-man-atlas-v2.svg';
  const frameMap = Object.freeze({
    idleA:[0,0], idleB:[1,0], runA:[2,0], runB:[3,0],
    runC:[0,1], runD:[1,1], jump:[2,1], fall:[3,1],
    land:[0,2], attackA:[1,2], attackB:[2,2], hurt:[3,2],
    victory:[0,3], fire:[1,3], electric:[2,3], ice:[3,3]
  });
  const atlas = new Image();
  let atlasReady = false;
  let atlasFailed = false;
  let fallbackRenderer = null;
  let installed = false;
  let lastGrounded = true;
  let landUntil = 0;
  let attackUntil = 0;
  let lastAttackToken = '';

  function state(){ try { return typeof player !== 'undefined' ? player : null; } catch { return null; } }
  function combat(){ try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null; } catch { return null; } }
  function phenoFrame(){
    const id = combat()?.activePhenotype;
    if (id === 'solar-flare') return 'fire';
    if (id === 'static-haze') return 'electric';
    if (id === 'frost-resin') return 'ice';
    return null;
  }
  function detectTransient(now, s){
    if (lastGrounded === false && s?.grounded) landUntil = now + 130;
    lastGrounded = Boolean(s?.grounded);
    const c = combat();
    const token = String(c?.lastAttackAt || c?.attackSerial || c?.shotsFired || '');
    if (token && token !== lastAttackToken) { lastAttackToken = token; attackUntil = now + 160; }
    if (s?.state === 'attack' || s?.state === 'ability') attackUntil = Math.max(attackUntil, now + 90);
  }
  function pose(now = performance.now()){
    const s = state();
    if (!s) return 'idleA';
    detectTransient(now, s);
    const phenotype = phenoFrame();
    if (phenotype) return phenotype;
    if (s.finished || s.state === 'finish') return 'victory';
    if (s.state === 'hurt' || s.state === 'shield-bounce') return 'hurt';
    if (attackUntil > now) return Math.floor(now / 70) % 2 ? 'attackA' : 'attackB';
    if (landUntil > now) return 'land';
    if (!s.grounded) return Number(s.vy) < -20 ? 'jump' : 'fall';
    if (Math.abs(Number(s.vx) || 0) > 14) return ['runA','runB','runC','runD'][Math.floor(now / 75) % 4];
    return Math.floor(now / 430) % 2 ? 'idleA' : 'idleB';
  }
  function drawFrame(name){
    const s = state();
    if (!atlasReady || !s || typeof ctx === 'undefined' || !ctx) return false;
    const [col,row] = frameMap[name] || frameMap.idleA;
    const size = Math.max(78, Math.min(104, Number(s.height || 48) * 1.98));
    const camera = typeof cameraX === 'number' ? cameraX : 0;
    const x = Number(s.x || 0) - camera + Number(s.width || 38)/2;
    const y = Number(s.y || 0) + Number(s.height || 48) + 5;
    const facing = Number(s.vx || 0) < -1 ? -1 : 1;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(facing,1);
    if (name === 'hurt') ctx.globalAlpha = .68 + Math.abs(Math.sin(performance.now()*.03))*.3;
    if (name === 'land') ctx.scale(1.06,.94);
    ctx.drawImage(atlas,col*FRAME,row*FRAME,FRAME,FRAME,-size/2,-size,size,size);
    ctx.restore();
    return true;
  }
  function renderer(){ if (!drawFrame(pose())) fallbackRenderer?.(); }
  function install({force=false}={}){
    if (typeof window.drawSeedMan !== 'function') return false;
    if (!fallbackRenderer && window.drawSeedMan !== renderer) fallbackRenderer = window.drawSeedMan;
    if (installed && !force && window.drawSeedMan === renderer) return true;
    window.drawSeedMan = renderer;
    installed = true;
    document.documentElement.dataset.seedManSpriteRuntime = VERSION;
    document.documentElement.dataset.seedManSpriteAtlas = atlasReady ? ATLAS_VERSION : atlasFailed ? 'fallback' : 'loading';
    document.documentElement.dataset.seedManRendererOwner = VERSION;
    return true;
  }
  atlas.addEventListener('load',()=>{atlasReady=true;atlasFailed=false;document.documentElement.dataset.seedManSpriteAtlas=ATLAS_VERSION;install({force:true});},{once:true});
  atlas.addEventListener('error',()=>{atlasFailed=true;atlasReady=false;document.documentElement.dataset.seedManSpriteAtlas='fallback';console.error(`Seed Man authored sprite atlas v2 failed to load: ${ATLAS_URL}`);},{once:true});
  atlas.decoding='async';
  atlas.src=ATLAS_URL;
  install();
  window.addEventListener('DOMContentLoaded',()=>install({force:true}),{once:true});
  window.addEventListener('sprout:level-selected',()=>install({force:true}));
  window.__SPROUT_SPRITE_RUNTIME_V2__ = Object.freeze({
    version:VERSION, atlasVersion:ATLAS_VERSION, atlasUrl:ATLAS_URL, frames:frameMap, pose,
    snapshot:()=>({installed,atlasReady,atlasFailed,pose:pose(),rendererOwner:window.drawSeedMan===renderer?VERSION:'other'}),
    reinstall:()=>install({force:true})
  });
})();
