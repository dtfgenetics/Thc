'use strict';

(() => {
  const VERSION = 'seed-man-combat-browser-v2';
  const PHENOTYPE_DURATION = 30;
  const PROJECTILE_LIFE = 1.6;
  const ENEMY_ATLAS_KEY = 'enemy-boss.atlas';
  const ENEMY_FRAME_COLS = 6;
  const BOSS_FRAME_COLS = 4;
  const ENEMY_FRAME_ROWS = 2;
  const BLIGHT_WEAKNESSES = Object.freeze(['plant','fire','electric','ice']);
  const PHENOTYPES = Object.freeze({
    fire: { form:'fire', label:'Fire', speed:560, damage:2, effect:'burn', cooldown:0.42, accent:'#ff9a4b' },
    electric: { form:'electric', label:'Electric', speed:660, damage:1, effect:'chain', cooldown:0.38, accent:'#d6c0ff' },
    ice: { form:'ice', label:'Ice', speed:520, damage:1, effect:'freeze', cooldown:0.40, accent:'#8fe7ff' }
  });
  const FORM_ACCENTS = Object.freeze({plant:'#c8f36a',fire:'#ff9a4b',electric:'#d6c0ff',ice:'#8fe7ff'});

  let enemies=[];
  let projectiles=[];
  let activePhenotype=null;
  let phenotypeRemaining=0;
  let weaponCooldown=0;
  let abilityCooldown=0;
  let facing=1;
  let simTime=0;
  let activeLevelId='';
  let defeated=0;
  let notice=null;
  let enemyBossImage=null;
  let enemyBossReady=false;
  let enemyBossFailed=false;

  const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const runtime=()=>window.__SEED_MAN_V20_ENEMY_RUNTIME__;
  const currentForm=()=>activePhenotype||'plant';

  function loadEnemyBossAtlas(){
    if(enemyBossReady||enemyBossFailed||enemyBossImage)return;
    const src=window.__SEED_MAN_APPROVED_IMAGES__?.[ENEMY_ATLAS_KEY];
    if(!src){
      enemyBossFailed=true;
      document.documentElement.dataset.seedManEnemyArt='missing';
      console.error(`[Seed Man] approved enemy atlas missing: ${ENEMY_ATLAS_KEY}. Placeholder enemy rendering is disabled.`);
      return;
    }
    const image=new Image();
    enemyBossImage=image;
    image.decoding='async';
    image.addEventListener('load',()=>{
      enemyBossReady=true;
      enemyBossFailed=false;
      document.documentElement.dataset.seedManEnemyArt='ready';
    },{once:true});
    image.addEventListener('error',()=>{
      enemyBossReady=false;
      enemyBossFailed=true;
      document.documentElement.dataset.seedManEnemyArt='failed';
      console.error('[Seed Man] approved enemy/boss atlas failed to decode. Placeholder enemy rendering is disabled.');
    },{once:true});
    image.src=src;
  }

  function syncIdentity() {
    document.documentElement.dataset.seedManCombat=VERSION;
    document.documentElement.dataset.seedPhenoActive=activePhenotype?'true':'false';
    document.documentElement.dataset.seedPhenoForm=currentForm();
    const def=PHENOTYPES[activePhenotype];
    if(def?.accent) document.documentElement.style.setProperty('--seed-pheno-accent',def.accent);
    else document.documentElement.style.removeProperty('--seed-pheno-accent');
  }

  function ensureHud() {
    const hud=document.querySelector('.hud');
    if(hud&&!document.querySelector('#combat-phenotype-count')) {
      const phenotype=document.createElement('span');
      phenotype.className='combat-pheno-chip';
      phenotype.innerHTML='Pheno <strong id="combat-phenotype-count">Plant</strong> <em id="combat-phenotype-time" aria-live="polite"></em>';
      const threat=document.createElement('span');
      threat.innerHTML='Threats <strong id="combat-threat-count">0</strong>';
      hud.append(phenotype,threat);
    }
  }

  function blightWeakness(enemy=null) {
    const target=enemy?.archetype==='blight-king'?enemy:null;
    const boss=activeLevelBoss();
    if(!target&&boss?.id!=='blight-king')return null;
    const phase=Math.max(1,Math.min(4,Number(target?.phase||boss?.phase||1)));
    return BLIGHT_WEAKNESSES[phase-1];
  }

  function syncHud() {
    const def=PHENOTYPES[activePhenotype];
    const label=document.querySelector('#combat-phenotype-count');
    const timer=document.querySelector('#combat-phenotype-time');
    const threat=document.querySelector('#combat-threat-count');
    const ability=document.querySelector('#combat-ability-button');
    if(label) label.textContent=def?.label||'Plant';
    if(timer) timer.textContent=activePhenotype?`${Math.ceil(phenotypeRemaining)}s`:'';
    if(threat) threat.textContent=String(enemies.filter((enemy)=>!enemy.defeated).length);
    if(ability){
      ability.textContent=activePhenotype?`${def.label.toUpperCase()} ${Math.ceil(phenotypeRemaining)}`:'PHENO';
      ability.dataset.active=activePhenotype?'true':'false';
      ability.disabled=Boolean(typeof player!=='undefined'&&player?.finished);
    }
    const weakness=blightWeakness();
    if(weakness){
      document.documentElement.dataset.seedManFinalBossWeakness=weakness;
      document.documentElement.style.setProperty('--seed-boss-weakness',FORM_ACCENTS[weakness]);
    }else{
      delete document.documentElement.dataset.seedManFinalBossWeakness;
      document.documentElement.style.removeProperty('--seed-boss-weakness');
    }
    syncIdentity();
  }

  function setNotice(text,seconds=1.8){notice={text,until:simTime+seconds};}

  function resetCombat(){
    activeLevelId=typeof level!=='undefined'?(level?.id||''):'';
    const factory=runtime()?.buildEncounter;
    enemies=typeof factory==='function'&&level?factory(level).map((enemy,index)=>({...enemy,maxHealth:enemy.health,dir:index%2?-1:1,defeated:false,hitFlash:0,freeze:0,burn:0,burnTick:0.5,burnPhenotype:null,baseY:enemy.y})):[];
    projectiles=[];activePhenotype=null;phenotypeRemaining=0;weaponCooldown=0;abilityCooldown=0;facing=1;simTime=0;defeated=0;
    if(level?.boss?.id==='blight-king')setNotice('Blight King · weakness cycle: Plant → Fire → Electric → Ice',3.4);
    else if(level)setNotice('Seed Slinger ready · defeat phenotype carriers for 30s powers',2.8);
    syncHud();
  }

  function spawnProjectile(def,ability=false){
    if(typeof player==='undefined'||!player||player.finished)return;
    const dir=facing<0?-1:1;
    const phenotype=ability?(activePhenotype||def.form||'plant'):'plant';
    projectiles.push({id:`${ability?'pheno':'seed'}-${simTime}-${projectiles.length}`,x:player.x+player.width/2+dir*14,y:player.y+player.height*0.46,width:12,height:8,vx:def.speed*dir,damage:def.damage,effect:def.effect||null,phenotype,ability,life:PROJECTILE_LIFE});
  }

  function fireWeapon(){
    if(typeof player==='undefined'||!player||player.finished||weaponCooldown>0)return false;
    weaponCooldown=0.18;spawnProjectile({form:'plant',speed:560,damage:1,effect:null});return true;
  }

  function fireAbility(){
    if(typeof player==='undefined'||!player||player.finished||abilityCooldown>0)return false;
    const def=PHENOTYPES[activePhenotype];
    if(!def||phenotypeRemaining<=0){setNotice('Defeat a Fire, Electric, or Ice carrier to absorb its power for 30s.');return false;}
    abilityCooldown=def.cooldown;spawnProjectile(def,true);setNotice(`${def.label} phenotype · ${Math.ceil(phenotypeRemaining)}s`,0.9);return true;
  }

  function activeLevelBoss(){
    try{return typeof level!=='undefined'&&level?.boss?level.boss:null;}catch{return null;}
  }

  function syncBossState(enemy){
    const boss=activeLevelBoss();
    if(!boss||enemy.role!=='boss'||enemy.archetype!==boss.id)return;
    const required=Math.max(1,Number(boss.requiredHits)||Number(enemy.maxHealth)||1);
    const remaining=Math.max(0,Number(enemy.health)||0);
    const priorPhase=Number(boss.phase)||1;
    boss.hits=Math.max(0,Math.min(required,required-remaining));
    boss.phase=Math.min(Number(boss.phases)||1,Math.max(1,Math.floor((boss.hits/required)*(Number(boss.phases)||1))+1));
    enemy.phase=boss.phase;
    if(boss.id==='blight-king'){
      const weakness=blightWeakness(enemy);
      document.documentElement.dataset.seedManFinalBossPhase=String(boss.phase);
      document.documentElement.dataset.seedManFinalBossWeakness=weakness;
      if(boss.phase!==priorPhase){
        setNotice(`BLIGHT KING PHASE ${boss.phase} · WEAKNESS: ${weakness.toUpperCase()}`,2.8);
        window.dispatchEvent(new CustomEvent('seedman:boss-phase',{detail:{boss:'blight-king',phase:boss.phase,weakness}}));
      }
    }
    if(remaining<=0||enemy.defeated){
      boss.hits=required;
      boss.phase=Number(boss.phases)||boss.phase||1;
      enemy.phase=boss.phase;
      boss.defeated=true;
      window.dispatchEvent(new CustomEvent('seedman:boss-defeated',{detail:{boss:boss.id,levelId:activeLevelId,finalBoss:Boolean(boss.finalBoss)}}));
    }
  }

  function rewardEnemy(enemy){
    defeated+=1;
    syncBossState(enemy);
    if(enemy.phenotype&&PHENOTYPES[enemy.phenotype]){
      activePhenotype=enemy.phenotype;phenotypeRemaining=PHENOTYPE_DURATION;
      setNotice(`PHENOTYPE ABSORBED · ${PHENOTYPES[enemy.phenotype].label.toUpperCase()} · 30s`,3);
    }else if(enemy.role==='boss') setNotice(`${enemy.name} defeated · exit unlocked`,2.5);
    else setNotice(`${enemy.name} defeated`,1.1);
    syncHud();
  }

  function damageMultiplier(enemy,phenotype){
    if(enemy?.archetype!=='blight-king')return 1;
    return phenotype===blightWeakness(enemy)?1.5:0.65;
  }

  function applyDamage(enemy,amount,phenotype='plant'){
    if(enemy.defeated)return 0;
    const multiplier=damageMultiplier(enemy,phenotype);
    const damage=Math.max(0,Number(amount)||0)*multiplier;
    enemy.health=Math.max(0,enemy.health-damage);
    enemy.hitFlash=0.14;
    if(enemy.archetype==='blight-king'){
      const weakness=blightWeakness(enemy);
      setNotice(multiplier>1?`WEAKNESS HIT · ${weakness.toUpperCase()} ×1.5`:`RESISTED · USE ${weakness.toUpperCase()}`,0.72);
    }
    syncBossState(enemy);
    return damage;
  }

  function damageEnemy(enemy,projectile){
    if(enemy.defeated)return;
    applyDamage(enemy,projectile.damage,projectile.phenotype||'plant');
    if(projectile.effect==='freeze')enemy.freeze=Math.max(enemy.freeze,2.2);
    if(projectile.effect==='burn'){enemy.burn=Math.max(enemy.burn,2.4);enemy.burnTick=0.5;enemy.burnPhenotype=projectile.phenotype||'fire';}
    if(projectile.effect==='chain'){
      const secondary=enemies.find((candidate)=>!candidate.defeated&&candidate.id!==enemy.id&&Math.abs(candidate.x-enemy.x)<190);
      if(secondary){applyDamage(secondary,1,projectile.phenotype||'electric');if(secondary.health<=0){secondary.defeated=true;rewardEnemy(secondary);}}
    }
    if(enemy.health<=0){enemy.defeated=true;rewardEnemy(enemy);}
  }

  function tickEnemy(enemy,step){
    enemy.hitFlash=Math.max(0,enemy.hitFlash-step);enemy.freeze=Math.max(0,enemy.freeze-step);
    if(enemy.burn>0){
      enemy.burn=Math.max(0,enemy.burn-step);enemy.burnTick-=step;
      if(enemy.burnTick<=0){
        enemy.burnTick=0.5;
        applyDamage(enemy,1,enemy.burnPhenotype||'fire');
        if(enemy.health<=0){enemy.defeated=true;rewardEnemy(enemy);return;}
      }
    }
    if(enemy.freeze>0||enemy.speed<=0)return;
    enemy.x+=enemy.dir*enemy.speed*step;
    if(enemy.x<=enemy.minX){enemy.x=enemy.minX;enemy.dir=1;}
    if(enemy.x+enemy.width>=enemy.maxX){enemy.x=enemy.maxX-enemy.width;enemy.dir=-1;}
    if(enemy.flying)enemy.y=enemy.baseY+Math.sin(simTime*2.6+enemy.x*0.008)*(enemy.elite?30:20);
    if(enemy.blink&&Math.sin(simTime*2.1+enemy.x*0.001)>0.985)enemy.x=Math.max(enemy.minX,Math.min(enemy.maxX-enemy.width,enemy.x+enemy.dir*125));
  }

  function tickCombat(dt){
    const step=Math.max(0,Math.min(Number(dt)||0,0.05));
    const current=typeof level!=='undefined'?(level?.id||''):'';
    if(current!==activeLevelId)resetCombat();
    simTime+=step;
    weaponCooldown=Math.max(0,weaponCooldown-step);abilityCooldown=Math.max(0,abilityCooldown-step);
    if(activePhenotype){phenotypeRemaining=Math.max(0,phenotypeRemaining-step);if(phenotypeRemaining<=0){activePhenotype=null;setNotice('Phenotype expired · Plant restored',1.4);}}
    if(typeof player!=='undefined'&&player&&Math.abs(Number(player.vx)||0)>1)facing=player.vx<0?-1:1;
    for(const enemy of enemies)if(!enemy.defeated)tickEnemy(enemy,step);
    for(const projectile of projectiles){projectile.x+=projectile.vx*step;projectile.life-=step;if(projectile.life<=0)continue;const enemy=enemies.find((candidate)=>!candidate.defeated&&overlap(projectile,candidate));if(enemy){damageEnemy(enemy,projectile);projectile.life=0;}}
    const worldWidth=typeof level!=='undefined'?(level?.worldWidth||8000):8000;
    projectiles=projectiles.filter((projectile)=>projectile.life>0&&projectile.x>-80&&projectile.x<worldWidth+80);
    syncHud();
  }

  function sourceRect(visual){
    const region=visual?.region;
    if(!region||!enemyBossImage)return null;
    const sx=Math.round(region.x*enemyBossImage.naturalWidth);
    const sy=Math.round(region.y*enemyBossImage.naturalHeight);
    const sw=Math.round(region.width*enemyBossImage.naturalWidth);
    const sh=Math.round(region.height*enemyBossImage.naturalHeight);
    if(sw<=0||sh<=0||sx<0||sy<0||sx+sw>enemyBossImage.naturalWidth+1||sy+sh>enemyBossImage.naturalHeight+1)return null;
    return {sx,sy,sw,sh};
  }

  function drawEnemy(enemy){
    if(enemy.defeated||typeof ctx==='undefined'||typeof cameraX==='undefined')return;
    if(!enemyBossReady||!enemyBossImage)return;
    const visual=enemy.approvedVisual;
    if(!visual||visual.atlas!==ENEMY_ATLAS_KEY)return;
    const source=sourceRect(visual);
    if(!source)return;
    const centerX=enemy.x-cameraX+enemy.width/2;
    const feetY=enemy.y+enemy.height;
    const boss=visual.row==='boss';
    const sizeScale=Math.max(0.75,Math.min(1.35,Number(visual.sizeScale)||1));
    const destH=(boss?Math.max(128,enemy.height*1.2):Math.max(68,enemy.height*2.0))*sizeScale;
    const destW=destH*(source.sw/source.sh);
    const carrier=Boolean(enemy.phenotype);
    const weakness=blightWeakness(enemy);
    const accent=carrier?(PHENOTYPES[enemy.phenotype]?.accent||'#c8f36a'):(weakness?FORM_ACCENTS[weakness]:(visual.aura||'#8ecf78'));

    ctx.save();
    ctx.globalAlpha=enemy.hitFlash>0?0.62:1;
    ctx.shadowBlur=carrier?18:(boss?16:0);
    ctx.shadowColor=accent;
    if(visual.mirrorX){
      ctx.translate(centerX,0);
      ctx.scale(-1,1);
      ctx.drawImage(enemyBossImage,source.sx,source.sy,source.sw,source.sh,-destW/2,feetY-destH,destW,destH);
    }else{
      ctx.drawImage(enemyBossImage,source.sx,source.sy,source.sw,source.sh,centerX-destW/2,feetY-destH,destW,destH);
    }
    ctx.restore();

    if(carrier||boss){
      ctx.save();ctx.strokeStyle=accent;ctx.lineWidth=boss?3:2.5;ctx.globalAlpha=boss?0.68:1;
      ctx.beginPath();ctx.ellipse(centerX,feetY-destH*.46,destW*.48,destH*.48,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    const barWidth=Math.max(34,Math.min(boss?128:70,destW*.78));
    const barX=centerX-barWidth/2;const barY=feetY-destH-11;
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(barX,barY,barWidth,6);
    ctx.fillStyle=accent;ctx.fillRect(barX,barY,barWidth*Math.max(0,enemy.health/enemy.maxHealth),6);
    if(enemy.archetype==='blight-king'){
      ctx.save();ctx.fillStyle='#f4f7ee';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText(`PHASE ${enemy.phase||1} · ${String(weakness||'plant').toUpperCase()}`,centerX,barY-5);ctx.restore();
    }
  }

  function drawProjectile(projectile){
    if(typeof ctx==='undefined'||typeof cameraX==='undefined')return;ctx.save();
    const accent=FORM_ACCENTS[projectile.phenotype]||'#e7d3a4';ctx.fillStyle=accent;ctx.shadowBlur=projectile.ability?12:4;ctx.shadowColor=accent;ctx.beginPath();ctx.ellipse(projectile.x-cameraX+projectile.width/2,projectile.y+projectile.height/2,projectile.width/2,projectile.height/2,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function drawCombat(){
    for(const enemy of enemies)drawEnemy(enemy);for(const projectile of projectiles)drawProjectile(projectile);
    if(notice&&simTime<notice.until&&typeof ctx!=='undefined'&&typeof canvas!=='undefined'){ctx.save();ctx.font='800 13px system-ui';ctx.textAlign='center';ctx.fillStyle='rgba(7,22,15,.9)';ctx.fillRect(20,18,canvas.width-40,34);ctx.fillStyle='#f4f7ee';ctx.fillText(notice.text,canvas.width/2,40);ctx.restore();}
  }

  function installHooks(){
    if(typeof stepPlayer!=='function'||typeof render!=='function'||typeof reset!=='function')return false;
    const baseStep=stepPlayer;stepPlayer=function seedManCombatV2Step(inputPlayer,inputState,levelData,dt,config){const next=baseStep(inputPlayer,inputState,levelData,dt,config);const isPaused=typeof paused!=='undefined'?paused:false;if(!isPaused&&!next.finished)tickCombat(dt);return next;};
    const baseRender=render;render=function seedManCombatV2Render(){baseRender();drawCombat();};
    const baseReset=reset;reset=function seedManCombatV2Reset(){baseReset();resetCombat();};return true;
  }

  window.addEventListener('keydown',(event)=>{if(event.repeat)return;const key=event.key.toLowerCase();if(key==='j'||key==='x'){event.preventDefault();fireWeapon();}if(key==='k'||key==='c'){event.preventDefault();fireAbility();}},{passive:false});
  loadEnemyBossAtlas();ensureHud();resetCombat();const installed=installHooks();syncHud();
  window.__SPROUT_COMBAT_BROWSER__=Object.freeze({
    version:VERSION,
    installed,
    phenotypeForms:Object.freeze(['plant','fire','electric','ice']),
    blightWeaknesses:BLIGHT_WEAKNESSES,
    enemyArt:Object.freeze({atlasKey:ENEMY_ATLAS_KEY,enemyCols:ENEMY_FRAME_COLS,bossCols:BOSS_FRAME_COLS,rows:ENEMY_FRAME_ROWS,regionBased:true,fallbackAllowed:false}),
    fireWeapon,
    fireAbility,
    snapshot:()=>({
      version:VERSION,
      installed,
      levelId:activeLevelId,
      activePhenotype,
      phenotypeForm:currentForm(),
      phenotypeRemaining,
      finalBossWeakness:blightWeakness(),
      defeated,
      enemyArtReady:enemyBossReady,
      enemyArtFailed:enemyBossFailed,
      enemies:enemies.map(({id,name,archetype,health,maxHealth,defeated:down,phenotype,phenotypeForm,flying,blink,elite,role,phase,approvedVisual})=>({id,name,archetype,health,maxHealth,defeated:down,phenotype,phenotypeForm,flying:Boolean(flying),blink:Boolean(blink),elite:Boolean(elite),role,phase,approvedVisual}))
    })
  });
})();
