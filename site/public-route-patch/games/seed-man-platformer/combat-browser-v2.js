'use strict';

(() => {
  const VERSION = 'seed-man-combat-browser-v2';
  const PHENOTYPE_DURATION = 30;
  const PROJECTILE_LIFE = 1.6;
  const PHENOTYPES = Object.freeze({
    'solar-flare': { form:'fire', label:'Fire', speed:560, damage:2, effect:'burn', cooldown:0.42, accent:'#ff9a4b' },
    'static-haze': { form:'electric', label:'Electric', speed:660, damage:1, effect:'chain', cooldown:0.38, accent:'#d6c0ff' },
    'frost-resin': { form:'ice', label:'Ice', speed:520, damage:1, effect:'freeze', cooldown:0.40, accent:'#8fe7ff' }
  });

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

  const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const runtime=()=>window.__SEED_MAN_V20_ENEMY_RUNTIME__;

  function syncIdentity() {
    document.documentElement.dataset.seedManCombat=VERSION;
    document.documentElement.dataset.seedPhenoActive=activePhenotype?'true':'false';
    document.documentElement.dataset.seedPhenoForm=activePhenotype?PHENOTYPES[activePhenotype]?.form||'plant':'plant';
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
    const controls=document.querySelector('.controls');
    if(controls&&!document.querySelector('#combat-attack-button')) {
      const attack=document.createElement('button');
      attack.type='button';attack.id='combat-attack-button';attack.textContent='ATTACK';
      attack.addEventListener('pointerdown',(event)=>{event.preventDefault();fireWeapon();});
      const ability=document.createElement('button');
      ability.type='button';ability.id='combat-ability-button';ability.textContent='PHENO';
      ability.addEventListener('pointerdown',(event)=>{event.preventDefault();fireAbility();});
      controls.append(attack,ability);
    }
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
    if(ability) ability.textContent=activePhenotype?`${def.label.toUpperCase()} ${Math.ceil(phenotypeRemaining)}`:'PHENO';
    syncIdentity();
  }

  function setNotice(text,seconds=1.8){notice={text,until:simTime+seconds};}

  function resetCombat(){
    activeLevelId=typeof level!=='undefined'?(level?.id||''):'';
    const factory=runtime()?.buildEncounter;
    enemies=typeof factory==='function'?factory(level).map((enemy,index)=>({...enemy,maxHealth:enemy.health,dir:index%2?-1:1,defeated:false,hitFlash:0,freeze:0,burn:0,burnTick:0.5,baseY:enemy.y})):[];
    projectiles=[];activePhenotype=null;phenotypeRemaining=0;weaponCooldown=0;abilityCooldown=0;facing=1;simTime=0;defeated=0;
    setNotice('Seed Slinger ready · defeat phenotype carriers for 30s powers',2.8);
    syncHud();
  }

  function spawnProjectile(def,ability=false){
    if(typeof player==='undefined'||!player||player.finished)return;
    const dir=facing<0?-1:1;
    projectiles.push({id:`${ability?'pheno':'seed'}-${simTime}-${projectiles.length}`,x:player.x+player.width/2+dir*14,y:player.y+player.height*0.46,width:12,height:8,vx:def.speed*dir,damage:def.damage,effect:def.effect||null,ability,life:PROJECTILE_LIFE});
  }

  function fireWeapon(){
    if(typeof player==='undefined'||!player||player.finished||weaponCooldown>0)return false;
    weaponCooldown=0.18;spawnProjectile({speed:560,damage:1,effect:null});return true;
  }

  function fireAbility(){
    if(typeof player==='undefined'||!player||player.finished||abilityCooldown>0)return false;
    const def=PHENOTYPES[activePhenotype];
    if(!def||phenotypeRemaining<=0){setNotice('Defeat a Fire, Electric, or Ice carrier to absorb its power for 30s.');return false;}
    abilityCooldown=def.cooldown;spawnProjectile(def,true);setNotice(`${def.label} phenotype · ${Math.ceil(phenotypeRemaining)}s`,0.9);return true;
  }

  function rewardEnemy(enemy){
    defeated+=1;
    if(enemy.phenotype&&PHENOTYPES[enemy.phenotype]){
      activePhenotype=enemy.phenotype;phenotypeRemaining=PHENOTYPE_DURATION;
      setNotice(`PHENOTYPE ABSORBED · ${PHENOTYPES[enemy.phenotype].label.toUpperCase()} · 30s`,3);
    }else setNotice(`${enemy.name} defeated`,1.1);
    syncHud();
  }

  function damageEnemy(enemy,projectile){
    if(enemy.defeated)return;
    enemy.health=Math.max(0,enemy.health-Math.max(0,Number(projectile.damage)||0));enemy.hitFlash=0.14;
    if(projectile.effect==='freeze')enemy.freeze=Math.max(enemy.freeze,2.2);
    if(projectile.effect==='burn'){enemy.burn=Math.max(enemy.burn,2.4);enemy.burnTick=0.5;}
    if(projectile.effect==='chain'){
      const secondary=enemies.find((candidate)=>!candidate.defeated&&candidate.id!==enemy.id&&Math.abs(candidate.x-enemy.x)<190);
      if(secondary){secondary.health=Math.max(0,secondary.health-1);secondary.hitFlash=0.14;if(secondary.health<=0){secondary.defeated=true;rewardEnemy(secondary);}}
    }
    if(enemy.health<=0){enemy.defeated=true;rewardEnemy(enemy);}
  }

  function tickEnemy(enemy,step){
    enemy.hitFlash=Math.max(0,enemy.hitFlash-step);enemy.freeze=Math.max(0,enemy.freeze-step);
    if(enemy.burn>0){enemy.burn=Math.max(0,enemy.burn-step);enemy.burnTick-=step;if(enemy.burnTick<=0){enemy.burnTick=0.5;enemy.health=Math.max(0,enemy.health-1);if(enemy.health<=0){enemy.defeated=true;rewardEnemy(enemy);return;}}}
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
    simTime+=step;weaponCooldown=Math.max(0,weaponCooldown-step);abilityCooldown=Math.max(0,abilityCooldown-step);
    if(activePhenotype){phenotypeRemaining=Math.max(0,phenotypeRemaining-step);if(phenotypeRemaining<=0){setNotice(`${PHENOTYPES[activePhenotype]?.label||'Phenotype'} faded`,1.8);activePhenotype=null;syncHud();}}
    if(typeof player!=='undefined'&&player){if(player.vx>8)facing=1;else if(player.vx<-8)facing=-1;}
    for(const enemy of enemies)if(!enemy.defeated)tickEnemy(enemy,step);
    for(const projectile of projectiles){projectile.x+=projectile.vx*step;projectile.life-=step;for(const enemy of enemies){if(enemy.defeated||projectile.hit||!overlap(projectile,enemy))continue;damageEnemy(enemy,projectile);projectile.hit=true;}}
    const worldWidth=typeof level!=='undefined'?(level?.worldWidth||8000):8000;
    projectiles=projectiles.filter((projectile)=>!projectile.hit&&projectile.life>0&&projectile.x>-100&&projectile.x<worldWidth+100);
    syncHud();
  }

  function drawEnemy(enemy){
    if(enemy.defeated||typeof ctx==='undefined'||typeof cameraX==='undefined')return;
    const x=enemy.x-cameraX;ctx.save();
    const carrier=Boolean(enemy.phenotype);const accent=carrier?(PHENOTYPES[enemy.phenotype]?.accent||'#c8f36a'):'#8ecf78';
    ctx.globalAlpha=enemy.hitFlash>0?0.55:1;ctx.fillStyle=accent;ctx.shadowBlur=carrier?14:4;ctx.shadowColor=accent;
    ctx.fillRect(x,enemy.y,enemy.width,enemy.height);
    if(carrier){ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(x-3,enemy.y-3,enemy.width+6,enemy.height+6);}
    ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x,enemy.y-9,enemy.width,5);ctx.fillStyle='#e9f3e5';ctx.fillRect(x,enemy.y-9,enemy.width*(enemy.health/enemy.maxHealth),5);ctx.restore();
  }

  function drawProjectile(projectile){
    if(typeof ctx==='undefined'||typeof cameraX==='undefined')return;ctx.save();
    const accent=projectile.effect==='burn'?'#ff8d43':projectile.effect==='freeze'?'#8fe7ff':projectile.effect==='chain'?'#d2bcff':'#e7d3a4';ctx.fillStyle=accent;ctx.shadowBlur=projectile.ability?12:4;ctx.shadowColor=accent;ctx.beginPath();ctx.ellipse(projectile.x-cameraX+projectile.width/2,projectile.y+projectile.height/2,projectile.width/2,projectile.height/2,0,0,Math.PI*2);ctx.fill();ctx.restore();
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
  ensureHud();resetCombat();const installed=installHooks();syncHud();
  window.__SPROUT_COMBAT_BROWSER__=Object.freeze({version:VERSION,installed,phenotypeForms:Object.freeze(['plant','fire','electric','ice']),fireWeapon,fireAbility,snapshot:()=>({version:VERSION,installed,levelId:activeLevelId,activePhenotype,phenotypeForm:activePhenotype?PHENOTYPES[activePhenotype]?.form:'plant',phenotypeRemaining,defeated,enemies:enemies.map(({id,name,archetype,health,maxHealth,defeated:down,phenotype,phenotypeForm,flying,blink,elite})=>({id,name,archetype,health,maxHealth,defeated:down,phenotype,phenotypeForm,flying:Boolean(flying),blink:Boolean(blink),elite:Boolean(elite)}))})});
})();
