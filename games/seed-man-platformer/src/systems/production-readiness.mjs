import { validateProductionGameContract } from './game-contract.mjs';
import { validateApprovedArtManifest } from '../render/art-registry.mjs';
import { assertPlayerStateContract, createPlayerState } from './player-state.mjs';
import { PHENOTYPES } from './phenotype-system.mjs';
import { INPUT_ACTIONS } from './input-actions.mjs';
import { buildHudModel } from './hud-model.mjs';

export function productionReadinessReport(input){
  const checks=[];
  const run=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.message});}};
  run('approved-art-manifest',()=>validateApprovedArtManifest(input.manifest));
  run('production-game-contract',()=>validateProductionGameContract(input));
  run('twenty-levels',()=>{if(input.levels?.levels?.length!==20)throw new Error('Expected 20 levels');});
  run('five-worlds',()=>{if(input.campaign?.worlds?.length!==5)throw new Error('Expected five worlds');});
  run('enemy-roster',()=>{
    const common=Object.keys(input.enemies?.common||{});
    const carriers=Object.keys(input.enemies?.phenotypeCarriers||{});
    if(common.length!==10)throw new Error(`Expected 10 common enemy archetypes, received ${common.length}`);
    if(carriers.length!==3)throw new Error(`Expected three phenotype carriers, received ${carriers.length}`);
    for(const id of ['fire-carrier','electric-carrier','ice-carrier'])if(!input.enemies?.phenotypeCarriers?.[id])throw new Error(`Missing phenotype carrier: ${id}`);
  });
  run('phenotype-contract',()=>{
    const ids=Object.keys(PHENOTYPES);
    if(JSON.stringify(ids)!==JSON.stringify(['plant','fire','electric','ice']))throw new Error(`Unexpected phenotype forms: ${ids.join(',')}`);
    for(const id of ['fire','electric','ice'])if(PHENOTYPES[id].durationMs!==30000)throw new Error(`${id} phenotype must last 30 seconds`);
  });
  run('player-state-contract',()=>assertPlayerStateContract(createPlayerState()));
  run('hud-contract',()=>{
    const hud=buildHudModel({playerState:createPlayerState()});
    for(const key of ['health','maxHealth','energy','maxEnergy','lives','seeds','world','level','movementState','deaths','enemyHits','finished','phenotype','phenotypeRemainingMs'])if(!Object.hasOwn(hud,key))throw new Error(`HUD model missing ${key}`);
  });
  run('input-contract',()=>{
    for(const action of ['move-left','move-right','jump','attack','phenotype','pause'])if(!INPUT_ACTIONS.includes(action))throw new Error(`Missing input action: ${action}`);
  });
  run('final-boss',()=>{const boss=input.bosses?.bosses?.['blight-king'];if(!boss?.finalBoss||boss.phases!==4)throw new Error('Blight King final boss contract invalid');});
  run('approved-assets-no-fallback',()=>{if(input.manifest?.policy?.proceduralFallbackAllowed!==false||input.manifest?.policy?.legacyAtlasFallbackAllowed!==false)throw new Error('Visual fallbacks still enabled');});
  return {ok:checks.every(check=>check.ok),checks};
}
