import assert from 'node:assert/strict';
import fs from 'node:fs';
import { productionReadinessReport } from '../src/systems/production-readiness.mjs';

const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const input={
  campaign:read('../data/campaign-20-v1.json'),
  levels:read('../data/levels-20-v1.json'),
  bosses:read('../data/boss-catalog-v1.json'),
  enemies:read('../data/enemy-catalog-v1.json'),
  manifest:read('../data/seed-man-art-manifest-v1.json')
};

const report=productionReadinessReport(input);
assert.equal(report.ok,true,JSON.stringify(report,null,2));
for(const name of ['game-contract','art-manifest-shape','campaign-loadable','level-data-loadable']){
  assert.equal(report.checks.find((check)=>check.name===name)?.ok,true,`missing or failed readiness check: ${name}`);
}
assert.match(report.note,/without fixing level counts/);

const alternate={campaign:{worlds:[]},levels:{levels:[]},bosses:{},enemies:{},manifest:{id:'custom',assets:{}}};
assert.equal(productionReadinessReport(alternate).ok,true,'alternate game structures should not fail merely for changing counts or art contracts');

console.log(JSON.stringify(report,null,2));
