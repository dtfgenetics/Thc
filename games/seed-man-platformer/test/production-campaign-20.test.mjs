import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBossState, stepBossState, bossWeakness } from '../src/systems/boss-state-machine.mjs';

const campaign=JSON.parse(fs.readFileSync(new URL('../data/campaign-20-v1.json',import.meta.url),'utf8'));
const levels=JSON.parse(fs.readFileSync(new URL('../data/levels-20-v1.json',import.meta.url),'utf8'));
const bosses=JSON.parse(fs.readFileSync(new URL('../data/boss-catalog-v1.json',import.meta.url),'utf8')).bosses;
const enemies=JSON.parse(fs.readFileSync(new URL('../data/enemy-catalog-v1.json',import.meta.url),'utf8'));

assert.equal(campaign.levelCount,20);
assert.equal(campaign.worlds.length,5);
assert.equal(campaign.worlds.flatMap(w=>w.levels).length,20);
assert.deepEqual(campaign.worlds.map(w=>w.levels.length),[4,4,4,4,4]);
assert.equal(levels.levels.length,20);
assert.deepEqual(levels.levels.map(l=>l.order),Array.from({length:20},(_,i)=>i+1));
assert.ok(levels.levels.every(l=>l.background.startsWith('world.')));
assert.ok(levels.levels.every(l=>l.tiles==='platform.atlas'));
assert.equal(levels.levels.at(-1).boss,'blight-king');
assert.equal(campaign.finalBoss,'blight-king');
assert.equal(bosses['blight-king'].finalBoss,true);
assert.equal(bosses['blight-king'].phases,4);
assert.equal(bosses['blight-king'].phaseRules.length,4);
assert.deepEqual(bosses['blight-king'].phaseRules.map(p=>p.weakness),['plant','fire','electric','ice']);
assert.equal(enemies.phenotypeCarriers['fire-carrier'].dropDurationMs,30000);
assert.equal(enemies.phenotypeCarriers['electric-carrier'].dropDurationMs,30000);
assert.equal(enemies.phenotypeCarriers['ice-carrier'].dropDurationMs,30000);

const def={id:'blight-king',...bosses['blight-king']};
let state=createBossState(def);
assert.equal(state.phase,1);
assert.equal(bossWeakness(state,def),'plant');
state=stepBossState(state,def,0.016,{damage:25});
assert.equal(state.phase,2);
assert.equal(bossWeakness(state,def),'fire');
state={...state,invulnerable:false,attackCooldown:0};
state=stepBossState(state,def,0.016,{damage:24});
assert.equal(state.phase,3);
assert.equal(bossWeakness(state,def),'electric');
state={...state,invulnerable:false,attackCooldown:0};
state=stepBossState(state,def,0.016,{damage:24});
assert.equal(state.phase,4);
assert.equal(bossWeakness(state,def),'ice');
state={...state,invulnerable:false,attackCooldown:0};
state=stepBossState(state,def,0.016,{damage:99});
assert.equal(state.defeated,true);

console.log('Seed Man 20-level production campaign contract OK');
