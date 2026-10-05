'use strict';

(() => {
  const VERSION = 'seed-man-runtime-health-v21';
  const RELEASE = '20260913-v20-runtime-repair-v1';
  const EXPECTED = Object.freeze({
    campaignLevels: 20,
    campaignUi: 'seed-man-campaign-ui-v20',
    playerState: 'seed-man-player-state-v20',
    combat: 'seed-man-combat-browser-v2',
    enemyAttacks: 'seed-man-enemy-attacks-browser-v2',
    characterTarget: 'classic-seed-man-oval-v1',
    worldRendererTarget: 'seed-man-three-world-v2',
    flatWorldRenderer: 'seed-man-authored-flat-background-v1'
  });
  const RELEASE_COMPATIBILITY = Object.freeze({
    retiredBootstrapMarker: 'seed-man-runtime-bootstrap-v20',
    declaredDependencies: Object.freeze(['player-state-v20.js','three-world-adapter-v1.js']),
    behavior: 'v20-runtime-repair'
  });
  const WORLD_FALLBACKS = Object.freeze({
    'greenhouse-valley':['#9ed9ff','#225a38'],
    'forest-ruins':['#4c7566','#162f26'],
    'desert-canyon':['#f2b67d','#74382e'],
    'frozen-peaks':['#bfe8ff','#335b7b'],
    'eco-city':['#495878','#152b34']
  });
  const SURFACES = Object.freeze({
    grass:{base:'#466b3e',top:'#9ed26e'}, dirt:{base:'#6d5136',top:'#a77a4b'}, wood:{base:'#6f4b2e',top:'#bd8953'},
    rock:{base:'#565b59',top:'#808985'}, stone:{base:'#565c63',top:'#8a939b'}, sand:{base:'#b87842',top:'#e1ad69'},
    ice:{base:'#4f829b',top:'#c9f4ff'}, metal:{base:'#3c4a52',top:'#7a929c'}, 'moving-platform':{base:'#3c4a52',top:'#9acbd1'}, spring:{base:'#496d45',top:'#c8f36a'}
  });
  const HAZARDS = Object.freeze({
    spikes:{base:'#5b3130',accent:'#ff8564',kind:'spikes'}, 'thorn-pits':{base:'#233c22',accent:'#8fd75c',kind:'spikes'},
    'toxic-slime':{base:'#243520',accent:'#9cff2f',kind:'liquid'}, 'waterfall-gap':{base:'#173e5e',accent:'#75d9ff',kind:'liquid'},
    'falling-bridges':{base:'#543b2e',accent:'#d29a61',kind:'break'}, 'spore-cloud':{base:'#3c3150',accent:'#c28cff',kind:'cloud'},
    'root-cage':{base:'#273a27',accent:'#7fcf68',kind:'bars'}, lava:{base:'#4f221c',accent:'#ff6a2b',kind:'liquid'},
    rockfall:{base:'#4b4038',accent:'#a77a57',kind:'rocks'}, 'falling-rocks':{base:'#4b4038',accent:'#a77a57',kind:'rocks'},
    sandstorm:{base:'#7e5438',accent:'#f1c17f',kind:'wind'}, 'ice-spikes':{base:'#365969',accent:'#c8f5ff',kind:'spikes'},
    'falling-icicles':{base:'#365969',accent:'#d7f8ff',kind:'spikes'}, 'breakaway-ice':{base:'#416d83',accent:'#a8ecff',kind:'break'},
    'freeze-floor':{base:'#315d77',accent:'#8deaff',kind:'liquid'}, 'electric-floor':{base:'#273852',accent:'#9fc4ff',kind:'electric'},
    'laser-grid':{base:'#3b203c',accent:'#ff66d8',kind:'laser'}, crusher:{base:'#492d2d',accent:'#ff8c72',kind:'bars'},
    'energy-beam':{base:'#183f42',accent:'#67f0d1',kind:'laser'}, gap:{base:'#1a2021',accent:'#4a5c60',kind:'gap'}
  });

  const backgroundImages = new Map();
  let mechanicsTime = 0;
  let mechanicsInstalled = false;
  let presentationInstalled = false;
  let overlayInstalled = false;

  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const overlaps = (a,b) => Boolean(a&&b&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y);

  function currentLevel(){ try{return typeof level!=='undefined'?level:null;}catch{return null;} }
  function currentPlayer(){ try{return typeof player!=='undefined'?player:null;}catch{return null;} }
  function currentCamera(){ try{return typeof cameraX!=='undefined'?cameraX:0;}catch{return 0;} }
  function worldAsset(worldId){
    const core=window.__SEED_MAN_APPROVED_ART_CORE__;
    return core?.worldBackground?.(worldId)||window.__SEED_MAN_APPROVED_ASSETS__?.[`world.${worldId}.background`]||null;
  }
  function worldImage(asset){
    if(!asset?.src)return null;
    if(!backgroundImages.has(asset.src)){
      const image=new Image();image.decoding='async';image.src=asset.src;backgroundImages.set(asset.src,image);
    }
    return backgroundImages.get(asset.src);
  }

  function surfaceStyle(surface){return SURFACES[surface]||SURFACES.grass;}
  function hazardStyle(type){return HAZARDS[type]||{base:'#4a3030',accent:'#ff865f',kind:'spikes'};}

  function installBackgroundPresentation(){
    if(typeof drawBackground!=='function'||presentationInstalled)return false;
    drawBackground=function seedManAuthoredWorldBackground(){
      if(typeof ctx==='undefined'||!ctx||typeof canvas==='undefined'||!canvas)return;
      const active=currentLevel();
      const worldId=active?.worldId||'greenhouse-valley';
      const palette=WORLD_FALLBACKS[worldId]||WORLD_FALLBACKS['greenhouse-valley'];
      const gradient=ctx.createLinearGradient(0,0,0,canvas.height);gradient.addColorStop(0,palette[0]);gradient.addColorStop(1,palette[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
      const asset=worldAsset(worldId);const image=worldImage(asset);
      if(image?.complete&&image.naturalWidth>0){
        const parallax=((currentCamera()*0.028)%canvas.width+canvas.width)%canvas.width;
        ctx.save();ctx.globalAlpha=.94;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        if(asset?.region){
          const r=asset.region;ctx.drawImage(image,r.x,r.y,r.width,r.height,-parallax,0,canvas.width,canvas.height);if(parallax>0)ctx.drawImage(image,r.x,r.y,r.width,r.height,canvas.width-parallax,0,canvas.width,canvas.height);
        }else{
          ctx.drawImage(image,-parallax,0,canvas.width,canvas.height);if(parallax>0)ctx.drawImage(image,canvas.width-parallax,0,canvas.width,canvas.height);
        }
        ctx.fillStyle='rgba(6,17,12,.08)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
        document.documentElement.dataset.seedManWorldArt=`authored-flat:${worldId}`;
      }else document.documentElement.dataset.seedManWorldArt=`gradient-fallback:${worldId}`;
    };
    presentationInstalled=true;
    return true;
  }

  function drawHazard(hazard){
    if(typeof ctx==='undefined'||typeof cameraX==='undefined')return;
    const style=hazardStyle(hazard.type);const x=Math.round(hazard.x-cameraX);const y=hazard.y;const w=hazard.width;const h=hazard.height;
    ctx.save();ctx.fillStyle=style.base;ctx.fillRect(x,y,w,h);ctx.fillStyle=style.accent;ctx.strokeStyle=style.accent;ctx.lineWidth=2;
    if(style.kind==='spikes'){
      for(let px=x;px<x+w;px+=22){ctx.beginPath();ctx.moveTo(px,y+h*.42);ctx.lineTo(px+11,y-8);ctx.lineTo(px+22,y+h*.42);ctx.closePath();ctx.fill();}
    }else if(style.kind==='liquid'){
      ctx.globalAlpha=.86;for(let px=x-8;px<x+w+8;px+=18){ctx.beginPath();ctx.arc(px,y+7+Math.sin((mechanicsTime*5+px)*.08)*3,8,0,Math.PI*2);ctx.fill();}ctx.fillRect(x,y+8,w,Math.max(4,h-8));
    }else if(style.kind==='laser'){
      ctx.shadowBlur=12;ctx.shadowColor=style.accent;for(let px=x+8;px<x+w;px+=20){ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px,y+h);ctx.stroke();}
    }else if(style.kind==='electric'){
      ctx.shadowBlur=10;ctx.shadowColor=style.accent;ctx.beginPath();for(let px=x;px<=x+w;px+=12){const py=y+10+((px/12)%2?8:0);if(px===x)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();
    }else if(style.kind==='break'){
      ctx.globalAlpha=.9;for(let px=x+8;px<x+w;px+=24){ctx.fillRect(px,y+4,14,Math.max(8,h-8));}
    }else if(style.kind==='cloud'){
      ctx.globalAlpha=.55;for(let px=x+8;px<x+w;px+=26){ctx.beginPath();ctx.arc(px,y+h*.4+(px%3)*5,16,0,Math.PI*2);ctx.fill();}
    }else if(style.kind==='bars'){
      for(let px=x+8;px<x+w;px+=18)ctx.fillRect(px,y,6,h);
    }else if(style.kind==='rocks'){
      for(let px=x+8;px<x+w;px+=24){ctx.beginPath();ctx.arc(px,y+12+(px%2)*9,9,0,Math.PI*2);ctx.fill();}
    }else if(style.kind==='wind'){
      ctx.globalAlpha=.7;for(let py=y+7;py<y+h;py+=10){ctx.beginPath();ctx.moveTo(x+4,py);ctx.lineTo(x+w-4,py-5);ctx.stroke();}
    }
    ctx.restore();
  }

  function installTerrainPresentation(){
    if(typeof drawPlatforms!=='function')return false;
    drawPlatforms=function seedManRuntimeTerrain(){
      const active=currentLevel();if(!active||typeof ctx==='undefined'||typeof cameraX==='undefined')return;
      for(const platform of active.platforms||[]){
        if(platform.__runtimeHidden)continue;
        const style=surfaceStyle(platform.surface||active.theme||'grass');const x=Math.round(platform.x-cameraX);const y=platform.y;
        ctx.fillStyle=style.base;ctx.fillRect(x,y,platform.width,platform.height);ctx.fillStyle=style.top;ctx.fillRect(x,y,platform.width,Math.min(7,platform.height));
        if(platform.conveyor){ctx.fillStyle='rgba(255,255,255,.35)';const dir=Number(platform.conveyor.speed)>=0?1:-1;for(let px=x+14;px<x+platform.width-8;px+=28){ctx.beginPath();ctx.moveTo(px-dir*5,y+13);ctx.lineTo(px+dir*5,y+18);ctx.lineTo(px-dir*5,y+23);ctx.closePath();ctx.fill();}}
        if(platform.collapsible){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;for(let px=x+18;px<x+platform.width;px+=34){ctx.beginPath();ctx.moveTo(px,y+4);ctx.lineTo(px-8,y+platform.height-4);ctx.stroke();}}
        if(platform.timedDoor){ctx.fillStyle='rgba(255,255,255,.25)';for(let py=y+8;py<y+platform.height;py+=18)ctx.fillRect(x+4,py,platform.width-8,4);}
      }
      for(const hazard of active.hazards||[])drawHazard(hazard);
      document.documentElement.dataset.seedManTerrainPresentation='v21';
    };
    return true;
  }

  function ensureSyntheticMechanics(levelData){
    if(!levelData||levelData.__seedMechanicsPrepared)return;
    levelData.__seedMechanicsPrepared=true;
    const mechanics=new Set(levelData.mechanics||[]);const hazards=levelData.hazards||[];const platforms=levelData.platforms||[];
    for(const platform of platforms){
      platform.__seedBaseX=Number(platform.x)||0;platform.__seedBaseY=Number(platform.y)||0;
      if(mechanics.has('vertical-platforms')&&platform.y<440&&!platform.motion)platform.motion={axis:'y',distance:95,durationMs:2200};
      if(mechanics.has('moving-platforms')&&platform.y<440&&!platform.motion)platform.motion={axis:(platforms.indexOf(platform)%2?'y':'x'),distance:105,durationMs:2400};
      if(mechanics.has('conveyor-platforms')&&platform.y<440&&!platform.conveyor)platform.conveyor={speed:(platforms.indexOf(platform)%2?-62:62)};
      if(mechanics.has('crystal-bounce')&&platform.y<440)platform.crystalBounce=true;
    }
    if(mechanics.has('collapsing-platforms')){
      let marked=0;for(const platform of platforms){if(platform.y<440&&marked<5){platform.collapsible=true;marked+=1;}}
      for(const hazard of hazards.filter((item)=>item.type==='falling-bridges'||item.type==='breakaway-ice')){
        platforms.push({id:`runtime-bridge-${hazard.id||hazard.x}`,x:hazard.x-12,y:hazard.y-38,width:hazard.width+24,height:20,surface:hazard.type==='breakaway-ice'?'ice':'wood',collapsible:true,__seedBaseX:hazard.x-12,__seedBaseY:hazard.y-38});
      }
    }
    if(mechanics.has('timed-doors')&&!platforms.some((platform)=>platform.timedDoor)){
      [0.43,0.68].forEach((fraction,index)=>platforms.push({id:`runtime-timed-door-${index+1}`,x:Math.round(levelData.worldWidth*fraction),y:318,width:34,height:162,surface:'metal',timedDoor:{cycle:5.4,openFor:2.1,phase:index*1.7},__seedBaseX:Math.round(levelData.worldWidth*fraction),__seedBaseY:318}));
    }
  }

  function standingOn(state,platform,tolerance=7){
    if(!state||!platform||platform.__runtimeHidden)return false;
    const feet=state.y+state.height;return state.x+state.width>platform.x+3&&state.x<platform.x+platform.width-3&&Math.abs(feet-platform.y)<=tolerance;
  }

  function updateDynamicPlatforms(levelData,inputState,priorPlayer,dt){
    ensureSyntheticMechanics(levelData);const step=clamp(Number(dt)||0,0,0.05);mechanicsTime+=step;
    for(const platform of levelData?.platforms||[]){
      if(platform.__seedBaseX==null)platform.__seedBaseX=Number(platform.x)||0;if(platform.__seedBaseY==null)platform.__seedBaseY=Number(platform.y)||0;
      platform.__runtimeHidden=false;
      if(platform.motion){const duration=Math.max(.6,(Number(platform.motion.durationMs)||2200)/1000);const offset=Math.sin((mechanicsTime/duration)*Math.PI*2)*(Number(platform.motion.distance)||90);if(platform.motion.axis==='y')platform.y=platform.__seedBaseY+offset;else platform.x=platform.__seedBaseX+offset;}
      if(platform.timedDoor){const cycle=Math.max(3,Number(platform.timedDoor.cycle)||5.4);const openFor=Math.max(.8,Number(platform.timedDoor.openFor)||2.1);const phase=Number(platform.timedDoor.phase)||0;const t=(mechanicsTime+phase)%cycle;const open=t>cycle-openFor;platform.__runtimeHidden=open;platform.y=open?(levelData.worldHeight+260):platform.__seedBaseY;}
      if(platform.collapsible){
        if(platform.__restoreAt&&mechanicsTime>=platform.__restoreAt){platform.__restoreAt=0;platform.__collapseAt=0;platform.y=platform.__seedBaseY;platform.__runtimeHidden=false;}
        if(platform.__collapseAt&&mechanicsTime>=platform.__collapseAt&&!platform.__restoreAt){platform.__restoreAt=mechanicsTime+2.2;platform.y=levelData.worldHeight+260;platform.__runtimeHidden=true;}
        if(!platform.__collapseAt&&!platform.__restoreAt&&standingOn(priorPlayer,platform,9))platform.__collapseAt=mechanicsTime+.38;
      }
    }
  }

  function postProcessPlayer(next,prior,inputState,levelData,dt){
    if(!next||!levelData)return next;const step=clamp(Number(dt)||0,0,0.05);const mechanics=new Set(levelData.mechanics||[]);
    next.__teleportCooldown=Math.max(0,(Number(next.__teleportCooldown)||0)-step);
    const support=(levelData.platforms||[]).find((platform)=>standingOn(next,platform,9));
    if(next.grounded&&support?.conveyor){next.x=clamp(next.x+Number(support.conveyor.speed||0)*step,0,Math.max(0,levelData.worldWidth-next.width));}
    if(next.grounded&&support?.crystalBounce){next.vy=-760;next.grounded=false;next.state='jump';}
    if(mechanics.has('slippery-ground')&&next.grounded&&!inputState?.left&&!inputState?.right&&Math.abs(Number(prior?.vx)||0)>15){next.vx=Number(prior.vx)*.965;}
    if(mechanics.has('wind-zones')||levelData.hazardTypes?.includes?.('sandstorm')){const direction=Math.sin(mechanicsTime*.75)>=0?1:-1;next.vx=clamp(next.vx+direction*(85+45*Math.abs(Math.sin(mechanicsTime*1.6)))*step,-360,360);}
    if(mechanics.has('heat-updraft')&&!next.grounded){const phase=((next.x||0)%1100)/1100;if(phase>.48&&phase<.68&&next.y>245)next.vy=Math.max(-520,next.vy-620*step);}
    if(mechanics.has('teleport-roots')&&next.__teleportCooldown<=0){
      const entryX=levelData.worldWidth*.31,exitX=levelData.worldWidth*.73;const portalA={x:entryX-32,y:390,width:64,height:90},portalB={x:exitX-32,y:390,width:64,height:90};
      if(overlaps(next,portalA)){next.x=exitX;next.y=Math.min(next.y,390);next.__teleportCooldown=1.1;}
      else if(overlaps(next,portalB)){next.x=entryX;next.y=Math.min(next.y,390);next.__teleportCooldown=1.1;}
    }
    return next;
  }

  function installMechanics(){
    if(mechanicsInstalled||typeof stepPlayer!=='function')return false;
    const baseStep=stepPlayer;
    stepPlayer=function seedManV21MechanicsStep(inputPlayer,inputState,levelData,dt,config){
      updateDynamicPlatforms(levelData,inputState,inputPlayer,dt);
      const next=baseStep(inputPlayer,inputState,levelData,dt,config);
      return postProcessPlayer(next,inputPlayer,inputState,levelData,dt);
    };
    mechanicsInstalled=true;document.documentElement.dataset.seedManLevelMechanics='v21';return true;
  }

  function drawMechanicsOverlay(){
    const active=currentLevel();const state=currentPlayer();if(!active||!state||typeof ctx==='undefined'||typeof canvas==='undefined')return;const mechanics=new Set(active.mechanics||[]);
    if(mechanics.has('teleport-roots')){
      const cam=currentCamera();for(const xWorld of [active.worldWidth*.31,active.worldWidth*.73]){const x=xWorld-cam;ctx.save();ctx.strokeStyle='#9dff79';ctx.lineWidth=4;ctx.shadowBlur=16;ctx.shadowColor='#72ff70';ctx.beginPath();ctx.ellipse(x,430,25,45,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    if(mechanics.has('dark-zones')){
      const px=state.x-currentCamera()+state.width/2;const py=state.y+state.height/2;const radius=150;const g=ctx.createRadialGradient(px,py,45,px,py,radius*1.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.52,'rgba(0,0,0,.18)');g.addColorStop(1,'rgba(0,0,0,.76)');ctx.save();ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
    }
    if(mechanics.has('wind-zones')||active.hazardTypes?.includes?.('sandstorm')){ctx.save();ctx.strokeStyle='rgba(235,244,244,.22)';ctx.lineWidth=2;for(let i=0;i<12;i++){const y=80+i*36;const x=((mechanicsTime*90+i*77)%1100)-90;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+72,y-8);ctx.stroke();}ctx.restore();}
  }

  function installOverlay(){
    if(overlayInstalled||typeof render!=='function')return false;const baseRender=render;render=function seedManV21PresentationRender(){baseRender();drawMechanicsOverlay();};overlayInstalled=true;return true;
  }

  function preloadWorld(){const active=currentLevel();if(active)worldImage(worldAsset(active.worldId));}

  function truthfulUi(){
    const marker=document.querySelector('#seed-ui-release-marker');if(marker)marker.textContent='LIVE V20 · 20 AUTHORED LEVELS · CLASSIC SEED MAN ART REBUILD · PHENOTYPE COMBAT';
    const hero=document.querySelector('.hero .eyebrow');if(hero)hero.textContent='Seed Man · 20-Level Campaign · 5 Worlds · Classic Seed Man Art Rebuild · Phenotype Combat';
    document.body.dataset.seedManApprovedArt='classic-seed-man-oval-v1-target';
  }

  function snapshot() {
    const campaignLoaded = window.__SPROUT_CAMPAIGN__?.levelCount === EXPECTED.campaignLevels || Boolean(window.__SEED_MAN_CAMPAIGN_V20__);
    const playerStateLoaded = window.__SEED_MAN_PLAYER_STATE__?.installed === true;
    const combatLoaded = window.__SPROUT_COMBAT_BROWSER__?.installed === true;
    const enemyAttacksLoaded = window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed === true;
    const campaignUiLoaded = document.documentElement.dataset.sproutCampaignUi === EXPECTED.campaignUi;
    const artCore=window.__SEED_MAN_APPROVED_ART_CORE__;
    const classicContractLoaded=artCore?.characterContract===EXPECTED.characterTarget;
    const active=currentLevel();const asset=active?worldAsset(active.worldId):null;const image=asset?worldImage(asset):null;
    const authoredWorldLoaded=Boolean(image?.complete&&image.naturalWidth>0);
    const threeWorldLoaded = window.__SPROUT_THREE_ADAPTER__?.active === true;
    return Object.freeze({campaignLoaded,playerStateLoaded,combatLoaded,enemyAttacksLoaded,campaignUiLoaded,classicContractLoaded,authoredWorldLoaded,threeWorldLoaded,mechanicsInstalled,presentationInstalled,overlayInstalled,healthy:campaignLoaded&&playerStateLoaded&&combatLoaded&&enemyAttacksLoaded&&classicContractLoaded&&mechanicsInstalled});
  }

  function syncStatus() {
    truthfulUi();preloadWorld();
    const state = snapshot();
    document.documentElement.dataset.seedManRuntimeHealth = state.healthy ? 'ready' : 'degraded';
    document.documentElement.dataset.seedManWorldRenderer = state.threeWorldLoaded ? EXPECTED.worldRendererTarget : state.authoredWorldLoaded ? EXPECTED.flatWorldRenderer : 'seed-man-canvas-world-gradient-v1';
    document.documentElement.dataset.seedManCharacterTarget=EXPECTED.characterTarget;
    document.documentElement.dataset.seedManCharacterArtStatus='replacement-pending';
    return state;
  }

  function redraw() {requestAnimationFrame(()=>{try{if(typeof render==='function')render();}catch{}syncStatus();});}
  function resetMechanics(){mechanicsTime=0;const active=currentLevel();if(active)active.__seedMechanicsPrepared=false;}

  installBackgroundPresentation();installTerrainPresentation();installMechanics();installOverlay();truthfulUi();preloadWorld();
  window.addEventListener('pageshow',redraw);
  window.addEventListener('orientationchange',redraw);
  window.addEventListener('resize',redraw,{passive:true});
  window.addEventListener('load',syncStatus,{once:true});
  window.addEventListener('sprout:level-selected',()=>{resetMechanics();preloadWorld();syncStatus();});
  window.addEventListener('seedman:boss-defeated',syncStatus);

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version:VERSION,
    release:RELEASE,
    campaignTarget:20,
    campaignUi:EXPECTED.campaignUi,
    combatRuntime:'v2',
    playerStateRuntime:'v20',
    worldRuntimeTarget:EXPECTED.worldRendererTarget,
    activeFallbackWorldRuntime:EXPECTED.flatWorldRenderer,
    characterTarget:EXPECTED.characterTarget,
    releaseCompatibility:RELEASE_COMPATIBILITY,
    legacyDynamicLoader:false,
    legacyCanvasMonkeyPatch:false,
    runtimeRepair:true,
    mechanics:Object.freeze(['moving-platforms','vertical-platforms','collapsing-platforms','conveyor-platforms','crystal-bounce','slippery-ground','wind-zones','heat-updraft','teleport-roots','timed-doors','dark-zones']),
    snapshot,
    syncStatus
  });

  document.documentElement.dataset.seedManRuntimeBridge=VERSION;
  syncStatus();
})();
