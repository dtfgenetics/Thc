'use strict';

(() => {
  const VERSION = 'seed-man-sprite-runtime-v2';
  const VISUAL_ENHANCEMENT = 'seed-man-sprite-motion-phenotype-v3';
  const ATLAS_VERSION = 'seed-man-authored-atlas-v2';
  const ATLAS_URL = './assets/seed-man/seed-man-atlas-v2.svg';
  const FRAME = 256;
  const frameMap = Object.freeze({
    idleA:[0,0], idleB:[1,0], runA:[2,0], runB:[3,0], runC:[0,1], runD:[1,1],
    jump:[2,1], fall:[3,1], land:[0,2], attackA:[1,2], attackB:[2,2], hurt:[3,2],
    victory:[0,3], fire:[1,3], electric:[2,3], ice:[3,3]
  });
  const phenotypeVisuals = Object.freeze({
    'solar-flare': { frame:'fire', kind:'fire', armor:'#f04d1f', armor2:'#9b2015', crest:'#ff6b2f', light:'#fff2d6', glow:'#ff9d3d' },
    'static-haze': { frame:'electric', kind:'electric', armor:'#e6bd21', armor2:'#8a6412', crest:'#ffe34d', light:'#fff8d3', glow:'#fff37a' },
    'frost-resin': { frame:'ice', kind:'ice', armor:'#31aee8', armor2:'#1768a5', crest:'#66d9ff', light:'#ecfbff', glow:'#b7f3ff' }
  });
  let installed = false;
  let fallbackRenderer = null;
  let lastGrounded = true;
  let landUntil = 0;
  let attackUntil = 0;
  let lastAttackToken = '';

  function state(){ try { return typeof player !== 'undefined' ? player : null; } catch { return null; } }
  function combat(){ try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null; } catch { return null; } }
  function activePhenotype(){ return phenotypeVisuals[combat()?.activePhenotype] || null; }
  function detectTransient(now,s){
    if (lastGrounded === false && s?.grounded) landUntil = now + 130;
    lastGrounded = Boolean(s?.grounded);
    const c = combat();
    const token = String(c?.lastAttackAt || c?.attackSerial || c?.shotsFired || '');
    if (token && token !== lastAttackToken) { lastAttackToken = token; attackUntil = now + 160; }
    if (s?.state === 'attack' || s?.state === 'ability') attackUntil = Math.max(attackUntil, now + 90);
  }
  function pose(now=performance.now()){
    const s=state(); if(!s) return 'idleA'; detectTransient(now,s);
    if(s.finished||s.state==='finish') return 'victory';
    if(s.state==='hurt'||s.state==='shield-bounce') return 'hurt';
    if(attackUntil>now) return Math.floor(now/70)%2?'attackA':'attackB';
    if(landUntil>now) return 'land';
    if(!s.grounded) return Number(s.vy)<-20?'jump':'fall';
    if(Math.abs(Number(s.vx)||0)>14) return ['runA','runB','runC','runD'][Math.floor(now/75)%4];
    return Math.floor(now/430)%2?'idleA':'idleB';
  }
  function geometry(s){
    const size=Math.max(82,Math.min(110,Number(s.height||48)*2.08));
    const camera=typeof cameraX==='number'?cameraX:0;
    return {size,x:Number(s.x||0)-camera+Number(s.width||38)/2,y:Number(s.y||0)+Number(s.height||48)+4,facing:Number(s.vx||0)<-1?-1:1};
  }
  function path(points, close=false){ ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]); for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]); if(close)ctx.closePath(); }
  function ellipse(x,y,rx,ry,fill,stroke='#102018',lw=2){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();} }
  function poly(points,fill,stroke='#102018',lw=2){ path(points,true);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke();} }
  function palette(){
    const p=activePhenotype();
    return p || {kind:'plant',armor:'#39b54a',armor2:'#126b36',crest:'#62d64e',light:'#f3f7ee',glow:'#69ff73'};
  }
  function drawElementalVfx(kind,accent,glow,size,now){
    if(!kind||kind==='plant') return;
    const t=now*.001; ctx.save(); ctx.globalCompositeOperation='screen'; ctx.strokeStyle=accent; ctx.fillStyle=accent; ctx.shadowColor=glow; ctx.shadowBlur=14; ctx.globalAlpha=.82;
    if(kind==='fire'){
      for(let i=0;i<5;i++){const a=t*2.8+i*1.2, r=size*(.39+(i%2)*.04), x=Math.cos(a)*r, y=-size*.46+Math.sin(a)*size*.16;ctx.beginPath();ctx.moveTo(x-3,y+8);ctx.quadraticCurveTo(x+7,y-7,x,y-16);ctx.quadraticCurveTo(x-8,y-4,x-3,y+8);ctx.fill();}
    } else if(kind==='electric'){
      ctx.lineWidth=2.7;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*size*.32,-size*.68);ctx.lineTo(side*size*.18,-size*.49);ctx.lineTo(side*size*.31,-size*.42);ctx.lineTo(side*size*.12,-size*.17);ctx.stroke();}
    } else if(kind==='ice'){
      for(let i=0;i<4;i++){const a=t*.8+i*Math.PI/2;ctx.save();ctx.translate(Math.cos(a)*size*.42,-size*.45+Math.sin(a)*size*.15);ctx.rotate(a);poly([[0,-8],[5,0],[0,8],[-5,0]],accent,null);ctx.restore();}
    }
    ctx.restore();
  }
  function drawPhenotypeLayer(visual,g,now){ if(!visual) return; drawElementalVfx(visual.kind,visual.crest,visual.glow,g.size,now); }
  function limb(x1,y1,x2,y2,x3,y3,width,color='#4a3326'){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(x2,y2,x3,y3);ctx.stroke();}
  function boot(x,y,rot,p){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ellipse(0,0,8.8,5.2,p.light,'#102018',2.2);ctx.fillStyle=p.armor;ctx.fillRect(-7,-1,13,3.5);ctx.strokeStyle='#102018';ctx.lineWidth=1.6;ctx.strokeRect(-7,-1,13,3.5);ctx.restore();}
  function glove(x,y,rot,p){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ellipse(0,0,5.7,5,p.light,'#102018',2);ellipse(4,-2,2.2,2.8,p.light,'#102018',1.4);ctx.restore();}
  function helmetCrest(p,poseName){
    const sway=poseName.startsWith('run')?Math.sin(performance.now()*.018)*1.2:0;
    poly([[-13,-54],[-24+sway,-64],[-18,-47]],p.crest,'#102018',2.2);
    poly([[-6,-57],[-13+sway,-72],[0,-60]],p.crest,'#102018',2.2);
    poly([[1,-60],[8+sway,-75],[13,-57]],p.crest,'#102018',2.2);
    poly([[8,-57],[21+sway,-68],[17,-49]],p.crest,'#102018',2.2);
  }
  function drawHero(name,g,now){
    const p=palette(); const run=Math.sin(now*.018); const attack=name.startsWith('attack');
    let la=0,ra=0,ll=0,rl=0,bodyTilt=0,bodyY=0;
    if(name.startsWith('run')){la=run*9;ra=-run*9;ll=-run*8;rl=run*8;bodyTilt=-run*.04;}
    else if(name==='jump'){la=-7;ra=7;ll=-6;rl=5;bodyTilt=-.08;bodyY=-2;}
    else if(name==='fall'){la=5;ra=-5;ll=4;rl=-4;bodyTilt=.06;}
    else if(name==='land'){ll=-2;rl=2;bodyY=3;}
    else if(name==='hurt'){la=-6;ra=6;bodyTilt=.16;}
    else if(name==='victory'){la=-13;ra=13;ll=-2;rl=2;bodyY=-2;}
    else if(attack){ra=attack?-15:0;la=2;bodyTilt=-.05;}

    ctx.save(); ctx.translate(g.x,g.y); ctx.scale(g.facing,1); ctx.scale(g.size/100,g.size/100); ctx.rotate(bodyTilt); ctx.translate(0,bodyY);
    if(name==='hurt') ctx.globalAlpha=.72+Math.abs(Math.sin(now*.03))*.28;
    drawPhenotypeLayer(activePhenotype(),{...g,size:100,x:0,y:0,facing:1},now);

    ctx.save();ctx.globalAlpha=.2;ellipse(0,1,23,4,'#06120b',null);ctx.restore();

    // legs and white/green armored boots from the approved showcase.
    limb(-8,-13,-12,-4,-12+ll,3,7,'#273126'); limb(8,-13,12,-4,12+rl,3,7,'#273126');
    boot(-14+ll,6,name.startsWith('run')?-run*.18:-.06,p); boot(14+rl,6,name.startsWith('run')?run*.18:.06,p);

    // compact dark undersuit and segmented white/green torso armor.
    poly([[-15,-36],[-20,-16],[-10,-7],[10,-7],[20,-16],[15,-36]],'#173529','#102018',3);
    poly([[-14,-35],[-4,-31],[-4,-12],[-14,-15],[-18,-25]],p.light,'#102018',2.2);
    poly([[14,-35],[4,-31],[4,-12],[14,-15],[18,-25]],p.light,'#102018',2.2);
    poly([[-6,-32],[6,-32],[10,-17],[0,-10],[-10,-17]],p.armor,'#102018',2.2);
    ellipse(0,-20,3.3,3.3,p.crest,'#102018',1.5);

    // brown exposed upper arms + white gauntlets exactly matching the reference language.
    limb(-15,-31,-24,-25,-27+la,-17,7,'#7b4b2a'); limb(15,-31,24,-25,27+ra,-17,7,'#7b4b2a');
    poly([[-19,-33],[-25,-31],[-28,-25],[-21,-22],[-16,-26]],p.light,'#102018',2);
    poly([[19,-33],[25,-31],[28,-25],[21,-22],[16,-26]],p.light,'#102018',2);
    glove(-29+la,-15,name==='victory'?-0.7:-.18,p); glove(29+ra,-15,name==='victory'?0.7:attack?-0.05:.18,p);

    // large green leaf helmet with dark face frame and orange forehead gem.
    ellipse(0,-47,20,18,p.armor2,'#102018',3);
    poly([[-18,-50],[-12,-64],[0,-69],[13,-62],[19,-49],[14,-35],[-14,-35]],p.armor,'#102018',3);
    helmetCrest(p,name);
    poly([[-13,-48],[-8,-57],[0,-60],[8,-57],[13,-48],[10,-37],[-10,-37]],'#184d3d','#102018',2);
    ellipse(0,-46,11.5,9.5,'#d8a171','#102018',2);
    // eyes and brows.
    ellipse(-4,-48,2.4,3.1,'#ffffff','#102018',1.2);ellipse(4,-48,2.4,3.1,'#ffffff','#102018',1.2);
    ellipse(-3.5,-48,1,1.5,'#173329',null);ellipse(4.4,-48,1,1.5,'#173329',null);
    ctx.strokeStyle='#102018';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-7,-53);ctx.lineTo(-2,-54);ctx.moveTo(2,-54);ctx.lineTo(7,-53);ctx.stroke();
    ctx.beginPath();ctx.arc(0,-43,4.6,.2,Math.PI-.2);ctx.stroke();
    // orange gem centered on the helmet crown.
    poly([[0,-63],[5,-58],[0,-52],[-5,-58]],'#f5a623','#102018',1.8);

    if(attack){
      ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowColor=p.glow;ctx.shadowBlur=14;ctx.fillStyle=p.kind==='fire'?'#ff6b2f':p.kind==='electric'?'#ffe34d':p.kind==='ice'?'#66d9ff':'#65f060';
      const sx=42+ra;ctx.beginPath();ctx.moveTo(sx,-18);ctx.quadraticCurveTo(sx+16,-29,sx+31,-18);ctx.quadraticCurveTo(sx+16,-7,sx,-18);ctx.fill();ctx.restore();
    }
    ctx.restore(); return true;
  }
  function drawFrame(name){ const s=state(); if(!s||typeof ctx==='undefined'||!ctx)return false; const g=geometry(s); const now=performance.now(); return drawHero(name,g,now); }
  function renderer(){ if(!drawFrame(pose())) fallbackRenderer?.(); }
  function install({force=false}={}){
    if(typeof window.drawSeedMan!=='function') return false;
    if(!fallbackRenderer&&window.drawSeedMan!==renderer) fallbackRenderer=window.drawSeedMan;
    if(installed&&!force&&window.drawSeedMan===renderer) return true;
    window.drawSeedMan=renderer; installed=true;
    document.documentElement.dataset.seedManSpriteRuntime=VERSION;
    document.documentElement.dataset.seedManSpriteVisual='approved-showcase-green-hero-v1';
    document.documentElement.dataset.seedManSpriteAtlas=ATLAS_VERSION;
    document.documentElement.dataset.seedManRendererOwner=VERSION;
    document.documentElement.dataset.seedManReference='2026-09-08-approved-showcase-sheet';
    return window.drawSeedMan===renderer;
  }
  install();
  window.addEventListener('DOMContentLoaded',()=>install({force:true}),{once:true});
  window.addEventListener('sprout:level-selected',()=>install({force:true}));
  window.__SPROUT_SPRITE_RUNTIME_V2__=Object.freeze({
    version:VERSION,visualEnhancement:VISUAL_ENHANCEMENT,atlasVersion:ATLAS_VERSION,atlasUrl:ATLAS_URL,frames:frameMap,pose,
    snapshot:()=>({installed,atlasReady:true,atlasFailed:false,pose:pose(),activePhenotype:Boolean(activePhenotype()),visualEnhancement:VISUAL_ENHANCEMENT,rendererOwner:window.drawSeedMan===renderer?VERSION:'other',reference:'approved-showcase-green-hero'}),
    reinstall:()=>install({force:true})
  });
})();
