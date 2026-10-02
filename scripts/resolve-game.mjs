#!/usr/bin/env node
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const profileCatalog=JSON.parse(fs.readFileSync('configuration/game-qa/game-profiles.json','utf8'));
const args=process.argv.slice(2).filter(arg=>arg!=='--json');
const asJson=process.argv.includes('--json');
const requested=args.join(' ').trim();

if(!requested){
  console.error('Usage: npm run games:resolve -- <game-id-or-alias> [--json]');
  process.exit(1);
}

const key=requested.toLowerCase().trim();
const canonicalId=registry.aliasMap?.[key] || (registry.games||[]).some(game=>game.id===key) ? (registry.aliasMap?.[key] || key) : null;
if(!canonicalId){
  console.error(`Unknown game or alias: ${requested}`);
  process.exit(1);
}

const game=(registry.games||[]).find(entry=>entry.id===canonicalId);
if(!game){
  console.error(`Registry alias resolves to missing game: ${canonicalId}`);
  process.exit(1);
}

const assignment=profileCatalog.games?.[game.id] ?? {};
const dimensionNames=Object.keys(profileCatalog.dimensions||{});
const profile=Object.fromEntries(dimensionNames.map((name)=>[name,assignment[name] ?? null]));
const requiredChecks=[
  ...(profileCatalog.requiredChecks?.core ?? []),
  ...(profileCatalog.requiredChecks?.[profile.gameplayProfile] ?? []),
];
for(const [dimension,value] of Object.entries(profile)){
  for(const check of profileCatalog.dimensionChecks?.[dimension]?.[value] ?? []) requiredChecks.push(check);
}
const uniqueRequiredChecks=[...new Set(requiredChecks)];

const canonical={
  id:game.id,
  title:game.title,
  requested,
  canonicalRepository:game.production?.repository ?? null,
  sourcePaths:game.production?.sourcePaths ?? [],
  sourceOfTruth:game.production?.sourceOfTruth ?? game.gameDesignDoc ?? null,
  integrationRepository:game.production?.integrationRepository ?? registry.authority?.productionControlRepository ?? null,
  integrationPath:game.production?.integrationPath ?? null,
  integrationMode:game.production?.integrationMode ?? null,
  publicRoute:game.publicRoute ?? null,
  releaseStatus:game.release?.status ?? null,
  overlayEligible:game.release?.overlayEligible ?? null,
  lastVerifiedRevision:game.release?.lastVerifiedRevision ?? null,
  lastVerifiedAt:game.release?.lastVerifiedAt ?? null,
  blockers:game.release?.blockers ?? [],
  nextMilestone:game.release?.nextMilestone ?? null,
  buildCommand:game.verification?.buildCommand ?? game.production?.build ?? null,
  testCommands:game.verification?.testCommands ?? [],
  developmentLocations:game.developmentLocations ?? [],
  deprecatedLocations:game.deprecatedLocations ?? [],
  architecture:game.architecture ?? {},
  profile,
  requiredChecks:uniqueRequiredChecks,
  performanceBudget:profileCatalog.performanceBudgets?.[profile.performanceProfile] ?? null,
  profileReferences:profileCatalog.references ?? [],
};

if(asJson){
  console.log(JSON.stringify(canonical,null,2));
  process.exit(0);
}

console.log(`# ${canonical.title}`);
console.log(`Resolved: ${requested} -> ${canonical.id}`);
console.log(`Canonical repository: ${canonical.canonicalRepository ?? '—'}`);
console.log(`Source paths: ${canonical.sourcePaths.length ? canonical.sourcePaths.join(', ') : '—'}`);
console.log(`Source of truth: ${canonical.sourceOfTruth ?? '—'}`);
console.log(`Integration repository: ${canonical.integrationRepository ?? '—'}`);
console.log(`Integration mode: ${canonical.integrationMode ?? '—'}`);
console.log(`Public route: ${canonical.publicRoute ?? '—'}`);
console.log(`Release status: ${canonical.releaseStatus ?? '—'}`);
console.log(`Overlay eligible: ${canonical.overlayEligible===null ? '—' : String(canonical.overlayEligible)}`);
console.log(`Build/verification: ${canonical.buildCommand ?? '—'}`);
console.log('Profile:');
for(const [name,value] of Object.entries(canonical.profile)) console.log(`- ${name}: ${value ?? '—'}`);
if(canonical.performanceBudget){
  console.log(`Performance budget: soft ${canonical.performanceBudget.initialBytesSoft} B, hard ${canonical.performanceBudget.initialBytesHard} B, target playable ${canonical.performanceBudget.targetTimeToPlayableMs} ms`);
}
if(canonical.requiredChecks.length){
  console.log('Required profile checks:');
  for(const check of canonical.requiredChecks) console.log(`- ${check}`);
}
console.log('');
console.log('Next milestone:');
console.log(canonical.nextMilestone ?? '—');
if(canonical.blockers.length){
  console.log('');
  console.log('Blockers:');
  for(const blocker of canonical.blockers) console.log(`- ${blocker}`);
}
if(canonical.developmentLocations.length){
  console.log('');
  console.log('Development copies:');
  for(const location of canonical.developmentLocations){
    console.log(`- ${location.repository}: ${(location.paths||[]).join(', ')} [editable=${String(location.editable)}, releasable=${String(location.releasable)}]`);
  }
}
if(canonical.deprecatedLocations.length){
  console.log('');
  console.log('Deprecated copies:');
  for(const location of canonical.deprecatedLocations){
    console.log(`- ${location.repository}: ${(location.paths||[]).join(', ')}`);
  }
}
