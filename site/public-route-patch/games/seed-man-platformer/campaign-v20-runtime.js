'use strict';

(() => {
  const VERSION = 'seed-man-campaign-v20-runtime-v3';
  const LEVEL_SELECT_ID = 'campaign-level-select-v20';
  const BOSS_META = Object.freeze({
    'overgrown-guardian': { name:'Overgrown Guardian', requiredHits:5, width:128, height:118, accent:'#76d858' },
    'ancient-dryad': { name:'Ancient Dryad', requiredHits:6, width:132, height:120, accent:'#9bd46f' },
    'scorchroot-titan': { name:'Scorchroot Titan', requiredHits:7, width:138, height:126, accent:'#ff754b' },
    'frostbite-colossus': { name:'Frostbite Colossus', requiredHits:8, width:142, height:132, accent:'#77dfff' },
    'eco-sentinel': { name:'Eco Sentinel', requiredHits:9, width:138, height:128, accent:'#8df5b1' },
    'blight-king': { name:'The Blight King', requiredHits:16, width:178, height:158, accent:'#9cff2f', phases:4, finalBoss:true }
  });
  const WORLD_COLORS = Object.freeze({
    'greenhouse-valley':'#66e37b','forest-ruins':'#7fcb69','desert-canyon':'#ffad5c','frozen-peaks':'#8fe7ff','eco-city':'#65f2d1'
  });
  const WORLD_BACKGROUND_KEYS = Object.freeze({
    'greenhouse-valley':'world.greenhouse-valley.background','forest-ruins':'world.forest-ruins.background','desert-canyon':'world.desert-canyon.background','frozen-peaks':'world.frozen-peaks.background','eco-city':'world.eco-city.background'
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  let campaignData = null;
  let levelCatalog = null;
  let entries = [];
  let generated = new Map();
  let activeId = null;
  let installAttempts = 0;
  const backgroundImages = new Map();

  async function loadData() {
    const [campaignResponse, levelsResponse] = await Promise.all([
      fetch('./data/campaign.json', { cache:'no-store' }),
      fetch('./data/levels-20-v1.json', { cache:'no-store' })
    ]);
    if (!campaignResponse.ok || !levelsResponse.ok) throw new Error('Seed Man v20 campaign data request failed');
    campaignData = await campaignResponse.json();
    levelCatalog = await levelsResponse.json();
    if (campaignData.levelCount !== 20 || !Array.isArray(levelCatalog.levels) || levelCatalog.levels.length !== 20) throw new Error('Seed Man campaign must contain exactly 20 levels');
    const campaignEntries = campaignData.worlds.flatMap((world) => world.levels.map((entry) => ({...entry, worldId:world.id, worldTitle:world.title, visualWorldKey:world.visualWorldKey, worldOrder:world.order})));
    entries = campaignEntries.map((entry) => {
      const catalog = levelCatalog.levels.find((item) => item.id === entry.id);
      if (!catalog) throw new Error(`Missing level catalog entry: ${entry.id}`);
      return Object.freeze({...entry, ...catalog, worldId:catalog.world, worldTitle:entry.worldTitle, worldOrder:entry.worldOrder, visualWorldKey:entry.visualWorldKey});
    });
    generated = new Map(entries.map((entry) => [entry.id, generateLevel(entry)]));
  }

  function buildGround(entry) {
    const platforms=[]; const hazards=[]; let x=0; let index=0;
    const segment = entry.boss ? 520 : Math.max(420, 555 - Math.floor(entry.order / 4) * 22);
    const baseGap = 88 + Math.min(72, entry.order * 3);
    while (x < entry.length) {
      const remaining = entry.length - x;
      if (remaining <= segment + 230) { platforms.push({x,y:480,width:remaining,height:60}); break; }
      const gap = baseGap + ((index * 19 + entry.order * 13) % 44);
      if (remaining - segment - gap < 240) { platforms.push({x,y:480,width:remaining,height:60}); break; }
      platforms.push({x,y:480,width:segment,height:60});
      hazards.push({x:x+segment,y:500,width:gap,height:40,type:entry.hazards[index % entry.hazards.length] || 'gap'});
      x += segment + gap; index += 1;
    }
    return {platforms,hazards};
  }

  function safeX(platforms, desired, margin=72) {
    const containing = platforms.find((p) => p.width >= margin*2 && desired >= p.x+margin && desired <= p.x+p.width-margin);
    if (containing) return Math.round(desired);
    const candidates = platforms.filter((p) => p.width >= margin*2).sort((a,b) => Math.abs((a.x+a.width/2)-desired)-Math.abs((b.x+b.width/2)-desired));
    if (!candidates.length) return Math.round(desired);
    const p=candidates[0]; return Math.round(clamp(desired,p.x+margin,p.x+p.width-margin));
  }

  function generateLevel(entry) {
    const ground = buildGround(entry);
    const upper=[];
    const upperCount = 9 + Math.min(10, Math.floor(entry.order/2));
    for (let index=0; index<upperCount; index+=1) {
      const fraction = 0.08 + index*(0.84/Math.max(1,upperCount-1));
      const y = 390 - ((index*67 + entry.order*23) % 155);
      upper.push({x:Math.round(entry.length*fraction),y,width:150+(index%3)*24,height:24,type:entry.worldId});
    }
    const platforms=[...ground.platforms,...upper];
    const pickupCount=Math.min(36,20+Math.floor(entry.order/2));
    const pickups=Array.from({length:pickupCount},(_,index)=>({id:`seed-${entry.order}-${index+1}`,x:safeX(ground.platforms,entry.length*(0.05+index*(0.9/Math.max(1,pickupCount-1))),55),y:425,width:22,height:22}));
    const checkpoints=Array.from({length:entry.checkpointCount},(_,index)=>{const x=safeX(ground.platforms,entry.length*((index+1)/(entry.checkpointCount+1)),90);return{id:`checkpoint-${entry.order}-${index+1}`,x,y:420,width:50,height:60,respawnX:Math.max(60,x-20),respawnY:400};});
    let boss=null;
    if (entry.boss) {
      const meta=BOSS_META[entry.boss]; const center=safeX(ground.platforms,entry.length*0.84,175);
      boss={id:entry.boss,name:meta.name,requiredHits:meta.requiredHits,width:meta.width,height:meta.height,accent:meta.accent,phases:meta.phases||1,phase:1,finalBoss:Boolean(meta.finalBoss),x:Math.round(center-meta.width/2),y:480-meta.height,arenaStartX:Math.round(entry.length*0.72),arenaEndX:Math.round(entry.length*0.94),speed:50+entry.order*2,hits:0,defeated:false};
    }
    return {
      schemaVersion:5,
      id:entry.id,
      name:`Seed Man: ${entry.title}`,
      title:entry.title,
      levelNumber:entry.order,
      worldId:entry.worldId,
      worldTitle:entry.worldTitle,
      theme:entry.worldId,
      setting:`${entry.worldTitle} · ${entry.title}`,
      difficulty:entry.order,
      worldWidth:entry.length,
      worldHeight:540,
      requiredPickups:pickups.length,
      spawn:{x:80,y:390},
      platforms,
      hazards:ground.hazards,
      pickups,
      powerups:[],
      phenotypeForms:['plant','fire','electric','ice'],
      phenotypeDurationMs:30000,
      checkpoints,
      boss,
      enemyPool:[...entry.enemyPool],
      mechanics:[...entry.mechanics],
      hazardTypes:[...entry.hazards],
      backgroundKey:WORLD_BACKGROUND_KEYS[entry.worldId],
      palette:{accent:WORLD_COLORS[entry.worldId]},
      finish:{x:safeX(ground.platforms,entry.length-95,65),y:390,width:50,height:90}
    };
  }

  function syncUi(entry) {
    document.documentElement.dataset.sproutCampaignLevels='20';
    document.documentElement.dataset.seedManCampaign=VERSION;
    document.body.dataset.seedTheme=entry.worldId;
    document.body.dataset.seedLevel=entry.id;
    const status=document.querySelector('#load-status'); if(status) status.textContent=`Level ${entry.order}/20 · ${entry.worldTitle} · ${entry.title}${entry.boss?` · Boss: ${BOSS_META[entry.boss].name}`:''}`;
    const marker=document.querySelector('#seed-ui-release-marker'); if(marker) marker.textContent='LIVE UI · 20 LEVELS · APPROVED ART · PHENOTYPE COMBAT';
    const title=document.querySelector('#seed-campaign-title'); if(title) title.textContent=`Level ${entry.order} / 20 · ${entry.title}`;
    const setting=document.querySelector('#seed-campaign-setting'); if(setting) setting.textContent=`${entry.worldTitle}${entry.boss?` · ${BOSS_META[entry.boss].name}`:''}`;
    const select=document.getElementById(LEVEL_SELECT_ID); if(select) select.value=entry.id;
    document.title=`Seed Man: ${entry.title} | DTF Genetics`;
  }

  function selectLevel(id) {
    const entry=entries.find((item)=>item.id===id); const next=generated.get(id);
    if (!entry || !next) throw new Error(`Unknown Seed Man level: ${id}`);
    activeId=id;
    level=clone(next);
    if (typeof reset==='function') reset();
    try { running=true; } catch {}
    try { localStorage.setItem('dtf-seed-man-last-level-v20',id); } catch {}
    syncUi(entry);
    window.dispatchEvent(new CustomEvent('sprout:level-selected',{detail:{levelId:id,level:{...entry},campaignV20:true}}));
    return {...entry};
  }

  function installSelect() {
    const select=document.getElementById(LEVEL_SELECT_ID);
    if (!select) return;
    select.innerHTML='';
    for (const world of campaignData.worlds) {
      const group=document.createElement('optgroup'); group.label=`World ${world.order} — ${world.title}`;
      for (const entry of entries.filter((item)=>item.worldOrder===world.order)) {
        const option=document.createElement('option'); option.value=entry.id; option.textContent=`${entry.order}. ${entry.title}${entry.boss?` — ${BOSS_META[entry.boss].name}`:''}`; group.append(option);
      }
      select.append(group);
    }
    select.value=activeId;
    select.addEventListener('change',()=>{if(generated.has(select.value))selectLevel(select.value);});
    document.documentElement.dataset.seedManCampaignSelect='v20';
  }

  function approvedWorldAsset(key) {
    return window.__SEED_MAN_APPROVED_ASSETS__?.[key] || null;
  }

  function imageForWorld(asset) {
    if (!asset?.src || !asset?.region) return null;
    if (!backgroundImages.has(asset.src)) {
      const image=new Image();
      image.decoding='async';
      image.src=asset.src;
      backgroundImages.set(asset.src,image);
    }
    return { image:backgroundImages.get(asset.src), region:asset.region };
  }

  function installBackground() {
    if (typeof drawBackground!=='function') return;
    drawBackground=function seedManApprovedWorldBackground(){
      if(typeof ctx==='undefined'||!ctx||typeof canvas==='undefined'||!canvas)return;
      const entry=entries.find((item)=>item.id===activeId)||entries[0];
      const key=WORLD_BACKGROUND_KEYS[entry.worldId];
      const asset=approvedWorldAsset(key);
      const atlas=imageForWorld(asset);
      const gradient=ctx.createLinearGradient(0,0,0,canvas.height);
      gradient.addColorStop(0,'#10283a'); gradient.addColorStop(1,'#17351f');
      ctx.fillStyle=gradient; ctx.fillRect(0,0,canvas.width,canvas.height);
      if(atlas?.image?.complete&&atlas.image.naturalWidth>0){
        const {region}=atlas;
        const parallax=((typeof cameraX==='number'?cameraX:0)*0.035)%canvas.width;
        ctx.save();
        ctx.globalAlpha=.97;
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(atlas.image,region.x,region.y,region.width,region.height,-parallax,0,canvas.width,canvas.height);
        if(parallax>0)ctx.drawImage(atlas.image,region.x,region.y,region.width,region.height,canvas.width-parallax,0,canvas.width,canvas.height);
        ctx.restore();
        document.documentElement.dataset.seedManWorldArt=key;
      } else {
        document.documentElement.dataset.seedManWorldArt='loading';
      }
    };
  }

  function installFinalBossHook() {
    if (typeof stepPlayer!=='function') return;
    const base=stepPlayer;
    stepPlayer=function seedManFinalBossStep(...args){const result=base(...args);try{if(level?.boss?.id==='blight-king'&&!level.boss.defeated){const hits=Number(level.boss.hits||0);const required=Number(level.boss.requiredHits||16);const phase=Math.min(4,Math.floor((hits/required)*4)+1);if(phase!==level.boss.phase){level.boss.phase=phase;document.documentElement.dataset.seedManFinalBossPhase=String(phase);window.dispatchEvent(new CustomEvent('seedman:boss-phase',{detail:{boss:'blight-king',phase}}));}level.boss.speed=68+phase*18;level.boss.accent=['#9cff2f','#ffd53d','#ff793d','#e94cff'][phase-1];}}catch{}return result;};
  }

  async function install() {
    if(typeof level==='undefined'||typeof reset!=='function'){installAttempts+=1;if(installAttempts<120)setTimeout(install,25);return;}
    try { await loadData(); } catch (error) { console.error('[Seed Man] 20-level campaign initialization failed.',error); return; }
    activeId=entries[0].id;
    const worlds=campaignData.worlds.map((world)=>Object.freeze({...world,levels:Object.freeze(entries.filter((entry)=>entry.worldOrder===world.order).map((entry)=>Object.freeze({...entry})))}));
    window.__SPROUT_CAMPAIGN__=Object.freeze({version:VERSION,campaignId:campaignData.id,title:campaignData.title,defaultLevelId:campaignData.defaultLevelId,levelCount:20,newLevelCount:19,worldCount:5,bossCount:6,finalBoss:'blight-king',worlds:Object.freeze(worlds),listLevels:()=>entries.map((entry)=>({...entry})),getLevel:(id=activeId)=>{const entry=entries.find((item)=>item.id===id);return entry?{...entry}:null;},get activeLevelId(){return activeId;},selectLevel});
    window.__SPROUT_CAMPAIGN_BASE_LEVELS__=Object.freeze(entries.map((entry)=>entry.id));
    window.__SEED_MAN_CAMPAIGN_V20__=Object.freeze({version:VERSION,levelCount:20,worldCount:5,bossCount:6,finalBoss:'blight-king',generatedLevelCount:generated.size,approvedWorldBackgrounds:true,selectLevel});
    installSelect(); installBackground(); installFinalBossHook();
    let requested=null;try{requested=localStorage.getItem('dtf-seed-man-last-level-v20');}catch{}
    selectLevel(generated.has(requested)?requested:campaignData.defaultLevelId);
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
