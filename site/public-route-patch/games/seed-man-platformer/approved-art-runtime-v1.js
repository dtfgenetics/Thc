'use strict';

(() => {
  const VERSION = 'seed-man-approved-art-runtime-v2';
  const ATLAS_SRC = './assets/approved/seed-man-approved-master-atlas-v1.webp';
  const atlas = new Image();
  atlas.decoding = 'async';
  let ready = false;
  let failed = false;
  let installs = 0;

  const WORLD_RECTS = Object.freeze({
    'greenhouse-valley': [0,498,320,180],
    'forest-ruins': [320,498,320,180],
    'desert-canyon': [640,498,320,180],
    'frozen-peak': [960,498,320,180],
    'frozen-peaks': [960,498,320,180],
    'eco-city': [1280,498,320,180]
  });

  const PLAYER_RECTS = Object.freeze({
    idle:[28,158,88,108], walk:[174,158,110,108], run:[174,158,110,108],
    jump:[326,156,106,112], 'double-jump':[326,156,106,112], fall:[326,156,106,112], land:[28,158,88,108],
    attack:[442,154,170,114], ability:[442,154,170,114], hurt:[621,156,112,112], hit:[621,156,112,112],
    finish:[26,322,105,124], victory:[26,322,105,124], plant:[145,322,180,124], fire:[310,322,175,124], electric:[450,322,185,124], ice:[595,322,195,124]
  });

  const PLATFORM_RECTS = Object.freeze({
    grass:[12,692,66,74], dirt:[101,692,68,74], stone:[192,692,68,74], metal:[282,692,68,74], ice:[373,692,68,74], sand:[464,692,68,74]
  });

  function playerState() { try { return typeof player !== 'undefined' ? player : null; } catch { return null; } }
  function worldKey() {
    try {
      const direct = level?.visualWorldKey || level?.world;
      if (direct && WORLD_RECTS[direct]) return direct;
      const id = String(level?.id || '');
      if (id.startsWith('2-')) return 'forest-ruins';
      if (id.startsWith('3-')) return 'desert-canyon';
      if (id.startsWith('4-')) return 'frozen-peak';
      if (id.startsWith('5-')) return 'eco-city';
    } catch {}
    return 'greenhouse-valley';
  }
  function phenotype() {
    try {
      const snap = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.();
      if (!snap?.activePhenotype || Number(snap.phenotypeRemaining) <= 0) return null;
      if (snap.activePhenotype === 'solar-flare' || snap.activePhenotype === 'fire') return 'fire';
      if (snap.activePhenotype === 'static-haze' || snap.activePhenotype === 'electric') return 'electric';
      if (snap.activePhenotype === 'frost-resin' || snap.activePhenotype === 'ice') return 'ice';
      return 'plant';
    } catch { return null; }
  }
  function pose() {
    const s = playerState();
    if (!s) return 'idle';
    if (s.finished || s.state === 'finish') return 'victory';
    if (s.state === 'hurt' || s.state === 'shield-bounce') return 'hurt';
    if (s.state === 'attack' || s.state === 'ability') return 'attack';
    if (!s.grounded) return Number(s.vy || 0) < -20 ? 'jump' : 'fall';
    if (Math.abs(Number(s.vx || 0)) > 14) return 'run';
    return 'idle';
  }

  function cover(rect, dx, dy, dw, dh) {
    const [sx,sy,sw,sh] = rect;
    const sr = sw/sh, dr = dw/dh;
    let x=sx,y=sy,w=sw,h=sh;
    if (sr > dr) { w=sh*dr; x=sx+(sw-w)/2; } else { h=sw/dr; y=sy+(sh-h)/2; }
    ctx.drawImage(atlas,x,y,w,h,dx,dy,dw,dh);
  }

  function drawApprovedBackground() {
    if (!ctx || !canvas) return;
    if (!ready) { ctx.fillStyle='#06150e'; ctx.fillRect(0,0,canvas.width,canvas.height); return; }
    const rect = WORLD_RECTS[worldKey()] || WORLD_RECTS['greenhouse-valley'];
    cover(rect,0,0,canvas.width,canvas.height);
    ctx.save(); ctx.globalAlpha=.12;
    const offset = -(((typeof cameraX==='number'?cameraX:0)*.07)%canvas.width);
    cover(rect,offset,0,canvas.width,canvas.height); cover(rect,offset+canvas.width,0,canvas.width,canvas.height);
    ctx.restore();
  }

  function tileKey() {
    const w=worldKey();
    if(w==='desert-canyon') return 'sand'; if(w==='frozen-peak'||w==='frozen-peaks') return 'ice'; if(w==='eco-city') return 'metal'; if(w==='forest-ruins') return 'dirt'; return 'grass';
  }
  function tilePlatform(rect,crop) {
    const [sx,sy,sw,sh]=crop; const cam=typeof cameraX==='number'?cameraX:0; const start=rect.x-cam;
    for(let x=start;x<start+rect.width;x+=64){const w=Math.min(64,start+rect.width-x);if(x+w<0||x>canvas.width)continue;ctx.drawImage(atlas,sx,sy,sw,sh,Math.round(x),rect.y,w,rect.height);}
  }
  function drawApprovedPlatforms() {
    if (!ctx || !ready || typeof level==='undefined' || !level) return;
    const crop=PLATFORM_RECTS[tileKey()]||PLATFORM_RECTS.grass;
    for(const p of level.platforms||[]) tilePlatform(p,crop);
    const wk=worldKey();
    for(const h of level.hazards||[]){const x=Math.round(h.x-(typeof cameraX==='number'?cameraX:0));ctx.save();ctx.fillStyle=wk==='frozen-peak'?'#9eeaff':wk==='eco-city'?'#8dff63':'#ff713f';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;for(let px=x;px<x+h.width;px+=20){ctx.beginPath();ctx.moveTo(px,h.y+h.height);ctx.lineTo(px+10,h.y);ctx.lineTo(px+20,h.y+h.height);ctx.fill();}ctx.restore();}
  }

  function drawApprovedSeedMan() {
    const s=playerState(); if(!ready||!ctx||!s)return;
    const key=phenotype()||pose(); const crop=PLAYER_RECTS[key]||PLAYER_RECTS.idle; const [sx,sy,sw,sh]=crop;
    const cam=typeof cameraX==='number'?cameraX:0; const cx=Number(s.x)-cam+Number(s.width||34)/2; const feet=Number(s.y)+Number(s.height||46)+8;
    const h=phenotype()?86:80; const w=h*(sw/sh); const facing=Number(s.vx||0)<-1?-1:1;
    ctx.save();ctx.translate(cx,feet);ctx.scale(facing,1);if(key==='hurt')ctx.globalAlpha=.72+Math.abs(Math.sin(performance.now()*.03))*.25;ctx.drawImage(atlas,sx,sy,sw,sh,-w/2,-h,w,h);ctx.restore();
    if(s.power?.shieldCharges>0||s.power?.invulnerableTimer>0){ctx.save();ctx.strokeStyle='#7ceaffcc';ctx.lineWidth=2.5;ctx.shadowBlur=12;ctx.shadowColor='#7ceaff';ctx.beginPath();ctx.ellipse(cx,Number(s.y)+Number(s.height||46)/2,w*.43,h*.45,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

  function install() {
    try {
      if(typeof drawSeedMan!=='function'||typeof drawBackground!=='function'||typeof drawPlatforms!=='function')return false;
      drawSeedMan=drawApprovedSeedMan; drawBackground=drawApprovedBackground; drawPlatforms=drawApprovedPlatforms;
      installs+=1; document.documentElement.dataset.seedManRendererOwner='approved-art-runtime'; document.documentElement.dataset.seedManVisualPipeline='approved-showcase-master-atlas-v1'; document.documentElement.dataset.seedManCharacterContract='green-armored-plant-hero'; document.documentElement.dataset.seedManApprovedArt=ready?'ready':failed?'failed':'loading';
      return true;
    } catch(error){console.error('Seed Man approved art install failed.',error);return false;}
  }

  atlas.addEventListener('load',()=>{ready=true;failed=false;install();},{once:true});
  atlas.addEventListener('error',()=>{ready=false;failed=true;document.documentElement.dataset.seedManApprovedArt='failed';const node=document.querySelector('#load-status');if(node){node.dataset.state='error';node.textContent='Approved Seed Man artwork failed to load. Reload to retry.';}console.error('Approved Seed Man atlas failed:',ATLAS_SRC);},{once:true});
  atlas.src=ATLAS_SRC;
  install();
  window.addEventListener('DOMContentLoaded',install,{once:true});
  window.addEventListener('load',install,{once:true});
  window.addEventListener('sprout:level-selected',install);
  window.__SEED_MAN_APPROVED_ART_RUNTIME__=Object.freeze({version:VERSION,authoritative:true,sourceOfTruth:'approved-showcase-2026-09-08',atlas:ATLAS_SRC,snapshot:()=>({ready,failed,installs,world:worldKey(),pose:pose(),phenotype:phenotype(),rendererOwner:document.documentElement.dataset.seedManRendererOwner}),reinstall:install});
})();
