'use strict';

(() => {
  const VERSION = 'seed-man-campaign-combat-v20-v1';
  const PHENOTYPE_SECONDS = 30;
  const archetypes = Object.freeze({
    'sproutling': { name:'Sproutling', hp:2, speed:42, w:34, h:30, accent:'#76d858' },
    'root-crawler': { name:'Root Crawler', hp:3, speed:50, w:42, h:28, accent:'#8b6847' },
    'toxic-spore': { name:'Toxic Spore', hp:3, speed:36, w:34, h:34, accent:'#a477cf', flying:true },
    'drone-bot': { name:'Drone Bot', hp:4, speed:68, w:40, h:30, accent:'#f2d74e', flying:true, phenotype:'electric' },
    'thorn-beetle': { name:'Thorn Beetle', hp:4, speed:56, w:44, h:32, accent:'#ef7547', phenotype:'fire' },
    'sky-wasp': { name:'Sky Wasp', hp:3, speed:82, w:38, h:26, accent:'#f6c94f', flying:true },
    'spike-plant': { name:'Spike Plant', hp:5, speed:18, w:42, h:46, accent:'#79ce59', phenotype:'plant' },
    'sludge-monster': { name:'Sludge Monster', hp:6, speed:34, w:52, h:42, accent:'#d15d3d', phenotype:'fire' },
    'bone-weed': { name:'Bone Weed', hp:5, speed:42, w:44, h:44, accent:'#c7d5c3' },
    'shadow-root': { name:'Shadow Root', hp:6, speed:54, w:48, h:40, accent:'#7fdcf5', phenotype:'ice' }
  });
  const phenotypeMeta = Object.freeze({
    plant:{label:'Plant',accent:'#77d65b',damage:1,speed:600,cooldown:.34},
    fire:{label:'Fire',accent:'#ff754b',damage:2,speed:650,cooldown:.38},
    electric:{label:'Electric',accent:'#ffe34f',damage:1,speed:720,cooldown:.3},
    ice:{label:'Ice',accent:'#86e9ff',damage:1,speed:580,cooldown:.4}
  });

  let enemies=[];
  let shots=[];
  let currentLevelId='';
  let attackCooldown=0;
  let abilityCooldown=0;
  let phenotype='plant';
  let phenotypeTimer=0;
  let facing=1;
  let installed=false;
  let originalStep=null;
  let originalRender=null;
  let originalReset=null;
  let bossFlash=0;

  const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  function makeEnemy(type,index,count) {
    const meta=archetypes[type]||archetypes.sproutling;
    const usable=Math.max(800,(level?.worldWidth||5000)-1500);
    const x=620+(usable*((index+1)/(count+1)));
    const flying=Boolean(meta.flying);
    return {
      id:`v20-${level.id}-${index}-${type}`,type,name:meta.name,
      x,y:flying?285+(index%3)*45:480-meta.h,width:meta.w,height:meta.h,
      minX:Math.max(120,x-170),maxX:Math.min((level?.worldWidth||5000)-120,x+190),
      hp:meta.hp,maxHp:meta.hp,speed:meta.speed,dir:index%2?1:-1,accent:meta.accent,
      flying,phenotype:meta.phenotype||null,dead:false,freeze:0
    };
  }

  function rebuild() {
    if(typeof level==='undefined'||!level) return;
    currentLevelId=level.id;
    const pool=Array.isArray(level.enemyPool)&&level.enemyPool.length?level.enemyPool:['sproutling'];
    const count=clamp(6+Math.floor((Number(level.levelNumber)||1)/2),6,14);
    enemies=Array.from({length:count},(_,i)=>makeEnemy(pool[i%pool.length],i,count));
    shots=[];
    attackCooldown=0;
    abilityCooldown=0;
    phenotype='plant';
    phenotypeTimer=0;
    if(player){player.combatHealth=3;player.maxCombatHealth=3;}
    syncHud();
  }

  function ensureLevel() {
    if(typeof level==='undefined'||!level) return;
    if(currentLevelId!==level.id) rebuild();
  }

  function absorb(kind) {
    if(!phenotypeMeta[kind]) return;
    phenotype=kind;
    phenotypeTimer=PHENOTYPE_SECONDS;
    window.dispatchEvent(new CustomEvent('seedman:phenotype-absorbed',{detail:{phenotype:kind,duration:PHENOTYPE_SECONDS}}));
  }

  function fire() {
    if(typeof player==='undefined'||!player||player.finished||attackCooldown>0) return;
    const meta=phenotypeMeta[phenotype];
    const dir=Math.abs(player.vx)>8?Math.sign(player.vx):facing;
    facing=dir||1;
    shots.push({x:player.x+player.width/2+(facing>0?16:-16),y:player.y+player.height*.45,width:12,height:9,vx:meta.speed*facing,damage:meta.damage,life:1.35,kind:phenotype,pierce:phenotype==='electric'?1:0});
    attackCooldown=meta.cooldown;
  }

  function ability() {
    if(typeof player==='undefined'||!player||player.finished||abilityCooldown>0) return;
    const radius=phenotype==='plant'?115:phenotype==='fire'?150:phenotype==='electric'?180:145;
    const damage=phenotype==='fire'?3:2;
    for(const enemy of enemies){
      if(enemy.dead) continue;
      const dx=(enemy.x+enemy.width/2)-(player.x+player.width/2);
      const dy=(enemy.y+enemy.height/2)-(player.y+player.height/2);
      if(Math.hypot(dx,dy)<=radius){enemy.hp-=damage;if(phenotype==='ice')enemy.freeze=2.2;if(enemy.hp<=0)killEnemy(enemy);}
    }
    if(level?.boss&&!level.boss.defeated){
      const boss=level.boss;
      const dx=(boss.x+boss.width/2)-(player.x+player.width/2);
      const dy=(boss.y+boss.height/2)-(player.y+player.height/2);
      if(Math.hypot(dx,dy)<=radius+50)damageBoss(damage);
    }
    abilityCooldown=phenotype==='electric'?2.2:2.7;
  }

  function killEnemy(enemy) {
    if(enemy.dead) return;
    enemy.dead=true;
    if(enemy.phenotype) absorb(enemy.phenotype);
  }

  function damageBoss(amount) {
    const boss=level?.boss;
    if(!boss||boss.defeated) return;
    boss.hits=(boss.hits||0)+amount;
    bossFlash=.14;
    if(boss.hits>=boss.requiredHits){
      boss.hits=boss.requiredHits;
      boss.defeated=true;
      window.dispatchEvent(new CustomEvent('seedman:boss-defeated',{detail:{id:boss.id,name:boss.name,levelId:level.id}}));
    }
  }

  function updateCombat(dt,next,previous) {
    ensureLevel();
    attackCooldown=Math.max(0,attackCooldown-dt);
    abilityCooldown=Math.max(0,abilityCooldown-dt);
    bossFlash=Math.max(0,bossFlash-dt);
    if(phenotypeTimer>0){phenotypeTimer=Math.max(0,phenotypeTimer-dt);if(phenotypeTimer===0)phenotype='plant';}
    if(Math.abs(next.vx)>8) facing=Math.sign(next.vx);

    for(const shot of shots){shot.x+=shot.vx*dt;shot.life-=dt;}
    for(const enemy of enemies){
      if(enemy.dead) continue;
      enemy.freeze=Math.max(0,enemy.freeze-dt);
      const slow=enemy.freeze>0?.22:1;
      enemy.x+=enemy.dir*enemy.speed*slow*dt;
      if(enemy.x<=enemy.minX){enemy.x=enemy.minX;enemy.dir=1;}
      if(enemy.x+enemy.width>=enemy.maxX){enemy.x=enemy.maxX-enemy.width;enemy.dir=-1;}
      if(enemy.flying) enemy.y+=Math.sin((performance.now()/450)+enemy.x*.01)*12*dt;
    }

    for(const shot of shots){
      if(shot.life<=0) continue;
      for(const enemy of enemies){
        if(enemy.dead||!overlap(shot,enemy)) continue;
        enemy.hp-=shot.damage;
        if(shot.kind==='ice')enemy.freeze=2.4;
        if(enemy.hp<=0)killEnemy(enemy);
        if(shot.pierce>0)shot.pierce-=1;else shot.life=0;
        break;
      }
      const boss=level?.boss;
      if(shot.life>0&&boss&&!boss.defeated&&overlap(shot,boss)){damageBoss(shot.damage);shot.life=0;}
    }
    shots=shots.filter(s=>s.life>0&&s.x>-100&&s.x<(level?.worldWidth||8000)+100);

    if((next.power?.invulnerableTimer||0)<=0){
      const hit=enemies.find(e=>!e.dead&&overlap(next,e));
      if(hit){
        next.combatHealth=Number.isFinite(next.combatHealth)?next.combatHealth:3;
        next.combatHealth-=1;
        next.power.invulnerableTimer=1.05;
        next.vx=(next.x<hit.x?-1:1)*330;
        next.vy=-300;
        next.state='hurt';
        if(next.combatHealth<=0){respawn(next,DEFAULTS);next.combatHealth=3;}
      }
    }

    const boss=level?.boss;
    if(boss&&!boss.defeated){
      const playerReachedFinish=next.finished;
      if(playerReachedFinish){next.finished=false;next.finishBlocked=true;next.state='idle';next.x=Math.min(next.x,Math.max(80,boss.arenaEndX-next.width-40));}
      if((next.power?.invulnerableTimer||0)<=0&&overlap(next,boss)){
        next.combatHealth=Number.isFinite(next.combatHealth)?next.combatHealth:3;
        next.combatHealth-=1;next.power.invulnerableTimer=1.2;next.vx=next.x<boss.x?-420:420;next.vy=-360;next.state='hurt';
        if(next.combatHealth<=0){respawn(next,DEFAULTS);next.combatHealth=3;}
      }
    }
    syncHud();
  }

  function drawEnemy(enemy) {
    if(enemy.dead) return;
    const x=enemy.x-cameraX,y=enemy.y;
    if(x<-90||x>canvas.width+90)return;
    ctx.save();
    if(enemy.freeze>0){ctx.globalAlpha=.78;ctx.strokeStyle='#9beeff';ctx.lineWidth=4;ctx.strokeRect(x-3,y-3,enemy.width+6,enemy.height+6);}
    ctx.fillStyle=enemy.accent;ctx.strokeStyle='#13251c';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.roundRect(x,y,enemy.width,enemy.height,Math.min(10,enemy.height/3));ctx.fill();ctx.stroke();
    ctx.fillStyle='#f7fff1';ctx.beginPath();ctx.arc(x+enemy.width*.68,y+enemy.height*.32,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#13251c';ctx.beginPath();ctx.arc(x+enemy.width*.69,y+enemy.height*.32,1.4,0,Math.PI*2);ctx.fill();
    if(enemy.phenotype){ctx.fillStyle=phenotypeMeta[enemy.phenotype]?.accent||'#fff';ctx.fillRect(x,y-6,enemy.width*(enemy.hp/enemy.maxHp),3);}
    ctx.restore();
  }

  function drawBoss() {
    const boss=level?.boss;if(!boss||boss.defeated)return;
    const x=boss.x-cameraX;if(x<-220||x>canvas.width+220)return;
    ctx.save();ctx.fillStyle=bossFlash>0?'#ffffff':boss.accent;ctx.strokeStyle='#10291d';ctx.lineWidth=5;
    ctx.beginPath();ctx.roundRect(x,boss.y,boss.width,boss.height,22);ctx.fill();ctx.stroke();
    ctx.fillStyle='#10291d';ctx.font='900 14px system-ui';ctx.textAlign='center';ctx.fillText(boss.name,x+boss.width/2,boss.y-24);
    const pct=clamp((boss.requiredHits-(boss.hits||0))/boss.requiredHits,0,1);ctx.fillStyle='#10291dcc';ctx.fillRect(x,boss.y-16,boss.width,8);ctx.fillStyle=boss.accent;ctx.fillRect(x,boss.y-16,boss.width*pct,8);ctx.restore();
  }

  function drawCombat() {
    if(typeof ctx==='undefined'||!ctx||typeof canvas==='undefined'||!canvas)return;
    for(const enemy of enemies)drawEnemy(enemy);
    for(const shot of shots){const meta=phenotypeMeta[shot.kind]||phenotypeMeta.plant;ctx.save();ctx.fillStyle=meta.accent;ctx.shadowColor=meta.accent;ctx.shadowBlur=10;ctx.beginPath();ctx.ellipse(shot.x-cameraX,shot.y,8,5,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    drawBoss();
  }

  function ensureHud() {
    if(document.querySelector('#seed-combat-v20'))return;
    const shell=document.querySelector('.game-shell');if(!shell)return;
    const bar=document.createElement('div');bar.id='seed-combat-v20';bar.setAttribute('aria-live','polite');bar.style.cssText='display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 10px;background:#10291de8;color:#fff;font:800 12px system-ui';
    bar.innerHTML='<span id="seed-health-v20">Health 3/3</span><span id="seed-form-v20">Form Plant</span><button type="button" data-seed-attack-v20>ATTACK J</button><button type="button" data-seed-ability-v20>POWER K</button>';
    shell.append(bar);
    bar.querySelector('[data-seed-attack-v20]')?.addEventListener('pointerdown',e=>{e.preventDefault();fire();});
    bar.querySelector('[data-seed-ability-v20]')?.addEventListener('pointerdown',e=>{e.preventDefault();ability();});
  }

  function syncHud() {
    ensureHud();
    const health=document.querySelector('#seed-health-v20');if(health&&typeof player!=='undefined'&&player)health.textContent=`Health ${player.combatHealth??3}/${player.maxCombatHealth??3}`;
    const form=document.querySelector('#seed-form-v20');if(form){const meta=phenotypeMeta[phenotype];form.textContent=`Form ${meta.label}${phenotypeTimer>0?` ${Math.ceil(phenotypeTimer)}s`:''}`;form.style.color=meta.accent;}
  }

  function onKey(e) {
    if(e.repeat)return;
    const key=e.key.toLowerCase();
    if(key==='j'){e.preventDefault();fire();}
    if(key==='k'){e.preventDefault();ability();}
  }

  function install() {
    if(installed)return;
    if(!window.__SEED_MAN_CAMPAIGN_V20__||typeof stepPlayer!=='function'||typeof render!=='function'||typeof reset!=='function'){setTimeout(install,40);return;}
    installed=true;
    originalStep=stepPlayer;originalRender=render;originalReset=reset;
    stepPlayer=function seedManCampaignCombatStep(inputPlayer,inputState,levelData,dt,config=DEFAULTS){const previous=inputPlayer;const next=originalStep(inputPlayer,inputState,levelData,dt,config);updateCombat(Math.min(.05,Math.max(0,dt)),next,previous);return next;};
    render=function seedManCampaignCombatRender(){originalRender();drawCombat();};
    reset=function seedManCampaignCombatReset(){originalReset();rebuild();};
    window.addEventListener('keydown',onKey,{passive:false});
    window.addEventListener('sprout:level-selected',()=>setTimeout(rebuild,0));
    ensureHud();rebuild();
    document.documentElement.dataset.seedManCampaignCombat=VERSION;
    window.__SEED_MAN_CAMPAIGN_COMBAT_V20__=Object.freeze({version:VERSION,phenotypeSeconds:PHENOTYPE_SECONDS,get phenotype(){return phenotype;},get enemyCount(){return enemies.filter(e=>!e.dead).length;}});
  }

  if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
