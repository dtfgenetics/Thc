import fs from 'node:fs';

const required=[
 'site/public-route-patch/assets/thc-cultivation-math-v1.mjs',
 'scripts/test-cultivation-math-engine.mjs',
 'scripts/validate-cultivation-math-engine-static.mjs',
 'docs/CULTIVATION_MATH_ENGINE_V1.md',
 'docs/CODE_HARVEST_ATTRIBUTION.md',
 'docs/CULTIVATION_MATH_ENGINE_INTEGRATION_PLAN.md'
];
const missing=required.filter(file=>!fs.existsSync(file));
if(missing.length){console.error('Cultivation math integration readiness failed:');for(const file of missing)console.error(' - missing '+file);process.exit(1)}
const ledger=fs.readFileSync('docs/CODE_HARVEST_ATTRIBUTION.md','utf8');
if(!ledger.includes('Direct code copied?')||!ledger.includes('No external project source code was copied')){console.error('Attribution ledger contract missing');process.exit(1)}
console.log('Cultivation math integration readiness passed.');
