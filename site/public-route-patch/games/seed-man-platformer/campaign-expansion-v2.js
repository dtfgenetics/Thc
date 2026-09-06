'use strict';

(() => {
  const EXPERIENCE_VERSION = 'seed-man-campaign-experience-v2';
  const PROGRESS_KEY = 'dtf-seed-man-campaign-v2';
  const BEST_PREFIX = 'dtf-seed-man-best-v2:';
  const POWER_TYPES = ['speed', 'shield', 'magnet', 'jump'];
  const PACK = {
    schemaVersion: 2,
    generator: 'seed-man-course-v2',
    levels: [
      {id:'nursery-night-shift',name:'Nursery Night Shift',levelNumber:2,theme:'nursery',setting:'Moonlit propagation nursery with glowing clone racks and mist lanes',difficulty:1,worldWidth:4200,requiredPickups:16,segmentLength:520,gaps:[90,100,90,110,95,100],elevations:[390,330,370,300,355,315],extraHighPlatforms:0,spikeCount:2,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#10172d',far:'#243653',ground:'#315943',accent:'#7cf4b5',hazard:'#ff7d7d'},mechanic:{type:'bounce-pads',count:3,strength:760}},
      {id:'reservoir-run',name:'Reservoir Run',levelNumber:3,theme:'hydro',setting:'Flooded hydro reservoir catwalks above rushing nutrient channels',difficulty:2,worldWidth:4400,requiredPickups:18,segmentLength:520,gaps:[100,110,95,120,100,110,95],elevations:[360,300,380,320,280,350,305],extraHighPlatforms:0,spikeCount:2,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#09243a',far:'#12627b',ground:'#315d68',accent:'#5be0ff',hazard:'#ff9e57'},mechanic:{type:'flow-zones',count:3,forceX:135,forceY:0},boss:{id:'phantom-pump',name:'The Phantom Pump',style:'pump',requiredHits:3,width:92,height:96,bounce:610,accent:'#69e8ff'}},
      {id:'root-zone-rumble',name:'Root Zone Rumble',levelNumber:4,theme:'root-zone',setting:'Oversized root maze beneath the pots with tangled bridges and packed media',difficulty:3,worldWidth:4600,requiredPickups:18,segmentLength:520,gaps:[100,120,110,100,125,105,115],elevations:[390,325,275,350,300,370,315],extraHighPlatforms:0,spikeCount:3,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#241a18',far:'#4f382c',ground:'#6a4c36',accent:'#a9d36e',hazard:'#ff805c'},mechanic:{type:'drag-zones',count:4,drag:0.82}},
      {id:'mycelium-mile',name:'Mycelium Mile',levelNumber:5,theme:'mycelium',setting:'Bioluminescent fungal undergarden with floating spores and mushroom lifts',difficulty:4,worldWidth:4800,requiredPickups:20,segmentLength:520,gaps:[110,100,120,110,130,105,120,95],elevations:[370,300,345,275,335,295,355,310],extraHighPlatforms:0,spikeCount:3,powerupCount:4,checkpointFractions:[0.34,0.68],palette:{sky:'#15132b',far:'#3b2c5d',ground:'#4f4960',accent:'#b38cff',hazard:'#ff77a8'},mechanic:{type:'updraft-zones',count:4,forceY:-210}},
      {id:'trichome-transit',name:'Trichome Transit',levelNumber:6,theme:'trichome',setting:'Crystal trichome rail yard with resin bridges and glittering gland towers',difficulty:5,worldWidth:5000,requiredPickups:20,segmentLength:520,gaps:[100,120,105,130,110,120,105,130],elevations:[360,285,335,260,320,290,350,275],extraHighPlatforms:0,spikeCount:4,powerupCount:4,checkpointFractions:[0.34,0.68],palette:{sky:'#18253a',far:'#42647a',ground:'#69797f',accent:'#d8fbff',hazard:'#ff6689'},mechanic:{type:'boost-zones',count:4,forceX:280,forceY:-25},boss:{id:'mite-queen',name:'Mite Queen',style:'mite',requiredHits:4,width:104,height:86,bounce:650,accent:'#ff708d'}},
      {id:'kief-cavern-climb',name:'Kief Cavern Climb',levelNumber:7,theme:'cavern',setting:'Golden kief cavern with crystal dust vents and steep ledge climbs',difficulty:6,worldWidth:5200,requiredPickups:22,segmentLength:480,gaps:[120,110,130,115,125,120,110,130,115],elevations:[380,315,250,330,270,350,285,240,325],extraHighPlatforms:2,spikeCount:4,powerupCount:4,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#1c1710',far:'#5a4524',ground:'#79623d',accent:'#f5d66d',hazard:'#ff784f'},mechanic:{type:'bounce-pads',count:4,strength:820}},
      {id:'rosin-refinery-rush',name:'Rosin Refinery Rush',levelNumber:8,theme:'refinery',setting:'Industrial rosin works with hot presses, warning lights and pressure vents',difficulty:7,worldWidth:5400,requiredPickups:22,segmentLength:480,gaps:[110,130,120,140,115,125,135,110,130],elevations:[360,300,345,275,320,255,335,285,350],extraHighPlatforms:2,spikeCount:5,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#231a18',far:'#55352f',ground:'#6a5148',accent:'#ffb45d',hazard:'#ff4f4f'},mechanic:{type:'heat-vents',count:4,forceY:-285}},
      {id:'terpene-tunnel',name:'Terpene Tunnel',levelNumber:9,theme:'terpene',setting:'Aromatic tunnel network with shifting vapor currents and neon terpene chambers',difficulty:8,worldWidth:5600,requiredPickups:24,segmentLength:480,gaps:[120,130,110,140,125,135,115,145,120,130],elevations:[350,275,330,250,305,280,340,260,315,285],extraHighPlatforms:3,spikeCount:5,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#17182f',far:'#433c78',ground:'#4e5371',accent:'#d28cff',hazard:'#ff647c'},mechanic:{type:'gust-zones',count:5,forceX:190,alternate:true},boss:{id:'mildew-wraith',name:'Mildew Wraith',style:'wraith',requiredHits:4,width:110,height:98,bounce:675,accent:'#d9e9d2'}},
      {id:'frostline-canopy',name:'Frostline Canopy',levelNumber:10,theme:'frost',setting:'High frozen canopy bridges coated in sparkling resin frost',difficulty:9,worldWidth:5800,requiredPickups:24,segmentLength:480,gaps:[125,140,120,135,145,125,140,120,135,145],elevations:[340,265,320,245,300,270,330,250,310,275],extraHighPlatforms:3,spikeCount:6,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#101d32',far:'#31546a',ground:'#526d78',accent:'#c9f6ff',hazard:'#fe6f8a'},mechanic:{type:'slip-zones',count:5,boost:1.018,maxSpeed:390}},
      {id:'cloud-nine-citadel',name:'Cloud Nine Citadel',levelNumber:11,theme:'citadel',setting:'Floating sky garden fortress above the clouds with wind bridges and the final gate',difficulty:10,worldWidth:6200,requiredPickups:26,segmentLength:480,gaps:[130,145,125,150,135,140,130,150,125,145,135],elevations:[330,250,310,235,295,260,320,240,300,250,285],extraHighPlatforms:3,spikeCount:6,powerupCount:6,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#16233f',far:'#526b9a',ground:'#667a91',accent:'#ffe27a',hazard:'#ff6681'},mechanic:{type:'wind-zones',count:6,forceX:220,alternate:true},boss:{id:'pollen-warden',name:'Pollen Warden',style:'warden',requiredHits:5,width:118,height:108,bounce:710,accent:'#ffe27a'}}
    ]
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const overlapsRect = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function groundPlatformsFor(template) {
    const platforms = [], hazards = [];
    let x = 0, gapIndex = 0;
    while (x < template.worldWidth) {
      const remaining = template.worldWidth - x;
      if (remaining <= template.segmentLength) { platforms.push({x,y:480,width:remaining,height:60}); break; }
      platforms.push({x,y:480,width:template.segmentLength,height:60});
      const gap = template.gaps[gapIndex % template.gaps.length];
      hazards.push({x:x + template.segmentLength,y:500,width:gap,height:40});
      x += template.segmentLength + gap;
      gapIndex += 1;
    }
    return {platforms,hazards};
  }

  function upperPlatformsFor(template) {
    const platforms = template.elevations.map((y,index) => ({x:Math.round(240 + index * ((template.worldWidth - 600) / Math.max(1,template.elevations.length - 1))),y,width:160 + (index % 3) * 20,height:24}));
    const extra = Math.max(0, Math.min(3, Number(template.extraHighPlatforms) || 0));
    for (let index = 0; index < extra; index += 1) {
      const fraction = extra === 1 ? 0.5 : 0.34 + index * (0.56 / (extra - 1));
      platforms.push({x:Math.round(template.worldWidth * fraction),y:220 - (index % 2) * 25,width:150 - (index === 2 ? 5 : 0),height:24});
    }
    return platforms;
  }

  function safeGroundX(platforms, desired, margin = 60) {
    const containing = platforms.find((p) => p.width >= margin * 2 && desired >= p.x + margin && desired <= p.x + p.width - margin);
    if (containing) return Math.round(desired);
    const candidates = platforms.filter((p) => p.width >= margin * 2).sort((a,b) => Math.abs((a.x+a.width/2)-desired)-Math.abs((b.x+b.width/2)-desired));
    if (!candidates.length) return Math.round(desired);
    const p = candidates[0];
    return Math.round(clamp(desired,p.x+margin,p.x+p.width-margin));
  }

  function generateCourse(template) {
    const ground = groundPlatformsFor(template);
    const upper = upperPlatformsFor(template);
    const hazards = [...ground.hazards];
    for (let i = 0; i < template.spikeCount; i += 1) {
      const usable = Math.max(400, template.worldWidth - 1800);
      const x = template.spikeCount === 1 ? template.worldWidth / 2 : 980 + i * (usable / (template.spikeCount - 1));
      hazards.push({x:Math.round(x),y:452,width:48 + (i % 2) * 10,height:28});
    }
    const pickups = [];
    for (const p of upper) {
      if (pickups.length >= template.requiredPickups) break;
      pickups.push({id:`sprout-${String(template.levelNumber).padStart(2,'0')}-${String(pickups.length+1).padStart(2,'0')}`,x:Math.round(p.x+p.width/2-11),y:p.y-45,width:22,height:22});
    }
    const remaining = template.requiredPickups - pickups.length;
    for (let i = 0; i < remaining; i += 1) {
      const desired = remaining === 1 ? template.worldWidth/2 : 180 + i * ((template.worldWidth - 420) / (remaining - 1));
      pickups.push({id:`sprout-${String(template.levelNumber).padStart(2,'0')}-${String(pickups.length+1).padStart(2,'0')}`,x:safeGroundX(ground.platforms,desired,50),y:425,width:22,height:22});
    }
    const powerups = Array.from({length:template.powerupCount},(_,i) => {
      const fraction = template.powerupCount === 1 ? 0.5 : 0.18 + i * (0.64 / (template.powerupCount - 1));
      const type = POWER_TYPES[(i + template.levelNumber) % POWER_TYPES.length];
      const value = {id:`power-${type}-${String(template.levelNumber).padStart(2,'0')}-${i+1}`,type,x:safeGroundX(ground.platforms,template.worldWidth*fraction,55),y:425,width:28,height:28};
      if (type === 'speed') value.duration = 8; else if (type === 'magnet') value.duration = 11; else if (type === 'jump') value.duration = 10;
      return value;
    });
    const checkpoints = template.checkpointFractions.map((fraction,i) => { const x=safeGroundX(ground.platforms,template.worldWidth*fraction,80); return {id:`checkpoint-${String(template.levelNumber).padStart(2,'0')}-${i+1}`,x,y:420,width:50,height:60,respawnX:Math.max(60,x-20),respawnY:400}; });
    const zones = Array.from({length:template.mechanic.count},(_,i) => {
      const fraction = template.mechanic.count === 1 ? 0.5 : 0.16 + i * (0.68 / (template.mechanic.count - 1));
      const x=safeGroundX(ground.platforms,template.worldWidth*fraction,90); const alt=template.mechanic.alternate && i%2===1?-1:1;
      return {id:`mechanic-${String(template.levelNumber).padStart(2,'0')}-${i+1}`,type:template.mechanic.type,x,y:template.mechanic.type==='bounce-pads'?462:360,width:template.mechanic.type==='bounce-pads'?62:150,height:template.mechanic.type==='bounce-pads'?18:120,strength:template.mechanic.strength||0,forceX:(template.mechanic.forceX||0)*alt,forceY:template.mechanic.forceY||0,drag:template.mechanic.drag||1,boost:template.mechanic.boost||1,maxSpeed:template.mechanic.maxSpeed||0};
    });
    let boss=null;
    if (template.boss) {
      const x=safeGroundX(ground.platforms,template.worldWidth*0.84,150), width=template.boss.width||100, height=template.boss.height||90;
      boss={...template.boss,x:Math.round(x-width/2),y:480-height,arenaStartX:Math.round(template.worldWidth*0.74),arenaEndX:Math.round(template.worldWidth*0.92),speed:38+template.difficulty*4,hits:0,defeated:false};
    }
    return {schemaVersion:3,id:template.id,name:`Sprout Run: ${template.name}`,levelNumber:template.levelNumber,theme:template.theme,setting:template.setting,difficulty:template.difficulty,palette:{...template.palette},worldWidth:template.worldWidth,worldHeight:540,requiredPickups:template.requiredPickups,spawn:{x:80,y:390},platforms:[...ground.platforms,...upper],hazards,pickups,powerups,checkpoints,mechanicZones:zones,boss,finish:{x:safeGroundX(ground.platforms,template.worldWidth-90,60),y:390,width:50,height:90}};
  }

  const generated = new Map(PACK.levels.map((template) => [template.id, generateCourse(template)]));
  let bossState = null;
  let bossDirection = 1;
  let bossCooldown = 0;
  let completionRecorded = false;

  function campaignLevelValidator(candidate) {
    if (!candidate || !['sprout-run', ...generated.keys()].includes(candidate.id)) throw new Error('unknown Seed Man campaign level');
    if (![2,3].includes(candidate.schemaVersion) || candidate.worldHeight !== 540 || candidate.worldWidth < 3000) throw new Error('campaign level contract mismatch');
    for (const key of ['platforms','hazards','pickups','powerups','checkpoints']) if (!Array.isArray(candidate[key])) throw new Error(`campaign level missing ${key}`);
    if (!candidate.spawn || !candidate.finish || candidate.requiredPickups < 1 || candidate.pickups.length < candidate.requiredPickups) throw new Error('campaign level objective contract mismatch');
    return candidate;
  }

  function readProgress() {
    try { const parsed=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}'); return {completed:Array.isArray(parsed.completed)?parsed.completed:[],lastLevelId:parsed.lastLevelId||'sprout-run'}; } catch { return {completed:[],lastLevelId:'sprout-run'}; }
  }
  function writeProgress(value) { try { localStorage.setItem(PROGRESS_KEY,JSON.stringify(value)); } catch {} }
  function markComplete(levelId) { const state=readProgress(); if(!state.completed.includes(levelId)) state.completed.push(levelId); state.lastLevelId=levelId; writeProgress(state); refreshSelector(); }
  function bestKey() { return `${BEST_PREFIX}${level?.id || 'sprout-run'}`; }

  function resetBoss() {
    bossState = level?.boss ? JSON.parse(JSON.stringify(level.boss)) : null;
    bossDirection = 1;
    bossCooldown = 0;
    completionRecorded = false;
    updateBossHud();
  }

  function updateBoss(dt) {
    if (!bossState || bossState.defeated) return;
    bossCooldown = Math.max(0,bossCooldown-dt);
    bossState.x += bossDirection * bossState.speed * dt;
    if (bossState.x <= bossState.arenaStartX) { bossState.x=bossState.arenaStartX; bossDirection=1; }
    if (bossState.x + bossState.width >= bossState.arenaEndX) { bossState.x=bossState.arenaEndX-bossState.width; bossDirection=-1; }
  }

  function resolveZones(next, previous, dt) {
    for (const zone of level?.mechanicZones || []) {
      if (zone.type === 'bounce-pads') {
        const prevFeet=previous.y+previous.height, nextFeet=next.y+next.height;
        if (next.vy>=0 && next.x+next.width>zone.x+4 && next.x<zone.x+zone.width-4 && prevFeet<=zone.y+6 && nextFeet>=zone.y-4) {
          next.y=zone.y-next.height; next.vy=-(zone.strength||760); next.grounded=false; next.coyote=0; next.airJumpsRemaining=Math.max(1,next.airJumpsRemaining); next.state='campaign-bounce';
        }
        continue;
      }
      if (!overlapsRect(next,zone)) continue;
      if (['flow-zones','gust-zones','wind-zones'].includes(zone.type)) next.vx=clamp(next.vx+zone.forceX*dt,-430,430);
      else if (zone.type==='drag-zones') next.vx*=zone.drag;
      else if (['updraft-zones','heat-vents'].includes(zone.type)) next.vy=clamp(next.vy+zone.forceY*dt,-820,900);
      else if (zone.type==='boost-zones') { next.vx=clamp(next.vx+zone.forceX*dt*2,-450,450); next.vy=clamp(next.vy+zone.forceY*dt,-820,900); }
      else if (zone.type==='slip-zones' && Math.abs(next.vx)>1) next.vx=clamp(next.vx*zone.boost,-(zone.maxSpeed||390),zone.maxSpeed||390);
      if (!next.grounded && next.state!=='hurt') next.state=`mechanic-${zone.type}`;
    }
  }

  function resolveBoss(next, previous) {
    if (!bossState || bossState.defeated) return;
    if (next.finished) { next.finished=false; next.finishBlocked=true; next.x=Math.min(next.x,level.finish.x-next.width); next.state='boss-gated'; }
    if (!overlapsRect(next,bossState)) return;
    const previousFeet=previous.y+previous.height;
    const stomp=previous.vy>=0 && next.vy>=0 && previousFeet<=bossState.y+14;
    if (stomp && bossCooldown<=0) {
      bossState.hits+=1; bossCooldown=0.38; next.y=bossState.y-next.height; next.vy=-(bossState.bounce||640); next.grounded=false; next.airJumpsRemaining=Math.max(1,next.airJumpsRemaining); next.state='boss-bounce';
      if (bossState.hits>=bossState.requiredHits) { bossState.defeated=true; next.state='boss-defeated'; }
      updateBossHud(); return;
    }
    if ((next.power?.invulnerableTimer||0)>0) return;
    const knock=next.x+next.width/2<bossState.x+bossState.width/2?-1:1;
    if ((next.power?.shieldCharges||0)>0) { next.power.shieldCharges-=1; next.power.invulnerableTimer=Math.max(next.power.invulnerableTimer||0,DEFAULTS.shieldInvulnerability); next.vx=knock*360; next.vy=-340; next.state='shield-bounce'; }
    else if (typeof respawn==='function') respawn(next,DEFAULTS);
  }

  function drawThemeBackground(baseDraw) {
    if (!level?.palette || level.id==='sprout-run') return baseDraw();
    const p=level.palette;
    ctx.fillStyle=p.sky; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.globalAlpha=.88; ctx.fillStyle=p.far;
    const t=performance.now()/1000, scroll=(cameraX*.12)%220;
    if (level.theme==='nursery') for(let x=-scroll;x<canvas.width+140;x+=160){ctx.fillRect(x,170,105,245);ctx.fillStyle=p.accent;ctx.globalAlpha=.12;ctx.fillRect(x+14,195,77,12);ctx.fillRect(x+14,235,77,12);ctx.fillRect(x+14,275,77,12);ctx.fillStyle=p.far;ctx.globalAlpha=.88;}
    else if (level.theme==='hydro') for(let x=-scroll;x<canvas.width+220;x+=230){ctx.fillRect(x,300,180,22);ctx.fillRect(x+35,220,28,100);ctx.strokeStyle=p.accent;ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+130,275,40,0,Math.PI*2);ctx.stroke();}
    else if (level.theme==='root-zone') {ctx.strokeStyle=p.accent;ctx.lineWidth=5;for(let x=-scroll;x<canvas.width+100;x+=130){ctx.beginPath();ctx.moveTo(x,100);ctx.bezierCurveTo(x+80,190,x-30,300,x+70,455);ctx.stroke();}}
    else if (level.theme==='mycelium') for(let x=-scroll;x<canvas.width+120;x+=120){const y=300+Math.sin((x+t*20)*.02)*35;ctx.beginPath();ctx.arc(x,y,28,Math.PI,0);ctx.fill();ctx.fillRect(x-4,y,8,80);}
    else if (level.theme==='trichome') for(let x=-scroll;x<canvas.width+120;x+=100){ctx.beginPath();ctx.moveTo(x,420);ctx.lineTo(x+30,250);ctx.lineTo(x+60,420);ctx.closePath();ctx.fill();ctx.fillStyle=p.accent;ctx.globalAlpha=.2;ctx.beginPath();ctx.arc(x+30,245,18,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.far;ctx.globalAlpha=.88;}
    else if (level.theme==='cavern') for(let x=-scroll;x<canvas.width+120;x+=110){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+38,120+(x%90));ctx.lineTo(x+75,0);ctx.fill();ctx.beginPath();ctx.moveTo(x+25,540);ctx.lineTo(x+55,420-(x%70));ctx.lineTo(x+85,540);ctx.fill();}
    else if (level.theme==='refinery') for(let x=-scroll;x<canvas.width+220;x+=210){ctx.fillRect(x,180,100,240);ctx.fillRect(x+30,110,38,70);ctx.fillRect(x+120,255,58,165);ctx.fillStyle=p.accent;ctx.globalAlpha=.15;ctx.fillRect(x+8,205,84,10);ctx.fillStyle=p.far;ctx.globalAlpha=.88;}
    else if (level.theme==='terpene') for(let x=-scroll;x<canvas.width+120;x+=105){ctx.strokeStyle=p.accent;ctx.globalAlpha=.2+.08*Math.sin(t+x);ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,250+Math.sin(x*.03)*80,34,0,Math.PI*2);ctx.stroke();}
    else if (level.theme==='frost') for(let x=-scroll;x<canvas.width+140;x+=130){ctx.fillRect(x,330,100,90);ctx.strokeStyle=p.accent;ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(x+50,315);ctx.lineTo(x+50,365);ctx.moveTo(x+25,340);ctx.lineTo(x+75,340);ctx.stroke();}
    else if (level.theme==='citadel') for(let x=-scroll;x<canvas.width+240;x+=240){ctx.fillRect(x,260,165,160);ctx.fillRect(x+35,205,34,55);ctx.fillRect(x+100,185,34,75);ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.ellipse(x+80,450,120,28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.far;}
    ctx.restore();
  }

  function drawZone(zone) {
    const x=zone.x-cameraX, p=level.palette||{accent:'#c8f36a'};
    ctx.save(); ctx.globalAlpha=.32; ctx.fillStyle=p.accent; ctx.strokeStyle=p.accent; ctx.lineWidth=2;
    if(zone.type==='bounce-pads'){ctx.fillRect(x,zone.y,zone.width,zone.height);ctx.globalAlpha=.95;ctx.fillStyle=p.accent;ctx.fillText('BOOST',x+8,zone.y+14);}
    else {ctx.fillRect(x,zone.y,zone.width,zone.height);ctx.globalAlpha=.9;ctx.font='800 9px system-ui';ctx.fillText(zone.type.replace('-zones','').replace('-',' ').toUpperCase(),x+8,zone.y+16);}
    ctx.restore();
  }

  function drawBoss() {
    if(!bossState || bossState.defeated) return;
    const x=bossState.x-cameraX, y=bossState.y, c=bossState.accent||level.palette?.accent||'#fff';
    ctx.save();ctx.translate(x+bossState.width/2,y+bossState.height/2);ctx.strokeStyle='#171817';ctx.lineWidth=4;ctx.fillStyle=c;
    if(bossState.style==='pump'){ctx.fillRect(-28,-34,56,68);ctx.strokeRect(-28,-34,56,68);ctx.beginPath();ctx.arc(0,-34,28,Math.PI,0);ctx.fill();ctx.stroke();ctx.strokeStyle=c;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(28,5);ctx.lineTo(45,5);ctx.lineTo(45,30);ctx.stroke();}
    else if(bossState.style==='mite'){ctx.beginPath();ctx.ellipse(0,0,38,29,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(const s of [-1,1])for(const yy of [-20,0,20]){ctx.beginPath();ctx.moveTo(s*28,yy*.55);ctx.lineTo(s*53,yy);ctx.stroke();}}
    else if(bossState.style==='wraith'){ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(0,-8,35,Math.PI,0);ctx.lineTo(34,28);ctx.quadraticCurveTo(18,18,8,30);ctx.quadraticCurveTo(-5,18,-17,30);ctx.quadraticCurveTo(-25,18,-34,28);ctx.closePath();ctx.fill();ctx.stroke();}
    else {ctx.beginPath();ctx.ellipse(0,7,40,35,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff2a8';ctx.beginPath();ctx.moveTo(-30,-25);ctx.lineTo(-14,-48);ctx.lineTo(0,-27);ctx.lineTo(17,-49);ctx.lineTo(31,-24);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.fillStyle='#171817';ctx.beginPath();ctx.arc(-12,-8,4,0,Math.PI*2);ctx.arc(12,-8,4,0,Math.PI*2);ctx.fill();ctx.restore();
    const width=150, ratio=(bossState.requiredHits-bossState.hits)/bossState.requiredHits;ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(canvas.width/2-width/2,22,width,12);ctx.fillStyle=c;ctx.fillRect(canvas.width/2-width/2+2,24,(width-4)*ratio,8);ctx.fillStyle='#fff';ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillText(`${bossState.name} · ${bossState.requiredHits-bossState.hits} hits`,canvas.width/2,17);ctx.textAlign='start';
  }

  let selector=null,bossHud=null,nextButton=null;
  function updateBossHud(){if(!bossHud)return;if(!bossState){bossHud.hidden=true;return;}bossHud.hidden=false;bossHud.textContent=bossState.defeated?`Boss defeated · Finish open`:`${bossState.name} · ${bossState.requiredHits-bossState.hits} stomps left`;}
  function refreshSelector(){if(!selector)return;const done=new Set(readProgress().completed);for(const option of selector.options){const meta=window.__SPROUT_CAMPAIGN__?.getLevel(option.value);option.textContent=`${meta?.order||'?'} · ${meta?.title||option.value}${done.has(option.value)?' ✓':''}`;}selector.value=level?.id||'sprout-run';}
  function updateCopy(){const meta=window.__SPROUT_CAMPAIGN__?.getLevel(level?.id);const template=PACK.levels.find((entry)=>entry.id===level?.id);const eyebrow=document.querySelector('.hero .eyebrow');const title=document.querySelector('.hero h1');const lede=document.querySelector('.hero .lede');if(eyebrow)eyebrow.textContent=`Seed Man · Level ${meta?.order||1} / 11 · ${meta?.worldTitle||'Greenhouse District'}`;if(title)title.textContent=meta?.title||'Sprout Run';if(lede)lede.textContent=template?`${template.setting}. Collect ${level.requiredPickups} sprouts, master ${template.mechanic.type.replaceAll('-',' ')}, ${template.boss?`defeat ${template.boss.name}, and `:''}reach the Dream the Future flag.`:'Greenhouse Gauntlet remains the campaign opener.';document.documentElement.dataset.seedManTheme=level?.theme||'greenhouse';}
  function updateNextButton(){if(!nextButton)return;const levels=window.__SPROUT_CAMPAIGN__.listLevels();const index=levels.findIndex((entry)=>entry.id===level?.id);const next=levels[index+1];nextButton.hidden=!next;nextButton.textContent=next?`Next · ${next.title}`:'Campaign complete';nextButton.dataset.nextLevel=next?.id||'';}

  function activateLevel(levelId){const currentDefault=JSON.parse(document.querySelector('#seed-man-level')?.textContent||'{}');const target=levelId==='sprout-run'?currentDefault:generated.get(levelId);if(!target)return false;window.__SPROUT_CAMPAIGN__.selectLevel(levelId);level=campaignLevelValidator(JSON.parse(JSON.stringify(target)));const state=readProgress();state.lastLevelId=levelId;writeProgress(state);reset();resetBoss();updateCopy();refreshSelector();updateNextButton();if(ui?.finish)ui.finish.hidden=true;if(ui?.sprouts)ui.sprouts.textContent=`0 / ${level.requiredPickups}`;if(ui?.load)setObjectiveStatus(`Level ${window.__SPROUT_CAMPAIGN__.getLevel(levelId)?.order} / 11 · collect ${level.requiredPickups} sprouts${level.boss?` · defeat ${level.boss.name}`:''}`,'progress');return true;}

  function installUI(){
    const hero=document.querySelector('.hero'); if(!hero)return;
    const panel=document.createElement('div');panel.className='seed-man-campaign-picker';panel.innerHTML='<label for="seed-man-level-select">Campaign level</label><select id="seed-man-level-select" aria-label="Choose Seed Man level"></select><span class="campaign-progress-note">11 levels · 4 worlds · 4 bosses</span>';
    hero.append(panel); selector=panel.querySelector('select');
    for(const world of window.__SPROUT_CAMPAIGN__.worlds){const group=document.createElement('optgroup');group.label=world.title;for(const entry of world.levels){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.order} · ${entry.title}`;group.append(option);}selector.append(group);}selector.addEventListener('change',()=>activateLevel(selector.value));
    const hud=document.querySelector('.hud');bossHud=document.createElement('span');bossHud.className='boss-hud';bossHud.hidden=true;hud?.prepend(bossHud);
    const finish=document.querySelector('#finish-panel');nextButton=document.createElement('button');nextButton.type='button';nextButton.className='primary seed-man-next-level';nextButton.hidden=true;nextButton.addEventListener('click',()=>{if(nextButton.dataset.nextLevel)activateLevel(nextButton.dataset.nextLevel);});finish?.append(nextButton);
    const style=document.createElement('style');style.textContent='.seed-man-campaign-picker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}.seed-man-campaign-picker label{font-weight:800}.seed-man-campaign-picker select{min-height:44px;max-width:330px;padding:8px 12px;border-radius:10px;background:#10291d;color:#fff;border:1px solid rgba(255,255,255,.25)}.campaign-progress-note{font-size:12px;opacity:.75}.boss-hud{border-color:#ffcc6b!important;color:#fff5cf!important}.seed-man-next-level{margin-left:10px}@media(max-width:640px){.seed-man-campaign-picker{align-items:stretch;flex-direction:column}.seed-man-campaign-picker select{width:100%;max-width:none}}';document.head.append(style);
    refreshSelector();updateNextButton();
  }

  function install() {
    if(typeof reset!=='function'||typeof stepPlayer!=='function'||typeof drawBackground!=='function'||typeof drawPlatforms!=='function'||!window.__SPROUT_CAMPAIGN__){setTimeout(install,25);return;}
    const baseValidate=validateLevel; validateLevel=function(candidate){if(candidate?.id==='sprout-run')return baseValidate(candidate);return campaignLevelValidator(candidate);};
    const legacyReadBest=readBest;readBest=function(){try{const value=Number.parseFloat(localStorage.getItem(bestKey())||'');if(Number.isFinite(value)&&value>0)return value;if(level?.id==='sprout-run')return legacyReadBest();}catch{}return null;};
    writeBest=function(value){try{localStorage.setItem(bestKey(),String(value));}catch{}};
    const baseReset=reset;reset=function campaignReset(){baseReset();resetBoss();};
    const baseStep=stepPlayer;stepPlayer=function campaignStep(inputPlayer,inputState,levelData,dt,config=DEFAULTS){const previous=inputPlayer;updateBoss(dt);const next=baseStep(inputPlayer,inputState,levelData,dt,config);if(next.deaths<=previous.deaths&&!next.finished){resolveZones(next,previous,dt);resolveBoss(next,previous);}else if(next.finished)resolveBoss(next,previous);if(next.finished&&!completionRecorded){completionRecorded=true;markComplete(levelData.id);updateNextButton();}return next;};
    const baseBackground=drawBackground;drawBackground=function campaignBackground(){drawThemeBackground(baseBackground);};
    const basePlatforms=drawPlatforms;drawPlatforms=function campaignPlatforms(){basePlatforms();if(level?.id!=='sprout-run'){for(const zone of level.mechanicZones||[])drawZone(zone);drawBoss();}};
    installUI();
    const progress=readProgress();if(progress.lastLevelId&&progress.lastLevelId!=='sprout-run'&&generated.has(progress.lastLevelId))activateLevel(progress.lastLevelId);else{resetBoss();updateCopy();refreshSelector();}
    if(typeof MutationObserver==='function'&&ui?.finish){new MutationObserver(()=>{if(!ui.finish.hidden&&player?.finished){markComplete(level.id);updateNextButton();}}).observe(ui.finish,{attributes:true,attributeFilter:['hidden']});}
    window.__SPROUT_CAMPAIGN_V2__=Object.freeze({version:EXPERIENCE_VERSION,coursePackVersion:PACK.generator,levelCount:11,bossCount:4,listGeneratedLevels:()=>[...generated.values()].map((entry)=>JSON.parse(JSON.stringify(entry))),activateLevel,snapshot:()=>({levelId:level?.id||null,boss:bossState?{id:bossState.id,hits:bossState.hits,requiredHits:bossState.requiredHits,defeated:bossState.defeated}:null,progress:readProgress()})});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
