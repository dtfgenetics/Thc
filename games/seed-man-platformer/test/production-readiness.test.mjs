import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOCKED_CHARACTER_REFERENCE, productionReadinessReport } from '../src/systems/production-readiness.mjs';

const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const input={
  campaign:read('../data/campaign-20-v1.json'),
  levels:read('../data/levels-20-v1.json'),
  bosses:read('../data/boss-catalog-v1.json'),
  enemies:read('../data/enemy-catalog-v1.json'),
  manifest:read('../data/seed-man-art-manifest-v1.json')
};
const report=productionReadinessReport(input);

assert.equal(report.ok,false,'Seed Man must remain blocked while the production character identity differs from the locked mascot identity');
assert.equal(report.checks.length,12);

const identity=report.checks.find((check)=>check.name==='canonical-character-identity');
assert.equal(identity?.ok,false,'canonical character mismatch must block production readiness');
assert.match(identity?.error ?? '',new RegExp(LOCKED_CHARACTER_REFERENCE));

for(const name of ['approved-art-manifest','production-game-contract','twenty-levels','five-worlds','enemy-roster','phenotype-contract','player-state-contract','hud-contract','input-contract','final-boss','approved-assets-no-fallback']){
  assert.equal(report.checks.find((check)=>check.name===name)?.ok,true,`missing or failed structural readiness gate: ${name}`);
}

console.log(JSON.stringify(report,null,2));
