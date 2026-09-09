'use strict';

(async () => {
  const VERSION = 'seed-man-enemy-attacks-browser-v2';
  const HIT_INVULN = 0.85;
  const attackApi = await import('./enemy-attacks.js');
  const { createEnemyAttackState, stepEnemyAttack, advanceEnemyProjectile, overlapsRect } = attackApi;

  let attackers=[];
  let attackStates=new Map();
  let hostileProjectiles=[];
  let hostileHitboxes=[];
  let telegraphs=new Map();
  let activeLevelId='';
  let simTime=0;
  let hitsTaken=0;

  const enemyRuntime=()=>window.__SEED_MAN_V20_ENEMY_RUNTIME__;

  function resetAttacks(){
    activeLevelId=typeof level!=='undefined'?(level?.id||''):'';
    const factory=enemyRuntime()?.buildAttackers;
    attackers=typeof factory==='function'?factory(level).map((enemy,index)=>({...enemy,baseY:enemy.y,dir:index%2?-1:1,phase:1,defeated:false})):[];
    attackStates=new Map(attackers.map((enemy,index)=>[enemy.id,createEnemyAttackState(enemy,{initialDelay:0.7+index*0.14})]));
    hostileProjectiles=[];hostileHitboxes=[];telegraphs=new Map();simTime=0;
    document.documentElement.dataset.seedManEnemyAttacks=VERSION;
  }

  function syncDefeated(){
    const snapshot=window.__SPROUT_COMBAT_BROWSER__?.snapshot?.();
    if(!snapshot)return;
    const byId=new Map(snapshot.enemies.map((enemy)=>[enemy.id,enemy]));
    for(const attacker of attackers)attacker.defeated=Boolean(byId.get(attacker.id)?.defeated);
  }

  function moveAttacker(enemy,dt){
    if(enemy.defeated)return;
    if(enemy.movement==='blink'||enemy.blink){
      const wave=Math.sin(simTime*1.4+enemy.x*0.002);
      enemy.x=Math.max(enemy.minX,Math.min(enemy.maxX-enemy.width,enemy.x+wave*enemy.speed*dt));
    }else if(enemy.speed>0){
      enemy.x+=enemy.dir*enemy.speed*dt;
      if(enemy.x<=enemy.minX){enemy.x=enemy.minX;enemy.dir=1;}
      if(enemy.x+enemy.width>=enemy.maxX){enemy.x=enemy.maxX-enemy.width;enemy.dir=-1;}
    }
    if(enemy.movement==='flying'||enemy.flying)enemy.y=enemy.baseY+Math.sin(simTime*2.4+enemy.x*0.006)*(enemy.elite?32:24);
  }

  function knockbackPlayer(next,source,damage){
    next.power=next.power||{};
    if((Number(next.power.invulnerableTimer)||0)>0)return false;
    const dir=(next.x+next.width/2)<(source.x+source.width/2)?-1:1;
    next.power.invulnerableTimer=HIT_INVULN;
    next.state='hurt';next.vx=dir*Math.min(460,320+Math.max(0,Number(damage)-1)*55);next.vy=-280;next.grounded=false;next.enemyAttackHits=(next.enemyAttackHits||0)+1;hitsTaken+=1;return true;
  }

  function stepAttackRuntime(next,dt){
    const step=Math.max(0,Math.min(Number(dt)||0,0.05));
    const current=typeof level!=='undefined'?(level?.id||''):'';
    if(current!==activeLevelId)resetAttacks();
    simTime+=step;syncDefeated();
    for(const enemy of attackers){
      moveAttacker(enemy,step);if(enemy.defeated)continue;
      const state=attackStates.get(enemy.id)||createEnemyAttackState(enemy,{initialDelay:0.5});
      const result=stepEnemyAttack(state,enemy,next,step);attackStates.set(enemy.id,result.state);
      for(const event of result.events){if(event.type==='enemy-attack-telegraph')telegraphs.set(enemy.id,{pattern:event.pattern,until:simTime+event.duration});if(event.type==='enemy-attack-released')telegraphs.delete(enemy.id);}
      hostileProjectiles.push(...result.projectiles);hostileHitboxes.push(...result.hitboxes.map((hitbox)=>({...hitbox,remaining:hitbox.duration})));
    }
    const worldWidth=typeof level!=='undefined'?(level?.worldWidth||8000):8000;
    hostileProjectiles=hostileProjectiles.map((projectile)=>advanceEnemyProjectile(projectile,step)).filter((projectile)=>projectile.lifetime>0&&projectile.x>-120&&projectile.x<worldWidth+120);
    for(const projectile of hostileProjectiles){if(projectile.hit||!overlapsRect(projectile,next))continue;if(knockbackPlayer(next,projectile,projectile.damage))projectile.hit=true;}
    hostileProjectiles=hostileProjectiles.filter((projectile)=>!projectile.hit);
    for(const hitbox of hostileHitboxes){hitbox.remaining=Math.max(0,hitbox.remaining-step);if(hitbox.type==='ground-wave')hitbox.x+=(Number(hitbox.speed)||0)*step;if(!hitbox.hit&&overlapsRect(hitbox,next)&&knockbackPlayer(next,hitbox,hitbox.damage))hitbox.hit=true;}
    hostileHitboxes=hostileHitboxes.filter((hitbox)=>hitbox.remaining>0&&!hitbox.hit);
  }

  function drawAttacks(){
    if(typeof ctx==='undefined'||typeof cameraX==='undefined')return;ctx.save();
    for(const enemy of attackers){const telegraph=telegraphs.get(enemy.id);if(!telegraph||telegraph.until<=simTime||enemy.defeated)continue;const x=enemy.x-cameraX+enemy.width/2;const y=enemy.y+enemy.height/2;ctx.strokeStyle='rgba(255,202,97,.92)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,Math.max(enemy.width,enemy.height)*(0.72+Math.abs(Math.sin(simTime*15))*0.18),0,Math.PI*2);ctx.stroke();}
    for(const projectile of hostileProjectiles){ctx.fillStyle='#ffb45f';ctx.shadowBlur=10;ctx.shadowColor='#ff7f4d';ctx.beginPath();ctx.arc(projectile.x-cameraX+projectile.width/2,projectile.y+projectile.height/2,6,0,Math.PI*2);ctx.fill();}
    for(const hitbox of hostileHitboxes){ctx.globalAlpha=.34;ctx.fillStyle=hitbox.type==='blink-strike'?'#cf9cff':'#ff8b62';ctx.fillRect(hitbox.x-cameraX,hitbox.y,hitbox.width,hitbox.height);ctx.globalAlpha=1;}
    ctx.restore();
  }

  function installHooks(){
    if(typeof stepPlayer!=='function'||typeof render!=='function'||typeof reset!=='function')return false;
    const baseStep=stepPlayer;stepPlayer=function seedManEnemyAttackV2Step(inputPlayer,inputState,levelData,dt,config){const next=baseStep(inputPlayer,inputState,levelData,dt,config);const isPaused=typeof paused!=='undefined'?paused:false;if(!isPaused&&!next.finished)stepAttackRuntime(next,dt);return next;};
    const baseRender=render;render=function seedManEnemyAttackV2Render(){baseRender();drawAttacks();};
    const baseReset=reset;reset=function seedManEnemyAttackV2Reset(){baseReset();resetAttacks();};return true;
  }

  resetAttacks();const installed=installHooks();
  window.__SPROUT_ENEMY_ATTACKS_BROWSER__=Object.freeze({version:VERSION,installed,snapshot:()=>({version:VERSION,levelId:activeLevelId,hitsTaken,attackers:attackers.map(({id,name,archetype,attackPattern,defeated,phenotype,phenotypeForm})=>({id,name,archetype,attackPattern,defeated,phenotype,phenotypeForm})),projectiles:hostileProjectiles.length,hitboxes:hostileHitboxes.length})});
})();
