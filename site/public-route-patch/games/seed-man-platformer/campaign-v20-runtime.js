'use strict';

(() => {
  const VERSION = 'seed-man-campaign-v20-runtime-v3';
  const AUTHORING_VERSION = 'seed-man-authored-levels-v1';
  const RECIPE_VERSION = 'seed-man-authored-recipes-v1';
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
  const CARRIER_ARCHETYPE = Object.freeze({fire:'fire-carrier',electric:'electric-carrier',ice:'ice-carrier'});
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const finite = (value,fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const unique = (values=[]) => [...new Set(values.filter(Boolean))];
  let campaignData = null;
  let levelCatalog = null;
  let recipeCatalog = null;
  let worldGameplay = null;
  let powerupCatalog = null;
  let entries = [];
  let generated = new Map();
  let activeId = null;
  let installAttempts = 0;
  const backgroundImages = new Map();

  function compileAuthoredRecipe(entry,recipe) {
    if (!recipe?.world || !Array.isArray(recipe.sections) || !recipe.sections.length) return null;
    const defaults=recipeCatalog?.defaults||{};
    const groundY=finite(defaults.groundY,480);
    const sectionGap=finite(defaults.sectionGap,90);
    const pickupEvery=Math.max(180,finite(defaults.pickupEvery,340));
    const length=Math.max(1400,finite(entry.length,6000));
    const checkpointCount=Math.max(0,Math.floor(finite(entry.checkpointCount,2)));
    const rawWidths=recipe.sections.map((section)=>Math.max(420,finite(section.width,1200)));
    const naturalLength=rawWidths.reduce((sum,width)=>sum+width,0)+sectionGap*Math.max(0,recipe.sections.length-1);
    const scale=length/naturalLength;
    const platforms=[]; const hazards=[]; const pickups=[]; const checkpoints=[]; const enemySpawns=[];
    const phenotypeCarrierSpawns=[]; const encounterZones=[]; const mechanics=[];
    let x=0; let pickupSerial=1; let enemySerial=1; let hazardSerial=1;

    recipe.sections.forEach((section,index)=>{
      const width=Math.max(360,rawWidths[index]*scale);
      const gap=index<recipe.sections.length-1?sectionGap*scale:0;
      const startX=x;
      const endX=Math.min(length,startX+width);
      const usableWidth=Math.max(280,endX-startX);
      const surface=section.surface||'grass';
      const sectionId=`${entry.id}-section-${index+1}`;
      platforms.push({id:`${sectionId}-ground`,x:startX,y:groundY,width:usableWidth,height:60,surface});

      const sectionMechanics=Array.isArray(section.mechanics)?section.mechanics:[];
      mechanics.push(...sectionMechanics);
      if(sectionMechanics.some((m)=>['moving-platforms','vertical-platforms','vine-platforms','wall-routes','crystal-bounce','conveyor-platforms'].includes(m))){
        const count=sectionMechanics.includes('vertical-platforms')?4:3;
        for(let p=0;p<count;p+=1){
          const travel=Math.max(0,usableWidth-440);
          platforms.push({
            id:`${sectionId}-platform-${p+1}`,
            x:startX+220+p*(travel/Math.max(1,count-1)),
            y:groundY-100-(p%2)*70,
            width:180,height:22,
            surface:sectionMechanics.includes('crystal-bounce')?'ice':surface,
            motion:sectionMechanics.includes('moving-platforms')?{axis:p%2?'y':'x',distance:110,durationMs:2200}:undefined,
            conveyor:sectionMechanics.includes('conveyor-platforms')?{speed:p%2?-55:55}:undefined
          });
        }
      }

      (section.hazards||[]).forEach((type,h)=>{
        const hx=startX+Math.min(Math.max(90,usableWidth-170),220+h*230);
        hazards.push({id:`${sectionId}-hazard-${hazardSerial++}`,x:hx,y:groundY+18,width:96,height:42,type});
      });

      for(let px=startX+180;px<endX-110;px+=Math.max(180,pickupEvery*scale)){
        pickups.push({id:`${entry.id}-seed-${String(pickupSerial++).padStart(3,'0')}`,x:px,y:groundY-52,width:22,height:22,type:'seed'});
      }

      (section.enemies||[]).forEach((type,e)=>{
        const ex=startX+Math.min(Math.max(140,usableWidth-160),260+e*230);
        enemySpawns.push({
          id:`${entry.id}-enemy-${String(enemySerial++).padStart(3,'0')}`,type,x:ex,y:groundY-44,
          minX:Math.max(startX+80,ex-150),maxX:Math.min(endX-80,ex+180)
        });
      });

      if(section.carrier){
        const phenotype=section.carrier;
        phenotypeCarrierSpawns.push({
          id:`${entry.id}-${phenotype}-carrier-${index+1}`,type:CARRIER_ARCHETYPE[phenotype],form:phenotype,
          x:startX+Math.floor(usableWidth*.68),y:groundY-46,
          minX:startX+Math.floor(usableWidth*.48),maxX:startX+Math.floor(usableWidth*.86)
        });
      }

      encounterZones.push({id:sectionId,startX,endX,purpose:section.kind||'traversal',boss:section.boss||null});
      x=endX+gap;
    });

    for(let index=0;index<checkpointCount;index+=1){
      const checkpointX=Math.round(length*((index+1)/(checkpointCount+1)));
      checkpoints.push({id:`${entry.id}-checkpoint-${index+1}`,x:checkpointX,y:groundY-60,width:50,height:60,respawnX:Math.max(70,checkpointX-50),respawnY:groundY-80});
    }

    if(pickups.length<5){
      for(let index=pickups.length;index<5;index+=1){
        const px=Math.round(length*((index+1)/6));
        pickups.push({id:`${entry.id}-seed-${String(pickupSerial++).padStart(3,'0')}`,x:px,y:groundY-52,width:22,height:22,type:'seed'});
      }
    }

    return Object.freeze({
      mode:'authored',revision:2,source:'authored-level-recipes-v1',world:recipe.world,
      spawn:{x:96,y:groundY-90},platforms,hazards,pickups,checkpoints,enemySpawns,phenotypeCarrierSpawns,encounterZones,
      mechanics:unique(mechanics),requiredPickups:pickups.length,
      finish:{x:Math.max(180,length-140),y:groundY-90,width:50,height:90}
    });
  }

  async function loadData() {
    const [campaignResponse,levelsResponse,recipesResponse,worldResponse,powerResponse] = await Promise.all([
      fetch('./data/campaign.json',{cache:'no-store'}),
      fetch('./data/levels-20-v1.json',{cache:'no-store'}),
      fetch('./data/authored-level-recipes-v1.json',{cache:'no-store'}),
      fetch('./data/world-gameplay-v1.json',{cache:'no-store'}),
      fetch('./data/powerup-catalog-v1.json',{cache:'no-store'})
    ]);
    if (![campaignResponse,levelsResponse,recipesResponse,worldResponse,powerResponse].every((response)=>response.ok)) throw new Error('Seed Man v20 authored campaign data request failed');
    campaignData=await campaignResponse.json();
    levelCatalog=await levelsResponse.json();
    recipeCatalog=await recipesResponse.json();
    worldGameplay=await worldResponse.json();
    powerupCatalog=await powerResponse.json();
    if (campaignData.levelCount!==20 || !Array.isArray(levelCatalog.levels) || levelCatalog.levels.length!==20) throw new Error('Seed Man campaign must contain exactly 20 levels');
    if (Object.keys(recipeCatalog.levels||{}).length!==19) throw new Error('Seed Man authored recipe catalog must contain the 19 post-1-1 levels');
    if (Object.keys(worldGameplay.worlds||{}).length!==5) throw new Error('Seed Man world gameplay catalog must contain five worlds');
    if (Object.keys(powerupCatalog.forms||{}).sort().join(',')!=='electric,fire,ice,plant') throw new Error('Seed Man powerup catalog must contain Plant, Fire, Electric and Ice');

    const campaignEntries=campaignData.worlds.flatMap((world)=>world.levels.map((entry)=>({...entry,worldId:world.id,worldTitle:world.title,visualWorldKey:world.visualWorldKey,worldOrder:world.order})));
    entries=campaignEntries.map((entry)=>{
      const catalog=levelCatalog.levels.find((item)=>item.id===entry.id);
      if(!catalog)throw new Error(`Missing level catalog entry: ${entry.id}`);
      const merged={...entry,...catalog,worldId:catalog.world,worldTitle:entry.worldTitle,worldOrder:entry.worldOrder,visualWorldKey:entry.visualWorldKey};
      const recipe=recipeCatalog.levels?.[merged.id]||null;
      const layout=merged.layout||compileAuthoredRecipe(merged,recipe);
      if(!layout)throw new Error(`Missing authored level layout/recipe: ${merged.id}`);
      return Object.freeze({...merged,layout});
    });
    generated=new Map(entries.map((entry)=>[entry.id,generateLevel(entry)]));
  }

  function buildGround(entry) {
    const platforms=[]; const hazards=[]; let x=0; let index=0;
    const segment=entry.boss?520:Math.max(420,555-Math.floor(entry.order/4)*22);
    const baseGap=88+Math.min(72,entry.order*3);
    while(x<entry.length){
      const remaining=entry.length-x;
      if(remaining<=segment+230){platforms.push({x,y:480,width:remaining,height:60});break;}
      const gap=baseGap+((index*19+entry.order*13)%44);
      if(remaining-segment-gap<240){platforms.push({x,y:480,width:remaining,height:60});break;}
      platforms.push({x,y:480,width:segment,height:60});
      hazards.push({x:x+segment,y:500,width:gap,height:40,type:entry.hazards[index%entry.hazards.length]||'gap'});
      x+=segment+gap;index+=1;
    }
    return {platforms,hazards};
  }

  function safeX(platforms,desired,margin=72){
    const containing=platforms.find((p)=>p.width>=margin*2&&desired>=p.x+margin&&desired<=p.x+p.width-margin);
    if(containing)return Math.round(desired);
    const candidates=platforms.filter((p)=>p.width>=margin*2).sort((a,b)=>Math.abs((a.x+a.width/2)-desired)-Math.abs((b.x+b.width/2)-desired));
    if(!candidates.length)return Math.round(desired);
    const p=candidates[0];return Math.round(clamp(desired,p.x+margin,p.x+p.width-margin));
  }

  function validateAuthoredLayout(entry){
    const layout=entry?.layout;
    if(!layout||!['authored','authored-recipe'].includes(layout.mode))return null;
    for(const key of ['platforms','hazards','pickups','checkpoints','enemySpawns','phenotypeCarrierSpawns']){
      if(!Array.isArray(layout[key]))throw new Error(`Authored level ${entry.id} is missing ${key}`);
    }
    if(!layout.spawn||!layout.finish)throw new Error(`Authored level ${entry.id} must define spawn and finish`);
    if(layout.checkpoints.length!==entry.checkpointCount)throw new Error(`Authored level ${entry.id} checkpoint count does not match catalog`);
    if(layout.finish.x<=layout.spawn.x||layout.finish.x+layout.finish.width>entry.length+1)throw new Error(`Authored level ${entry.id} finish is outside level bounds`);
    if((layout.requiredPickups??layout.pickups.length)!==layout.pickups.length)throw new Error(`Authored level ${entry.id} requiredPickups must equal authored pickup count`);
    const ids=[...layout.platforms,...layout.hazards,...layout.pickups,...layout.checkpoints,...layout.enemySpawns,...layout.phenotypeCarrierSpawns].map((item)=>item.id).filter(Boolean);
    if(new Set(ids).size!==ids.length)throw new Error(`Authored level ${entry.id} contains duplicate object ids`);
    return layout;
  }

  function buildBoss(entry,platforms){
    if(!entry.boss)return null;
    const meta=BOSS_META[entry.boss];if(!meta)throw new Error(`Missing boss metadata: ${entry.boss}`);
    const center=safeX(platforms,entry.length*.84,175);
    return {id:entry.boss,name:meta.name,requiredHits:meta.requiredHits,width:meta.width,height:meta.height,accent:meta.accent,phases:meta.phases||1,phase:1,finalBoss:Boolean(meta.finalBoss),x:Math.round(center-meta.width/2),y:480-meta.height,arenaStartX:Math.round(entry.length*.72),arenaEndX:Math.round(entry.length*.94),speed:50+entry.order*2,hits:0,defeated:false};
  }

  function generateAuthoredLevel(entry,layout){
    const platforms=clone(layout.platforms);const pickups=clone(layout.pickups);const checkpoints=clone(layout.checkpoints);const hazards=clone(layout.hazards);
    const boss=buildBoss(entry,platforms.filter((platform)=>platform.y>=450));
    return {
      schemaVersion:7,id:entry.id,name:`Seed Man: ${entry.title}`,title:entry.title,levelNumber:entry.order,worldId:entry.worldId,worldTitle:entry.worldTitle,
      theme:entry.worldId,setting:`${entry.worldTitle} · ${entry.title}`,difficulty:entry.order,authoringMode:'authored',authoringVersion:AUTHORING_VERSION,recipeVersion:RECIPE_VERSION,
      layoutRevision:Number(layout.revision)||1,worldWidth:entry.length,worldHeight:540,requiredPickups:Number(layout.requiredPickups??pickups.length),spawn:clone(layout.spawn),
      platforms,hazards,pickups,powerups:[],phenotypeForms:['plant','fire','electric','ice'],phenotypeDurationMs:Number(powerupCatalog?.durationMs)||30000,
      checkpoints,boss,enemyPool:[...entry.enemyPool],enemySpawns:clone(layout.enemySpawns),phenotypeCarrierSpawns:clone(layout.phenotypeCarrierSpawns),encounterZones:clone(layout.encounterZones||[]),
      tutorials:clone(layout.tutorials||[]),mechanics:unique([...(entry.mechanics||[]),...(layout.mechanics||[])]),hazardTypes:unique([...(entry.hazards||[]),...hazards.map((hazard)=>hazard.type)]),
      backgroundKey:WORLD_BACKGROUND_KEYS[entry.worldId],worldVisualLayers:clone(worldGameplay?.worlds?.[entry.worldId]?.layerAssetKeys||{}),palette:clone(worldGameplay?.worlds?.[entry.worldId]?.palette||{accent:WORLD_COLORS[entry.worldId]}),finish:clone(layout.finish)
    };
  }

  function generateProceduralLevel(entry){
    const ground=buildGround(entry);const upper=[];const upperCount=9+Math.min(10,Math.floor(entry.order/2));
    for(let index=0;index<upperCount;index+=1){const fraction=.08+index*(.84/Math.max(1,upperCount-1));const y=390-((index*67+entry.order*23)%155);upper.push({x:Math.round(entry.length*fraction),y,width:150+(index%3)*24,height:24,type:entry.worldId});}
    const platforms=[...ground.platforms,...upper];const pickupCount=Math.min(36,20+Math.floor(entry.order/2));
    const pickups=Array.from({length:pickupCount},(_,index)=>({id:`seed-${entry.order}-${index+1}`,x:safeX(ground.platforms,entry.length*(.05+index*(.9/Math.max(1,pickupCount-1))),55),y:425,width:22,height:22}));
    const checkpoints=Array.from({length:entry.checkpointCount},(_,index)=>{const x=safeX(ground.platforms,entry.length*((index+1)/(entry.checkpointCount+1)),90);return{id:`checkpoint-${entry.order}-${index+1}`,x,y:420,width:50,height:60,respawnX:Math.max(60,x-20),respawnY:400};});
    return {schemaVersion:5,id:entry.id,name:`Seed Man: ${entry.title}`,title:entry.title,levelNumber:entry.order,worldId:entry.worldId,worldTitle:entry.worldTitle,theme:entry.worldId,setting:`${entry.worldTitle} · ${entry.title}`,difficulty:entry.order,authoringMode:'generated',worldWidth:entry.length,worldHeight:540,requiredPickups:pickups.length,spawn:{x:80,y:390},platforms,hazards:ground.hazards,pickups,powerups:[],phenotypeForms:['plant','fire','electric','ice'],phenotypeDurationMs:30000,checkpoints,boss:buildBoss(entry,ground.platforms),enemyPool:[...entry.enemyPool],enemySpawns:[],phenotypeCarrierSpawns:[],encounterZones:[],tutorials:[],mechanics:[...entry.mechanics],hazardTypes:[...entry.hazards],backgroundKey:WORLD_BACKGROUND_KEYS[entry.worldId],palette:{accent:WORLD_COLORS[entry.worldId]},finish:{x:safeX(ground.platforms,entry.length-95,65),y:390,width:50,height:90}};
  }

  function generateLevel(entry){
    const authored=validateAuthoredLayout(entry);
    return authored?generateAuthoredLevel(entry,authored):generateProceduralLevel(entry);
  }

  function syncUi(entry){
    document.documentElement.dataset.sproutCampaignLevels='20';document.documentElement.dataset.seedManCampaign=VERSION;document.body.dataset.seedTheme=entry.worldId;document.body.dataset.seedLevel=entry.id;
    const runtimeLevel=generated.get(entry.id);const authored=runtimeLevel?.authoringMode==='authored';document.body.dataset.seedLevelAuthoring=authored?'authored':'generated';
    const status=document.querySelector('#load-status');if(status)status.textContent=`Level ${entry.order}/20 · ${entry.worldTitle} · ${entry.title}${entry.boss?` · Boss: ${BOSS_META[entry.boss].name}`:''}${authored?' · Authored layout':''}`;
    const marker=document.querySelector('#seed-ui-release-marker');if(marker)marker.textContent='LIVE UI · 20 AUTHORED LEVELS · APPROVED ART · PHENOTYPE COMBAT';
    const title=document.querySelector('#seed-campaign-title');if(title)title.textContent=`Level ${entry.order} / 20 · ${entry.title}`;
    const setting=document.querySelector('#seed-campaign-setting');if(setting)setting.textContent=`${entry.worldTitle}${entry.boss?` · ${BOSS_META[entry.boss].name}`:''}`;
    document.title=`Seed Man: ${entry.title} | DTF Genetics`;
  }

  function selectLevel(id){
    const entry=entries.find((item)=>item.id===id);const next=generated.get(id);if(!entry||!next)throw new Error(`Unknown Seed Man level: ${id}`);
    activeId=id;level=clone(next);if(typeof reset==='function')reset();try{running=true;}catch{}try{localStorage.setItem('dtf-seed-man-last-level-v20',id);}catch{}
    syncUi(entry);window.dispatchEvent(new CustomEvent('sprout:level-selected',{detail:{levelId:id,level:{...entry},campaignV20:true,authoringMode:level.authoringMode}}));return {...entry};
  }

  function installSelect(){
    const select=document.querySelector('#seed-man-level-select');if(!select)return;select.innerHTML='';
    for(const world of campaignData.worlds){const group=document.createElement('optgroup');group.label=`World ${world.order} — ${world.title}`;for(const entry of entries.filter((item)=>item.worldOrder===world.order)){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.order}. ${entry.title}${entry.boss?` — ${BOSS_META[entry.boss].name}`:''}`;group.append(option);}select.append(group);}select.value=activeId;select.addEventListener('change',()=>{if(generated.has(select.value))selectLevel(select.value);});
  }

  function approvedWorldAsset(key){return window.__SEED_MAN_APPROVED_ASSETS__?.[key]||null;}
  function imageForWorld(asset){if(!asset?.src||!asset?.region)return null;if(!backgroundImages.has(asset.src)){const image=new Image();image.decoding='async';image.src=asset.src;backgroundImages.set(asset.src,image);}return{image:backgroundImages.get(asset.src),region:asset.region};}

  function installBackground(){
    if(typeof drawBackground!=='function')return;
    drawBackground=function seedManApprovedWorldBackground(){
      if(typeof ctx==='undefined'||!ctx||typeof canvas==='undefined'||!canvas)return;
      const entry=entries.find((item)=>item.id===activeId)||entries[0];const key=WORLD_BACKGROUND_KEYS[entry.worldId];const asset=approvedWorldAsset(key);const atlas=imageForWorld(asset);
      const palette=worldGameplay?.worlds?.[entry.worldId]?.palette||{};const gradient=ctx.createLinearGradient(0,0,0,canvas.height);gradient.addColorStop(0,palette.sky||'#10283a');gradient.addColorStop(1,palette.near||'#17351f');ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
      if(atlas?.image?.complete&&atlas.image.naturalWidth>0){const{region}=atlas;const parallax=((typeof cameraX==='number'?cameraX:0)*.035)%canvas.width;ctx.save();ctx.globalAlpha=.97;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(atlas.image,region.x,region.y,region.width,region.height,-parallax,0,canvas.width,canvas.height);if(parallax>0)ctx.drawImage(atlas.image,region.x,region.y,region.width,region.height,canvas.width-parallax,0,canvas.width,canvas.height);ctx.restore();document.documentElement.dataset.seedManWorldArt=key;}else{document.documentElement.dataset.seedManWorldArt=`contract:${entry.worldId}`;}
    };
  }

  function installFinalBossHook(){
    if(typeof stepPlayer!=='function')return;const base=stepPlayer;
    stepPlayer=function seedManFinalBossStep(...args){const result=base(...args);try{if(level?.boss?.id==='blight-king'&&!level.boss.defeated){const hits=Number(level.boss.hits||0);const required=Number(level.boss.requiredHits||16);const phase=Math.min(4,Math.floor((hits/required)*4)+1);if(phase!==level.boss.phase){level.boss.phase=phase;document.documentElement.dataset.seedManFinalBossPhase=String(phase);window.dispatchEvent(new CustomEvent('seedman:boss-phase',{detail:{boss:'blight-king',phase}}));}level.boss.speed=68+phase*18;level.boss.accent=['#9cff2f','#ffd53d','#ff793d','#e94cff'][phase-1];}}catch{}return result;};
  }

  async function install(){
    if(typeof level==='undefined'||typeof reset!=='function'){installAttempts+=1;if(installAttempts<120)setTimeout(install,25);return;}
    try{await loadData();}catch(error){console.error('[Seed Man] 20-level authored campaign initialization failed.',error);return;}
    activeId=entries[0].id;
    const worlds=campaignData.worlds.map((world)=>Object.freeze({...world,levels:Object.freeze(entries.filter((entry)=>entry.worldOrder===world.order).map((entry)=>Object.freeze({...entry})))}));
    const authoredLevelCount=[...generated.values()].filter((entry)=>entry.authoringMode==='authored').length;
    const generatedLevelCount=[...generated.values()].filter((entry)=>entry.authoringMode==='generated').length;
    window.__SPROUT_CAMPAIGN__=Object.freeze({version:VERSION,authoringVersion:AUTHORING_VERSION,recipeVersion:RECIPE_VERSION,campaignId:campaignData.id,title:campaignData.title,defaultLevelId:campaignData.defaultLevelId,levelCount:20,newLevelCount:19,worldCount:5,bossCount:6,finalBoss:'blight-king',authoredLevelCount,generatedLevelCount,worlds:Object.freeze(worlds),listLevels:()=>entries.map((entry)=>({...entry})),getLevel:(id=activeId)=>{const entry=entries.find((item)=>item.id===id);return entry?{...entry}:null;},getRuntimeLevel:(id=activeId)=>{const entry=generated.get(id);return entry?clone(entry):null;},get activeLevelId(){return activeId;},selectLevel});
    window.__SPROUT_CAMPAIGN_BASE_LEVELS__=Object.freeze(entries.map((entry)=>entry.id));
    window.__SEED_MAN_WORLD_GAMEPLAY__=Object.freeze(clone(worldGameplay));window.__SEED_MAN_POWERUP_CATALOG__=Object.freeze(clone(powerupCatalog));
    window.__SEED_MAN_CAMPAIGN_V20__=Object.freeze({version:VERSION,authoringVersion:AUTHORING_VERSION,recipeVersion:RECIPE_VERSION,levelCount:20,worldCount:5,bossCount:6,finalBoss:'blight-king',generatedLevelCount,authoredLevelCount,approvedWorldBackgrounds:true,selectLevel});
    document.documentElement.dataset.seedManAuthoredLevels=String(authoredLevelCount);document.documentElement.dataset.seedManGeneratedLevels=String(generatedLevelCount);
    installSelect();installBackground();installFinalBossHook();
    let requested=null;try{requested=localStorage.getItem('dtf-seed-man-last-level-v20');}catch{}
    selectLevel(generated.has(requested)?requested:campaignData.defaultLevelId);
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();