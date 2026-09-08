import { validateProductionGameContract } from './game-contract.mjs';
import { validateApprovedArtManifest } from '../render/art-registry.mjs';

export function productionReadinessReport(input){
  const checks=[];
  const run=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.message});}};
  run('approved-art-manifest',()=>validateApprovedArtManifest(input.manifest));
  run('production-game-contract',()=>validateProductionGameContract(input));
  run('twenty-levels',()=>{if(input.levels?.levels?.length!==20)throw new Error('Expected 20 levels');});
  run('five-worlds',()=>{if(input.campaign?.worlds?.length!==5)throw new Error('Expected five worlds');});
  run('final-boss',()=>{const boss=input.bosses?.bosses?.['blight-king'];if(!boss?.finalBoss||boss.phases!==4)throw new Error('Blight King final boss contract invalid');});
  run('approved-assets-no-fallback',()=>{if(input.manifest?.policy?.proceduralFallbackAllowed!==false||input.manifest?.policy?.legacyAtlasFallbackAllowed!==false)throw new Error('Visual fallbacks still enabled');});
  return {ok:checks.every(check=>check.ok),checks};
}
