import { validateProductionGameContract } from './game-contract.mjs';
import { validateApprovedArtManifest } from '../render/art-registry.mjs';
import { assertPlayerStateContract, createPlayerState } from './player-state.mjs';
import { buildHudModel } from './hud-model.mjs';

export function productionReadinessReport(input){
  const checks=[];
  const run=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.message});}};

  run('game-data',()=>validateProductionGameContract(input));
  if(input.manifest) run('art-manifest',()=>validateApprovedArtManifest(input.manifest));
  run('level-data',()=>{
    if(!Array.isArray(input.levels?.levels) || input.levels.levels.length===0) throw new Error('At least one playable level is required');
  });
  run('player-state',()=>assertPlayerStateContract(createPlayerState()));
  run('hud-model',()=>{
    const hud=buildHudModel({playerState:createPlayerState()});
    if(!hud || typeof hud!=='object') throw new Error('HUD model did not build');
  });

  return {ok:checks.every(check=>check.ok),checks};
}
