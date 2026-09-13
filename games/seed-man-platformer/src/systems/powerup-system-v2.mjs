import { PHENOTYPES } from './phenotype-system.mjs';
import { phenotypeDropForEnemy } from './power-drop.mjs';

const VALID_FORMS=Object.freeze(['plant','fire','electric','ice']);

export function createPowerupState(){return Object.freeze({active:'plant',expiresAt:0,discovered:['plant'],pickupSerial:0,lastPickup:null});}

export function normalizePowerupState(state={}){
  const active=VALID_FORMS.includes(state.active)?state.active:'plant';
  const discovered=[...new Set([...(Array.isArray(state.discovered)?state.discovered:['plant']),'plant'])].filter((id)=>VALID_FORMS.includes(id));
  return Object.freeze({active,expiresAt:active==='plant'?0:Number(state.expiresAt)||0,discovered,pickupSerial:Number(state.pickupSerial)||0,lastPickup:state.lastPickup||null});
}

export function collectPhenotypePickup(state,phenotype,nowMs=0,source='world'){
  const current=normalizePowerupState(state);
  if(!VALID_FORMS.includes(phenotype)||phenotype==='plant')return current;
  const def=PHENOTYPES[phenotype];
  const discovered=[...new Set([...current.discovered,phenotype])];
  return Object.freeze({active:phenotype,expiresAt:Number(nowMs)+def.durationMs,discovered,pickupSerial:current.pickupSerial+1,lastPickup:Object.freeze({phenotype,source,at:Number(nowMs)})});
}

export function updatePowerupState(state,nowMs=0){
  const current=normalizePowerupState(state);
  if(current.active!=='plant'&&current.expiresAt>0&&Number(nowMs)>=current.expiresAt){
    return Object.freeze({...current,active:'plant',expiresAt:0});
  }
  return current;
}

export function remainingPowerupMs(state,nowMs=0){const current=updatePowerupState(state,nowMs);return current.active==='plant'?0:Math.max(0,current.expiresAt-Number(nowMs));}
export function activePowerDefinition(state,nowMs=0){const current=updatePowerupState(state,nowMs);return PHENOTYPES[current.active]||PHENOTYPES.plant;}

export function createDropFromDefeatedEnemy(enemy,nowMs=0){
  const drop=phenotypeDropForEnemy(enemy);
  if(!drop)return null;
  return Object.freeze({id:`phenotype-${drop.phenotype}-${enemy?.id||'enemy'}-${Math.round(Number(nowMs))}`,type:'phenotype',phenotype:drop.phenotype,x:Number(enemy?.x)||0,y:Number(enemy?.y)||0,spawnedAt:Number(nowMs),expiresAt:Number(nowMs)+12000,pickupRadius:34,sourceEnemyId:enemy?.id||null});
}

export function pickupIsActive(drop,nowMs=0){return Boolean(drop)&&Number(nowMs)<Number(drop.expiresAt||Infinity);}
export function canCollectPickup(drop,player,nowMs=0){
  if(!pickupIsActive(drop,nowMs)||drop.type!=='phenotype')return false;
  const px=Number(player?.x)||0,py=Number(player?.y)||0,dx=Number(drop.x)||0,dy=Number(drop.y)||0;
  const radius=Number(drop.pickupRadius)||34;
  return Math.hypot(px-dx,py-dy)<=radius;
}
