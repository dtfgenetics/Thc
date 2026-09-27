import {spawnSync} from 'node:child_process';

const scripts=[
 'scripts/run-cultivation-math-engine-checks.mjs',
 'scripts/test-cultivation-math-edge-cases.mjs',
 'scripts/test-light-lab-math-adapter.mjs',
 'scripts/validate-cultivation-math-engine-integration.mjs',
 'scripts/validate-cultivation-math-docs.mjs',
 'scripts/validate-thc-tool-suite-v1.mjs'
];
for(const script of scripts){
 const result=spawnSync(process.execPath,[script],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
console.log('Cultivation math release checks passed.');
