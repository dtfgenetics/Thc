import assert from 'node:assert/strict';
import fs from 'node:fs';
import { productionReadinessReport } from '../src/systems/production-readiness.mjs';
const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const input={campaign:read('../data/campaign-20-v1.json'),levels:read('../data/levels-20-v1.json'),bosses:read('../data/boss-catalog-v1.json'),enemies:read('../data/enemy-catalog-v1.json'),manifest:read('../data/seed-man-art-manifest-v1.json')};
const report=productionReadinessReport(input);
assert.equal(report.ok,true,JSON.stringify(report,null,2));
assert.equal(report.checks.length,11);
for(const name of ['enemy-roster','phenotype-contract','player-state-contract','hud-contract','input-contract']){
  assert.equal(report.checks.find((check)=>check.name===name)?.ok,true,`missing or failed readiness gate: ${name}`);
}
console.log(JSON.stringify(report,null,2));
