import assert from 'node:assert/strict';
import { serializeCampaignState,deserializeCampaignState,saveCampaignState,loadCampaignState } from '../src/systems/save-state-v2.mjs';
const state={currentLevelId:'3-2-canyon-cliffs',unlocked:new Set(['1-1-sprout-steps','3-2-canyon-cliffs']),completed:new Set(['1-1-sprout-steps']),bossesDefeated:new Set(['overgrown-guardian']),percent:5};
const restored=deserializeCampaignState(serializeCampaignState(state));
assert.equal(restored.currentLevelId,state.currentLevelId);
assert.equal(restored.unlocked.has('3-2-canyon-cliffs'),true);
const map=new Map();const storage={setItem:(k,v)=>map.set(k,v),getItem:(k)=>map.get(k)||null};
saveCampaignState(storage,state);const loaded=loadCampaignState(storage,null);assert.equal(loaded.bossesDefeated.has('overgrown-guardian'),true);
console.log('Seed Man save state v2 OK');
