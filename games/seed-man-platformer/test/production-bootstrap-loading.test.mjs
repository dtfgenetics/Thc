import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapProductionGame } from '../src/systems/production-bootstrap.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const progress=[];
let transientFailures=0;

async function fetchImpl(url){
  const clean=String(url).replace(/^\.\/data\//,'');
  if(clean==='powerup-catalog-v1.json'&&transientFailures===0){
    transientFailures+=1;
    return {ok:false,status:503,json:async()=>null};
  }
  const file=path.join(root,'data',clean);
  return {
    ok:fs.existsSync(file),
    status:fs.existsSync(file)?200:404,
    json:async()=>JSON.parse(fs.readFileSync(file,'utf8')),
  };
}

const bundle=await bootstrapProductionGame({
  baseUrl:'./',
  fetchImpl,
  retries:1,
  onProgress:(event)=>progress.push(event),
});

assert.equal(bundle.assets.ready,true);
assert.equal(bundle.campaign.id,'seed-man-campaign-20-v1');
assert.equal(bundle.levels.levels.length,20);
assert.equal(transientFailures,1);
assert.equal(progress[0].phase,'start');
assert.equal(progress.some((event)=>event.phase==='retry'&&event.id==='powerups'),true);
assert.equal(progress.at(-1).phase,'ready');
assert.equal(progress.at(-1).progress,1);

console.log('Seed Man production bootstrap loading contract OK');
