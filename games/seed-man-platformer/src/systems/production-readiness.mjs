import { validateProductionGameContract } from './game-contract.mjs';
import { validateApprovedArtManifest } from '../render/art-registry.mjs';

export function productionReadinessReport(input={}){
  const checks=[];
  const run=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.message});}};

  run('game-contract',()=>validateProductionGameContract(input));
  if (input.manifest) run('art-manifest-shape',()=>validateApprovedArtManifest(input.manifest));
  run('campaign-loadable',()=>{
    if (!input.campaign || typeof input.campaign !== 'object') throw new Error('Campaign data is missing');
  });
  run('level-data-loadable',()=>{
    if (!input.levels || typeof input.levels !== 'object') throw new Error('Level data is missing');
  });

  return {
    ok:checks.every(check=>check.ok),
    checks,
    note:'Readiness validates loadability and internal consistency without fixing level counts, world counts, boss identity, phenotype duration, renderer, art family, or fallback policy.'
  };
}
