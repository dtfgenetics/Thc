import fs from 'node:fs';

const errors=[];
const assert=(condition,message)=>{if(!condition)errors.push(message);};

const contract=JSON.parse(fs.readFileSync('configuration/release-observability-contract.json','utf8'));
const builder=fs.readFileSync('scripts/build-release-observability.mjs','utf8');
const gateway=fs.readFileSync('.github/workflows/dtfseeds-production-gateway.yml','utf8');

assert(contract.schemaVersion===1,'release observability contract must be schema v1');
assert(contract.checkpointTag==='dtfseeds-production','release observability checkpoint tag must remain dtfseeds-production');
const expectedStages=['source','tested','packaged','deployed','liveVerified','checkpointed'];
assert(JSON.stringify((contract.stages||[]).map(x=>x.id))===JSON.stringify(expectedStages),'release observability stages must preserve source -> tested -> packaged -> deployed -> liveVerified -> checkpointed order');

for(const token of [
  "RELEASE_SOURCE_SHA",
  "RELEASE_WANT_WORDPRESS",
  "RELEASE_WANT_EDUCATION",
  "RELEASE_WANT_HARVEST_OUTDOOR",
  "RELEASE_WANT_PUBLIC",
  "RELEASE_CHECKPOINT_OUTCOME",
  "aggregateChildEvidenceIsExactStageProof:false",
  "mergeSuccessIsProductionSuccess:false"
]){
  assert(builder.includes(token),`release observability builder missing required token: ${token}`);
}

for(const token of [
  'Build release observability ledger',
  'Upload release observability ledger',
  'scripts/build-release-observability.mjs',
  'dtf-release-observability',
  'RELEASE_CHECKPOINT_OUTCOME',
  'RELEASE_ENFORCE_OUTCOME'
]){
  assert(gateway.includes(token),`production gateway missing release observability integration: ${token}`);
}

const checkpointIndex=gateway.indexOf('Advance successful production checkpoint');
const ledgerIndex=gateway.indexOf('Build release observability ledger');
assert(checkpointIndex>=0,'production gateway checkpoint step missing');
assert(ledgerIndex>checkpointIndex,'release observability ledger must be built after checkpoint outcome is known');

if(errors.length){
  console.error(`Release observability validation failed with ${errors.length} issue(s):`);
  for(const error of errors)console.error(' - '+error);
  process.exit(1);
}
console.log('Release observability contract validated: explicit source, validation/package, deploy, live verification, and checkpoint evidence are wired into the production gateway.');
