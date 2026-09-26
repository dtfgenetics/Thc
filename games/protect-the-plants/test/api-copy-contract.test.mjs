import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='site/public-route-patch/games/protect-the-plants';
const api=fs.readFileSync(`${root}/api.php`,'utf8');
const gameplay=fs.readFileSync(`${root}/gameplay-v3.js`,'utf8');

assert.match(api,/function find_wp_bootstrap\(\): \?string/,'API must locate WordPress from the deployed document root or an ancestor.');
assert.match(api,/function store_set\(string \$key, array \$value, int \$ttl = PTP_TTL\): bool/,'Storage writes must report whether persistence succeeded.');
assert.match(api,/!store_set\(\$roomKey, \$room\) \|\| !is_array\(store_get\(\$roomKey\)\)/,'Room creation must verify an immediate storage read-back.');
assert.ok(api.includes('Game storage is temporarily unavailable. Please try again.'),'Storage failures must return an actionable player-facing error.');

for(const marker of [
  'All bud formations are required.',
  'Invalid bud formation.',
  'Formation is outside the stash grid.',
  'Bud formations cannot overlap.',
  'created the Burn Buds room.',
  'This room already has two players.',
  'joined the Burn Buds room.',
  'locked their stash.',
  'Both stashes are locked.',
  'Target is outside the battle grid.',
  'You already fired at that cell.',
  'burned a full bud formation.',
  'burned every opposing bud and won round'
]){
  assert.ok(api.includes(marker),`Missing Burn Buds API copy marker: ${marker}`);
}

for(const legacy of [
  'All plant formations are required.',
  'Invalid plant formation.',
  'Formation is outside the garden.',
  'Plant formations cannot overlap.',
  'created the garden.',
  'This garden already has two players.',
  'joined the garden.',
  'locked their garden.',
  'Both gardens are locked.',
  'Plot is outside the garden.',
  'You already scouted that plot.',
  'found an entire plant formation.',
  'protected their garden and won round'
]){
  assert.ok(!api.includes(legacy),`Legacy player-facing API copy remains: ${legacy}`);
}

assert.ok(api.includes("'type' => 'scout'"),'Internal scout event type must remain for saved-session/client compatibility.');
assert.ok(gameplay.includes(".replace('created the garden.','created the Burn Buds room.')"),'Browser migration shim must keep translating legacy room history during the transition window.');
assert.ok(gameplay.includes(".replace('You already scouted that plot.','You already fired at that cell.')"),'Browser migration shim must keep translating legacy error copy during the transition window.');

const app=fs.readFileSync(`${root}/app.js`,'utf8');
assert.ok(app.includes("btn.setAttribute('aria-busy','true')"),'Network actions must expose a busy state and reject accidental double submission.');
assert.ok(app.includes("{error:true}"),'Network failures must remain visible as explicit error feedback.');
assert.match(app,/error\?6000:2200/,'Error feedback must remain visible long enough to read.');

console.log('Burn Buds API copy and legacy-session compatibility contract passed.');
