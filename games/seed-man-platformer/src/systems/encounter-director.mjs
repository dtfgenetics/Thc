import { createEnemyFromArchetype } from './enemy-archetypes.mjs';

const CARRIER_TYPE=Object.freeze({fire:'fire-carrier',electric:'electric-carrier',ice:'ice-carrier'});

export function instantiateLevelEnemies(layout={}){
  const common=(layout.enemySpawns||[]).map((spawn)=>createEnemyFromArchetype(spawn.type||spawn.archetype,{
    id:spawn.id,x:spawn.x,y:spawn.y,patrolMinX:spawn.minX??spawn.patrolMinX,patrolMaxX:spawn.maxX??spawn.patrolMaxX
  }));
  const carriers=(layout.phenotypeCarrierSpawns||[]).map((spawn)=>{
    const archetype=spawn.type||CARRIER_TYPE[spawn.form];
    const enemy=createEnemyFromArchetype(archetype,{id:spawn.id,x:spawn.x,y:spawn.y,patrolMinX:spawn.minX,patrolMaxX:spawn.maxX});
    return {...enemy,phenotype:spawn.form||enemy.phenotypeReward||null};
  });
  return [...common,...carriers];
}

export function instantiateLevelBosses(layout={}){
  return (layout.bosses||[]).map((spawn)=>createEnemyFromArchetype(spawn.type,{id:spawn.id,x:spawn.x,y:spawn.y,patrolMinX:spawn.arenaStartX,patrolMaxX:spawn.arenaEndX}));
}

export function createEncounterDirector(layout={}){
  let enemies=instantiateLevelEnemies(layout);
  let bosses=instantiateLevelBosses(layout);
  const zones=[...(layout.encounterZones||[])];
  return Object.freeze({
    enemies:()=>enemies.map((enemy)=>({...enemy})),
    bosses:()=>bosses.map((enemy)=>({...enemy})),
    zones:()=>zones.map((zone)=>({...zone})),
    activeZoneAt(x){return zones.find((zone)=>Number(x)>=Number(zone.startX)&&Number(x)<=Number(zone.endX))||null;},
    removeEnemy(id){enemies=enemies.filter((enemy)=>enemy.id!==id);bosses=bosses.filter((enemy)=>enemy.id!==id);return enemies.length+bosses.length;},
    remaining(){return enemies.length+bosses.length;}
  });
}
