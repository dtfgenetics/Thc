import {spawnSync} from 'node:child_process';

for(const script of ['scripts/validate-cultivation-math-engine-static.mjs','scripts/test-cultivation-math-engine.mjs']){
 const result=spawnSync(process.execPath,[script],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
console.log('All cultivation math engine checks passed.');
